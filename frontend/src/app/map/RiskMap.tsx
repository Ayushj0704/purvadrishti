import { useMemo } from "react";
import { setWorkerUrl } from "maplibre-gl";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import Map, { Source, Layer, NavigationControl, ScaleControl } from "react-map-gl/maplibre";
import type * as GeoJSON from "geojson";
import "maplibre-gl/dist/maplibre-gl.css";
import { h3LayerStyle } from "./h3Layer";
import { candidateAtmLayer } from "./markers";

// maplibre resolves its worker relative to its own chunk, which does not
// survive bundling. Point it at the Vite-emitted worker instead.
setWorkerUrl(maplibreWorkerUrl);

interface RiskMapProps {
  /** H3 cell boundaries derived from the hotspot index. */
  polygons?: GeoJSON.FeatureCollection;
  /** Terminals the backend resolved only to a coordinate, not a cell. */
  points?: GeoJSON.FeatureCollection;
  /** Starting camera. The map owns the view from then on, so the user can pan and zoom. */
  initialViewState?: { longitude: number; latitude: number; zoom: number };
  onMove?: (evt: unknown) => void;
  isLoading?: boolean;
}

// Centred on India, framed so the whole country fits the panel at 4.
const DEFAULT_VIEW_STATE = { longitude: 78.9629, latitude: 22.5937, zoom: 4.2 };
// Cells are H3 resolution 8, so anything past ~14 is empty zoom. The floor stops
// the user pulling back to a world view where the landmass is a few pixels.
const MIN_ZOOM = 3.2;
const MAX_ZOOM = 14;

export function RiskMap({ polygons, points, initialViewState, onMove, isLoading }: RiskMapProps) {
  // Grayscale raster basemap keeps the risk layers as the only colour on the map.
  const mapStyle = useMemo(
    () => ({
      version: 8 as const,
      sources: {
        "osm-tiles": {
          type: "raster" as const,
          tiles: [
            "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
            "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
            "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
          ],
          tileSize: 256,
          attribution: "© OpenStreetMap",
        },
      },
      layers: [
        {
          id: "desaturate",
          type: "raster" as const,
          source: "osm-tiles",
          paint: { "raster-saturation": -1, "raster-contrast": 0.15, "raster-brightness-max": 0.62 },
        },
      ],
    }),
    [],
  );

  return (
    <div data-lenis-prevent className="relative h-full w-full bg-abyss">
      <Map
        // initialViewState, not a spread of longitude/latitude/zoom. A top-level
        // camera prop is a CONTROLLED view in react-map-gl v8: it is reapplied on
        // every render, so the map snapped back to its opening camera and panning
        // or zooming appeared to do nothing.
        initialViewState={initialViewState ?? DEFAULT_VIEW_STATE}
        onMove={onMove}
        mapStyle={mapStyle}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        style={{ width: "100%", height: "100%" }}
        attributionControl={false}
      >
        <NavigationControl position="top-right" showCompass={false} />
        <ScaleControl position="bottom-left" unit="metric" />

        {polygons && polygons.features.length > 0 && (
          <Source id="h3-cells" type="geojson" data={polygons}>
            <Layer {...h3LayerStyle} />
          </Source>
        )}

        {points && points.features.length > 0 && (
          <Source id="candidate-atms" type="geojson" data={points}>
            <Layer {...candidateAtmLayer} />
          </Source>
        )}
      </Map>

      {isLoading && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-void/40 backdrop-blur-[1px]">
          <span className="label-caps text-muted">Loading risk layer</span>
        </div>
      )}

      {polygons && polygons.features.length === 0 && points && points.features.length === 0 && !isLoading && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <p className="label-caps text-faint">No cells to plot for these filters</p>
        </div>
      )}

      <div className="pointer-events-none absolute bottom-3 right-3 flex flex-col items-end gap-1">
        <div className="flex items-center gap-2 rounded-lg border border-hairline bg-surface/90 px-2.5 py-1.5 backdrop-blur">
          <span className="micro text-faint">Legend</span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-critical" />
            <span className="micro text-faint">High</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-elevated-risk" />
            <span className="micro text-faint">Med</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-stable" />
            <span className="micro text-faint">Low</span>
          </span>
        </div>
      </div>
    </div>
  );
}
