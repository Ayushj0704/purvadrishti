import { api } from './client';

export interface Alert {
  alert_id: string;
  case_id: string;
  atm_id: string;
  risk_score: number;
  confidence: string;
  prediction_window_start: string;
  prediction_window_end: string;
  created_at: string;
  status: string;
}

export const alertsApi = {
  getAlerts: () => api.get<Alert[]>('/alerts'),
  acknowledgeAlert: (alertId: string) => api.post(`/alerts/${alertId}/acknowledge`),
};
