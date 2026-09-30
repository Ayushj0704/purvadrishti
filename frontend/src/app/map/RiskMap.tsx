import { useCallback, useEffect, useMemo, useState } from "react";
import { setWorkerUrl } from "maplibre-gl";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import Map, { Source, Layer, NavigationControl, Popup, ScaleControl, useMap } from "react-map-gl/maplibre";
import type { MapLayerMouseEvent } from "react-map-gl/maplibre";
import type * as GeoJSON from "geojson";
import "maplibre-gl/dist/maplibre-gl.css";
import { h3LayerStyle } from "./h3Layer";
import {
  candidateAtmLayer,
  burstAtmLayer,
  bestBetRingLayer,
  bestBetHaloLayer,
  victimLayer,
  muleLayer,
} from "./markers";
import { formatDistance, haversineKm, locateDevice } from "../lib/geo";
import { formatRiskScore } from "../lib/format";

// maplibre resolves its worker relative to its own chunk, which does not
// survive bundling. Point it at the Vite-emitted worker instead.
setWorkerUrl(maplibreWorkerUrl);

const CLICK_LAYERS = [
  "candidate-atm-layer",
  "burst-atm-layer",
  "best-bet-ring-layer",
  "best-bet-halo-layer",
  "entities-victim-layer",
  "entities-mule-layer",
];

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

interface SelectedPin {
  lng: number;
  lat: number;
  props: Record<string, unknown>;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function AtmPopup({ pin }: { pin: SelectedPin }) {
  const p = pin.props;
  const plat = num(p.lat) ?? pin.lat;
  const plon = num(p.lon) ?? pin.lng;
  const [distance, setDistance] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState("");

  const measure = useCallback(async () => {
    setLocating(true);
    setLocError("");
    try {
      const me = await locateDevice();
      setDistance(formatDistance(haversineKm(me.lat, me.lon, plat, plon)));
    } catch (err) {
      setLocError(err instanceof Error ? err.message : "Location unavailable.");
    } finally {
      setLocating(false);
    }
  }, [plat, plon]);

  const place = [str(p.city), str(p.district), str(p.state)].filter(Boolean).join(" · ");
  const score = num(p.risk_score);

  return (
    <div className="w-60 p-4">
      <p className="label-caps text-accent">{str(p.best_bet) === "true" || p.best_bet === true ? "Best bet" : "Terminal"}</p>
      <p className="telemetry mt-1.5 text-ink">{str(p.atm_id) || "ATM"}</p>
      {place && <p className="mt-1 text-xs text-muted">{place}</p>}
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        <div>
          <dt className="label-caps text-faint">Latitude</dt>
          <dd className="telemetry text-ink">{plon != null && plat != null ? plat.toFixed(4) : "—"}</dd>
        </div>
        <div>
          <dt className="label-caps text-faint">Longitude</dt>
          <dd className="telemetry text-ink">{plon != null && plat != null ? plon.toFixed(4) : "—"}</dd>
        </div>
        <div>
          <dt className="label-caps text-faint">Risk</dt>
          <dd className="telemetry text-ink">
            {str(p.risk_level) || "—"} · {score != null ? formatRiskScore(score) : "—"}
          </dd>
        </div>
        <div>
          <dt className="label-caps text-faint">Expected</dt>
          <dd className="telemetry text-ink">{str(p.expected) || "—"}</dd>
        </div>
      </dl>
      <div className="mt-3 border-t border-hairline pt-3">
        {distance ? (
          <p className="telemetry text-ink">
            ≈ {distance} <span className="text-faint">from your location</span>
          </p>
        ) : (
          <button
            type="button"
            onClick={measure}
            disabled={locating}
            className="label-caps text-accent transition-opacity hover:opacity-80 disabled:opacity-40"
          >
            {locating ? "Locating…" : "Measure distance from me"}
          </button>
        )}
        {locError && <p className="mt-1.5 text-[0.6875rem] text-critical">{locError}</p>}
      </div>
    </div>
  );
}

function EntityPopup({ pin }: { pin: SelectedPin }) {
  const p = pin.props;
  const kind = str(p.kind) === "victim" ? "Victim origin" : "Mule hop";
  const amount = num(p.amount);
  return (
    <div className="w-56 p-4">
      <p className="label-caps text-accent">{kind}</p>
      <p className="telemetry mt-1.5 text-ink">{str(p.label) || "Account"}</p>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        <div>
          <dt className="label-caps text-faint">Latitude</dt>
          <dd className="telemetry text-ink">{pin.lat.toFixed(4)}</dd>
        </div>
        <div>
          <dt className="label-caps text-faint">Longitude</dt>
          <dd className="telemetry text-ink">{pin.lng.toFixed(4)}</dd>
        </div>
        {amount != null && (
          <div className="col-span-2">
            <dt className="label-caps text-faint">Value moved</dt>
            <dd className="telemetry text-ink">₹{amount.toLocaleString("en-IN")}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}

interface RiskMapProps {
  heatmapData?: GeoJSON.FeatureCollection;
  candidateAtms?: GeoJSON.FeatureCollection;
  entities?: GeoJSON.FeatureCollection;
  viewState?: { longitude: number; latitude: number; zoom: number };
  onMove?: (evt: unknown) => void;
}

const DEFAULT_VIEW_STATE = { longitude: 78.9629, latitude: 22.5937, zoom: 4.2 };

export function RiskMap({ heatmapData, candidateAtms, entities, viewState, onMove }: RiskMapProps) {
  // Full-colour OpenStreetMap raster basemap.
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
          id: "osm",
          type: "raster" as const,
          source: "osm-tiles",
        },
      ],
    }),
    [],
  );

  const [selected, setSelected] = useState<SelectedPin | null>(null);

  const handleClick = useCallback((evt: MapLayerMouseEvent) => {
    const f = evt.features?.[0];
    if (!f || f.geometry.type !== "Point") {
      setSelected(null);
      return;
    }
    const [lng, lat] = f.geometry.coordinates as [number, number];
    setSelected({ lng, lat, props: (f.properties ?? {}) as Record<string, unknown> });
  }, []);

  const hasMarkers =
    (candidateAtms?.features.length ?? 0) > 0 || (entities?.features.length ?? 0) > 0;
  const isAtmPin = selected && !("kind" in selected.props);

  return (
    <div data-lenis-prevent className="relative h-full w-full bg-abyss">
      {/* initialViewState (not spread longitude/latitude/zoom): spreading pins
          the map as a controlled component, and without an onMove handler every
          drag and zoom snaps back — the map looks frozen. */}
      <Map
        initialViewState={viewState || DEFAULT_VIEW_STATE}
        onMove={onMove}
        onClick={handleClick}
        interactiveLayerIds={CLICK_LAYERS}
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

        {entities && entities.features.length > 0 && (
          <Source id="trail-entities" type="geojson" data={entities}>
            <Layer {...muleLayer} />
            <Layer {...victimLayer} />
          </Source>
        )}

        {selected && (
          <Popup
            longitude={selected.lng}
            latitude={selected.lat}
            anchor="top"
            closeOnClick={false}
            onClose={() => setSelected(null)}
            className="risk-popup"
            maxWidth="300px"
          >
            {isAtmPin ? <AtmPopup pin={selected} /> : <EntityPopup pin={selected} />}
          </Popup>
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
          {hasMarkers && (
            <>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full border-2 border-accent" />
                <span className="micro text-faint">Best bet</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-elevated-risk" />
                <span className="micro text-faint">Burst</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ background: "#f4f4f5" }} />
                <span className="micro text-faint">Victim</span>
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
