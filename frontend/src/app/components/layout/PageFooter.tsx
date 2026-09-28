import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Globe } from "lucide-react";

/**
 * The console footer.
 *
 * The layout is the Lusion reference: a telemetry row on the left, navigation in
 * the middle, a dispatch form on the right, then the wordmark set large enough to
 * be the page's last real object. The identity is this project's - the accent is
 * --color-accent-strong rather than the reference's #1A2FFB, and every tone comes
 * from tokens.css so the footer tracks the palette if it is retuned.
 *
 * Note the footer has to work on both sides of the app. The landing page is
 * React-free on purpose (see landing/dom.ts), so it cannot render this component
 * and carries its own port in landing/sections.ts instead. The two are kept in
 * step deliberately: same structure, same zones, same wordmark treatment.
 */

interface Zone {
  city: string;
  zone: string;
  timeZone: string;
  role: string;
  locale: string;
}

/**
 * Three zones with something to say about each, rather than three copies of the
 * same city. `en-GB` for the 24-hour clock in IST and GMT, `en-US` for EST, which
 * is the only one of the three that conventionally carries a meridiem.
 */
const ZONES: Zone[] = [
  { city: "Guwahati", zone: "IST", timeZone: "Asia/Kolkata", role: "Model host", locale: "en-GB" },
  { city: "London", zone: "GMT", timeZone: "Europe/London", role: "Audit desk", locale: "en-GB" },
  { city: "New York", zone: "EST", timeZone: "America/New_York", role: "Review liaison", locale: "en-US" },
];

const CONSOLE_LINKS = [
  { to: "/", label: "Overview", index: "01" },
  { to: "/alerts", label: "Alerts", index: "02" },
  { to: "/analytics", label: "Analytics", index: "03" },
  { to: "/cases", label: "Cases", index: "04" },
];

const readClock = (zone: Zone): string =>
  new Date().toLocaleTimeString(zone.locale, {
    timeZone: zone.timeZone,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

export function PageFooter() {
  const [clocks, setClocks] = useState<Record<string, string>>({});
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    const update = () => {
      // Keyed by city rather than index so a reordering cannot silently relabel
      // a clock - the zone is what identifies the value, not its position.
      const next: Record<string, string> = {};
      for (const zone of ZONES) next[zone.city] = readClock(zone);
      setClocks(next);
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, []);

  // The confirmation self-dismisses. Without this it would stay on screen for
  // the rest of the session, which reads as a stuck state rather than a receipt.
  useEffect(() => {
    if (!subscribed) return;
    const timer = window.setTimeout(() => setSubscribed(false), 4000);
    return () => window.clearTimeout(timer);
  }, [subscribed]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = email.trim();
    if (!value) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setSubscribed(true);
    setEmail("");
  };

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
              reads as the footer's heading, and the telemetry settles underneath
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

          {/* ------------------------------------------------ telemetry + links -- */}
        <div className="grid grid-cols-1 items-start gap-12 border-b border-white/10 pb-12 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-5">
            {/* Set in the grotesk, not mono. Wide-tracked uppercase monospace is
                the loudest "generated template" tell there is - see the note in
                tokens.css. Mono is reserved for values a human reads out loud,
                and even those take tabular figures in the grotesk rather than the
                terminal look. */}
            <h2 className="flex items-center gap-2 text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-accent">
              <Globe aria-hidden="true" className="size-4" />
              <span>Global telemetry clocks</span>
            </h2>

            {/* One polite live region for all three rather than one per clock:
                a screen reader announcing three separate ticking times every
                second is unusable. The visible values update every tick, but
                only the summary is announced, and only on change. */}
            <div
              aria-live="polite"
              aria-atomic="true"
              className="grid grid-cols-1 gap-4 sm:grid-cols-3"
            >
              {ZONES.map((zone) => (
                <div
                  key={zone.city}
                  className="rounded-2xl border border-hairline bg-elevated p-4"
                >
                  <span className="text-[0.625rem] font-medium uppercase tracking-[0.1em] text-faint">
                    {zone.city} ({zone.zone})
                  </span>
                  {/* Grotesk with tabular figures, not monospace: the digits still
                      line up as they tick, without the terminal look that gives
                      mono away at this size. */}
                  <span className="tnum mt-1 block text-lg font-semibold tracking-[-0.02em] text-ink sm:text-xl">
                    {clocks[zone.city] ?? "--:--:--"}
                  </span>
                  <span className="mt-1 block text-[0.6875rem] font-medium text-stable">
                    {zone.role}
                  </span>
                </div>
              ))}
            </div>
          </div>

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

          <div className="space-y-4 lg:col-span-4">
            <h2 className="block text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-faint">
              Engineering dispatch
            </h2>
            <p className="text-xs leading-relaxed text-faint">
              Weekly digests on model retraining, hold-out recall, and what changed in the
              ranking between releases. No case detail leaves the deployment.
            </p>

            <form onSubmit={handleSubmit} noValidate>
              <label htmlFor="dispatch-email" className="sr-only">
                Email address for the engineering dispatch
              </label>
              <div className="flex gap-2">
                <input
                  id="dispatch-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    if (invalid) setInvalid(false);
                  }}
                  placeholder="you@agency.gov.in"
                  aria-invalid={invalid || undefined}
                  aria-describedby={invalid ? "dispatch-error" : undefined}
                  className="field flex-1 rounded-full px-4 py-2.5 text-xs"
                />
                <button
                  type="submit"
                  className="shrink-0 rounded-full bg-accent-strong px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-white transition-colors hover:bg-accent"
                >
                  Join
                </button>
              </div>

              {/* Announced when it appears, which is the only part of this that
                  needs to interrupt a screen reader. */}
              <p
                id="dispatch-error"
                role="status"
                className="mt-2 text-[0.6875rem] text-critical"
              >
                {invalid ? "Enter an email address to join the dispatch." : ""}
              </p>
            </form>

            {subscribed && (
              <p className="flex items-center gap-1.5 text-xs text-accent">
                <CheckCircle2 aria-hidden="true" className="size-3.5" />
                Dispatch subscription activated.
              </p>
            )}
          </div>
        </div>

        {/* --------------------------------------------------------- credits -- */}
        <div className="flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 text-xs text-faint sm:flex-row">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>Smart India Hackathon 26</span>
            <span aria-hidden="true">·</span>
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
