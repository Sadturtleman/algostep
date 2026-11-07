import { track } from "./analytics.js";
import React, { useEffect, useId, useRef, useState } from "react";
export type DiagramNode = {
  id: string;
  x: number;
  y: number;
  label: string;
  detail?: string;
  state?: string;
  shape?: "circle" | "card";
  width?: number;
  height?: number;
};
export type DiagramEdge = {
  from: string;
  to: string;
  label?: string;
  directed?: boolean;
};
export function graphPositions(graph: number[][]) {
  const positions: { x: number; y: number }[] = [],
    seen = new Set<number>();
  let offset = 0;
  for (let root = 0; root < graph.length; root++) {
    if (seen.has(root)) continue;
    let level = [root];
    seen.add(root);
    const layers: number[][] = [];
    while (level.length) {
      layers.push(level);
      const next: number[] = [];
      for (const v of level)
        for (const w of graph[v])
          if (
            Number.isInteger(w) &&
            w >= 0 &&
            w < graph.length &&
            !seen.has(w)
          ) {
            seen.add(w);
            next.push(w);
          }
      level = next;
    }
    const columns = Math.max(...layers.map((row) => row.length));
    layers.forEach((row, depth) =>
      row.forEach((v, i) => {
        positions[v] = {
          x: 70 + offset + (i + (columns - row.length) / 2) * 125,
          y: 65 + depth * 110,
        };
      }),
    );
    offset += columns * 125 + 55;
  }
  return positions;
}
export function DiagramCanvas({
  nodes,
  edges = [],
  label,
  responsiveFit = true,
  onSelect,
}: {
  nodes: DiagramNode[];
  edges?: DiagramEdge[];
  label: string;
  responsiveFit?: boolean;
  onSelect?: (id: string) => void;
}) {
  const [moved, setMoved] = useState<Record<string, { x: number; y: number }>>(
      {},
    ),
    [zoom, setZoom] = useState(1),
    [layout, setLayout] = useState("auto");
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null),
    svg = useRef<SVGSVGElement>(null),
    viewport = useRef<HTMLDivElement>(null);
  const marker = useId().replace(/:/g, "");
  const pointerStart = useRef({ x: 0, y: 0 });
  const positioned = nodes.map((n, i) => {
    const defaultPos =
      layout === "circle"
        ? {
            x:
              330 +
              240 * Math.cos((i * 2 * Math.PI) / nodes.length - Math.PI / 2),
            y:
              300 +
              220 * Math.sin((i * 2 * Math.PI) / nodes.length - Math.PI / 2),
          }
        : layout === "grid"
          ? { x: 145 + (i % 3) * 270, y: 90 + Math.floor(i / 3) * 160 }
          : n;
    return { ...n, ...defaultPos, ...moved[n.id], id: n.id, label: n.label };
  });
  const width = Math.max(
      560,
      ...positioned.map((n) => n.x + (n.width ?? 60) / 2 + 60),
    ),
    height = Math.max(
      240,
      ...positioned.map((n) => n.y + (n.height ?? 60) / 2 + 65),
    );
  const byId = new Map(positioned.map((n) => [n.id, n]));
  const bounds = useRef({ width, height });
  bounds.current = { width, height };
  useEffect(() => {
    if (!responsiveFit || !viewport.current) return;
    let previousWidth = -1;
    const observer = new ResizeObserver(([entry]) => {
      const available = entry.contentRect.width;
      if (Math.abs(available - previousWidth) < 1) return;
      previousWidth = available;
      setZoom(
        Math.max(
          0.3,
          Math.min(
            1,
            (available - 16) / bounds.current.width,
            500 / bounds.current.height,
          ),
        ),
      );
    });
    observer.observe(viewport.current);
    return () => observer.disconnect();
  }, [responsiveFit]);
  const point = (e: React.PointerEvent) => {
    const matrix = svg.current?.getScreenCTM();
    if (!matrix) return null;
    return new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix.inverse());
  };
  return (
    <div className="diagram-canvas">
      <div className="diagram-toolbar">
        <span>배치</span>
        <select
          aria-label={`${label} 배치`}
          value={layout}
          onChange={(e) => {
            track("VISUALIZATION_CONTROL", { action: "layout" });
            setLayout(e.target.value);
            setMoved({});
          }}
        >
          <option value="auto">자동</option>
          <option value="circle">원형</option>
          <option value="grid">격자</option>
        </select>
        <button
          className="secondary"
          onClick={() => {
            setMoved({});
            track("VISUALIZATION_CONTROL", { action: "reset" });
            setZoom(1);
            setLayout("auto");
          }}
        >
          배치 초기화
        </button>
        <button
          className="secondary"
          onClick={() => {
            track("VISUALIZATION_CONTROL", { action: "fit" });
            setZoom(
              Math.max(
                0.3,
                Math.min(
                  1,
                  (viewport.current?.clientWidth ?? width) / width,
                  500 / height,
                ),
              ),
            );
          }}
        >
          화면에 맞춤
        </button>
        <label>
          확대{" "}
          <input
            aria-label={`${label} 확대`}
            onPointerUp={() =>
              track("VISUALIZATION_CONTROL", { action: "seek" })
            }
            onKeyUp={() => track("VISUALIZATION_CONTROL", { action: "seek" })}
            type="range"
            min="0.3"
            max="1.8"
            step="0.1"
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          />
        </label>
        <span>{Math.round(zoom * 100)}%</span>
      </div>
      <p className="caption">
        요소를 드래그해 위치를 조정하세요. 키보드는 요소 선택 후 방향키로 이동할
        수 있어요. 넓은 그림은 가로로 스크롤하세요.
      </p>
      <div
        ref={viewport}
        className="diagram-scroll"
        tabIndex={0}
        aria-label={`${label} 스크롤 영역`}
      >
        <svg
          ref={svg}
          className="interactive-diagram"
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: width * zoom, height: height * zoom }}
          role="img"
          aria-label={label}
        >
          <title>{label}</title>
          <defs>
            <marker
              id={marker}
              markerWidth="8"
              markerHeight="8"
              refX="7"
              refY="4"
              orient="auto"
            >
              <path d="M0,0 L8,4 L0,8Z" fill="var(--muted)" />
            </marker>
          </defs>
          {edges.map((e, i) => {
            const a = byId.get(e.from),
              b = byId.get(e.to);
            if (!a || !b) return null;
            const dx = b.x - a.x,
              dy = b.y - a.y,
              length = Math.hypot(dx, dy) || 1;
            const extent = (n: DiagramNode) =>
              n.shape === "card"
                ? Math.min(
                    (n.width ?? 100) / 2 / (Math.abs(dx) / length || 0.001),
                    (n.height ?? 64) / 2 / (Math.abs(dy) / length || 0.001),
                  )
                : 27;
            const ar = extent(a),
              br = extent(b) + 4,
              x1 = a.x + (dx / length) * ar,
              y1 = a.y + (dy / length) * ar,
              x2 = b.x - (dx / length) * br,
              y2 = b.y - (dy / length) * br;
            const bend = edges.some(
              (other) => other.from === e.to && other.to === e.from,
            )
              ? 42
              : 0;
            const cx = (x1 + x2) / 2 - (dy / length) * bend,
              cy = (y1 + y2) / 2 + (dx / length) * bend;
            return (
              <g key={`${e.from}-${e.to}-${i}`} className="diagram-edge">
                {a.id === b.id ? (
                  <path
                    d={`M${a.x - 18},${a.y - 20} C${a.x - 75},${a.y - 85} ${a.x + 75},${a.y - 85} ${a.x + 18},${a.y - 20}`}
                    fill="none"
                    className="edge"
                    markerEnd={e.directed ? `url(#${marker})` : undefined}
                  />
                ) : (
                  <path
                    d={`M${x1},${y1} Q${cx},${cy} ${x2},${y2}`}
                    fill="none"
                    className="edge"
                    markerEnd={e.directed ? `url(#${marker})` : undefined}
                  />
                )}
                {e.label && (
                  <text
                    className="edge-label"
                    x={(x1 + 2 * cx + x2) / 4}
                    y={(y1 + 2 * cy + y2) / 4 - 8}
                    textAnchor="middle"
                  >
                    {e.label}
                  </text>
                )}
              </g>
            );
          })}
          {positioned.map((n) => (
            <g
              key={n.id}
              className="diagram-node"
              role="button"
              tabIndex={0}
              aria-label={`${n.label}${n.detail ? " · " + n.detail : ""} ${onSelect ? "선택" : "이동"}`}
              aria-pressed={onSelect ? n.state === "active" : undefined}
              onClick={(e) => {
                if (
                  onSelect &&
                  Math.hypot(
                    e.clientX - pointerStart.current.x,
                    e.clientY - pointerStart.current.y,
                  ) < 6
                )
                  onSelect(n.id);
              }}
              transform={`translate(${n.x} ${n.y})`}
              data-node-id={n.id}
              onPointerDown={(e) => {
                pointerStart.current = { x: e.clientX, y: e.clientY };
                const p = point(e);
                if (!p) return;
                e.currentTarget.setPointerCapture(e.pointerId);
                drag.current = { id: n.id, dx: p.x - n.x, dy: p.y - n.y };
              }}
              onPointerMove={(e) => {
                const d = drag.current;
                if (d?.id !== n.id) return;
                const p = point(e);
                if (p)
                  setMoved((prev) => ({
                    ...prev,
                    [n.id]: {
                      x: Math.max(
                        (n.width ?? 60) / 2 + 12,
                        Math.min(2500, p.x - d.dx),
                      ),
                      y: Math.max(
                        (n.height ?? 60) / 2 + 12,
                        Math.min(3500, p.y - d.dy),
                      ),
                    },
                  }));
              }}
              onPointerUp={() => {
                if (drag.current)
                  track("VISUALIZATION_CONTROL", { action: "move_node" });
                drag.current = null;
              }}
              onPointerCancel={() => {
                drag.current = null;
              }}
              onKeyDown={(e) => {
                if (onSelect && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  onSelect(n.id);
                  return;
                }
                const delta: Record<string, number[]> = {
                  ArrowLeft: [-12, 0],
                  ArrowRight: [12, 0],
                  ArrowUp: [0, -12],
                  ArrowDown: [0, 12],
                };
                if (!delta[e.key]) return;
                track("VISUALIZATION_CONTROL", { action: "move_node" });
                e.preventDefault();
                setMoved((prev) => ({
                  ...prev,
                  [n.id]: {
                    x: Math.max(
                      (n.width ?? 60) / 2 + 12,
                      Math.min(2500, n.x + delta[e.key][0]),
                    ),
                    y: Math.max(
                      (n.height ?? 60) / 2 + 12,
                      Math.min(3500, n.y + delta[e.key][1]),
                    ),
                  },
                }));
              }}
            >
              <title>
                {n.label}
                {n.detail ? " · " + n.detail : ""}
              </title>
              {n.shape === "card" ? (
                <rect
                  x={-(n.width ?? 100) / 2}
                  y={-(n.height ?? 64) / 2}
                  width={n.width ?? 100}
                  height={n.height ?? 64}
                  rx="10"
                  className={`node ${n.state ?? ""}`}
                />
              ) : (
                <circle
                  r={onSelect ? Math.max(26, 24 / zoom) : 26}
                  className={`node ${n.state ?? ""}`}
                />
              )}
              <text
                textAnchor="middle"
                y={n.detail ? -3 : 5}
                style={onSelect ? { fontSize: 14 / zoom } : undefined}
              >
                {n.label.length > 22 ? n.label.slice(0, 21) + "…" : n.label}
              </text>
              {n.detail && (
                <text
                  className="node-detail"
                  textAnchor="middle"
                  y={n.shape === "card" ? 20 : 48}
                >
                  {n.detail.length > 32
                    ? n.detail.slice(0, 31) + "…"
                    : n.detail}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>
      <div className="diagram-legend">
        <span>● 현재/비교 중</span>
        <span>● 방문/결과</span>
        <span>드래그는 그림 배치만 바꾸며 알고리즘 데이터는 유지돼요.</span>
      </div>
    </div>
  );
}
