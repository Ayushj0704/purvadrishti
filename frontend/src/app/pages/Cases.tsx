import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { casesApi } from "../api/cases";
import type { CaseSummary } from "../api/cases";
import { ApiError } from "../api/client";
import { PageHeader } from "../components/ui/PageHeader";
import { Panel, PanelHeader } from "../components/ui/Panel";
import { Reveal } from "../components/ui/Reveal";
import { Skeleton, EmptyState } from "../components/ui/EmptyState";
import { Button } from "../components/ui/Button";
import { StatusPill } from "../components/ui/StatusDot";
import { formatInr, orDash } from "../lib/format";

/**
 * Case index. This route existed in the footer but had no page behind it, so
 * every link to it fell through to the catch-all redirect. It is the entry
 * point for the investigation chain: pick a case, then run its prediction.
 */
export function Cases() {
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      setCases(await casesApi.listCases());
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not load cases.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex flex-col gap-20">
      <PageHeader
        index="03"
        eyebrow="Case index"
        title={
          <>
            Complaints
            <br />on the <span className="text-accent">record.</span>
          </>
        }
        lede="Every complaint intake on this deployment. Opening a case is where its prediction, timeline and draft report are generated."
        aside={
          <div className="flex flex-wrap items-center gap-3">
            <StatusPill tone={error ? "warning" : "stable"} pulse={isLoading}>
              {isLoading ? "Loading" : error ? "Degraded" : `${cases.length} on file`}
            </StatusPill>
          </div>
        }
      />

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-critical/50 bg-critical/15 px-4 py-3 text-xs text-critical"
        >
          {error}
        </p>
      )}

      <Reveal>
        <Panel>
          <PanelHeader
            index="01"
            title="Case register"
            meta={<span className="telemetry text-faint">{cases.length} returned</span>}
          />

          {isLoading ? (
            <Skeleton rows={6} />
          ) : cases.length === 0 ? (
            <EmptyState
              label="No cases on file"
              detail="Ingest a complaint to start an investigation."
            >
              <Button variant="ghost" size="sm" onClick={load}>
                Refresh
              </Button>
            </EmptyState>
          ) : (
            <div data-lenis-prevent className="overflow-x-auto">
              <table className="data-table min-w-[46rem]">
                <thead>
                  <tr>
                    <th className="w-24">ID</th>
                    <th>External ID</th>
                    <th>Vector</th>
                    <th className="text-right">Amount</th>
                    <th className="w-32">Status</th>
                    <th className="w-20 text-right" />
                  </tr>
                </thead>
                <tbody>
                  {cases.map((record) => (
                    <tr key={record.case_id}>
                      <td>
                        <span className="telemetry text-faint">{record.case_id}</span>
                      </td>
                      <td>
                        <Link
                          to={`/cases/${record.case_id}`}
                          className="telemetry text-ink transition-colors hover:text-accent"
                        >
                          {orDash(record.external_case_id)}
                        </Link>
                      </td>
                      <td>
                        <span className="text-xs text-muted">{orDash(record.fraud_type)}</span>
                      </td>
                      <td className="text-right">
                        <span className="value tnum text-ink">{formatInr(record.amount)}</span>
                      </td>
                      <td>
                        <span className="label-caps text-muted">
                          {orDash(record.status).replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="text-right">
                        <Link
                          to={`/cases/${record.case_id}`}
                          className="inline-flex items-center gap-1.5 text-[0.6875rem] font-medium text-muted transition-colors hover:text-accent"
                        >
                          Open
                          <ArrowUpRight className="size-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </Reveal>
    </div>
  );
}
