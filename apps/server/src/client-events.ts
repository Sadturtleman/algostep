import type { FastifyInstance } from "fastify";
import type { DB } from "./db.js";
import { z } from "zod";
import { businessEvent } from "./business.js";
import {
  clientEventTypes,
  eventProperties,
  safeEventProperties,
} from "./event-catalog.js";
import { analyticsStatus } from "./ga4.js";
import { DomainError } from "./domain.js";
export async function registerClientEvents(app: FastifyInstance, db: DB) {
  app.get("/api/admin/analytics", () => analyticsStatus(db));
  app.post(
    "/api/analytics/events",
    { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    async (req: any) => {
      const { events } = z
        .object({
          events: z
            .array(
              z
                .object({
                  requestKey: z.string().uuid(),
                  type: z.enum(clientEventTypes),
                  properties: z.record(z.string(), z.unknown()),
                })
                .strict(),
            )
            .min(1)
            .max(25),
        })
        .strict()
        .parse(req.body);
      // Validate the whole batch before writing anything and disallow spoofed
      // server actions (revenue, execution result, signup, review consumption).
      const parsed = events.map((e) => ({
        ...e,
        properties: eventProperties[e.type].strict().parse(e.properties),
      }));
      await db.tx(async (tx) => {
        for (const e of parsed) {
          const properties = safeEventProperties(e.type, e.properties);
          if (
            properties.topic &&
            !(
              await tx.query("SELECT id FROM topics WHERE id=$1", [
                properties.topic,
              ])
            ).rows.length
          )
            throw new DomainError(
              400,
              "UNKNOWN_ANALYTICS_TOPIC",
              "학습 주제를 확인해 주세요.",
            );
          await businessEvent(
            tx,
            e.type,
            req.user.id,
            null,
            "client:" + req.user.id + ":" + e.requestKey,
            properties,
          );
        }
      });
      return { accepted: events.length };
    },
  );
}
