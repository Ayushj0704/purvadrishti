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
}

export function TopKTable({
  predictions,
  isLoading,
  caseId,
  title = "Ranked cash-out candidates",
  index = "02",
}: TopKTableProps) {
  return (
    <Panel>
      <PanelHeader
        index={index}
        title={title}
        meta={<span className="label-caps tnum text-faint">Top {predictions.length || "–"}</span>}
      />

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
              return (
                <tr key={p.atm_id}>
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
