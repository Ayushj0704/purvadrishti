import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import type { Alert } from "../api/alerts";
import { isOpen } from "../api/alerts";
import { cn } from "../lib/cn";

const SEVERITY_TONE: Record<string, string> = {
  CRITICAL: "text-critical",
  HIGH: "text-critical",
  MEDIUM: "text-elevated-risk",
  LOW: "text-stable",
};

const SEVERITY_BAR: Record<string, string> = {
  CRITICAL: "bg-critical",
  HIGH: "bg-critical",
  MEDIUM: "bg-elevated-risk",
  LOW: "bg-stable",
};

/**
 * One alert, showing the five fields the endpoint actually returns. The message
 * is written by the backend and carries the terminal, score and trigger, so it
 * is the row's substance rather than a summary of one.
 */
export function AlertRow({ alert }: { alert: Alert }) {
  const open = isOpen(alert);
  const severity = String(alert.severity);

  return (
    <Link
      to={`/cases/${alert.case_id}`}
      className="group grid grid-cols-[auto_1fr_auto] items-center gap-4 border-b border-hairline-soft px-5 py-4 transition-colors duration-200 last:border-b-0 hover:bg-white/[0.03]"
    >
      <div className="flex flex-col items-start gap-2">
        <span className={cn("h-6 w-0.5 rounded-full", open ? SEVERITY_BAR[severity] ?? "bg-hairline" : "bg-hairline")} />
        <span className={cn("label-caps", SEVERITY_TONE[severity] ?? "text-muted")}>
          {severity}
        </span>
      </div>

      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="text-sm leading-snug text-ink">{alert.message}</span>
        <span className="flex items-baseline gap-1.5">
          <span className="micro">Case {alert.case_id}</span>
          <span className="micro text-faint">· #{alert.alert_id}</span>
          <span className="micro text-faint">· {alert.status}</span>
        </span>
      </div>

      <ArrowUpRight className="size-4 text-faint transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-accent" />
    </Link>
  );
}
