/**
 * Geospatial risk layer.
 *
 * The backend aggregates predictions into H3 cells but returns no geometry —
 * only the cell index, a score, a risk level and a case count. The polygon has
 * to be derived here, which is the one piece of client-side geometry in the
 * console. Two key shapes come back from the aggregation:
 *
 *   "8a2a1072b59ffff"      a real H3 index      -> cell boundary polygon
 *   "28.61,77.20"          an ATM with no cell  -> the terminal's own point
 *   "unknown"              no ATM resolved      -> dropped
 *
 * The second is drawn as a point rather than a fabricated buffer, so what the
 * map shows is always either a real cell boundary or a real coordinate.
 */

import { cellToBoundary, isValidCell } from "h3-js";
import type * as GeoJSON from "geojson";
import { api, query } from "./client";
import type { RiskLevel } from "../components/ui/RiskBadge";

export interface HotspotCell {
  h3_cell: string;
  risk_score: number;
  risk_level: RiskLevel;
  active_cases: number;
  state: string;
}

export interface HotspotsResponse {
  cells: HotspotCell[];
  count: number;
}

/** Only the parameters the endpoint actually accepts. */
export interface HotspotFilters {
  hoursBack?: number;
  state?: string;
  risk?: string;
  minScore?: number;
  limit?: number;
}

export const heatmapApi = {
  getHotspots: (filters: HotspotFilters = {}) =>
    api.get<HotspotsResponse>(
      `/risk/hotspots${query({
        hours_back: filters.hoursBack,
        state: filters.state && filters.state !== "ALL" ? filters.state : undefined,
        risk: filters.risk && filters.risk !== "ALL" ? filters.risk : undefined,
        min_score: filters.minScore,
        limit: filters.limit,
      })}`,
    ),
};

export const EMPTY_COLLECTION: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

export interface HotspotLayers {
  /** H3 cell boundaries, as filled polygons. */
  polygons: GeoJSON.FeatureCollection;
  /** Terminals the backend could only resolve to a coordinate. */
  points: GeoJSON.FeatureCollection;
  /** Cells dropped because their key was not usable geometry. */
  skipped: number;
}

const COORD_PAIR = /^(-?\d+(\.\d+)?),\s*(-?\d+(\.\d+)?)$/;

function cellFeature(cell: HotspotCell): GeoJSON.Feature | null {
  if (!isValidCell(cell.h3_cell)) return null;

  // h3-js returns [lat, lng]; GeoJSON is [lng, lat].
  const ring = cellToBoundary(cell.h3_cell).map(
    ([lat, lng]) => [lng, lat] as [number, number],
  );
  const first = ring[0];
  if (!first) return null;

  return {
    type: "Feature",
    id: cell.h3_cell,
    properties: {
      h3_cell: cell.h3_cell,
      risk_score: cell.risk_score,
      risk_level: cell.risk_level,
      active_cases: cell.active_cases,
      state: cell.state,
    },
    geometry: { type: "Polygon", coordinates: [[...ring, first]] },
  };
}

function pointFeature(cell: HotspotCell, lat: number, lon: number): GeoJSON.Feature {
  return {
    type: "Feature",
    id: `${lat},${lon}`,
    properties: {
      h3_cell: cell.h3_cell,
      risk_score: cell.risk_score,
      risk_level: cell.risk_level,
      active_cases: cell.active_cases,
      state: cell.state,
    },
    geometry: { type: "Point", coordinates: [lon, lat] },
  };
}

export function toHotspotLayers(cells: HotspotCell[]): HotspotLayers {
  const polygons: GeoJSON.Feature[] = [];
  const points: GeoJSON.Feature[] = [];
  let skipped = 0;

  for (const cell of cells) {
    const polygon = cellFeature(cell);
    if (polygon) {
      polygons.push(polygon);
      continue;
    }

    const match = COORD_PAIR.exec(cell.h3_cell);
    if (match) {
      points.push(pointFeature(cell, Number(match[1]), Number(match[3])));
      continue;
    }

    // "unknown", blank, or an index the H3 library rejects.
    skipped += 1;
  }

  return {
    polygons: { type: "FeatureCollection", features: polygons },
    points: { type: "FeatureCollection", features: points },
    skipped,
  };
}
