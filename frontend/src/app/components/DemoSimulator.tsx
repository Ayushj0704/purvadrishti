import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Play, Square } from "lucide-react";
import { Wordmark } from "./layout/Wordmark";
import { cn } from "../lib/cn";
import { CallChip } from "./CallChip";
import { casesApi } from "../api/cases";
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

  const reset = () => {
    if (stopTimer.current) clearTimeout(stopTimer.current);
    stopTimer.current = null;
    setIsRunning(false);
    setStepIndex(-1);
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
        // Open a real case from the backend pool, not a fixed id.
        casesApi
          .sampleCases(1)
          .then((samples) => navigate(samples.length > 0 ? `/cases/${samples[0].case_id}` : "/"))
          .catch(() => navigate("/"));
        stopTimer.current = setTimeout(reset, 2000);
      }
    }, step.delay);

    return () => clearTimeout(timer);
  }, [isRunning, stepIndex, navigate]);

  useEffect(() => () => {
    if (stopTimer.current) clearTimeout(stopTimer.current);
  }, []);

  const start = () => {
    navigate("/");
    setStepIndex(-1);
    setIsRunning(true);
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3 print:hidden sm:bottom-7 sm:right-7">
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
