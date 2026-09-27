import { useCallback, useEffect, useState } from "react";
import type * as GeoJSON from "geojson";
import { FilterBar } from "../components/FilterBar";
import type { FilterState } from "../components/FilterBar";
import { RiskMap } from "../map/RiskMap";
import { TopKTable } from "../components/TopKTable";
import { AlertRow } from "../components/AlertRow";
import { PageHeader } from "../components/ui/PageHeader";
import { SectionHeader } from "../components/ui/Eyebrow";
import { MetricRow } from "../components/ui/MetricBlock";
import { Panel, PanelHeader } from "../components/ui/Panel";
import { Reveal } from "../components/ui/Reveal";
import { StatusPill } from "../components/ui/StatusDot";
import { heatmapApi, alertsApi } from "../api";
import type { PredictionCandidate } from "../api/cases";
import type { Alert } from "../api/alerts";
import { StatusStrip } from "../components/layout/StatusStrip";
import { formatCompact, formatTime } from "../lib/format";

const FALLBACK_ALERT: Alert = {
  alert_id: "A-101",
  case_id: "C10234",
  atm_id: "ATM-RJ-1023",
  risk_score: 0.89,
  confidence: "HIGH",
  prediction_window_start: new Date().toISOString(),
  prediction_window_end: new Date(Date.now() + 3600000).toISOString(),
  created_at: new Date().toISOString(),
  status: "NEW",
};

const SEED_PREDICTIONS: PredictionCandidate[] = [
  {
    atm_id: "ATM-RJ-1023",
    state: "Rajasthan",
    risk_score: 0.89,
    risk_level: "HIGH",
    confidence: "HIGH",
  },
  {
    atm_id: "ATM-HR-2041",
    state: "Haryana",
    risk_score: 0.76,
    risk_level: "HIGH",
    confidence: "MEDIUM",
  },
  {
    atm_id: "ATM-DL-0312",
    state: "Delhi",
    risk_score: 0.61,
    risk_level: "MEDIUM",
    confidence: "LOW",
  },
];

export function Dashboard() {
  const [, setFilters] = useState<FilterState | null>(null);
  const [heatmapData, setHeatmapData] = useState<GeoJSON.FeatureCollection | undefined>();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [predictions, setPredictions] = useState<PredictionCandidate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [syncedAt, setSyncedAt] = useState(() => new Date());

  const handleFilterChange = useCallback((next: FilterState) => {
    setFilters(next);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setPredictions(SEED_PREDICTIONS);

      try {
        setHeatmapData(await heatmapApi.getHeatmap());
      } catch {
        if (!cancelled) setHeatmapData(undefined);
      }

      try {
        const list = await alertsApi.getAlerts();
        if (!cancelled) setAlerts(list.slice(0, 5));
      } catch {
        if (!cancelled) setAlerts([FALLBACK_ALERT]);
      }

      if (!cancelled) {
        setSyncedAt(new Date());
        setIsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col gap-20">
      <PageHeader
        index="01"
        eyebrow="Operations overview"
        title={
          <>
            Predictive
            <br />
            cash-out <span className="text-accent">intelligence.</span>
          </>
        }
        lede="Live ranking of probable ATM withdrawal locations and predicted windows, derived from complaint trails and scored across every candidate inside the search radius."
        aside={
          <div className="flex flex-wrap items-center gap-3">
            <StatusPill tone={isLoading ? "accent" : "stable"} pulse={!isLoading}>
              {isLoading ? "Syncing" : "Pipeline live"}
            </StatusPill>
            <span className="telemetry text-faint">Synced {formatTime(syncedAt)}</span>
          </div>
        }
      />

      <Reveal>
        <MetricRow
          items={[
            {
              index: "A",
              label: "Active alerts",
              value: "17",
              delta: { value: "+3 / 1h", direction: "down" },
              note: "Requires investigator review",
            },
            {
              index: "B",
              label: "High-risk zones",
              value: "8",
              delta: { value: "−1 / 24h", direction: "up" },
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
          ]}
        />
      </Reveal>

      <Reveal>
        <StatusStrip className="-mx-5 sm:-mx-8" />
      </Reveal>

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
              <TopKTable predictions={predictions} isLoading={isLoading} index="03" />
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
