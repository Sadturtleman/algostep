import React from "react";
// Reference edges come from debugger identity, never inferred from equal values.
export function ObjectGraph({ vars }: { vars: Record<string, unknown> }) {
  const nodes = new Map<string, any>(),
    edges: { from: string; to: string; label: string }[] = [],
    roots: { name: string; to: string }[] = [];
  let visited=0;
  function visit(v: any, parent?: string, label = "", depth=0) {
    if (!v || typeof v !== "object" || depth>7 || ++visited>1000) return;
    const ref =
      typeof v.$ref === "string"
        ? v.$ref
        : typeof v.$id === "string"
          ? v.$id
          : undefined;
    if (ref && parent) edges.push({ from: parent, to: ref, label });
    if (typeof v.$id==='string' && !nodes.has(v.$id) && nodes.size < 30) {
      nodes.set(v.$id, v);
      for (const [k, x] of Object.entries(v.fields ?? {}).slice(0,30)) visit(x, v.$id, k,depth+1);
    } else if (!ref)
      for (const [k, x] of Object.entries(v).slice(0, 30))
        visit(x, parent, label ? `${label}.${k}` : k,depth+1);
    if (ref && !parent) roots.push({ name: label, to: ref });
  }
  for (const [k, v] of Object.entries(vars)) visit(v, undefined, k);
  if (!nodes.size) return null;
  const all = [...nodes.keys()];
  const pos = (id: string) => ({
    x: 30 + (all.indexOf(id) % 3) * 230,
    y: 45 + Math.floor(all.indexOf(id) / 3) * 150,
  });
  return (
    <div className="object-graph">
      <h4>객체 참조</h4>
      <p className="caption">
        {roots.map((r) => `${r.name} → ${r.to}`).join(" · ")} · 객체 ID는 이
        추적 실행 안에서만 유효해요.
      </p>
      <svg
        viewBox={`0 0 730 ${Math.ceil(nodes.size / 3) * 150 + 50}`}
        role="img"
        aria-label="객체 필드와 참조 관계"
      >
        <defs>
          <marker
            id="object-arrow"
            markerWidth="8"
            markerHeight="8"
            refX="7"
            refY="3"
            orient="auto"
          >
            <path d="M0,0 L0,6 L8,3 z" fill="currentColor" />
          </marker>
        </defs>
        {edges
          .filter((e) => nodes.has(e.to))
          .map((e, i) => {
            const a = pos(e.from),
              b = pos(e.to);
            return (
              <g key={i}>
                <path
                  d={`M${a.x + 190},${a.y + 45} C${a.x + 220},${a.y - 30} ${b.x - 30},${b.y - 30} ${b.x},${b.y + 45}`}
                  fill="none"
                  stroke="currentColor"
                  markerEnd="url(#object-arrow)"
                />
                <text
                  x={(a.x + b.x) / 2 + 90}
                  y={(a.y + b.y) / 2 + 20}
                  fontSize="10"
                  fill="currentColor"
                >
                  {e.label}
                </text>
              </g>
            );
          })}
        {all.map((id) => {
          const n = nodes.get(id),
            p = pos(id);
          return (
            <g key={id}>
              <rect
                x={p.x}
                y={p.y}
                width="190"
                height="95"
                rx="10"
                fill="var(--surface)"
                stroke="currentColor"
              />
              <text x={p.x + 9} y={p.y + 20} fontSize="12" fill="currentColor">
                {String(n.$type).slice(0, 23)}
              </text>
              <text x={p.x + 9} y={p.y + 38} fontSize="9" fill="currentColor">
                {id}
              </text>
              {Object.entries(n.fields ?? {})
                .filter(([, v]) => !v || typeof v !== "object")
                .slice(0, 3)
                .map(([k, v], i) => (
                  <text
                    key={k}
                    x={p.x + 9}
                    y={p.y + 54 + i * 14}
                    fontSize="10"
                    fill="currentColor"
                  >
                    {`${k}: ${String(v)}`.slice(0, 30)}
                  </text>
                ))}
            </g>
          );
        })}
      </svg>
      <p className="caption">
        최대 30개 객체 · 깊이 또는 수집 한도 밖의 참조는 변수 보기에서 확인할 수
        있어요.
      </p>
    </div>
  );
}
