import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import type { Alert } from "../api/alerts";
import { riskLevelFromScore } from "./ui/RiskBadge";
import { formatTime, formatWindow } from "../lib/format";
import { cn } from "../lib/cn";

export function AlertRow({ alert }: { alert: Alert }) {
  const isNew = alert.status === "NEW";
  const level = riskLevelFromScore(alert.risk_score);

  return (
    <Link
      to={`/cases/${alert.case_id}`}
      className="group grid grid-cols-[auto_1fr_auto] items-center gap-4 border-b border-hairline-soft px-5 py-4 transition-colors duration-200 last:border-b-0 hover:bg-white/[0.03]"
    >
      <div className="flex flex-col items-start gap-2">
        <span className={cn("h-6 w-0.5", isNew ? "bg-critical" : "bg-hairline")} />
        <span className="value text-faint">{formatTime(alert.created_at)}</span>
      </div>

      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex items-center gap-2.5">
          <span className="telemetry truncate text-ink">{alert.atm_id}</span>
          <span className="micro">{alert.case_id}</span>
        </div>
        <span className="flex items-baseline gap-1.5">
          <span className="micro">Window</span>
          <span className="value text-faint">
            {formatWindow(alert.prediction_window_start, alert.prediction_window_end)}
          </span>
        </span>
      </div>

      <div className="flex items-center gap-4">
        <span
          className={cn(
            "value tnum hidden sm:inline",
            level === "LOW"
              ? "text-stable"
              : level === "MEDIUM"
                ? "text-elevated-risk"
                : "text-critical",
          )}
        >
          {(alert.risk_score * 100).toFixed(0)}%
        </span>
        <ArrowUpRight className="size-4 text-faint transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-accent" />
      </div>
    </Link>
  );
}
