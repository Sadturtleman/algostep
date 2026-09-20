import { useSyncExternalStore } from "react";
const event = "algostep:navigate";
const snapshot = () => location.pathname + location.search;
export function go(path: string, replace = false) {
  if (snapshot() === path) return;
  history[replace ? "replaceState" : "pushState"]({}, "", path);
  dispatchEvent(new Event(event));
  window.scrollTo(0, 0);
}
export function useLocation() {
  return useSyncExternalStore((notify) => {
    addEventListener("popstate", notify);
    addEventListener(event, notify);
    return () => {
      removeEventListener("popstate", notify);
      removeEventListener(event, notify);
    };
  }, snapshot);
}
export function readRoute(path: string) {
  const url = new URL(path, "https://algostep.invalid");
  const parts = url.pathname.split("/").filter(Boolean);
  const result = {
    page: "not-found",
    topicId: "",
    recordId: "",
    step: 1,
    problemId: url.searchParams.get("problem"),
    section: "overview",
    inquiryId: "",
    reviewId: "",
  };
  if (!parts.length || (parts.length === 1 && parts[0] === "learn"))
    result.page = "home";
  if (parts[0] === "login" && parts.length === 1) result.page = "home";
  if (parts[0] === "learn" && parts.length >= 3) {
    result.topicId = parts[1];
    if (parts[2] === "concept" && parts.length === 3) result.page = "lesson";
    if (
      parts[2] === "predict" &&
      parts.length === 4 &&
      /^[1-9]\d*$/.test(parts[3]) &&
      Number(parts[3]) <= 1000000
    ) {
      result.page = "practice";
      result.step = Number(parts[3]);
    }
    if (parts[2] === "code" && parts.length === 3) {
      result.page = "workspace";
      result.recordId = url.searchParams.get("record") ?? "";
    }
  }
  if (parts[0] === "records" && parts.length <= 2) {
    result.page = parts[1] ? "workspace" : "history";
    result.recordId = parts[1] ?? "";
  }
  if (parts[0] === "records" && parts.length === 4 && parts[2] === "reviews") {
    result.page = "workspace";
    result.recordId = parts[1];
    result.reviewId = parts[3];
  }
  if (parts[0] === "problems" && parts.length <= 2) {
    result.page = parts[1] ? "workspace" : "problems";
    result.problemId = parts[1] ?? null;
    result.recordId = url.searchParams.get("record") ?? "";
  }
  if (parts[0] === "support" && parts.length <= 2) {
    result.page = "support";
    result.inquiryId = parts[1] ?? "";
  }
  if (
    parts[0] === "admin" &&
    parts.length <= 2 &&
    (!parts[1] ||
      ["overview", "finance", "users", "support", "events"].includes(parts[1]))
  ) {
    result.page = "admin";
    result.section = parts[1] ?? "overview";
  }
  return result;
}
