import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Play, Square } from "lucide-react";
import { Wordmark } from "./layout/Wordmark";
import { cn } from "../lib/cn";
import { CallChip } from "./CallChip";
import { casesApi, expectedLabel } from "../api/cases";
import { formatInr } from "../lib/format";
const DEMO_STEPS = [
  { id: "txn", label: "Fraud transaction observed", delay: 1500 },
  { id: "complaint", label: "Complaint registered", delay: 1500 },
  { id: "candidates", label: "Candidate ATMs generated", delay: 2000 },
  { id: "scored", label: "XGBoost risk scoring", delay: 2500 },
  { id: "alert", label: "High-risk alert dispatched", delay: 1000 },
  { id: "action", label: "Investigator opens case", delay: 1000 },
];

interface DemoFacts {
  caseRef: string;
  caseId: number;
  txn: string;
  complaint: string;
  candidates: string;
  scored: string;
  alert: string;
  action: string;
}

export function DemoSimulator() {
  const [isRunning, setIsRunning] = useState(false);
  const [stepIndex, setStepIndex] = useState(-1);
  const [facts, setFacts] = useState<DemoFacts | null>(null);
  const [liveCaseId, setLiveCaseId] = useState<number | null>(null);
  const navigate = useNavigate();
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = () => {
    if (stopTimer.current) clearTimeout(stopTimer.current);
    stopTimer.current = null;
    setIsRunning(false);
    setStepIndex(-1);
    setFacts(null);
    setLiveCaseId(null);
  };

  // Manual stop returns to the Overview; the automatic end-of-sequence reset
  // leaves the investigator on the opened case.
  const stop = () => {
    reset();
    navigate("/");
  };

  useEffect(() => {
    if (!isRunning || stepIndex >= DEMO_STEPS.length - 1) return;

    const nextIndex = stepIndex + 1;
    const step = DEMO_STEPS[nextIndex];

    const timer = setTimeout(() => {
      setStepIndex(nextIndex);
      if (step.id === "alert") navigate("/alerts");
      if (step.id === "action") {
        // Open the same live case the facts describe — never a fixed id.
        // (If the background fetch is still slow, grab one on the spot.)
        const go = (id: number | null) => navigate(id ? `/cases/${id}` : "/");
        if (liveCaseId) {
          go(liveCaseId);
        } else {
          casesApi
            .sampleCases(1)
            .then((samples) => go(samples.length > 0 ? samples[0].case_id : null))
            .catch(() => go(null));
        }
        stopTimer.current = setTimeout(reset, 2000);
      }
    }, step.delay);

    return () => clearTimeout(timer);
  }, [isRunning, stepIndex, navigate, liveCaseId]);

  useEffect(() => () => {
    if (stopTimer.current) clearTimeout(stopTimer.current);
  }, []);

  const start = () => {
    navigate("/");
    setStepIndex(-1);
    setFacts(null);
    setLiveCaseId(null);
    // Sequence starts instantly; the live file loads behind it and each
    // step's facts pop in when ready — never block the show on scoring.
    setIsRunning(true);
    void (async () => {
      // Pull one live case up front so every step narrates real data —
      // amount, corridor, best terminal, window — instead of labels alone.
      try {
        const samples = await casesApi.sampleCases(1);
        if (samples.length > 0) {
          const s = samples[0];
          setLiveCaseId(s.case_id);
          const [c, pred] = await Promise.all([
            casesApi.getCase(s.case_id).catch(() => null),
            casesApi.predict(s.case_id, { horizon_minutes: 60 }).catch(() => null),
          ]);
          const top = pred?.predictions[0];
          const amount = formatInr(s.amount ?? c?.fraud_amount ?? c?.amount ?? 0);
          const vector = s.subcategory ?? c?.crime_subcategory ?? c?.fraud_type ?? "fraud";
          const corridor = [s.complainant_state, s.incident_state]
            .filter(Boolean)
            .filter((v, i, a) => a.indexOf(v) === i)
            .join(" → ");
          setFacts({
            caseRef: s.external_case_id,
            caseId: s.case_id,
            txn: `${amount} · ${vector}${corridor ? ` · ${corridor}` : ""}`,
            complaint: `${s.external_case_id} filed${s.incident_state ? ` · ${s.incident_state}` : ""}`,
            candidates: pred ? `${pred.predictions.length} terminals in radius` : "radius swept",
            scored: top
              ? `${top.atm_id} · ${(top.score * 100).toFixed(1)}% · ${expectedLabel(top)}`
              : "model scoring…",
            alert: top ? `${top.risk_level} terminal · ${top.predicted_window}` : "below threshold",
            action: `opening ${s.external_case_id}`,
          });
        }
      } catch {
        /* facts stay empty — step labels still run */
      }
    })();
  };

  const argumentFor = (id: string): string => {
    if (!facts) return "";
    switch (id) {
      case "txn":
        return facts.txn;
      case "complaint":
        return facts.complaint;
      case "candidates":
        return facts.candidates;
      case "scored":
        return facts.scored;
      case "alert":
        return facts.alert;
      case "action":
        return facts.action;
      default:
        return "";
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3 print:hidden sm:bottom-7 sm:right-7">
      {isRunning && stepIndex >= 0 && (
        <div className="w-72 animate-rise overflow-hidden rounded-xl border border-hairline bg-surface/95 backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
            <span className="label-caps text-muted">
              Sequence{facts ? ` · ${facts.caseRef}` : ""}
            </span>
            <span className="telemetry text-accent">
              {String(stepIndex + 1).padStart(2, "0")} / {String(DEMO_STEPS.length).padStart(2, "0")}
            </span>
          </div>
          {facts && (
            <p className="border-b border-hairline px-4 py-2 text-[0.6875rem] text-stable">
              ● Live file — every step below carries this case's real data
            </p>
          )}
          <ol className="flex flex-col gap-1 p-2">
            {DEMO_STEPS.map((step, idx) => {
              const status = idx < stepIndex ? "done" : idx === stepIndex ? "running" : "idle";
              return (
                <li key={step.id}>
                  <CallChip
                    name={step.label}
                    argument={argumentFor(step.id)}
                    status={status}
                    expectedMs={step.delay}
                    className="w-full"
                    surfaceColor="transparent"
                  />
                </li>
              );
            })}
          </ol>
        </div>
      )}

      <button
        onClick={isRunning ? stop : start}
        className={cn(
          "label-caps inline-flex items-center gap-2.5 rounded-full border px-4 py-3 transition-all duration-200",
          isRunning
            ? "border-critical/50 bg-critical/20 text-critical hover:bg-critical/30"
            : "border-hairline bg-surface/90 text-muted backdrop-blur hover:border-accent hover:text-ink",
        )}
      >
        <Wordmark className="size-3.5 text-accent" />
        {isRunning ? (
          <>
            <Square className="size-3" fill="currentColor" />
            Stop
          </>
        ) : (
          <>
            <Play className="size-3" fill="currentColor" />
            Run demo sequence
          </>
        )}
      </button>
    </div>
  );
}
