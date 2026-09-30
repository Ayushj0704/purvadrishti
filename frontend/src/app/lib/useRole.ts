import { useState } from "react";
import { authApi } from "../api/auth";

/** Role hierarchy mirrors backend RBAC (app/api/deps.py): higher roles
 *  inherit every permission below them. */
export const ROLE_RANK: Record<string, number> = {
  BANK_ANALYST: 1,
  LEA_OFFICER: 2,
  I4C_ANALYST: 3,
  ADMIN: 4,
};

export const ROLE_OPTIONS = [
  { role: "LEA_OFFICER", username: "lea", label: "LEA Officer", blurb: "Investigate · predict · acknowledge" },
  { role: "I4C_ANALYST", username: "i4c", label: "I4C Analyst", blurb: "Investigate · predict · acknowledge" },
  { role: "ADMIN", username: "admin", label: "Administrator", blurb: "Full access" },
  { role: "BANK_ANALYST", username: "bank", label: "Bank Analyst", blurb: "Read-only intelligence" },
];

/** Anything that writes (predict, ingest, acknowledge, notify) needs LEA+. */
export function canWrite(role: string | null): boolean {
  return (ROLE_RANK[role ?? ""] ?? 0) >= ROLE_RANK.LEA_OFFICER;
}

export function useRole(): string | null {
  const [role] = useState(() => authApi.getRole());
  return role;
}
