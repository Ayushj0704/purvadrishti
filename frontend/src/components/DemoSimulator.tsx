import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Play, Square, Check } from "lucide-react";
import { Wordmark } from "./layout/Wordmark";
import { cn } from "../lib/cn";

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

  const stop = () => {
    if (stopTimer.current) clearTimeout(stopTimer.current);
    stopTimer.current = null;
    setIsRunning(false);
    setStepIndex(-1);
  };

  useEffect(() => {
    if (!isRunning || stepIndex >= DEMO_STEPS.length - 1) return;

    const nextIndex = stepIndex + 1;
    const step = DEMO_STEPS[nextIndex];

    const timer = setTimeout(() => {
      setStepIndex(nextIndex);
      if (step.id === "alert") navigate("/alerts");
      if (step.id === "action") {
        navigate("/cases/C10234");
        stopTimer.current = setTimeout(stop, 2000);
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
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3 sm:bottom-7 sm:right-7">
      {isRunning && stepIndex >= 0 && (
        <div className="w-72 animate-rise overflow-hidden rounded-xl border border-hairline bg-void/95 backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
            <span className="label-caps text-muted">Sequence</span>
            <span className="telemetry text-accent">
              {String(stepIndex + 1).padStart(2, "0")} / {String(DEMO_STEPS.length).padStart(2, "0")}
            </span>
          </div>
          <ol className="flex flex-col">
            {DEMO_STEPS.map((step, idx) => {
              const isPast = idx < stepIndex;
              const isActive = idx === stepIndex;
              return (
                <li
                  key={step.id}
                  className={cn(
                    "flex items-center gap-3 border-b border-hairline-soft px-4 py-2.5 last:border-b-0 transition-colors",
                    isActive && "bg-accent/[0.08]",
                  )}
                >
                  <span className="flex size-3.5 shrink-0 items-center justify-center">
                    {isPast ? (
                      <Check className="size-3 text-stable" />
                    ) : isActive ? (
                      <span className="size-1.5 animate-pulse rounded-full bg-accent" />
                    ) : (
                      <span className="size-1.5 rounded-full border border-hairline" />
                    )}
                  </span>
                  <span
                    className={cn(
                      "text-[0.8125rem] leading-snug transition-colors",
                      isPast && "text-faint",
                      isActive && "text-ink",
                      !isPast && !isActive && "text-faint/50",
                    )}
                  >
                    {step.label}
                  </span>
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
            ? "border-critical/50 bg-critical/10 text-critical hover:bg-critical/20"
            : "border-hairline bg-void/90 text-muted backdrop-blur hover:border-accent hover:text-ink",
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
