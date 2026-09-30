import { useEffect, useMemo } from "react";
import { setWorkerUrl } from "maplibre-gl";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import Map, { Source, Layer, NavigationControl, ScaleControl, useMap } from "react-map-gl/maplibre";
import type * as GeoJSON from "geojson";
import "maplibre-gl/dist/maplibre-gl.css";
import { h3LayerStyle } from "./h3Layer";
import { candidateAtmLayer, burstAtmLayer, bestBetRingLayer, bestBetHaloLayer } from "./markers";

// maplibre resolves its worker relative to its own chunk, which does not
// survive bundling. Point it at the Vite-emitted worker instead.
setWorkerUrl(maplibreWorkerUrl);

/** Radar pulse on the lead-hypothesis halo: expands and fades in a loop by
 *  driving the halo layer's paint properties directly (MapLibre has no CSS
 *  keyframes for layers). No-ops until the layer exists. */
function HaloAnimator() {
  const { current: mapRef } = useMap();
  useEffect(() => {
    const frames = 40;
    let frame = 0;
    const timer = window.setInterval(() => {
      frame = (frame + 1) % frames;
      const t = frame / frames;
      try {
        const map = mapRef?.getMap();
        if (!map || typeof map.getLayer !== "function" || !map.getLayer("best-bet-halo-layer")) return;
        map.setPaintProperty("best-bet-halo-layer", "circle-radius", 10 + t * 18);
        map.setPaintProperty("best-bet-halo-layer", "circle-opacity", 0.35 * (1 - t));
      } catch {
        /* style mid-swap — next tick retries */
      }
    }, 70);
    return () => window.clearInterval(timer);
  }, [mapRef]);
  return null;
}

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
    <div data-lenis-prevent className="relative h-full w-full bg-abyss">
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
            <Layer {...burstAtmLayer} />
            <Layer {...bestBetHaloLayer} />
            <Layer {...bestBetRingLayer} />
          </Source>
        )}
        <HaloAnimator />
      </Map>

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
          {candidateAtms && candidateAtms.features.length > 0 && (
            <>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full border-2 border-accent" />
                <span className="micro text-faint">Best bet</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-elevated-risk" />
                <span className="micro text-faint">Burst</span>
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
