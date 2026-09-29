import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Play, Square } from "lucide-react";
import { Wordmark } from "./layout/Wordmark";
import { cn } from "../lib/cn";
import { CallChip } from "./CallChip";
import { casesApi } from "../api";
import type { CaseSummary } from "../api/cases";

const DEMO_STEPS = [
  { id: "txn", label: "Fraud transaction observed", delay: 1500 },
  { id: "complaint", label: "Complaint registered", delay: 1500 },
  { id: "candidates", label: "Candidate ATMs generated", delay: 2000 },
  { id: "scored", label: "XGBoost risk scoring", delay: 2500 },
  { id: "alert", label: "High-risk alert dispatched", delay: 1000 },
  { id: "action", label: "Investigator opens case", delay: 1000 },
];

export function DemoSimulator() {
  const [isRunning, setIsRunning] = useState(false);
  const [stepIndex, setStepIndex] = useState(-1);
  const navigate = useNavigate();
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * The sequence ends on a real case, so the ID is resolved from the register at
   * the moment the run starts rather than hard-coded to an ID that may not exist.
   * Held in a ref because the step machine must not re-run when it resolves.
   */
  const caseIdRef = useRef<string | null>(null);

  const stop = useCallback(() => {
    if (stopTimer.current) clearTimeout(stopTimer.current);
    stopTimer.current = null;
    setIsRunning(false);
    setStepIndex(-1);
    caseIdRef.current = null;
    navigate("/");
  }, [navigate]);

  useEffect(() => {
    if (!isRunning || stepIndex >= DEMO_STEPS.length - 1) return;

    const nextIndex = stepIndex + 1;
    const step = DEMO_STEPS[nextIndex];

    const timer = setTimeout(() => {
      setStepIndex(nextIndex);
      if (step.id === "alert") navigate("/alerts");
      if (step.id === "action") {
        // Falls back to the register itself when no single case could be
        // resolved, so the sequence never lands on a dead route.
        const target = caseIdRef.current;
        navigate(target ? `/cases/${encodeURIComponent(target)}` : "/cases");
        stopTimer.current = setTimeout(stop, 2000);
      }
    }, step.delay);

    return () => clearTimeout(timer);
  }, [isRunning, stepIndex, navigate, stop]);

  useEffect(() => () => {
    if (stopTimer.current) clearTimeout(stopTimer.current);
  }, []);

  const start = () => {
    navigate("/");
    setStepIndex(-1);
    setIsRunning(true);

    // Best effort: a failure here only costs the final jump its specific case.
    casesApi
      .listCases({ limit: 1 })
      .then((result: { cases: CaseSummary[] }) => {
        caseIdRef.current = result.cases?.[0]?.case_id ?? null;
      })
      .catch(() => {
        caseIdRef.current = null;
      });
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3 sm:bottom-7 sm:right-7">
      {isRunning && stepIndex >= 0 && (
        <div className="w-72 animate-rise overflow-hidden rounded-xl border border-hairline bg-surface/95 backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
            <span className="label-caps text-muted">Sequence</span>
            <span className="telemetry text-accent">
              {String(stepIndex + 1).padStart(2, "0")} / {String(DEMO_STEPS.length).padStart(2, "0")}
            </span>
          </div>
          <ol className="flex flex-col gap-1 p-2">
            {DEMO_STEPS.map((step, idx) => {
              const status = idx < stepIndex ? "done" : idx === stepIndex ? "running" : "idle";
              return (
                <li key={step.id}>
                  <CallChip
                    name={step.label}
                    argument=""
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
