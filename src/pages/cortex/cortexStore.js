/**
 * cortexStore.js — Zustand store for embedded Cortex AI.
 *
 * Uses the SAME localStorage keys as the standalone knowledge-hub-pwa,
 * so both share identity if they ever run alongside each other.
 *
 * Single source of truth for:
 *   • Tenant identity  (persisted to / hydrated from localStorage)
 *   • Active record selection
 *   • Mobile context-drawer open/close
 */

import { create } from "zustand";

// ── localStorage keys (mirrored from knowledge-hub-pwa) ───────────────

const LS = {
  TENANT_ID: "cortex_tenant_id",
  BIZ_TYPE:  "cortex_business_type",
  BIZ_NAME:  "cortex_business_name",
  TONE:      "cortex_tone",
};

function readTenantFromStorage() {
  try {
    const id   = localStorage.getItem(LS.TENANT_ID);
    const type = localStorage.getItem(LS.BIZ_TYPE);
    const name = localStorage.getItem(LS.BIZ_NAME);
    const tone = localStorage.getItem(LS.TONE) ?? "professional";
    if (!id || !type || !name) return null;
    return { id, businessType: type, businessName: name, tone };
  } catch {
    return null;
  }
}

function writeTenantToStorage(cfg) {
  localStorage.setItem(LS.TENANT_ID, cfg.id);
  localStorage.setItem(LS.BIZ_TYPE,  cfg.businessType);
  localStorage.setItem(LS.BIZ_NAME,  cfg.businessName);
  localStorage.setItem(LS.TONE,      cfg.tone);
}

function clearTenantFromStorage() {
  Object.values(LS).forEach((k) => localStorage.removeItem(k));
}

// ── Store ──────────────────────────────────────────────────────────────

export const useCortexStore = create((set) => ({
  // ── Tenant — hydrated synchronously from localStorage ────────────
  tenant: readTenantFromStorage(),

  setTenant: (cfg) => {
    writeTenantToStorage(cfg);
    set({ tenant: cfg });
  },

  resetTenant: () => {
    clearTenantFromStorage();
    set({ tenant: null, selectedRecordId: null, isContextDrawerOpen: false });
  },

  // ── Active record ─────────────────────────────────────────────────
  selectedRecordId: null,

  setSelectedRecordId: (id) =>
    set({ selectedRecordId: id, isContextDrawerOpen: false }),

  // ── Mobile context drawer ─────────────────────────────────────────
  isContextDrawerOpen: false,
  openContextDrawer:   () => set({ isContextDrawerOpen: true  }),
  closeContextDrawer:  () => set({ isContextDrawerOpen: false }),
  toggleContextDrawer: () =>
    set((s) => ({ isContextDrawerOpen: !s.isContextDrawerOpen })),
}));
