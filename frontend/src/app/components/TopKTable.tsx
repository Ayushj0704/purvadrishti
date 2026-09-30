import { Link } from "react-router-dom";
import type { PredictionCandidate } from "../api/cases";
import { RiskBadge, riskLevelFromScore } from "./ui/RiskBadge";
import { EmptyState, Skeleton } from "./ui/EmptyState";
import { Panel, PanelHeader } from "./ui/Panel";
import { cn } from "../lib/cn";

interface TopKTableProps {
  predictions: PredictionCandidate[];
  isLoading?: boolean;
  caseId?: string;
  title?: string;
  index?: string;
  rankingNote?: string;
}

export function TopKTable({
  predictions,
  isLoading,
  caseId,
  title = "Ranked cash-out candidates",
  index = "02",
  rankingNote,
}: TopKTableProps) {
  const bestBet = predictions.find((p) => p.best_bet) ?? predictions[0];
  return (
    <Panel>
      <PanelHeader
        index={index}
        title={title}
        meta={<span className="label-caps tnum text-faint">Top {predictions.length || "–"}</span>}
      />

      {rankingNote && predictions.length > 0 && (
        <p className="border-b border-hairline px-5 py-3 text-xs leading-relaxed text-muted">
          {rankingNote}
        </p>
      )}

      {isLoading ? (
        <Skeleton rows={4} />
      ) : predictions.length === 0 ? (
        <EmptyState label="No candidates scored" detail="Awaiting a complaint to seed the model." />
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th className="w-12">Rank</th>
              <th>ATM</th>
              <th className="hidden sm:table-cell">State</th>
              <th>Risk</th>
              <th className="text-right">Score</th>
            </tr>
          </thead>
          <tbody>
            {predictions.map((p, idx) => {
              const level = p.risk_level ?? riskLevelFromScore(p.risk_score);
              const isBest = bestBet != null && p.atm_id === bestBet.atm_id;
              return (
                <tr key={p.atm_id} className={cn(isBest && "bg-accent/[0.06]")}>
                  <td>
                    <span className={cn("label-caps tnum", idx === 0 ? "text-accent" : "text-faint")}>
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                  </td>
                  <td>
                    {caseId ? (
                      <Link
                        to={`/cases/${caseId}?atm=${encodeURIComponent(p.atm_id)}`}
                        className="telemetry text-ink transition-colors hover:text-accent"
                      >
                        {p.atm_id}
                      </Link>
                    ) : (
                      <span className="telemetry text-ink">{p.atm_id}</span>
                    )}
                    {isBest && (
                      <span className="mt-1 block text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-accent">
                        Best bet
                      </span>
                    )}
                    {isBest && p.basis && (
                      <span className="mt-0.5 block max-w-56 text-[0.6875rem] leading-snug text-faint">
                        {p.basis}
                      </span>
                    )}
                  </td>
                  <td className="hidden sm:table-cell">
                    <span className="text-xs text-muted">{p.state || "—"}</span>
                  </td>
                  <td>
                    <RiskBadge level={level} />
                  </td>
                  <td className="text-right">
                    <span className="value tnum text-ink">{(p.risk_score * 100).toFixed(1)}%</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Panel>
  );
}
