const escape = (v: unknown) =>
  String(v ?? "")
    .slice(0, 120)
    .replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c]!,
    );
export function snapshotSvg(frame: any, topic: string): string {
  const v = frame?.locals ?? {},
    positions: { x: number; y: number }[] = [];
  let nodes: unknown[] = [],
    edges: [number, number][] = [];
  if (
    topic === "bfs" &&
    Array.isArray(v.graph) &&
    v.graph.length <= 20 &&
    v.graph.every(Array.isArray)
  ) {
    nodes = v.graph.map((_: unknown, i: number) => i);
    nodes.forEach((_, i) =>
      positions.push({
        x: 250 + 175 * Math.cos((2 * Math.PI * i) / nodes.length - Math.PI / 2),
        y: 140 + 105 * Math.sin((2 * Math.PI * i) / nodes.length - Math.PI / 2),
      }),
    );
    v.graph.forEach((a: unknown[], i: number) =>
      a.forEach((j) => {
        if (
          typeof j === "number" &&
          Number.isInteger(j) &&
          j > i &&
          j < nodes.length
        )
          edges.push([i, j]);
      }),
    );
  } else if (topic === "tree" && Array.isArray(v.values)) {
    nodes = v.values.slice(0, 15);
    nodes.forEach((_, i) => {
      const level = Math.floor(Math.log2(i + 1));
      positions.push({
        x: (500 * (i - (2 ** level - 1) + 0.5)) / 2 ** level,
        y: 30 + level * 65,
      });
      if (i) edges.push([Math.floor((i - 1) / 2), i]);
    });
  } else if (Array.isArray(v.a)) {
    const values = v.a.slice(0, 10);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 90" width="500" height="90">${values.map((x: unknown, i: number) => `<rect x="${i * 49 + 2}" y="20" width="43" height="45" rx="7" fill="${i === v.mid ? "#eaf0ff" : "#f6f7fb"}" stroke="#3159dd"/><text x="${i * 49 + 23}" y="49" text-anchor="middle" font-size="13">${escape(x)}</text>`).join("")}</svg>`;
  } else return "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 280" width="500" height="280">${edges.map(([a, b]) => `<line x1="${positions[a].x}" y1="${positions[a].y}" x2="${positions[b].x}" y2="${positions[b].y}" stroke="#a8b5cf" stroke-width="2"/>`).join("")}${nodes.map((label, i) => `<circle cx="${positions[i].x}" cy="${positions[i].y}" r="20" fill="${i === v.current || i === v.index ? "#eaf0ff" : "#f6f7fb"}" stroke="#3159dd"/><text x="${positions[i].x}" y="${positions[i].y + 5}" text-anchor="middle" font-size="13">${escape(label)}</text>`).join("")}</svg>`;
}
