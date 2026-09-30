import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, ArrowUpRight } from "lucide-react";
import { alertsApi } from "../api/alerts";
import type { Alert } from "../api/alerts";
import { riskLevelFromScore } from "../components/ui/RiskBadge";
import { PageHeader } from "../components/ui/PageHeader";
import { Panel, PanelHeader } from "../components/ui/Panel";
import { Reveal } from "../components/ui/Reveal";
import { Skeleton, EmptyState } from "../components/ui/EmptyState";
import { Button } from "../components/ui/Button";
import { StatusPill } from "../components/ui/StatusDot";
import { formatTime, formatWindow, formatRiskScore } from "../lib/format";
import { canWrite, useRole } from "../lib/useRole";
import { cn } from "../lib/cn";

export function Alerts() {
  const role = useRole();
  const writable = canWrite(role);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError("");
    alertsApi
      .getAlerts()
      .then((data) => {
        if (!cancelled) setAlerts(data);
      })
      .catch(() => {
        if (!cancelled) {
          setAlerts([]);
          setLoadError("Alert queue unreachable. Check the API connection and retry.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const handleAcknowledge = useCallback(async (alertId: string) => {
    setProcessingId(alertId);
    const flip = (list: Alert[]) =>
      list.map((a) => (a.alert_id === alertId ? { ...a, status: "ACKNOWLEDGED" } : a));

    setAlerts((prev) => flip(prev));
    try {
      await alertsApi.acknowledgeAlert(alertId);
    } finally {
      setProcessingId(null);
    }
  }, []);

  const openCount = alerts.filter((a) => a.status === "NEW").length;

  return (
    <div className="flex flex-col gap-20">
      <PageHeader
        index="02"
        eyebrow="Alert queue"
        title={
          <>
            Signals that
            <br />
            need a <span className="text-accent">decision.</span>
          </>
        }
        lede="Predictions that crossed the alert threshold, newest first. Acknowledging an alert writes to the audit log and clears it from the duty officer's queue."
        aside={
          <div className="flex flex-wrap items-center gap-3">
            <StatusPill tone={openCount > 0 ? "critical" : "stable"} pulse={openCount > 0}>
              {openCount} unacknowledged
            </StatusPill>
            <span className="telemetry text-faint">{alerts.length} total</span>
          </div>
        }
      />

      <Reveal>
        <Panel>
          <PanelHeader
            index="01"
            title="Dispatched alerts"
                meta={
                    <span className="telemetry text-faint">
                      {alerts.length} records · {openCount} open
                      {!writable ? " · read-only role" : ""}
                    </span>
                  }
          />

          {isLoading ? (
            <Skeleton rows={5} />
          ) : loadError ? (
            <div className="flex flex-col items-center gap-4 px-5 py-10 text-center">
              <p role="alert" className="text-xs text-critical">
                {loadError}
              </p>
              <Button size="sm" onClick={() => setReloadKey((k) => k + 1)}>
                Retry
              </Button>
            </div>
          ) : alerts.length === 0 ? (
            <EmptyState
              label="Queue clear"
              detail="No predictions have crossed the alert threshold in this window."
            />
          ) : (
            <div data-lenis-prevent className="overflow-x-auto">
              <table className="data-table min-w-[52rem]">
                <thead>
                  <tr>
                    <th className="w-24">Raised</th>
                    <th>Case / terminal</th>
                    <th>Risk</th>
                    <th>Window</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.map((alert) => {
                    const score = Number.isFinite(alert.risk_score) ? alert.risk_score : 0;
                    const level = riskLevelFromScore(score);
                    const isNew = alert.status === "NEW";
                    const busy = processingId === alert.alert_id;

                    return (
                      <tr key={alert.alert_id}>
                        <td>
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "h-5 w-0.5 shrink-0 rounded-full",
                                isNew ? "bg-critical" : "bg-hairline",
                              )}
                            />
                            <span className="telemetry text-faint">{formatTime(alert.created_at)}</span>
                          </div>
                        </td>

                        <td>
                          <Link
                            to={`/cases/${alert.case_id}`}
                            className="group flex flex-col gap-1.5"
                          >
                            <span className="telemetry text-ink transition-colors group-hover:text-accent">
                              {alert.atm_id}
                            </span>
                            <span className="text-[0.6875rem] text-faint">C{alert.case_id}</span>
                          </Link>
                        </td>

                        <td>
                          <div className="flex items-center gap-3">
                            <span
                              className={cn(
                                "h-2.5 w-[2px] rounded-full",
                                level === "LOW"
                                  ? "bg-stable"
                                  : level === "MEDIUM"
                                    ? "bg-elevated-risk"
                                    : "bg-critical",
                              )}
                            />
                            <span className="label-caps text-muted">{level}</span>
                            <span className="telemetry text-faint">
                              {formatRiskScore(alert.risk_score)}
                            </span>
                          </div>
                        </td>

                        <td>
                          <span className="telemetry whitespace-nowrap text-muted">
                            {formatWindow(
                              alert.prediction_window_start,
                              alert.prediction_window_end,
                            )}
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

                            {isNew ? (
                              <Button
                                size="sm"
                                onClick={() => handleAcknowledge(alert.alert_id)}
                                disabled={busy || !writable}
                                title={writable ? "Acknowledge alert" : "Requires LEA Officer role or above"}
                              >
                                <Check className="size-3" />
                                {busy ? "Saving" : "Acknowledge"}
                              </Button>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-[0.6875rem] font-medium text-stable">
                                <Check className="size-3" />
                                Acknowledged
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
