import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";

/**
 * The console footer.
 *
 * Deliberately operational rather than promotional. An earlier pass led with
 * live "global telemetry clocks" for Guwahati / London / New York and closed
 * with an "engineering dispatch" signup form. Neither belonged here: the
 * clocks asserted a distributed operational footprint this deployment does not
 * have, and the form collected an address for a mailing list that does not
 * exist. Both are gone. What remains is what a user of a law-enforcement
 * console actually needs to know before handling a case: the handling rules it
 * runs under, where to go next, and how to read the status tones.
 *
 * Note the footer has to work on both sides of the app. The landing page is
 * React-free on purpose (see landing/dom.ts), so it cannot render this component
 * and carries its own port in landing/sections.ts instead. The two are kept in
 * step deliberately: same structure, same zones, same wordmark treatment.
 */

/** Mirrors TopNav, so the two never disagree about what exists. */
const CONSOLE_LINKS = [
  { to: "/", label: "Overview", index: "01" },
  { to: "/cases", label: "Cases", index: "02" },
  { to: "/alerts", label: "Alerts", index: "03" },
  { to: "/analytics", label: "Analytics", index: "04" },
];

/** The same tone scale StatusPill draws, spelled out. */
const STATUS_LEGEND = [
  { tone: "bg-accent", label: "Open", detail: "Logged, not yet worked" },
  { tone: "bg-elevated-risk", label: "Investigating", detail: "Assigned and in progress" },
  { tone: "bg-critical", label: "Escalated", detail: "Needs supervisor attention" },
  { tone: "bg-faint", label: "Closed", detail: "Outcome recorded" },
];

const HANDLING = [
  "Authorised use only",
  "Every action audit logged",
  "No live banking, NCRP or I4C connections",
  "Case data does not leave this deployment",
];

export function PageFooter() {
  return (
    <footer className="relative mt-24 w-full overflow-hidden border-t border-hairline bg-black px-4 pb-12 pt-16 text-ink sm:px-8 sm:pt-24 lg:px-12">
      {/* Ambient glow. Decorative, and blurred hard enough that it never has an
          edge to see - aria-hidden so it stays out of the accessibility tree. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-0 top-0 h-[500px] w-[500px] rounded-full bg-accent-strong/10 blur-[120px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-0 h-[400px] w-[400px] rounded-full bg-accent-strong/[0.06] blur-[100px]"
      />

        {/* max-w matches the rest of the console, and the wordmark is sized in
            `cqw` against this container rather than `vw` against the viewport.
            The footer is nested inside the page's own max-w-[110rem] shell, so
            at a wide viewport the container is narrower than the window - sizing
            off vw made the wordmark overflow the container and clip at the right
            edge, while looking correctly sized on the landing page where it is
            not nested. */}
        <div className="container-type: inline-size relative z-10 mx-auto max-w-[110rem] space-y-16">
          {/* ------------------------------------------------------- wordmark ---- */}
          {/* Leading the footer rather than closing it: set at display size it
              reads as the footer's heading, and the content settles underneath
              it instead of the page ending on a data panel. A paragraph, not an
              h1 - every console page already has one, and a second here would
              compete with the page title in the document outline. */}
          {/* `cqw`, not `vw`: sized against this container, which is itself
              narrower than the viewport because the footer is nested inside the
              page's max-w-[110rem] shell. Sizing off the viewport pushed the
              tail of the word past the right edge on every console page.

              10.5cqw, not 12: "PURVADRISHTI" is 12 glyphs plus the full stop at
              font-black / tracking-tighter, which measures at about 8.8em of
              advance. 12cqw of a 1600px container rendered 1693px of text and
              overflowed by 93px; 8.8em only fits once the coefficient drops to
              roughly 11.3cqw, and the narrow-viewport case (the same 8.8em
              against a 288px box) needs less again. 10.5cqw clears the widest
              ratio with headroom for the stop and the hover state. */}
          <p
            className="select-none py-8 text-[10.5cqw] font-black leading-none tracking-tighter text-ink opacity-90 transition-colors duration-500 hover:text-accent-strong"
            aria-label="PurvaDrishti"
          >
            PURVADRISHTI
            <span aria-hidden="true" className="text-accent-strong">
              .
            </span>
          </p>

          {/* ------------------------------------------------ handling + links -- */}
        <div className="grid grid-cols-1 items-start gap-12 border-b border-white/10 pb-12 lg:grid-cols-12">
          <section className="space-y-5 lg:col-span-5">
            <h2 className="flex items-center gap-2 text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-accent">
              <ShieldCheck aria-hidden="true" className="size-4" />
              <span>Handling</span>
            </h2>
            <ul className="space-y-2.5">
              {HANDLING.map((rule) => (
                <li key={rule} className="flex items-start gap-2.5 text-xs leading-relaxed text-muted">
                  <span aria-hidden="true" className="mt-[0.4375rem] size-1 shrink-0 rounded-full bg-accent" />
                  {rule}
                </li>
              ))}
            </ul>
          </section>

          <nav aria-label="Console" className="space-y-3 lg:col-span-3">
            <h2 className="mb-2 block text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-faint">
            Console
          </h2>
            <ul className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2 lg:grid-cols-1">
              {CONSOLE_LINKS.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="block py-1 text-faint transition-colors hover:text-ink"
                  >
                    <span className="text-accent">{link.index}</span> / {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <section className="space-y-5 lg:col-span-4">
            <h2 className="block text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-faint">
              Case status
            </h2>
            <dl className="space-y-3">
              {STATUS_LEGEND.map((entry) => (
                <div key={entry.label} className="flex items-baseline gap-2.5">
                  <span aria-hidden="true" className={`size-1.5 shrink-0 rounded-full ${entry.tone}`} />
                  <dt className="shrink-0 text-xs font-medium text-ink">{entry.label}</dt>
                  <dd className="text-xs leading-relaxed text-faint">{entry.detail}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>

        {/* --------------------------------------------------------- credits -- */}
        <div className="flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 text-xs text-faint sm:flex-row">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>Predictive cash-out intelligence</span>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
            <span>Authorised use only · Audit logged</span>
            {/* An <a href="#..."> would move focus without telling the browser
                where, so the top is reached with an explicit focus move first. */}
            <button
              type="button"
              onClick={() => {
                window.scrollTo({ top: 0, behavior: "smooth" });
                document.querySelector<HTMLElement>("main a, main button, h1")?.focus();
              }}
              className="flex items-center gap-1 text-ink transition-colors hover:text-accent-strong"
            >
              Back to top <span aria-hidden="true">↑</span>
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
