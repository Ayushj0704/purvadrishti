import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowUpRight, Radio, FilePlus2 } from "lucide-react";
import { casesApi } from "../api/cases";
import type { CaseSummary } from "../api/cases";
import { PageHeader } from "../components/ui/PageHeader";
import { Panel, PanelHeader } from "../components/ui/Panel";
import { Reveal } from "../components/ui/Reveal";
import { EmptyState } from "../components/ui/EmptyState";
import { Loader } from "../components/ui/Loader";
import { StatusPill } from "../components/ui/StatusDot";
import { RiskBadge } from "../components/ui/RiskBadge";
import { Button } from "../components/ui/Button";
import { formatInr, formatTime } from "../lib/format";
import { canWrite, useRole } from "../lib/useRole";
import { cn } from "../lib/cn";

const STATE_OPTIONS = [
  "Delhi", "Haryana", "Rajasthan", "Uttar Pradesh", "Punjab", "Maharashtra",
  "West Bengal", "Tamil Nadu", "Karnataka", "Telangana", "Gujarat",
  "Madhya Pradesh", "Bihar", "Kerala", "Assam",
];

const FRAUD_OPTIONS = ["UPI", "Card", "Internet banking", "Wallet"];

export function Cases() {
  const navigate = useNavigate();
  const role = useRole();
  const writable = canWrite(role);
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [reloadKey, setReloadKey] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [intakeError, setIntakeError] = useState("");
  const [form, setForm] = useState({
    fraud_type: "UPI",
    amount: "120000",
    complainant_state: "Delhi",
    incident_state: "Delhi",
    bank_name: "",
    incident_details: "",
  });

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError("");
    casesApi
      .listCases()
      .then((list) => {
        if (!cancelled) setCases(list);
      })
      .catch(() => {
        if (!cancelled) {
          setCases([]);
          setLoadError("Case register unreachable. Check the API connection and retry.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const statuses = useMemo(
    () => ["ALL", ...Array.from(new Set(cases.map((c) => c.status).filter(Boolean)))],
    [cases],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cases.filter((c) => {
      if (status !== "ALL" && c.status !== status) return false;
      if (!q) return true;
      return (
        c.external_case_id.toLowerCase().includes(q) ||
        String(c.case_id).includes(q) ||
        (c.crime_subcategory ?? "").toLowerCase().includes(q)
      );
    });
  }, [cases, query, status]);

  const openCount = cases.filter((c) => c.status === "OPEN").length;

  /** Simulated live portal feed: pulls the next portal complaint and ingests
   *  it idempotently, exactly as the real CFCFRMS poller would. */
  const handlePortalFetch = async () => {
    setBusy("portal");
    setIntakeError("");
    try {
      const samples = await casesApi.sampleCases(1);
      if (samples.length === 0) {
        setIntakeError("Portal feed is empty — nothing to fetch right now.");
        return;
      }
      const s = samples[0];
      const res = await casesApi.ingestCase({
        external_case_id: s.external_case_id,
        fraud_type: s.subcategory ?? "UPI",
        crime_subcategory: s.subcategory,
        amount: s.amount ?? 0,
        complainant_state: s.complainant_state,
        incident_state: s.incident_state,
        source_system: "SIMULATED_PORTAL",
      });
      navigate(`/cases/${res.case_id}`);
    } catch {
      setIntakeError("Portal fetch failed. Check the API connection and retry.");
    } finally {
      setBusy(null);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("manual");
    setIntakeError("");
    try {
      const res = await casesApi.createCase({
        fraud_type: form.fraud_type,
        crime_subcategory: form.fraud_type,
        amount: Number(form.amount) || 0,
        complainant_state: form.complainant_state,
        incident_state: form.incident_state,
        bank_name: form.bank_name,
        incident_details: form.incident_details,
      });
      navigate(`/cases/${res.case_id}`);
    } catch {
      setIntakeError("Complaint registration failed. Check the API connection and retry.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-20">
      <PageHeader
        index="04"
        eyebrow="Case register"
        title={
          <>
            Every complaint,
            <br />
            <span className="text-accent">on the record.</span>
          </>
        }
        lede="Browse active cases, open one to see its ranked cash-out hypotheses, money-flow topology and investigation timeline."
        aside={
          <div className="flex flex-wrap items-center gap-3">
            <StatusPill tone={openCount > 0 ? "critical" : "stable"} pulse={openCount > 0}>
              {openCount} open
            </StatusPill>
            <span className="telemetry text-faint">{cases.length} total</span>
          </div>
        }
      />

      <Reveal>
        <Panel>
          <PanelHeader
            index="01"
            title="Complaint intake"
            meta={<span className="label-caps tnum text-faint">Portal + manual</span>}
          />
          {writable ? (
            <div className="flex flex-col gap-4 px-5 py-5">
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  size="sm"
                  onClick={handlePortalFetch}
                  disabled={busy !== null}
                >
                  <Radio className="size-3" />
                  {busy === "portal" ? "Fetching…" : "Simulate portal fetch"}
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setShowForm((v) => !v);
                    setIntakeError("");
                  }}
                >
                  <FilePlus2 className="size-3" />
                  {showForm ? "Hide form" : "Register complaint"}
                </Button>
                <span className="text-[0.6875rem] text-faint">
                  Portal fetch replays the I4C feed against a simulated queue — the live
                  poller swaps in without UI changes.
                </span>
              </div>

              {intakeError && (
                <p role="alert" className="text-xs text-critical">
                  {intakeError}
                </p>
              )}

              {showForm && (
                <form
                  onSubmit={handleManualSubmit}
                  className="grid grid-cols-1 gap-4 rounded-xl border border-hairline bg-abyss p-5 sm:grid-cols-2"
                >
                  <label className="flex flex-col gap-2">
                    <span className="eyebrow">Fraud vector</span>
                    <select
                      value={form.fraud_type}
                      onChange={(e) => setForm({ ...form, fraud_type: e.target.value })}
                      className="field"
                    >
                      {FRAUD_OPTIONS.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-2">
                    <span className="eyebrow">Amount (₹)</span>
                    <input
                      type="number"
                      min="0"
                      value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: e.target.value })}
                      className="field field-mono"
                      required
                    />
                  </label>
                  <label className="flex flex-col gap-2">
                    <span className="eyebrow">Complainant state</span>
                    <select
                      value={form.complainant_state}
                      onChange={(e) => setForm({ ...form, complainant_state: e.target.value })}
                      className="field"
                    >
                      {STATE_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-2">
                    <span className="eyebrow">Incident state</span>
                    <select
                      value={form.incident_state}
                      onChange={(e) => setForm({ ...form, incident_state: e.target.value })}
                      className="field"
                    >
                      {STATE_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-2 sm:col-span-2">
                    <span className="eyebrow">Bank (optional)</span>
                    <input
                      type="text"
                      value={form.bank_name}
                      onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
                      className="field"
                      placeholder="HDFC"
                    />
                  </label>
                  <label className="flex flex-col gap-2 sm:col-span-2">
                    <span className="eyebrow">Incident details</span>
                    <textarea
                      value={form.incident_details}
                      onChange={(e) => setForm({ ...form, incident_details: e.target.value })}
                      className="field min-h-20"
                      placeholder="What the complainant reported…"
                    />
                  </label>
                  <div className="sm:col-span-2">
                    <Button type="submit" size="sm" disabled={busy !== null}>
                      {busy === "manual" ? "Registering…" : "File complaint"}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            <p className="px-5 py-5 text-[0.6875rem] text-faint">
              Complaint intake requires the LEA Officer role or above — your read-only view lists the register below.
            </p>
          )}
        </Panel>
      </Reveal>

      <Reveal>
        <Panel>
          <PanelHeader
            index="02"
            title="Active cases"
            meta={
              <span className="telemetry text-faint">
                {filtered.length} of {cases.length} records
              </span>
            }
          />

          <div className="flex flex-col gap-3 border-b border-hairline px-5 py-4 sm:flex-row sm:items-center">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by case ID or vector…"
              aria-label="Search cases"
              className="field flex-1"
            />
            <div className="flex items-center gap-2">
              <span className="label-caps text-faint">Status</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                aria-label="Filter by status"
                className="field field-mono"
              >
                {statuses.map((s) => (
                  <option key={s} value={s}>
                    {s === "ALL" ? "Any status" : s.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {isLoading ? (
            <Loader label="Loading case register…" />
          ) : loadError ? (
            <div className="flex flex-col items-center gap-4 px-5 py-10 text-center">
              <p role="alert" className="text-xs text-critical">
                {loadError}
              </p>
              <button
                type="button"
                onClick={() => setReloadKey((k) => k + 1)}
                className="label-caps rounded-md border border-hairline px-3 py-2 text-muted transition-colors hover:border-accent hover:text-ink"
              >
                Retry
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              label={cases.length === 0 ? "No cases on record" : "No cases match"}
              detail={
                cases.length === 0
                  ? "Ingest a complaint from the I4C portal feed to begin."
                  : "Clear the search or choose a different status."
              }
            />
          ) : (
            <div data-lenis-prevent className="overflow-x-auto">
              <table className="data-table min-w-[56rem]">
                <thead>
                  <tr>
                    <th>Case</th>
                    <th>Vector</th>
                    <th>Amount</th>
                    <th className="hidden md:table-cell">Corridor</th>
                    <th className="hidden sm:table-cell">Filed</th>
                    <th>Status</th>
                    <th className="text-right">Open</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr key={c.case_id}>
                      <td>
                        <Link
                          to={`/cases/${c.case_id}`}
                          className="telemetry text-ink transition-colors hover:text-accent"
                        >
                          {c.external_case_id}
                        </Link>
                        <span className="mt-1 block text-[0.6875rem] text-faint">
                          #{c.case_id}
                        </span>
                      </td>
                      <td>
                        <span className="text-xs text-muted">
                          {c.crime_subcategory || c.fraud_type}
                        </span>
                      </td>
                      <td>
                        <span className="telemetry text-ink">
                          {formatInr(c.fraud_amount ?? c.amount)}
                        </span>
                      </td>
                      <td className="hidden md:table-cell">
                        <span className="text-xs text-muted">
                          {c.complainant_state || "—"}
                          {c.incident_state && c.incident_state !== c.complainant_state
                            ? ` → ${c.incident_state}`
                            : ""}
                        </span>
                      </td>
                      <td className="hidden sm:table-cell">
                        <span className="telemetry text-faint">
                          {c.reported_at ? formatTime(c.reported_at) : "—"}
                        </span>
                      </td>
                      <td>
                        <RiskBadge
                          level={
                            c.status === "CLOSED"
                              ? "LOW"
                              : c.status === "INVESTIGATING"
                                ? "MEDIUM"
                                : "HIGH"
                          }
                        />
                      </td>
                      <td>
                        <div className="flex justify-end">
                          <Link
                            to={`/cases/${c.case_id}`}
                            aria-label={`Open case ${c.external_case_id}`}
                            className={cn(
                              "inline-flex items-center gap-1.5 text-[0.6875rem] font-medium text-muted",
                              "transition-colors hover:text-accent",
                            )}
                          >
                            Review
                            <ArrowUpRight className="size-3" />
                          </Link>
                        </div>
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
