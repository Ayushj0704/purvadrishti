import { useEffect, useState } from "react";

export interface FilterState {
  timeWindow: string;
  state: string;
  crimeType: string;
  riskLevel: string;
  caseStatus: string;
}

const DEFAULTS: FilterState = {
  timeWindow: "24h",
  state: "ALL",
  crimeType: "ALL",
  riskLevel: "ALL",
  caseStatus: "OPEN",
};

const GROUPS: Array<{ key: keyof FilterState; label: string; options: Array<[string, string]> }> = [
  {
    key: "timeWindow",
    label: "Window",
    options: [
      ["1h", "Last 1h"],
      ["24h", "Last 24h"],
      ["7d", "Last 7d"],
      ["30d", "Last 30d"],
    ],
  },
  {
    key: "state",
    label: "State",
    options: [
      ["ALL", "All states"],
      ["DL", "Delhi"],
      ["HR", "Haryana"],
      ["RJ", "Rajasthan"],
      ["UP", "Uttar Pradesh"],
      ["PB", "Punjab"],
      ["MH", "Maharashtra"],
    ],
  },
  {
    key: "crimeType",
    label: "Vector",
    options: [
      ["ALL", "All vectors"],
      ["UPI", "UPI fraud"],
      ["CC", "Card fraud"],
      ["PHISHING", "Phishing"],
      ["NETBANKING", "Net banking"],
    ],
  },
  {
    key: "riskLevel",
    label: "Risk",
    options: [
      ["ALL", "Any risk"],
      ["HIGH", "High"],
      ["MEDIUM", "Medium"],
      ["LOW", "Low"],
    ],
  },
  {
    key: "caseStatus",
    label: "Status",
    options: [
      ["ALL", "Any status"],
      ["OPEN", "Open"],
      ["INVESTIGATING", "Investigating"],
      ["CLOSED", "Closed"],
    ],
  },
];

interface FilterBarProps {
  onFilterChange: (filters: FilterState) => void;
}

export function FilterBar({ onFilterChange }: FilterBarProps) {
  const [filters, setFilters] = useState<FilterState>(DEFAULTS);

  useEffect(() => {
    onFilterChange(filters);
  }, [filters, onFilterChange]);

  const update = (key: keyof FilterState, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const reset = () => setFilters(DEFAULTS);
  const isFiltered = JSON.stringify(filters) !== JSON.stringify(DEFAULTS);

  return (
    <div className="border border-hairline">
      <div className="flex items-center justify-between border-b border-hairline px-5 py-3.5">
        <span className="label-caps text-muted">Query parameters</span>
        <button
          onClick={reset}
          disabled={!isFiltered}
          className="text-[0.6875rem] font-medium text-faint transition-colors hover:text-accent disabled:pointer-events-none disabled:opacity-40"
        >
          Reset
        </button>
      </div>

      <div className="grid grid-cols-2 gap-px bg-hairline md:grid-cols-3 xl:grid-cols-5">
        {GROUPS.map((group) => (
          <label key={group.key} className="flex flex-col gap-2 bg-surface p-4">
            <span className="label-caps text-faint">{group.label}</span>
            <select
              className="field cursor-pointer py-2"
              value={filters[group.key]}
              onChange={(e) => update(group.key, e.target.value)}
            >
              {group.options.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </div>
  );
}
