import { api } from './client';
import type { RiskLevel } from '../components/ui/RiskBadge';
import type * as GeoJSON from 'geojson';

/** Single ranked cash-out hypothesis — mirrors POST /cases/{id}/predictions. */
export interface ModelPrediction {
  atm_id: string;
  lat: number;
  lon: number;
  state: string;
  score: number;
  risk_level: RiskLevel;
  scores: Record<string, number>;
  predicted_window: string;
  expected_between: [string, string] | null;
  expected_min: number | null;
  basis: string;
  heat: { n2h: number; n6h: number; level: string };
  best_bet: boolean;
  h3_cell: string;
  top_reasons: string[];
}

export interface PredictResponse {
  case_id: string;
  generated_at: string;
  horizon_minutes: number;
  model_version: string;
  basis_note: string;
  ranking_note: string;
  heat_watch: Array<{
    atm_id: string; lat: number; lon: number; score: number;
    n2h: number; n6h: number; h3_cell: string;
  }>;
  predictions: ModelPrediction[];
}

export interface PredictInput {
  horizon_minutes?: number;
  ref_lat?: number | null;
  ref_lon?: number | null;
}

/** Row shape consumed by TopKTable. */
export interface PredictionCandidate {
  atm_id: string;
  state: string;
  risk_score: number;
  risk_level: RiskLevel;
  confidence?: string;
  best_bet?: boolean;
  basis?: string;
  expected_between?: [string, string] | null;
  expected_min?: number | null;
  predicted_window?: string;
  lat?: number;
  lon?: number;
  /** Observed burst-heat level at this terminal (from heat_watch). */
  heat_level?: string;
}

export function toTopKRows(predictions: ModelPrediction[]): PredictionCandidate[] {
  return predictions.map((p) => ({
    atm_id: p.atm_id,
    state: p.state,
    risk_score: p.score,
    risk_level: p.risk_level,
    best_bet: p.best_bet,
    basis: p.basis,
    expected_between: p.expected_between,
    expected_min: p.expected_min,
    predicted_window: p.predicted_window,
    lat: p.lat,
    lon: p.lon,
  }));
}

/** "When can it be debited" label per candidate: clock window → ETA → window. */
export function expectedLabel(p: {
  expected_between?: [string, string] | null;
  expected_min?: number | null;
  predicted_window?: string;
}): string {
  if (p.expected_between) return `~${p.expected_between[0]}–${p.expected_between[1]}`;
  if (p.expected_min != null) return `ETA ~${p.expected_min} min`;
  return p.predicted_window ?? "—";
}

/** Candidate ATMs → GeoJSON points for the RiskMap marker layer. */
export function toAtmPoints(rows: PredictionCandidate[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: rows
      .filter((r) => r.lat != null && r.lon != null)
      .map((r) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [r.lon as number, r.lat as number] },
        properties: {
          atm_id: r.atm_id,
          risk_level: r.risk_level,
          risk_score: r.risk_score,
          state: r.state,
          expected: expectedLabel(r),
          best_bet: r.best_bet === true,
          heat_level: r.heat_level ?? "LOW",
        },
      })),
  };
}

export const HORIZON_OPTIONS = [
  { minutes: 30, label: "Next 30 min" },
  { minutes: 60, label: "30–60 min" },
  { minutes: 240, label: "1–4 hrs" },
  { minutes: 720, label: "4–12 hrs" },
];

export interface CaseSummary {
  case_id: number;
  external_case_id: string;
  reported_at: string | null;
  fraud_type: string;
  crime_subcategory: string | null;
  amount: number;
  fraud_amount: number | null;
  status: string;
  complainant_state: string;
  incident_state: string;
  victim_location: { lat: number | null; lon: number | null };
}

export interface CaseSample {
  case_id: number;
  external_case_id: string;
  subcategory: string | null;
  amount: number | null;
  incident_state: string;
  complainant_state: string;
  source: string;
}

export interface ExplanationResponse {
  case_id: number;
  atm_id: string | null;
  score: number;
  risk_level: RiskLevel;
  model_version: string;
  features: Record<string, number>;
}

export interface TimelineItem {
  t: string;
  kind: 'complaint' | 'transaction' | 'withdrawal' | 'prediction' | 'alert';
  text: string;
}

export interface TrailNode {
  id: string;
  kind: 'victim' | 'mule' | 'atm';
  label: string;
  [key: string]: unknown;
}

export interface TrailEdge {
  from: string;
  to: string;
  amount?: number | null;
  type?: string;
  [key: string]: unknown;
}

export interface TrailResponse {
  case_id: number;
  nodes: TrailNode[];
  edges: TrailEdge[];
  depth: number | null;
}

export interface IngestInput {
  external_case_id: string;
  fraud_type?: string;
  crime_subcategory?: string | null;
  amount?: number;
  complainant_state?: string;
  incident_state?: string;
  bank_name?: string;
  transaction_id?: string | null;
  incident_details?: string;
  source_system?: string;
  [key: string]: unknown;
}

export interface IngestResponse {
  case_id: number;
  external_case_id: string;
  deduped: boolean;
}

export interface SimilarCase {
  case_id: number;
  external_case_id: string;
  subcategory: string | null;
  amount: number | null;
  incident_state: string;
  reported_at: string | null;
}

export const casesApi = {
  listCases: () => api.get<CaseSummary[]>('/cases'),
  sampleCases: (limit = 20, state?: string) => {
    const qs = new URLSearchParams({ limit: String(limit) });
    if (state && state !== 'ALL') qs.set('state', state);
    return api.get<CaseSample[]>(`/cases/samples?${qs.toString()}`);
  },
  createCase: (data: Record<string, unknown>) =>
    api.post<{ case_id: number; external_case_id: string; request_id: string }>('/cases', data),
  ingestCase: (data: IngestInput) =>
    api.post<IngestResponse>('/cases/ingest', { source_system: 'CFCFRMS', ...data }),
  getCase: (caseId: string | number) => api.get<CaseSummary>(`/cases/${caseId}`),
  predict: (caseId: string | number, input: PredictInput = {}) =>
    api.post<PredictResponse>(`/cases/${caseId}/predictions`, {
      horizon_minutes: 60,
      ref_lat: null,
      ref_lon: null,
      ...input,
    }),
  addTransaction: (caseId: string | number, data: Record<string, unknown>) =>
    api.post<{ ok: boolean; txn_id: number }>(`/cases/${caseId}/transactions`, data),
  listTransactions: (caseId: string | number) =>
    api.get<Array<{ txn_id: number; transaction_id: string; amount: number; type: string; bank: string }>>(
      `/cases/${caseId}/transactions`,
    ),
  getCandidates: (caseId: string | number) =>
    api.get<{ case_id: number; candidates: Array<{ atm_id: number; atm_code: string; lat: number; lon: number; state: string }> }>(
      `/cases/${caseId}/candidates`,
    ),
  getExplanations: (caseId: string | number) =>
    api.get<ExplanationResponse>(`/cases/${caseId}/explanations`),
  getTimeline: (caseId: string | number) =>
    api.get<{ case_id: number; events: TimelineItem[] }>(`/cases/${caseId}/timeline`),
  getTrail: (caseId: string | number) =>
    api.get<TrailResponse>(`/cases/${caseId}/trail`),
  getSimilarCases: (caseId: string | number, limit = 5) =>
    api.get<SimilarCase[]>(`/cases/${caseId}/similar-cases?limit=${limit}`),
};
