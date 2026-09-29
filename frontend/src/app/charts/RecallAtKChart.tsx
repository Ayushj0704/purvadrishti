import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from "recharts";
import { CHART, RISK_COLOR, TOOLTIP_STYLE } from "../lib/chart";

interface RecallData {
  k: string;
  recall: number;
}

interface Props {
  data: RecallData[];
  /** Headline retrieval figure across the held-out split. */
  overallRecall: number;
  /** The operational setting: recall inside the top 5 ranked candidates. */
  topFiveRecall: number;
}

export function RecallAtKChart({ data, overallRecall, topFiveRecall }: Props) {
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
          <span className="label-caps text-accent">Overall recall</span>
          <div className="display tnum text-[clamp(2.5rem,5vw,3.75rem)] text-ink">
            {overallRecall.toFixed(1)}
            <span className="text-accent">%</span>
          </div>
          <p className="text-xs leading-relaxed text-faint">
            Share of true cash-out locations the ranking recovers at all, measured on the
            held-out split rather than a training aggregate.
          </p>
        </div>

        <div className="flex flex-1 flex-col justify-between gap-6 bg-elevated p-5">
          <span className="label-caps text-muted">Top-5 recall</span>
          <div className="display tnum text-[clamp(2rem,4vw,3rem)] text-muted">
            {topFiveRecall.toFixed(1)}
            <span className="text-faint">%</span>
          </div>
          <p className="text-xs leading-relaxed text-faint">
            The operational figure: true cash-outs recovered inside the five candidates a
            field team can realistically act on.
          </p>
        </div>
      </div>
    </div>
  );
}
