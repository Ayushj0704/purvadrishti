import { Panel, PanelHeader } from "./ui/Panel";
import { formatTime } from "../lib/format";
import { cn } from "../lib/cn";

/**
 * Investigator timeline, from GET /cases/{id}/timeline.
 *
 * The backend emits a fixed set of kinds — complaint, transaction, withdrawal,
 * prediction, alert — and composes each row's text server-side. Anything else
 * that ever appears on the queue falls through to a neutral style rather than
 * rendering with an undefined colour class.
 */
const KIND_TONE: Record<string, { bar: string; text: string }> = {
  complaint: { bar: "bg-critical", text: "text-critical" },
  transaction: { bar: "bg-faint", text: "text-faint" },
  withdrawal: { bar: "bg-elevated-risk", text: "text-elevated-risk" },
  prediction: { bar: "bg-accent", text: "text-accent" },
  alert: { bar: "bg-accent-bright", text: "text-accent-bright" },
};

const FALLBACK_TONE = { bar: "bg-faint", text: "text-faint" };

function toneFor(kind: string) {
  return KIND_TONE[kind] ?? FALLBACK_TONE;
}

export interface TimelineEvent {
  /** Event timestamp as sent by the backend. */
  t: string;
  kind: string;
  text: string;
}

export function InvestigationTimeline({
  events,
  index = "04",
  title = "Investigation timeline",
  isLoading,
}: {
  events: TimelineEvent[];
  index?: string;
  title?: string;
  isLoading?: boolean;
}) {
  return (
    <Panel>
      <PanelHeader
        index={index}
        title={title}
        meta={<span className="label-caps tnum text-faint">{events.length} events</span>}
      />

      {isLoading ? (
        <p className="px-5 py-10 text-center text-xs text-faint">Loading…</p>
      ) : events.length === 0 ? (
        <p className="px-5 py-10 text-center text-xs text-faint">
          No events recorded for this case.
        </p>
      ) : (
        <ol className="relative flex flex-col">
          {events.map((event, index) => {
            const tone = toneFor(event.kind);
            return (
              <li
                key={`${event.t}-${index}`}
                className="group relative grid grid-cols-[4.5rem_1px_1fr] gap-4 px-5 py-4"
              >
                <span className="telemetry pt-0.5 text-faint">{formatTime(event.t)}</span>

                <span className="relative flex justify-center">
                  <span className="absolute inset-y-[-1rem] w-px bg-hairline group-first:top-1.5 group-last:bottom-[calc(100%-0.375rem)]" />
                  <span
                    className={cn(
                      "relative mt-1 size-1.5 shrink-0 rounded-full ring-4 ring-surface",
                      tone.bar,
                    )}
                  />
                </span>

                <div className="flex flex-col gap-1.5">
                  <span className="text-sm leading-snug tracking-[-0.01em] text-ink">
                    {event.text}
                  </span>
                  <span className={cn("label-caps", tone.text)}>{event.kind}</span>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}
