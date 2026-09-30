import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import { casesApi, toTopKRows, expectedLabel } from "../api/cases";
import type { CaseSummary, PredictResponse, ReportResponse, TrailResponse } from "../api/cases";
import { Button } from "../components/ui/Button";
import { Skeleton } from "../components/ui/EmptyState";
import { formatInr, formatTime } from "../lib/format";
import { useRole } from "../lib/useRole";

export function CaseReport() {
  const { id } = useParams<{ id: string }>();
  const role = useRole();
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [caseData, setCaseData] = useState<CaseSummary | null>(null);
  const [predictions, setPredictions] = useState<PredictResponse | null>(null);
  const [trail, setTrail] = useState<TrailResponse | null>(null);
  const [eventCount, setEventCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setIsLoading(true);
    setLoadError("");
    Promise.all([
      casesApi.getReport(id).catch(() => null),
      casesApi.getCase(id).catch(() => null),
      casesApi.predict(id, { horizon_minutes: 60 }).catch(() => null),
      casesApi.getTrail(id).catch(() => null),
      casesApi.getTimeline(id).catch(() => null),
    ]).then(([rep, c, pred, tr, tl]) => {
      if (cancelled) return;
      if (!rep || !c) {
        setLoadError("Case file unavailable. Check the API connection and retry.");
      } else {
        setReport(rep);
        setCaseData(c);
        if (pred) setPredictions(pred);
        if (tr) setTrail(tr);
        if (tl) setEventCount(tl.events.length);
      }
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-10">
        <div className="h-10 w-64 animate-pulse bg-white/[0.04]" />
        <Skeleton rows={8} />
      </div>
    );
  }

  if (loadError || !report || !caseData) {
    return (
      <div className="flex flex-col items-start gap-4">
        <Link
          to={id ? `/cases/${id}` : "/cases"}
          className="inline-flex items-center gap-2 text-[0.6875rem] font-medium text-faint transition-colors hover:text-accent"
        >
          <ArrowLeft className="size-3" />
          Back to case
        </Link>
        <p role="alert" className="text-sm text-critical">
          {loadError || "Case file not found."}
        </p>
      </div>
    );
  }

  const rows = predictions ? toTopKRows(predictions.predictions) : [];
  const generatedAt = new Date().toLocaleString("en-IN", { hour12: false });

  const mules = trail?.nodes.filter((n) => n.kind === "mule").length ?? 0;
  const terminals = trail?.nodes.filter((n) => n.kind === "atm").length ?? 0;
  const lead = rows.find((r) => r.best_bet) ?? rows[0];
  const runnerUp = rows.length > 1 ? rows[1] : undefined;
  const margin =
    lead && runnerUp ? Math.round((lead.risk_score - runnerUp.risk_score) * 1000) / 10 : null;
  const hot = predictions?.heat_watch ?? [];

  const corridor =
    caseData.incident_state && caseData.incident_state !== caseData.complainant_state
      ? `from ${caseData.complainant_state} into ${caseData.incident_state}`
      : `within ${caseData.complainant_state || "the reporting state"}`;
  const narrative = [
    `On ${caseData.reported_at ? new Date(caseData.reported_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "the filing date"}, a ${caseData.crime_subcategory || caseData.fraud_type} fraud of ${formatInr(caseData.fraud_amount ?? caseData.amount)} was reported ${corridor}.`,
    lead
      ? `The model ranks ${lead.atm_id}${lead.state ? ` (${lead.state})` : ""} as the lead cash-out terminal at ${(lead.risk_score * 100).toFixed(1)}% [${lead.risk_level}], with money expected ${expectedLabel(lead).toLowerCase()}${margin != null ? `, leading the next candidate by ${margin} points` : ""}.`
      : `No terminal hypothesis has been scored for this file yet.`,
    rows.length > 1
      ? `${rows.length - 1} further terminal${rows.length === 2 ? " is" : "s are"} on the watchlist.`
      : "",
    mules > 0 || terminals > 0
      ? `The traced money trail spans ${mules} mule account${mules === 1 ? "" : "s"} across ${trail?.depth ?? "—"} layers, ending at ${terminals} predicted cash-out terminal${terminals === 1 ? "" : "s"}.`
      : "",
    hot.length > 0
      ? `Separately, ${hot.length} terminal${hot.length === 1 ? " shows" : "s show"} an observed withdrawal burst in the last 2 hours and must be monitored regardless of rank.`
      : "",
    eventCount > 0 ? `${eventCount} events are logged on the investigation timeline.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <Link
          to={`/cases/${caseData.case_id}`}
          className="inline-flex items-center gap-2 text-[0.6875rem] font-medium text-faint transition-colors hover:text-accent"
        >
          <ArrowLeft className="size-3" />
          Back to case
        </Link>
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="size-3" />
          Print / save PDF
        </Button>
      </div>

      {/* Paper dossier: light card on screen so screen == print. */}
      <article className="overflow-hidden rounded-xl bg-[#f5f5f4] text-neutral-900">
        <div className="border-b-4 border-double border-neutral-400 px-8 py-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[0.6875rem] font-bold uppercase tracking-[0.18em] text-neutral-500">
                PurvaDrishti · Cash-out intelligence
              </p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight">{report.title}</h1>
              <p className="mt-1 font-mono text-xs text-neutral-500">
                {report.banner} · Generated {generatedAt} · Filed by {role ?? "console"}
              </p>
            </div>
            <img src="/logo.png" alt="PurvaDrishti" className="size-14 rounded-lg" />
          </div>
        </div>

        <div className="space-y-6 px-8 py-6">
          <section>
            <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">
              1 · Situation overview
            </h2>
            <p className="mt-2 text-sm leading-relaxed">{narrative}</p>
          </section>

          <section>
            <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">
              2 · Complaint summary
            </h2>
            <p className="mt-2 text-sm leading-relaxed">{report.summary}</p>
            <dl className="mt-3 grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-[0.6875rem] uppercase tracking-wider text-neutral-500">Case</dt>
                <dd className="font-mono">{caseData.external_case_id}</dd>
              </div>
              <div>
                <dt className="text-[0.6875rem] uppercase tracking-wider text-neutral-500">Amount</dt>
                <dd className="font-semibold">{formatInr(caseData.fraud_amount ?? caseData.amount)}</dd>
              </div>
              <div>
                <dt className="text-[0.6875rem] uppercase tracking-wider text-neutral-500">Corridor</dt>
                <dd>
                  {caseData.complainant_state || "—"}
                  {caseData.incident_state && caseData.incident_state !== caseData.complainant_state
                    ? ` → ${caseData.incident_state}`
                    : ""}
                </dd>
              </div>
              <div>
                <dt className="text-[0.6875rem] uppercase tracking-wider text-neutral-500">Filed</dt>
                <dd>{caseData.reported_at ? formatTime(caseData.reported_at) : "—"}</dd>
              </div>
            </dl>
          </section>

          <section>
            <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">
              3 · Ranked cash-out hypotheses
              {predictions ? ` · model ${predictions.model_version}` : ""}
            </h2>
            {rows.length > 0 ? (
              <table className="mt-3 w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b-2 border-neutral-800 text-left text-[0.6875rem] uppercase tracking-wider text-neutral-500">
                    <th className="py-2 pr-4">#</th>
                    <th className="py-2 pr-4">Terminal</th>
                    <th className="py-2 pr-4">State</th>
                    <th className="py-2 pr-4">Risk</th>
                    <th className="py-2 pr-4 text-right">Score</th>
                    <th className="py-2 text-right">Expected</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.atm_id} className="border-b border-neutral-300">
                      <td className="py-2 pr-4 font-mono">{String(i + 1).padStart(2, "0")}</td>
                      <td className="py-2 pr-4 font-semibold">
                        {r.atm_id}
                        {r.best_bet ? " ★" : ""}
                      </td>
                      <td className="py-2 pr-4">{r.state || "—"}</td>
                      <td className="py-2 pr-4">{r.risk_level}</td>
                      <td className="py-2 pr-4 text-right font-mono">
                        {(r.risk_score * 100).toFixed(1)}%
                      </td>
                      <td className="py-2 text-right">{expectedLabel(r)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="mt-2 text-sm">No scored hypotheses on record for this case.</p>
            )}
            {predictions?.ranking_note && (
              <p className="mt-2 text-xs italic text-neutral-600">{predictions.ranking_note}</p>
            )}
          </section>

          <section>
            <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">
              4 · Model notes
            </h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed">
              {report.predictions.map((line, i) => (
                <li key={i} className="font-mono text-[0.8125rem]">
                  {line}
                </li>
              ))}
            </ul>
          </section>

          <footer className="border-t border-neutral-400 pt-4 text-xs leading-relaxed text-neutral-600">
            <p>{report.note}</p>
            <p className="mt-1">
              Authorised human decision-makers only. Data: observed backend records; nothing
              synthesised for this file.
            </p>
          </footer>
        </div>
      </article>
    </div>
  );
}
