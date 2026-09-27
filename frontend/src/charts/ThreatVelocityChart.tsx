import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

interface ThreatData { time: string; complaints: number; predictions: number; }

export function ThreatVelocityChart({ data, isLoading }: { data: ThreatData[]; isLoading?: boolean }) {
  if (isLoading) {
    return (
      <div className="w-full h-[350px] bg-transparent flex items-center justify-center text-sm font-mono text-[#9699AA] animate-pulse">
        Loading threat velocity...
      </div>
    );
  }
  return (
    <div className="bg-transparent p-5">
      <h3 className="text-[10px] font-mono font-semibold text-[#6E7182] dark:text-[#9699AA] uppercase tracking-widest mb-5">Threat Velocity – Last 24h</h3>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gComplaints" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#FF4C41" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#FF4C41" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gPredictions" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#1A2FFB" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#1A2FFB" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#6E7182" opacity={0.2} vertical={false} />
            <XAxis dataKey="time" stroke="#6E7182" fontSize={11} tickLine={false} axisLine={false} dy={8} />
            <YAxis stroke="#6E7182" fontSize={11} tickLine={false} axisLine={false} dx={-8} />
            <Tooltip contentStyle={{ backgroundColor: '#13131F', borderColor: '#333', color: '#F0F1FA', borderRadius: '8px', fontSize: '12px', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }} />
            <Legend wrapperStyle={{ paddingTop: '16px', fontSize: '12px', fontFamily: 'IBM Plex Mono' }} />
            <Area type="monotone" name="New Complaints" dataKey="complaints" stroke="#FF4C41" strokeWidth={2} fillOpacity={1} fill="url(#gComplaints)" />
            <Area type="monotone" name="Predictions Generated" dataKey="predictions" stroke="#1A2FFB" strokeWidth={2} fillOpacity={1} fill="url(#gPredictions)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
