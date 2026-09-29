import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, Loader2, X } from "lucide-react";
import { Wordmark } from "./layout/Wordmark";
import { casesApi } from "../api/cases";
import type { SampleCase } from "../api/cases";
import { ApiError } from "../api/client";
import { getRole, hasRole } from "../api/auth";
import { formatInr, orDash } from "../lib/format";
import { cn } from "../lib/cn";

/**
 * Portal-push walkthrough, replacing the old scripted "demo sequence".
 *
 * The previous version replayed a fixed timeline of six fake steps and then
 * navigated to a hardcoded case. This one exercises the real intake path:
 * sample cases come from the database, the acknowledgement ID is posted to the
 * ingest endpoint, and the operator lands on whatever case the backend actually
 * created or matched. Ingest is idempotent on the acknowledgement ID, so
 * re-running it on a sample that is already on file is a no-op that resolves to
 * the existing case rather than an error.
 */
export function SampleIngest() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isIngesting, setIsIngesting] = useState(false);
  const [samples, setSamples] = useState<SampleCase[] | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const panelRef = useRef<HTMLDivElement>(null);

  const loadSamples = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      setSamples(await casesApi.getSamples({ limit: 20 }));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not load sample cases.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && samples === null && !isLoading && !error) {
      void loadSamples();
    }
  }, [isOpen, samples, isLoading, error, loadSamples]);

  const ingest = useCallback(async () => {
    const sample = samples?.find((s) => s.case_id === selected);
    if (!sample) return;

    setIsIngesting(true);
    setError("");
    try {
      const result = await casesApi.ingestCase({
        external_case_id: sample.external_case_id,
        fraud_type: sample.subcategory || "UPI",
        crime_subcategory: sample.subcategory,
        amount: sample.amount ?? 0,
        incident_state: sample.incident_state ?? "",
        complainant_state: sample.complainant_state ?? "",
        source_system: "CFCFRMS",
      });
      setIsOpen(false);
      navigate(`/cases/${result.case_id}`);
    } catch (caught) {
      if (caught instanceof ApiError && caught.isForbidden) {
        setError("Ingesting a portal push requires an LEA officer role or above.");
      } else if (caught instanceof ApiError && caught.isNotFound) {
        setError("The sample case no longer exists.");
      } else {
        setError(caught instanceof ApiError ? caught.message : "Ingest failed.");
      }
    } finally {
      setIsIngesting(false);
    }
  }, [samples, selected, navigate]);

  // The portal push is an LEA action. The other roles still see the control so
  // the reason it is unavailable is visible rather than silently missing.
  const canIngest = hasRole("LEA_OFFICER");

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3 sm:bottom-7 sm:right-7">
      {isOpen && (
        <div
          ref={panelRef}
          className="w-[min(22rem,calc(100vw-2.5rem))] animate-rise overflow-hidden rounded-xl border border-hairline bg-surface/95 backdrop-blur-xl"
        >
          <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
            <span className="label-caps text-muted">Portal sample fetch</span>
            <button
              onClick={() => setIsOpen(false)}
              aria-label="Close"
              className="rounded-md p-1 text-faint transition-colors hover:text-ink"
            >
              <X className="size-3.5" />
            </button>
          </div>

          <div className="max-h-72 overflow-y-auto">
            {isLoading ? (
              <p className="px-4 py-8 text-center text-xs text-faint">Loading samples…</p>
            ) : samples && samples.length > 0 ? (
              <ul className="flex flex-col">
                {samples.map((sample) => (
                  <li key={sample.case_id}>
                    <button
                      onClick={() => setSelected(sample.case_id)}
                      className={cn(
                        "flex w-full flex-col gap-1 border-b border-hairline-soft px-4 py-3 text-left transition-colors last:border-b-0",
                        selected === sample.case_id ? "bg-white/[0.05]" : "hover:bg-white/[0.03]",
                      )}
                    >
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="telemetry text-ink">{sample.external_case_id}</span>
                        <span className="telemetry text-faint">
                          {formatInr(sample.amount ?? null)}
                        </span>
                      </span>
                      <span className="text-[0.6875rem] text-faint">
                        {orDash(sample.subcategory)} · {orDash(sample.incident_state)} ·{" "}
                        {sample.source}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : !error ? (
              <p className="px-4 py-8 text-center text-xs text-faint">
                No sample cases on file yet.
              </p>
            ) : null}
          </div>

          {error && (
            <p role="alert" className="border-t border-hairline px-4 py-3 text-[0.6875rem] text-critical">
              {error}
            </p>
          )}

          <div className="flex items-center justify-between gap-3 border-t border-hairline px-4 py-3">
            <span className="text-[0.6875rem] text-faint">
              Signed in as {orDash(getRole())}
            </span>
            <button
              onClick={ingest}
              disabled={selected === null || isIngesting || !canIngest}
              className="label-caps inline-flex items-center gap-2 rounded-md border border-accent-strong bg-accent-strong px-3 py-2 text-white transition-colors hover:bg-accent-hover disabled:pointer-events-none disabled:opacity-40"
            >
              {isIngesting ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Download className="size-3" />
              )}
              {isIngesting ? "Ingesting" : "Ingest"}
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setIsOpen((open) => !open)}
        className={cn(
          "label-caps inline-flex items-center gap-2.5 rounded-full border px-4 py-3 transition-all duration-200",
          isOpen
            ? "border-critical/50 bg-critical/20 text-critical hover:bg-critical/30"
            : "border-hairline bg-surface/90 text-muted backdrop-blur hover:border-accent hover:text-ink",
        )}
      >
        <Wordmark className="size-3.5 text-accent" />
        {isOpen ? "Close" : "Simulate portal fetch"}
      </button>
    </div>
  );
}
