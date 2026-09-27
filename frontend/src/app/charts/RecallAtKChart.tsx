import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from "recharts";
import { CHART, RISK_COLOR, TOOLTIP_STYLE } from "../lib/chart";

interface RecallData {
  k: string;
  recall: number;
}

interface Props {
  data: RecallData[];
  crossStateRecall: number;
  precisionAt5: number;
}

export function RecallAtKChart({ data, crossStateRecall, precisionAt5 }: Props) {
  return (
    <div className="grid gap-px bg-hairline lg:grid-cols-12">
      <div className="bg-surface px-5 py-6 lg:col-span-8">
        <span className="label-caps text-faint">Recall @ K</span>
        <div className="mt-6 h-[16rem]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barCategoryGap="28%">
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis
                dataKey="k"
                stroke={CHART.axis}
                fontSize={10}
                fontFamily={CHART.mono}
                tickLine={false}
                axisLine={{ stroke: CHART.grid }}
                dy={8}
              />
              <YAxis
                stroke={CHART.axis}
                fontSize={10}
                fontFamily={CHART.mono}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `${v}%`}
                domain={[0, 100]}
              />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.03)" }}
                contentStyle={TOOLTIP_STYLE}
                labelStyle={{ color: CHART.axis, marginBottom: 4 }}
                itemStyle={{ color: "#f4f4f5" }}
                formatter={(value) => [`${Number(value).toFixed(1)}%`, "Recall"]}
              />
              <Bar dataKey="recall" radius={[6, 6, 0, 0]} maxBarSize={64}>
                {data.map((d, i) => (
                  <Cell key={d.k} fill={i === 2 ? RISK_COLOR.accent : CHART.muted} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-4 border-t border-hairline pt-4 text-xs leading-relaxed text-faint">
          Share of true cash-out locations recovered inside the top K ranked candidates.
        </p>
      </div>

      <div className="flex flex-col gap-px bg-hairline lg:col-span-4">
        <div className="flex flex-1 flex-col justify-between gap-6 bg-elevated p-5">
          <span className="label-caps text-accent">Cross-state recall @5</span>
          <div className="display tnum text-[clamp(2.5rem,5vw,3.75rem)] text-ink">
            {crossStateRecall.toFixed(1)}
            <span className="text-accent">%</span>
          </div>
          <p className="text-xs leading-relaxed text-faint">
            Accuracy when the cash-out crosses a state border from the victim's location — the
            case that used to end the search.
          </p>
        </div>

        <div className="flex flex-1 flex-col justify-between gap-6 bg-elevated p-5">
          <span className="label-caps text-muted">Precision @5</span>
          <div className="display tnum text-[clamp(2rem,4vw,3rem)] text-muted">
            {precisionAt5.toFixed(1)}
            <span className="text-faint">%</span>
          </div>
          <p className="text-xs leading-relaxed text-faint">
            Hits inside the top 5 predicted candidates, averaged across all scored events.
          </p>
        </div>
      </div>
    </div>
  );
}
