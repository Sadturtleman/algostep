import { runIsolated } from "./firecracker.js";
import { validateJob } from "./protocol.js";
const api = process.env.API_URL ?? "http://localhost:3001",
  token = process.env.RUNNER_TOKEN;
if (!token || token.length < 32 || token.startsWith("replace-"))
  throw new Error("Set a strong RUNNER_TOKEN.");
const slots = Number(process.env.RUNNER_SLOTS ?? 2);
if (!Number.isInteger(slots) || slots < 1 || slots > 10)
  throw new Error("RUNNER_SLOTS must be 1..10");
let stopping = false;
process.on("SIGTERM", () => {
  stopping = true;
});
process.on("SIGINT", () => {
  stopping = true;
});
async function post(path: string, body: any) {
  const r = await fetch(api + "/api/internal/" + path, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error(`API_${r.status}`);
  return r.json() as Promise<any>;
}
async function slot() {
  while (!stopping) {
    try {
      const { job } = await post("claim", {});
      if (!job) {
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      validateJob(job);
      const controller = new AbortController();
      let lastLease = Date.now();
      const watchdog = setInterval(() => {
        if (Date.now() - lastLease > 60000) controller.abort();
      }, 1000);
      const beat = setInterval(() => {
        void post(`executions/${job.id}/heartbeat`, { token: job.token })
          .then((result) => {
            if (result.active) lastLease = Date.now();
            else controller.abort();
          })
          .catch(() => {});
      }, 20000);
      try {
        const result = await runIsolated(job, controller.signal);
        await post(`executions/${job.id}/result`, { token: job.token, result });
      } catch (e) {
        console.error(
          "Runner failed",
          job.id,
          e instanceof Error ? e.message : "unknown",
        );
        await post(`executions/${job.id}/result`, {
          token: job.token,
          systemError: "RUNNER_INTERRUPTED",
        }).catch(() => {});
      } finally {
        clearInterval(beat);
        clearInterval(watchdog);
      }
    } catch (e) {
      console.error(
        "Worker connection failed",
        e instanceof Error ? e.message : "unknown",
      );
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}
await Promise.all(Array.from({ length: slots }, slot));
