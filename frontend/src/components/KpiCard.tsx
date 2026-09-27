interface KpiCardProps {
  label: string;
  value: string | number;
  trend?: string;
  trendUp?: boolean;
  sublabel?: string;
  icon?: React.ReactNode;
}

export function KpiCard({ label, value, trend, trendUp, sublabel, icon }: KpiCardProps) {
  return (
    <div className="bg-[#FFFFFF] dark:bg-[#13131F] border border-[#000000]/14 dark:border-[#FFFFFF]/10 rounded-xl p-5 flex flex-col gap-3 hover:border-[#1A2FFB]/40 transition-all duration-300 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-mono font-semibold text-[#6E7182] dark:text-[#9699AA] uppercase tracking-widest">{label}</div>
        {icon && <div className="text-[#1A2FFB] opacity-60">{icon}</div>}
      </div>
      <div className="flex items-end justify-between gap-2">
        <div className="text-3xl font-bold tracking-tight text-[#000000] dark:text-[#FFFFFF]">{value}</div>
        {trend && (
          <div className={`text-xs font-semibold px-2 py-0.5 rounded-full font-mono ${
            trendUp === true  ? 'text-[#10B981] bg-[#10B981]/10 border border-[#10B981]/20' :
            trendUp === false ? 'text-[#FF4C41] bg-[#FF4C41]/10 border border-[#FF4C41]/20' :
            'text-[#6E7182] bg-[#000000]/5 dark:bg-[#FFFFFF]/5 border border-[#000000]/10 dark:border-[#FFFFFF]/10'
          }`}>
            {trend}
          </div>
        )}
      </div>
      {sublabel && <div className="text-xs text-[#9699AA] font-mono">{sublabel}</div>}
    </div>
  );
}
