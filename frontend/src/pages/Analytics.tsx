import { useEffect, useState } from "react";
import { ThreatVelocityChart } from "../charts/ThreatVelocityChart";
import { RecallAtKChart } from "../charts/RecallAtKChart";
import { PageHeader } from "../components/ui/PageHeader";
import { SectionHeader } from "../components/ui/Eyebrow";
import { Panel, PanelHeader } from "../components/ui/Panel";
import { Reveal } from "../components/ui/Reveal";
import { MetricRow } from "../components/ui/MetricBlock";
import { StatusPill } from "../components/ui/StatusDot";

interface VelocityPoint {
  time: string;
  complaints: number;
  predictions: number;
}

const RECALL = [
  { k: "K=1", recall: 42.5 },
  { k: "K=3", recall: 68.2 },
  { k: "K=5", recall: 82.4 },
  { k: "K=10", recall: 94.1 },
];

function generateVelocity(): VelocityPoint[] {
  const now = Date.now();
  return Array.from({ length: 25 }, (_, i) => {
    const at = new Date(now - (24 - i) * 3600000);
    return {
      time: at.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false }),
      complaints: Math.floor(Math.random() * 50) + 10,
      predictions: Math.floor(Math.random() * 45) + 5,
    };
  });
}

export function Analytics() {
  const [isLoading, setIsLoading] = useState(true);
  const [velocity, setVelocity] = useState<VelocityPoint[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVelocity(generateVelocity());
      setIsLoading(false);
    }, 450);
    return () => clearTimeout(timer);
  }, []);

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
            <StatusPill tone="accent">XGB v0.2.0</StatusPill>
            <span className="telemetry text-faint">Test split · 4 horizons</span>
          </div>
        }
      />

      <Reveal>
        <MetricRow
          items={[
            { index: "A", label: "ROC-AUC", value: "0.78", note: "60-minute horizon" },
            { index: "B", label: "Top-5 recall", value: "47–57", unit: "%", note: "Held-out test set" },
            { index: "C", label: "Time MAE", value: "38", unit: "min", note: "Minutes to cash-out" },
            { index: "D", label: "Horizons", value: "4", note: "30 / 60 / 240 / 720 min" },
          ]}
        />
      </Reveal>

      <section className="flex flex-col gap-8">
        <SectionHeader
          index="01"
          label="Ranking quality"
          title="Does the true cash-out land in the top K?"
          description="Recall is measured per event, then averaged. The highlighted bar is the operational setting — five candidates is what a field team can realistically act on."
        />

        <Reveal>
          <Panel>
            <PanelHeader
              index="01.1"
              title="Recall @ K"
              meta={<span className="label-caps text-faint">N = test split</span>}
            />
            <RecallAtKChart data={RECALL} crossStateRecall={74.8} precisionAt5={28.6} />
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
              meta={<span className="label-caps tnum text-faint">Hourly</span>}
            />
            <ThreatVelocityChart data={velocity} isLoading={isLoading} />
          </Panel>
        </Reveal>
      </section>
    </div>
  );
}
