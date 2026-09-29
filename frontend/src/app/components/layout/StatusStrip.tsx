import { useEffect, useState } from "react";
import { cn } from "../../lib/cn";
import { formatTime } from "../../lib/format";

export interface StatusStripFacts {
  model: string;
  database: string;
  cells: number;
  openAlerts: number;
  totalAlerts: number;
  cases: number;
  syncedAt: Date;
  reachable: boolean;
}

/**
 * Telemetry ticker.
 *
 * Every item here is a value the backend actually returned for this load —
 * model label, database status, counts of what the current filters matched, and
 * when the console last synced. The previous ticker was a static list of
 * marketing claims ("Model XGB v0.2.0", "Top-K = 5", "Alert channels:
 * dashboard / webhook") that no code path ever set, which made a hardcoded
 * string indistinguishable from a live one.
 */
export function StatusStrip({
  facts,
  className,
}: {
  facts: StatusStripFacts;
  className?: string;
}) {
  const [, setTick] = useState(0);

  // Re-renders once a minute so the "synced" clock advances without the strip
  // re-querying anything — the data itself is refreshed by the page.
  useEffect(() => {
    const timer = window.setInterval(() => setTick((n) => n + 1), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const items = [
    `Model ${facts.model}`,
    `Database ${facts.database}`,
    `${facts.cells} risk cells`,
    `${facts.openAlerts} open alerts of ${facts.totalAlerts}`,
    `${facts.cases} cases returned`,
    `Synced ${formatTime(facts.syncedAt)}`,
  ];

  const run = (
    <div className="flex shrink-0 items-center">
      {items.map((item) => (
        <span key={item} className="label-caps flex items-center text-faint">
          <span className="px-6">{item}</span>
          <span className="text-accent">/</span>
        </span>
      ))}
    </div>
  );

  return (
    <div
      className={cn(
        "relative overflow-hidden border-y border-hairline",
        facts.reachable ? "bg-abyss" : "bg-critical/[0.08]",
        className,
      )}
    >
      {!facts.reachable && (
        <p className="border-b border-critical/30 px-5 py-2 text-center text-[0.6875rem] text-critical">
          Backend unreachable — showing the last values received.
        </p>
      )}
      <div className="marquee-track py-3">
        {run}
        {run}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-void to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-void to-transparent" />
    </div>
  );
}
