

// Defines how the H3 cells are rendered on the map.
// Colors match the risk level: HIGH (red), MEDIUM (orange), LOW (yellow)
// The API provides the risk_level in the GeoJSON feature properties.

export const h3LayerStyle: any = {
  id: 'h3-risk-layer',
  type: 'fill',
  source: 'h3-cells',
  paint: {
    'fill-color': [
      'match',
      ['get', 'risk_level'],
      'HIGH', '#ef4444',   // Tailwind red-500
      'MEDIUM', '#f97316', // Tailwind orange-500
      'LOW', '#eab308',    // Tailwind yellow-500
      '#94a3b8'            // Fallback (slate-400)
    ],
    'fill-opacity': 0.4,
    'fill-outline-color': [
      'match',
      ['get', 'risk_level'],
      'HIGH', '#b91c1c',
      'MEDIUM', '#c2410c',
      'LOW', '#a16207',
      '#64748b'
    ]
  }
};
