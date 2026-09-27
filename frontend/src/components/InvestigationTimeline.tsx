interface TimelineEvent {
  id: string;
  timestamp: string;
  description: string;
  type: 'TRANSACTION' | 'COMPLAINT' | 'GENERATION' | 'PREDICTION' | 'ALERT' | 'ACTION';
}

interface InvestigationTimelineProps {
  events: TimelineEvent[];
}

export function InvestigationTimeline({ events }: InvestigationTimelineProps) {
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'TRANSACTION': return 'bg-[#6E7182]';
      case 'COMPLAINT': return 'bg-[#FF4C41]';
      case 'GENERATION': return 'bg-[#1A2FFB]';
      case 'PREDICTION': return 'bg-[#9333EA]';
      case 'ALERT': return 'bg-[#F59E0B]';
      case 'ACTION': return 'bg-[#10B981]';
      default: return 'bg-[#6E7182]';
    }
  };

  return (
    <div className="bg-transparent">
      <h3 className="text-[10px] font-mono font-semibold text-[#6E7182] dark:text-[#9699AA] uppercase tracking-widest mb-5">Investigation Timeline</h3>
      <div className="relative border-l border-[#000000]/10 dark:border-[#FFFFFF]/10 ml-3 space-y-6 pb-2">
        {events.map((event, _idx) => {
          const time = new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          return (
            <div key={event.id} className="relative pl-6">
              <div className={`absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full ${getTypeColor(event.type)} ring-4 ring-[#FFFFFF] dark:ring-[#13131F] shadow-sm`} />
              <div className="flex items-baseline gap-3">
                <span className="text-[11px] font-mono font-medium text-[#6E7182] dark:text-[#9699AA] w-12 shrink-0">{time}</span>
                <span className="text-sm font-medium text-[#000000] dark:text-[#FFFFFF]">{event.description}</span>
              </div>
            </div>
          );
        })}
        {events.length === 0 && (
          <div className="pl-6 text-sm font-mono text-[#9699AA]">No events logged.</div>
        )}
      </div>
    </div>
  );
}
