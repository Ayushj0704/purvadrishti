import { NavLink, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Wordmark } from "./Wordmark";
import { authApi } from "../../api/auth";

const NAV_ITEMS = [
  { to: "/", label: "Overview", index: "01" },
  { to: "/cases", label: "Cases", index: "02" },
  { to: "/alerts", label: "Alerts", index: "03" },
  { to: "/analytics", label: "Analytics", index: "04" },
];

export function TopNav() {
  const navigate = useNavigate();
  const [role] = useState(() => authApi.getRole());

  const handleSignOut = () => {
    authApi.logout();
    navigate("/login");
  };

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
          {role && (
            <span className="label-caps hidden rounded-full border border-accent/40 bg-accent/10 px-3 py-2 text-accent sm:flex">
              {role.replace("_", " ")}
            </span>
          )}
          <div className="label-caps hidden items-center gap-2 rounded-full border border-hairline px-3 py-2 text-muted sm:flex">
            <span className="relative inline-flex size-1.5">
              <span className="absolute inset-0 rounded-full bg-stable animate-ping-slow" />
              <span className="relative size-1.5 rounded-full bg-stable" />
            </span>
            Live
          </div>
          <button
            onClick={handleSignOut}
            className="label-caps rounded-md border border-hairline px-3 py-2 text-muted transition-colors duration-200 hover:border-[#2e2e3a] hover:bg-white/[0.03] hover:text-ink"
          >
            Sign out
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
