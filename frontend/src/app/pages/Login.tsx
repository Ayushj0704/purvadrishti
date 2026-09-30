import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Wordmark } from "../components/layout/Wordmark";
import { Button } from "../components/ui/Button";
import { GlideSelect } from "../components/ui/GlideSelect";
import { authApi } from "../api/auth";
import { ApiError } from "../api/client";
import { ROLE_OPTIONS } from "../lib/useRole";

const PILLARS = [
  {
    index: "01",
    title: "Rank the trail",
    body: "Every ATM inside the candidate radius is scored, then ordered. Rank is the deliverable.",
  },
  {
    index: "02",
    title: "Window the cash-out",
    body: "A dedicated time regressor returns minutes-to-cash-out so patrol knows when to move.",
  },
  {
    index: "03",
    title: "Cross state lines",
    body: "Victim in Delhi, cash-out in Rajasthan — the trail that used to end the search.",
  },
];

export function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const session = await authApi.login(username.trim(), password);
      authApi.saveSession(session.access_token, session.role);
      navigate("/");
    } catch (err) {
      // Only a 401/403 is actually about the credentials. Anything else is the
      // API being down or erroring: the Vite proxy answers a dead backend with
      // a 502, which fetchClient wraps in ApiError just like a rejected login,
      // so branching on `instanceof ApiError` alone reported a dead server as
      // "Invalid badge ID" and sent people hunting for the wrong problem.
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        setError("Invalid badge ID or passphrase.");
      } else if (err instanceof ApiError) {
        setError(`Auth service unavailable (HTTP ${err.status}). Is the API running?`);
      } else {
        setError("Backend unreachable. Is the API running?");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-void">
      <div className="grid-backdrop" />
      <div className="glow-field -top-40 left-1/4" />
      <div className="noise-overlay" />

      {/* Mark only, deliberately not a navbar. The console pages get TopNav;
          this route is public and gets just the wordmark in the corner, with no
          bar, no blur, no nav row and no fixed positioning to dress it up as
          chrome. It sits at the grid's own px-5 sm:px-8 so the mark still lines
          up with the text column below it. */}
      <div className="absolute left-5 top-5 z-20 sm:left-8 sm:top-6">
        <Link to="/" className="group flex items-center gap-3 text-accent">
          <Wordmark className="size-9" />
          <span className="text-[0.9375rem] font-semibold tracking-[-0.03em] text-ink">
            PurvaDrishti
          </span>
        </Link>
      </div>

      <div className="relative z-10 mx-auto grid min-h-screen max-w-[110rem] lg:grid-cols-12">
        {/* Manifesto */}
        {/* Top padding clears the fixed 4rem header; the group is top-aligned
            with a fixed gap so the space between the heading and the pillar bar
            is a deliberate value rather than whatever `justify-between` had
            left over after stretching to fill the viewport. */}
        <section className="flex flex-col gap-10 border-hairline px-5 pb-10 pt-20 sm:px-8 lg:col-span-7 lg:border-r lg:pb-14 lg:pt-24">
          <div className="animate-rise">
            <h1 className="display text-[clamp(3rem,8.5vw,7.5rem)] text-ink">
              The money
              <br />
              leaves a trail.
              <br />
              <span className="text-accent">We read it.</span>
            </h1>
            <p className="mt-8 max-w-lg text-sm leading-relaxed text-muted">
              Fraud funds surface as cash within hours, somewhere in India. PurvaDrishti turns a
              victim complaint into a ranked list of probable ATMs and a predicted withdrawal
              window, before the cash is gone.
            </p>
          </div>

          <ul className="glass-grey glass-grey-divide grid overflow-hidden rounded-xl sm:grid-cols-3">
            {PILLARS.map((pillar) => (
              <li key={pillar.index} className="flex flex-col gap-3 p-5">
                <span className="label-caps tnum text-accent">{pillar.index}</span>
                <span className="text-sm font-medium tracking-[-0.01em] text-ink">
                  {pillar.title}
                </span>
                <span className="text-xs leading-relaxed text-faint">{pillar.body}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Auth */}
        <section className="flex flex-col justify-center gap-6 px-5 py-10 sm:px-8 lg:col-span-5 lg:py-14">
          <form
            onSubmit={handleLogin}
            className="glass-grey flex flex-col gap-7 rounded-xl p-6 sm:p-8"
          >
            <div className="flex flex-col gap-2">
              <h2 className="display text-[clamp(2rem,4vw,3rem)] text-ink">Authenticate</h2>
              <p className="text-sm text-muted">Restricted to authorised personnel.</p>
            </div>

            <div className="flex flex-col gap-2.5">
              <span className="eyebrow">Role</span>
              <GlideSelect
                size="lg"
                items={ROLE_OPTIONS.map((opt) => ({
                  value: opt.username,
                  label: opt.label,
                  tag: opt.blurb,
                }))}
                value={username}
                onChange={(value) => {
                  setUsername(value);
                  setPassword("demo");
                  setError("");
                }}
                placeholder="Select your role…"
                ariaLabel="Sign in as role"
              />
            </div>

            <label className="flex flex-col gap-2.5">
              <span className="eyebrow">Badge ID</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="field field-mono"
                placeholder="lea"
                autoComplete="username"
                required
              />
            </label>

            <label className="flex flex-col gap-2.5">
              <span className="eyebrow">Passphrase</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="field field-mono"
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </label>

            {error && (
              <p
                role="alert"
                className="rounded-lg border border-critical/50 bg-critical/15 px-4 py-3 text-xs text-critical"
              >
                {error}
              </p>
            )}

            <Button type="submit" variant="primary" className="w-full justify-between" disabled={isSubmitting}>
              {isSubmitting ? "Verifying" : "Enter console"}
              <ArrowRight className="size-3.5" />
            </Button>
          </form>

          <div className="flex items-center justify-between border-t border-hairline pt-6">
            <span className="label-caps text-faint">LEA / Bank / I4C</span>
            <span className="label-caps text-faint">Audit logged</span>
          </div>

          <p className="telemetry flex flex-wrap items-center gap-2 text-faint">
            <span>Demo badges:</span>
            {ROLE_OPTIONS.map((opt) => (
              <button
                key={opt.username}
                type="button"
                onClick={() => {
                  setUsername(opt.username);
                  setPassword("demo");
                  setError("");
                }}
                className="rounded-full border border-hairline px-2.5 py-1 text-[0.6875rem] text-muted transition-colors hover:border-accent hover:text-accent"
              >
                {opt.username}
              </button>
            ))}
          </p>
        </section>
      </div>
    </div>
  );
}
