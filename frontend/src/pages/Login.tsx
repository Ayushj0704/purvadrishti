import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ShieldAlert } from "lucide-react";
import { Wordmark } from "../components/layout/Wordmark";
import { Button } from "../components/ui/Button";

const DEMO_CREDENTIALS = { username: "investigator", password: "demo" };

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
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (username === DEMO_CREDENTIALS.username && password === DEMO_CREDENTIALS.password) {
      localStorage.setItem("auth_token", "demo_token_123");
      navigate("/");
    } else {
      setError("Credentials rejected. Use investigator / demo.");
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-void">
      <div className="grid-backdrop" />
      <div className="glow-field -top-40 left-1/4" />
      <div className="noise-overlay" />

      <div className="relative z-10 mx-auto grid min-h-screen max-w-[110rem] lg:grid-cols-12">
        {/* Manifesto */}
        <section className="flex flex-col justify-between gap-16 border-hairline px-5 py-10 sm:px-8 lg:col-span-7 lg:border-r lg:py-14">
          <div className="flex items-center gap-3 text-accent">
            <Wordmark className="size-8" />
            <div className="flex flex-col leading-none">
              <span className="text-base font-semibold tracking-[-0.03em] text-ink">
                PurvaDrishti
              </span>
              <span className="eyebrow mt-1.5">Cash-out intelligence</span>
            </div>
          </div>

          <div className="animate-rise">
            <p className="eyebrow text-accent">Smart India Hackathon 26</p>
            <h1 className="display mt-8 text-[clamp(3rem,8.5vw,7.5rem)] text-ink">
              The money
              <br />
              leaves a trail.
              <br />
              <span className="text-accent">We read it.</span>
            </h1>
            <p className="mt-8 max-w-lg text-sm leading-relaxed text-muted">
              Fraud funds surface as cash within hours, somewhere in India. PurvaDrishti turns a
              victim complaint into a ranked list of probable ATMs and a predicted withdrawal
              window — before the cash is gone.
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
              record you see is generated.
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
                placeholder="investigator"
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

            <Button type="submit" variant="primary" className="w-full justify-between">
              Enter console
              <ArrowRight className="size-3.5" />
            </Button>
          </form>

          <div className="flex items-center justify-between border-t border-hairline pt-6">
            <span className="label-caps text-faint">LEA / Bank / I4C</span>
            <span className="label-caps text-faint">Audit logged</span>
          </div>
        </section>
      </div>
    </div>
  );
}
