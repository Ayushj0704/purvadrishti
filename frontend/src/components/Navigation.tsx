import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Bell, BarChart2 } from 'lucide-react';

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { path: '/alerts', label: 'Alerts', icon: Bell },
  { path: '/analytics', label: 'Analytics', icon: BarChart2 },
];

export function Navigation() {
  const location = useLocation();
  const currentSection =
    NAV_ITEMS.find(i =>
      i.exact ? location.pathname === i.path : location.pathname.startsWith(i.path)
    )?.label || 'Dashboard';

  return (
    <>
      {/* Desktop nav breadcrumb + pills */}
      <div className="sticky top-16 z-30 w-full px-4 sm:px-6 lg:px-8 py-3 pointer-events-none">
        <div className="max-w-7xl mx-auto flex items-center justify-between pointer-events-auto gap-4">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#FFFFFF]/95 dark:bg-[#13131F]/90 backdrop-blur-xl border border-[#000000]/14 dark:border-[#FFFFFF]/10 shadow-sm text-xs font-mono tracking-wider uppercase">
            <span className="w-2 h-2 rounded-full bg-[#1A2FFB] animate-pulse" />
            <span className="text-[#6E7182] dark:text-[#9699AA]">SYSTEM //</span>
            <span className="text-[#000000] dark:text-[#FFFFFF] font-bold">{currentSection}</span>
          </div>

          {/* Desktop Nav Pills */}
          <nav className="hidden md:flex items-center gap-1 p-1 rounded-full bg-[#FFFFFF]/95 dark:bg-[#13131F]/90 backdrop-blur-xl border border-[#000000]/14 dark:border-[#FFFFFF]/10 shadow-sm">
            {NAV_ITEMS.map(({ path, label, icon: Icon, exact }) => (
              <NavLink
                key={path}
                to={path}
                end={exact}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono uppercase tracking-wider transition-all duration-200 ${
                    isActive
                      ? 'bg-[#1A2FFB] text-[#FFFFFF] shadow-sm font-semibold'
                      : 'text-[#2B2E3A] dark:text-[#9699AA] hover:text-[#000000] dark:hover:text-[#FFFFFF] hover:bg-[#000000]/5 dark:hover:bg-[#FFFFFF]/5'
                  }`
                }
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      </div>

      {/* Mobile Nav */}
      <div className="flex md:hidden overflow-x-auto gap-2 px-4 pb-2 scrollbar-none pointer-events-auto">
        {NAV_ITEMS.map(({ path, label, icon: Icon, exact }) => (
          <NavLink
            key={path}
            to={path}
            end={exact}
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono uppercase tracking-wider whitespace-nowrap border ${
                isActive
                  ? 'bg-[#000000] text-[#FFFFFF] dark:bg-[#FFFFFF] dark:text-[#000000] border-transparent'
                  : 'bg-[#FFFFFF] dark:bg-[#13131F]/90 text-[#2B2E3A] dark:text-[#9699AA] border-[#000000]/14 dark:border-[#FFFFFF]/10'
              }`
            }
          >
            <Icon className="w-3 h-3" />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </>
  );
}
