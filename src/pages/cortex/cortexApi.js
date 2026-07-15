/**
 * cortexApi.js — Authenticated fetch wrappers for the Cortex Gateway.
 *
 * X-Cortex-Tenant-ID is automatically injected from Zustand store state,
 * read with .getState() (not a hook) so this is safe outside components.
 */

import { useCortexStore } from "./cortexStore";
import { getCortexApiUrl } from "@/utils/apiUtils";

export const CORTEX_API = getCortexApiUrl();

/** @returns {{ "X-Cortex-Tenant-ID": string } | {}} */
function tenantHeaders() {
  const id = useCortexStore.getState().tenant?.id;
  return id ? { "X-Cortex-Tenant-ID": id } : {};
}

/**
 * Authenticated fetch — automatically injects tenant header.
 * Throws on non-2xx responses.
 */
export async function cortexFetch(path, options = {}) {
  const callerHeaders =
    options.headers instanceof Headers
      ? Object.fromEntries(options.headers.entries())
      : (options.headers ?? {});

  const res = await fetch(`${CORTEX_API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...tenantHeaders(),
      ...callerHeaders,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 401) {
      console.warn("Cortex: Unauthorized (401). Resetting tenant session.");
      useCortexStore.getState().resetTenant();
    }
    throw new Error(`HTTP ${res.status}: ${body}`);
  }

  return res.json();
}

/**
 * Public fetch — NO tenant header.
 * Use only for: GET /health  and  POST /api/onboarding.
 */
export async function cortexFetchPublic(path, options = {}) {
  const res = await fetch(`${CORTEX_API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body}`);
  }

  return res.json();
}
