import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export interface ShapFeature {
  feature_name: string;
  contribution: number;
  description: string;
}

interface ShapContributionChartProps {
  data: ShapFeature[];
  isLoading?: boolean;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const d = payload[0].payload as ShapFeature;
    return (
      <div className="bg-[#FFFFFF] dark:bg-[#13131F] border border-[#000000]/14 dark:border-[#FFFFFF]/10 rounded-lg p-3 shadow-lg max-w-xs">
        <p className="font-semibold text-[#000000] dark:text-[#FFFFFF] text-sm mb-1">{d.feature_name}</p>
        <p className="text-xs text-[#6E7182] dark:text-[#9699AA] mb-2 font-mono">{d.description}</p>
        <p className={`text-sm font-mono font-medium ${d.contribution > 0 ? 'text-[#FF4C41]' : 'text-[#10B981]'}`}>
          {d.contribution > 0 ? '+' : ''}{(d.contribution * 100).toFixed(1)}% risk
        </p>
      </div>
    );
  }
  return null;
};

export function ShapContributionChart({ data, isLoading }: ShapContributionChartProps) {
  if (isLoading) {
    return (
      <div className="w-full min-h-[300px] flex items-center justify-center text-sm font-mono text-[#9699AA] animate-pulse bg-transparent">
        Generating explanation...
      </div>
    );
  }
  if (!data || data.length === 0) {
    return (
      <div className="w-full min-h-[300px] flex items-center justify-center text-sm font-mono text-[#9699AA] bg-transparent">
        No explanation data available.
      </div>
    );
  }

  const sorted = [...data].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

  return (
    <div className="bg-transparent p-5">
      <h3 className="text-[10px] font-mono font-semibold text-[#6E7182] dark:text-[#9699AA] uppercase tracking-widest mb-5">SHAP — Risk Factor Contributions</h3>
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={sorted} layout="vertical" margin={{ top: 0, right: 24, left: 0, bottom: 0 }}>
            <XAxis type="number" tickFormatter={v => `${(v * 100).toFixed(0)}%`} stroke="#6E7182" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis dataKey="feature_name" type="category" width={130} stroke="#6E7182" fontSize={11} tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(110,113,130,0.1)' }} />
            <Bar dataKey="contribution" radius={[0, 4, 4, 0]}>
              {sorted.map((e, i) => (
                <Cell key={i} fill={e.contribution > 0 ? '#FF4C41' : '#10B981'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
