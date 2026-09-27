import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import { Reveal } from "./Reveal";

interface MetricBlockProps {
  index?: string;
  label: string;
  value: ReactNode;
  unit?: string;
  delta?: { value: string; direction: "up" | "down" | "flat" };
  note?: string;
  delay?: number;
}

const DELTA_TONE = {
  up: "text-stable",
  down: "text-critical",
  flat: "text-muted",
} as const;

export function MetricBlock({
  index,
  label,
  value,
  unit,
  delta,
  note,
  delay = 0,
}: MetricBlockProps) {
  return (
    <Reveal
      delay={delay}
      className="group relative flex flex-col justify-between gap-8 border-hairline px-5 py-6 not-last:border-r-0 md:[&:nth-child(-n+2)]:border-b md:[&:nth-child(-n+2)]:border-hairline"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-baseline gap-2">
          {index && <span className="label-caps tnum text-faint">{index}</span>}
          <span className="label-caps text-muted">{label}</span>
        </div>
        {delta && (
          <span className={cn("telemetry", DELTA_TONE[delta.direction])}>{delta.value}</span>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline gap-1.5">
          <span className="display tnum text-[clamp(2.25rem,4.5vw,3.5rem)] text-ink transition-colors duration-300 group-hover:text-accent-bright">
            {value}
          </span>
          {unit && <span className="label-caps text-faint">{unit}</span>}
        </div>
        {note && <span className="text-[0.6875rem] leading-snug text-faint">{note}</span>}
      </div>
    </Reveal>
  );
}

interface MetricRowProps {
  items: MetricBlockProps[];
  className?: string;
}

export function MetricRow({ items, className }: MetricRowProps) {
  return (
    <div className={cn("panel grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4", className)}>
      {items.map((item, i) => (
        <MetricBlock key={item.label} {...item} delay={i * 70} />
      ))}
    </div>
  );
}
