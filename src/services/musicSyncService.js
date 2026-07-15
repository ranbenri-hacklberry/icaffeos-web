/**
 * Music Sync Service
 *
 * Bridges the backend scanner API with the local Dexie `local_assets` table.
 * Calls POST /api/music/scan → receives asset metadata JSON → bulkPut into Dexie.
 *
 * Usage:
 *   import { scanAndSync, getLocalAssets, searchLocalAssets } from '@/services/musicSyncService';
 *
 *   // Trigger a full scan + sync
 *   const result = await scanAndSync();
 *   // result = { synced: 347, errors: [] }
 *
 *   // Query the local cache
 *   const allTracks = await getLocalAssets();
 *   const jazzy = await searchLocalAssets('jazz');
 */

import { local_assets } from '../db/database';
import { getBackendApiUrl } from '@/utils/apiUtils';

const API_URL = getBackendApiUrl();

/**
 * Trigger a backend scan and sync results into Dexie.
 *
 * @param {Object} [options]
 * @param {string} [options.path] – override scan root (for testing)
 * @param {Function} [options.onProgress] – called with { phase, count }
 * @returns {Promise<{ synced: number, total: number, errors: string[] }>}
 */
export async function scanAndSync(options = {}) {
    const errors = [];

    try {
        // 1. Call the backend scanner
        options.onProgress?.({ phase: 'scanning', count: 0 });

        const body = options.path ? { path: options.path } : {};
        const response = await fetch(`${API_URL}/music/scan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.message || `Scan failed (${response.status})`);
        }

        const data = await response.json();

        if (!data.success || !Array.isArray(data.assets)) {
            throw new Error('Invalid scan response');
        }

        console.log(`🎵 musicSyncService: received ${data.count} assets from scanner`);
        options.onProgress?.({ phase: 'syncing', count: data.count });

        // 2. Bulk-upsert into Dexie (in batches to avoid memory spikes)
        const BATCH_SIZE = 500;
        let synced = 0;

        for (let i = 0; i < data.assets.length; i += BATCH_SIZE) {
            const batch = data.assets.slice(i, i + BATCH_SIZE);
            try {
                await local_assets.bulkPut(batch);
                synced += batch.length;
                options.onProgress?.({ phase: 'syncing', count: synced });
            } catch (err) {
                console.error('❌ Dexie bulkPut batch error:', err);
                errors.push(`Batch ${i}-${i + batch.length}: ${err.message}`);
            }
        }

        // 3. Clean up stale records (files that were deleted from disk)
        const freshIds = new Set(data.assets.map(a => a.id));
        try {
            const existing = await local_assets.toArray();
            const staleIds = existing
                .filter(a => !freshIds.has(a.id))
                .map(a => a.id);

            if (staleIds.length > 0) {
                await local_assets.bulkDelete(staleIds);
                console.log(`🗑️ musicSyncService: removed ${staleIds.length} stale records`);
            }
        } catch (err) {
            console.warn('⚠️ Stale cleanup failed (non-fatal):', err.message);
        }

        console.log(`✅ musicSyncService: synced ${synced}/${data.count} assets to Dexie`);

        return { synced, total: data.count, errors };

    } catch (err) {
        console.error('❌ musicSyncService: scanAndSync failed:', err);
        errors.push(err.message);
        return { synced: 0, total: 0, errors };
    }
}

/**
 * Get all local assets from Dexie.
 * @returns {Promise<Array>}
 */
export async function getLocalAssets() {
    return local_assets.toArray();
}

/**
 * Search local assets by artist, title, or album.
 * @param {string} query
 * @returns {Promise<Array>}
 */
export async function searchLocalAssets(query) {
    const q = query.toLowerCase();
    const all = await local_assets.toArray();
    return all.filter(a =>
        (a.title || '').toLowerCase().includes(q) ||
        (a.artist || '').toLowerCase().includes(q) ||
        (a.album || '').toLowerCase().includes(q)
    );
}

/**
 * Get local assets grouped by artist.
 * @returns {Promise<Object>} { 'Artist Name': [asset, asset, ...], ... }
 */
export async function getLocalAssetsByArtist() {
    const all = await local_assets.orderBy('artist').toArray();
    const grouped = {};
    for (const asset of all) {
        const key = asset.artist || 'Unknown Artist';
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(asset);
    }
    return grouped;
}

/**
 * Get local assets grouped by album.
 * @returns {Promise<Object>}
 */
export async function getLocalAssetsByAlbum() {
    const all = await local_assets.orderBy('album').toArray();
    const grouped = {};
    for (const asset of all) {
        const key = asset.album || 'Unknown Album';
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(asset);
    }
    return grouped;
}

/**
 * Get count of local assets.
 * @returns {Promise<number>}
 */
export async function getLocalAssetCount() {
    return local_assets.count();
}
