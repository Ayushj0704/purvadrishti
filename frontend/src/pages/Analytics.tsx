import { useState, useEffect } from 'react';
import { BarChart2 } from 'lucide-react';
import { ThreatVelocityChart } from '../charts/ThreatVelocityChart';
import { RecallAtKChart } from '../charts/RecallAtKChart';

export function Analytics() {
  const [isLoading, setIsLoading] = useState(true);
  const [threatData, setThreatData] = useState<any[]>([]);
  const [recallData, setRecallData] = useState<any[]>([]);

  useEffect(() => {
    const loadAnalytics = () => {
      setIsLoading(true);
      setTimeout(() => {
        const generateTimeData = () => {
          const result = [];
          const now = new Date();
          for (let i = 24; i >= 0; i--) {
            const d = new Date(now.getTime() - i * 3600000);
            result.push({
              time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              complaints: Math.floor(Math.random() * 50) + 10,
              predictions: Math.floor(Math.random() * 45) + 5
            });
          }
          return result;
        };

        setThreatData(generateTimeData());
        
        setRecallData([
          { k: 'K=1', recall: 42.5 },
          { k: 'K=3', recall: 68.2 },
          { k: 'K=5', recall: 82.4 },
          { k: 'K=10', recall: 94.1 }
        ]);

        setIsLoading(false);
      }, 500);
    };

    loadAnalytics();
  }, []);

  return (
    <div className="flex flex-col space-y-6 py-4">
      <div className="flex flex-col">
        <h1 className="text-2xl font-bold tracking-tight text-[#000000] dark:text-[#FFFFFF] flex items-center gap-2">
          <BarChart2 className="w-6 h-6 text-[#1A2FFB]" />
          Model Analytics & Evaluation
        </h1>
        <p className="text-xs font-mono text-[#6E7182] dark:text-[#9699AA] mt-1">Live performance metrics and threat velocity streams.</p>
      </div>

      <div className="flex flex-col space-y-6">
        <section className="flex flex-col gap-2">
          <h2 className="text-[10px] font-mono font-semibold text-[#6E7182] dark:text-[#9699AA] uppercase tracking-widest">Predictive Accuracy Pipeline</h2>
          <div className="bg-[#FFFFFF] dark:bg-[#13131F] border border-[#000000]/14 dark:border-[#FFFFFF]/10 rounded-xl overflow-hidden p-1">
            <RecallAtKChart data={recallData} crossStateRecall={74.8} precisionAt5={28.6} />
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-[10px] font-mono font-semibold text-[#6E7182] dark:text-[#9699AA] uppercase tracking-widest">Ingestion & Processing Velocity</h2>
          <div className="bg-[#FFFFFF] dark:bg-[#13131F] border border-[#000000]/14 dark:border-[#FFFFFF]/10 rounded-xl overflow-hidden p-1">
            <ThreatVelocityChart data={threatData} isLoading={isLoading} />
          </div>
        </section>
      </div>
    </div>
  );
}
