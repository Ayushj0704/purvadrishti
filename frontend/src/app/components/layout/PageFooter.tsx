import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";

/**
 * The console footer.
 *
 * The layout is the Lusion reference: an operations panel on the left,
 * navigation in the middle, then the wordmark set large enough to be the
 * page's last real object. The identity is this project's - the accent is
 * --color-accent-strong rather than the reference's #1A2FFB, and every tone
 * comes from tokens.css so the footer tracks the palette if it is retuned.
 *
 * Note the footer has to work on both sides of the app. The landing page is
 * React-free on purpose (see landing/dom.ts), so it cannot render this component
 * and carries its own port in landing/sections.ts instead. The two are kept in
 * step deliberately: same structure, same zones, same wordmark treatment.
 */

const CONSOLE_LINKS = [
  { to: "/", label: "Overview", index: "01" },
  { to: "/cases", label: "Cases", index: "02" },
  { to: "/alerts", label: "Alerts", index: "03" },
  { to: "/analytics", label: "Analytics", index: "04" },
];

const OPS_ITEMS = [
  { label: "Model", value: "XGB v0.5.0 · 60-min horizon" },
  { label: "Channels", value: "Dashboard · Webhook · SMS · Email" },
  { label: "Access", value: "Authorised roles only · Audit logged" },
];

export function PageFooter() {
  return (
    /* No horizontal padding on the band itself: it is full-bleed now, and the
       gutter belongs to the inner container so the interior can mirror <main>'s
       exact box (mx-auto w-full max-w-[110rem] px-5 sm:px-8) and land on the
       same content edges at every viewport. The previous px-4 sm:px-8 lg:px-12
       sat on the element, which measured 48px of inset against the page's 32px
       and left the footer's columns visibly off the grid. */
    <footer className="relative w-full overflow-hidden border-t border-hairline bg-black pb-12 pt-16 text-ink sm:pt-24">
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

        {/* Mirrors <main>'s box exactly, so the columns below line up with the
            page above. The wordmark is sized in `cqw` against this container
            rather than `vw` against the viewport, which is what keeps its tail
            inside the frame: the band is full-bleed, but this container is
            still capped at the console's max-w, so the measured box is narrower
            than the window and the glyphs scale to the column, not the screen. */}
        {/* `[container-type:inline-size]`, with the brackets: Tailwind v4 dropped
            the unbracketed `container-type: inline-size` form, so the old class
            was silently discarded and never reached the stylesheet. With no
            query container in scope, `cqw` falls back to the small viewport, so
            the wordmark was scaling off the *window* - exactly the bug these
            comments were written to prevent - and clipped once the viewport
            passed the container's max-w. Verified: 2560px rendered the word at
            268.8px (0.105 x 2560) and overflowed its 1696px column by 279px. */}
        <div className="[container-type:inline-size] relative z-10 mx-auto w-full max-w-[110rem] space-y-16 px-5 sm:px-8">
          {/* ------------------------------------------------------- wordmark ---- */}
          {/* Leading the footer rather than closing it: set at display size it
              reads as the footer's heading, and the telemetry settles underneath
              it instead of the page ending on a data panel. A paragraph, not an
              h1 - every console page already has one, and a second here would
              compete with the page title in the document outline. */}
          {/* `cqw`, not `vw`: sized against this container, which is itself
              narrower than the viewport because the band is full-bleed while
              this container stays capped at the console's max-w. Sizing off the
              viewport pushed the tail of the word past the right edge.

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

          {/* ------------------------------------------------ telemetry + links -- */}
        <div className="grid grid-cols-1 items-start gap-12 border-b border-white/10 pb-12 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-8">
            {/* Set in the grotesk, not mono. Wide-tracked uppercase monospace is
                the loudest "generated template" tell there is - see the note in
                tokens.css. Mono is reserved for values a human reads out loud,
                and even those take tabular figures in the grotesk rather than the
                terminal look. */}
            <h2 className="flex items-center gap-2 text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-accent">
              <ShieldCheck aria-hidden="true" className="size-4" />
              <span>Operational footing</span>
            </h2>

            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {OPS_ITEMS.map((item) => (
                <li
                  key={item.label}
                  className="glass-grey rounded-2xl p-4"
                >
                  <span className="text-[0.625rem] font-medium uppercase tracking-[0.1em] text-faint">
                    {item.label}
                  </span>
                  <span className="mt-1 block text-sm font-semibold tracking-[-0.01em] text-ink">
                    {item.value}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <nav aria-label="Console" className="space-y-3 lg:col-span-4">
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
        </div>

        {/* --------------------------------------------------------- credits -- */}
        <div className="flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 text-xs text-faint sm:flex-row">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>Predictive cash-out intelligence</span>
            <span aria-hidden="true">·</span>
            <span>For authorised human decision-makers</span>
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
