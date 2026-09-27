import { api } from './client';

export interface PredictionCandidate {
  atm_id: string;
  state: string;
  risk_score: number;
  risk_level: 'HIGH' | 'MEDIUM' | 'LOW';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface PredictionResponse {
  case_id: string;
  prediction_window: { start: string; end: string };
  predictions: PredictionCandidate[];
}

export interface CaseSummary {
  case_id: string;
  created_at: string;
  fraud_type: string;
  amount: number;
  status: string;
}

export const casesApi = {
  createCase: (data: any) => api.post<{ case_id: string }>('/cases', data),
  predict: (caseId: string) => api.post<PredictionResponse>('/predict', { case_id: caseId }),
  getCase: (caseId: string) => api.get<CaseSummary>(`/cases/${caseId}`),
  getPredictions: (caseId: string) => api.get<PredictionResponse>(`/predictions/${caseId}`),
  getExplanation: (caseId: string) => api.get<any>(`/cases/${caseId}/explanation`),
};
