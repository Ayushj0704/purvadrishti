interface HowItHelpsProps {
  bestAtm?: string;
  bestScore?: number;
  expected?: string;
  candidates?: number;
  caseId?: string;
}

const INK = "#f4f4f5";
const FAINT = "#8a8a96";
const ACCENT = "#6f78ff";
const ACCENT_STRONG = "#3d46ff";
const ACCENT_BRIGHT = "#9aa0ff";
const CRITICAL = "#ff4c41";
const HAIRLINE = "#2e2e3a";
const CARD = "#101014";
const MONO = "'JetBrains Mono', ui-monospace, monospace";

/** Animated "what the system does" figure: a complaint flows in, the model
 *  ranks every candidate in range, one terminal comes out as the best bet —
 *  with the live file's numbers on it. Pure SVG + CSS, no assets. */
export function HowItHelps({ bestAtm, bestScore, expected, candidates, caseId }: HowItHelpsProps) {
  const orbitDots = [0, 72, 144, 216, 288].map((deg) => {
    const rad = (deg * Math.PI) / 180;
    return { x: 170 + 34 * Math.cos(rad), y: 110 + 34 * Math.sin(rad) };
  });

  return (
    <svg viewBox="0 0 340 232" className="h-auto w-full max-w-md" role="img" aria-label="How PurvaDrishti helps: complaint in, ranked terminals out">
      <defs>
        <marker id="flow-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill={ACCENT} opacity="0.8" />
        </marker>
      </defs>

      {/* ---- 1 · complaint in ---- */}
      <rect x="8" y="76" width="92" height="68" rx="10" fill={CARD} stroke={HAIRLINE} />
      <text x="54" y="96" textAnchor="middle" fontSize="8.5" letterSpacing="1.5" fill={ACCENT_BRIGHT} fontFamily={MONO}>
        COMPLAINT IN
      </text>
      <text x="54" y="116" textAnchor="middle" fontSize="12.5" fontWeight="600" fill={INK}>
        {caseId ? `C-${caseId}` : "C-…"}
      </text>
      <text x="54" y="131" textAnchor="middle" fontSize="9.5" fill={FAINT} fontFamily={MONO}>
        victim trail attached
      </text>

      {/* ---- 2 · model ranks ---- */}
      <circle cx="170" cy="110" r="34" fill="none" stroke={HAIRLINE} strokeDasharray="4 5" />
      <g className="orbit-ring">
        {orbitDots.map((d, i) => (
          <circle key={i} cx={d.x} cy={d.y} r="3.5" fill={i === 0 ? CRITICAL : "#3a3a46"} stroke={ACCENT} strokeWidth="1" />
        ))}
      </g>
      <circle cx="170" cy="110" r="13" fill={ACCENT_STRONG} className="core-pulse" />
      <circle cx="170" cy="110" r="5" fill={ACCENT_BRIGHT} />
      <text x="170" y="166" textAnchor="middle" fontSize="8.5" letterSpacing="1.5" fill={ACCENT_BRIGHT} fontFamily={MONO}>
        XGB RANKING
      </text>
      <text x="170" y="180" textAnchor="middle" fontSize="9.5" fill={FAINT} fontFamily={MONO}>
        {candidates ? `${candidates} terminals` : "sweeping radius…"}
      </text>

      {/* ---- 3 · best bet out ---- */}
      <circle cx="272" cy="110" r="11" fill="none" stroke={ACCENT} strokeWidth="1.5" className="pin-pulse" />
      <circle cx="272" cy="110" r="11" fill="none" stroke={ACCENT} strokeWidth="1.5" className="pin-pulse" style={{ animationDelay: "1.1s" }} />
      <circle cx="272" cy="110" r="11" fill={ACCENT} />
      <circle cx="272" cy="110" r="4" fill="#0c0c0f" />
      <text x="272" y="72" textAnchor="middle" fontSize="8.5" letterSpacing="1.5" fill={ACCENT_BRIGHT} fontFamily={MONO}>
        BEST BET
      </text>
      <text x="272" y="150" textAnchor="middle" fontSize="12" fontWeight="600" fill={INK} fontFamily={MONO}>
        {bestAtm ?? "scanning…"}
      </text>
      <text x="272" y="164" textAnchor="middle" fontSize="9.5" fill={FAINT} fontFamily={MONO}>
        {bestScore != null ? `${(bestScore * 100).toFixed(1)}%` : "—"}
        {expected ? ` · ${expected}` : ""}
      </text>

      {/* ---- flowing edges ---- */}
      <path d="M102,110 L132,110" fill="none" stroke={ACCENT} strokeWidth="1.5" className="flow-edge" markerEnd="url(#flow-arrow)" />
      <path d="M208,110 L238,110" fill="none" stroke={ACCENT} strokeWidth="1.5" className="flow-edge" markerEnd="url(#flow-arrow)" />

      {/* ---- step captions ---- */}
      <text x="54" y="214" textAnchor="middle" fontSize="9" letterSpacing="1" fill={FAINT} fontFamily={MONO}>1 · FILED</text>
      <text x="170" y="214" textAnchor="middle" fontSize="9" letterSpacing="1" fill={FAINT} fontFamily={MONO}>2 · RANKED</text>
      <text x="272" y="214" textAnchor="middle" fontSize="9" letterSpacing="1" fill={FAINT} fontFamily={MONO}>3 · ACT</text>
    </svg>
  );
}
