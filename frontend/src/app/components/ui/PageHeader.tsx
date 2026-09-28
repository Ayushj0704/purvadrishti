import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import { Eyebrow } from "./Eyebrow";

interface PageHeaderProps {
  index?: string;
  eyebrow?: string;
  title: ReactNode;
  lede?: ReactNode;
  aside?: ReactNode;
  /**
   * Occupies the right-hand section. Supplying it splits the header in two and
   * moves `lede` and `aside` under the title, where the left column is left
   * without a partner. Without it the copy stays in the right column, as before.
   */
  figure?: ReactNode;
  /** Overrides the title's fluid type scale. */
  titleClassName?: string;
  /** Extra gutter between the left column and the page's left edge. */
  leadClassName?: string;
  className?: string;
}

export function PageHeader({
  index,
  eyebrow,
  title,
  lede,
  aside,
  figure,
  titleClassName,
  leadClassName,
  className,
}: PageHeaderProps) {
  const copy = (
    <>
      {lede && <p className="max-w-md text-sm leading-relaxed text-muted">{lede}</p>}
      {aside}
    </>
  );

  return (
    <header
      className={cn(
        "grid gap-10 border-b border-hairline pb-12 lg:grid-cols-12 lg:gap-8",
        className,
      )}
    >
      <div className={cn("lg:col-span-7", leadClassName)}>
        {(index || eyebrow) && (
          <div className="flex items-center gap-3">
            {index && <Eyebrow tone="accent">{index}</Eyebrow>}
            {index && eyebrow && <span className="h-px w-8 bg-hairline" />}
            {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
          </div>
        )}
        <h1
          className={cn(
            "display mt-6 text-[clamp(2.75rem,7vw,6rem)] text-ink",
            titleClassName,
          )}
        >
          {title}
        </h1>
        {figure && <div className="mt-8 flex max-w-md flex-col gap-6">{copy}</div>}
      </div>

      {figure ? (
        <div className="flex items-center justify-center lg:col-span-5">{figure}</div>
      ) : (
        <div className="flex flex-col justify-end gap-6 lg:col-span-5">{copy}</div>
      )}
    </header>
  );
}
