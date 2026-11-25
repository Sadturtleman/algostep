import { track } from "./analytics.js";
import { ChevronDown } from "lucide-react";
import React, {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
export type DiagramNode = {
  id: string;
  motionKey?: string;
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
type Position = { x: number; y: number };
type Slots = (string | null)[];
type DragPreview = {
  id: string;
  key: string;
  index: number;
  position: Position;
};
type Drag = {
  pointerId: number;
  id: string;
  key: string;
  start: Position;
  offset: Position;
  target: number | null;
};
const directions: Record<string, Position> = {
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
};
function placeInSlot(slots: Slots, id: string, target: number) {
  const source = slots.indexOf(id);
  if (source === target) return slots;
  const next = Array.from(
    { length: Math.max(slots.length, target + 1) },
    (_, index) => slots[index] ?? null,
  );
  next[source] = null;
  // Push the occupied run toward the nearest gap on the dragged card's side.
  const step = Math.sign(source - target);
  let gap = target;
  while (next[gap] !== null) gap += step;
  for (; gap !== target; gap -= step) next[gap] = next[gap - step];
  next[target] = id;
  while (next.at(-1) === null) next.pop();
  return next;
}

function useDiagramMotion(
  targets: DiagramNode[],
  floating: DragPreview | null,
  animate: boolean,
) {
  const [frame, setFrame] = useState<Map<string, Position> | null>(null);
  const lastTargets = useRef(new Map<string, Position>());
  const lastDrawn = useRef(new Map<string, Position>());
  const lastFloating = useRef<string | null>(null);
  const animation = useRef(0);
  const visible = targets.map((node) => {
    const position =
      floating?.id === node.id ? floating.position : frame?.get(node.id);
    return position ? { ...node, x: position.x, y: position.y } : node;
  });

  useLayoutEffect(() => {
    const previous = lastDrawn.current;
    lastDrawn.current = new Map(visible.map((node) => [node.id, node]));
    const released =
      lastFloating.current !== null && lastFloating.current !== floating?.id;
    lastFloating.current = floating?.id ?? null;
    const changed =
      targets.length !== lastTargets.current.size ||
      targets.some((node) => {
        const prior = lastTargets.current.get(node.id);
        return prior?.x !== node.x || prior?.y !== node.y;
      });
    if (!changed && !released) return;
    lastTargets.current = new Map(targets.map((node) => [node.id, node]));
    cancelAnimationFrame(animation.current);
    const moving =
      (animate || released) &&
      !matchMedia("(prefers-reduced-motion: reduce)").matches
        ? targets.flatMap((to) => {
            const from = previous.get(to.id);
            return from &&
              to.id !== floating?.id &&
              (from.x !== to.x || from.y !== to.y)
              ? [{ from, to }]
              : [];
          })
        : [];
    if (!moving.length) {
      setFrame(null);
      return;
    }
    const start = performance.now();
    setFrame(new Map(moving.map(({ from, to }) => [to.id, from])));
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / 230);
      if (progress >= 1) {
        setFrame(null);
        return;
      }
      const eased = 1 - (1 - progress) ** 3;
      setFrame(
        new Map(
          moving.map(({ from, to }) => [
            to.id,
            {
              x: from.x + (to.x - from.x) * eased,
              y: from.y + (to.y - from.y) * eased,
            },
          ]),
        ),
      );
      animation.current = requestAnimationFrame(tick);
    };
    animation.current = requestAnimationFrame(tick);
  });
  useLayoutEffect(() => () => cancelAnimationFrame(animation.current), []);
  return visible;
}

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
// Slot coordinates include the user's layout and drag adjustments. A moving
// card keeps its React key when its value moves to another slot.
function NodeGroup({
  node,
  ...props
}: React.SVGProps<SVGGElement> & { node: DiagramNode }) {
  const ref = useRef<SVGGElement>(null);
  const last = useRef(node);
  const motion = useRef<Animation | null>(null);
  useLayoutEffect(() => {
    const from = last.current;
    last.current = node;
    if (!node.motionKey || !ref.current) return;
    if (from.id === node.id && from.x === node.x && from.y === node.y) return;
    let { x, y } = from;
    if (motion.current?.playState === "running") {
      const matrix = new DOMMatrixReadOnly(
        getComputedStyle(ref.current).transform,
      );
      x = matrix.e;
      y = matrix.f;
    }
    motion.current?.cancel();
    if (
      from.id === node.id ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const dx = node.x - x,
      dy = node.y - y;
    const bend = Math.min(0.35, 42 / (Math.hypot(dx, dy) || 1));
    const translate = (x: number, y: number) => ({
      transform: `translate(${x}px, ${y}px)`,
    });
    motion.current = ref.current.animate(
      [
        translate(x, y),
        translate(x + dx / 2 - dy * bend, y + dy / 2 + dx * bend),
        translate(node.x, node.y),
      ],
      { duration: 480, easing: "ease-in-out" },
    );
  }, [node]);
  return (
    <g {...props} ref={ref} transform={`translate(${node.x} ${node.y})`} />
  );
}

export function DiagramCanvas({
  nodes,
  edges = [],
  label,
  legend,
  arrayLayout = false,
  responsiveFit = true,
  onSelect,
}: {
  nodes: DiagramNode[];
  edges?: DiagramEdge[];
  label: string;
  legend?: React.ReactNode;
  arrayLayout?: boolean;
  responsiveFit?: boolean;
  onSelect?: (id: string) => void;
}) {
  const [order, setOrder] = useState<Slots>([]),
    [zoom, setZoom] = useState(1),
    [layout, setLayout] = useState("auto");
  const [preview, setPreview] = useState<DragPreview | null>(null);
  const drag = useRef<Drag | null>(null),
    svg = useRef<SVGSVGElement>(null),
    viewport = useRef<HTMLDivElement>(null);
  const marker = useId().replace(/:/g, "");
  const sourceNodes = new Map(nodes.map((n) => [n.id, n]));
  const savedIds = new Set(order);
  const currentOrder = order.map((id) =>
    id !== null && sourceNodes.has(id) ? id : null,
  );
  for (const { id } of nodes) {
    if (savedIds.has(id)) continue;
    const gap = currentOrder.indexOf(null);
    currentOrder[gap < 0 ? currentOrder.length : gap] = id;
  }
  while (currentOrder.at(-1) === null) currentOrder.pop();
  const isCurrent = ({ id, key }: { id: string; key: string }) => {
    const node = sourceNodes.get(id);
    return node && (node.motionKey ?? id) === key;
  };
  const activePreview = preview && isCurrent(preview) ? preview : null;
  const shownOrder = activePreview
    ? placeInSlot(currentOrder, activePreview.id, activePreview.index)
    : currentOrder;
  const slotById = new Map(shownOrder.map((id, index) => [id, index]));
  const columns = arrayLayout ? 6 : 3;
  const radius = onSelect ? Math.max(26, 24 / zoom) : 26;
  const stepX = arrayLayout
    ? 120
    : Math.max(
        110,
        ...nodes.map(
          (n) => (n.shape === "card" ? (n.width ?? 100) : 2 * radius) + 24,
        ),
      );
  const stepY = arrayLayout
    ? 110
    : Math.max(
        110,
        ...nodes.map(
          (n) =>
            (n.shape === "card"
              ? (n.height ?? 64)
              : radius + Math.max(radius, n.detail ? 54 : 0)) + 28,
        ),
      );
  const firstX = arrayLayout ? 75 : stepX / 2 + 12;
  const firstY = arrayLayout ? (nodes[0]?.y ?? 65) : stepY / 2 + 12;
  const gridPosition = (index: number) => ({
    x: firstX + (index % columns) * stepX,
    y: firstY + Math.floor(index / columns) * stepY,
  });
  const rows = Math.max(
    2,
    Math.ceil(nodes.length / columns) + 1,
    Math.ceil(currentOrder.length / columns),
  );
  const usingGrid = layout === "grid" || activePreview !== null;
  const targets = nodes.map((n, i) => {
    const defaultPos = usingGrid
      ? gridPosition(slotById.get(n.id) ?? i)
      : layout === "circle"
        ? {
            x:
              330 +
              240 * Math.cos((i * 2 * Math.PI) / nodes.length - Math.PI / 2),
            y:
              300 +
              220 * Math.sin((i * 2 * Math.PI) / nodes.length - Math.PI / 2),
          }
        : n;
    return { ...n, ...defaultPos };
  });
  const positioned = useDiagramMotion(
    targets,
    activePreview,
    usingGrid && (activePreview !== null || order.length > 0),
  );
  const dropPosition = activePreview ? gridPosition(activePreview.index) : null;
  const width = Math.max(
      560,
      usingGrid || arrayLayout ? firstX + (columns - 0.5) * stepX + 12 : 0,
      ...targets.map((n) => n.x + (n.width ?? 60) / 2 + 60),
    ),
    height = Math.max(
      240,
      usingGrid || arrayLayout ? firstY + (rows - 0.5) * stepY + 12 : 0,
      ...targets.map((n) => n.y + (n.height ?? 60) / 2 + 65),
    );
  const byId = new Map(positioned.map((n) => [n.id, n]));
  const bounds = useRef({ width, height });
  bounds.current = { width, height };
  useEffect(() => {
    const surface = svg.current;
    if (!surface) return;
    // Leave panning available on the empty canvas. SVG shapes alone do not
    // reliably keep the browser from claiming a touch gesture for scrolling.
    const captureNodeTouch = (event: TouchEvent) => {
      if (
        event.target instanceof Element &&
        event.target.closest(".diagram-node")
      )
        event.preventDefault();
    };
    surface.addEventListener("touchstart", captureNodeTouch, {
      passive: false,
    });
    return () => surface.removeEventListener("touchstart", captureNodeTouch);
  }, []);
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
  const commit = (id: string, index: number) => {
    setOrder(placeInSlot(currentOrder, id, index));
    setLayout("grid");
    track("VISUALIZATION_CONTROL", { action: "move_node" });
  };
  const dragPosition = (e: React.PointerEvent, active: Drag) => {
    const p = point(e);
    return p && { x: p.x - active.offset.x, y: p.y - active.offset.y };
  };
  const targetSlot = (position: Position) => {
    const col = Math.max(
      0,
      Math.min(columns - 1, Math.round((position.x - firstX) / stepX)),
    );
    const row = Math.max(
      0,
      Math.min(rows - 1, Math.round((position.y - firstY) / stepY)),
    );
    return row * columns + col;
  };
  const clearDrag = () => {
    const pointerId = drag.current?.pointerId;
    drag.current = null;
    setPreview(null);
    if (pointerId !== undefined && svg.current?.hasPointerCapture(pointerId))
      svg.current.releasePointerCapture(pointerId);
  };
  const resetOrder = (nextLayout: string) => {
    clearDrag();
    setOrder([]);
    setLayout(nextLayout);
  };
  return (
    <div className="diagram-canvas">
      <div className="diagram-toolbar">
        <label>
          배치
          <span className="diagram-layout-select">
            <select
              aria-label={`${label} 배치`}
              value={layout}
              onChange={(e) => {
                track("VISUALIZATION_CONTROL", { action: "layout" });
                resetOrder(e.target.value);
              }}
            >
              <option value="auto">자동</option>
              <option value="circle">원형</option>
              <option value="grid">격자</option>
            </select>
            <ChevronDown size={16} aria-hidden="true" />
          </span>
        </label>
        <button
          className="secondary"
          onClick={() => {
            resetOrder("auto");
            track("VISUALIZATION_CONTROL", { action: "reset" });
            setZoom(1);
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
        요소를 빈 칸이나 다른 요소 사이로 끌어 놓으세요. 방향키로도 한 칸씩 옮길
        수 있어요.
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
          onPointerMove={(e) => {
            const active = drag.current;
            if (active?.pointerId !== e.pointerId || !isCurrent(active)) return;
            if (
              active.target === null &&
              Math.hypot(
                e.clientX - active.start.x,
                e.clientY - active.start.y,
              ) < 6
            )
              return;
            const position = dragPosition(e, active);
            if (!position) return;
            const index = targetSlot(position);
            active.target = index;
            setPreview({ id: active.id, key: active.key, index, position });
          }}
          onPointerUp={(e) => {
            const active = drag.current;
            if (active?.pointerId !== e.pointerId) return;
            clearDrag();
            if (!isCurrent(active)) return;
            if (active.target === null) {
              onSelect?.(active.id);
            } else {
              const position = dragPosition(e, active);
              commit(
                active.id,
                position ? targetSlot(position) : active.target,
              );
            }
          }}
          onPointerCancel={(e) => {
            if (drag.current?.pointerId === e.pointerId) clearDrag();
          }}
          onLostPointerCapture={(e) => {
            if (
              e.target === e.currentTarget &&
              drag.current?.pointerId === e.pointerId
            )
              clearDrag();
          }}
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
          {dropPosition && (
            <rect
              className="diagram-drop-slot"
              x={dropPosition.x - stepX / 2 + 6}
              y={dropPosition.y - stepY / 2 + 6}
              width={stepX - 12}
              height={stepY - 12}
              rx={12}
            />
          )}
          {(activePreview
            ? [
                ...positioned.filter((n) => n.id !== activePreview.id),
                byId.get(activePreview.id)!,
              ]
            : positioned
          ).map((n) => (
            <NodeGroup
              key={n.motionKey ?? n.id}
              node={n}
              className={
                activePreview?.id === n.id
                  ? "diagram-node dragging"
                  : "diagram-node"
              }
              role="button"
              tabIndex={0}
              aria-label={`${n.label}${n.detail ? " · " + n.detail : ""} ${onSelect ? "선택" : "이동"}`}
              aria-pressed={onSelect ? n.state === "active" : undefined}
              onClick={(e) => {
                if (e.detail === 0) onSelect?.(n.id);
              }}
              data-node-id={n.id}
              onPointerDown={(e) => {
                if (e.button !== 0 || drag.current || !svg.current) return;
                const p = point(e);
                if (!p) return;
                svg.current.setPointerCapture(e.pointerId);
                drag.current = {
                  pointerId: e.pointerId,
                  id: n.id,
                  key: n.motionKey ?? n.id,
                  start: { x: e.clientX, y: e.clientY },
                  offset: { x: p.x - n.x, y: p.y - n.y },
                  target: null,
                };
              }}
              onKeyDown={(e) => {
                if (onSelect && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  onSelect(n.id);
                  return;
                }
                const direction = directions[e.key];
                if (!direction) return;
                e.preventDefault();
                if (drag.current) return;
                const index = currentOrder.indexOf(n.id);
                const col = (index % columns) + direction.x;
                const row = Math.floor(index / columns) + direction.y;
                if (col < 0 || col >= columns || row < 0 || row >= rows) return;
                commit(n.id, row * columns + col);
              }}
            >
              <title>{n.detail ? `${n.label} · ${n.detail}` : n.label}</title>
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
                <circle r={radius} className={`node ${n.state ?? ""}`} />
              )}
              <text
                textAnchor="middle"
                y={n.detail ? -3 : 5}
                style={{
                  fontSize: Math.min(
                    onSelect ? 14 / zoom : 16,
                    ((n.shape === "card" ? (n.width ?? 100) : 48) - 12) /
                      Math.max(
                        1,
                        Array.from(n.label).reduce(
                          (sum, c) => sum + (c.charCodeAt(0) > 255 ? 1 : 0.62),
                          0,
                        ),
                      ),
                  ),
                }}
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
            </NodeGroup>
          ))}
        </svg>
      </div>
      <div className="diagram-legend">
        {legend ?? (
          <>
            <span>● 현재/비교 중</span>
            <span>● 방문/결과</span>
          </>
        )}
        <span>드래그는 그림 배치만 바꾸며 알고리즘 데이터는 유지돼요.</span>
      </div>
    </div>
  );
}
