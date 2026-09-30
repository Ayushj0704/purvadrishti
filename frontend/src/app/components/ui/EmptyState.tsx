import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

interface EmptyStateProps {
  label: string;
  detail?: string;
  className?: string;
  children?: ReactNode;
}

export function EmptyState({ label, detail, className, children }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center gap-3 px-6 py-16 text-center", className)}>
      <span className="h-px w-10 rounded-full bg-hairline" />
      <p className="label-caps text-muted">{label}</p>
      {detail && <p className="max-w-xs text-xs leading-relaxed text-faint">{detail}</p>}
      {children}
    </div>
  );
}

interface SkeletonProps {
  rows?: number;
  className?: string;
  /** Caption under the bars. Pass null to hide (when the caller renders its own). */
  label?: string | null;
}

export function Skeleton({ rows = 4, className, label = "Loading live data…" }: SkeletonProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)} aria-busy="true" aria-label={label ?? "Loading"}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="skeleton-bar h-12 w-full rounded-lg"
          style={{ animationDelay: `${i * 130}ms` }}
        />
      ))}
      {label && <p className="telemetry mt-1 text-center text-muted">{label}</p>}
    </div>
  );
}
