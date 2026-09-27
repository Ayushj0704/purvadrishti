import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import type { CaseSummary, PredictionResponse } from '../api/cases';
import { ShapContributionChart } from '../charts/ShapContributionChart';
import type { ShapFeature } from '../charts/ShapContributionChart';
import { InvestigationTimeline } from '../components/InvestigationTimeline';
import { TopKTable } from '../components/TopKTable';
import { TransactionGraph } from '../components/TransactionGraph';

export function CaseDetail() {
  const { id } = useParams<{ id: string }>();
  const [caseData, setCaseData] = useState<CaseSummary | null>(null);
  const [predictions, setPredictions] = useState<PredictionResponse | null>(null);
  const [explanation, setExplanation] = useState<ShapFeature[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const loadCaseDetails = async () => {
      try {
        setIsLoading(true);
        setCaseData({
          case_id: id,
          created_at: new Date().toISOString(),
          fraud_type: 'UPI Transfer',
          amount: 120000,
          status: 'INVESTIGATING'
        });
        setPredictions({
          case_id: id,
          prediction_window: { start: new Date().toISOString(), end: new Date(Date.now() + 3600000).toISOString() },
          predictions: [
            { atm_id: 'ATM-1023', state: 'Rajasthan', risk_score: 0.89, risk_level: 'HIGH', confidence: 'HIGH' },
            { atm_id: 'ATM-2041', state: 'Haryana', risk_score: 0.76, risk_level: 'HIGH', confidence: 'MEDIUM' },
            { atm_id: 'ATM-0312', state: 'Delhi', risk_score: 0.41, risk_level: 'MEDIUM', confidence: 'LOW' }
          ]
        });
        setExplanation([
          { feature_name: 'Historical Similarity', contribution: 0.35, description: 'High similarity to historical fraud-linked cash-outs' },
          { feature_name: 'Location Proximity', contribution: 0.22, description: 'Close to the latest relevant transaction location' },
          { feature_name: 'Time of Day', contribution: 0.15, description: 'Current time matches historical cash-out pattern' },
          { feature_name: 'Suspicious Activity', contribution: 0.12, description: 'Elevated recent suspicious activity at ATM' },
          { feature_name: 'Cross-State Pattern', contribution: 0.08, description: 'Cross-state movement pattern observed in similar cases' },
          { feature_name: 'Weekend Flag', contribution: -0.03, description: 'Slightly decreases risk due to non-weekend' },
        ]);
      } catch (err) {
        console.error('Failed to load case data', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadCaseDetails();
  }, [id]);

  if (isLoading) {
    return <div className="p-8 text-[#9699AA] animate-pulse font-mono text-sm">Loading case details...</div>;
  }
  if (!caseData) {
    return <div className="p-8 text-[#FF4C41] font-mono text-sm">Case not found.</div>;
  }

  const mockTimeline = [
    { id: '1', timestamp: new Date(Date.now() - 3600000).toISOString(), description: 'Suspicious transaction flagged', type: 'TRANSACTION' as const },
    { id: '2', timestamp: new Date(Date.now() - 3400000).toISOString(), description: 'Complaint received', type: 'COMPLAINT' as const },
    { id: '3', timestamp: new Date(Date.now() - 3200000).toISOString(), description: 'Candidate locations generated', type: 'GENERATION' as const },
    { id: '4', timestamp: new Date(Date.now() - 3100000).toISOString(), description: 'Risk predictions calculated', type: 'PREDICTION' as const },
    { id: '5', timestamp: new Date(Date.now() - 3000000).toISOString(), description: 'High-risk alert dispatched', type: 'ALERT' as const },
    { id: '6', timestamp: new Date().toISOString(), description: 'Investigator opened case file', type: 'ACTION' as const },
  ];

  return (
    <div className="flex flex-col space-y-6 py-4">
      <div className="flex items-center gap-4">
        <Link to="/" className="w-8 h-8 flex items-center justify-center rounded-full bg-[#FFFFFF] dark:bg-[#1E1F2B] border border-[#000000]/14 dark:border-[#FFFFFF]/10 hover:border-[#1A2FFB] text-[#000000] dark:text-[#FFFFFF] transition-all">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-[#000000] dark:text-[#FFFFFF]">Case {caseData.case_id}</h1>
            <span className="px-2 py-1 text-[10px] font-mono font-semibold bg-[#1A2FFB]/10 text-[#1A2FFB] border border-[#1A2FFB]/20 rounded-full uppercase">
              {caseData.status}
            </span>
          </div>
          <p className="text-xs font-mono text-[#6E7182] dark:text-[#9699AA] mt-0.5">
            Complaint Filed: {new Date(caseData.created_at).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Case Overview Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#FFFFFF] dark:bg-[#13131F] border border-[#000000]/14 dark:border-[#FFFFFF]/10 rounded-xl p-5 shadow-sm">
          <div className="text-[10px] font-mono font-semibold text-[#6E7182] dark:text-[#9699AA] uppercase tracking-widest mb-1">Fraud Type</div>
          <div className="text-lg font-bold text-[#000000] dark:text-[#FFFFFF]">{caseData.fraud_type}</div>
        </div>
        <div className="bg-[#FFFFFF] dark:bg-[#13131F] border border-[#000000]/14 dark:border-[#FFFFFF]/10 rounded-xl p-5 shadow-sm">
          <div className="text-[10px] font-mono font-semibold text-[#6E7182] dark:text-[#9699AA] uppercase tracking-widest mb-1">Involved Amount</div>
          <div className="text-lg font-bold text-[#000000] dark:text-[#FFFFFF]">
            {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(caseData.amount)}
          </div>
        </div>
        <div className="bg-[#FFFFFF] dark:bg-[#13131F] border border-[#000000]/14 dark:border-[#FFFFFF]/10 rounded-xl p-5 shadow-sm md:col-span-2">
          <div className="text-[10px] font-mono font-semibold text-[#6E7182] dark:text-[#9699AA] uppercase tracking-widest mb-1">Prediction Window</div>
          <div className="text-lg font-bold text-[#000000] dark:text-[#FFFFFF] font-mono">
            {predictions ? (
              `${new Date(predictions.prediction_window.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${new Date(predictions.prediction_window.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
            ) : 'N/A'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col space-y-6">
          <div className="flex flex-col space-y-2">
            <h2 className="text-[10px] font-mono font-semibold text-[#6E7182] dark:text-[#9699AA] uppercase tracking-widest">Ranked Candidate Locations</h2>
            <TopKTable predictions={predictions?.predictions || []} isLoading={false} />
          </div>
          
          <div className="flex flex-col space-y-2">
            <h2 className="text-[10px] font-mono font-semibold text-[#6E7182] dark:text-[#9699AA] uppercase tracking-widest">SHAP — Risk Factor Contributions</h2>
            <div className="bg-[#FFFFFF] dark:bg-[#13131F] border border-[#000000]/14 dark:border-[#FFFFFF]/10 rounded-xl overflow-hidden p-1 shadow-sm">
               <ShapContributionChart data={explanation} isLoading={false} />
            </div>
          </div>
        </div>

        <div className="flex flex-col">
          <div className="bg-[#FFFFFF] dark:bg-[#13131F] border border-[#000000]/14 dark:border-[#FFFFFF]/10 rounded-xl p-5 shadow-sm">
             <InvestigationTimeline events={mockTimeline} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1">
        <div className="bg-[#FFFFFF] dark:bg-[#13131F] border border-[#000000]/14 dark:border-[#FFFFFF]/10 rounded-xl p-5 shadow-sm">
          <TransactionGraph />
        </div>
      </div>
    </div>
  );
}
