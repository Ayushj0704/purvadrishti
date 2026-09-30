import { useEffect, useMemo } from "react";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
} from "@xyflow/react";
import type { Edge, Node, NodeProps } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { TrailEdge, TrailNode } from "../api/cases";

type InfoNodeData = {
  label: string;
  role: string;
  kind: string;
  extra?: string;
};
type InfoNodeType = Node<InfoNodeData, "info">;

const KIND_STYLE: Record<string, { border: string; background: string; color: string }> = {
  victim: { border: "rgba(255,76,65,0.55)", background: "rgba(255,76,65,0.10)", color: "#ff8a80" },
  mule: { border: "#3a3a46", background: "#1c1c24", color: "#f4f4f5" },
  atm: { border: "rgba(111,120,255,0.55)", background: "rgba(111,120,255,0.14)", color: "#b9beff" },
};

/** Custom node with inline styles — React Flow's own stylesheet paints default
 *  nodes white and beats layered utility classes, so colour lives here. */
function InfoNode({ data }: NodeProps<InfoNodeType>) {
  const s = KIND_STYLE[data.kind] ?? KIND_STYLE.mule;
  return (
    <div
      style={{
        minWidth: 152,
        maxWidth: 220,
        border: `1px solid ${s.border}`,
        background: s.background,
        color: s.color,
        borderRadius: 8,
        padding: "10px 14px",
        textAlign: "center",
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <div style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis" }}>
        {data.label}
      </div>
      <div style={{ fontSize: 10, opacity: 0.75, marginTop: 2 }}>{data.role}</div>
      {data.extra && <div style={{ fontSize: 10, marginTop: 2 }}>{data.extra}</div>}
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
}

const EDGE_STYLE: Record<string, { stroke: string; animated?: boolean }> = {
  victim: { stroke: "#ff4c41", animated: true },
  mule: { stroke: "#3a3a46" },
  atm: { stroke: "#f59e0b", animated: true },
};

function inr(n: unknown): string | undefined {
  return typeof n === "number" ? `₹${n.toLocaleString("en-IN")}` : undefined;
}

/**
 * Layered layout: BFS depth from the victim node becomes the row, sibling
 * index within a layer becomes the column. Pure function of trail data.
 */
function layoutTrail(
  nodes: TrailNode[],
  edges: TrailEdge[],
): { nodes: InfoNodeType[]; edges: Edge[] } {
  const children = new Map<string, string[]>();
  const indegree = new Map<string, number>();
  for (const n of nodes) indegree.set(n.id, 0);
  for (const e of edges) {
    if (!children.has(e.from)) children.set(e.from, []);
    children.get(e.from)!.push(e.to);
    indegree.set(e.to, (indegree.get(e.to) ?? 0) + 1);
  }
  const roots = nodes.filter((n) => (indegree.get(n.id) ?? 0) === 0);
  const start: TrailNode[] =
    roots.length > 0 ? roots : nodes.filter((n) => n.kind === "victim" || n.id === "victim");
  const depth = new Map<string, number>();
  const queue: Array<{ id: string; d: number }> = (start.length > 0 ? start : nodes.slice(0, 1)).map(
    (n) => ({ id: n.id, d: 0 }),
  );
  for (const { id } of queue) if (!depth.has(id)) depth.set(id, 0);
  while (queue.length > 0) {
    const { id, d } = queue.shift()!;
    for (const next of children.get(id) ?? []) {
      if (!depth.has(next)) {
        depth.set(next, d + 1);
        queue.push({ id: next, d: d + 1 });
      }
    }
  }
  const layers = new Map<number, TrailNode[]>();
  for (const n of nodes) {
    const d = depth.get(n.id) ?? 0;
    if (!layers.has(d)) layers.set(d, []);
    layers.get(d)!.push(n);
  }
  const X_GAP = 220;
  const Y_GAP = 130;
  const flowNodes: InfoNodeType[] = [];
  for (const [d, layer] of [...layers.entries()].sort((a, b) => a[0] - b[0])) {
    layer.forEach((n, i) => {
      const offset = ((layer.length - 1) / 2) * X_GAP;
      const kind = typeof n.kind === "string" ? n.kind : "mule";
      let extra: string | undefined;
      if (kind === "atm" && typeof n.score === "number") {
        extra = `${(n.score * 100).toFixed(1)}%${typeof n.risk === "string" ? ` · ${n.risk}` : ""}`;
      } else if (kind === "victim") {
        extra = inr(n.amount);
      }
      flowNodes.push({
        id: n.id,
        type: "info",
        position: { x: 260 + i * X_GAP - offset, y: d * Y_GAP },
        data: {
          label: typeof n.label === "string" && n.label ? n.label : n.id,
          role: kind === "mule" ? `Hop ${String(d).padStart(2, "0")}` : kind === "victim" ? "Origin" : "Cash-out",
          kind,
          extra,
        },
      });
    });
  }
  const nodeKind = new Map(nodes.map((n) => [n.id, n.kind]));
  const flowEdges: Edge[] = edges.map((e, i) => {
    const style = EDGE_STYLE[nodeKind.get(e.from) ?? "mule"] ?? EDGE_STYLE.mule;
    return {
      id: `e${i}`,
      source: e.from,
      target: e.to,
      label: e.amount != null ? `₹${Number(e.amount).toLocaleString("en-IN")}` : e.type,
      animated: style.animated,
      style: { stroke: style.stroke, strokeWidth: 1.5 },
    };
  });
  return { nodes: flowNodes, edges: flowEdges };
}

export function TransactionGraph({ trail }: { trail?: { nodes: TrailNode[]; edges: TrailEdge[] } }) {
  const nodeTypes = useMemo(() => ({ info: InfoNode }), []);
  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => (trail && trail.nodes.length > 0 ? layoutTrail(trail.nodes, trail.edges) : { nodes: [], edges: [] }),
    [trail],
  );
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // useNodesState/useEdgesState only seed on mount — push a fresh layout
  // whenever a new trail arrives.
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  return (
    <div className="overflow-hidden rounded-xl border border-hairline bg-abyss">
      <div className="flex items-center justify-between border-b border-hairline px-5 py-3.5">
        <span className="label-caps text-muted">Money flow topology</span>
        <span className="telemetry text-faint">
          {nodes.length} nodes · {edges.length} edges
        </span>
      </div>

      <div className="h-[30rem]">
        {nodes.length === 0 ? (
          <p className="flex h-full items-center justify-center px-5 text-center text-xs text-faint">
            No trail recorded for this case yet.
          </p>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            fitView
            proOptions={{ hideAttribution: true }}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable
          >
            <Controls
              showInteractive={false}
              className="!overflow-hidden !rounded-lg !border !border-hairline !bg-surface !shadow-none [&>button]:!border-hairline [&>button]:!bg-surface [&>button]:!fill-muted [&>button:hover]:!bg-elevated"
            />
            <MiniMap
              pannable
              zoomable
              nodeColor={(n) => {
                if (n.id === "victim") return "#ff4c41";
                if (String(n.id).startsWith("ATM")) return "#6f78ff";
                return "#3a3a46";
              }}
              maskColor="rgba(8, 8, 10, 0.75)"
              className="!border !border-hairline !bg-surface"
              style={{ borderRadius: 12 }}
            />
            <Background color="#1c1c24" gap={22} size={1} />
          </ReactFlow>
        )}
      </div>
    </div>
  );
}
