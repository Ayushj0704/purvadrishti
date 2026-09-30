import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { EmptyState, Skeleton } from "../components/ui/EmptyState";
import { CHART, RISK_COLOR, TOOLTIP_STYLE } from "../lib/chart";

interface ThreatData {
  time: string;
  complaints: number;
  predictions: number;
}

export function ThreatVelocityChart({ data, isLoading }: { data: ThreatData[]; isLoading?: boolean }) {
  if (isLoading) return <Skeleton rows={5} className="p-5" />;
  if (!data?.length) return <EmptyState label="No velocity samples in window" />;

  return (
    <div className="px-5 py-6">
      <div className="h-[19rem]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
            <defs>
              <linearGradient id="gComplaints" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={RISK_COLOR.critical} stopOpacity={0.28} />
                <stop offset="100%" stopColor={RISK_COLOR.critical} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gPredictions" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={RISK_COLOR.accent} stopOpacity={0.32} />
                <stop offset="100%" stopColor={RISK_COLOR.accent} stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid stroke={CHART.grid} vertical={false} />
            <XAxis
              dataKey="time"
              stroke={CHART.axis}
              fontSize={10}
              fontFamily={CHART.mono}
              tickLine={false}
              axisLine={{ stroke: CHART.grid }}
              dy={8}
              interval={5}
            />
            <YAxis
              stroke={CHART.axis}
              fontSize={10}
              fontFamily={CHART.mono}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: CHART.axis, marginBottom: 4 }} />
            <Area
              type="monotone"
              name="New complaints"
              dataKey="complaints"
              stroke={RISK_COLOR.critical}
              strokeWidth={1.5}
              fill="url(#gComplaints)"
            />
            <Area
              type="monotone"
              name="Predictions generated"
              dataKey="predictions"
              stroke={RISK_COLOR.accent}
              strokeWidth={1.5}
              fill="url(#gPredictions)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-6 border-t border-hairline pt-4">
        <span className="flex items-center gap-2">
          <span className="h-1 w-5 rounded-full bg-critical" />
          <span className="label-caps text-faint">New complaints</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="h-1 w-5 rounded-full bg-accent" />
          <span className="label-caps text-faint">Predictions generated</span>
        </span>
      </div>
    </div>
  );
}
