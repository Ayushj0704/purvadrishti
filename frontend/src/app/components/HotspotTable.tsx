import type { HotspotCell } from "../api/heatmap";
import { RiskBadge } from "./ui/RiskBadge";
import { EmptyState, Skeleton } from "./ui/EmptyState";
import { Panel, PanelHeader } from "./ui/Panel";
import { formatPercent, orDash } from "../lib/format";
import { cn } from "../lib/cn";

/**
 * Live hotspot ranking, the dashboard's read on GET /risk/hotspots.
 *
 * The aggregation is per H3 cell, not per case, so there is no case to link
 * from a row — the cell and its state are the identity here. Scores and levels
 * are the backend's; the client never reclassifies.
 */
export function HotspotTable({
  cells,
  isLoading,
  index = "03",
  title = "Ranked risk cells",
  limit,
}: {
  cells: HotspotCell[];
  isLoading?: boolean;
  index?: string;
  title?: string;
  limit?: number;
}) {
  const rows = limit ? cells.slice(0, limit) : cells;

  return (
    <Panel>
      <PanelHeader
        index={index}
        title={title}
        meta={<span className="label-caps tnum text-faint">{cells.length} cells</span>}
      />

      {isLoading ? (
        <Skeleton rows={4} />
      ) : rows.length === 0 ? (
        <EmptyState
          label="No risk cells"
          detail="No prediction has cleared the current filters."
        />
      ) : (
        <div data-lenis-prevent className="max-h-[26rem] overflow-y-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-12">Rank</th>
                <th>Cell</th>
                <th className="hidden sm:table-cell">State</th>
                <th className="hidden md:table-cell">Cases</th>
                <th>Risk</th>
                <th className="text-right">Score</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((cell, index) => (
                <tr key={cell.h3_cell}>
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
                    <span className="telemetry text-ink">{orDash(cell.h3_cell)}</span>
                  </td>
                  <td className="hidden sm:table-cell">
                    <span className="text-xs text-muted">{orDash(cell.state)}</span>
                  </td>
                  <td className="hidden md:table-cell">
                    <span className="telemetry text-muted">{cell.active_cases}</span>
                  </td>
                  <td>
                    <RiskBadge level={cell.risk_level} score={cell.risk_score} />
                  </td>
                  <td className="text-right">
                    <span className="value tnum text-ink">
                      {formatPercent(cell.risk_score)}
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
