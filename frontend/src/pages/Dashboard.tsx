import { useState, useEffect } from 'react';
import { KpiCard } from '../components/KpiCard';
import { FilterBar } from '../components/FilterBar';
import type { FilterState } from '../components/FilterBar';
import { RiskMap } from '../map/RiskMap';
import { TopKTable } from '../components/TopKTable';
import { AlertRow } from '../components/AlertRow';
import { heatmapApi, alertsApi } from '../api';
import type { PredictionCandidate } from '../api/cases';
import type { Alert } from '../api/alerts';
import { Activity, Shield, MapPin, Clock } from 'lucide-react';

export function Dashboard() {
  const [filters, setFilters] = useState<FilterState | null>(null);
  const [heatmapData, setHeatmapData] = useState<any | undefined>(undefined);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [topPredictions, setTopPredictions] = useState<PredictionCandidate[]>([]);
  const [isLoadingPredictions, setIsLoadingPredictions] = useState(false);

  useEffect(() => {
    if (!filters) return;
    const loadDashboardData = async () => {
      try {
        setIsLoadingPredictions(true);
        try {
          const hm = await heatmapApi.getHeatmap();
          setHeatmapData(hm);
        } catch (e) {
          console.error('Heatmap fetch failed', e);
        }
        try {
          const al = await alertsApi.getAlerts();
          setAlerts(al.slice(0, 5));
        } catch (e) {
          console.error('Alerts fetch failed', e);
          setAlerts([{
            alert_id: 'A-101', case_id: 'C10234', atm_id: 'ATM-RJ-1023',
            risk_score: 0.89, confidence: 'HIGH',
            prediction_window_start: new Date().toISOString(),
            prediction_window_end: new Date(Date.now() + 3600000).toISOString(),
            created_at: new Date().toISOString(), status: 'NEW'
          }]);
        }
        setTopPredictions([
          { atm_id: 'ATM-RJ-1023', state: 'Rajasthan', risk_score: 0.89, risk_level: 'HIGH', confidence: 'HIGH' },
          { atm_id: 'ATM-HR-2041', state: 'Haryana', risk_score: 0.76, risk_level: 'HIGH', confidence: 'MEDIUM' },
          { atm_id: 'ATM-DL-0312', state: 'Delhi', risk_score: 0.61, risk_level: 'MEDIUM', confidence: 'LOW' },
        ]);
      } catch (err) {
        console.error('Failed to load dashboard data', err);
      } finally {
        setIsLoadingPredictions(false);
      }
    };
    loadDashboardData();
  }, [filters]);

  return (
    <div className="flex flex-col space-y-5 py-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#000000] dark:text-[#FFFFFF]">Predictive Intelligence</h1>
          <p className="text-xs font-mono text-[#6E7182] dark:text-[#9699AA] mt-0.5 uppercase tracking-wider">Cash-out location forecasting — realtime</p>
        </div>
        <div className="text-xs font-mono text-[#9699AA] px-3 py-1.5 bg-[#FFFFFF] dark:bg-[#13131F] border border-[#000000]/10 dark:border-[#FFFFFF]/10 rounded-full">
          Updated {new Date().toLocaleTimeString()}
        </div>
      </div>

      {/* Filters */}
      <FilterBar onFilterChange={setFilters} />

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Active Alerts" value="17" trend="+3" trendUp={false} icon={<Activity className="w-4 h-4" />} />
        <KpiCard label="High-Risk Zones" value="8" trend="-1" trendUp={true} icon={<MapPin className="w-4 h-4" />} />
        <KpiCard label="Cases Analysed" value="12,483" icon={<Shield className="w-4 h-4" />} />
        <KpiCard label="Avg Lead Time" value="18 min" trend="Stable" icon={<Clock className="w-4 h-4" />} />
      </div>

      {/* Map + Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5" style={{ minHeight: '520px' }}>
        {/* Map */}
        <div className="lg:col-span-2 flex flex-col gap-2">
          <div className="text-[10px] font-mono font-semibold text-[#6E7182] dark:text-[#9699AA] uppercase tracking-widest">Risk Heatmap</div>
          <div className="flex-1 bg-[#FFFFFF] dark:bg-[#13131F] border border-[#000000]/14 dark:border-[#FFFFFF]/10 rounded-xl overflow-hidden" style={{ minHeight: '460px' }}>
            <RiskMap heatmapData={heatmapData} />
          </div>
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-5">
          {/* Top Predictions */}
          <div className="flex flex-col gap-2">
            <div className="text-[10px] font-mono font-semibold text-[#6E7182] dark:text-[#9699AA] uppercase tracking-widest">Top Predicted Cash-Out Locations</div>
            <TopKTable predictions={topPredictions} isLoading={isLoadingPredictions} />
          </div>

          {/* Recent Alerts */}
          <div className="flex flex-col gap-2 flex-1">
            <div className="text-[10px] font-mono font-semibold text-[#6E7182] dark:text-[#9699AA] uppercase tracking-widest">Recent Alerts</div>
            <div className="bg-[#FFFFFF] dark:bg-[#13131F] border border-[#000000]/14 dark:border-[#FFFFFF]/10 rounded-xl overflow-hidden">
              {alerts.length > 0 ? (
                alerts.map(alert => <AlertRow key={alert.alert_id} alert={alert} />)
              ) : (
                <div className="p-6 text-sm text-[#9699AA] text-center font-mono">No active alerts.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
