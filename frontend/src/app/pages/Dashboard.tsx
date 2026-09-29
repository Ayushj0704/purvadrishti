import { useCallback, useEffect, useMemo, useState } from "react";
import { FilterBar, toHotspotFilters } from "../components/FilterBar";
import type { FilterState } from "../components/FilterBar";
import { RiskMap } from "../map/RiskMap";
import { HotspotTable } from "../components/HotspotTable";
import { AlertRow } from "../components/AlertRow";
import { PageHeader } from "../components/ui/PageHeader";
import { FolderFloat } from "../components/ui/FolderFloat";
import { SectionHeader } from "../components/ui/Eyebrow";
import { Panel, PanelHeader } from "../components/ui/Panel";
import { Reveal } from "../components/ui/Reveal";
import { MetricRow } from "../components/ui/MetricBlock";
import { StatusPill } from "../components/ui/StatusDot";
import { Button } from "../components/ui/Button";
import { heatmapApi, toHotspotLayers } from "../api/heatmap";
import type { HotspotCell } from "../api/heatmap";
import { alertsApi, isOpen } from "../api/alerts";
import type { Alert } from "../api/alerts";
import { casesApi } from "../api/cases";
import type { CaseSummary } from "../api/cases";
import { healthApi, isModelLoaded } from "../api/health";
import type { Health } from "../api/health";
import { ApiError } from "../api/client";
import { useStreamEvents } from "../api/events";
import type { StreamEvent } from "../api/events";
import { StatusStrip } from "../components/layout/StatusStrip";
import { formatTime } from "../lib/format";

/**
 * Operations overview.
 *
 * Every panel is fed by a live call. The metrics row was previously four
 * hardcoded constants — "17 active alerts", "12,483 cases analysed", "18 min
 * average lead time" — that no request could ever change, so the page reported
 * a fictional operation. What is here now is countable: alerts the API
 * returned, cells the current filters matched, cases the list endpoint returned,
 * and the model label from /health.
 */
export function Dashboard() {
  const [filters, setFilters] = useState<FilterState | null>(null);
  const [cells, setCells] = useState<HotspotCell[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [syncedAt, setSyncedAt] = useState(() => new Date());

  const handleFilterChange = useCallback((next: FilterState) => setFilters(next), []);

  const load = useCallback(async (active: FilterState) => {
    setIsLoading(true);
    setError("");

    // Each panel settles independently: a failing hotspot query must not blank
    // the alert queue, and neither may substitute a placeholder for its data.
    const results = await Promise.allSettled([
      heatmapApi.getHotspots(toHotspotFilters(active)),
      alertsApi.getAlerts(),
      casesApi.listCases(),
      healthApi.getHealth(),
    ]);

    const [hotspots, alertList, caseList, healthResult] = results;

    if (hotspots.status === "fulfilled") {
      setCells(hotspots.value.cells);
    } else if (hotspots.reason instanceof ApiError && !hotspots.reason.isUnauthorized) {
      setCells([]);
    }

    if (alertList.status === "fulfilled") setAlerts(alertList.value);
    if (caseList.status === "fulfilled") setCases(caseList.value);
    if (healthResult.status === "fulfilled") setHealth(healthResult.value);

    const failure = results.find(
      (result) =>
        result.status === "rejected" &&
        result.reason instanceof ApiError &&
        !result.reason.isUnauthorized,
    );
    if (failure && failure.status === "rejected" && failure.reason instanceof ApiError) {
      setError(failure.reason.message);
    }

    setSyncedAt(new Date());
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (filters) void load(filters);
  }, [filters, load]);

  // A new alert arriving over the stream refreshes the queue it belongs to, so
  // the operator sees it without a manual reload. The hotspot layer is left
  // alone — it is scoped by the filter bar and would re-query on every event.
  const onStreamEvent = useCallback((event: StreamEvent) => {
    if (event.event !== "alert.created") return;
    void alertsApi
      .getAlerts()
      .then(setAlerts)
      .catch(() => {
        /* the panel keeps the last good list rather than clearing it */
      });
  }, []);
  useStreamEvents(onStreamEvent);

  const layers = useMemo(() => toHotspotLayers(cells), [cells]);

  const openAlerts = alerts.filter(isOpen).length;
  const highRisk = cells.filter(
    (cell) => cell.risk_level === "CRITICAL" || cell.risk_level === "HIGH",
  ).length;
  const modelLabel = health ? health.model : "unknown";

  const metrics = [
    {
      index: "A",
      label: "Open alerts",
      value: alerts.length === 0 && isLoading ? "—" : String(openAlerts),
      note: `${alerts.length} returned by the alert queue`,
    },
    {
      index: "B",
      label: "High-risk cells",
      value: cells.length === 0 && isLoading ? "—" : String(highRisk),
      note: `of ${cells.length} cells matching filters`,
    },
    {
      index: "C",
      label: "Cases returned",
      value: cases.length === 0 && isLoading ? "—" : String(cases.length),
      note: "Rows from the case list, not a database total",
    },
    {
      index: "D",
      label: "Model",
      value: isModelLoaded(health) ? "XGB" : health ? "Heuristic" : "—",
      note: `Database ${health ? health.database : "unknown"}`,
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
        lede="Live risk aggregation across every scored candidate cell, with the alert queue and the case load the backend is currently reporting."
        leadClassName="lg:pl-10 xl:pl-16"
        titleClassName="text-[clamp(3.25rem,8.5vw,7.5rem)]"
        aside={
          <div className="flex flex-wrap items-center gap-3">
            <StatusPill tone={isLoading ? "accent" : error ? "warning" : "stable"} pulse={isLoading}>
              {isLoading ? "Syncing" : error ? "Degraded" : "Live"}
            </StatusPill>
            <span className="telemetry text-faint">Synced {formatTime(syncedAt)}</span>
          </div>
        }
        figure={
          <FolderFloat
            label="Live metrics"
            sublabel={`${metrics.length} metrics`}
            trigger="click"
            items={metrics.map((metric) => ({ label: metric.label, value: metric.value }))}
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
        <MetricRow items={metrics} />
      </Reveal>

      <Reveal>
        <StatusStrip
          className="-mx-5 sm:-mx-8"
          facts={{
            model: modelLabel,
            database: health ? health.database : "unknown",
            cells: cells.length,
            openAlerts,
            totalAlerts: alerts.length,
            cases: cases.length,
            syncedAt,
            reachable: health !== null,
          }}
        />
      </Reveal>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-critical/50 bg-critical/15 px-4 py-3 text-xs text-critical"
        >
          {error}
        </p>
      )}

      <Reveal>
        <FilterBar onFilterChange={handleFilterChange} />
      </Reveal>

      <section className="flex flex-col gap-8">
        <SectionHeader
          index="02"
          label="Geospatial layer"
          title="Where the money surfaces."
          description="Predictions aggregated into H3 cells and coloured by the model's own risk level. The basemap is desaturated so signal is the only colour on screen."
        />

        <div className="grid gap-8 xl:grid-cols-12">
          <Reveal className="xl:col-span-8">
            <Panel className="h-full">
              <PanelHeader
                index="02.1"
                title="National risk heatmap"
                meta={
                  <span className="label-caps tnum text-faint">
                    {layers.polygons.features.length} cells
                    {layers.points.features.length > 0 &&
                      ` · ${layers.points.features.length} points`}
                    {layers.skipped > 0 && ` · ${layers.skipped} unmapped`}
                  </span>
                }
              />
              <div className="h-[clamp(24rem,52vh,40rem)]">
                <RiskMap
                  polygons={layers.polygons}
                  points={layers.points}
                  isLoading={isLoading}
                />
              </div>
            </Panel>
          </Reveal>

          <div className="flex flex-col gap-8 xl:col-span-4">
            <Reveal delay={80}>
              <HotspotTable cells={cells} isLoading={isLoading} index="03" />
            </Reveal>

            <Reveal delay={160} className="flex-1">
              <Panel>
                <PanelHeader
                  index="04"
                  title="Latest alerts"
                  meta={<span className="label-caps tnum text-faint">{alerts.length} live</span>}
                />
                {alerts.length > 0 ? (
                  alerts
                    .slice(0, 6)
                    .map((alert) => <AlertRow key={alert.alert_id} alert={alert} />)
                ) : (
                  <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
                    <p className="label-caps text-muted">
                      {isLoading ? "Loading alerts" : "Queue clear"}
                    </p>
                    {!isLoading && (
                      <Button variant="ghost" size="sm" onClick={() => filters && load(filters)}>
                        Refresh
                      </Button>
                    )}
                  </div>
                )}
              </Panel>
            </Reveal>
          </div>
        </div>
      </section>
    </div>
  );
}
