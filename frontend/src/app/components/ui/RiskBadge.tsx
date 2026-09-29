import { cn } from "../../lib/cn";

/**
 * The four levels the backend's own classifier emits. There is deliberately no
 * score-to-level helper here: thresholds live in the model, and a client-side
 * copy of them would drift from whatever version the server is actually running.
 */
export type RiskLevel = "HIGH" | "MEDIUM" | "LOW" | "CRITICAL";

const TONE: Record<RiskLevel, { text: string; border: string; bg: string; bar: string }> = {
  CRITICAL: {
    text: "text-critical",
    border: "border-critical/55",
    bg: "bg-critical/20",
    bar: "bg-critical",
  },
  HIGH: {
    text: "text-critical",
    border: "border-critical/45",
    bg: "bg-critical/15",
    bar: "bg-critical",
  },
  MEDIUM: {
    text: "text-elevated-risk",
    border: "border-elevated-risk/45",
    bg: "bg-elevated-risk/15",
    bar: "bg-elevated-risk",
  },
  LOW: {
    text: "text-stable",
    border: "border-stable/45",
    bg: "bg-stable/15",
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
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1",
        tone.border,
        tone.bg,
        tone.text,
        className,
      )}
    >
      <span className={cn("h-2.5 w-[2px] rounded-full", tone.bar)} />
      <span className="label-caps">{level}</span>
      {score !== undefined && (
        <span className="telemetry opacity-60">{(score * 100).toFixed(0)}%</span>
      )}
    </span>
  );
}
