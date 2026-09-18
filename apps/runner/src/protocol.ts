export type Job = {
  id: string;
  token: string;
  language: "python" | "cpp" | "java";
  source: string;
  tests: { input: string; expected: string | null }[];
  limits: {
    testMs: number;
    memoryBytes: number;
    compileMs: number;
    outputBytes: number;
    traceSteps: number;
    submissionMs: number;
  };
};
export function validateJob(value: any): asserts value is Job {
  if (
    !value ||
    !/^[-a-f0-9]{36}$/.test(value.id) ||
    !["python", "cpp", "java"].includes(value.language) ||
    typeof value.source !== "string" ||
    value.source.length > 65536 ||
    !Array.isArray(value.tests) ||
    value.tests.length > 100 ||
    value.limits?.testMs !== 10000 ||
    value.limits?.memoryBytes !== 536870912 ||
    value.limits?.submissionMs !== 120000
  )
    throw new Error("Invalid job");
}
