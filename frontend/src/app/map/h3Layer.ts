import type { FillLayerSpecification } from "maplibre-gl";

// H3 cell fill styling. Colour is driven by the `risk_level` feature property
// and matched to the product palette rather than a generic Tailwind ramp.

export const h3LayerStyle: Omit<FillLayerSpecification, "source"> = {
  id: "h3-risk-layer",
  type: "fill",
  paint: {
    "fill-color": [
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
    "fill-opacity": ["interpolate", ["linear"], ["zoom"], 3, 0.34, 8, 0.6],
    "fill-outline-color": "rgba(8, 8, 10, 0.9)",
  },
};

