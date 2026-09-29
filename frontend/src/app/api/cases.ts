/**
 * Case lifecycle: complaint intake, the investigator's read models, and the one
 * action that scores a case.
 *
 * Shapes here mirror the backend's serialised responses exactly. Where a field
 * can legitimately be null the type says so, rather than the UI being handed a
 * value it has to guess at.
 */

import { api, query } from "./client";
import type { RiskLevel } from "../components/ui/RiskBadge";

/** Row shape of GET /api/v1/cases. */
export interface CaseSummary {
  case_id: number;
  external_case_id: string;
  fraud_type: string;
  amount: number;
  status: string;
}

/** GET /api/v1/cases/{case_id}. Coordinates are null when never recorded. */
export interface CaseRecord extends CaseSummary {
  victim_location: { lat: number | null; lon: number | null };
}

export interface CreatedCase {
  case_id: number;
  external_case_id: string;
  request_id: string;
}

export interface IngestedCase {
  case_id: number;
  external_case_id: string;
  /** True when the acknowledgement ID was already on file — ingest is idempotent. */
  deduped: boolean;
}

/** Complaint intake. Every field is optional but the ones the model leans on. */
export interface CaseIntake {
  fraud_type?: string;
  crime_subcategory?: string | null;
  amount?: number;
  victim_location?: { lat: number; lon: number } | null;
  external_case_id?: string | null;
  incident_datetime?: string | null;
  incident_details?: string;
  complainant_state?: string;
  complainant_district?: string;
  incident_state?: string;
  incident_district?: string;
  bank_name?: string;
  transaction_id?: string | null;
  destination_bank?: string;
  destination_account_ref?: string | null;
  merchant?: string | null;
  gateway?: string | null;
  suspect_mobile?: string | null;
  suspect_email?: string | null;
  suspect_account_ref?: string | null;
  suspect_address?: string | null;
  suspect_url?: string | null;
}

export interface SampleCase {
  case_id: number;
  external_case_id: string;
  subcategory: string | null;
  amount: number | null;
  incident_state: string | null;
  complainant_state: string | null;
  source: string;
}

export interface Candidate {
  atm_id: number;
  atm_code: string;
  lat: number;
  lon: number;
  state: string;
}

export interface CandidatesResponse {
  case_id: number;
  candidates: Candidate[];
}

/** Burst observation window counts attached to a candidate. */
export interface HeatReading {
  n2h: number;
  n6h: number;
  level: string;
}

/** One ranked candidate. `score` is the model probability at the horizon. */
export interface PredictionCandidate {
  atm_id: string;
  lat: number;
  lon: number;
  score: number;
  risk_level: RiskLevel;
  /** Per-horizon probabilities, keyed by horizon in minutes. */
  scores: Record<string, number>;
  /** Human-readable window label, e.g. "next 60 min". */
  predicted_window: string;
  /** Clock bounds in UTC, or null when the model makes no claim. */
  expected_between: [string, string] | null;
  expected_min: number | null;
  basis: string;
  heat: HeatReading;
  best_bet: boolean;
  h3_cell: string;
  top_reasons: string[];
}

/** Burst-hot ATMs regardless of case rank — patrol-relevant on their own. */
export interface HeatWatchEntry {
  atm_id: string;
  lat: number;
  lon: number;
  score: number;
  n2h: number;
  n6h: number;
  h3_cell: string;
}

export interface PredictionResponse {
  /** The case's external ID, not its internal numeric one. */
  case_id: string;
  generated_at: string;
  horizon_minutes: number;
  model_version: string;
  basis_note: string;
  ranking_note: string;
  heat_watch: HeatWatchEntry[];
  predictions: PredictionCandidate[];
}

export interface CaseTransaction {
  txn_id: number;
  transaction_id: string;
  amount: number;
  type: string;
  bank: string;
}

export interface TransactionIntake {
  transaction_id?: string;
  amount?: number;
  source_account_ref?: string;
  destination_account_ref?: string;
  transaction_type?: string;
  bank?: string;
  lat?: number | null;
  lon?: number | null;
}

export interface TimelineEntry {
  t: string;
  /** complaint · transaction · withdrawal · prediction · alert */
  kind: string;
  text: string;
}

export interface TimelineResponse {
  case_id: number;
  events: TimelineEntry[];
}

export interface Explanation {
  case_id: number;
  atm_id: string | null;
  score: number;
  risk_level: RiskLevel;
  model_version: string;
  /** Feature name to value, for the top-scoring prediction only. */
  features: Record<string, number>;
}

export interface SimilarCase {
  case_id: number;
  external_case_id: string;
  subcategory: string | null;
  amount: number | null;
  incident_state: string | null;
  reported_at: string | null;
}

export interface CaseReport {
  case_id: number;
  banner: string;
  title: string;
  summary: string;
  /** Draft lines, one per ranked candidate. */
  predictions: string[];
  note: string;
}

export interface TrailNode {
  id: string;
  kind: "victim" | "mule" | "atm";
  label: string;
  amount?: number | null;
  score?: number;
  risk?: RiskLevel;
  lat?: number | null;
  lon?: number | null;
}

/** The backend names the endpoints of an edge `from` and `to`. */
export interface TrailEdge {
  from: string;
  to: string;
  amount: number | null;
  type?: string;
}

export interface TrailResponse {
  case_id: number;
  nodes: TrailNode[];
  edges: TrailEdge[];
  depth: number | null;
}

export interface PredictionRequest {
  horizon_minutes?: number;
  ref_lat?: number;
  ref_lon?: number;
}

export const casesApi = {
  createCase: (body: CaseIntake) => api.post<CreatedCase>("/cases", body),

  /** Portal push. Idempotent on `external_case_id`; requires an LEA role. */
  ingestCase: (body: CaseIntake & { external_case_id: string; source_system?: string }) =>
    api.post<IngestedCase>("/cases/ingest", body),

  listCases: () => api.get<CaseSummary[]>("/cases"),

  getSamples: (params?: { limit?: number; state?: string }) =>
    api.get<SampleCase[]>(`/cases/samples${query({ limit: params?.limit, state: params?.state })}`),

  getCase: (caseId: number) => api.get<CaseRecord>(`/cases/${caseId}`),

  getCandidates: (caseId: number) =>
    api.get<CandidatesResponse>(`/cases/${caseId}/candidates`),

  /**
   * Scores a case and returns the ranked candidates. This writes prediction
   * rows and may fire an alert, so it is only ever called from an explicit
   * action — never on page load.
   */
  runPrediction: (caseId: number, body: PredictionRequest = {}) =>
    api.post<PredictionResponse>(`/cases/${caseId}/predictions`, body),

  listTransactions: (caseId: number) =>
    api.get<CaseTransaction[]>(`/cases/${caseId}/transactions`),

  addTransaction: (caseId: number, body: TransactionIntake) =>
    api.post<{ ok: boolean; txn_id: number }>(`/cases/${caseId}/transactions`, body),

  getTimeline: (caseId: number) => api.get<TimelineResponse>(`/cases/${caseId}/timeline`),

  /** 404 until the case has a prediction — the top candidate is the subject. */
  getExplanation: (caseId: number) => api.get<Explanation>(`/cases/${caseId}/explanations`),

  getSimilarCases: (caseId: number, limit = 5) =>
    api.get<SimilarCase[]>(`/cases/${caseId}/similar-cases${query({ limit })}`),

  getReport: (caseId: number) => api.post<CaseReport>(`/cases/${caseId}/report`),

  /** Optional: the graph endpoint depends on networkx, which may be absent. */
  getTrail: (caseId: number) => api.get<TrailResponse>(`/cases/${caseId}/trail`),
};
