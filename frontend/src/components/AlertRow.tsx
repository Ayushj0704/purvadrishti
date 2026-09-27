import { Link } from 'react-router-dom';
import type { Alert } from '../api/alerts';
import { RiskBadge } from './RiskBadge';

interface AlertRowProps {
  alert: Alert;
}

export function AlertRow({ alert }: AlertRowProps) {
  const timeStr = new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const riskLevel = alert.risk_score >= 0.8 ? 'HIGH' : alert.risk_score >= 0.5 ? 'MEDIUM' : 'LOW';

  return (
    <div className={`flex items-center justify-between px-4 py-3 border-b border-[#000000]/8 dark:border-[#FFFFFF]/8 hover:bg-[#1A2FFB]/5 transition-colors group ${
      alert.status === 'NEW' ? 'bg-[#FF4C41]/3' : ''
    }`}>
      <div className="flex items-center gap-4">
        <div className="text-xs font-mono text-[#6E7182] dark:text-[#9699AA] whitespace-nowrap">{timeStr}</div>
        <div>
          <div className="text-sm font-semibold text-[#000000] dark:text-[#FFFFFF]">
            {alert.atm_id}
            <span className="text-[#6E7182] dark:text-[#9699AA] font-normal ml-2">| {alert.case_id}</span>
          </div>
          <div className="text-xs text-[#9699AA] font-mono mt-0.5">
            Window: {new Date(alert.prediction_window_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {new Date(alert.prediction_window_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <RiskBadge level={riskLevel} confidence={alert.confidence} />
        <Link
          to={`/cases/${alert.case_id}`}
          className="text-xs font-mono font-semibold text-[#1A2FFB] hover:text-[#0A1FDB] transition-colors bg-[#1A2FFB]/10 hover:bg-[#1A2FFB]/20 px-3 py-1.5 rounded-full border border-[#1A2FFB]/20"
        >
          View Case →
        </Link>
      </div>
    </div>
  );
}
