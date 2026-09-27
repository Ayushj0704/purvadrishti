import { cn } from "../../lib/cn";

type Tone = "stable" | "warning" | "critical" | "accent" | "idle";

const TONE: Record<Tone, { dot: string; text: string }> = {
  stable: { dot: "bg-stable", text: "text-stable" },
  warning: { dot: "bg-elevated-risk", text: "text-elevated-risk" },
  critical: { dot: "bg-critical", text: "text-critical" },
  accent: { dot: "bg-accent", text: "text-accent" },
  idle: { dot: "bg-faint", text: "text-muted" },
};

interface StatusDotProps {
  tone?: Tone;
  pulse?: boolean;
  className?: string;
}

export function StatusDot({ tone = "stable", pulse, className }: StatusDotProps) {
  return (
    <span className={cn("relative inline-flex size-1.5 shrink-0", className)}>
      {pulse && (
        <span className={cn("absolute inset-0 rounded-full animate-ping-slow", TONE[tone].dot)} />
      )}
      <span className={cn("relative size-1.5 rounded-full", TONE[tone].dot)} />
    </span>
  );
}

interface StatusPillProps {
  tone?: Tone;
  pulse?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function StatusPill({ tone = "idle", pulse, children, className }: StatusPillProps) {
  return (
    <span
      className={cn(
        "label-caps inline-flex items-center gap-2 border border-hairline px-2.5 py-1.5",
        TONE[tone].text,
        className,
      )}
    >
      <StatusDot tone={tone} pulse={pulse} />
      {children}
    </span>
  );
}
