type RiskLevel = 'HIGH' | 'MEDIUM' | 'LOW';

interface RiskBadgeProps {
  level: RiskLevel;
  confidence?: string;
  score?: number;
}

const CONFIG: Record<RiskLevel, { bg: string; text: string; dot: string; label: string }> = {
  HIGH:   { bg: 'bg-[#FF4C41]/10 border-[#FF4C41]/30', text: 'text-[#FF4C41]', dot: 'bg-[#FF4C41]', label: 'HIGH' },
  MEDIUM: { bg: 'bg-[#F59E0B]/10 border-[#F59E0B]/30', text: 'text-[#F59E0B]', dot: 'bg-[#F59E0B]', label: 'MEDIUM' },
  LOW:    { bg: 'bg-[#10B981]/10 border-[#10B981]/30', text: 'text-[#10B981]', dot: 'bg-[#10B981]', label: 'LOW' },
};

export function RiskBadge({ level, score }: RiskBadgeProps) {
  const { bg, text, dot, label } = CONFIG[level];
  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-semibold tracking-wide border ${bg} ${text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {label}
      {score !== undefined && (
        <span className="font-normal opacity-70 ml-0.5">{(score * 100).toFixed(0)}%</span>
      )}
    </div>
  );
}
