import { useState, useEffect } from 'react';
import { SlidersHorizontal } from 'lucide-react';

export interface FilterState {
  timeWindow: string;
  state: string;
  crimeType: string;
  amountRange: string;
  riskLevel: string;
  bankAtm: string;
  caseStatus: string;
}

interface FilterBarProps {
  onFilterChange: (filters: FilterState) => void;
}

export function FilterBar({ onFilterChange }: FilterBarProps) {
  const [filters, setFilters] = useState<FilterState>({
    timeWindow: '24h', state: 'ALL', crimeType: 'ALL',
    amountRange: 'ALL', riskLevel: 'ALL', bankAtm: 'ALL', caseStatus: 'ALL'
  });

  useEffect(() => { onFilterChange(filters); }, [filters, onFilterChange]);

  const handleChange = (key: keyof FilterState, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const selectClasses = "bg-transparent border border-[#000000]/14 dark:border-[#FFFFFF]/10 rounded-full px-3 py-1.5 text-xs font-mono text-[#2B2E3A] dark:text-[#F0F1FA] focus:outline-none focus:border-[#1A2FFB] min-w-[110px] cursor-pointer bg-[#FFFFFF] dark:bg-[#13131F] appearance-none";

  return (
    <div className="flex flex-wrap gap-2 items-center p-3 bg-[#FFFFFF]/60 dark:bg-[#13131F]/60 backdrop-blur-sm border border-[#000000]/10 dark:border-[#FFFFFF]/10 rounded-xl">
      <div className="flex items-center gap-2 text-[10px] font-mono font-semibold text-[#6E7182] dark:text-[#9699AA] uppercase tracking-widest mr-1">
        <SlidersHorizontal className="w-3 h-3" />
        Filters
      </div>
      <select className={selectClasses} value={filters.timeWindow} onChange={(e) => handleChange('timeWindow', e.target.value)}>
        <option value="1h">Last 1h</option>
        <option value="24h">Last 24h</option>
        <option value="7d">Last 7d</option>
        <option value="30d">Last 30d</option>
      </select>
      <select className={selectClasses} value={filters.state} onChange={(e) => handleChange('state', e.target.value)}>
        <option value="ALL">All States</option>
        <option value="DL">Delhi</option>
        <option value="HR">Haryana</option>
        <option value="RJ">Rajasthan</option>
        <option value="UP">Uttar Pradesh</option>
      </select>
      <select className={selectClasses} value={filters.crimeType} onChange={(e) => handleChange('crimeType', e.target.value)}>
        <option value="ALL">All Crimes</option>
        <option value="UPI">UPI Fraud</option>
        <option value="CC">Credit Card</option>
        <option value="PHISHING">Phishing</option>
      </select>
      <select className={selectClasses} value={filters.riskLevel} onChange={(e) => handleChange('riskLevel', e.target.value)}>
        <option value="ALL">All Risk</option>
        <option value="HIGH">High Risk</option>
        <option value="MEDIUM">Medium Risk</option>
        <option value="LOW">Low Risk</option>
      </select>
      <select className={selectClasses} value={filters.caseStatus} onChange={(e) => handleChange('caseStatus', e.target.value)}>
        <option value="ALL">All Status</option>
        <option value="OPEN">Open</option>
        <option value="INVESTIGATING">Investigating</option>
        <option value="CLOSED">Closed</option>
      </select>
    </div>
  );
}
