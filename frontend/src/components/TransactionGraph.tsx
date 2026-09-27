import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
} from '@xyflow/react';
import type { Edge, Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

const initialNodes: Node[] = [
  { id: 'victim', position: { x: 250, y: 0 }, data: { label: 'Victim Account' }, className: 'bg-[#FF4C41]/10 text-[#FF4C41] border border-[#FF4C41]/20 rounded-xl p-3 font-semibold shadow-sm min-w-[150px] text-center font-mono text-xs' },
  { id: 'mule-a', position: { x: 250, y: 100 }, data: { label: 'Mule Account A' }, className: 'bg-[#F8F9FE] dark:bg-[#1E1F2B] text-[#000000] dark:text-[#FFFFFF] border border-[#000000]/14 dark:border-[#FFFFFF]/10 rounded-xl p-3 font-semibold shadow-sm min-w-[150px] text-center font-mono text-xs' },
  { id: 'mule-b', position: { x: 100, y: 200 }, data: { label: 'Mule Account B' }, className: 'bg-[#F8F9FE] dark:bg-[#1E1F2B] text-[#000000] dark:text-[#FFFFFF] border border-[#000000]/14 dark:border-[#FFFFFF]/10 rounded-xl p-3 font-semibold shadow-sm min-w-[150px] text-center font-mono text-xs' },
  { id: 'mule-c', position: { x: 400, y: 200 }, data: { label: 'Mule Account C' }, className: 'bg-[#F8F9FE] dark:bg-[#1E1F2B] text-[#000000] dark:text-[#FFFFFF] border border-[#000000]/14 dark:border-[#FFFFFF]/10 rounded-xl p-3 font-semibold shadow-sm min-w-[150px] text-center font-mono text-xs' },
  { id: 'atm-a', position: { x: 100, y: 300 }, data: { label: 'ATM-A' }, className: 'bg-[#1A2FFB]/10 text-[#1A2FFB] border border-[#1A2FFB]/20 rounded-xl p-3 font-semibold shadow-sm min-w-[150px] text-center font-mono text-xs' },
  { id: 'atm-b', position: { x: 400, y: 300 }, data: { label: 'ATM-B' }, className: 'bg-[#1A2FFB]/10 text-[#1A2FFB] border border-[#1A2FFB]/20 rounded-xl p-3 font-semibold shadow-sm min-w-[150px] text-center font-mono text-xs' },
];

const initialEdges: Edge[] = [
  { id: 'e1', source: 'victim', target: 'mule-a', animated: true, style: { stroke: '#FF4C41', strokeWidth: 2 } },
  { id: 'e2', source: 'mule-a', target: 'mule-b', animated: true, style: { stroke: '#6E7182', strokeWidth: 2 } },
  { id: 'e3', source: 'mule-a', target: 'mule-c', animated: true, style: { stroke: '#6E7182', strokeWidth: 2 } },
  { id: 'e4', source: 'mule-b', target: 'atm-a', animated: true, style: { stroke: '#F59E0B', strokeWidth: 2 } },
  { id: 'e5', source: 'mule-c', target: 'atm-b', animated: true, style: { stroke: '#F59E0B', strokeWidth: 2 } },
];

export function TransactionGraph() {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  return (
    <div className="bg-transparent h-[500px] flex flex-col">
      <h3 className="text-[10px] font-mono font-semibold text-[#6E7182] dark:text-[#9699AA] uppercase tracking-widest mb-4">Money Flow Topology</h3>
      <div className="w-full flex-1 border border-[#000000]/10 dark:border-[#FFFFFF]/10 rounded-xl overflow-hidden bg-[#F8F9FE] dark:bg-[#0B0B12]">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          fitView
          attributionPosition="bottom-right"
        >
          <Controls className="bg-[#FFFFFF] dark:bg-[#1E1F2B] border border-[#000000]/10 dark:border-[#FFFFFF]/10 fill-[#000000] dark:fill-[#FFFFFF] shadow-sm rounded-lg overflow-hidden" />
          <MiniMap 
            nodeColor={(n) => {
              if (n.id === 'victim') return '#FF4C41';
              if (n.id.startsWith('atm')) return '#1A2FFB';
              return '#9699AA';
            }} 
            maskColor="rgba(230, 233, 244, 0.5)"
            className="bg-[#FFFFFF] dark:bg-[#1E1F2B] border border-[#000000]/10 dark:border-[#FFFFFF]/10 rounded-lg shadow-sm"
          />
          <Background color="#6E7182" gap={16} size={1} />
        </ReactFlow>
      </div>
    </div>
  );
}
