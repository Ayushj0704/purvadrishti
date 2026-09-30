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
        <main className="mx-auto w-full max-w-[110rem] px-5 pb-40 pt-14 sm:px-8 sm:pb-44 sm:pt-20 print:max-w-none print:p-0">
          {children}
        </main>

        {/* A sibling of <main>, not a child of it. Nested, the footer's band and
            its top border stopped at the console's max-w-[110rem] gutter and
            read as another panel rather than the end of the page; out here they
            run the full viewport width. The interior re-enters the same
            max-width and padding (PageFooter mirrors this element's box), so the
            footer's own columns still sit on the page's grid.

            The gap that used to be main's bottom padding plus the footer's
            mt-24 is now carried by main's pb-40/pb-44 alone, so the space above
            the band is unchanged.

            Landing and Login are excluded by construction, not by a flag: the
            landing page cannot render React at all (landing/dom.ts) and Login
            sits outside ProtectedRoute, so neither reaches this component. */}
        <div className="print:hidden">
          <PageFooter />
        </div>
      </div>
    </div>
  );
}
