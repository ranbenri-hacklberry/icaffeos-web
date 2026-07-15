/**
 * Audio Strategy Pattern Implementation for Ambiance Engine.
 * Local-only playback via HTML5 Audio & IndexedDB.
 * 
 * NOTE: Spotify integration has been removed. RanTunes uses local files only.
 */

import { local_assets } from '../db/database';

/*
 * Base Provider Interface (Abstract)
 * 
 * - type: 'local'
 * - isReady(): boolean
 * - load(track: object): Promise<void>
 * - play(): Promise<void>
 * - pause(): Promise<void>
 * - seek(position_ms: number): Promise<void>
 * - setVolume(volume: 0-1): Promise<void>
 * - getCurrentState(): Promise<{ position: number, duration: number, is_playing: boolean }>
 */

class BaseProvider {
    constructor() {
        this.listeners = new Set();
    }

    on(event, callback) {
        this.listeners.add({ event, callback });
        return () => this.listeners.delete({ event, callback });
    }

    emit(event, data) {
        for (const listener of this.listeners) {
            if (listener.event === event) listener.callback(data);
        }
    }
}

/**
 * 📂 Local Provider using HTML5 Audio & IndexedDB
 */
export class LocalProvider extends BaseProvider {
    constructor() {
        super();
        this.type = 'local';
        this.audio = new Audio();
        this.currentTxId = null; // Transaction ID for consistency

        this.audio.addEventListener('timeupdate', () => {
            this.emit('state_changed', {
                is_playing: !this.audio.paused,
                position: this.audio.currentTime * 1000,
                duration: (this.audio.duration || 0) * 1000
            });
        });

        this.audio.addEventListener('ended', () => {
            this.emit('track_ended');
        });

        this.audio.addEventListener('error', (e) => {
            console.error('Local Audio Error:', e);
            this.emit('error', e);
        });
    }

    async load(localAssetId) {
        // 1. Fetch file path from Dexie
        const asset = await local_assets.get(localAssetId);
        if (!asset) throw new Error(`Asset ${localAssetId} not found in local DB`);

        // 2. Stream via local backend proxy
        const streamUrl = `/music/stream?path=${encodeURIComponent(asset.file_path)}`;
        this.audio.src = streamUrl;
        this.audio.load();
    }

    async play() {
        return this.audio.play();
    }

    async pause() {
        this.audio.pause();
    }

    async seek(position_ms) {
        this.audio.currentTime = position_ms / 1000;
    }

    async setVolume(vol) {
        this.audio.volume = vol;
    }

    async getCurrentState() {
        return {
            position: this.audio.currentTime * 1000,
            duration: (this.audio.duration || 0) * 1000,
            is_playing: !this.audio.paused
        };
    }
}

/**
 * 🎛️ Audio Controller - The central brain.
 * Manages active provider, queue, and state transitions.
 * Local-only mode (Spotify removed).
 */
export class AudioController {
    constructor() {
        this.providers = {
            local: new LocalProvider()
        };

        this.activeProvider = this.providers.local;
        this.queue = [];
        this.currentIndex = -1;
        this.state = { isPlaying: false, currentTrack: null };
        this.listeners = new Set();

        // Bind events
        Object.values(this.providers).forEach(p => {
            p.on('state_changed', (s) => this.broadcastState(s));
            p.on('track_ended', () => this.next());
            p.on('error', (e) => console.error('Audio Controller Error:', e));
        });
    }

    onStateChange(cb) {
        this.listeners.add(cb);
        return () => this.listeners.delete(cb);
    }

    broadcastState(providerState) {
        // Merge with controller state
        const fullState = {
            ...this.state,
            ...providerState
        };
        for (const cb of this.listeners) cb(fullState);
    }

    /**
     * Play a local track
     */
    async playTrack(track) {
        // Always use local provider
        this.activeProvider = this.providers.local;

        try {
            await this.activeProvider.load(track.id);
            await this.activeProvider.play();

            this.state.currentTrack = track;
            this.state.isPlaying = true;
            this.broadcastState({ is_playing: true });
        } catch (e) {
            console.error('Play failed:', e);
        }
    }

    async togglePlay() {
        if (!this.activeProvider) return;
        const s = await this.activeProvider.getCurrentState();
        if (s?.is_playing) {
            await this.activeProvider.pause();
        } else {
            await this.activeProvider.play();
        }
    }

    async next() {
        // Basic queue logic
        if (this.queue.length > 0) {
            console.log('Next track...');
        }
    }
}
