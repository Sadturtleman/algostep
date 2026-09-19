import { DiagramCanvas, graphPositions } from "./DiagramCanvas.js";
import React from "react";
// Reference edges come from debugger identity, never inferred from equal values.
export function ObjectGraph({
  vars,
  educational = false,
}: {
  vars: Record<string, unknown>;
  educational?: boolean;
}) {
  const nodes = new Map<string, any>(),
    edges: { from: string; to: string; label: string }[] = [],
    roots: { name: string; to: string }[] = [];
  let visited = 0;
  function visit(v: any, parent?: string, label = "", depth = 0) {
    if (!v || typeof v !== "object" || depth > 7 || ++visited > 1000) return;
    const ref =
      typeof v.$ref === "string"
        ? v.$ref
        : typeof v.$id === "string"
          ? v.$id
          : undefined;
    if (ref && parent) edges.push({ from: parent, to: ref, label });
    if (typeof v.$id === "string" && !nodes.has(v.$id) && nodes.size < 30) {
      nodes.set(v.$id, v);
      for (const [k, x] of Object.entries(v.fields ?? {}).slice(0, 30))
        visit(x, v.$id, k, depth + 1);
    } else if (!ref)
      for (const [k, x] of Object.entries(v).slice(0, 30))
        visit(x, parent, label ? `${label}.${k}` : k, depth + 1);
    if (ref && !parent) roots.push({ name: label, to: ref });
  }
  for (const [k, v] of Object.entries(vars)) visit(v, undefined, k);
  if (!nodes.size) return null;
  const all = [...nodes.keys()];
  const positions = graphPositions(
    all.map((id) =>
      edges
        .filter((e) => e.from === id && nodes.has(e.to))
        .map((e) => all.indexOf(e.to)),
    ),
  );
  return (
    <div className="object-graph">
      <h4>객체 참조</h4>
      <p className="caption">
        {roots.map((r) => `${r.name} → ${r.to}`).join(" · ")} ·{" "}
        {educational
          ? "설명용 객체 ID예요."
          : "객체 ID는 이 추적 실행 안에서만 유효해요."}
      </p>
      <DiagramCanvas
        label="객체 필드와 참조 관계"
        nodes={all.map((id, i) => {
          const n = nodes.get(id);
          return {
            id,
            x: positions[i].x * 2.1,
            y: positions[i].y * 1.5,
            label: String(n.$type ?? "Object"),
            detail:
              Object.entries(n.fields ?? {})
                .filter(([, v]) => !v || typeof v !== "object")
                .slice(0, 2)
                .map(([k, v]) => `${k}: ${v}`)
                .join(" · ") || id,
            shape: "card" as const,
            width: 220,
            height: 90,
          };
        })}
        edges={edges
          .filter((e) => nodes.has(e.to))
          .map((e) => ({ ...e, directed: true }))}
      />

      <p className="caption">
        최대 30개 객체 · 깊이 또는 수집 한도 밖의 참조는 변수 보기에서 확인할 수
        있어요.
      </p>
    </div>
  );
}
