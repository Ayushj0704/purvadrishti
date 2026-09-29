import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Search } from "lucide-react";

import { ApiError } from "../api/client";
import { casesApi } from "../api";
import type { CaseSummary } from "../api/cases";
import { PageHeader } from "../components/ui/PageHeader";
import { SectionHeader } from "../components/ui/Eyebrow";
import { Panel, PanelHeader } from "../components/ui/Panel";
import { Reveal } from "../components/ui/Reveal";
import { EmptyState, Skeleton } from "../components/ui/EmptyState";
import { StatusPill } from "../components/ui/StatusDot";
import { cn } from "../lib/cn";
import { formatDateTime, formatInr } from "../lib/format";

const PAGE_SIZE = 25;

const STATUS_FILTERS = [
  { label: "All", value: "" },
  { label: "Open", value: "OPEN" },
  { label: "Investigating", value: "INVESTIGATING" },
  { label: "Closed", value: "CLOSED" },
] as const;

/** Presentation only: maps a lifecycle status onto the console's tone scale. */
function statusTone(status: string): "stable" | "warning" | "critical" | "accent" | "idle" {
  const key = (status || "").toUpperCase();
  if (key.includes("CLOSED") || key.includes("RESOLVED")) return "idle";
  if (key.includes("ESCALAT")) return "critical";
  if (key.includes("INVESTIGAT") || key.includes("REVIEW")) return "warning";
  if (key.includes("OPEN") || key.includes("NEW") || key.includes("ACTIVE")) return "accent";
  return "idle";
}

function matches(caseItem: CaseSummary, needle: string): boolean {
  if (!needle) return true;
  const q = needle.toLowerCase();
  return (
    caseItem.case_id?.toLowerCase().includes(q) ||
    caseItem.fraud_type?.toLowerCase().includes(q) ||
    caseItem.status?.toLowerCase().includes(q)
  );
}

export function Cases() {
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const result = await casesApi.listCases({
        status: status || undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      setCases(result.cases);
      setTotal(result.total);
    } catch (err) {
      setCases([]);
      setTotal(0);
      setError(
        err instanceof ApiError && err.status === 404
          ? "The case register is not exposed by this deployment."
          : "Could not reach the case register.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [status, page]);

  useEffect(() => {
    let cancelled = false;
    load().catch(() => {
      if (!cancelled) setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const visible = cases.filter((item) => matches(item, query));
  const from = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const to = page * PAGE_SIZE + visible.length;
  const canPageForward = page * PAGE_SIZE + PAGE_SIZE < total;

  return (
    <div className="flex flex-col gap-20">
      <PageHeader
        title={
          <>
            Active case
            <br />
            <span className="text-accent">register.</span>
          </>
        }
        lede="Every complaint under investigation in one register. Ranked cash-out candidates, predicted withdrawal windows and the money-flow trail are one click away on any case."
        titleClassName="text-[clamp(3.25rem,8.5vw,7.5rem)]"
        aside={
          <div className="flex flex-wrap items-center gap-3">
            <StatusPill tone={error ? "critical" : isLoading ? "accent" : "stable"} pulse={isLoading}>
              {error ? "Disconnected" : isLoading ? "Syncing" : "Register live"}
            </StatusPill>
            <span className="telemetry text-faint">{total} on record</span>
          </div>
        }
      />

      <section className="flex flex-col gap-8">
        <SectionHeader
          index="01"
          label="Investigation queue"
          title="Work the list, not the hunch."
          description="Filtered to what this deployment actually holds. No case is invented, and a case with no prediction yet is shown as such rather than filled in."
        />

        <Reveal>
          <Panel>
            <PanelHeader
              index="01.1"
              title="Cases"
              meta={
                <span className="label-caps tnum text-faint">
                  {from}–{to} of {total}
                </span>
              }
            />

            <div className="flex flex-col gap-4 border-b border-hairline px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                {STATUS_FILTERS.map((filter) => {
                  const active = status === filter.value;
                  return (
                    <button
                      key={filter.value || "all"}
                      onClick={() => {
                        setStatus(filter.value);
                        setPage(0);
                      }}
                      className={cn(
                        "label-caps rounded-md border px-3 py-1.5 transition-colors duration-200",
                        active
                          ? "border-accent text-accent"
                          : "border-hairline text-faint hover:border-[#2e2e3a] hover:text-muted",
                      )}
                    >
                      {filter.label}
                    </button>
                  );
                })}
              </div>

              <label className="flex items-center gap-2.5 lg:w-72">
                <Search className="size-3.5 shrink-0 text-faint" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filter this page"
                  className="field field-mono"
                  aria-label="Filter the loaded cases"
                />
              </label>
            </div>

            {isLoading ? (
              <Skeleton rows={8} />
            ) : error ? (
              <EmptyState label="Case register unavailable" detail={error} />
            ) : visible.length === 0 ? (
              <EmptyState
                label={query ? "No match on this page" : "No cases on record"}
                detail={
                  query
                    ? "Clear the filter, or page through the rest of the register."
                    : "Ingest a complaint to open the first case."
                }
              />
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Case</th>
                    <th className="hidden sm:table-cell">Vector</th>
                    <th className="hidden md:table-cell">Filed</th>
                    <th className="text-right">Amount</th>
                    <th>Status</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {visible.map((item) => (
                    <tr key={item.case_id}>
                      <td>
                        <span className="telemetry text-ink">{item.case_id}</span>
                      </td>
                      <td className="hidden sm:table-cell">
                        <span className="text-xs text-muted">{item.fraud_type || "—"}</span>
                      </td>
                      <td className="hidden md:table-cell">
                        <span className="telemetry text-muted">
                          {item.created_at ? formatDateTime(item.created_at) : "—"}
                        </span>
                      </td>
                      <td className="text-right">
                        <span className="value tnum text-ink">
                          {typeof item.amount === "number" ? formatInr(item.amount) : "—"}
                        </span>
                      </td>
                      <td>
                        <StatusPill tone={statusTone(item.status)}>
                          {(item.status || "unknown").replace(/_/g, " ")}
                        </StatusPill>
                      </td>
                      <td>
                        <Link
                          to={`/cases/${item.case_id}`}
                          aria-label={`Open case ${item.case_id}`}
                          className="inline-flex items-center text-faint transition-colors hover:text-accent"
                        >
                          <ArrowUpRight className="size-3.5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div className="flex items-center justify-between gap-4 border-t border-hairline px-5 py-3.5">
              <span className="label-caps tnum text-faint">
                Page {page + 1} · {PAGE_SIZE} per page
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0 || isLoading}
                  className="label-caps rounded-md border border-hairline px-3 py-1.5 text-muted transition-colors duration-200 hover:border-[#2e2e3a] hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={!canPageForward || isLoading}
                  className="label-caps rounded-md border border-hairline px-3 py-1.5 text-muted transition-colors duration-200 hover:border-[#2e2e3a] hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </Panel>
        </Reveal>
      </section>
    </div>
  );
}
