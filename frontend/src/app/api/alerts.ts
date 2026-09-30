import { api } from './client';

export interface Alert {
  alert_id: string;
  /** Numeric case id — deep-links to /cases/{case_id}. Display as C{id}. */
  case_id: number;
  atm_id: string;
  risk_score: number;
  confidence: string;
  prediction_window_start: string;
  prediction_window_end: string;
  created_at: string;
  status: string;
}

export interface NotifyResult {
  alert_id: number;
  delivery: Array<{ channel: string; status: string }>;
}

export const alertsApi = {
  getAlerts: () => api.get<Alert[]>('/alerts'),
  acknowledgeAlert: (alertId: string) => api.post(`/alerts/${alertId}/acknowledge`),
  /** Manual SMS/Email/Webhook re-dispatch trigger (POST /alerts/{id}/notify). */
  notifyAlert: (alertId: string, recipients: { emails?: string[]; phones?: string[] } = {}) =>
    api.post<NotifyResult>(`/alerts/${alertId}/notify`, {
      emails: recipients.emails ?? [],
      phones: recipients.phones ?? [],
    }),
};
