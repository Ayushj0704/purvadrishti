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

export interface CaseListParams {
  status?: string;
  limit?: number;
  offset?: number;
}

export interface CaseListResult {
  cases: CaseSummary[];
  total: number;
}

function withQuery(path: string, params?: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== "") search.set(key, String(value));
  });
  const qs = search.toString();
  return qs ? `${path}?${qs}` : path;
}

export const casesApi = {
  createCase: (data: any) => api.post<{ case_id: string }>('/cases', data),
  predict: (caseId: string) => api.post<PredictionResponse>('/predict', { case_id: caseId }),
  getCase: (caseId: string) => api.get<CaseSummary>(`/cases/${caseId}`),
  getPredictions: (caseId: string) => api.get<PredictionResponse>(`/predictions/${caseId}`),
  getExplanation: (caseId: string) => api.get<any>(`/cases/${caseId}/explanation`),

  /**
   * Paginated case list. Tolerates either the `{ cases, total }` envelope or a
   * bare array so a shape change surfaces as an empty list rather than a crash.
   */
  listCases: async (params: CaseListParams = {}): Promise<CaseListResult> => {
    const raw = await api.get<CaseSummary[] | CaseListResult>(
      withQuery('/cases', {
        status: params.status,
        limit: params.limit,
        offset: params.offset,
      }),
    );
    if (Array.isArray(raw)) return { cases: raw, total: raw.length };
    const cases = Array.isArray(raw?.cases) ? raw.cases : [];
    return { cases, total: typeof raw?.total === 'number' ? raw.total : cases.length };
  },
};
