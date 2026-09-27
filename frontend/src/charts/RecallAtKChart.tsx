import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';

interface RecallData { k: string; recall: number; }

export function RecallAtKChart({ data, crossStateRecall, precisionAt5 }: { data: RecallData[]; crossStateRecall: number; precisionAt5: number }) {
  return (
    <div className="bg-transparent p-5 flex flex-col md:flex-row gap-8">
      <div className="flex-1 min-h-[260px]">
        <h3 className="text-[10px] font-mono font-semibold text-[#6E7182] dark:text-[#9699AA] uppercase tracking-widest mb-5">System Recall @ K</h3>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#6E7182" opacity={0.2} vertical={false} />
            <XAxis dataKey="k" stroke="#6E7182" fontSize={11} tickLine={false} axisLine={false} dy={8} />
            <YAxis stroke="#6E7182" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} dx={-8} domain={[0, 100]} />
            <Tooltip
              cursor={{ fill: 'rgba(110,113,130,0.1)' }}
              contentStyle={{ backgroundColor: '#13131F', borderColor: '#333', color: '#F0F1FA', borderRadius: '8px', fontSize: '12px', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}
              formatter={(v: any) => [`${v.toFixed(1)}%`, 'Recall']}
            />
            <Bar dataKey="recall" radius={[4, 4, 0, 0]} maxBarSize={56}>
              {data.map((_, i) => <Cell key={i} fill={i === 2 ? '#1A2FFB' : '#9699AA'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="w-full md:w-56 flex flex-col gap-4 justify-center">
        <div className="bg-[#1A2FFB]/10 border border-[#1A2FFB]/20 rounded-xl p-4">
          <div className="text-[10px] font-mono font-semibold text-[#1A2FFB] mb-1 uppercase tracking-wide">Cross-State Recall@5</div>
          <div className="text-3xl font-bold text-[#1A2FFB] mb-1">{crossStateRecall.toFixed(1)}%</div>
          <div className="text-xs text-[#1A2FFB]/80 leading-relaxed font-mono">Accuracy when cash-out crosses state borders from victim location.</div>
        </div>
        <div className="bg-[#000000]/5 dark:bg-[#FFFFFF]/5 border border-[#000000]/10 dark:border-[#FFFFFF]/10 rounded-xl p-4">
          <div className="text-[10px] font-mono font-semibold text-[#6E7182] dark:text-[#9699AA] mb-1 uppercase tracking-wide">Precision@5</div>
          <div className="text-2xl font-bold text-[#000000] dark:text-[#FFFFFF] mb-1">{precisionAt5.toFixed(1)}%</div>
          <div className="text-xs text-[#6E7182] dark:text-[#9699AA] font-mono">Hits in top 5 predicted candidates across all events.</div>
        </div>
      </div>
    </div>
  );
}
