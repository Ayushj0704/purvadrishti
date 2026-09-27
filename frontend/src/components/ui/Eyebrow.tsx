import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

interface EyebrowProps {
  children: ReactNode;
  className?: string;
  tone?: "faint" | "accent" | "muted";
}

export function Eyebrow({ children, className, tone = "faint" }: EyebrowProps) {
  return (
    <span
      className={cn(
        "eyebrow",
        tone === "accent" && "text-accent",
        tone === "muted" && "text-muted",
        className,
      )}
    >
      {children}
    </span>
  );
}

interface SectionHeaderProps {
  index?: string;
  label: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function SectionHeader({
  index,
  label,
  title,
  description,
  actions,
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="flex items-center gap-3">
        {index && (
          <span className="label-caps tnum rounded-md border border-hairline px-2 py-1 text-accent">
            {index}
          </span>
        )}
        <Eyebrow>{label}</Eyebrow>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-2xl">
          <h2 className="display text-[clamp(1.75rem,3.2vw,2.75rem)] text-ink">{title}</h2>
          {description && (
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
