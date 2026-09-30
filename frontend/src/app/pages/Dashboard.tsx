import { useCallback, useEffect, useState } from "react";
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
import { StatusPill } from "../components/ui/StatusDot";
import { heatmapApi, alertsApi, casesApi, toTopKRows } from "../api";
import { canWrite, useRole } from "../lib/useRole";
import type { HeatmapParams } from "../api/heatmap";
import type { PredictionCandidate } from "../api/cases";
import type { Alert } from "../api/alerts";
import { StatusStrip } from "../components/layout/StatusStrip";
import { formatCompact, formatTime } from "../lib/format";

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
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [predictions, setPredictions] = useState<PredictionCandidate[]>([]);
  const [rankingNote, setRankingNote] = useState("");
  const [topCaseId, setTopCaseId] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [loadErrors, setLoadErrors] = useState<string[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [syncedAt, setSyncedAt] = useState(() => new Date());

  const handleFilterChange = useCallback((next: FilterState) => {
    setFilters(next);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
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
            const result = await casesApi.predict(sample.case_id, { horizon_minutes: 60 });
          if (!cancelled) {
            setPredictions(toTopKRows(result.predictions));
            setRankingNote(result.ranking_note ?? "");
            setTopCaseId(String(sample.case_id));
          }
        } else if (!cancelled) {
          setPredictions([]);
          setRankingNote("");
          setTopCaseId(undefined);
        }
      } catch {
        failed.push("predictions");
        if (!cancelled) {
          setPredictions([]);
          setRankingNote("");
          setTopCaseId(undefined);
        }
      }
      }

      if (!cancelled) {
        setLoadErrors(failed);
        setSyncedAt(new Date());
        setIsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [filters, reloadKey, writable]);

  const metrics: Metric[] = [
    {
      index: "A",
      label: "Active alerts",
      value: String(alerts.length),
      note: "Requires investigator review",
    },
    {
      index: "B",
      label: "High-risk zones",
      value: String(heatmapData?.features.length ?? 0),
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

        <div className="grid gap-8 xl:grid-cols-12">
          <Reveal className="xl:col-span-8">
            <Panel className="h-full">
              <PanelHeader
                index="02.1"
                title="National risk heatmap"
                meta={<span className="label-caps tnum text-faint">H3 · res 8</span>}
              />
              <div className="h-[clamp(24rem,52vh,40rem)]">
                <RiskMap heatmapData={heatmapData} />
              </div>
            </Panel>
          </Reveal>

          <div className="flex flex-col gap-8 xl:col-span-4">
            <Reveal delay={80}>
              <TopKTable predictions={predictions} isLoading={isLoading} index="03" caseId={topCaseId} rankingNote={rankingNote} />
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
                    <span className="label-caps tnum text-faint">{alerts.length} live</span>
                  }
                />
                {alerts.length > 0 ? (
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
