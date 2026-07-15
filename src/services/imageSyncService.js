import { db, cached_images } from '@/db/database';

/**
 * Service to sync and cache menu item images locally in Dexie
 * This ensures images are available even when completely offline
 */
export const syncMenuImages = async (menuItems) => {
    // 🛑 OPTIMIZATION: Don't run this immediately on load.
    // Wait for the UI to settle (5 seconds delay)
    await new Promise(resolve => setTimeout(resolve, 5000));

    if (!menuItems || menuItems.length === 0) return;

    console.log(`🖼️ [ImageSync] Starting lazy sync for ${menuItems.length} items...`);

    let syncedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    for (const item of menuItems) {
        const url = item.image_url || item.image;
        if (!url) {
            skippedCount++;
            continue;
        }

        try {
            // Check if already cached
            const cached = await cached_images.get(url);
            if (cached && cached.blob) {
                skippedCount++;
                continue;
            }

            // Download image
            const response = await fetch(url, { mode: 'cors' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const blob = await response.blob();

            // Save to Dexie
            await cached_images.put({
                url: url,
                blob: blob,
                contentType: blob.type,
                cached_at: new Date().toISOString()
            });

            syncedCount++;
            if (syncedCount % 5 === 0) {
                console.log(`🖼️ [ImageSync] Progress: ${syncedCount} images cached...`);
            }
        } catch (err) {
            console.warn(`🖼️ [ImageSync] Failed to cache image for ${item.name}:`, err.message);
            failedCount++;
        }
    }

    console.log(`✅ [ImageSync] Finished: ${syncedCount} synced, ${skippedCount} skipped, ${failedCount} failed.`);
    return { syncedCount, skippedCount, failedCount };
};

/**
 * Helper to get a local URL for a cached image
 */
export const getCachedImageURL = async (url) => {
    if (!url) return null;

    try {
        const cached = await cached_images.get(url);
        if (cached && cached.blob) {
            return URL.createObjectURL(cached.blob);
        }
    } catch (err) {
        console.error('Error reading cached image:', err);
    }
    return null;
};
