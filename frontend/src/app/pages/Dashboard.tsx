import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type * as GeoJSON from "geojson";
import { FilterBar } from "../components/FilterBar";
import type { FilterState } from "../components/FilterBar";
import { RiskMap } from "../map/RiskMap";
import { TopKTable } from "../components/TopKTable";
import { AlertRow } from "../components/AlertRow";
import { PageHeader } from "../components/ui/PageHeader";
import { FolderFloat } from "../components/ui/FolderFloat";
import { SectionHeader } from "../components/ui/Eyebrow";
import { Panel, PanelHeader } from "../components/ui/Panel";
import { Reveal } from "../components/ui/Reveal";
import { Loader } from "../components/ui/Loader";
import { GlideSelect } from "../components/ui/GlideSelect";
import { StatusPill } from "../components/ui/StatusDot";
import { heatmapApi, alertsApi, casesApi, toTopKRows, toAtmPoints, trailToEntities, HORIZON_OPTIONS } from "../api";
import { canWrite, useRole } from "../lib/useRole";
import type { HeatmapParams } from "../api/heatmap";
import type { PredictionCandidate } from "../api/cases";
import type { Alert } from "../api/alerts";
import { StatusStrip } from "../components/layout/StatusStrip";
import { formatCompact, formatTime } from "../lib/format";

const RISK_LEVELS = ["ALL", "LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

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

interface Metric {
  index: string;
  label: string;
  value: string;
  unit?: string;
  delta?: { value: string; direction: "up" | "down" | "flat" };
  note?: string;
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

  const [scoring, setScoring] = useState(false);
  const applyPredictResult = (result: {
    predictions: Parameters<typeof toTopKRows>[0];
    heat_watch?: Array<{ atm_id: string }>;
    ranking_note?: string;
  }) => {
    const heatByAtm = new Map(
      (result.heat_watch ?? []).map((w) => [w.atm_id, "HIGH"]),
    );
    const rows = toTopKRows(result.predictions as never);
    for (const r of rows) r.heat_level = heatByAtm.get(r.atm_id) ?? "LOW";
    setPredictions(rows);
    setRankingNote(result.ranking_note ?? "");
  };

  const handleRescore = useCallback(async () => {
    if (!topCaseId || !writable || scoring) return;
    setScoring(true);
    try {
      const result = await casesApi.predict(topCaseId, { horizon_minutes: horizon });
      applyPredictResult(result);
      setSyncedAt(new Date());
    } catch {
      setLoadErrors((e) => (e.includes("predictions") ? e : [...e, "predictions"]));
    } finally {
      setScoring(false);
    }
  }, [topCaseId, writable, horizon, scoring]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      // P1: progressive render — heatmap + alerts + candidates resolve
      // independently; stale data stays on screen during refreshes.
      const first = !bootedRef.current;
      if (first) setIsLoading(true);
      const failed: string[] = [];

      // P1 read-first: stored predictions, POST only via Re-score button.
      const loadCandidates = async () => {
        if (!writable) {
          setPredictions([]);
          setRankingNote("");
          setTopCaseId(undefined);
          return;
        }
        try {
          const samples = await casesApi.sampleCases(1);
          if (samples.length === 0 || cancelled) {
            if (!cancelled) {
              setPredictions([]);
              setRankingNote("");
              setTopCaseId(undefined);
              setEntities(undefined);
            }
            return;
          }
          const sample = samples[0];
          if (!cancelled) setTopCaseId(String(sample.case_id));
          const [stored, tr] = await Promise.all([
            casesApi.getStoredPredictions(sample.case_id, 5).catch(() => null),
            casesApi.getTrail(sample.case_id).catch(() => null),
          ]);
          if (cancelled) return;
          if (stored && stored.count > 0) {
            const rows = stored.predictions.map((p) => ({
              atm_id: p.atm_id,
              state: p.state,
              risk_score: p.score,
              risk_level: p.risk_level,
              lat: p.lat ?? undefined,
              lon: p.lon ?? undefined,
              district: p.district,
              heat_level: "LOW" as const,
            }));
            setPredictions(rows as never);
            setRankingNote(`Latest stored ranking · ${stored.count} candidates.`);
            setEntities(trailToEntities(tr));
          } else {
            // No history yet — score once so the panel isn't empty.
            // Subsequent views read stored; re-runs need Re-score.
            try {
              const result = await casesApi.predict(
                sample.case_id, { horizon_minutes: horizon },
              );
              if (cancelled) return;
              applyPredictResult(result);
              setEntities(trailToEntities(tr));
            } catch {
              failed.push("predictions");
            }
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
      };

      await Promise.all([
        heatmapApi
          .getHeatmap(filtersToHeatmapParams(filters))
          .then((d) => {
            if (!cancelled) setHeatmapData(d);
          })
          .catch(() => {
            failed.push("heatmap");
            if (!cancelled) setHeatmapData(undefined);
          }),
        alertsApi
          .getAlerts(5, 0)
          .then((list) => {
            if (!cancelled) setAlerts(list.slice(0, 5));
          })
          .catch(() => {
            failed.push("alerts");
            if (!cancelled) setAlerts([]);
          }),
        loadCandidates(),
      ]);

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
    // NOTE: horizon intentionally excluded — changing it no longer
    // re-scores (50-row INSERT). Use Re-score for an explicit run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, reloadKey, writable]);

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
  const metrics: Metric[] = [
    {
      index: "A",
      label: "Active alerts",
      value: !booted ? "—" : String(alerts.length),
      note: "Requires investigator review",
    },
    {
      index: "B",
      label: "High-risk zones",
      value: !booted ? "—" : String(heatmapData?.features.length ?? 0),
      note: "H3 resolution 8 cells",
    },
    {
      index: "C",
      label: "Cases analysed",
      value: formatCompact(12483),
      note: "Trailing 30 days",
    },
    {
      index: "D",
      label: "Avg lead time",
      value: "18",
      unit: "min",
      delta: { value: "Stable", direction: "flat" },
      note: "Complaint to cash-out",
    },
  ];

  return (
    <div className="flex flex-col gap-20">
      <PageHeader   
        className="border-b-0"
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
          <FolderFloat
            label="Live metrics"
            sublabel={`${metrics.length} metrics`}
            trigger="click"
            items={metrics.map((metric) => ({
              label: `${metric.index} · ${metric.label} ${metric.value}${metric.unit ? ` ${metric.unit}` : ""}`,
              value: metric.value,
            }))}
            width={282}
            height={208}
            radius={19}
            spread={238}
            lift={36}
            pillSize={1.18}
            folderColor="#15151a"
            frontColor="#3d46ff"
            paperColor="#f5f5f5"
            itemColor="#f5f5f5"
            itemTextColor="#18181b"
            labelColor="#f4f4f5"
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

        <div className="grid gap-8 xl:grid-cols-12 ">
          <Reveal className="xl:col-span-8 ">
            <Panel className="panel-soft flex h-full flex-col">
              <PanelHeader
                className="bg-black/[0.36]"
                index="02.1"
                title="National risk heatmap"
                meta={<span className="label-caps tnum text-faint">H3 · res 8</span>}
              />
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-hairline px-5 py-3 bg-black/[0.36]">
                <div className="flex items-center gap-2">
                  <span className="label-caps text-faint">Horizon</span>
                  <GlideSelect
                    size="sm"
                    className="w-auto"
                    items={HORIZON_OPTIONS.map((h) => ({
                      value: String(h.minutes),
                      label: h.label,
                    }))}
                    value={String(horizon)}
                    onChange={(value) => setHorizon(Number(value))}
                    disabled={!writable || isLoading}
                    ariaLabel="Scoring horizon"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="label-caps text-faint">Min risk</span>
                  <GlideSelect
                    size="sm"
                    className="w-auto"
                    items={RISK_LEVELS.map((r) => ({
                      value: r,
                      label: r === "ALL" ? "All pins" : r,
                    }))}
                    value={minRisk}
                    onChange={setMinRisk}
                    ariaLabel="Minimum pin risk"
                  />
                </div>
                <span className="telemetry text-faint">
                  {visibleAtms?.features.length ?? 0} pins
                  {refreshing ? " · updating…" : ""}
                </span>
                {writable && topCaseId && (
                  <button
                    type="button"
                    onClick={handleRescore}
                    disabled={scoring || isLoading}
                    title="Run the model now (writes 50 predictions)"
                    className="label-caps rounded-md border border-hairline px-3 py-1.5 text-muted transition-colors hover:border-accent hover:text-ink disabled:opacity-50"
                  >
                    {scoring ? "Scoring…" : "Re-score"}
                  </button>
                )}
              </div>
              {/* `flex-1` so the map absorbs whatever height the row takes from
                  the taller Top-K/alerts column beside it. The clamp is kept as a
                  `min-h` floor, not the height itself: as a fixed height the map
                  left the surplus as dead space inside the panel. MapResizer in
                  RiskMap re-measures the canvas when this box changes. */}
              <div className="min-h-[clamp(24rem,52vh,40rem)] flex-1">
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

          <div className="flex flex-col gap-8 xl:col-span-4 ">
            <Reveal delay={80}>
              <div className="rounded-2xl bg-black/[0.36] backdrop-blur-md">
              <TopKTable predictions={predictions} isLoading={!booted} index="03" caseId={topCaseId} rankingNote={rankingNote} />
              {!writable && !isLoading && (
                <p className="mt-3 px-1 text-[0.6875rem] text-faint">
                  Candidate scoring requires the LEA Officer role or above — your read-only view shows heat and alerts.
                </p>
              )}  
              </div>
            </Reveal>

            <Reveal delay={160} className="flex-1">
              <Panel className="panel-soft">
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
