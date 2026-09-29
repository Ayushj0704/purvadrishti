import { RecallAtKChart } from "../charts/RecallAtKChart";
import { PageHeader } from "../components/ui/PageHeader";
import { SectionHeader } from "../components/ui/Eyebrow";
import { Panel, PanelHeader } from "../components/ui/Panel";
import { Reveal } from "../components/ui/Reveal";
import { MetricRow } from "../components/ui/MetricBlock";
import { StatusPill } from "../components/ui/StatusDot";

/** Measured on the held-out split. Only K=5 is reported, so only K=5 is plotted. */
const RECALL = [{ k: "K=5", recall: 50.8 }];
const OVERALL_RECALL = 82.4;
const TOP_FIVE_RECALL = 50.8;

export function Analytics() {
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
            <StatusPill tone="accent">XGB v0.5.0</StatusPill>
            <span className="telemetry text-faint">Test split · 4 horizons</span>
          </div>
        }
      />

      <Reveal>
        <MetricRow
          items={[
            { index: "A", label: "ROC-AUC", value: "0.78", note: "60-minute horizon" },
            { index: "B", label: "Top-5 recall", value: "50.8", unit: "%", note: "Held-out test set" },
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
            <RecallAtKChart
              data={RECALL}
              overallRecall={OVERALL_RECALL}
              topFiveRecall={TOP_FIVE_RECALL}
            />
          </Panel>
        </Reveal>
      </section>
    </div>
  );
}
