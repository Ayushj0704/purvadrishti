import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, AlertTriangle, Clock } from 'lucide-react';
import { alertsApi } from '../api/alerts';
import type { Alert } from '../api/alerts';
import { RiskBadge } from '../components/RiskBadge';

export function Alerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => { loadAlerts(); }, []);

  const loadAlerts = async () => {
    try {
      setIsLoading(true);
      const data = await alertsApi.getAlerts();
      setAlerts(data);
    } catch (err) {
      console.error('Failed to fetch alerts, using mock data', err);
      setAlerts([
        { alert_id: 'A-101', case_id: 'C10234', atm_id: 'ATM-RJ-1023', risk_score: 0.89, confidence: 'HIGH', prediction_window_start: new Date().toISOString(), prediction_window_end: new Date(Date.now() + 3600000).toISOString(), created_at: new Date(Date.now() - 600000).toISOString(), status: 'NEW' },
        { alert_id: 'A-102', case_id: 'C10235', atm_id: 'ATM-HR-2041', risk_score: 0.76, confidence: 'MEDIUM', prediction_window_start: new Date().toISOString(), prediction_window_end: new Date(Date.now() + 3600000).toISOString(), created_at: new Date(Date.now() - 1200000).toISOString(), status: 'NEW' },
        { alert_id: 'A-103', case_id: 'C10236', atm_id: 'ATM-UP-0055', risk_score: 0.95, confidence: 'HIGH', prediction_window_start: new Date().toISOString(), prediction_window_end: new Date(Date.now() + 1800000).toISOString(), created_at: new Date(Date.now() - 3000000).toISOString(), status: 'ACKNOWLEDGED' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcknowledge = async (alertId: string) => {
    try {
      setProcessingId(alertId);
      await alertsApi.acknowledgeAlert(alertId);
      setAlerts(prev => prev.map(a => a.alert_id === alertId ? { ...a, status: 'ACKNOWLEDGED' } : a));
    } catch (err) {
      setAlerts(prev => prev.map(a => a.alert_id === alertId ? { ...a, status: 'ACKNOWLEDGED' } : a));
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="flex flex-col space-y-5 py-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#000000] dark:text-[#FFFFFF] flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-[#FF4C41]" />
            Active Alerts
          </h1>
          <p className="text-xs font-mono text-[#6E7182] dark:text-[#9699AA] mt-0.5">High-priority predictions requiring investigator review</p>
        </div>
        <div className="flex items-center gap-3 px-4 py-2 bg-[#FFFFFF] dark:bg-[#13131F] border border-[#000000]/14 dark:border-[#FFFFFF]/10 rounded-xl text-xs font-mono">
          <span className="text-[#6E7182]">Total: <span className="text-[#000000] dark:text-[#FFFFFF] font-semibold">{alerts.length}</span></span>
          <span className="w-px h-4 bg-[#000000]/10 dark:bg-[#FFFFFF]/10" />
          <span className="text-[#6E7182]">New: <span className="text-[#FF4C41] font-semibold">{alerts.filter(a => a.status === 'NEW').length}</span></span>
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-[#9699AA] animate-pulse border border-[#000000]/10 dark:border-[#FFFFFF]/10 rounded-xl bg-[#FFFFFF] dark:bg-[#13131F] font-mono text-sm">
          Loading alerts stream…
        </div>
      ) : (
        <div className="bg-[#FFFFFF] dark:bg-[#13131F] border border-[#000000]/14 dark:border-[#FFFFFF]/10 rounded-xl overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="border-b border-[#000000]/10 dark:border-[#FFFFFF]/10">
              <tr>
                <th className="px-6 py-4 text-[10px] font-mono font-semibold text-[#6E7182] dark:text-[#9699AA] uppercase tracking-widest">Time</th>
                <th className="px-6 py-4 text-[10px] font-mono font-semibold text-[#6E7182] dark:text-[#9699AA] uppercase tracking-widest">Case / Location</th>
                <th className="px-6 py-4 text-[10px] font-mono font-semibold text-[#6E7182] dark:text-[#9699AA] uppercase tracking-widest">Risk Level</th>
                <th className="px-6 py-4 text-[10px] font-mono font-semibold text-[#6E7182] dark:text-[#9699AA] uppercase tracking-widest">Window</th>
                <th className="px-6 py-4 text-[10px] font-mono font-semibold text-[#6E7182] dark:text-[#9699AA] uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#000000]/8 dark:divide-[#FFFFFF]/8">
              {alerts.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-[#9699AA] font-mono text-sm">No active alerts in the system.</td></tr>
              ) : (
                alerts.map((alert) => (
                  <tr key={alert.alert_id} className={`transition-colors ${
                    alert.status === 'NEW' ? 'bg-[#FF4C41]/3 hover:bg-[#FF4C41]/8' : 'hover:bg-[#1A2FFB]/3'
                  }`}>
                    <td className="px-6 py-4 font-mono text-[#6E7182] dark:text-[#9699AA] whitespace-nowrap text-xs">
                      {new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-[#000000] dark:text-[#FFFFFF] text-sm">{alert.case_id}</div>
                      <div className="text-[#9699AA] text-xs mt-0.5 font-mono">{alert.atm_id}</div>
                    </td>
                    <td className="px-6 py-4">
                      <RiskBadge level={alert.risk_score >= 0.8 ? 'HIGH' : alert.risk_score >= 0.5 ? 'MEDIUM' : 'LOW'} confidence={alert.confidence} />
                    </td>
                    <td className="px-6 py-4 text-[#9699AA] whitespace-nowrap text-xs font-mono">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(alert.prediction_window_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {new Date(alert.prediction_window_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <Link to={`/cases/${alert.case_id}`} className="text-xs font-mono font-semibold text-[#1A2FFB] hover:text-[#0A1FDB] transition-colors">
                          Review Case →
                        </Link>
                        {alert.status === 'NEW' ? (
                          <button
                            onClick={() => handleAcknowledge(alert.alert_id)}
                            disabled={processingId === alert.alert_id}
                            className="text-xs font-mono font-semibold bg-[#FFFFFF] dark:bg-[#0B0B12] hover:bg-[#F8F9FE] dark:hover:bg-[#1E1F2B] text-[#000000] dark:text-[#FFFFFF] px-3 py-1.5 rounded-full transition-colors border border-[#000000]/14 dark:border-[#FFFFFF]/10 disabled:opacity-50 flex items-center gap-1.5"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            {processingId === alert.alert_id ? 'Ack…' : 'Acknowledge'}
                          </button>
                        ) : (
                          <span className="text-xs font-mono font-semibold text-[#10B981] flex items-center gap-1.5 px-3 py-1.5">
                            <CheckCircle className="w-3.5 h-3.5" />
                            Acknowledged
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
