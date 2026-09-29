import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import { casesApi } from "../api";
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
import { EmptyState, Skeleton } from "../components/ui/EmptyState";
import { StatusPill } from "../components/ui/StatusDot";
import { formatInr, formatWindow } from "../lib/format";

/** Accepts either a bare array or `{ contributions: [...] }` and keeps only well-formed rows. */
function toShapFeatures(raw: unknown): ShapFeature[] {
  const rows = Array.isArray(raw)
    ? raw
    : (raw as { contributions?: unknown } | null)?.contributions;
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    const r = row as { feature_name?: unknown; contribution?: unknown; description?: unknown };
    if (typeof r?.feature_name !== "string" || typeof r?.contribution !== "number") return [];
    return [
      {
        feature_name: r.feature_name,
        contribution: r.contribution,
        description: typeof r.description === "string" ? r.description : "",
      },
    ];
  });
}

export function CaseDetail() {
  const { id } = useParams<{ id: string }>();
  const [caseData, setCaseData] = useState<CaseSummary | null>(null);
  const [predictions, setPredictions] = useState<PredictionResponse | null>(null);
  const [explanation, setExplanation] = useState<ShapFeature[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError("");

      try {
        const detail = await casesApi.getCase(id);
        if (cancelled) return;
        setCaseData(detail);
      } catch {
        if (!cancelled) {
          setCaseData(null);
          setError(`Case ${id} could not be loaded from the API.`);
        }
        return;
      }

      // Everything below is produced by this deployment. Nothing is filled in
      // client-side, so an absent result stays absent rather than becoming a fixture.
      try {
        const result = await casesApi.getPredictions(id);
        if (!cancelled) setPredictions(result);
      } catch {
        if (!cancelled) setPredictions(null);
      }

      try {
        const result = await casesApi.getExplanation(id);
        if (!cancelled) setExplanation(toShapFeatures(result));
      } catch {
        if (!cancelled) setExplanation([]);
      }

      if (!cancelled) setIsLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
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
    return <EmptyState label="Case unavailable" detail={error} />;
  }

  // No trail endpoint is wired up on this branch yet, so the timeline stays
  // empty rather than showing a plausible-looking sequence of past events.
  const timeline: TimelineEvent[] = [];

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
