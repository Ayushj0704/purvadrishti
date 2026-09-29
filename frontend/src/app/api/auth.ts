/**
 * Session state for the console.
 *
 * The backend issues a JWT from POST /api/v1/auth/login along with the caller's
 * role, and enforces that role per request. The token is kept in
 * localStorage so a reload does not sign the operator out mid-investigation.
 *
 * The expiry check below is a convenience only — it exists so an operator is
 * told to sign in again *before* a request bounces, not instead of the backend
 * deciding. Nothing here is a security control; the server is authoritative.
 */

import { api, setUnauthorizedHandler } from "./client";

export type Role = "ADMIN" | "LEA_OFFICER" | "I4C_ANALYST" | "BANK_ANALYST";

/** Highest-first, mirroring the backend's own role ranking. */
const RANK: Record<Role, number> = {
  BANK_ANALYST: 1,
  LEA_OFFICER: 2,
  I4C_ANALYST: 3,
  ADMIN: 4,
};

export interface Session {
  token: string;
  role: Role;
  username: string;
  /** Epoch milliseconds, or null when the token carried no readable expiry. */
  expiresAt: number | null;
}

const STORAGE_KEY = "purva.session";

let session: Session | null = readStoredSession();

function readStoredSession(): Session | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Session;
    if (!parsed?.token || !parsed?.role) return null;
    return parsed;
  } catch {
    return null;
  }
}

function persist(next: Session | null): void {
  session = next;
  if (next) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

/**
 * Reads `exp` out of the token payload for display purposes. Not a
 * verification step — the signature is the backend's business, and nothing
 * here trusts the value for an access decision.
 */
function readExpiry(token: string): number | null {
  const segment = token.split(".")[1];
  if (!segment) return null;
  try {
    const payload = JSON.parse(atob(segment)) as { exp?: number };
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function getSession(): Session | null {
  return session;
}

export function getToken(): string | null {
  return session?.token ?? null;
}

export function getRole(): Role | null {
  return session?.role ?? null;
}

/** True when the token carries a readable expiry that has already passed. */
export function isExpired(): boolean {
  if (!session?.expiresAt) return false;
  return session.expiresAt <= Date.now();
}

export function hasRole(minimum: Role): boolean {
  if (!session) return false;
  return (RANK[session.role] ?? 0) >= RANK[minimum];
}

export function clearSession(): void {
  persist(null);
}

export interface LoginResult {
  token: string;
  role: Role;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export async function login({ username, password }: LoginCredentials): Promise<LoginResult> {
  const result = await api.post<{ access_token: string; role: Role }>(
    "/auth/login",
    { username, password },
    // A rejected login is a normal answer, not an expired session.
    { skipUnauthorizedHandler: true },
  );

  const next: Session = {
    token: result.access_token,
    role: result.role,
    username,
    expiresAt: readExpiry(result.access_token),
  };
  persist(next);
  return { token: next.token, role: next.role };
}

/**
 * Wires the client's 401 hook to a session teardown. Called once at module load
 * so any API call that loses authorisation lands on the login screen without
 * each page having to handle it.
 */
setUnauthorizedHandler(() => {
  clearSession();
});
