export const assumptions = {
  hours: 60, // Aggregate worker-hours/month, including cold start and idle grace.
  calendarHours: 720,
  vmHourly: 0.097118,
  diskGiB: 80,
  diskRate: 0.1,
  ipv4Hourly: 0.005,
  dbAllowance: 0, // Supabase Free within its quota.
  otherAllowance: 3,
  slots: 2,
  pollSeconds: 15,
  executionSeconds: 30,
  requestsPerExecution: 15,
  requestSeconds: 0.1,
  maintenanceSeconds: 2,
  reviewSeconds: 20,
  reviewRatio: 0.1,
  inputTokens: 4000,
  outputTokens: 1500,
  thinkingTokens: 500,
  inputRate: 0.75,
  outputRate: 3.75,
  traceMiB: 0.2,
  egressMiB: 2,
  storageRate: 0.02,
  egressRate: 0.12,
  usdKrw: 1400,
};
export function estimate(executions, a = assumptions) {
  const reviews = Math.round(executions * a.reviewRatio);
  // Keep larger scenarios physically possible; leave 30% for boot/idle/bursts.
  const workerHours = Math.max(
    a.hours,
    (executions * a.executionSeconds) / (a.slots * 3600 * 0.7),
  );
  const fixed =
    workerHours * (a.vmHourly + a.ipv4Hourly) +
    a.diskGiB * a.diskRate +
    a.dbAllowance +
    a.otherAllowance;
  const idleRequests =
    (workerHours * 3600 * a.slots) / a.pollSeconds + a.calendarHours * 60;
  const requests = idleRequests + executions * a.requestsPerExecution + reviews;
  const seconds =
    requests * a.requestSeconds +
    reviews * a.reviewSeconds +
    a.calendarHours * 60 * (a.maintenanceSeconds - a.requestSeconds);
  const cloudRun =
    seconds * (0.000024 + 2 * 0.0000025) + (requests * 0.4) / 1e6;
  const storage =
    ((executions * a.traceMiB) / 1024) * a.storageRate +
    executions * (0.005 / 1000 + (3 * 0.0004) / 1000);
  const network = ((executions * a.egressMiB) / 1024) * a.egressRate;
  const gemini =
    (reviews *
      (a.inputTokens * a.inputRate +
        (a.outputTokens + a.thinkingTokens) * a.outputRate)) /
    1e6;
  return {
    executions,
    workerHours,
    capacityExceeded: workerHours > 2 * a.calendarHours,
    reviews,
    fixed,
    cloudRun,
    storage,
    network,
    server: fixed + cloudRun + storage + network,
    gemini,
    total: fixed + cloudRun + storage + network + gemini,
    slotUtilization: workerHours
      ? (executions * a.executionSeconds) / (a.slots * workerHours * 3600)
      : 0,
  };
}
export const scenarios = [0, 1000, 10000, 50000, 100000].map((n) =>
  estimate(n),
);
if (process.argv.includes("--json"))
  console.log(JSON.stringify({ assumptions, scenarios }, null, 2));
