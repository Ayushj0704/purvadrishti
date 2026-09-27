import { useTheme } from '../context/ThemeContext';
import { Navbar } from './Navbar';
import { Navigation } from './Navigation';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { theme } = useTheme();
  return (
    <div className={theme}>
      <div className="min-h-screen flex flex-col font-sans bg-[#E6E9F4] dark:bg-[#0B0B12] text-[#000000] dark:text-[#F0F1FA] transition-colors duration-300 overflow-x-hidden">
        <Navbar />
        <div className="pt-16">
          <Navigation />
        </div>
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pb-12 relative z-10">
          {children}
        </main>
      </div>
    </div>
  );
}
