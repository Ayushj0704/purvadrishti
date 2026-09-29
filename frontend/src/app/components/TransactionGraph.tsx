import { useMemo } from "react";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
} from "@xyflow/react";
import type { Edge, Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { TrailEdge, TrailNode } from "../api/cases";

const NODE_BASE =
  "flex min-w-[9.5rem] flex-col gap-1 rounded-lg border px-3.5 py-3 text-center backdrop-blur-sm";

const KIND_STYLE: Record<TrailNode["kind"], { className: string; color: string }> = {
  victim: { className: `${NODE_BASE} border-critical/50 bg-critical/[0.08] text-critical`, color: "#ff4c41" },
  mule: { className: `${NODE_BASE} border-hairline bg-elevated text-ink`, color: "#3a3a46" },
  atm: { className: `${NODE_BASE} border-accent/50 bg-accent/[0.12] text-accent-bright`, color: "#6f78ff" },
};

/** Column/row placement, so the graph reads top-down from the victim account. */
function layout(nodes: TrailNode[]): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const byKind = {
    victim: nodes.filter((n) => n.kind === "victim"),
    mule: nodes.filter((n) => n.kind === "mule"),
    atm: nodes.filter((n) => n.kind === "atm"),
  };

  const place = (list: TrailNode[], y: number, gapX: number, startX: number) => {
    list.forEach((node, index) => {
      positions.set(node.id, { x: startX + index * gapX, y });
    });
  };

  place(byKind.victim, 0, 220, 260);
  place(byKind.mule, 120, 200, Math.max(0, 160 - (byKind.mule.length - 1) * 20));
  place(byKind.atm, 260, 200, Math.max(0, 160 - (byKind.atm.length - 1) * 20));

  // Anything the backend adds later still gets a slot rather than a NaN.
  const rest = nodes.filter((n) => !positions.has(n.id));
  place(rest, 380, 200, 40);

  return positions;
}

/**
 * Money-flow graph from GET /cases/{id}/trail.
 *
 * The backend returns nodes tagged by kind and edges whose endpoints are named
 * `from` and `to` — the frontend has to rename them for React Flow, which is
 * the one transformation here. The previous version of this component drew a
 * fixed six-node diagram regardless of the case, which is why the real
 * topology never appeared.
 */
export function TransactionGraph({ trail }: { trail: { nodes: TrailNode[]; edges: TrailEdge[] } }) {
  const { nodes, edges } = useMemo(() => {
    const positions = layout(trail.nodes);

    const flowNodes: Node[] = trail.nodes.map((node) => ({
      id: node.id,
      position: positions.get(node.id) ?? { x: 0, y: 0 },
      data: { label: node.label },
      className: (KIND_STYLE[node.kind] ?? KIND_STYLE.mule).className,
    }));

    const flowEdges: Edge[] = trail.edges
      // An edge to a node the graph does not contain would crash React Flow.
      .filter((edge) => positions.has(edge.from) && positions.has(edge.to))
      .map((edge, index) => ({
        id: `e${index}`,
        source: edge.from,
        target: edge.to,
        animated: edge.type === "predicted cash-out",
        label: edge.amount ? String(Math.round(edge.amount)) : undefined,
        style: {
          stroke: edge.type === "predicted cash-out" ? "#f59e0b" : "#3a3a46",
          strokeWidth: 1.5,
        },
        labelStyle: { fill: "#8b8b95", fontSize: 10 },
      }));

    return { nodes: flowNodes, edges: flowEdges };
  }, [trail]);

  // fitView only runs on mount, so the flow is keyed on its shape and remounts
  // when the topology actually changes. Cheaper and steadier than chasing the
  // viewport across async data arrival.
  const fitKey = useMemo(
    () => `${trail.nodes.map((n) => n.id).join(",")}|${trail.edges.length}`,
    [trail],
  );

  return (
    <div className="overflow-hidden rounded-xl border border-hairline bg-abyss">
      <div className="flex items-center justify-between border-b border-hairline px-5 py-3.5">
        <span className="label-caps text-muted">Money flow topology</span>
        <span className="telemetry text-faint">
          {nodes.length} nodes · {edges.length} edges
        </span>
      </div>

      <div className="h-[30rem]">
        <ReactFlow
          key={fitKey}
          nodes={nodes}
          edges={edges}
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
            nodeColor={(node) => {
              const kind = trail.nodes.find((n) => n.id === node.id)?.kind ?? "mule";
              return (KIND_STYLE[kind] ?? KIND_STYLE.mule).color;
            }}
            maskColor="rgba(8, 8, 10, 0.75)"
            className="!border !border-hairline !bg-surface"
            style={{ borderRadius: 12 }}
          />
          <Background color="#1c1c24" gap={22} size={1} />
        </ReactFlow>
      </div>
    </div>
  );
}
