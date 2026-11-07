import { AsyncLocalStorage } from "node:async_hooks";
export type AnalyticsContext = { clientId?: string; sessionId?: number };
export const analyticsContext = new AsyncLocalStorage<AnalyticsContext>();
export function readAnalyticsContext(
  headers: Record<string, unknown>,
): AnalyticsContext {
  const client = headers["x-analytics-client-id"],
    session = headers["x-analytics-session-id"];
  return {
    ...(typeof client === "string" && /^\d{1,20}\.\d{1,20}$/.test(client)
      ? { clientId: client }
      : {}),
    ...(typeof session === "string" &&
    /^\d{1,12}$/.test(session) &&
    Number(session) > 0
      ? { sessionId: Number(session) }
      : {}),
  };
}
