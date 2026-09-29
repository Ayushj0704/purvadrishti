import type { PredictionCandidate } from "../api/cases";
import { RiskBadge } from "./ui/RiskBadge";
import { EmptyState, Skeleton } from "./ui/EmptyState";
import { Panel, PanelHeader } from "./ui/Panel";
import { formatPercent } from "../lib/format";
import { cn } from "../lib/cn";

/**
 * Ranked cash-out candidates for a single case — the Top-K output of
 * POST /cases/{id}/predictions. Risk levels are the backend's own
 * classification; the score is shown beside it, never used to derive one.
 *
 * The ATM column is plain text because the prediction is already scoped to the
 * case being viewed — there is no terminal detail route to send it to.
 */
export function TopKTable({
  predictions,
  isLoading,
  title = "Ranked cash-out candidates",
  index = "02",
}: {
  predictions: PredictionCandidate[];
  isLoading?: boolean;
  title?: string;
  index?: string;
}) {
  return (
    <Panel>
      <PanelHeader
        index={index}
        title={title}
        meta={<span className="label-caps tnum text-faint">{predictions.length} ranked</span>}
      />

      {isLoading ? (
        <Skeleton rows={4} />
      ) : predictions.length === 0 ? (
        <EmptyState
          label="No candidates scored"
          detail="Run the prediction to score every candidate terminal for this case."
        />
      ) : (
        <div data-lenis-prevent className="overflow-x-auto">
          <table className="data-table min-w-[40rem]">
            <thead>
              <tr>
                <th className="w-12">Rank</th>
                <th>ATM</th>
                <th className="hidden sm:table-cell">H3 cell</th>
                <th>Window</th>
                <th>Risk</th>
                <th className="text-right">Score</th>
              </tr>
            </thead>
            <tbody>
              {predictions.map((prediction, index) => (
                <tr key={prediction.atm_id}>
                  <td>
                    <span
                      className={cn(
                        "label-caps tnum",
                        index === 0 ? "text-accent" : "text-faint",
                      )}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </td>
                  <td>
                    <span className="telemetry text-ink">{prediction.atm_id}</span>
                  </td>
                  <td className="hidden sm:table-cell">
                    <span className="text-xs text-muted">{prediction.h3_cell || "—"}</span>
                  </td>
                  <td>
                    <span className="telemetry whitespace-nowrap text-muted">
                      {prediction.predicted_window}
                    </span>
                  </td>
                  <td>
                    <RiskBadge level={prediction.risk_level} />
                  </td>
                  <td className="text-right">
                    <span className="value tnum text-ink">
                      {formatPercent(prediction.score)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
