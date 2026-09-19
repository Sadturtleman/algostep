import { z } from "zod";
// A closed vocabulary: free text, code, URLs, search terms and identity details
// are never analytical properties, even if a client tries to submit them.
const code = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/);
const small = z.number().int().min(0).max(1000000);
const language = z.enum(["python", "cpp", "java"]);
const screen = z.enum([
  "home",
  "lesson",
  "practice",
  "challenges",
  "problems",
  "workspace",
  "history",
  "support",
  "admin",
]);
export const eventProperties = {
  USER_REGISTERED: z.object({ client: z.enum(["web", "android"]) }),
  LOGIN: z.object({ client: z.enum(["web", "android"]) }),
  LOGOUT: z.object({}),
  DAILY_VISIT: z.object({}),
  QUIZ_ANSWERED: z.object({ correct: z.boolean(), topic: code }),
  PRACTICE_STARTED: z.object({ problem: code, language }),
  CODE_SAVED: z.object({ language, revision: small }),
  EXECUTION_REQUESTED: z.object({
    mode: z.enum(["judge", "custom"]),
    language,
    problem: code,
  }),
  EXECUTION_STARTED: z.object({ attempt: small }),
  EXECUTION_FINISHED: z.object({
    status: z.enum(["FAILED", "SUCCEEDED"]),
    verdict: code,
  }),
  REVIEW_REQUESTED: z.object({ language }),
  REVIEW_STARTED: z.object({}),
  REVIEW_SUCCEEDED: z.object({
    model: z.string().regex(/^[a-zA-Z0-9._/-]{1,80}$/),
  }),
  REVIEW_FAILED: z.object({ reason: code }),
  RECORD_DELETED: z.object({}),
  PDF_GENERATED: z.object({}),
  INQUIRY_CREATED: z.object({
    category: z.enum(["question", "bug", "billing", "other"]),
  }),
  INQUIRY_UPDATED: z.object({
    status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED"]),
  }),
  COSTS_IMPORTED: z.object({ entries: small }),
  CONTENT_PUBLISHED: z.object({ topics: small, problems: small }),
  SCREEN_VIEWED: z.object({ screen, topic: code.optional() }),
  EXAMPLE_SELECTED: z.object({ topic: code, index: small }),
  EXAMPLE_APPLIED: z.object({
    topic: code,
    count: small,
    success: z.boolean(),
  }),
  VISUALIZATION_CONTROL: z.object({
    action: z.enum([
      "previous",
      "next",
      "first",
      "last",
      "play",
      "pause",
      "seek",
      "layout",
      "zoom_in",
      "zoom_out",
      "fit",
      "reset",
      "move_node",
    ]),
    step: small.optional(),
  }),
  QUIZ_VIEWED: z.object({ topic: code, index: small }),
  QUIZ_RETRIED: z.object({ topic: code }),
  LANGUAGE_SELECTED: z.object({ language }),
  RESULT_TAB_VIEWED: z.object({
    tab: z.enum(["visual", "tests", "analysis", "review"]),
  }),
  TEST_SELECTED: z.object({ index: small }),
  PDF_EXPORTED: z.object({
    destination: z.enum(["download", "drive"]),
    success: z.boolean(),
  }),
  SEARCH_USED: z.object({ result_count: small }),
  CATEGORY_SELECTED: z.object({ index: small }),
  THEME_CHANGED: z.object({ theme: z.enum(["light", "dark"]) }),
  CLIENT_ERROR: z.object({ code: code }),
  ERROR_RECOVERY: z.object({ action: z.enum(["retry", "home", "reload"]) }),
  ADMIN_SECTION_VIEWED: z.object({
    section: z.enum(["overview", "finance", "users", "support", "events"]),
  }),
} as const;
export type BusinessEventType = keyof typeof eventProperties;
export const clientEventTypes = [
  "SCREEN_VIEWED",
  "EXAMPLE_SELECTED",
  "EXAMPLE_APPLIED",
  "VISUALIZATION_CONTROL",
  "QUIZ_VIEWED",
  "QUIZ_RETRIED",
  "LANGUAGE_SELECTED",
  "RESULT_TAB_VIEWED",
  "TEST_SELECTED",
  "PDF_EXPORTED",
  "SEARCH_USED",
  "CATEGORY_SELECTED",
  "THEME_CHANGED",
  "CLIENT_ERROR",
  "ERROR_RECOVERY",
  "ADMIN_SECTION_VIEWED",
] as const;
export function safeEventProperties(
  type: BusinessEventType,
  properties: unknown,
) {
  return eventProperties[type].parse(properties) as Record<
    string,
    string | number | boolean
  >;
}
export const ga4EventName = (type: string) => "as_" + type.toLowerCase();
