import { useState } from 'react';
import { useNavigate } from 'react-router-dom';


export function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  
  // Need to handle theme at page level since it's outside ProtectedRoute
  // We'll wrap it in ThemeProvider inside App.tsx or use raw classes
  // Wait, if it's outside ThemeProvider, useTheme will fail.
  // I'll make a standalone theme wrapper or just rely on global body dark class.
  // To avoid crash if outside ThemeProvider, let's just use document.documentElement.classList
  
  const isDark = document.documentElement.classList.contains('dark');
  const [theme, setTheme] = useState(isDark ? 'dark' : 'light');

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    if (newTheme === 'dark') {
       document.documentElement.classList.add('dark');
    } else {
       document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('purvadrishti-theme', newTheme);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (username === 'investigator' && password === 'demo') {
      localStorage.setItem('auth_token', 'demo_token_123');
      navigate('/');
    } else {
      setError('Invalid credentials. Use investigator / demo');
    }
  };

  return (
    <div className={theme}>
      <div className="min-h-screen bg-[#E6E9F4] dark:bg-gradient-to-br dark:from-[#0B0B12] dark:via-[#111827] dark:to-[#0B0B12] flex flex-col items-center justify-center p-6 transition-colors duration-300">
        {/* Top bar with theme toggle */}
        <div className="absolute top-4 right-4">
          <button
            onClick={toggleTheme}
            className="w-9 h-9 rounded-full bg-[#FFFFFF] dark:bg-[#1E1F2B] border border-[#000000]/14 dark:border-[#FFFFFF]/10 flex items-center justify-center text-[#000000] dark:text-[#FFFFFF] transition-all"
            aria-label="Toggle Theme"
          >
            {theme === 'dark' ? '☀' : '🌙'}
          </button>
        </div>

        {/* Security warning */}
        <div className="w-full max-w-sm mb-6 bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-xl px-4 py-2.5 text-center">
          <p className="text-xs text-[#F59E0B] font-mono font-medium">
            ⚠ DEMO: Does not connect to live NCRP, banking or I4C systems
          </p>
        </div>

        {/* Login Card */}
        <div className="w-full max-w-sm bg-[#FFFFFF] dark:bg-[#13131F] border border-[#000000]/14 dark:border-[#FFFFFF]/10 rounded-2xl p-8 shadow-2xl">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 rounded-full bg-[#000000] dark:bg-[#FFFFFF] text-[#FFFFFF] dark:text-[#000000] flex items-center justify-center font-bold text-lg tracking-tight mb-4 shadow-lg">
              PD
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[#000000] dark:text-[#FFFFFF]">Purvadrishti</h1>
            <p className="text-xs font-mono text-[#6E7182] dark:text-[#9699AA] mt-1 uppercase tracking-widest text-center">Cyber Fraud Intelligence Platform</p>
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-5">
            <div>
              <label className="block text-[10px] font-mono font-semibold text-[#6E7182] dark:text-[#9699AA] uppercase tracking-widest mb-2">
                Badge ID / Username
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="bg-[#F8F9FE] dark:bg-[#0B0B12] border border-[#000000]/14 dark:border-[#FFFFFF]/10 rounded-xl px-4 py-3 text-sm text-[#000000] dark:text-[#FFFFFF] placeholder-[#9699AA] focus:outline-none focus:border-[#1A2FFB] focus:ring-1 focus:ring-[#1A2FFB]/30 transition-all w-full"
                placeholder="investigator"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono font-semibold text-[#6E7182] dark:text-[#9699AA] uppercase tracking-widest mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="bg-[#F8F9FE] dark:bg-[#0B0B12] border border-[#000000]/14 dark:border-[#FFFFFF]/10 rounded-xl px-4 py-3 text-sm text-[#000000] dark:text-[#FFFFFF] placeholder-[#9699AA] focus:outline-none focus:border-[#1A2FFB] focus:ring-1 focus:ring-[#1A2FFB]/30 transition-all w-full"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div className="text-[#FF4C41] text-xs p-3 bg-[#FF4C41]/10 border border-[#FF4C41]/20 rounded-xl font-mono">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-[#1A2FFB] hover:bg-[#0A1FDB] text-white font-semibold text-sm py-3 px-4 rounded-xl transition-all shadow-lg shadow-[#1A2FFB]/25 mt-1"
            >
              Authenticate
            </button>
          </form>

          <p className="text-[10px] text-[#9699AA] text-center mt-6 leading-relaxed font-mono">
            Authorized law enforcement and partner use only.<br />All activity is monitored and logged.
          </p>
        </div>
      </div>
    </div>
  );
}
