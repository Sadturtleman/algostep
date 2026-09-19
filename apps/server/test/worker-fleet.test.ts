import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID as id } from "node:crypto";
import { database } from "../src/db.js";
import { seed } from "../src/content.js";
import {
  reconcileFleet,
  type ComputeFleet,
  type FleetConfig,
} from "../src/worker-fleet.js";
const config: FleetConfig = {
  project: "algostep",
  zone: "us-central1-a",
  names: ["worker-1", "worker-2"],
  slots: 2,
  idleSeconds: 900,
};
test("fleet starts one host, expands for backlog, fences idle hosts and retries uncertain stop", async () => {
  const db = await database();
  const status: Record<string, string> = {
    "worker-1": "TERMINATED",
    "worker-2": "TERMINATED",
  };
  const calls: { name: string; action: string; id: string }[] = [];
  let fail = false;
  const cloud: ComputeFleet = {
    status: async (n) => status[n],
    action: async (name, action, requestId) => {
      calls.push({ name, action, id: requestId });
      if (fail) throw new Error("uncertain");
    },
  };
  try {
    await seed(db);
    const user = id(),
      record = id(),
      snapshot = id();
    await db.query(
      "INSERT INTO users(id,google_subject,email,display_name) VALUES($1::uuid,$1::text,$2,$2)",
      [user, "fleet-test"],
    );
    await db.query(
      "INSERT INTO records(id,user_id,problem_id,language,source) VALUES($1,$2,'binary-search-v1','python','print(1)')",
      [record, user],
    );
    await db.query(
      "INSERT INTO code_snapshots(id,record_id,language,source,source_hash) VALUES($1,$2,'python','print(1)','x')",
      [snapshot, record],
    );
    const queue = async () =>
      db.query(
        "INSERT INTO executions(id,record_id,snapshot_id,request_key,mode) VALUES($1::uuid,$2,$3,$1::text,'judge')",
        [id(), record, snapshot],
      );
    await reconcileFleet(db, config, cloud);
    assert.equal(calls.length, 0);
    await queue();
    await reconcileFleet(db, config, cloud);
    assert.deepEqual(
      calls.map((c) => [c.name, c.action]),
      [["worker-1", "START"]],
    );
    status["worker-1"] = "RUNNING";
    await queue();
    await queue();
    await reconcileFleet(db, config, cloud);
    assert.equal(calls.at(-1)?.name, "worker-2");
    status["worker-2"] = "RUNNING";
    await db.query("UPDATE executions SET status='SUCCEEDED'");
    await reconcileFleet(db, config, cloud);
    await db.query(
      "UPDATE worker_hosts SET idle_since=now()-interval '16 minutes'",
    );
    fail = true;
    await assert.rejects(reconcileFleet(db, config, cloud));
    assert.ok(
      (await db.query("SELECT * FROM worker_hosts")).rows.every(
        (h) => h.desired === "STOPPED",
      ),
    );
    const stopId = calls.at(-1)!.id;
    fail = false;
    await reconcileFleet(db, config, cloud);
    assert.equal(calls.at(-2)!.id, stopId);
    // A queued request cannot cancel an in-flight stop; it starts only once stopped.
    await queue();
    await reconcileFleet(db, config, cloud);
    assert.equal(calls.at(-1)!.action, "STOP");
    status["worker-1"] = "TERMINATED";
    status["worker-2"] = "TERMINATED";
    await reconcileFleet(db, config, cloud);
    assert.equal(calls.at(-1)!.action, "START");
    await db.query(
      "UPDATE fleet_controller SET token=$1,expires_at=now()+interval '3 minutes'",
      [id()],
    );
    assert.deepEqual(await reconcileFleet(db, config, cloud), { busy: true });
  } finally {
    await db.close();
  }
});
