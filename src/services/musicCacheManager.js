import { rantunes_cache_stats as music_cache_stats } from '@/db/database'; // ✅ Migrated: music_cache_stats → rantunes_cache_stats
import { getBackendApiUrl } from '@/utils/apiUtils';

const MUSIC_API_URL = getBackendApiUrl();
const MAX_CACHE_SIZE = 10 * 1024 * 1024 * 1024; // 10GB
const PREFETCH_COUNT = 500;

/**
 * Tiered Storage Manager for Music
 * Implements LRU logic on the frontend while coordinating file operations with the backend.
 */
export const MusicCacheManager = {
    /**
     * Records a play event. This updates the LRU timestamp and play count.
     * Should be called whenever a song starts playing.
     */
    async trackPlay(song) {
        if (!song?.id) return;

        try {
            const stats = await music_cache_stats.get(song.id);
            const now = new Date().toISOString();

            if (stats) {
                await music_cache_stats.update(song.id, {
                    last_played_at: now,
                    play_count: (stats.play_count || 0) + 1
                });
            } else {
                await music_cache_stats.add({
                    song_id: song.id,
                    last_played_at: now,
                    play_count: 1,
                    is_cached: false,
                    file_size: 0 // Will be updated when cached
                });
            }
        } catch (error) {
            console.error('❌ Error updating playback stats:', error);
        }
    },

    /**
     * Checks if a song is currently cached internally.
     */
    async isCached(songId) {
        if (!songId) return false;
        const stats = await music_cache_stats.get(songId);
        return !!stats?.is_cached;
    },

    /**
     * Gets the storage stats for a song.
     */
    async getStats(songId) {
        return await music_cache_stats.get(songId);
    },

    /**
     * Background worker that prefetches upcoming tracks in the queue.
     * Copies tracks from external mount to internal buffer within the 10GB limit.
     */
    async prefetch(queue, currentIndex = 0) {
        // Include current song AND next tracks so the current song is cached immediately
        // (critical for external drive disconnect survival)
        const upcoming = queue.slice(currentIndex, currentIndex + PREFETCH_COUNT);
        if (upcoming.length === 0) return;

        console.log(`📡 CacheManager: Checking prefetch for ${upcoming.length} tracks...`);

        for (const song of upcoming) {
            try {
                const stats = await this.getStats(song.id);
                if (stats?.is_cached) continue;

                // Estimate size if unknown (default to 10MB for safety calculation)
                const estimatedSize = stats?.file_size || 10 * 1024 * 1024;

                // Ensure space
                await this.ensureSpace(estimatedSize);

                // Command backend to cache
                const response = await fetch(`${MUSIC_API_URL}/music/cache`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        songId: song.id,
                        filePath: song.file_path,
                        coverPath: song.album?.cover_url || song.cover_url
                    })
                });

                const result = await response.json();
                if (result.success) {
                    // Update Dexie stats
                    await music_cache_stats.put({
                        song_id: song.id,
                        last_played_at: stats?.last_played_at || new Date().toISOString(),
                        play_count: stats?.play_count || 0,
                        is_cached: true,
                        file_size: result.size
                    });
                } else if (result.error === 'Cache limit reached') {
                    // Stop prefetching if we hit a hard limit we couldn't clear
                    console.warn('🛑 CacheManager: Hard limit reached, stopping prefetch.');
                    break;
                }
            } catch (error) {
                console.error(`❌ Failed to prefetch song ${song.id}:`, error);
            }
        }
    },

    /**
     * Calculates total bytes used by internal cache.
     */
    async getTotalUsage() {
        const cached = await music_cache_stats.where('is_cached').equals(1).toArray();
        // Since Dexie doesn't store bools as 1/0 consistently in some environments, 
        // we check both just in case, or use a filter.
        return cached.reduce((sum, s) => sum + (s.file_size || 0), 0);
    },

    /**
     * Cleanup Worker: Enforces the 10GB limit by deleting LRU files.
     */
    async ensureSpace(requiredBytes) {
        let currentUsage = await this.getTotalUsage();

        // If within limits, we are good
        if (currentUsage + requiredBytes <= MAX_CACHE_SIZE) return;

        console.log(`🧹 CacheManager: Cache nearly full (${(currentUsage / 1024 / 1024 / 1024).toFixed(2)}GB). Running cleanup...`);

        // Get all cached songs sorted by last_played_at (oldest first)
        const cachedSongs = await music_cache_stats
            .where('is_cached').equals(1)
            .sortBy('last_played_at');

        for (const song of cachedSongs) {
            try {
                const response = await fetch(`${MUSIC_API_URL}/music/cache/${song.song_id}`, {
                    method: 'DELETE'
                });

                const result = await response.json();
                if (result.success) {
                    // Update local DB
                    await music_cache_stats.update(song.song_id, {
                        is_cached: false
                    });

                    currentUsage -= (song.file_size || 0);
                    console.log(`🗑️ Evicted ${song.song_id} from cache.`);
                }

                if (currentUsage + requiredBytes <= MAX_CACHE_SIZE) {
                    console.log('✅ Sufficient space cleared.');
                    break;
                }
            } catch (error) {
                console.error(`❌ Failed to evict ${song.song_id}:`, error);
            }
        }
    }
};

export default MusicCacheManager;
