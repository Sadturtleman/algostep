type Token = { value: string; line: number };
// A lexical proof only removes trivia. It never rewrites identifiers, operators,
// literal contents or Python indentation, so it cannot hide changed behavior.
export function lexicalTokens(
  source: string,
  language: string,
): Token[] | null {
  const result: Token[] = [];
  let i = 0,
    line = 1,
    lineStart = true;
  while (i < source.length) {
    if (language === "python" && lineStart) {
      let indent = "";
      while (source[i] === " " || source[i] === "\t") indent += source[i++];
      if (
        source[i] &&
        source[i] !== "\n" &&
        source[i] !== "\r" &&
        source[i] !== "#"
      )
        result.push({ value: "INDENT:" + indent, line });
      lineStart = false;
    }
    const c = source[i];
    if (!c) break;
    if (c === "\n") {
      if (language === "python") result.push({ value: "NEWLINE", line });
      line++;
      lineStart = true;
      i++;
      continue;
    }
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (
      (language === "python" && c === "#") ||
      (language !== "python" && source.slice(i, i + 2) === "//")
    ) {
      while (i < source.length && source[i] !== "\n") i++;
      continue;
    }
    if (language !== "python" && source.slice(i, i + 2) === "/*") {
      const end = source.indexOf("*/", i + 2);
      if (end < 0) return null;
      line += source.slice(i, end + 2).split("\n").length - 1;
      i = end + 2;
      continue;
    }
    if (c === '"' || c === "'") {
      const start = i,
        at = line,
        triple =
          language === "python" && source.slice(i, i + 3) === c.repeat(3),
        quote = triple ? c.repeat(3) : c;
      i += quote.length;
      let closed = false;
      while (i < source.length) {
        if (source[i] === "\\") {
          i += 2;
          continue;
        }
        if (source.slice(i, i + quote.length) === quote) {
          i += quote.length;
          closed = true;
          break;
        }
        if (source[i] === "\n") line++;
        i++;
      }
      if (!closed) return null;
      result.push({ value: source.slice(start, i), line: at });
      continue;
    }
    // Raw C++ strings / Java unicode escapes have preprocessing semantics; do not prove them.
    if (
      language !== "python" &&
      (source.slice(i, i + 2) === 'R"' || source.slice(i, i + 2) === "\\u")
    )
      return null;
    const match = source
      .slice(i)
      .match(
        /^(?:[A-Za-z_$][\w$]*|\d+(?:\.\d+)?|>>=|<<=|\*\*=|\/\/=|===|!==|==|!=|<=|>=|\+\+|--|&&|\|\||<<|>>|\*\*|\/\/|->|::|\+=|-=|\*=|\/=|.)/,
      );
    if (!match) return null;
    result.push({ value: match[0], line });
    i += match[0].length;
  }
  return result;
}
export function equivalent(
  source: string,
  reference: string,
  language: string,
) {
  if (
    source.includes("\\\n") ||
    reference.includes("\\\n") ||
    source.includes("\\\r\n") ||
    reference.includes("\\\r\n")
  )
    return false;
  if (language === "cpp") {
    const directives = (s: string) =>
      s
        .split(/\r?\n/)
        .filter((l) => /^\s*#/.test(l))
        .map((l) => l.trimEnd());
    if (
      JSON.stringify(directives(source)) !==
      JSON.stringify(directives(reference))
    )
      return false;
  }
  if (
    language === "python" &&
    [source, reference].some((s) =>
      s
        .split(/\r?\n/)
        .slice(0, 2)
        .some((l) => /coding\s*[:=]/.test(l)),
    )
  )
    return false;
  if (language === "python") {
    // Keep physical line structure: multiline strings and continuations matter.
    if (source.includes("\\\n") || reference.includes("\\\n")) return false;
  } else if (source.includes("\\") || reference.includes("\\")) {
    // Permit ordinary literals (e.g. '\n'), reject escapes outside literals below.
  }
  const a = lexicalTokens(source, language),
    b = lexicalTokens(reference, language);
  return (
    !!a &&
    !!b &&
    a.length === b.length &&
    a.every((t, i) => t.value === b[i].value && t.line === b[i].line)
  );
}
export function staticFindings(source: string, language: string) {
  const tokens = lexicalTokens(source, language);
  if (!tokens) return [];
  const findings: { line: number; kind: string; message: string }[] = [];
  for (let i = 0; i < tokens.length && findings.length < 20; i++) {
    const t = tokens[i],
      next = tokens[i + 1]?.value;
    if (["for", "while"].includes(t.value))
      findings.push({
        line: t.line,
        kind: "LOOP",
        message:
          "반복 횟수와 반복문 내부 비용을 함께 확인하세요. 반복문 개수만으로 Big-O를 결정할 수는 없어요.",
      });
    if (["sort", "sorted"].includes(t.value) && next === "(")
      findings.push({
        line: t.line,
        kind: "SORT",
        message:
          "정렬 호출을 발견했어요. 원소 수, 비교 함수 비용, 언어의 정렬 구현을 확인하세요.",
      });
    if (
      t.value === "pop" &&
      next === "(" &&
      tokens[i + 2]?.value === "0" &&
      language === "python"
    )
      findings.push({
        line: t.line,
        kind: "FRONT_REMOVAL",
        message:
          "list.pop(0)은 뒤 원소를 이동해 O(n)이에요. 실제 객체가 리스트인지 확인하고 큐라면 deque를 고려하세요.",
      });
  }
  return findings;
}
