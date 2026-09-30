import { cn } from "../../lib/cn";

/** Radar loader: concentric ping rings around a core dot. Unmissable on a
 *  dark canvas — replaces bare skeletons wherever a whole panel/page waits
 *  on live data. */
export function Loader({
  label = "Loading live data…",
  className,
}: {
  label?: string | null;
  className?: string;
}) {
  return (
    <div
      className={cn("flex flex-col items-center justify-center gap-4 py-10", className)}
      role="status"
      aria-busy="true"
      aria-label={label ?? "Loading"}
    >
      <span className="relative inline-flex size-12">
        <span className="absolute inset-0 rounded-full bg-accent/25 animate-ping-slow" />
        <span className="absolute inset-2 rounded-full border border-accent/60" />
        <span className="absolute inset-[1.125rem] rounded-full bg-accent" />
      </span>
      {label && <span className="telemetry text-muted">{label}</span>}
    </div>
  );
}
