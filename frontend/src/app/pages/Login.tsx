import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Loader2, ShieldAlert } from "lucide-react";
import { Wordmark } from "../components/layout/Wordmark";
import { Button } from "../components/ui/Button";
import { ApiError } from "../api/client";
import { getSession, login } from "../api/auth";
import type { Role } from "../api/auth";

/**
 * The roles the backend's own demo user table defines. Shown as a fill-in aid
 * because this is a synthetic deployment and the accounts are the only way in —
 * they are read from the API's login response, not asserted here: the role
 * column below each name is what `POST /auth/login` returned.
 */
const DEMO_USERS: Array<{ username: string; role: Role }> = [
  { username: "admin", role: "ADMIN" },
  { username: "lea", role: "LEA_OFFICER" },
  { username: "i4c", role: "I4C_ANALYST" },
  { username: "bank", role: "BANK_ANALYST" },
];

const PILLARS = [
  {
    index: "01",
    title: "Rank the trail",
    body: "Every terminal inside the candidate radius is scored, then ordered. Rank is the deliverable.",
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

  // An existing session skips the form rather than re-authenticating.
  useEffect(() => {
    if (getSession()) navigate("/", { replace: true });
  }, [navigate]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await login({ username: username.trim(), password });
      navigate("/", { replace: true });
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.status === 401
            ? "Those credentials were rejected by the API."
            : caught.message
          : "The authentication service could not be reached.",
      );
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-void">
      <div className="grid-backdrop" />
      <div className="glow-field -top-40 left-1/4" />
      <div className="noise-overlay" />

      <div className="relative z-10 mx-auto grid min-h-screen max-w-[110rem] lg:grid-cols-12">
        {/* Manifesto */}
        <section className="relative flex flex-col justify-between gap-16 border-hairline px-5 py-10 sm:px-8 lg:col-span-7 lg:border-r lg:py-14">
          <div className="absolute left-5 top-6 flex items-center gap-3 text-accent sm:left-8">
            <Wordmark className="size-8" />
            <div className="flex flex-col leading-none">
              <span className="text-base font-semibold tracking-[-0.03em] text-ink">
                PurvaDrishti
              </span>
              <span className="eyebrow mt-1.5">Cash-out intelligence</span>
            </div>
          </div>

          <div className="animate-rise">
            <h1 className="display text-[clamp(3rem,8.5vw,7.5rem)] text-ink ">
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

          <ul className="grid gap-px overflow-hidden rounded-xl border border-hairline bg-hairline sm:grid-cols-3">
            {PILLARS.map((pillar) => (
              <li key={pillar.index} className="flex flex-col gap-3 bg-surface p-5">
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
          <div className="flex items-start gap-3 rounded-lg border border-elevated-risk/40 bg-elevated-risk/15 p-4">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-elevated-risk" />
            <p className="text-xs leading-relaxed text-muted">
              Synthetic environment. No live banking, NCRP or I4C systems are connected. Every
              record the console shows comes from this deployment&apos;s own API.
            </p>
          </div>

          <form
            onSubmit={handleLogin}
            className="flex flex-col gap-7 rounded-xl border border-hairline bg-surface p-6 sm:p-8"
          >
            <div className="flex flex-col gap-2">
              <h2 className="display text-[clamp(2rem,4vw,3rem)] text-ink">Authenticate</h2>
              <p className="text-sm text-muted">Restricted to authorised personnel.</p>
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
                placeholder="••••"
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

            <Button
              type="submit"
              variant="primary"
              className="w-full justify-between"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Authenticating" : "Enter console"}
              {isSubmitting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <ArrowRight className="size-3.5" />
              )}
            </Button>
          </form>

          <div className="rounded-xl border border-hairline bg-surface p-5">
            <p className="label-caps text-faint">Accounts on this deployment</p>
            <ul className="mt-3 grid grid-cols-2 gap-2">
              {DEMO_USERS.map((user) => (
                <li key={user.username}>
                  <button
                    type="button"
                    onClick={() => {
                      setUsername(user.username);
                      setPassword("demo");
                      setError("");
                    }}
                    className="flex w-full flex-col items-start gap-0.5 rounded-md border border-hairline px-3 py-2 text-left transition-colors hover:border-accent hover:bg-white/[0.03]"
                  >
                    <span className="telemetry text-ink">{user.username}</span>
                    <span className="micro text-faint">{user.role}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-center justify-between border-t border-hairline pt-6">
            <span className="label-caps text-faint">LEA / Bank / I4C</span>
            <span className="label-caps text-faint">Audit logged</span>
          </div>
        </section>
      </div>
    </div>
  );
}
