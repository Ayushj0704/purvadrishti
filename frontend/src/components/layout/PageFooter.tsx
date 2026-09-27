import { Wordmark } from "./Wordmark";

export function PageFooter() {
  return (
    <footer className="mt-24 border-t border-hairline">
      <div className="flex flex-col gap-8 py-10 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3 text-faint">
          <Wordmark className="size-5" />
          <div className="flex flex-col leading-none">
            <span className="text-xs font-medium tracking-[-0.02em] text-muted">PurvaDrishti</span>
            <span className="eyebrow mt-1.5">SIH 26 · Predictive cash-out intelligence</span>
          </div>
        </div>

        <p className="max-w-md text-[0.6875rem] leading-relaxed text-faint">
          Ranked intelligence for authorised human decision-makers. Not a directive for field
          action. No live banking, NCRP or I4C systems are connected.
        </p>
      </div>
    </footer>
  );
}
