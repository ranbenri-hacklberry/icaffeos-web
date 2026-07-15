/**
 * useBusiness – Business Configuration Hook
 *
 * Fetches business-level config directly from the `businesses` Supabase table,
 * including Google OAuth tokens and the `settings` JSONB column.
 *
 * Provides `updateBusinessSettings(newSettings)` for optimistic updates:
 *   1. Merges & writes to Dexie immediately (offline-safe UI)
 *   2. Syncs the delta to Supabase in the background
 *
 * ⚠️  PROTECT CORTEX: Do NOT touch `cases` or `user_wallet` tables here.
 *   Those are core Cortex multi-tenant features and must remain completely separate.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { db } from '@/db/database';

// Only pull what we actually need — avoids leaking extra secrets client-side
const BUSINESS_COLUMNS = [
    'id',
    'name',
    'logo_url',
    'address',
    'phone',
    'email',
    'currency',
    'timezone',
    // Google OAuth / API fields
    'google_access_token',
    'google_refresh_token',
    'google_token_expiry',
    'google_client_id',
    'google_client_secret',
    'google_calendar_id',
    'google_maps_api_key',
    // General JSONB settings bag
    'settings',
    // Feature flags
    'enabled_features',
    'visible_apps',
].join(', ');

export const useBusiness = (businessId) => {
    const [business, setBusiness] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    // ─── Fetch ────────────────────────────────────────────────────────────────
    const fetchBusiness = useCallback(async () => {
        if (!businessId) {
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // 1. Try Dexie first for instant load
            const cached = await db.businesses.get(businessId);
            if (cached) {
                setBusiness(cached);
                setLoading(false); // Unblock UI immediately
            }

            // 2. Always refresh from Supabase for latest secrets/settings
            const { data, error: sbError } = await supabase
                .from('businesses')
                .select(BUSINESS_COLUMNS)
                .eq('id', businessId)
                .single();

            if (sbError) throw sbError;

            setBusiness(data);

            // Update Dexie cache
            await db.businesses.put(data);
        } catch (err) {
            console.error('[useBusiness] Failed to fetch business config:', err.message);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [businessId]);

    useEffect(() => {
        fetchBusiness();
    }, [fetchBusiness]);

    // ─── Optimistic Settings Update ───────────────────────────────────────────
    /**
     * Merges `newSettings` into the existing `settings` JSONB, then:
     *   • Writes to Dexie immediately so the UI updates without a network round-trip
     *   • Syncs the full merged settings object to Supabase in the background
     *
     * @param {Record<string, any>} newSettings  Key/value pairs to merge into `settings`
     * @returns {{ success: boolean, error?: string }}
     */
    const updateBusinessSettings = useCallback(async (newSettings) => {
        if (!businessId) return { success: false, error: 'No businessId' };

        const mergedSettings = {
            ...(business?.settings || {}),
            ...newSettings,
        };

        // ── Step 1: Optimistic update (Dexie + state) ──────────────────────
        const optimisticBusiness = { ...business, settings: mergedSettings };
        setBusiness(optimisticBusiness);

        try {
            await db.businesses.put(optimisticBusiness);
        } catch (dexieErr) {
            console.warn('[useBusiness] Dexie optimistic write failed:', dexieErr.message);
            // Non-fatal – Supabase sync below is still the source of truth
        }

        // ── Step 2: Sync to Supabase ────────────────────────────────────────
        setIsSaving(true);
        try {
            const { data, error: sbError } = await supabase
                .from('businesses')
                .update({ settings: mergedSettings })
                .eq('id', businessId)
                .select(BUSINESS_COLUMNS)
                .single();

            if (sbError) throw sbError;

            // Reconcile with the server's final state
            setBusiness(data);
            await db.businesses.put(data);

            console.log('[useBusiness] Settings synced to Supabase ✅');
            return { success: true };
        } catch (err) {
            console.error('[useBusiness] Supabase settings sync failed:', err.message);
            setError(err.message);

            // Rollback optimistic state
            setBusiness(business);
            try {
                await db.businesses.put(business);
            } catch (_) { /* silent */ }

            return { success: false, error: err.message };
        } finally {
            setIsSaving(false);
        }
    }, [businessId, business]);

    // ─── Derived helpers ──────────────────────────────────────────────────────
    /**
     * Structured Google token bundle — ready to pass directly into Google API clients.
     * Returns null when no tokens are stored.
     */
    const googleTokens = business?.google_access_token
        ? {
            access_token:  business.google_access_token,
            refresh_token: business.google_refresh_token  ?? null,
            expiry_date:   business.google_token_expiry   ?? null,
            // Server-side OAuth refresh credentials
            client_id:     business.google_client_id      ?? null,
            client_secret: business.google_client_secret  ?? null,
            // Optional extras
            calendar_id:   business.google_calendar_id    ?? null,
            maps_api_key:  business.google_maps_api_key   ?? null,
        }
        : null;

    return {
        // State
        business,
        googleTokens,
        settings: business?.settings ?? {},
        loading,
        isSaving,
        error,

        // Actions
        updateBusinessSettings,
        refresh: fetchBusiness,
    };
};

export default useBusiness;
