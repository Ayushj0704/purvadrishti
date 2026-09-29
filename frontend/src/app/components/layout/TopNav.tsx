import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Wordmark } from "./Wordmark";
import { clearSession, getRole } from "../../api/auth";
import { healthApi } from "../../api/health";
import type { Health } from "../../api/health";
import { useStreamStatus } from "../../api/events";
import { StatusDot } from "../ui/StatusDot";

const NAV_ITEMS = [
  { to: "/", label: "Overview", index: "01" },
  { to: "/alerts", label: "Alerts", index: "02" },
  { to: "/cases", label: "Cases", index: "03" },
];

/**
 * Health and the event stream are separate signals and are reported as such.
 * The dot reflects the stream — that is the "are we receiving alerts right now"
 * question — while the model label beside it comes from /health, so a backend
 * running its heuristic fallback is visibly different from one running the
 * trained model even when both are perfectly reachable.
 */
function useBackendStatus(): { health: Health | null; stream: ReturnType<typeof useStreamStatus> } {
  const stream = useStreamStatus();
  const [health, setHealth] = useState<Health | null>(null);

  useEffect(() => {
    let cancelled = false;
    healthApi
      .getHealth()
      .then((value) => {
        if (!cancelled) setHealth(value);
      })
      .catch(() => {
        // Health failing is a status, not an error to surface here; the strip
        // reports the backend as unreachable and the pages show their own
        // failures with the real message.
        if (!cancelled) setHealth(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { health, stream };
}

export function TopNav() {
  const navigate = useNavigate();
  const { health, stream } = useBackendStatus();

  const handleSignOut = () => {
    clearSession();
    navigate("/login", { replace: true });
  };

  const live = stream === "live";
  const label = live ? "Live" : stream === "reconnecting" ? "Reconnecting" : "Connecting";
  const model = health ? health.model : "unreachable";

  return (
    <header className="fixed inset-x-0 top-0 z-50 bg-transparent backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[110rem] items-center justify-between gap-8 px-5 sm:px-8">
        <NavLink to="/" className="group flex items-center gap-3 text-accent">
          <Wordmark />
          <span className="flex flex-col leading-none">
            <span className="text-[0.9375rem] font-semibold tracking-[-0.03em] text-ink">
              PurvaDrishti
            </span>
            <span className="eyebrow mt-1">Cash-out intelligence</span>
          </span>
        </NavLink>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                [
                  "group relative px-4 py-2 transition-colors duration-200",
                  isActive ? "text-ink" : "text-faint hover:text-muted",
                ].join(" ")
              }
            >
              {({ isActive }) => (
                <>
                  <span className="label-caps">{item.label}</span>
                  <span
                    className={[
                      "absolute inset-x-4 -bottom-px h-px origin-left transition-transform duration-300",
                      isActive ? "scale-x-100 bg-accent" : "scale-x-0 bg-transparent",
                    ].join(" ")}
                  />
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <div
            className="label-caps hidden items-center gap-2 rounded-full border border-hairline px-3 py-2 text-muted sm:flex"
            title={`Model: ${model}`}
          >
            <StatusDot tone={live ? "stable" : "warning"} pulse={live} />
            {label}
            <span className="text-faint">· {model}</span>
          </div>
          <button
            onClick={handleSignOut}
            className="label-caps rounded-md border border-hairline px-3 py-2 text-muted transition-colors duration-200 hover:border-[#2e2e3a] hover:bg-white/[0.03] hover:text-ink"
          >
            Sign out
            <span className="ml-2 text-faint">{getRole() ?? ""}</span>
          </button>
        </div>
      </div>

      <nav
        data-lenis-prevent
        className="flex items-center gap-1 overflow-x-auto border-t border-transparent px-5 md:hidden"
      >
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              [
                "label-caps whitespace-nowrap border-b-2 px-3 py-3 transition-colors",
                isActive
                  ? "border-accent text-ink"
                  : "border-transparent text-faint hover:text-muted",
              ].join(" ")
            }
          >
            <span className="mr-2 text-accent">{item.index}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
