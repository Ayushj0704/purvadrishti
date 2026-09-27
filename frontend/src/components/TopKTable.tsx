import { RiskBadge } from './RiskBadge';
import type { PredictionCandidate } from '../api/cases';

interface TopKTableProps {
  predictions: PredictionCandidate[];
  isLoading?: boolean;
}

export function TopKTable({ predictions, isLoading }: TopKTableProps) {
  if (isLoading) {
    return (
      <div className="p-6 text-sm text-[#9699AA] text-center border border-[#000000]/10 dark:border-[#FFFFFF]/10 rounded-xl bg-[#FFFFFF] dark:bg-[#13131F] animate-pulse font-mono">
        Scoring candidates…
      </div>
    );
  }
  if (!predictions || predictions.length === 0) {
    return (
      <div className="p-6 text-sm text-[#9699AA] text-center border border-[#000000]/10 dark:border-[#FFFFFF]/10 rounded-xl bg-[#FFFFFF] dark:bg-[#13131F] font-mono">
        No candidate locations predicted.
      </div>
    );
  }

  return (
    <div className="border border-[#000000]/10 dark:border-[#FFFFFF]/10 rounded-xl overflow-hidden bg-[#FFFFFF] dark:bg-[#13131F]">
      <table className="w-full text-sm text-left">
        <thead className="border-b border-[#000000]/10 dark:border-[#FFFFFF]/10">
          <tr>
            <th className="px-4 py-3 text-[10px] font-mono font-semibold text-[#6E7182] dark:text-[#9699AA] uppercase tracking-widest">#</th>
            <th className="px-4 py-3 text-[10px] font-mono font-semibold text-[#6E7182] dark:text-[#9699AA] uppercase tracking-widest">ATM ID</th>
            <th className="px-4 py-3 text-[10px] font-mono font-semibold text-[#6E7182] dark:text-[#9699AA] uppercase tracking-widest">State</th>
            <th className="px-4 py-3 text-[10px] font-mono font-semibold text-[#6E7182] dark:text-[#9699AA] uppercase tracking-widest">Risk</th>
            <th className="px-4 py-3 text-[10px] font-mono font-semibold text-[#6E7182] dark:text-[#9699AA] uppercase tracking-widest">Score</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#000000]/8 dark:divide-[#FFFFFF]/8">
          {predictions.map((p, idx) => (
            <tr key={p.atm_id} className="hover:bg-[#1A2FFB]/5 transition-colors">
              <td className="px-4 py-3 font-mono text-[#6E7182] dark:text-[#9699AA] text-xs">#{idx + 1}</td>
              <td className="px-4 py-3 font-mono text-[#000000] dark:text-[#FFFFFF] text-xs font-semibold">{p.atm_id}</td>
              <td className="px-4 py-3 font-mono text-[#6E7182] dark:text-[#9699AA] text-xs">{p.state || '—'}</td>
              <td className="px-4 py-3"><RiskBadge level={p.risk_level} confidence={p.confidence} /></td>
              <td className="px-4 py-3 font-mono text-[#000000] dark:text-[#FFFFFF] text-xs font-semibold">{(p.risk_score * 100).toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
