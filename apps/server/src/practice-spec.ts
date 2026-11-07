import { formatReference } from "./reference-format.js";
export type PracticeSpec = {
  topic: string;
  title: string;
  statement: string;
  input: string;
  output: string;
  constraints: string;
  time: string;
  space: string;
  tests: { input: string; expected: string }[];
  refs: { python: string; cpp: string; java: string };
};
export function programs(
  py: string,
  cpp: string,
  java: string,
  cppHelpers = "",
  javaHelpers = "",
) {
  return {
    python: `import sys\nsys.setrecursionlimit(10000)\ntokens=iter(sys.stdin.read().split())\ndef ni(): return int(next(tokens))\ndef ns(): return next(tokens)\n${py}\n`,
    cpp: formatReference(
      `#include <iostream>\n#include <vector>\n#include <string>\n#include <algorithm>\n#include <functional>\n#include <queue>\n#include <set>\n#include <map>\n#include <numeric>\n#include <cmath>\n#include <complex>\n#include <limits>\nusing namespace std;\n${cppHelpers}\nint main(){ios::sync_with_stdio(false);cin.tie(nullptr);${cpp}\n}\n`,
    ),
    java: formatReference(
      `import java.util.*;\nimport java.io.*;\npublic class Main {\n${javaHelpers}\npublic static void main(String[] args) throws Exception {Scanner sc=new Scanner(System.in);${java}\n}\n}\n`,
    ),
  };
}
export const cases = (...pairs: [string, string][]) =>
  pairs.map(([input, expected]) => ({ input, expected }));
