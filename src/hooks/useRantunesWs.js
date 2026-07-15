/**
 * useRantunesWs — React hook for the RanTunes WebSocket connection
 * 
 * Connects to ws://<host>:8082 and provides:
 *  - `state`       : live playback + queue state (mirrors server)
 *  - `sendCommand` : low-level JSON command sender
 *  - Convenience: play(), pause(), resume(), stop(), next(), prev(),
 *                 setVolume(), loadQueue(), seek(), setShuffle(), setRepeat()
 * 
 * Auto-reconnects with exponential backoff (1s → 2s → 4s … max 30s).
 * On first connect, server immediately sends a STATE_UPDATE with full state.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

// ─────────────────────────────────────────────
//  CONFIG
// ─────────────────────────────────────────────

const WS_PORT = 8082;

// In dev: use same host as the page. On iPad: will resolve to M4 IP.
const getWsUrl = () => {
    const host = window.location.hostname;
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    return `${protocol}://${host}:${WS_PORT}`;
};

const DEFAULT_STATE = {
    isPlaying: false,
    isPaused: false,
    currentSong: null,
    position: 0,
    duration: 0,
    queue: [],
    currentIndex: 0,
    queueLength: 0,
    shuffled: false,
    repeat: 'none',       // 'none' | 'one' | 'all'
    volume: 75,
};

const MAX_RECONNECT_DELAY_MS = 30_000;
const BASE_RECONNECT_DELAY_MS = 1_000;

// ─────────────────────────────────────────────
//  HOOK
// ─────────────────────────────────────────────

export function useRantunesWs() {
    const [state, setState] = useState(DEFAULT_STATE);
    const [isConnected, setIsConnected] = useState(false);
    const [connectionError, setConnectionError] = useState(null);

    const wsRef = useRef(null);
    const reconnectDelayRef = useRef(BASE_RECONNECT_DELAY_MS);
    const reconnectTimerRef = useRef(null);
    const mountedRef = useRef(true); // Prevent setState after unmount

    // ── Connection Management ──

    const connect = useCallback(() => {
        if (!mountedRef.current) return;

        const url = getWsUrl();
        console.log(`🔌 [useRantunesWs] Connecting to ${url}...`);

        let ws;
        try {
            ws = new WebSocket(url);
            wsRef.current = ws;
        } catch (err) {
            console.error('❌ [useRantunesWs] Failed to create WebSocket:', err);
            setConnectionError(err.message || 'WebSocket creation failed');
            setIsConnected(false);
            
            // Reconnect backup loop
            const delay = reconnectDelayRef.current;
            reconnectTimerRef.current = setTimeout(() => {
                if (mountedRef.current) connect();
            }, delay);
            reconnectDelayRef.current = Math.min(delay * 2, MAX_RECONNECT_DELAY_MS);
            return;
        }

        ws.onopen = () => {
            if (!mountedRef.current) return;
            console.log('✅ [useRantunesWs] Connected');
            setIsConnected(true);
            setConnectionError(null);
            reconnectDelayRef.current = BASE_RECONNECT_DELAY_MS; // Reset backoff
        };

        ws.onmessage = (event) => {
            if (!mountedRef.current) return;
            try {
                const msg = JSON.parse(event.data);
                handleServerEvent(msg);
            } catch (err) {
                console.warn('[useRantunesWs] Bad JSON from server:', err.message);
            }
        };

        ws.onerror = (err) => {
            console.warn('[useRantunesWs] WebSocket error');
        };

        ws.onclose = (event) => {
            if (!mountedRef.current) return;
            setIsConnected(false);
            wsRef.current = null;

            if (!event.wasClean) {
                setConnectionError('Disconnected — retrying...');
            }

            // Exponential backoff reconnect
            const delay = reconnectDelayRef.current;
            console.log(`🔄 [useRantunesWs] Reconnecting in ${delay / 1000}s...`);
            reconnectTimerRef.current = setTimeout(() => {
                if (mountedRef.current) connect();
            }, delay);

            // Double delay for next attempt, cap at max
            reconnectDelayRef.current = Math.min(delay * 2, MAX_RECONNECT_DELAY_MS);
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Server Event Handler ──

    const handleServerEvent = (msg) => {
        switch (msg.event) {
            case 'STATE_UPDATE':
                setState(prev => ({ ...prev, ...msg.state }));
                break;

            case 'TRACK_ENDED':
                // State will be updated by the subsequent STATE_UPDATE
                console.log('🎵 [useRantunesWs] Track ended');
                break;

            case 'LIBRARY_UPDATED':
                console.log('📚 [useRantunesWs] Library updated:', msg.stats);
                // Could dispatch a custom event for other components to react
                window.dispatchEvent(new CustomEvent('rantunes:libraryUpdated', { detail: msg.stats }));
                break;

            case 'DRIVE_EJECTED':
                console.log('💿 [useRantunesWs] Drive ejected');
                window.dispatchEvent(new CustomEvent('rantunes:driveEjected'));
                break;

            case 'ERROR':
                console.error('[useRantunesWs] Server error:', msg.message);
                break;

            default:
                console.warn('[useRantunesWs] Unknown event:', msg.event);
        }
    };

    // ── Lifecycle ──

    useEffect(() => {
        mountedRef.current = true;
        connect();

        return () => {
            mountedRef.current = false;
            clearTimeout(reconnectTimerRef.current);
            wsRef.current?.close(1000, 'Component unmounting');
        };
    }, [connect]);

    // ─────────────────────────────────────────────
    //  COMMAND API
    // ─────────────────────────────────────────────

    /**
     * Low-level command sender.
     * @param {string} cmd
     * @param {object} payload
     */
    const sendCommand = useCallback((cmd, payload = {}) => {
        const ws = wsRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            console.warn(`[useRantunesWs] Cannot send "${cmd}" — not connected`);
            return;
        }
        ws.send(JSON.stringify({ cmd, payload }));
    }, []);

    // ── Convenience Methods ──

    /**
     * Play a specific song object immediately.
     * @param {{ id, file_path, duration_seconds, title, artist, album }} song
     */
    const play = useCallback((song) => {
        if (!song?.file_path) {
            console.warn('[useRantunesWs] play() called with no file_path');
            return;
        }
        sendCommand('PLAY', {
            songId: song.id,
            filePath: song.file_path,
            duration: song.duration_seconds || 0,
        });
        // Optimistic UI update
        setState(prev => ({ ...prev, currentSong: song, isPlaying: true, isPaused: false }));
    }, [sendCommand]);

    const pause = useCallback(() => {
        sendCommand('PAUSE');
        setState(prev => ({ ...prev, isPlaying: false, isPaused: true }));
    }, [sendCommand]);

    const resume = useCallback(() => {
        sendCommand('RESUME');
        setState(prev => ({ ...prev, isPlaying: true, isPaused: false }));
    }, [sendCommand]);

    const stop = useCallback(() => {
        sendCommand('STOP');
        setState(prev => ({ ...prev, isPlaying: false, isPaused: false }));
    }, [sendCommand]);

    const next = useCallback(() => {
        sendCommand('NEXT');
    }, [sendCommand]);

    const prev = useCallback(() => {
        sendCommand('PREV');
    }, [sendCommand]);

    /**
     * Set system output volume.
     * @param {number} level   0-100
     */
    const setVolume = useCallback((level) => {
        const clamped = Math.max(0, Math.min(100, Math.round(level)));
        sendCommand('VOLUME', { level: clamped });
        setState(prev => ({ ...prev, volume: clamped }));
    }, [sendCommand]);

    /**
     * Seek to position in seconds.
     * @param {number} position
     */
    const seek = useCallback((position) => {
        sendCommand('SEEK', { position });
    }, [sendCommand]);

    /**
     * Load a list of songs as the new queue and start playing from startIndex.
     * @param {Array}  songs
     * @param {number} startIndex
     */
    const loadQueue = useCallback((songs, startIndex = 0) => {
        sendCommand('LOAD_QUEUE', { songs, startIndex });
    }, [sendCommand]);

    /**
     * Update the queue order on the server without interrupting playback.
     */
    const updateQueue = useCallback((songs, currentIndex = 0) => {
        sendCommand('UPDATE_QUEUE', { songs, currentIndex });
    }, [sendCommand]);

    /**
     * Toggle or set shuffle mode.
     * @param {boolean} enabled
     */
    const setShuffle = useCallback((enabled) => {
        sendCommand('SHUFFLE', { enabled });
    }, [sendCommand]);

    /**
     * Set repeat mode.
     * @param {'none'|'one'|'all'} mode
     */
    const setRepeat = useCallback((mode) => {
        sendCommand('REPEAT', { mode });
    }, [sendCommand]);

    /** Request a full state refresh from the server. */
    const getState = useCallback(() => {
        sendCommand('GET_STATE');
    }, [sendCommand]);

    // ─────────────────────────────────────────────
    //  EXPOSE
    // ─────────────────────────────────────────────

    return {
        // State
        state,
        isConnected,
        connectionError,

        // Low-level
        sendCommand,

        // Controls
        play,
        pause,
        resume,
        stop,
        next,
        prev,
        seek,
        setVolume,
        loadQueue,
        updateQueue,
        setShuffle,
        setRepeat,
        getState,
    };
}

export default useRantunesWs;
