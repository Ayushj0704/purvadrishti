import type { CircleLayerSpecification } from "maplibre-gl";

// Candidate ATM points. A soft halo rather than a generic map pin keeps the
// markers reading as instrument overlays on the risk layer.

export const candidateAtmLayer: Omit<CircleLayerSpecification, "source"> = {
  id: "candidate-atm-layer",
  type: "circle",
  paint: {
    "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 3, 10, 7],
    "circle-color": [
      "match",
      ["get", "risk_level"],
      "CRITICAL",
      "#ff4c41",
      "HIGH",
      "#ff4c41",
      "MEDIUM",
      "#f59e0b",
      "LOW",
      "#10b981",
      "#3d3d48",
    ],
    "circle-opacity": 0.28,
    "circle-stroke-color": [
      "match",
      ["get", "risk_level"],
      "CRITICAL",
      "#ff4c41",
      "HIGH",
      "#ff4c41",
      "MEDIUM",
      "#f59e0b",
      "LOW",
      "#10b981",
      "#3d3d48",
    ],
    "circle-stroke-width": 1.5,
    "circle-stroke-opacity": 1,
  },
};

// Bursting terminals (observed withdrawal heat): solid orange discs that read
// apart from the risk-tinted candidate halos.
export const burstAtmLayer: Omit<CircleLayerSpecification, "source"> = {
  id: "burst-atm-layer",
  type: "circle",
  filter: ["==", ["get", "heat_level"], "HIGH"],
  paint: {
    "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 5, 10, 10],
    "circle-color": "#f59e0b",
    "circle-opacity": 0.85,
    "circle-stroke-color": "#0c0c0f",
    "circle-stroke-width": 1.5,
    "circle-stroke-opacity": 1,
  },
};

// Best-bet ring: accent outline marking the lead hypothesis.
export const bestBetRingLayer: Omit<CircleLayerSpecification, "source"> = {
  id: "best-bet-ring-layer",
  type: "circle",
  filter: ["==", ["get", "best_bet"], true],
  paint: {
    "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 8, 10, 13],
    "circle-color": "rgba(0,0,0,0)",
    "circle-opacity": 0,
    "circle-stroke-color": "#6f78ff",
    "circle-stroke-width": 2.5,
    "circle-stroke-opacity": 1,
  },
};

// Best-bet halo: radius + opacity driven per-frame by RiskMap's animator to
// read as a radar pulse on the lead hypothesis.
export const bestBetHaloLayer: Omit<CircleLayerSpecification, "source"> = {
  id: "best-bet-halo-layer",
  type: "circle",
  filter: ["==", ["get", "best_bet"], true],
  paint: {
    "circle-radius": 10,
    "circle-color": "#6f78ff",
    "circle-opacity": 0.35,
    "circle-stroke-width": 0,
  },
};

