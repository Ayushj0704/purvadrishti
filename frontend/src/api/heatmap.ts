import { api } from './client';

export interface HeatmapResponse {
  // GeoJSON feature collection of H3 cells with risk scores
  type: 'FeatureCollection';
  features: any[];
}

export const heatmapApi = {
  getHeatmap: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return api.get<HeatmapResponse>(`/heatmap${qs}`);
  }
};
