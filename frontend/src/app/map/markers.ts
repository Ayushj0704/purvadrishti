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

