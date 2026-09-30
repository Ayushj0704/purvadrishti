import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type * as GeoJSON from "geojson";
import { FilterBar } from "../components/FilterBar";
import type { FilterState } from "../components/FilterBar";
import { RiskMap } from "../map/RiskMap";
import { TopKTable } from "../components/TopKTable";
import { AlertRow } from "../components/AlertRow";
import { PageHeader } from "../components/ui/PageHeader";
import { HowItHelps } from "../components/HowItHelps";
import { SectionHeader } from "../components/ui/Eyebrow";
import { Panel, PanelHeader } from "../components/ui/Panel";
import { Reveal } from "../components/ui/Reveal";
import { Loader } from "../components/ui/Loader";
import { StatusPill } from "../components/ui/StatusDot";
import { heatmapApi, alertsApi, casesApi, toTopKRows, toAtmPoints, trailToEntities, expectedLabel, HORIZON_OPTIONS } from "../api";
import { canWrite, useRole } from "../lib/useRole";
import type { HeatmapParams } from "../api/heatmap";
import type { PredictionCandidate } from "../api/cases";
import type { Alert } from "../api/alerts";
import { StatusStrip } from "../components/layout/StatusStrip";
import { formatTime } from "../lib/format";

const TIME_WINDOW_HOURS: Record<string, number> = {
  "1h": 1,
  "24h": 24,
  "7d": 168,
  "30d": 720,
};

/** Maps the query-parameter bar onto GET /risk/hotspots arguments. */
function filtersToHeatmapParams(filters: FilterState | null): HeatmapParams {
  if (!filters) return { limit: 200 };
  const params: HeatmapParams = { limit: 200 };
  if (filters.state !== "ALL") params.state = filters.state;
  if (filters.riskLevel !== "ALL") params.risk = filters.riskLevel;
  if (filters.crimeType !== "ALL") params.category = filters.crimeType;
  const hours = TIME_WINDOW_HOURS[filters.timeWindow];
  if (hours) params.hours_back = hours;
  return params;
}

export function Dashboard() {
  const role = useRole();
  const writable = canWrite(role);
  const [filters, setFilters] = useState<FilterState | null>(null);
  const [heatmapData, setHeatmapData] = useState<GeoJSON.FeatureCollection | undefined>();
  const [entities, setEntities] = useState<GeoJSON.FeatureCollection | undefined>();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [predictions, setPredictions] = useState<PredictionCandidate[]>([]);
  const [horizon, setHorizon] = useState(60);
  const [rankingNote, setRankingNote] = useState("");
  const [topCaseId, setTopCaseId] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [booted, setBooted] = useState(false);
  const bootedRef = useRef(false);
  const [loadErrors, setLoadErrors] = useState<string[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [minRisk, setMinRisk] = useState("ALL");
  const [syncedAt, setSyncedAt] = useState(() => new Date());

  const handleFilterChange = useCallback((next: FilterState) => {
    setFilters(next);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      // First load blanks to the radar loader; later refreshes (filters,
      // horizon, retry) keep stale data on screen with an updating note —
      // never a flash of empty boxes.
      const first = !bootedRef.current;
      if (first) setIsLoading(true);
      const failed: string[] = [];

      // National risk layer — real H3 cells from the model.
      try {
        setHeatmapData(await heatmapApi.getHeatmap(filtersToHeatmapParams(filters)));
      } catch {
        failed.push("heatmap");
        if (!cancelled) setHeatmapData(undefined);
      }

      // Live alert queue.
      try {
        const list = await alertsApi.getAlerts();
        if (!cancelled) setAlerts(list.slice(0, 5));
      } catch {
        failed.push("alerts");
        if (!cancelled) setAlerts([]);
      }

      // Ranked candidates: score the newest sampled case through the model.
      // Writes require LEA Officer or above — bank analysts see heat + alerts.
      if (!writable) {
        setPredictions([]);
        setRankingNote("");
        setTopCaseId(undefined);
      } else {
        try {
          const samples = await casesApi.sampleCases(1);
          if (samples.length > 0 && !cancelled) {
            const sample = samples[0];
            const [result, tr] = await Promise.all([
              casesApi.predict(sample.case_id, { horizon_minutes: horizon }),
              casesApi.getTrail(sample.case_id).catch(() => null),
            ]);
            if (!cancelled) {
              const heatByAtm = new Map(
                (result.heat_watch ?? []).map((w) => [w.atm_id, "HIGH"]),
              );
              const rows = toTopKRows(result.predictions);
              for (const r of rows) r.heat_level = heatByAtm.get(r.atm_id) ?? "LOW";
              setPredictions(rows);
              setRankingNote(result.ranking_note ?? "");
              setTopCaseId(String(sample.case_id));
              setEntities(trailToEntities(tr));
            }
          } else if (!cancelled) {
            setPredictions([]);
            setRankingNote("");
            setTopCaseId(undefined);
            setEntities(undefined);
          }
        } catch {
          failed.push("predictions");
          if (!cancelled) {
            setPredictions([]);
            setRankingNote("");
            setTopCaseId(undefined);
            setEntities(undefined);
          }
        }
      }

      if (!cancelled) {
        setLoadErrors(failed);
        setSyncedAt(new Date());
        setIsLoading(false);
        bootedRef.current = true;
        setBooted(true);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [filters, reloadKey, writable, horizon]);

  const candidateAtms = useMemo(() => toAtmPoints(predictions), [predictions]);

  const RISK_RANK: Record<string, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };
  const visibleAtms = useMemo(() => {
    if (minRisk === "ALL" || !candidateAtms) return candidateAtms;
    const floor = RISK_RANK[minRisk] ?? 0;
    return {
      ...candidateAtms,
      features: candidateAtms.features.filter(
        (f) => (RISK_RANK[String(f.properties?.risk_level)] ?? 0) >= floor,
      ),
    };
  }, [candidateAtms, minRisk]);

  const refreshing = isLoading && booted;
  const best = predictions.find((p) => p.best_bet) ?? predictions[0];

  return (
    <div className="flex flex-col gap-20">
      <PageHeader
        title={
          <>
            Predictive
            <br />
            cash-out <span className="text-accent">intelligence.</span>
          </>
        }
        lede="Live ranking of probable ATM withdrawal locations and predicted windows, derived from complaint trails and scored across every candidate inside the search radius."
        leadClassName="lg:pl-10 xl:pl-16"
        titleClassName="text-[clamp(3.25rem,8.5vw,7.5rem)]"
        aside={
          <div className="flex flex-wrap items-center gap-3">
            <StatusPill tone={isLoading ? "accent" : "stable"} pulse={!isLoading}>
              {isLoading ? "Syncing" : "Pipeline live"}
            </StatusPill>
            <span className="telemetry text-faint">Synced {formatTime(syncedAt)}</span>
          </div>
        }
        figure={
          <HowItHelps
            bestAtm={best?.atm_id}
            bestScore={best?.risk_score}
            expected={best ? expectedLabel(best) : undefined}
            candidates={predictions.length || undefined}
            caseId={topCaseId}
          />
        }
      />

      <Reveal>
        <StatusStrip className="-mx-5 sm:-mx-8" />
      </Reveal>

      {!isLoading && loadErrors.length > 0 && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-critical/50 bg-critical/10 px-5 py-3.5"
        >
          <p className="text-xs text-critical">
            Live data unavailable for: {loadErrors.join(", ")}. Showing partial state.
          </p>
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            className="label-caps rounded-md border border-critical/50 px-3 py-2 text-critical transition-colors hover:bg-critical/20"
          >
            Retry
          </button>
        </div>
      )}

      <Reveal>
        <FilterBar onFilterChange={handleFilterChange} />
      </Reveal>

      <section className="flex flex-col gap-8">
        <SectionHeader
          index="02"
          label="Geospatial layer"
          title="Where the money surfaces."
          description="Risk is aggregated into H3 cells and weighted by active case volume. The basemap is desaturated so signal is the only colour on screen."
        />

        <div className="grid gap-8 xl:grid-cols-12">
          <Reveal className="xl:col-span-8">
            <Panel className="h-full">
              <PanelHeader
                index="02.1"
                title="National risk heatmap"
                meta={<span className="label-caps tnum text-faint">H3 · res 8</span>}
              />
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-hairline px-5 py-3">
                <label className="flex items-center gap-2">
                  <span className="label-caps text-faint">Horizon</span>
                  <select
                    value={horizon}
                    onChange={(e) => setHorizon(Number(e.target.value))}
                    disabled={!writable || isLoading}
                    aria-label="Scoring horizon"
                    className="field field-mono w-auto py-1.5 text-xs"
                  >
                    {HORIZON_OPTIONS.map((h) => (
                      <option key={h.minutes} value={h.minutes}>
                        {h.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2">
                  <span className="label-caps text-faint">Min risk</span>
                  <select
                    value={minRisk}
                    onChange={(e) => setMinRisk(e.target.value)}
                    aria-label="Minimum pin risk"
                    className="field field-mono w-auto py-1.5 text-xs"
                  >
                    {["ALL", "LOW", "MEDIUM", "HIGH", "CRITICAL"].map((r) => (
                      <option key={r} value={r}>
                        {r === "ALL" ? "All pins" : r}
                      </option>
                    ))}
                  </select>
                </label>
                <span className="telemetry text-faint">
                  {visibleAtms?.features.length ?? 0} pins
                  {refreshing ? " · updating…" : ""}
                </span>
              </div>
              <div className="h-[clamp(24rem,52vh,40rem)]">
                {!booted ? (
                  <div className="flex h-full flex-col justify-center">
                    <Loader label="Loading live map layers…" />
                  </div>
                ) : (
                  <RiskMap heatmapData={heatmapData} candidateAtms={visibleAtms} entities={entities} />
                )}
              </div>
            </Panel>
          </Reveal>

          <div className="flex flex-col gap-8 xl:col-span-4">
            <Reveal delay={80}>
              <TopKTable predictions={predictions} isLoading={!booted} index="03" caseId={topCaseId} rankingNote={rankingNote} />
              {!writable && !isLoading && (
                <p className="mt-3 px-1 text-[0.6875rem] text-faint">
                  Candidate scoring requires the LEA Officer role or above — your read-only view shows heat and alerts.
                </p>
              )}
            </Reveal>

            <Reveal delay={160} className="flex-1">
              <Panel>
                <PanelHeader
                  index="04"
                  title="Latest alerts"
                  meta={
                    <span className="label-caps tnum text-faint">
                      {!booted ? "…" : `${alerts.length} live${refreshing ? " · updating" : ""}`}
                    </span>
                  }
                />
                {!booted ? (
                  <Loader label="Loading live alerts…" />
                ) : alerts.length > 0 ? (
                  alerts.map((alert) => <AlertRow key={alert.alert_id} alert={alert} />)
                ) : (
                  <p className="px-5 py-10 text-center text-xs text-faint">No active alerts.</p>
                )}
              </Panel>
            </Reveal>
          </div>
        </div>
      </section>
    </div>
  );
}
