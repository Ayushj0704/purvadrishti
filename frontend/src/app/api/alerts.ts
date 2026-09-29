/**
 * Alert queue.
 *
 * The alert record is deliberately small: the backend stores a severity, a
 * status and a rendered message, and the console shows exactly those. Earlier
 * versions of this module read a risk score, an ATM id, a prediction window and
 * a creation timestamp off the alert — none of which this endpoint returns, so
 * all of it was fiction. The message carries the detail the backend actually
 * has, and the case link is the way to reach the rest.
 */

import { api } from "./client";

export type AlertSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type AlertStatus = "NEW" | "ACKED";

export interface Alert {
  alert_id: number;
  /** Internal case ID — the same ID the case routes use. */
  case_id: number;
  severity: AlertSeverity | string;
  status: AlertStatus | string;
  message: string;
}

export const alertsApi = {
  /** Newest first, capped at 100 by the backend. */
  getAlerts: () => api.get<Alert[]>("/alerts"),

  /** Requires an LEA role or above; other roles get a 403. */
  acknowledgeAlert: (alertId: number) =>
    api.post<{ alert_id: number; status: "ACKED" }>(`/alerts/${alertId}/acknowledge`),
};

export function isOpen(alert: Alert): boolean {
  return alert.status !== "ACKED";
}
