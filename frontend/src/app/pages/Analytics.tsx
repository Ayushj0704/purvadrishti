import { useEffect, useState } from "react";
import { ThreatVelocityChart } from "../charts/ThreatVelocityChart";
import { RecallAtKChart } from "../charts/RecallAtKChart";
import { PageHeader } from "../components/ui/PageHeader";
import { SectionHeader } from "../components/ui/Eyebrow";
import { Panel, PanelHeader } from "../components/ui/Panel";
import { Reveal } from "../components/ui/Reveal";
import { MetricRow } from "../components/ui/MetricBlock";
import { StatusPill } from "../components/ui/StatusDot";
import { Skeleton } from "../components/ui/EmptyState";
import { analyticsApi } from "../api/analytics";
import type { ModelMetrics } from "../api/analytics";

interface VelocityPoint {
  time: string;
  complaints: number;
  predictions: number;
}

export function Analytics() {
  const [isLoading, setIsLoading] = useState(true);
  const [metrics, setMetrics] = useState<ModelMetrics | null>(null);
  const [velocity, setVelocity] = useState<VelocityPoint[]>([]);
  const [velocityLoading, setVelocityLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setVelocityLoading(true);

    analyticsApi
      .getModelMetrics()
      .then((m) => {
        if (!cancelled) setMetrics(m);
      })
      .catch(() => {
        if (!cancelled) setMetrics(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    analyticsApi
      .getVelocity(24)
      .then((v) => {
        if (cancelled) return;
        setVelocity(
          v.buckets.map((b) => ({
            time: new Date(`${b.t}Z`).toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            }),
            complaints: b.complaints,
            predictions: b.predictions,
          })),
        );
      })
      .catch(() => {
        if (!cancelled) setVelocity([]);
      })
      .finally(() => {
        if (!cancelled) setVelocityLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const horizon = metrics?.horizons["60"];
  const recallBars = horizon
    ? [
        { k: "K=1", recall: horizon.test_top1_recall * 100 },
        { k: "K=5", recall: horizon.test_top5_recall * 100 },
      ]
    : [];

  return (
    <div className="flex flex-col gap-20">
      <PageHeader
        index="03"
        eyebrow="Model evaluation"
        title={
          <>
            Measure it or
            <br />
            <span className="text-accent">it is a guess.</span>
          </>
        }
        lede="Retrieval quality of the ranking and the throughput of the ingestion pipeline. These are the two numbers that decide whether a patrol team trusts the output."
        aside={
          <div className="flex flex-wrap items-center gap-3">
            <StatusPill tone="accent">
              {metrics ? `XGB v${metrics.model_version}` : "Model metrics"}
            </StatusPill>
            <span className="telemetry text-faint">Test split · 4 horizons</span>
          </div>
        }
      />

      <Reveal>
        {isLoading || !metrics || !horizon ? (
          <Skeleton rows={2} />
        ) : (
          <MetricRow
            items={[
              { index: "A", label: "ROC-AUC", value: metrics.test_roc_auc.toFixed(2), note: "60-minute horizon" },
              { index: "B", label: "Top-5 recall", value: (metrics.test_top5_recall * 100).toFixed(1), unit: "%", note: "Held-out test set" },
              { index: "C", label: "Time MAE", value: String(metrics.time_mae_min), unit: "min", note: "Minutes to cash-out" },
              { index: "D", label: "Horizons", value: String(Object.keys(metrics.horizons).length), note: "30 / 60 / 240 / 720 min" },
            ]}
          />
        )}
      </Reveal>

      <section className="flex flex-col gap-8">
        <SectionHeader
          index="01"
          label="Ranking quality"
          title="Does the true cash-out land in the top K?"
          description="Recall is measured per event on the held-out test split, 60-minute horizon. The highlighted bar is the operational setting — five candidates is what a field team can realistically act on."
        />

        <Reveal>
          <Panel>
            <PanelHeader
              index="01.1"
              title="Recall @ K"
              meta={<span className="label-caps text-faint">N = test split</span>}
            />
            {isLoading || !horizon ? (
              <Skeleton rows={4} />
            ) : (
              <RecallAtKChart
                data={recallBars}
                recallAt5={horizon.test_top5_recall * 100}
                rocAuc={horizon.test_roc_auc}
              />
            )}
          </Panel>
        </Reveal>
      </section>

      <section className="flex flex-col gap-8">
        <SectionHeader
          index="02"
          label="Pipeline throughput"
          title="Complaints in, hypotheses out."
          description="Hourly count of inbound complaints against predictions generated for the same window. Sustained divergence is the earliest signal of a backlog."
        />

        <Reveal>
          <Panel>
            <PanelHeader
              index="02.1"
              title="Threat velocity · last 24h"
              meta={<span className="label-caps tnum text-faint">Hourly · observed</span>}
            />
            <ThreatVelocityChart data={velocity} isLoading={velocityLoading} />
          </Panel>
        </Reveal>
      </section>
    </div>
  );
}
