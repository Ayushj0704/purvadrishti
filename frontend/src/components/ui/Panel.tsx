import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

interface PanelProps {
  children: ReactNode;
  className?: string;
  raised?: boolean;
  interactive?: boolean;
}

export function Panel({ children, className, raised, interactive }: PanelProps) {
  return (
    <div
      className={cn(
        raised ? "panel-raised" : "panel",
        interactive && "transition-colors duration-300 hover:border-[#2e2e3a]",
        className,
      )}
    >
      {children}
    </div>
  );
}

interface PanelHeaderProps {
  index?: string;
  title: string;
  meta?: ReactNode;
  className?: string;
}

export function PanelHeader({ index, title, meta, className }: PanelHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 border-b border-hairline px-5 py-3.5",
        className,
      )}
    >
      <div className="flex items-baseline gap-3">
        {index && <span className="label-caps tnum text-accent">{index}</span>}
        <h2 className="text-[0.8125rem] font-medium tracking-[-0.01em] text-ink">{title}</h2>
      </div>
      {meta && <div className="flex shrink-0 items-center gap-3">{meta}</div>}
    </div>
  );
}
