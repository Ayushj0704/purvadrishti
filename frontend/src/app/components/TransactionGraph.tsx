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
import { EmptyState } from "./ui/EmptyState";

/** Shared card styling for flow nodes, so callers can keep the visual language. */
export const FLOW_NODE_BASE =
  "flex min-w-[9.5rem] flex-col gap-1 rounded-lg border px-3.5 py-3 text-center backdrop-blur-sm";

interface TransactionGraphProps {
  nodes?: Node[];
  edges?: Edge[];
}

export function TransactionGraph({ nodes = [], edges = [] }: TransactionGraphProps) {
  const [flowNodes, , onNodesChange] = useNodesState(nodes);
  const [flowEdges, , onEdgesChange] = useEdgesState(edges);

  if (nodes.length === 0) {
    return (
      <div className="overflow-hidden rounded-xl border border-hairline bg-abyss">
        <div className="flex items-center justify-between border-b border-hairline px-5 py-3.5">
          <span className="label-caps text-muted">Money flow topology</span>
          <span className="telemetry text-faint">0 nodes · 0 edges</span>
        </div>
        <EmptyState
          label="No money flow to display"
          detail="The topology is built from this case's transaction trail. Nothing has been recorded for it yet."
        />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-hairline bg-abyss">
      <div className="flex items-center justify-between border-b border-hairline px-5 py-3.5">
        <span className="label-caps text-muted">Money flow topology</span>
        <span className="telemetry text-faint">
          {flowNodes.length} nodes · {flowEdges.length} edges
        </span>
      </div>

      <div className="h-[30rem]">
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
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
              if (n.id.startsWith("victim")) return "#ff4c41";
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
