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
  heatmapData?: GeoJSON.FeatureCollection;
  candidateAtms?: GeoJSON.FeatureCollection;
  viewState?: { longitude: number; latitude: number; zoom: number };
  onMove?: (evt: unknown) => void;
}

const DEFAULT_VIEW_STATE = { longitude: 78.9629, latitude: 22.5937, zoom: 4.2 };

export function RiskMap({ heatmapData, candidateAtms, viewState, onMove }: RiskMapProps) {
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
    <div className="relative h-full w-full bg-abyss">
      <Map
        {...(viewState || DEFAULT_VIEW_STATE)}
        onMove={onMove}
        mapStyle={mapStyle}
        style={{ width: "100%", height: "100%" }}
        attributionControl={false}
      >
        <NavigationControl position="top-right" showCompass={false} />
        <ScaleControl position="bottom-left" unit="metric" />

        {heatmapData && (
          <Source id="h3-cells" type="geojson" data={heatmapData}>
            <Layer {...h3LayerStyle} />
          </Source>
        )}

        {candidateAtms && (
          <Source id="candidate-atms" type="geojson" data={candidateAtms}>
            <Layer {...candidateAtmLayer} />
          </Source>
        )}
      </Map>

      <div className="pointer-events-none absolute bottom-3 right-3 flex flex-col items-end gap-1">
        <div className="flex items-center gap-2 border border-hairline bg-void/85 px-2.5 py-1.5 backdrop-blur">
          <span className="micro text-faint">Legend</span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 bg-critical" />
            <span className="micro text-faint">High</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 bg-elevated-risk" />
            <span className="micro text-faint">Med</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 bg-stable" />
            <span className="micro text-faint">Low</span>
          </span>
        </div>
      </div>
    </div>
  );
}
