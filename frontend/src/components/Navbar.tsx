import { NavLink, useNavigate } from 'react-router-dom';
import { Sun, Moon, LogOut } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    navigate('/login');
  };

  return (
    <header className="fixed top-0 left-0 w-full z-50 transition-all duration-300">
      <div className="w-full px-4 sm:px-8 lg:px-12 py-3 flex items-center justify-between bg-[#FFFFFF]/95 dark:bg-[#0B0B12]/95 backdrop-blur-xl border-b border-[#000000]/10 dark:border-[#FFFFFF]/10">
        {/* Logo */}
        <NavLink to="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-full bg-[#000000] dark:bg-[#FFFFFF] text-[#FFFFFF] dark:text-[#000000] flex items-center justify-center font-bold text-xs tracking-tighter group-hover:bg-[#1A2FFB] group-hover:text-[#FFFFFF] transition-all duration-300 shadow-sm">
            PD
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-lg tracking-tight text-[#000000] dark:text-[#FFFFFF] group-hover:text-[#1A2FFB] transition-colors leading-none">
              Purvadrishti
            </span>
            <span className="text-[9px] font-mono uppercase tracking-widest text-[#6E7182] dark:text-[#9699AA] mt-0.5">
              CYBER FRAUD INTELLIGENCE
            </span>
          </div>
        </NavLink>

        {/* Right side */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Demo badge */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[#000000]/14 dark:border-[#FFFFFF]/10 bg-[#FFFFFF] dark:bg-[#1E1F2B] text-[9px] font-mono uppercase tracking-widest text-[#6E7182] dark:text-[#9699AA]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
            DEMO
          </div>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="w-9 h-9 rounded-full bg-[#FFFFFF] dark:bg-[#1E1F2B] hover:bg-[#F8F9FE] dark:hover:bg-[#13131F] border border-[#000000]/14 dark:border-[#FFFFFF]/10 hover:border-[#1A2FFB] flex items-center justify-center text-[#000000] dark:text-[#FFFFFF] transition-all duration-300 shadow-xs"
            aria-label="Toggle Theme"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-[#F59E0B]" />
            ) : (
              <Moon className="w-4 h-4 text-[#000000]" />
            )}
          </button>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 h-9 px-4 rounded-full bg-[#FFFFFF] dark:bg-[#1E1F2B] hover:bg-[#F8F9FE] dark:hover:bg-[#13131F] border border-[#000000]/14 dark:border-[#FFFFFF]/10 hover:border-[#1A2FFB] text-xs font-semibold uppercase tracking-wider text-[#000000] dark:text-[#FFFFFF] transition-all duration-300 shadow-xs"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:block">Sign Out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
