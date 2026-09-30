import { api } from './client';
import type * as GeoJSON from 'geojson';

/** Raw cell shape from GET /risk/hotspots (geometry included by the backend). */
export interface HotspotCell {
  h3_cell: string;
  risk_score: number;
  risk_level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  active_cases: number;
  state: string;
  lat: number | null;
  lon: number | null;
  /** H3 boundary ring as [lat, lon] pairs (empty when degraded to a point). */
  boundary: Array<[number, number]>;
}

export interface HotspotResponse {
  cells: HotspotCell[];
  count: number;
}

export interface HeatmapParams {
  state?: string;
  risk?: string;
  min_score?: number;
  limit?: number;
  category?: string;
  hours_back?: number;
}

export interface HeatmapResponse {
  // GeoJSON feature collection of H3 cells with risk scores
  type: 'FeatureCollection';
  features: GeoJSON.Feature<GeoJSON.Geometry>[];
}

/**
 * GeoJSON adapter: converts the backend's { cells, count } payload into a
 * FeatureCollection the map can render. H3 boundaries become real Polygon
 * features (ring closed, [lng, lat] order); cells without a boundary degrade
 * to Point features at their centroid so no signal is dropped.
 */
export function hotspotsToGeoJSON(data: HotspotResponse): HeatmapResponse {
  const features: GeoJSON.Feature<GeoJSON.Geometry>[] = [];
  for (const cell of data.cells ?? []) {
    const properties = {
      risk_score: cell.risk_score,
      risk_level: cell.risk_level,
      active_cases: cell.active_cases,
      state: cell.state,
      h3_cell: cell.h3_cell,
    };
    if (cell.boundary && cell.boundary.length >= 3) {
      const ring = cell.boundary.map(([la, lo]) => [lo, la]);
      ring.push(ring[0]);
      features.push({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [ring] },
        properties,
      });
    } else if (cell.lat != null && cell.lon != null) {
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [cell.lon, cell.lat] },
        properties,
      });
    }
  }
  return { type: 'FeatureCollection', features };
}

export const heatmapApi = {
  getHotspots: (params?: HeatmapParams) => {
    const qs = new URLSearchParams();
    if (params?.state) qs.set('state', params.state);
    if (params?.risk) qs.set('risk', params.risk);
    if (params?.min_score != null) qs.set('min_score', String(params.min_score));
    if (params?.limit != null) qs.set('limit', String(params.limit));
    if (params?.category) qs.set('category', params.category);
    if (params?.hours_back != null) qs.set('hours_back', String(params.hours_back));
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return api.get<HotspotResponse>(`/risk/hotspots${suffix}`);
  },
  /** Fetches /risk/hotspots and adapts it for the RiskMap layer. */
  getHeatmap: async (params?: HeatmapParams): Promise<HeatmapResponse> => {
    const qs = new URLSearchParams();
    if (params?.state) qs.set('state', params.state);
    if (params?.risk) qs.set('risk', params.risk);
    if (params?.min_score != null) qs.set('min_score', String(params.min_score));
    if (params?.limit != null) qs.set('limit', String(params.limit));
    if (params?.category) qs.set('category', params.category);
    if (params?.hours_back != null) qs.set('hours_back', String(params.hours_back));
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    const data = await api.get<HotspotResponse>(`/risk/hotspots${suffix}`);
    return hotspotsToGeoJSON(data);
  },
};
