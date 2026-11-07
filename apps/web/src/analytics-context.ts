let context: Record<string, string> = {};
export const analyticsHeaders = () => context;
export const setAnalyticsContext = (clientId?: string, sessionId?: number) => {
  context = {};
  if (clientId && /^\d{1,20}\.\d{1,20}$/.test(clientId))
    context["X-Analytics-Client-Id"] = clientId;
  if (sessionId && Number.isSafeInteger(sessionId) && sessionId > 0)
    context["X-Analytics-Session-Id"] = String(sessionId);
};
