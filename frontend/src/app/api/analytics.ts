import { api } from './client';

export interface VelocityBucket {
  t: string;
  complaints: number;
  predictions: number;
}

export interface VelocityResponse {
  hours: number;
  buckets: VelocityBucket[];
}

export interface HorizonMetrics {
  minutes: number;
  test_roc_auc: number;
  test_top5_recall: number;
  test_top1_recall: number;
  positives: number;
}

export interface ModelMetrics {
  model_name: string;
  model_version: string;
  trained_at: string;
  horizon_minutes: number;
  horizons: Record<string, HorizonMetrics>;
  test_roc_auc: number;
  test_top5_recall: number;
  test_top1_recall: number;
  time_mae_min: number;
}

export const analyticsApi = {
  /** Observed hourly throughput (complaints in, predictions out). */
  getVelocity: (hours = 24) =>
    api.get<VelocityResponse>(`/activity/velocity?hours=${hours}`),
  /** Held-out evaluation of the deployed model (training meta.json). */
  getModelMetrics: () => api.get<ModelMetrics>('/model/metrics'),
};
