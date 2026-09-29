import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, ArrowUpRight } from "lucide-react";
import { alertsApi, isOpen } from "../api/alerts";
import type { Alert } from "../api/alerts";
import { useStreamEvents } from "../api/events";
import type { StreamEvent } from "../api/events";
import { ApiError } from "../api/client";
import { hasRole } from "../api/auth";
import { PageHeader } from "../components/ui/PageHeader";
import { Panel, PanelHeader } from "../components/ui/Panel";
import { Reveal } from "../components/ui/Reveal";
import { Skeleton, EmptyState } from "../components/ui/EmptyState";
import { Button } from "../components/ui/Button";
import { StatusPill } from "../components/ui/StatusDot";
import { cn } from "../lib/cn";

const SEVERITY_BAR: Record<string, string> = {
  CRITICAL: "bg-critical",
  HIGH: "bg-critical",
  MEDIUM: "bg-elevated-risk",
  LOW: "bg-stable",
};

const SEVERITY_TEXT: Record<string, string> = {
  CRITICAL: "text-critical",
  HIGH: "text-critical",
  MEDIUM: "text-elevated-risk",
  LOW: "text-stable",
};

/**
 * Alert queue, over the five fields the endpoint returns.
 *
 * The table used to lead with a timestamp the API never sent — the component
 * formatted `alert.created_at`, which was undefined, so every row rendered
 * "Invalid Date" once the fake rows were removed. There is no raised-at column
 * now because the record has no raised-at. Acknowledgement is optimistic and
 * rolls back on failure, which matters here: the endpoint is role-gated, so a
 * bank analyst gets a 403 and the row must not stay marked as done.
 */
export function Alerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [processingId, setProcessingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      setAlerts(await alertsApi.getAlerts());
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not load the alert queue.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onStreamEvent = useCallback((event: StreamEvent) => {
    if (event.event === "alert.created") void load();
  }, [load]);
  useStreamEvents(onStreamEvent);

  const handleAcknowledge = useCallback(async (alertId: number) => {
    setProcessingId(alertId);
    setActionError("");

    // Optimistic: the queue is a duty-officer list and the round trip should not
    // block the next action. Rolled back below if the write does not land.
    const previous = alerts;
    setAlerts((prev) =>
      prev.map((alert) => (alert.alert_id === alertId ? { ...alert, status: "ACKED" } : alert)),
    );

    try {
      await alertsApi.acknowledgeAlert(alertId);
    } catch (caught) {
      setAlerts(previous);
      if (caught instanceof ApiError && caught.isForbidden) {
        setActionError("Acknowledging an alert requires an LEA officer role or above.");
      } else {
        setActionError(caught instanceof ApiError ? caught.message : "Acknowledgement failed.");
      }
    } finally {
      setProcessingId(null);
    }
  }, [alerts]);

  const openCount = alerts.filter(isOpen).length;
  const canAcknowledge = hasRole("LEA_OFFICER");

  return (
    <div className="flex flex-col gap-20">
      <PageHeader
        index="02"
        eyebrow="Alert queue"
        title={
          <>
            Signals that
            <br />need a <span className="text-accent">decision.</span>
          </>
        }
        lede="Every prediction that crossed the alert threshold, with the message the model pipeline wrote. Acknowledging records the action against the audit log."
        aside={
          <div className="flex flex-wrap items-center gap-3">
            <StatusPill tone={openCount > 0 ? "critical" : "stable"} pulse={openCount > 0}>
              {openCount} unacknowledged
            </StatusPill>
            <span className="telemetry text-faint">{alerts.length} returned</span>
          </div>
        }
      />

      {(error || actionError) && (
        <p
          role="alert"
          className="rounded-lg border border-critical/50 bg-critical/15 px-4 py-3 text-xs text-critical"
        >
          {error || actionError}
        </p>
      )}

      <Reveal>
        <Panel>
          <PanelHeader
            index="01"
            title="Dispatched alerts"
            meta={
              <span className="telemetry text-faint">
                {alerts.length} records · {openCount} open
              </span>
            }
          />

          {isLoading ? (
            <Skeleton rows={5} />
          ) : alerts.length === 0 ? (
            <EmptyState
              label="Queue clear"
              detail="No prediction has crossed the alert threshold."
            >
              <Button variant="ghost" size="sm" onClick={load}>
                Refresh
              </Button>
            </EmptyState>
          ) : (
            <div data-lenis-prevent className="overflow-x-auto">
              <table className="data-table min-w-[52rem]">
                <thead>
                  <tr>
                    <th className="w-28">Severity</th>
                    <th>Message</th>
                    <th className="w-24">Status</th>
                    <th className="w-28 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.map((alert) => {
                    const open = isOpen(alert);
                    const busy = processingId === alert.alert_id;
                    const severity = String(alert.severity);

                    return (
                      <tr key={alert.alert_id}>
                        <td>
                          <div className="flex items-center gap-3">
                            <span
                              className={cn(
                                "h-2.5 w-[2px] rounded-full",
                                open ? SEVERITY_BAR[severity] ?? "bg-hairline" : "bg-hairline",
                              )}
                            />
                            <span className={cn("label-caps", SEVERITY_TEXT[severity] ?? "text-muted")}>
                              {severity}
                            </span>
                          </div>
                        </td>

                        <td>
                          <div className="flex flex-col gap-1.5">
                            <span className="text-sm leading-snug text-ink">{alert.message}</span>
                            <Link
                              to={`/cases/${alert.case_id}`}
                              className="telemetry w-fit text-faint underline-offset-4 transition-colors hover:text-accent hover:underline"
                            >
                              Case {alert.case_id} · #{alert.alert_id}
                            </Link>
                          </div>
                        </td>

                        <td>
                          <span
                            className={cn(
                              "label-caps",
                              open ? "text-muted" : "text-stable",
                            )}
                          >
                            {alert.status}
                          </span>
                        </td>

                        <td>
                          <div className="flex items-center justify-end gap-3">
                            <Link
                              to={`/cases/${alert.case_id}`}
                              className="inline-flex items-center gap-1.5 text-[0.6875rem] font-medium text-muted transition-colors hover:text-accent"
                            >
                              Review
                              <ArrowUpRight className="size-3" />
                            </Link>

                            {open ? (
                              <Button
                                size="sm"
                                onClick={() => handleAcknowledge(alert.alert_id)}
                                disabled={busy}
                                title={
                                  canAcknowledge
                                    ? undefined
                                    : "Requires an LEA officer role or above"
                                }
                              >
                                <Check className="size-3" />
                                {busy ? "Saving" : "Acknowledge"}
                              </Button>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-[0.6875rem] font-medium text-stable">
                                <Check className="size-3" />
                                Done
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </Reveal>
    </div>
  );
}
