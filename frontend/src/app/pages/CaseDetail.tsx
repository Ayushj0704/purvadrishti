import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Play } from "lucide-react";
import type * as GeoJSON from "geojson";

import { casesApi } from "../api/cases";
import type {
  Candidate,
  CandidatesResponse,
  CaseRecord,
  CaseReport,
  CaseTransaction,
  Explanation,
  PredictionResponse,
  SimilarCase,
  TimelineResponse,
  TrailResponse,
} from "../api/cases";
import { ApiError } from "../api/client";
import { PredictionFactorChart } from "../charts/PredictionFactorChart";
import { InvestigationTimeline } from "../components/InvestigationTimeline";
import { TopKTable } from "../components/TopKTable";
import { TransactionGraph } from "../components/TransactionGraph";
import { RiskMap } from "../map/RiskMap";
import { PageHeader } from "../components/ui/PageHeader";
import { SectionHeader } from "../components/ui/Eyebrow";
import { Panel, PanelHeader } from "../components/ui/Panel";
import { Reveal } from "../components/ui/Reveal";
import { Skeleton, EmptyState } from "../components/ui/EmptyState";
import { StatusPill } from "../components/ui/StatusDot";
import { Button } from "../components/ui/Button";
import { RiskBadge } from "../components/ui/RiskBadge";
import { formatInr, formatPercent, formatTime, orDash } from "../lib/format";

/**
 * Case workspace — the full investigation chain on one case.
 *
 * The important behavioural rule here is that scoring is an action, not a
 * side effect of opening the page. `POST /cases/{id}/predictions` writes a
 * prediction row for every candidate and can raise an alert, so running it
 * automatically would mean that simply looking at a case changed the
 * deployment's alert queue. The ranked output therefore only exists on screen
 * after the operator asks for it, and the empty state says so rather than
 * implying the case has never been scored.
 */
export function CaseDetail() {
  const { id } = useParams<{ id: string }>();
  const caseId = Number(id);

  const [record, setRecord] = useState<CaseRecord | null>(null);
  const [transactions, setTransactions] = useState<CaseTransaction[]>([]);
  const [timeline, setTimeline] = useState<TimelineResponse | null>(null);
  const [candidates, setCandidates] = useState<CandidatesResponse | null>(null);
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [similar, setSimilar] = useState<SimilarCase[]>([]);
  const [report, setReport] = useState<CaseReport | null>(null);
  const [trail, setTrail] = useState<TrailResponse | null>(null);
  const [trailError, setTrailError] = useState("");

  const [prediction, setPrediction] = useState<PredictionResponse | null>(null);
  const [isPredicting, setIsPredicting] = useState(false);
  const [predictionError, setPredictionError] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async () => {
    if (!Number.isFinite(caseId)) {
      setNotFound(true);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setNotFound(false);
    setLoadError("");
    setPrediction(null);
    setPredictionError("");

    try {
      setRecord(await casesApi.getCase(caseId));
    } catch (caught) {
      if (caught instanceof ApiError && caught.isNotFound) {
        setNotFound(true);
        setIsLoading(false);
        return;
      }
      setLoadError(caught instanceof ApiError ? caught.message : "Could not load this case.");
      setIsLoading(false);
      return;
    }

    // The case exists; everything else is supporting context and settles on its
    // own so one missing endpoint cannot blank the workspace.
    const [txns, events, cands, explain, similars, draft, graph] = await Promise.allSettled([
      casesApi.listTransactions(caseId),
      casesApi.getTimeline(caseId),
      casesApi.getCandidates(caseId),
      casesApi.getExplanation(caseId),
      casesApi.getSimilarCases(caseId),
      casesApi.getReport(caseId),
      casesApi.getTrail(caseId),
    ]);

    if (txns.status === "fulfilled") setTransactions(txns.value);
    if (events.status === "fulfilled") setTimeline(events.value);
    if (cands.status === "fulfilled") setCandidates(cands.value);
    // 404 here is the normal state before a prediction exists, not a failure.
    if (explain.status === "fulfilled") setExplanation(explain.value);
    else setExplanation(null);
    if (similars.status === "fulfilled") setSimilar(similars.value);
    if (draft.status === "fulfilled") setReport(draft.value);

    if (graph.status === "fulfilled") {
      setTrail(graph.value);
      setTrailError("");
    } else {
      setTrail(null);
      setTrailError(
        graph.reason instanceof ApiError
          ? graph.reason.message
          : "Transaction trail unavailable",
      );
    }

    setIsLoading(false);
  }, [caseId]);

  useEffect(() => {
    void load();
  }, [load]);

  const runPrediction = useCallback(async () => {
    setIsPredicting(true);
    setPredictionError("");
    try {
      const result = await casesApi.runPrediction(caseId);
      setPrediction(result);
      // A new top candidate changes the explanation, the timeline and possibly
      // the alert queue, so the dependent panels are re-read rather than
      // patched locally.
      const [explain, events] = await Promise.allSettled([
        casesApi.getExplanation(caseId),
        casesApi.getTimeline(caseId),
      ]);
      if (explain.status === "fulfilled") setExplanation(explain.value);
      if (events.status === "fulfilled") setTimeline(events.value);
    } catch (caught) {
      setPredictionError(
        caught instanceof ApiError ? caught.message : "The prediction could not be completed.",
      );
    } finally {
      setIsPredicting(false);
    }
  }, [caseId]);

  const candidatePoints = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: "FeatureCollection",
      features: (candidates?.candidates ?? []).map((candidate: Candidate) => ({
        type: "Feature",
        id: candidate.atm_id,
        properties: { risk_level: "LOW", atm_code: candidate.atm_code },
        geometry: { type: "Point", coordinates: [candidate.lon, candidate.lat] },
      })),
    }),
    [candidates],
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-10">
        <div className="h-10 w-64 animate-pulse bg-white/[0.04]" />
        <Skeleton rows={6} />
      </div>
    );
  }

  if (notFound || !record) {
    return (
      <div className="flex flex-col gap-10">
        <Link
          to="/cases"
          className="inline-flex items-center gap-2 text-[0.6875rem] font-medium text-faint transition-colors hover:text-accent"
        >
          <ArrowLeft className="size-3" />
          Back to cases
        </Link>
        <Panel>
          <EmptyState
            label={notFound ? "Case not found" : "Case unavailable"}
            detail={
              notFound
                ? `No case with ID ${id} exists on this deployment.`
                : loadError || "The case could not be read."
            }
          >
            <Button variant="ghost" size="sm" onClick={load}>
              Try again
            </Button>
          </EmptyState>
        </Panel>
      </div>
    );
  }

  const facts = [
    { label: "Fraud vector", value: orDash(record.fraud_type) },
    { label: "Amount involved", value: formatInr(record.amount) },
    {
      label: "Victim location",
      value:
        record.victim_location?.lat != null && record.victim_location?.lon != null
          ? `${record.victim_location.lat.toFixed(2)}, ${record.victim_location.lon.toFixed(2)}`
          : "—",
    },
    { label: "Status", value: orDash(record.status).replace(/_/g, " ") },
  ];

  return (
    <div className="flex flex-col gap-20">
      <div>
        <Link
          to="/cases"
          className="inline-flex items-center gap-2 text-[0.6875rem] font-medium text-faint transition-colors hover:text-accent"
        >
          <ArrowLeft className="size-3" />
          Back to cases
        </Link>

        <PageHeader
          className="mt-8"
          index="CASE"
          eyebrow={`Case ${record.case_id} · ${orDash(record.external_case_id)}`}
          title={
            <>
              Money flow
              <br />
              <span className="text-accent">topology.</span>
            </>
          }
          lede="Every hop from victim account to terminal, with the ranked cash-out hypotheses and the feature values behind the top score."
          aside={
            <div className="flex flex-wrap items-center gap-3">
              <StatusPill tone="accent" pulse>
                {orDash(record.status).replace(/_/g, " ")}
              </StatusPill>
              <span className="telemetry text-faint">
                {candidates?.candidates.length ?? 0} candidates
              </span>
            </div>
          }
        />
      </div>

      {loadError && (
        <p
          role="alert"
          className="rounded-lg border border-critical/50 bg-critical/15 px-4 py-3 text-xs text-critical"
        >
          {loadError}
        </p>
      )}

      <Reveal>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-hairline bg-hairline lg:grid-cols-4">
          {facts.map((fact, index) => (
            <div key={fact.label} className="flex flex-col gap-3 bg-surface p-5">
              <span className="label-caps text-faint">
                <span className="tnum text-accent">{String(index + 1).padStart(2, "0")}</span> ·{" "}
                {fact.label}
              </span>
              <span className="telemetry text-ink">{fact.value}</span>
            </div>
          ))}
        </div>
      </Reveal>

      {/* Explicit scoring action. */}
      <Reveal>
        <Panel>
          <PanelHeader
            index="01"
            title="Score this case"
            meta={
              prediction ? (
                <span className="telemetry text-faint">
                  Generated {formatTime(prediction.generated_at)}
                </span>
              ) : undefined
            }
          />

          <div className="flex flex-col gap-5 px-5 py-6">
            <p className="max-w-2xl text-sm leading-relaxed text-muted">
              Scoring evaluates every candidate terminal and writes a prediction row for
              each one. If the top score crosses the alert threshold it also raises an
              alert, so this runs only when you ask for it.
            </p>

            <div className="flex flex-wrap items-center gap-4">
              <Button variant="primary" onClick={runPrediction} disabled={isPredicting}>
                {isPredicting ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Play className="size-3.5" />
                )}
                {isPredicting ? "Scoring" : "Run prediction"}
              </Button>

              {prediction && (
                <span className="flex flex-wrap items-center gap-3">
                  <span className="label-caps text-muted">{prediction.model_version}</span>
                  <span className="telemetry text-faint">
                    {prediction.predictions.length} ranked
                  </span>
                  {prediction.predictions[0] && (
                    <RiskBadge
                      level={prediction.predictions[0].risk_level}
                      score={prediction.predictions[0].score}
                    />
                  )}
                </span>
              )}
            </div>

            {predictionError && (
              <p
                role="alert"
                className="rounded-lg border border-critical/50 bg-critical/15 px-4 py-3 text-xs text-critical"
              >
                {predictionError}
              </p>
            )}

            {prediction && (
              <div className="flex flex-col gap-2 border-t border-hairline pt-4">
                <p className="text-xs leading-relaxed text-muted">{prediction.ranking_note}</p>
                <p className="text-xs leading-relaxed text-faint">{prediction.basis_note}</p>
                {prediction.heat_watch.length > 0 && (
                  <p className="text-xs leading-relaxed text-faint">
                    Burst heat watch:{" "}
                    {prediction.heat_watch
                      .map((entry) => `${entry.atm_id} (${entry.n2h} in 2h)`)
                      .join(", ")}
                  </p>
                )}
              </div>
            )}
          </div>
        </Panel>
      </Reveal>

      {/* Ranked output + factors + timeline */}
      <section className="grid gap-8 xl:grid-cols-12">
        <Reveal className="flex flex-col gap-8 xl:col-span-7">
          <TopKTable
            predictions={prediction?.predictions ?? []}
            title={
              prediction
                ? "Ranked cash-out candidates"
                : "Ranked cash-out candidates — not loaded"
            }
            index="02"
          />

          <Panel>
            <PanelHeader
              index="03"
              title="Prediction factors"
              meta={
                <span className="label-caps text-faint">
                  {explanation?.model_version ?? "No prediction"}
                </span>
              }
            />
            <PredictionFactorChart
              data={Object.entries(explanation?.features ?? {}).map(([feature, value]) => ({
                feature,
                value,
              }))}
            />
          </Panel>
        </Reveal>

        <Reveal delay={100} className="xl:col-span-5">
          <InvestigationTimeline events={timeline?.events ?? []} isLoading={isLoading} index="04" />
        </Reveal>
      </section>

      {/* Candidates */}
      <section className="flex flex-col gap-8">
        <SectionHeader
          index="05"
          label="Candidate terminals"
          title="The search area."
          description="Every terminal the backend considered for this complaint, with the coordinates it was matched on."
        />
        <Reveal>
          <Panel>
            <PanelHeader
              index="05.1"
              title="Candidate map"
              meta={
                <span className="label-caps tnum text-faint">
                  {candidates?.candidates.length ?? 0} terminals
                </span>
              }
            />
            {candidatePoints.features.length === 0 ? (
              <EmptyState
                label="No candidates"
                detail="The backend returned no terminals for this complaint's location."
              />
            ) : (
              <div className="h-[28rem]">
                <RiskMap points={candidatePoints} viewState={undefined} />
              </div>
            )}
          </Panel>
        </Reveal>
      </section>

      {/* Graph + transactions */}
      <section className="flex flex-col gap-8">
        <SectionHeader
          index="06"
          label="Graph analysis"
          title="Follow the hops."
          description="Directed flow from the originating account through each hop to the predicted cash-out terminals."
        />
        <Reveal className="flex flex-col gap-8">
          {trail && trail.nodes.length > 0 ? (
            <TransactionGraph trail={trail} />
          ) : (
            <Panel>
              <PanelHeader
                index="06.1"
                title="Money flow topology"
                meta={<span className="label-caps text-faint">Unavailable</span>}
              />
              <EmptyState
                label="Transaction trail unavailable"
                detail={
                  trailError ||
                  "The graph endpoint returned no nodes for this case. Linked transactions are listed below."
                }
              />
            </Panel>
          )}

          <Panel>
            <PanelHeader
              index="06.2"
              title="Linked transactions"
              meta={
                <span className="label-caps tnum text-faint">{transactions.length} on record</span>
              }
            />
            {transactions.length === 0 ? (
              <EmptyState
                label="No transactions"
                detail="Nothing has been linked to this case yet."
              />
            ) : (
              <div data-lenis-prevent className="overflow-x-auto">
                <table className="data-table min-w-[40rem]">
                  <thead>
                    <tr>
                      <th className="w-40">Transaction</th>
                      <th>Type</th>
                      <th>Bank</th>
                      <th className="text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((transaction) => (
                      <tr key={transaction.txn_id}>
                        <td>
                          <span className="telemetry text-ink">
                            {orDash(transaction.transaction_id)}
                          </span>
                        </td>
                        <td>
                          <span className="text-xs text-muted">
                            {orDash(transaction.type)}
                          </span>
                        </td>
                        <td>
                          <span className="text-xs text-muted">{orDash(transaction.bank)}</span>
                        </td>
                        <td className="text-right">
                          <span className="value tnum text-ink">
                            {formatInr(transaction.amount)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </Reveal>
      </section>

      {/* Similar cases + draft report */}
      <section className="grid gap-8 xl:grid-cols-12">
        <Reveal className="xl:col-span-5">
          <Panel>
            <PanelHeader
              index="07"
              title="Similar cases"
              meta={<span className="label-caps tnum text-faint">{similar.length} matched</span>}
            />
            {similar.length === 0 ? (
              <EmptyState
                label="No comparable cases"
                detail="Nothing on file shares this vector and amount band."
              />
            ) : (
              <ul className="flex flex-col">
                {similar.map((entry) => (
                  <li key={entry.case_id} className="border-b border-hairline-soft last:border-b-0">
                    <Link
                      to={`/cases/${entry.case_id}`}
                      className="flex flex-col gap-1.5 px-5 py-4 transition-colors hover:bg-white/[0.03]"
                    >
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="telemetry text-ink">
                          {orDash(entry.external_case_id)}
                        </span>
                        <span className="telemetry text-faint">
                          {formatInr(entry.amount)}
                        </span>
                      </span>
                      <span className="text-[0.6875rem] text-faint">
                        {orDash(entry.subcategory)} · {orDash(entry.incident_state)}
                        {entry.reported_at ? ` · ${formatTime(entry.reported_at)}` : ""}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </Reveal>

        <Reveal delay={80} className="xl:col-span-7">
          <Panel>
            <PanelHeader
              index="08"
              title="Draft intelligence report"
              meta={
                <span className="label-caps text-faint">
                  {report ? report.banner : "Unavailable"}
                </span>
              }
            />
            {report ? (
              <div className="flex flex-col gap-4 px-5 py-6">
                <h3 className="text-sm font-medium tracking-[-0.01em] text-ink">
                  {report.title}
                </h3>
                <p className="text-xs leading-relaxed text-muted">{report.summary}</p>
                <ul className="flex flex-col gap-1.5 border-t border-hairline pt-4">
                  {report.predictions.map((line, index) => (
                    <li key={index} className="telemetry text-faint">
                      {line}
                    </li>
                  ))}
                </ul>
                <p className="text-[0.6875rem] leading-relaxed text-faint">{report.note}</p>
              </div>
            ) : (
              <EmptyState
                label="No report yet"
                detail="The draft is generated from this case's recorded rows."
              />
            )}
          </Panel>
        </Reveal>
      </section>

      {prediction && prediction.predictions.length > 0 && (
        <p className="text-[0.6875rem] text-faint">
          Top score {formatPercent(prediction.predictions[0].score)} at horizon{" "}
          {prediction.horizon_minutes} minutes, window &ldquo;
          {prediction.predictions[0].predicted_window}&rdquo;.
        </p>
      )}
    </div>
  );
}
