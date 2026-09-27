import type { ReactNode } from "react";
import { PageFooter } from "./PageFooter";
import { StatusStrip } from "./StatusStrip";
import { TopNav } from "./TopNav";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen bg-void">
      <div className="grid-backdrop" />
      <div className="glow-field -top-[30rem] -left-[20rem]" />
      <div className="noise-overlay" />

      <TopNav />

      <div className="relative z-10 pt-16">
        <StatusStrip />
        <main className="mx-auto w-full max-w-[110rem] px-5 py-14 sm:px-8 sm:py-20">
          {children}
          <PageFooter />
        </main>
      </div>
    </div>
  );
}
