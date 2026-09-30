/** Shared chart tokens so plots and the DOM never drift apart. */

export const CHART = {
  font: '"Inter Tight", system-ui, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, monospace',
  grid: "#202028",
  axis: "#8b8b95",
  tick: "#55555f",
  muted: "#3a3a46",
} as const;

export const RISK_COLOR = {
  critical: "#ff4c41",
  high: "#ff4c41",
  medium: "#f59e0b",
  low: "#10b981",
  neutral: "#3d3d48",
  accent: "#6f78ff",
  positive: "#10b981",
  negative: "#ff4c41",
} as const;

export const TOOLTIP_STYLE = {
  background: "rgba(8,8,10,0.96)",
  border: "1px solid #202028",
  borderRadius: 10,
  fontSize: 11,
  fontFamily: CHART.mono,
} as const;
