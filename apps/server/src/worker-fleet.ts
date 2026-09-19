import { GoogleAuth } from "google-auth-library";
import { randomUUID } from "node:crypto";
import type { DB } from "./db.js";
export type FleetConfig = {
  project: string;
  zone: string;
  names: string[];
  idleSeconds: number;
  slots: number;
};
export function fleetConfig(env = process.env): FleetConfig | undefined {
  if (env.WORKER_AUTOSCALE !== "true") return;
  const project = env.GCP_PROJECT ?? "",
    zone = env.WORKER_ZONE ?? "",
    names = (env.WORKER_NAMES ?? "").split(",");
  const idleSeconds = Number(env.WORKER_IDLE_SECONDS ?? 900),
    slots = Number(env.RUNNER_SLOTS_PER_HOST ?? 2);
  if (
    !/^[a-z][a-z0-9-]{4,62}$/.test(project) ||
    !/^[a-z0-9-]+$/.test(zone) ||
    names.length !== 2 ||
    new Set(names).size !== 2 ||
    names.some((n) => !/^[a-z][a-z0-9-]{0,62}$/.test(n)) ||
    !Number.isInteger(idleSeconds) ||
    idleSeconds < 60 ||
    !Number.isInteger(slots) ||
    slots < 1 ||
    slots > 5
  )
    throw new Error("INVALID_WORKER_FLEET");
  return { project, zone, names, idleSeconds, slots };
}
export interface ComputeFleet {
  status(name: string): Promise<string>;
  action(
    name: string,
    action: "START" | "STOP",
    requestId: string,
  ): Promise<void>;
}
export class GceFleet implements ComputeFleet {
  private auth = new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/compute"],
  });
  constructor(private config: FleetConfig) {}
  private url(name: string) {
    if (!this.config.names.includes(name)) throw new Error("UNMANAGED_WORKER");
    return `https://compute.googleapis.com/compute/v1/projects/${this.config.project}/zones/${this.config.zone}/instances/${name}`;
  }
  async status(name: string) {
    const url = this.url(name);
    try {
      return (
        await this.auth.request<{ status: string }>({
          url,
          timeout: 10000,
        })
      ).data.status;
    } catch {
      throw new Error("WORKER_STATUS_REQUEST_FAILED");
    }
  }
  async action(name: string, action: "START" | "STOP", requestId: string) {
    const url = this.url(name) + "/" + action.toLowerCase();
    try {
      const response = await this.auth.request<{ error?: unknown }>({
        url,
        method: "POST",
        params: { requestId },
        timeout: 10000,
      });
      if (response.data.error) throw new Error("WORKER_POWER_OPERATION_FAILED");
    } catch {
      throw new Error("WORKER_POWER_REQUEST_FAILED");
    }
  }
}
// Called by the minute scheduler. A durable action id makes uncertain Compute
// responses retryable. STOP stays fenced until TERMINATED is observed.
export async function reconcileFleet(
  db: DB,
  config: FleetConfig,
  compute: ComputeFleet,
) {
  const leader = randomUUID();
  const lock = await db.query(
    "UPDATE fleet_controller SET token=$1,expires_at=now()+interval '3 minutes' WHERE id=1 AND (expires_at IS NULL OR expires_at<now()) RETURNING id",
    [leader],
  );
  if (!lock.rows.length) return { busy: true };
  try {
    for (const name of config.names)
      await db.query(
        "INSERT INTO worker_hosts(name,desired,idle_since) VALUES($1,'RUNNING',now()) ON CONFLICT DO NOTHING",
        [name],
      );
    for (const name of config.names) {
      const state = await compute.status(name);
      await db.query(
        "UPDATE worker_hosts SET observed=$2,observed_at=now(),action=CASE WHEN (action='START' AND $2='RUNNING') OR (action='STOP' AND $2='TERMINATED') THEN NULL ELSE action END WHERE name=$1",
        [name, state],
      );
    }
    const actions = await db.tx(async (tx) => {
      // Claims use this same lock, so a host is fenced before a stop can be sent.
      await tx.query("SELECT id FROM execution_control WHERE id=1 FOR UPDATE");
      await tx.query(
        "UPDATE executions SET status='FAILED',result=$1,finished_at=now(),lease_token=NULL WHERE status='RUNNING' AND lease_expires_at<now()",
        [JSON.stringify({ systemError: "RUNNER_INTERRUPTED" })],
      );
      const queued = Number(
        (
          await tx.query(
            "SELECT count(*) AS n FROM executions e JOIN records r ON r.id=e.record_id WHERE e.status='QUEUED' AND r.expires_at>now()",
          )
        ).rows[0].n,
      );
      const hosts = (
        await tx.query(
          "SELECT * FROM worker_hosts WHERE name=ANY($1) ORDER BY name FOR UPDATE",
          [config.names],
        )
      ).rows;
      const running = (
        await tx.query(
          "SELECT worker_name,count(*) AS n FROM executions WHERE status='RUNNING' GROUP BY worker_name",
        )
      ).rows;
      const total = running.reduce((n, r) => n + Number(r.n), 0);
      const desired = Math.min(2, Math.ceil((queued + total) / config.slots));
      const active = hosts.filter(
        (h) => h.desired === "RUNNING" && h.action !== "STOP",
      );
      let needed = desired - active.length;
      // Cold hosts must not count as available unless already starting.
      needed += active.filter(
        (h) => h.observed === "TERMINATED" && !h.action,
      ).length;
      const commands: { name: string; action: "START" | "STOP"; id: string }[] =
        [];
      for (const h of hosts) {
        const busy = Number(
          running.find((r) => r.worker_name === h.name)?.n ?? 0,
        );
        if (busy || queued)
          await tx.query(
            "UPDATE worker_hosts SET idle_since=now() WHERE name=$1",
            [h.name],
          );
        if (h.action) {
          commands.push({ name: h.name, action: h.action, id: h.action_id });
          continue;
        }
        let action: "START" | "STOP" | undefined;
        if (needed > 0 && h.observed === "TERMINATED") {
          action = "START";
          needed--;
        } else if (
          !queued &&
          !busy &&
          h.observed === "RUNNING" &&
          Date.now() - new Date(h.idle_since).getTime() >=
            config.idleSeconds * 1000
        )
          action = "STOP";
        if (action) {
          const actionId = randomUUID();
          await tx.query(
            "UPDATE worker_hosts SET desired=$2,action=$3,action_id=$4,idle_since=now() WHERE name=$1",
            [
              h.name,
              action === "START" ? "RUNNING" : "STOPPED",
              action,
              actionId,
            ],
          );
          commands.push({ name: h.name, action, id: actionId });
        }
      }
      return commands;
    });
    for (const command of actions) {
      // Do not use a stale controller lease after a long process suspension.
      const valid = (
        await db.query(
          "SELECT id FROM fleet_controller WHERE id=1 AND token=$1 AND expires_at>now()",
          [leader],
        )
      ).rows.length;
      if (!valid) break;
      await compute.action(command.name, command.action, command.id);
    }
    return {
      actions: actions.map((a) => ({ name: a.name, action: a.action })),
    };
  } finally {
    await db.query(
      "UPDATE fleet_controller SET expires_at=NULL WHERE id=1 AND token=$1",
      [leader],
    );
  }
}
