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
}

export function Skeleton({ rows = 4, className }: SkeletonProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)} aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 w-full animate-pulse rounded-lg bg-white/[0.03]" />
      ))}
    </div>
  );
}
