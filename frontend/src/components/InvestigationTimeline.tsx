import { Panel, PanelHeader } from "./ui/Panel";
import { formatTime } from "../lib/format";
import { cn } from "../lib/cn";

export type TimelineKind =
  | "TRANSACTION"
  | "COMPLAINT"
  | "GENERATION"
  | "PREDICTION"
  | "ALERT"
  | "ACTION";

export interface TimelineEvent {
  id: string;
  timestamp: string;
  description: string;
  type: TimelineKind;
}

const KIND_TONE: Record<TimelineKind, { bar: string; text: string }> = {
  TRANSACTION: { bar: "bg-faint", text: "text-faint" },
  COMPLAINT: { bar: "bg-critical", text: "text-critical" },
  GENERATION: { bar: "bg-accent", text: "text-accent" },
  PREDICTION: { bar: "bg-accent-bright", text: "text-accent-bright" },
  ALERT: { bar: "bg-elevated-risk", text: "text-elevated-risk" },
  ACTION: { bar: "bg-stable", text: "text-stable" },
};

export function InvestigationTimeline({
  events,
  index = "04",
  title = "Investigation timeline",
}: {
  events: TimelineEvent[];
  index?: string;
  title?: string;
}) {
  return (
    <Panel>
      <PanelHeader
        index={index}
        title={title}
        meta={<span className="label-caps tnum text-faint">{events.length} events</span>}
      />

      {events.length === 0 ? (
        <p className="px-5 py-10 text-center text-xs text-faint">No events logged.</p>
      ) : (
        <ol className="relative flex flex-col">
          {events.map((event) => {
            const tone = KIND_TONE[event.type];
            return (
              <li
                key={event.id}
                className="group relative grid grid-cols-[4.5rem_1px_1fr] gap-4 px-5 py-4"
              >
                <span className="telemetry pt-0.5 text-faint">{formatTime(event.timestamp)}</span>

                <span className="relative flex justify-center">
                  <span className="absolute inset-y-[-1rem] w-px bg-hairline first:inset-y-0 group-first:top-1.5 group-last:bottom-[calc(100%-0.375rem)]" />
                  <span
                    className={cn(
                      "relative mt-1 size-1.5 shrink-0 rounded-full ring-4 ring-surface",
                      tone.bar,
                    )}
                  />
                </span>

                <div className="flex flex-col gap-1.5">
                  <span className="text-sm leading-snug tracking-[-0.01em] text-ink">
                    {event.description}
                  </span>
                  <span className={cn("label-caps", tone.text)}>{event.type}</span>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}
