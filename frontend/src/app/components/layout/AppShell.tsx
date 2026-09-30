import type { ReactNode } from "react";
import { PageFooter } from "./PageFooter";
import { TopNav } from "./TopNav";
import { NetworkBackground } from "./NetworkBackground";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen bg-void print:bg-white">
      <div className="grid-backdrop print:hidden" />
      <div className="glow-field -top-[30rem] -left-[20rem] print:hidden" />
      <div className="print:hidden">
        <NetworkBackground />
      </div>
      <div className="noise-overlay print:hidden" />

      <div className="print:hidden">
        <TopNav />
      </div>

      <div className="relative z-10 pt-16 print:pt-0">
        <main className="mx-auto w-full max-w-[110rem] px-5 py-14 sm:px-8 sm:py-20 print:max-w-none print:p-0">
          {children}
          <div className="print:hidden">
            <PageFooter />
          </div>
        </main>
      </div>
    </div>
  );
}
