import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import { Eyebrow } from "./Eyebrow";

interface PageHeaderProps {
  index: string;
  eyebrow: string;
  title: ReactNode;
  lede?: ReactNode;
  aside?: ReactNode;
  className?: string;
}

export function PageHeader({
  index,
  eyebrow,
  title,
  lede,
  aside,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "grid gap-10 border-b border-hairline pb-12 lg:grid-cols-12 lg:gap-8",
        className,
      )}
    >
      <div className="lg:col-span-7">
        <div className="flex items-center gap-3">
          <Eyebrow tone="accent">{index}</Eyebrow>
          <span className="h-px w-8 bg-hairline" />
          <Eyebrow>{eyebrow}</Eyebrow>
        </div>
        <h1 className="display mt-6 text-[clamp(2.75rem,7vw,6rem)] text-ink">{title}</h1>
      </div>

      <div className="flex flex-col justify-end gap-6 lg:col-span-5">
        {lede && <p className="max-w-md text-sm leading-relaxed text-muted">{lede}</p>}
        {aside}
      </div>
    </header>
  );
}
