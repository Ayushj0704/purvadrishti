const TICKER = [
  "Model XGB v0.5.0",
  "Horizons 30 / 60 / 240 / 720 min",
  "H3 resolution 8",
  "Top-K = 5",
  "Cross-state trails enabled",
  "Alert channels: dashboard / webhook",
  "Candidate radius 5 km",
  "Time-regressor MAE 38.6 min",
];

import { cn } from "../../lib/cn";

export function StatusStrip({ className }: { className?: string } = {}) {
  const run = (
    <div className="flex shrink-0 items-center">
      {TICKER.map((item) => (
        <span key={item} className="label-caps flex items-center text-faint">
          <span className="px-6">{item}</span>
          <span className="text-accent">/</span>
        </span>
      ))}
    </div>
  );

  return (
    <div
      className={cn("relative overflow-hidden border-y border-hairline bg-abyss", className)}
      aria-hidden="true"
    >
      <div className="marquee-track py-3">
        {run}
        {run}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-void to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-void to-transparent" />
    </div>
  );
}
