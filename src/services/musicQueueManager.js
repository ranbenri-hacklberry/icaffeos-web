import { playback_queue } from '@/db/database';
import { calculateNewPosition } from '@/utils/fractionalIndexing';

/**
 * Music Queue Manager
 * Persistent queue management with fractional indexing.
 */
export const MusicQueueManager = {
    /**
     * Get the full queue ordered by position.
     */
    async getQueue() {
        const items = await playback_queue.orderBy('position').toArray();
        return items.map(item => ({
            ...item,
            queue_id: item.id,
            id: item.track_id
        }));
    },

    /**
     * Set a new queue (bulk replace).
     */
    async setQueue(songs) {
        await playback_queue.clear();
        const now = new Date().toISOString();
        const entries = songs.map((song, index) => ({
            ...song,
            track_id: song.id,
            position: index + 1,
            is_current: index === 0, // Mark first as current by default
            added_at: now,
            cover_url: song.cover_url || song.album?.cover_url
        }));
        // Remove `id` so Dexie can auto-increment it without erroring or we just let Dexie overwrite it.
        entries.forEach(e => delete e.id);
        await playback_queue.bulkAdd(entries);
    },

    /**
     * Append a song to the end.
     */
    async append(song) {
        const lastItem = await playback_queue.orderBy('position').last();
        const newPos = calculateNewPosition(lastItem ? lastItem.position : null, null);

        const entry = {
            ...song,
            track_id: song.id,
            position: newPos,
            is_current: false,
            added_at: new Date().toISOString(),
            cover_url: song.cover_url || song.album?.cover_url
        };
        delete entry.id;
        
        await playback_queue.add(entry);
    },

    /**
     * Update the 'is_current' flag.
     */
    async setCurrent(songId) {
        await playback_queue.where('is_current').equals(1).modify({ is_current: 0 });
        await playback_queue.where('track_id').equals(songId).modify({ is_current: 1 });
    },

    /**
     * Reorder an item.
     * @param {string} songId - ID of track being moved.
     * @param {number|null} prevPos - Position of the new neighbor before.
     * @param {number|null} nextPos - Position of the new neighbor after.
     */
    async moveTrack(songId, prevPos, nextPos) {
        const newPos = calculateNewPosition(prevPos, nextPos);
        await playback_queue.where('track_id').equals(songId).modify({ position: newPos });
        return newPos;
    },

    /**
     * Remove a track.
     */
    async removeTrack(songId) {
        await playback_queue.where('track_id').equals(songId).delete();
    },

    /**
     * Clear queue.
     */
    async clear() {
        await playback_queue.clear();
    }
};
