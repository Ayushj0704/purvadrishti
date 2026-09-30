import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Check, Printer, Send } from "lucide-react";

import { casesApi, toTopKRows, toAtmPoints, trailToEntities, expectedLabel, HORIZON_OPTIONS } from "../api/cases";
import type { CaseSummary, PredictResponse, TrailResponse, PredictionCandidate } from "../api/cases";
import { alertsApi } from "../api/alerts";
import type { Alert } from "../api/alerts";
import { ShapContributionChart } from "../charts/ShapContributionChart";
import type { ShapFeature } from "../charts/ShapContributionChart";
import { InvestigationTimeline } from "../components/InvestigationTimeline";
import type { TimelineEvent, TimelineKind } from "../components/InvestigationTimeline";
import type { TimelineItem } from "../api/cases";
import { TopKTable } from "../components/TopKTable";
import { TransactionGraph } from "../components/TransactionGraph";
import { RiskMap } from "../map/RiskMap";
import { PageHeader } from "../components/ui/PageHeader";
import { SectionHeader } from "../components/ui/Eyebrow";
import { Panel, PanelHeader } from "../components/ui/Panel";
import { Reveal } from "../components/ui/Reveal";
import { Loader } from "../components/ui/Loader";
import { StatusPill } from "../components/ui/StatusDot";
import { Button, ButtonLink } from "../components/ui/Button";
import { formatInr, formatWindow } from "../lib/format";
import { canWrite, useRole } from "../lib/useRole";

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
  const entries = Object.entries(features ?? {}).filter(([, v]) => Number.isFinite(v));
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
  const role = useRole();
  const writable = canWrite(role);
  const [caseData, setCaseData] = useState<CaseSummary | null>(null);
  const [horizon, setHorizon] = useState(60);
  const [predictions, setPredictions] = useState<PredictResponse | null>(null);
  const [explanation, setExplanation] = useState<ShapFeature[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [timelineTotal, setTimelineTotal] = useState(0);
  const [trail, setTrail] = useState<TrailResponse | null>(null);
  const [openAlert, setOpenAlert] = useState<Alert | null>(null);
  const [actionNote, setActionNote] = useState("");
  const [acting, setActing] = useState<"ack" | "notify" | null>(null);
  const [modelVersion, setModelVersion] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [scoring, setScoring] = useState(false);
  const [detailsDone, setDetailsDone] = useState(false);
  const [minRisk, setMinRisk] = useState("ALL");
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

        const [expl, tl] = await Promise.all([
          casesApi.getExplanations(id).catch(() => null),
          casesApi.getTimeline(id).catch(() => null),
        ]);
        if (cancelled) return;
        if (expl) {
          setExplanation(featuresToShap(expl.features));
          setModelVersion(expl.model_version);
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

  // Horizon-scoped scoring: re-runs the model at the selected horizon and
  // refreshes every surface derived from predictions.
  useEffect(() => {
    if (!id || !caseData) return;
    let cancelled = false;
    setScoring(true);
    setDetailsDone(false);

    const score = async () => {
      const [pred, tr, al] = await Promise.all([
        writable ? casesApi.predict(id, { horizon_minutes: horizon }).catch(() => null) : null,
        casesApi.getTrail(id).catch(() => null),
        alertsApi.getAlerts().catch(() => [] as Alert[]),
      ]);
      if (cancelled) return;
      if (pred) {
        setPredictions(pred);
        setModelVersion(pred.model_version);
      }
      if (tr) setTrail(tr);
      setOpenAlert(al.find((a) => a.case_id === Number(id) && a.status === "NEW") ?? null);
      setScoring(false);
      setDetailsDone(true);
    };

    score();
    return () => {
      cancelled = true;
    };
  }, [id, caseData, horizon, writable]);

  const rows = predictions ? toTopKRows(predictions.predictions) : [];
  // NOTE: hooks must stay above every early return — a memo placed after
  // `if (isLoading) return …` renders more hooks on later passes (React #310).
  const atmPoints = useMemo(() => {
    const heatByAtm = new Map(
      (predictions?.heat_watch ?? []).map((w) => [w.atm_id, "HIGH"]),
    );
    const list = rows.map((r) => ({ ...r, heat_level: heatByAtm.get(r.atm_id) ?? "LOW" }));
    return toAtmPoints(list);
  }, [rows, predictions]);
  const entities = useMemo(() => trailToEntities(trail), [trail]);
  const RISK_RANK: Record<string, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };
  const visibleAtms = useMemo(() => {
    if (minRisk === "ALL") return atmPoints;
    const floor = RISK_RANK[minRisk] ?? 0;
    return {
      ...atmPoints,
      features: atmPoints.features.filter(
        (f) => (RISK_RANK[String(f.properties?.risk_level)] ?? 0) >= floor,
      ),
    };
  }, [atmPoints, minRisk]);

  // Whole-data gate: nothing renders half-empty. The header, tables, map and
  // graph appear together once case + scoring + trail + timeline all settle.
  const ready = !isLoading && detailsDone;

  if (notFound || (!isLoading && !caseData)) {
    return <p className="text-sm text-critical">Case {id} not found.</p>;
  }

  if (!ready) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-6 text-center">
        <Loader label={scoring ? "Scoring candidates against live model…" : "Loading case file…"} />
        <p className="max-w-sm text-xs leading-relaxed text-faint">
          Pulling complaint, predictions, timeline, trail and alerts together — the file
          opens complete, never half-empty.
        </p>
      </div>
    );
  }

  if (!caseData) {
    return <p className="text-sm text-critical">Case {id} not found.</p>;
  }

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

  const best: PredictionCandidate | undefined =
    rows.find((r) => r.best_bet) ?? rows[0];
  const heatWatch = predictions?.heat_watch ?? [];

  const handleAcknowledge = async () => {
    if (!openAlert) return;
    setActing("ack");
    setActionNote("");
    try {
      await alertsApi.acknowledgeAlert(openAlert.alert_id);
      setOpenAlert(null);
      setActionNote(`Alert ${openAlert.alert_id} acknowledged and audit-logged.`);
    } catch {
      setActionNote("Acknowledge failed. Check the API connection and retry.");
    } finally {
      setActing(null);
    }
  };

  const handleNotify = async () => {
    const target = openAlert ?? (await alertsApi.getAlerts().catch(() => [] as Alert[]))
      .find((a) => a.case_id === caseData.case_id);
    if (!target) {
      setActionNote("No alert on record for this case yet — scoring has not crossed the threshold.");
      return;
    }
    setActing("notify");
    setActionNote("");
    try {
      const res = await alertsApi.notifyAlert(target.alert_id);
      const summary = res.delivery.map((d) => `${d.channel}: ${d.status}`).join(" · ");
      setActionNote(`Re-dispatched alert ${target.alert_id} — ${summary}.`);
    } catch {
      setActionNote("Re-dispatch failed. Check the API connection and retry.");
    } finally {
      setActing(null);
    }
  };

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
                {(caseData.status ?? "OPEN").replace("_", " ")}
              </StatusPill>
              <span className="telemetry text-faint">
                {rows.length} candidates
              </span>
              <ButtonLink to={`/cases/${caseData.case_id}/report`} variant="primary" size="sm">
                <Printer className="size-3" />
                Case file — view & download
              </ButtonLink>
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
          <div className="flex items-center justify-between gap-4">
            <span className="label-caps text-faint">
              Scoring horizon{scoring ? " · scoring…" : ""}
            </span>
            <select
              value={horizon}
              onChange={(e) => setHorizon(Number(e.target.value))}
              disabled={!writable}
              aria-label="Scoring horizon"
              title={writable ? "Re-score at this horizon" : "Requires LEA Officer role or above"}
              className="field field-mono w-auto"
            >
              {HORIZON_OPTIONS.map((h) => (
                <option key={h.minutes} value={h.minutes}>
                  {h.label}
                </option>
              ))}
            </select>
          </div>

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

      {/* Predicted locations + recommended next actions */}
      <section className="flex flex-col gap-8">
        <SectionHeader
          index="04"
          label="Action layer"
          title="Where, when, what next."
          description="Ranked terminals pinned to the map with their expected cash-out windows, and the next actions the duty officer can take from this file."
        />
        <div className="grid gap-8 xl:grid-cols-12">
          <Reveal className="xl:col-span-7">
            <Panel className="h-full">
              <PanelHeader
                index="04.1"
                title="Predicted locations"
              meta={
                <span className="label-caps tnum text-faint">
                  {visibleAtms.features.length} terminals · {HORIZON_OPTIONS.find((h) => h.minutes === horizon)?.label}
                </span>
              }
            />
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-hairline px-5 py-3">
              <span className="label-caps text-faint">Show pins</span>
              <select
                value={minRisk}
                onChange={(e) => setMinRisk(e.target.value)}
                aria-label="Minimum pin risk"
                className="field field-mono w-auto py-1.5 text-xs"
              >
                {["ALL", "LOW", "MEDIUM", "HIGH", "CRITICAL"].map((r) => (
                  <option key={r} value={r}>
                    {r === "ALL" ? "All pins" : `${r}+`}
                  </option>
                ))}
              </select>
              <span className="telemetry text-faint">Tap a pin for coordinates, region & distance</span>
            </div>
              <div className="h-[clamp(20rem,44vh,30rem)]">
                <RiskMap candidateAtms={visibleAtms} entities={entities} />
              </div>
            </Panel>
          </Reveal>

          <Reveal delay={100} className="xl:col-span-5">
            <Panel className="h-full">
              <PanelHeader
                index="04.2"
                title="Recommended actions"
                meta={<span className="label-caps tnum text-faint">Derived from this file</span>}
              />
              <ol className="flex flex-col gap-px bg-hairline">
                {best && (
                  <li className="flex flex-col gap-1.5 bg-surface px-5 py-4">
                    <span className="label-caps text-accent">
                      {best.risk_level === "CRITICAL" || best.risk_level === "HIGH"
                        ? "Verify on priority"
                        : "Keep on watchlist"}
                    </span>
                    <span className="text-sm text-ink">
                      {best.atm_id} — {expectedLabel(best)}
                    </span>
                    {best.basis && (
                      <span className="text-xs leading-relaxed text-faint">{best.basis}</span>
                    )}
                  </li>
                )}
                {heatWatch.length > 0 && (
                  <li className="flex flex-col gap-1.5 bg-surface px-5 py-4">
                    <span className="label-caps text-elevated-risk">Monitor burst terminals</span>
                    <span className="text-sm text-ink">
                      {heatWatch.length} bursting ATM{heatWatch.length === 1 ? "" : "s"}:{" "}
                      {heatWatch.slice(0, 3).map((w) => w.atm_id).join(", ")}
                      {heatWatch.length > 3 ? ` +${heatWatch.length - 3} more` : ""}
                    </span>
                    <span className="text-xs leading-relaxed text-faint">
                      Observed withdrawal bursts, independent of case rank.
                    </span>
                  </li>
                )}
                {!best && heatWatch.length === 0 && (
                  <li className="bg-surface px-5 py-4 text-xs text-faint">
                    Score this case to generate terminal hypotheses and actions.
                  </li>
                )}
              </ol>
              <div className="flex flex-wrap items-center gap-3 border-t border-hairline px-5 py-4">
                <Button
                  size="sm"
                  onClick={handleAcknowledge}
                  disabled={!writable || acting !== null || !openAlert}
                  title={
                    !writable
                      ? "Requires LEA Officer role or above"
                      : openAlert
                        ? `Acknowledge alert ${openAlert.alert_id}`
                        : "No open alert for this case"
                  }
                >
                  <Check className="size-3" />
                  {acting === "ack" ? "Saving…" : "Acknowledge alert"}
                </Button>
                <Button size="sm" onClick={handleNotify} disabled={!writable || acting !== null}>
                  <Send className="size-3" />
                  {acting === "notify" ? "Sending…" : "Re-dispatch SMS / Email"}
                </Button>
                {acting && (
                  <span className="telemetry text-faint" role="status">
                    Working…
                  </span>
                )}
              </div>
              {actionNote && (
                <p role="status" className="border-t border-hairline px-5 py-3 text-xs text-muted">
                  {actionNote}
                </p>
              )}
              {!writable && (
                <p className="border-t border-hairline px-5 py-3 text-[0.6875rem] text-faint">
                  Actions require the LEA Officer role or above.
                </p>
              )}
            </Panel>
          </Reveal>
        </div>
      </section>

      <section className="flex flex-col gap-8">
        <SectionHeader
          index="05"
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
