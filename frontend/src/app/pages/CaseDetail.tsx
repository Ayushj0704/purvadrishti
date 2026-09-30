import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import { casesApi, toTopKRows } from "../api/cases";
import type { CaseSummary, PredictResponse, TrailResponse } from "../api/cases";
import { ShapContributionChart } from "../charts/ShapContributionChart";
import type { ShapFeature } from "../charts/ShapContributionChart";
import { InvestigationTimeline } from "../components/InvestigationTimeline";
import type { TimelineEvent, TimelineKind } from "../components/InvestigationTimeline";
import type { TimelineItem } from "../api/cases";
import { TopKTable } from "../components/TopKTable";
import { TransactionGraph } from "../components/TransactionGraph";
import { PageHeader } from "../components/ui/PageHeader";
import { SectionHeader } from "../components/ui/Eyebrow";
import { Panel, PanelHeader } from "../components/ui/Panel";
import { Reveal } from "../components/ui/Reveal";
import { Skeleton } from "../components/ui/EmptyState";
import { StatusPill } from "../components/ui/StatusDot";
import { formatInr, formatWindow } from "../lib/format";

const TIMELINE_KIND: Record<TimelineItem["kind"], TimelineKind> = {
  complaint: "COMPLAINT",
  transaction: "TRANSACTION",
  withdrawal: "TRANSACTION",
  prediction: "PREDICTION",
  alert: "ALERT",
};

function prettyFeature(name: string): string {
  return name
    .replace(/_m$/, " (m)")
    .replace(/_kmh$/, " (km/h)")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Normalises live feature values into chartable relative signal strengths.
 *  Log scale: raw values span orders of magnitude (amount in lakhs vs binary
 *  flags), so a linear normalisation would collapse every bar but one. The
 *  tooltip always carries the exact observed value. */
function featuresToShap(features: Record<string, number>): ShapFeature[] {
  const entries = Object.entries(features);
  const mags = entries.map(([, v]) => Math.log1p(Math.abs(v)));
  const peak = Math.max(1e-9, ...mags);
  return entries.map(([name, value], i) => ({
    feature_name: prettyFeature(name),
    contribution: Math.sign(value) * (mags[i] / peak),
    description: `Observed value ${Number(value).toLocaleString("en-IN")} · relative signal ${Math.round((mags[i] / peak) * 100)}% (log scale)`,
  }));
}

export function CaseDetail() {
  const { id } = useParams<{ id: string }>();
  const [caseData, setCaseData] = useState<CaseSummary | null>(null);
  const [predictions, setPredictions] = useState<PredictResponse | null>(null);
  const [explanation, setExplanation] = useState<ShapFeature[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [timelineTotal, setTimelineTotal] = useState(0);
  const [trail, setTrail] = useState<TrailResponse | null>(null);
  const [modelVersion, setModelVersion] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setIsLoading(true);
    setNotFound(false);

    const load = async () => {
      try {
        const c = await casesApi.getCase(id);
        if (cancelled) return;
        setCaseData(c);

        const [pred, expl, tl, tr] = await Promise.all([
          casesApi.predict(id, { horizon_minutes: 60 }).catch(() => null),
          casesApi.getExplanations(id).catch(() => null),
          casesApi.getTimeline(id).catch(() => null),
          casesApi.getTrail(id).catch(() => null),
        ]);
        if (cancelled) return;
        if (pred) {
          setPredictions(pred);
          setModelVersion(pred.model_version);
        }
        if (expl) {
          setExplanation(featuresToShap(expl.features));
          if (!pred) setModelVersion(expl.model_version);
        }
        if (tl) {
          // Cap a runaway event list (every scored candidate logs a row) —
          // newest first, with the total preserved in the header count.
          const mapped = tl.events.map((e, i) => ({
            id: String(i),
            timestamp: e.t,
            description: e.text,
            type: TIMELINE_KIND[e.kind] ?? "ACTION",
          }));
          setTimeline(mapped.slice(-30));
          setTimelineTotal(mapped.length);
        }
        if (tr) setTrail(tr);
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
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

  if (notFound || !caseData) {
    return <p className="text-sm text-critical">Case {id} not found.</p>;
  }

  const rows = predictions ? toTopKRows(predictions.predictions) : [];
  const featureMeta = modelVersion === "" ? "model features" : modelVersion;
  const top = predictions?.predictions[0];
  const windowLabel = top?.expected_between
    ? `~${top.expected_between[0]} – ${top.expected_between[1]}`
    : (top?.predicted_window ?? "—");

  const facts = [
    { label: "Fraud vector", value: caseData.crime_subcategory || caseData.fraud_type },
    { label: "Amount involved", value: formatInr(caseData.fraud_amount ?? caseData.amount) },
    {
      label: "Complaint filed",
      value: caseData.reported_at
        ? formatWindow(caseData.reported_at, caseData.reported_at).split(" — ")[0]
        : "—",
    },
    { label: "Prediction window", value: windowLabel },
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
          eyebrow={`Case ${caseData.external_case_id || caseData.case_id}`}
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
                {rows.length} candidates
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
            predictions={rows}
            isLoading={false}
            caseId={String(caseData.case_id)}
            index="01"
            title="Ranked cash-out candidates"
            rankingNote={predictions?.ranking_note}
          />

          <Panel>
            <PanelHeader
              index="02"
              title="Feature attribution"
              meta={<span className="label-caps text-faint">{featureMeta}</span>}
            />
            <ShapContributionChart data={explanation} />
          </Panel>
        </Reveal>

        <Reveal delay={100} className="xl:col-span-5">
          <InvestigationTimeline
            events={timeline}
            index="03"
            title={timelineTotal > timeline.length ? `Investigation timeline · latest ${timeline.length} of ${timelineTotal}` : undefined}
          />
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
          <TransactionGraph trail={trail ?? undefined} />
        </Reveal>
      </section>
    </div>
  );
}
