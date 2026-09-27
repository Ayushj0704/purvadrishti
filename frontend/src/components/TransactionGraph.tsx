import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
} from "@xyflow/react";
import type { Edge, Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

const NODE_BASE =
  "flex min-w-[9.5rem] flex-col gap-1 rounded-lg border px-3.5 py-3 text-center backdrop-blur-sm";

const initialNodes: Node[] = [
  {
    id: "victim",
    position: { x: 260, y: 0 },
    data: { label: "Victim account", role: "Origin" },
    className: `${NODE_BASE} border-critical/50 bg-critical/[0.08] text-critical`,
  },
  {
    id: "mule-a",
    position: { x: 260, y: 110 },
    data: { label: "Mule account A", role: "Hop 01" },
    className: `${NODE_BASE} border-hairline bg-elevated text-ink`,
  },
  {
    id: "mule-b",
    position: { x: 80, y: 220 },
    data: { label: "Mule account B", role: "Hop 02" },
    className: `${NODE_BASE} border-hairline bg-elevated text-ink`,
  },
  {
    id: "mule-c",
    position: { x: 440, y: 220 },
    data: { label: "Mule account C", role: "Hop 02" },
    className: `${NODE_BASE} border-hairline bg-elevated text-ink`,
  },
  {
    id: "atm-a",
    position: { x: 80, y: 330 },
    data: { label: "ATM · RJ-1023", role: "Cash-out" },
    className: `${NODE_BASE} border-accent/50 bg-accent/[0.12] text-accent-bright`,
  },
  {
    id: "atm-b",
    position: { x: 440, y: 330 },
    data: { label: "ATM · HR-2041", role: "Cash-out" },
    className: `${NODE_BASE} border-accent/50 bg-accent/[0.12] text-accent-bright`,
  },
];

const initialEdges: Edge[] = [
  { id: "e1", source: "victim", target: "mule-a", animated: true, style: { stroke: "#ff4c41", strokeWidth: 1.5 } },
  { id: "e2", source: "mule-a", target: "mule-b", style: { stroke: "#3a3a46", strokeWidth: 1.5 } },
  { id: "e3", source: "mule-a", target: "mule-c", style: { stroke: "#3a3a46", strokeWidth: 1.5 } },
  { id: "e4", source: "mule-b", target: "atm-a", animated: true, style: { stroke: "#f59e0b", strokeWidth: 1.5 } },
  { id: "e5", source: "mule-c", target: "atm-b", style: { stroke: "#f59e0b", strokeWidth: 1.5 } },
];

export function TransactionGraph() {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

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
          nodes={nodes}
          edges={edges}
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
              if (n.id.startsWith("atm")) return "#6f78ff";
              return "#3a3a46";
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
