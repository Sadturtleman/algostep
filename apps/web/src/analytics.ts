import { api } from "./api.js";
import { setAnalyticsContext } from "./analytics-context.js";
import type { clientEventTypes } from "../../server/src/event-catalog.js";
type Event = {
  requestKey: string;
  type: (typeof clientEventTypes)[number];
  properties: Record<string, string | number | boolean>;
};
let owner: string | null = null;
let queue: Event[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;
let sending = false;
let failures = 0;
let generation = 0;
let initializedTag: string | null = null;
let contextUpdated = 0;
export function setAnalyticsUser(userId: string | null) {
  if (owner === userId) return;
  owner = userId;
  queue = [];
  generation++;
  failures = 0;
  contextUpdated = 0;
  setAnalyticsContext();
  const w = window as any;
  if (initializedTag) {
    w["ga-disable-" + initializedTag] = !userId;
    if (!userId) w.gtag?.("set", { user_id: null });
  }
}
export function track(
  type: Event["type"],
  properties: Event["properties"] = {},
) {
  if (!owner) return;
  // Bounded memory only. No code or identity details are persisted in storage.
  if (queue.length >= 200) queue.shift();
  queue.push({ requestKey: crypto.randomUUID(), type, properties });
  schedule();
}
function schedule() {
  if (timer || !queue.length) return;
  timer = setTimeout(
    () => {
      timer = undefined;
      void flushAnalytics();
    },
    Math.min(30000, 1000 * 2 ** failures),
  );
}
export async function flushAnalytics() {
  if (sending || !owner || !queue.length) return;
  sending = true;
  const current = generation,
    batch = queue.slice(0, 25);
  try {
    if (initializedTag && Date.now() - contextUpdated > 60000)
      await refreshTagContext(initializedTag);
    if (current !== generation) return;
    await api("/analytics/events", {
      method: "POST",
      body: JSON.stringify({ events: batch }),
      keepalive: true,
    });
    if (current === generation) {
      queue.splice(0, batch.length);
      failures = 0;
    }
  } catch (e: any) {
    if (current === generation) {
      if (e.status === 400 || e.status === 403) {
        queue.splice(0, batch.length);
      } else if (e.status === 401) {
        queue = [];
      } else failures = Math.min(5, failures + 1);
    }
  } finally {
    sending = false;
    schedule();
  }
}
if (typeof window !== "undefined") {
  addEventListener("pagehide", () => void flushAnalytics());
  addEventListener("online", () => void flushAnalytics());
}

export async function initializeGoogleTag(
  measurementId: string | null,
  userId: string,
) {
  if (!measurementId || !/^G-[A-Z0-9]{4,20}$/.test(measurementId)) return;
  const w = window as any;
  if (initializedTag && initializedTag !== measurementId) return;
  if (!initializedTag) {
    initializedTag = measurementId;
    w.dataLayer = w.dataLayer ?? [];
    w.gtag = function () {
      w.dataLayer.push(arguments);
    };
    w.gtag("consent", "default", {
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      analytics_storage: "granted",
    });
    w.gtag("js", new Date());
    // Only the stable application origin is exposed, never record URLs, queries,
    // referrers, typed inputs or user data. Domain events go through the server.
    w.gtag("config", measurementId, {
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      page_location: location.origin + "/",
      page_referrer: "",
      user_id: userId,
    });
    const script = document.createElement("script");
    script.async = true;
    script.referrerPolicy = "origin";
    script.src = "https://www.googletagmanager.com/gtag/js?id=" + measurementId;
    document.head.append(script);
    w.gtag("event", "page_view", {
      page_title: "Algostep",
      page_location: location.origin + "/",
      page_referrer: "",
    });
  } else {
    w.gtag("set", { user_id: userId });
  }
  await refreshTagContext(measurementId);
}
async function refreshTagContext(measurementId: string) {
  const w = window as any;
  const get = (field: string) =>
    new Promise<any>((resolve) => {
      const timeout = setTimeout(() => resolve(undefined), 3000);
      w.gtag("get", measurementId, field, (v: any) => {
        clearTimeout(timeout);
        resolve(v);
      });
    });
  const current = generation;
  const [client, session] = await Promise.all([
    get("client_id"),
    get("session_id"),
  ]);
  if (current === generation) {
    setAnalyticsContext(client, Number(session));
    contextUpdated = Date.now();
  }
}
