/**
 * Health and readiness.
 *
 * The backend serves both at its root, outside the `/api/v1` prefix, so these
 * calls are built on the unversioned root rather than the API base. That keeps
 * them same-origin in dev, where the Vite proxy forwards /health and /ready
 * alongside /api.
 */

import { API_ROOT_URL } from "./client";

/** `model` is the label the backend is actually running: "loaded" or a fallback. */
export interface Health {
  status: string;
  database: string;
  model: string;
}

async function getHealthAt(path: string): Promise<Health> {
  const response = await fetch(`${API_ROOT_URL}${path}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Health check failed (${response.status})`);
  }

  return (await response.json()) as Health;
}

export const healthApi = {
  getHealth: () => getHealthAt("/health"),
  getReady: () => getHealthAt("/ready"),
};

/** The model is running the trained artefact rather than the heuristic path. */
export function isModelLoaded(health: Health | null): boolean {
  return health?.model === "loaded";
}
