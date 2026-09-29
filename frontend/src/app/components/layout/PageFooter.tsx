import { Link } from "react-router-dom";
import { Globe } from "lucide-react";
import { API_BASE_URL } from "../../api/client";
import { getRole } from "../../api/auth";
import { orDash } from "../../lib/format";

/**
 * The console footer.
 *
 * Two blocks, both of them real. The earlier version of this file carried a
 * "global telemetry clocks" panel naming Guwahati as the model host and New
 * York as the review liaison, plus a newsletter form that submitted to nothing
 * and printed a success receipt. None of that was wired to anything, so it is
 * gone rather than relabelled: what remains is the console's own navigation,
 * where the API is actually pointed, and who is signed in.
 */

const CONSOLE_LINKS = [
  { to: "/", label: "Overview", index: "01" },
  { to: "/alerts", label: "Alerts", index: "02" },
  { to: "/cases", label: "Cases", index: "03" },
];

export function PageFooter() {
  return (
    <footer className="relative mt-24 w-full overflow-hidden border-t border-hairline bg-black px-4 pb-12 pt-16 text-ink sm:px-8 sm:pt-24 lg:px-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-0 top-0 h-[500px] w-[500px] rounded-full bg-accent-strong/10 blur-[120px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-0 h-[400px] w-[400px] rounded-full bg-accent-strong/[0.06] blur-[100px]"
      />

      <div className="container-type: inline-size relative z-10 mx-auto max-w-[110rem] space-y-16">
        <p
          className="select-none py-8 text-[10.5cqw] font-black leading-none tracking-tighter text-ink opacity-90 transition-colors duration-500 hover:text-accent-strong"
          aria-label="PurvaDrishti"
        >
          PURVADRISHTI
          <span aria-hidden="true" className="text-accent-strong">
            .
          </span>
        </p>

        <div className="grid grid-cols-1 items-start gap-12 border-b border-white/10 pb-12 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-5">
            <h2 className="flex items-center gap-2 text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-accent">
              <Globe aria-hidden="true" className="size-4" />
              <span>Data source</span>
            </h2>
            <p className="text-xs leading-relaxed text-faint">
              Every figure on this console is a response from the deployment&apos;s own API.
              Nothing is pre-filled, sampled or cached client-side, and an unreachable
              backend leaves a panel empty rather than filling it with a placeholder.
            </p>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-hairline bg-elevated p-4">
                <dt className="text-[0.625rem] font-medium uppercase tracking-[0.1em] text-faint">
                  API base
                </dt>
                <dd className="telemetry mt-1 block text-sm text-ink">{API_BASE_URL}</dd>
              </div>
              <div className="rounded-2xl border border-hairline bg-elevated p-4">
                <dt className="text-[0.625rem] font-medium uppercase tracking-[0.1em] text-faint">
                  Signed in as
                </dt>
                <dd className="telemetry mt-1 block text-sm text-ink">{orDash(getRole())}</dd>
              </div>
            </dl>
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
              Synthetic environment
            </h2>
            <p className="text-xs leading-relaxed text-faint">
              No live banking, NCRP or I4C system is connected to this deployment. Case
              records on file are generated test data, and ranked output is intelligence
              for a human decision-maker rather than a directive for field action.
            </p>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 text-xs text-faint sm:flex-row">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>Predictive cash-out intelligence</span>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
            <span>Authorised use only · Audit logged</span>
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
