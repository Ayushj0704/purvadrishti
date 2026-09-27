import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import type { CaseSummary, PredictionResponse } from "../api/cases";
import { ShapContributionChart } from "../charts/ShapContributionChart";
import type { ShapFeature } from "../charts/ShapContributionChart";
import { InvestigationTimeline } from "../components/InvestigationTimeline";
import type { TimelineEvent } from "../components/InvestigationTimeline";
import { TopKTable } from "../components/TopKTable";
import { TransactionGraph } from "../components/TransactionGraph";
import { PageHeader } from "../components/ui/PageHeader";
import { SectionHeader } from "../components/ui/Eyebrow";
import { Panel, PanelHeader } from "../components/ui/Panel";
import { Reveal } from "../components/ui/Reveal";
import { Skeleton } from "../components/ui/EmptyState";
import { StatusPill } from "../components/ui/StatusDot";
import { formatInr, formatWindow } from "../lib/format";

const SEED_EXPLANATION: ShapFeature[] = [
  {
    feature_name: "Historical Similarity",
    contribution: 0.35,
    description: "High similarity to historical fraud-linked cash-outs",
  },
  {
    feature_name: "Location Proximity",
    contribution: 0.22,
    description: "Close to the latest relevant transaction location",
  },
  {
    feature_name: "Time of Day",
    contribution: 0.15,
    description: "Current time matches historical cash-out pattern",
  },
  {
    feature_name: "Suspicious Activity",
    contribution: 0.12,
    description: "Elevated recent suspicious activity at this ATM",
  },
  {
    feature_name: "Cross-State Pattern",
    contribution: 0.08,
    description: "Cross-state movement seen in comparable cases",
  },
  { feature_name: "Weekend Flag", contribution: -0.03, description: "Non-weekend slightly lowers risk" },
];

export function CaseDetail() {
  const { id } = useParams<{ id: string }>();
  const [caseData, setCaseData] = useState<CaseSummary | null>(null);
  const [predictions, setPredictions] = useState<PredictionResponse | null>(null);
  const [explanation, setExplanation] = useState<ShapFeature[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    setIsLoading(true);
    setCaseData({
      case_id: id,
      created_at: new Date().toISOString(),
      fraud_type: "UPI Transfer",
      amount: 120000,
      status: "INVESTIGATING",
    });
    setPredictions({
      case_id: id,
      prediction_window: {
        start: new Date().toISOString(),
        end: new Date(Date.now() + 3600000).toISOString(),
      },
      predictions: [
        { atm_id: "ATM-1023", state: "Rajasthan", risk_score: 0.89, risk_level: "HIGH", confidence: "HIGH" },
        { atm_id: "ATM-2041", state: "Haryana", risk_score: 0.76, risk_level: "HIGH", confidence: "MEDIUM" },
        { atm_id: "ATM-0312", state: "Delhi", risk_score: 0.41, risk_level: "MEDIUM", confidence: "LOW" },
      ],
    });
    setExplanation(SEED_EXPLANATION);
    setIsLoading(false);
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-10">
        <div className="h-10 w-64 animate-pulse bg-white/[0.04]" />
        <Skeleton rows={6} />
      </div>
    );
  }

  if (!caseData) {
    return <p className="text-sm text-critical">Case {id} not found.</p>;
  }

  const timeline: TimelineEvent[] = [
    { id: "1", timestamp: new Date(Date.now() - 3600000).toISOString(), description: "Suspicious transaction flagged", type: "TRANSACTION" },
    { id: "2", timestamp: new Date(Date.now() - 3400000).toISOString(), description: "Complaint received from victim", type: "COMPLAINT" },
    { id: "3", timestamp: new Date(Date.now() - 3200000).toISOString(), description: "Candidate locations generated", type: "GENERATION" },
    { id: "4", timestamp: new Date(Date.now() - 3100000).toISOString(), description: "Risk predictions calculated", type: "PREDICTION" },
    { id: "5", timestamp: new Date(Date.now() - 3000000).toISOString(), description: "High-risk alert dispatched", type: "ALERT" },
    { id: "6", timestamp: new Date().toISOString(), description: "Investigator opened case file", type: "ACTION" },
  ];

  const facts = [
    { label: "Fraud vector", value: caseData.fraud_type },
    { label: "Amount involved", value: formatInr(caseData.amount) },
    { label: "Complaint filed", value: formatWindow(caseData.created_at, caseData.created_at).split(" — ")[0] },
    {
      label: "Prediction window",
      value: predictions
        ? formatWindow(predictions.prediction_window.start, predictions.prediction_window.end)
        : "—",
    },
  ];

  return (
    <div className="flex flex-col gap-20">
      <div>
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-[0.6875rem] font-medium text-faint transition-colors hover:text-accent"
        >
          <ArrowLeft className="size-3" />
          Back to overview
        </Link>

        <PageHeader
          className="mt-8"
          index="CASE"
          eyebrow={`Case ${caseData.case_id}`}
          title={
            <>
              Money flow
              <br />
              <span className="text-accent">topology.</span>
            </>
          }
          lede="Every hop from victim account to terminal, with the model's ranked cash-out hypotheses and the feature contributions behind each score."
          aside={
            <div className="flex flex-wrap items-center gap-3">
              <StatusPill tone="accent" pulse>
                {caseData.status.replace("_", " ")}
              </StatusPill>
              <span className="telemetry text-faint">
                {predictions?.predictions.length ?? 0} candidates
              </span>
            </div>
          }
        />
      </div>

      {/* Case facts */}
      <Reveal>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-hairline bg-hairline lg:grid-cols-4">
          {facts.map((fact, i) => (
            <div key={fact.label} className="flex flex-col gap-3 bg-surface p-5">
              <span className="label-caps text-faint">
                <span className="tnum text-accent">{String(i + 1).padStart(2, "0")}</span> ·{" "}
                {fact.label}
              </span>
              <span className="telemetry text-ink">{fact.value}</span>
            </div>
          ))}
        </div>
      </Reveal>

      {/* Ranked candidates + timeline */}
      <section className="grid gap-8 xl:grid-cols-12">
        <Reveal className="flex flex-col gap-8 xl:col-span-7">
          <TopKTable
            predictions={predictions?.predictions ?? []}
            isLoading={false}
            caseId={caseData.case_id}
            index="01"
            title="Ranked cash-out candidates"
          />

          <Panel>
            <PanelHeader
              index="02"
              title="Feature attribution"
              meta={<span className="label-caps text-faint">SHAP</span>}
            />
            <ShapContributionChart data={explanation} />
          </Panel>
        </Reveal>

        <Reveal delay={100} className="xl:col-span-5">
          <InvestigationTimeline events={timeline} index="03" />
        </Reveal>
      </section>

      <section className="flex flex-col gap-8">
        <SectionHeader
          index="04"
          label="Graph analysis"
          title="Follow the hops."
          description="Directed flow from the originating account through each mule hop to the terminal withdrawal. Node colour encodes role, edge weight encodes value moved."
        />
        <Reveal>
          <TransactionGraph />
        </Reveal>
      </section>
    </div>
  );
}
