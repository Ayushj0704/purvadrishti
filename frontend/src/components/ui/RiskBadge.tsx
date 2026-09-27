import { cn } from "../../lib/cn";

export type RiskLevel = "HIGH" | "MEDIUM" | "LOW" | "CRITICAL";

const TONE: Record<RiskLevel, { text: string; border: string; bg: string; bar: string }> = {
  CRITICAL: {
    text: "text-critical",
    border: "border-critical/40",
    bg: "bg-critical/10",
    bar: "bg-critical",
  },
  HIGH: {
    text: "text-critical",
    border: "border-critical/30",
    bg: "bg-critical/[0.07]",
    bar: "bg-critical",
  },
  MEDIUM: {
    text: "text-elevated-risk",
    border: "border-elevated-risk/30",
    bg: "bg-elevated-risk/[0.07]",
    bar: "bg-elevated-risk",
  },
  LOW: {
    text: "text-stable",
    border: "border-stable/30",
    bg: "bg-stable/[0.07]",
    bar: "bg-stable",
  },
};

interface RiskBadgeProps {
  level: RiskLevel;
  score?: number;
  className?: string;
}

export function RiskBadge({ level, score, className }: RiskBadgeProps) {
  const tone = TONE[level] ?? TONE.LOW;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 border px-2 py-1",
        tone.border,
        tone.bg,
        tone.text,
        className,
      )}
    >
      <span className={cn("h-2.5 w-[2px]", tone.bar)} />
      <span className="label-caps">{level}</span>
      {score !== undefined && (
        <span className="telemetry opacity-60">{(score * 100).toFixed(0)}%</span>
      )}
    </span>
  );
}

export function riskLevelFromScore(score: number): RiskLevel {
  if (score >= 0.85) return "CRITICAL";
  if (score >= 0.7) return "HIGH";
  if (score >= 0.5) return "MEDIUM";
  return "LOW";
}
