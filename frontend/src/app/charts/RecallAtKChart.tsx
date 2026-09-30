import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from "recharts";
import { CHART, RISK_COLOR, TOOLTIP_STYLE } from "../lib/chart";

interface RecallData {
  k: string;
  recall: number;
}

interface Props {
  data: RecallData[];
  /** Held-out Top-5 recall (%) at the operational 60-minute horizon. */
  recallAt5: number;
  /** Held-out ROC-AUC at the operational 60-minute horizon. */
  rocAuc: number;
}

export function RecallAtKChart({ data, recallAt5, rocAuc }: Props) {
  return (
    /* No fills on the cells. This grid used to separate itself with
       `gap-px` over bg-white/[0.06] plus bg-white/[0.015] and bg-white/[0.03]
       cells, which was right when the panel glass was a *white* tint: the
       lighter fills were meant to read as recessed panes. Now that the panel is
       dark glass those white fills lighten the cells instead, so the chart
       floats on pale patches inside a black frame and the material stops
       matching the rest of the console.

       The dividers are borders now, for the same reason `.glass-grey-divide`
       uses them: a fill sits on top of the glass it is meant to be behind,
       while a border only marks the edge and leaves the frost visible. That
       keeps the panel's own gradient as the single source of the surface. */
    <div className="grid lg:grid-cols-12">
      <div className="px-5 py-6 lg:col-span-8 lg:border-r lg:border-hairline">
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
                {data.map((d) => (
                  <Cell key={d.k} fill={d.k === "K=5" ? RISK_COLOR.accent : CHART.muted} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-4 border-t border-hairline pt-4 text-xs leading-relaxed text-faint">
          Share of true cash-out locations recovered inside the top K ranked candidates.
        </p>
      </div>

      <div className="flex flex-col lg:col-span-4">
        <div className="flex flex-1 flex-col justify-between gap-6 border-t border-hairline p-5 lg:border-t-0 lg:border-b">
          <span className="label-caps text-accent">Top-5 recall · 60 min</span>
          <div className="display tnum text-[clamp(2.5rem,5vw,3.75rem)] text-ink">
            {recallAt5.toFixed(1)}
            <span className="text-accent">%</span>
          </div>
          <p className="text-xs leading-relaxed text-faint">
            Share of true cash-out locations recovered inside the top 5 ranked
            candidates on the held-out test split.
          </p>
        </div>

        <div className="flex flex-1 flex-col justify-between gap-6 border-t border-hairline p-5 lg:border-t-0">
          <span className="label-caps text-muted">ROC-AUC · 60 min</span>
          <div className="display tnum text-[clamp(2rem,4vw,3rem)] text-muted">
            {rocAuc.toFixed(3)}
          </div>
          <p className="text-xs leading-relaxed text-faint">
            Ranking quality of the scorer on the held-out test split.
          </p>
        </div>
      </div>
    </div>
  );
}
