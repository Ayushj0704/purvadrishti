import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { EmptyState } from "../components/ui/EmptyState";
import { CHART, RISK_COLOR } from "../lib/chart";

export interface ShapFeature {
  feature_name: string;
  contribution: number;
  description: string;
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ payload: ShapFeature }>;
}

function CustomTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const positive = d.contribution > 0;

  return (
    <div className="max-w-[18rem] border border-hairline bg-void/95 p-3.5 backdrop-blur">
      <p className="text-[0.8125rem] font-medium tracking-[-0.01em] text-ink">{d.feature_name}</p>
      <p className="mt-1.5 text-xs leading-relaxed text-faint">{d.description}</p>
      <p
        className="telemetry mt-3 border-t border-hairline pt-2.5"
        style={{ color: positive ? RISK_COLOR.negative : RISK_COLOR.positive }}
      >
        {positive ? "+" : ""}
        {(d.contribution * 100).toFixed(1)}% risk
      </p>
    </div>
  );
}

export function ShapContributionChart({ data }: { data: ShapFeature[]; isLoading?: boolean }) {
  if (!data?.length) {
    return <EmptyState label="No explanation data available" />;
  }

  const sorted = [...data].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

  return (
    <div className="px-5 py-6">
      <div className="h-[20rem]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={sorted}
            layout="vertical"
            margin={{ top: 0, right: 40, left: 0, bottom: 0 }}
            barCategoryGap={6}
          >
            <XAxis
              type="number"
              tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
              stroke={CHART.tick}
              fontSize={10}
              fontFamily={CHART.mono}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              dataKey="feature_name"
              type="category"
              width={132}
              stroke={CHART.axis}
              fontSize={11}
              fontFamily={CHART.font}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
            <Bar dataKey="contribution" radius={0} maxBarSize={18}>
              {sorted.map((f, i) => (
                <Cell key={i} fill={f.contribution > 0 ? RISK_COLOR.negative : RISK_COLOR.positive} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-5 flex items-center gap-6 border-t border-hairline pt-4">
        <span className="flex items-center gap-2">
          <span className="size-2 bg-critical" />
          <span className="label-caps text-faint">Raises risk</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="size-2 bg-stable" />
          <span className="label-caps text-faint">Lowers risk</span>
        </span>
      </div>
    </div>
  );
}
