

export const candidateAtmLayer: any = {
  id: 'candidate-atm-layer',
  type: 'circle',
  source: 'candidate-atms',
  paint: {
    'circle-radius': 6,
    'circle-color': [
      'match',
      ['get', 'risk_level'],
      'HIGH', '#ef4444',
      'MEDIUM', '#f97316',
      'LOW', '#eab308',
      '#94a3b8' // Default color if no risk level
    ],
    'circle-stroke-width': 2,
    'circle-stroke-color': '#ffffff',
  }
};
