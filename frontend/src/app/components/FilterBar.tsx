import { useEffect, useState } from "react";
import { GlideSelect } from "./ui/GlideSelect";

/**
 * Query controls for the risk layer.
 *
 * Every control here maps to a parameter GET /risk/hotspots actually accepts:
 * hours_back, state, risk, min_score. The previous version also offered a crime
 * vector and a case status, which the endpoint ignores — selecting either
 * looked like it was narrowing the map while the data came back unchanged.
 */
export interface FilterState {
  hoursBack: string;
  state: string;
  risk: string;
  minScore: string;
}

export const DEFAULT_FILTERS: FilterState = {
  hoursBack: "24",
  state: "ALL",
  risk: "ALL",
  minScore: "0",
};

const GROUPS: Array<{ key: keyof FilterState; label: string; options: Array<[string, string]> }> = [
  {
    key: "hoursBack",
    label: "Window",
    options: [
      ["1", "Last 1h"],
      ["24", "Last 24h"],
      ["72", "Last 72h"],
      ["168", "Last 7d"],
      ["", "All time"],
    ],
  },
  {
    key: "state",
    label: "State",
    options: [
      ["ALL", "All states"],
      ["Delhi", "Delhi"],
      ["Haryana", "Haryana"],
      ["Rajasthan", "Rajasthan"],
      ["Uttar Pradesh", "Uttar Pradesh"],
      ["Punjab", "Punjab"],
      ["Maharashtra", "Maharashtra"],
      ["Karnataka", "Karnataka"],
    ],
  },
  {
    key: "risk",
    label: "Risk",
    options: [
      ["ALL", "Any risk"],
      ["CRITICAL", "Critical"],
      ["HIGH", "High"],
      ["MEDIUM", "Medium"],
      ["LOW", "Low"],
    ],
  },
  {
    key: "minScore",
    label: "Min score",
    options: [
      ["0", "Any score"],
      ["0.5", "0.50+"],
      ["0.7", "0.70+"],
      ["0.85", "0.85+"],
    ],
  },
];

/** Converts UI state to the endpoint's parameters, dropping untouched defaults. */
export function toHotspotFilters(filters: FilterState) {
  return {
    hoursBack: filters.hoursBack ? Number(filters.hoursBack) : undefined,
    state: filters.state,
    risk: filters.risk,
    minScore: Number(filters.minScore),
  };
}

export function FilterBar({ onFilterChange }: { onFilterChange: (filters: FilterState) => void }) {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

  useEffect(() => {
    onFilterChange(filters);
  }, [filters, onFilterChange]);

  const update = (key: keyof FilterState, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const reset = () => setFilters(DEFAULT_FILTERS);
  const isFiltered = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS);

  return (
    <div className="panel">
      <div className="flex items-center justify-between border-b border-hairline px-5 py-3.5">
        <span className="label-caps text-muted">Query parameters</span>
        <button
          onClick={reset}
          disabled={!isFiltered}
          className="rounded-md px-2 py-1 text-[0.6875rem] font-medium text-faint transition-colors hover:bg-white/[0.04] hover:text-accent disabled:pointer-events-none disabled:opacity-40"
        >
          Reset
        </button>
      </div>

      <div className="grid grid-cols-2 gap-px bg-hairline md:grid-cols-4">
        {GROUPS.map((group) => (
          <div key={group.key} className="flex flex-col gap-2 bg-surface p-4">
            <span className="label-caps text-faint">{group.label}</span>
            <GlideSelect
              size="sm"
              items={group.options.map(([value, label]) => ({ value, label }))}
              value={filters[group.key]}
              onChange={(value) => update(group.key, value)}
              ariaLabel={group.label}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
