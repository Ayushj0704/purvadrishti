import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { EmptyState } from "../components/ui/EmptyState";
import { CHART } from "../lib/chart";

/**
 * Feature values behind a prediction.
 *
 * This is deliberately not a SHAP chart. The backend returns the feature vector
 * that produced the top candidate's score — raw values, no per-feature
 * attribution — so a diverging "+0.35 risk / −0.03 risk" plot would be reading
 * meaning into numbers that do not carry it. The bar length is the feature's
 * value and the label says so.
 */
export interface Factor {
  feature: string;
  value: number;
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ payload: Factor }>;
}

function CustomTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const factor = payload[0].payload;

  return (
    <div className="max-w-[16rem] rounded-lg border border-hairline bg-surface/95 p-3.5 backdrop-blur">
      <p className="text-[0.8125rem] font-medium tracking-[-0.01em] text-ink">
        {factor.feature}
      </p>
      <p className="telemetry mt-1.5 text-faint">value {factor.value}</p>
    </div>
  );
}

function readable(name: string): string {
  return name.replace(/_/g, " ");
}

export function PredictionFactorChart({ data }: { data: Factor[]; isLoading?: boolean }) {
  if (!data.length) {
    return (
      <EmptyState
        label="No prediction factors yet"
        detail="Run a prediction to capture the feature vector behind the top candidate."
      />
    );
  }

  const rows = [...data]
    .map((entry) => ({ ...entry, feature: readable(entry.feature) }))
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    .slice(0, 12);

  return (
    <div className="px-5 py-6">
      <div className="h-[20rem]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={rows}
            layout="vertical"
            margin={{ top: 0, right: 24, left: 0, bottom: 0 }}
            barCategoryGap={6}
          >
            <XAxis
              type="number"
              stroke={CHART.tick}
              fontSize={10}
              fontFamily={CHART.mono}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              dataKey="feature"
              type="category"
              width={150}
              stroke={CHART.axis}
              fontSize={11}
              fontFamily={CHART.font}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
            <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={14}>
              {rows.map((row, index) => (
                <Cell key={index} fill={row.value < 0 ? CHART.axis : CHART.grid} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-4 border-t border-hairline pt-4 text-[0.6875rem] leading-relaxed text-faint">
        Feature values as computed for the top-scoring candidate. These are model
        inputs, not per-feature risk contributions.
      </p>
    </div>
  );
}
