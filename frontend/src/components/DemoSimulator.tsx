import { useState, useEffect } from 'react';
import { Play, Square, CheckCircle, Activity, ShieldAlert, Cpu, Map, FileSearch } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const DEMO_STEPS = [
  { id: 'txn',       label: 'Fraud Transaction',         icon: Activity,    delay: 1500 },
  { id: 'complaint', label: 'Complaint Registered',       icon: FileSearch,  delay: 1500 },
  { id: 'candidates',label: 'Candidates Generated',       icon: Map,         delay: 2000 },
  { id: 'scored',    label: 'XGBoost Risk Scoring',       icon: Cpu,         delay: 2500 },
  { id: 'alert',     label: 'High-Risk Alert Dispatched', icon: ShieldAlert, delay: 1000 },
  { id: 'action',    label: 'Investigator Opens Case',    icon: CheckCircle, delay: 1000 },
];

export function DemoSimulator() {
  const [isRunning, setIsRunning] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isRunning) return;
    let timeout: ReturnType<typeof setTimeout>;
    if (currentStepIndex < DEMO_STEPS.length - 1) {
      const nextIndex = currentStepIndex + 1;
      const step = DEMO_STEPS[nextIndex];
      timeout = setTimeout(() => {
        setCurrentStepIndex(nextIndex);
        if (step.id === 'alert') navigate('/alerts');
        else if (step.id === 'action') {
          navigate('/cases/C10234');
          setTimeout(() => stopDemo(), 2000);
        }
      }, step.delay);
    }
    return () => clearTimeout(timeout);
  }, [isRunning, currentStepIndex, navigate]);

  const startDemo = () => { navigate('/'); setCurrentStepIndex(-1); setIsRunning(true); };
  const stopDemo  = () => { setIsRunning(false); setCurrentStepIndex(-1); };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {isRunning && currentStepIndex >= 0 && (
        <div className="bg-[#FFFFFF]/95 dark:bg-[#13131F]/95 backdrop-blur-xl border border-[#000000]/14 dark:border-[#FFFFFF]/10 rounded-xl shadow-xl p-4 w-64">
          <h4 className="text-[10px] font-mono font-semibold text-[#6E7182] dark:text-[#9699AA] uppercase tracking-widest mb-3 pb-2 border-b border-[#000000]/10 dark:border-[#FFFFFF]/10">
            Simulation Sequence
          </h4>
          <div className="space-y-2.5">
            {DEMO_STEPS.map((step, idx) => {
              const Icon = step.icon;
              const isActive = idx === currentStepIndex;
              const isPast   = idx < currentStepIndex;
              return (
                <div key={step.id} className={`flex items-center gap-2.5 text-xs font-mono transition-colors ${
                  isPast ? 'text-[#10B981]' : isActive ? 'text-[#1A2FFB] font-semibold' : 'text-[#6E7182] dark:text-[#9699AA]'
                }`}>
                  {isPast   ? <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                  : isActive ? <Icon className="w-3.5 h-3.5 shrink-0 animate-pulse" />
                  : <div className="w-3.5 h-3.5 shrink-0 rounded-full border border-[#000000]/14 dark:border-[#FFFFFF]/10" />}
                  {step.label}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <button
        onClick={isRunning ? stopDemo : startDemo}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-mono font-semibold uppercase tracking-widest transition-all ${
          isRunning
            ? 'bg-[#FF4C41] text-white hover:bg-[#E03A30] shadow-lg shadow-[#FF4C41]/20'
            : 'bg-[#1A2FFB] text-white hover:bg-[#0A1FDB] shadow-lg shadow-[#1A2FFB]/20'
        }`}
      >
        {isRunning
          ? <><Square className="w-3.5 h-3.5" fill="currentColor" /> Stop Simulation</>
          : <><Play  className="w-3.5 h-3.5" fill="currentColor" /> Run Demo Sequence</>}
      </button>
    </div>
  );
}
