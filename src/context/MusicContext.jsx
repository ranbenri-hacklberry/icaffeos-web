import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

const MusicContext = createContext(null);

// Get base URL for music files from backend - Use relative paths on localhost to leverage Vite proxy
import { getBackendApiUrl } from '../utils/apiUtils';
const MUSIC_API_URL = getBackendApiUrl();

import { MusicCacheManager } from '../services/musicCacheManager';
import { MusicQueueManager } from '../services/musicQueueManager';
import { useRantunesWs } from '../hooks/useRantunesWs';

export const MusicProvider = ({ children }) => {
    const { currentUser } = useAuth();
    const audio1Ref = useRef(new Audio());
    const audio2Ref = useRef(new Audio());

    // Set crossOrigin so Web Audio API doesn't mute cross-origin streams
    useEffect(() => {
        if (audio1Ref.current) audio1Ref.current.crossOrigin = "anonymous";
        if (audio2Ref.current) audio2Ref.current.crossOrigin = "anonymous";

        return () => {
            // Cleanup on unmount (critical for Vite HMR to prevent ghost audio echoes)
            if (audio1Ref.current) {
                audio1Ref.current.pause();
                audio1Ref.current.src = '';
            }
            if (audio2Ref.current) {
                audio2Ref.current.pause();
                audio2Ref.current.src = '';
            }
            if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                audioContextRef.current.close().catch(console.warn);
            }
            if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
        };
    }, []);

    const [activeAudio, setActiveAudio] = useState(1); // 1 or 2
    const activeAudioRef = useRef(1);
    const isPlayingSongRef = useRef(false);
    const playGenerationRef = useRef(0);
    const isInitialWsStateRef = useRef(true);

    const switchActiveAudio = (nextIdx) => {
        setActiveAudio(nextIdx);
        activeAudioRef.current = nextIdx;
    };

    const isTransitionalRef = useRef(false);
    const fadeIntervalRef = useRef(null);
    const serverProgressIntervalRef = useRef(null);

    // Web Audio API for real-time frequency analysis (visualizer)
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const sourceNode1Ref = useRef(null);
    const sourceNode2Ref = useRef(null);
    const serverEndTimeRef = useRef(0);

    const isMasterPlayer = typeof window !== 'undefined' && 
        (window.location.hostname === 'localhost' || 
         window.location.hostname === '127.0.0.1' || 
         !/Mobi|Android|iPhone|iPad/i.test(window.navigator.userAgent) || 
         localStorage.getItem('iMusic_is_master_player') === 'true');

    const handleNextRef = useRef(() => { });

    // Internal volume ref to track target volume independently of fading
    const targetVolumeRef = useRef(0.7);

    // Playback state
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentSong, setCurrentSong] = useState(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolumeState] = useState(0.7);
    const [crossfadeSeconds] = useState(4); // 4 seconds is tighter for manual skips

    // Playlist state
    const [playlist, setPlaylist] = useState([]);
    const [playlistIndex, setPlaylistIndex] = useState(0);
    const [shuffle, setShuffle] = useState(false);
    const [repeat, setRepeat] = useState('none'); // none, one, all

    // Loading states
    const [isLoading, setIsLoading] = useState(false);
    const [playedCount, setPlayedCount] = useState(0);

    // Playback Destination (local browser or server output) - Defaults to 'server'
    const [playbackTarget, setPlaybackTargetState] = useState(() => {
        const saved = localStorage.getItem('music_playback_target');
        if (saved === 'local') {
            localStorage.removeItem('music_playback_target');
            return 'server';
        }
        return saved || 'server';
    });

    // Live WebSocket connection to RanTunes server
    const ws = useRantunesWs();
    const isPlayIntendedRef = useRef(false);
    const lastPlayedSongIdRef = useRef(null);
    const lastPlayedSongTimeRef = useRef(0);
    const lastPlayToggleTimeRef = useRef(0);
    const lastSeekTimeRef = useRef(0);

    // Sync WS state → MusicContext state whenever server mode is active
    useEffect(() => {
        if (playbackTarget !== 'server') return;
        const { state } = ws;
        if (!state) return;

        // Mirror server state into React state — only for remote/mobile clients.
        // The master player drives its own state from local audio events;
        // overwriting it here with (potentially stale) WS echoes causes
        // the display to flicker back to the previous song after a skip.
        if (!isMasterPlayer) {
            setIsPlaying(state.isPlaying);
            if (ws.isConnected) {
                isPlayIntendedRef.current = state.isPlaying;
            }
            if (state.currentSong) setCurrentSong(state.currentSong);
            setCurrentTime(state.position || 0);
            setDuration(state.duration || state.currentSong?.duration_seconds || 0);
            setVolumeState((state.volume || 75) / 100); // WS uses 0-100, local uses 0-1

            // Sync queue so the Queue panel shows correct state
            if (state.queue?.length > 0) {
                setPlaylist(state.queue);
                setPlaylistIndex(state.currentIndex || 0);
            }
        }

        // Master player: sync local browser HTML5 audio elements to match WebSocket server state
        if (isMasterPlayer && state.currentSong) {
            const audio = activeAudioRef.current === 1 ? audio1Ref.current : audio2Ref.current;

            if (isInitialWsStateRef.current) {
                console.log('🔄 [MasterPlayer] Absorbing initial WS state without auto-playing.');
                lastPlayedSongIdRef.current = state.currentSong.id;
                setCurrentSong(state.currentSong);
                setPlaylist(state.queue || []);
                setPlaylistIndex(state.currentIndex || 0);
                setCurrentTime(state.position || 0);
                setDuration(state.duration || state.currentSong?.duration_seconds || 0);
                setIsPlaying(false); // Force paused state locally on boot
                
                // Load the audio source but do not play
                const audioUrl = state.currentSong.storage_url || `${MUSIC_API_URL}/music/stream?path=${encodeURIComponent(state.currentSong.file_path || '')}&id=${state.currentSong.id}`;
                audio.src = audioUrl;
                audio.load();
                if (state.position) {
                    audio.currentTime = state.position;
                }
                
                isInitialWsStateRef.current = false;
                return;
            }

            // 1. Sync song changes with crossfading (skip if we initiated it ourselves or if it is a stale update in flight)
            if (String(state.currentSong.id) !== String(lastPlayedSongIdRef.current)) {
                const timeSinceLocalPlay = Date.now() - lastPlayedSongTimeRef.current;
                if (timeSinceLocalPlay < 2500) {
                    console.log('⏳ [MasterPlayer] Ignored potential stale WS song update in flight:', state.currentSong.title);
                } else {
                    console.log('🔄 [MasterPlayer] WS triggered song change:', state.currentSong.title);
                    playSong(state.currentSong, state.queue || playlist, true, true);
                }
            }

            // Ignore server commands if we are in the middle of a crossfade/transition
            // This prevents the old song from seeking to 0 or pausing when the server changes state
            if (!isTransitionalRef.current) {
                // 2. Sync play/pause state (skip if recently toggled locally)
                const timeSinceToggle = Date.now() - lastPlayToggleTimeRef.current;
                if (timeSinceToggle > 2500) {
                    if (state.isPlaying && audio.paused) {
                        console.log('▶️ [MasterPlayer] WS triggered Play');
                        audio.play().catch(() => {});
                        setIsPlaying(true);
                    } else if (!state.isPlaying && !audio.paused) {
                        console.log('⏸ [MasterPlayer] WS triggered Pause');
                        audio.pause();
                        setIsPlaying(false);
                    }
                }

                // 3. Sync seek position (if drifted by more than 3 seconds, and not recently seeked locally)
                const timeSinceSeek = Date.now() - lastSeekTimeRef.current;
                if (timeSinceSeek > 2500 && state.isPlaying && Math.abs(audio.currentTime - (state.position || 0)) > 3) {
                    console.log(`⏩ [MasterPlayer] WS triggered Seek to ${state.position}s`);
                    audio.currentTime = state.position || 0;
                }

                // 4. Sync volume
                if (state.volume !== undefined) {
                    const targetVol = state.volume / 100;
                    audio.volume = Math.max(0, Math.min(1, targetVol || 0));
                }
            }
        }
    }, [ws.state, playbackTarget]); // eslint-disable-line react-hooks/exhaustive-deps

    // Change target and transition synchronously to preserve user gesture context (bypasses browser autoplay blocks)
    const setPlaybackTarget = useCallback(async (newTarget) => {
        const shouldPlay = isPlayIntendedRef.current;
        setPlaybackTargetState(newTarget);
        localStorage.setItem('music_playback_target', newTarget);

        if (currentSong) {
            console.log(`🔄 [MusicContext] Transitioning destination to ${newTarget} at position ${currentTime}s (shouldPlay: ${shouldPlay})`);
            
            if (newTarget === 'local') {
                // Pause server playback
                ws.pause();
                
                // Play/Load locally
                const audioUrl = `${MUSIC_API_URL}/music/stream?path=${encodeURIComponent(currentSong.file_path || '')}&id=${currentSong.id}`;
                const player = activeAudio === 1 ? audio1Ref.current : audio2Ref.current;
                const otherPlayer = activeAudio === 1 ? audio2Ref.current : audio1Ref.current;
                
                otherPlayer.pause(); 
                otherPlayer.src = '';
                
                player.src = audioUrl;
                player.load();
                player.currentTime = currentTime;
                
                if (shouldPlay) {
                    try {
                        await player.play();
                        setIsPlaying(true);
                    } catch (err) {
                        console.warn('Local play user gesture transition error:', err);
                    }
                } else {
                    setIsPlaying(false);
                }
            } else if (newTarget === 'server') {
                // Pause local playback
                audio1Ref.current.pause();
                audio2Ref.current.pause();
                
                if (shouldPlay) {
                    setIsPlaying(true);
                    // Start server playback with full queue sync
                    if (playlist && playlist.length > 0) {
                        const idx = playlist.findIndex(s => s.id === currentSong.id);
                        ws.loadQueue(playlist, idx !== -1 ? idx : 0);
                    } else {
                        ws.loadQueue([currentSong], 0);
                    }

                    setTimeout(() => {
                        ws.seek(currentTime);
                    }, 800);
                } else {
                    setIsPlaying(false);
                }
            }
        }
    }, [currentSong, ws, activeAudio, currentTime, MUSIC_API_URL, playlist]);

    // Initial Load: Restore queue from Dexie
    useEffect(() => {
        const initQueue = async () => {
            const savedQueue = await MusicQueueManager.getQueue();
            if (savedQueue?.length > 0) {
                // Find current song
                const current = savedQueue.find(s => s.is_current === 1 || s.is_current === true) || savedQueue[0];
                if (current) {
                    const idx = savedQueue.findIndex(s => s.id === current.id);
                    const cycledQueue = idx >= 0 ? [...savedQueue.slice(idx), ...savedQueue.slice(0, idx)] : savedQueue;
                    setPlaylist(cycledQueue);
                    setPlaylistIndex(0);
                    setCurrentSong(current);

                    // Don't auto-play on init for battery/policy reasons, just prepare
                    const audio = activeAudio === 1 ? audio1Ref.current : audio2Ref.current;
                    audio.src = `${MUSIC_API_URL}/music/stream?path=${encodeURIComponent(current.file_path)}&id=${current.id}`;
                    audio.load();
                }
            }
        };
        initQueue();
    }, []);

    // Sync state to Dexie when current song changes
    useEffect(() => {
        if (currentSong?.id) {
            MusicQueueManager.setCurrent(currentSong.id);
        }
    }, [currentSong?.id]);

    // Handle Persistent Reordering
    const handleReorder = useCallback(async (newOrder) => {
        setPlaylist(newOrder);

        // If in server mode, sync the reordered queue with the server immediately without stopping playback
        if (playbackTarget === 'server') {
            ws.updateQueue(newOrder, 0);
        }

        // Save to DB
        await MusicQueueManager.setQueue(newOrder);
    }, [playbackTarget, ws]);

    // Trigger Prefetcher whenever song or playlist changes
    // This ensures all songs in the queue are saved to local disk for external drive fallback
    useEffect(() => {
        if (playlist.length > 0) {
            // Priority 1: Next 10 tracks immediately
            // Priority 2: Rest of the queue (up to 500)
            const timeout = setTimeout(() => {
                const nextTracks = playlist.slice(playlistIndex, playlistIndex + 500);
                console.log(`📡 MusicContext: Triggering caching for ${nextTracks.length} tracks...`);
                MusicCacheManager.prefetch(playlist, playlistIndex);
            }, 500); // Proactive but wait for initial UI load
            return () => clearTimeout(timeout);
        }
    }, [playlist, playlistIndex]);

    // Skip threshold - if song was played less than 30% before skip, count as dislike
    const SKIP_THRESHOLD = 0.3;

    // Audio Event Handling with Crossfade Support
    useEffect(() => {
        const a1 = audio1Ref.current;
        const a2 = audio2Ref.current;

        const createHandlers = (playerNum) => ({
            timeupdate: (e) => {
                if (activeAudioRef.current === playerNum) {
                    setCurrentTime(e.target.currentTime);
                    // Automatic Crossfade Trigger
                    if (!isTransitionalRef.current &&
                        e.target.duration > 0 &&
                        e.target.currentTime > e.target.duration - (crossfadeSeconds + 1)) {
                        console.log('🎵 Auto-crossfade triggered');
                        handleNextRef.current(true); // true for crossfade
                    }
                }
            },
            durationchange: (e) => {
                if (activeAudioRef.current === playerNum) setDuration(e.target.duration || 0);
            },
            ended: (e) => {
                if (activeAudioRef.current === playerNum && !isTransitionalRef.current) {
                    handleNextRef.current(false);
                }
            },
            play: (e) => {
                // If in server mode, local events should not dictate UI state
                if (playbackTarget === 'server') return;
                // Determine if this player is indeed the one that SHOULD be playing UI-wise
                if (activeAudioRef.current === playerNum || isTransitionalRef.current) {
                    setIsPlaying(true);
                    isPlayIntendedRef.current = true;
                }
            },
            pause: (e) => {
                // If in server mode, local events should not dictate UI state
                if (playbackTarget === 'server') return;
                // Only pause UI if we're not in the middle of a crossfade (where one player pauses)
                if (!isTransitionalRef.current && activeAudioRef.current === playerNum) {
                    setIsPlaying(false);
                    isPlayIntendedRef.current = false;
                }
            },
            error: (e) => {
                console.error(`🎵 Audio Player ${playerNum} Error:`, e.target.error);
                if (activeAudioRef.current === playerNum && playbackTarget === 'local') {
                    setIsPlaying(false);
                    isPlayIntendedRef.current = false;
                }
            }
        });

        const h1 = createHandlers(1);
        const h2 = createHandlers(2);

        Object.keys(h1).forEach(key => a1.addEventListener(key, h1[key]));
        Object.keys(h2).forEach(key => a2.addEventListener(key, h2[key]));

        return () => {
            Object.keys(h1).forEach(key => a1.removeEventListener(key, h1[key]));
            Object.keys(h2).forEach(key => a2.removeEventListener(key, h2[key]));
        };
    }, [crossfadeSeconds, playbackTarget]);

    // Volume syncing across players
    useEffect(() => {
        targetVolumeRef.current = volume;
        if (!isTransitionalRef.current) {
            audio1Ref.current.volume = activeAudioRef.current === 1 ? Math.max(0, Math.min(1, volume || 0)) : 0;
            audio2Ref.current.volume = activeAudioRef.current === 2 ? Math.max(0, Math.min(1, volume || 0)) : 0;
        }
    }, [volume]);

    // Handle Remote Commands (from Mobile)
    useEffect(() => {
        if (!currentUser?.business_id) return;

        console.log('🎧 Desktop: Listening for secured remote commands...');

        const commandChannelName = `music_commands_${currentUser.business_id}`;
        const commandChannel = supabase.channel(commandChannelName)
            .on('broadcast', { event: 'playback_command' }, ({ payload }) => {

                // 1. Security & Stale Command Prevention
                const now = Date.now();
                if (now - payload.timestamp > 5000) {
                    console.warn('⏱️ Ignored stale remote command:', payload.command);
                    return;
                }

                console.log('📱 Executing remote command:', payload.command);

                switch (payload.command) {
                    case 'PLAY_SONG':
                        // The playback logic is below, use handleNextRef or playSong if available.
                        // However, playSong is defined later. We will use a ref or direct calling if it's hoisted?
                        // Actually, playSong is defined AFTER this useEffect in the original file. 
                        // To avoid circular dependencies, let's just create a ref for playSong.
                        if (playSongRef.current) {
                            playSongRef.current(payload.song, payload.playlist || null, payload.useCrossfade);
                        }
                        break;
                    case 'TOGGLE_PLAY':
                        if (togglePlayRef.current) togglePlayRef.current();
                        break;
                    case 'NEXT':
                        if (handleNextRef.current) handleNextRef.current(true);
                        break;
                    case 'PREV':
                        if (handlePreviousRef.current) handlePreviousRef.current();
                        break;
                    case 'VOLUME':
                        if (setVolumeRef.current) setVolumeRef.current(payload.volume);
                        break;
                    case 'SEEK':
                        if (seekRef.current) seekRef.current(payload.time);
                        break;
                }
            })
            .subscribe();

        return () => supabase.removeChannel(commandChannel);
    }, [currentUser?.business_id]); // We will use refs to avoid re-subscribing 

    // Refs for remote commands
    const playSongRef = useRef(() => { });
    const togglePlayRef = useRef(() => { });
    const handlePreviousRef = useRef(() => { });
    const setVolumeRef = useRef(() => { });
    const seekRef = useRef(() => { });

    // Log skip as dislike if skipped early
    const logSkip = useCallback(async (song, wasEarlySkip) => {
        if (!song || !currentUser) return;

        try {
            // Log to playback history
            await supabase.from('music_playback_history').insert({
                song_id: song.id,
                employee_id: currentUser.id,
                was_skipped: true,
                business_id: currentUser.business_id
            });

            // If early skip, increment skip count in ratings
            if (wasEarlySkip) {
                const { data: existing } = await supabase
                    .from('music_ratings')
                    .select('*')
                    .eq('song_id', song.id)
                    .eq('employee_id', currentUser.id)
                    .single();

                if (existing) {
                    await supabase
                        .from('music_ratings')
                        .update({
                            skip_count: (existing.skip_count || 0) + 1,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', existing.id);
                } else {
                    await supabase.from('music_ratings').insert({
                        song_id: song.id,
                        employee_id: currentUser.id,
                        skip_count: 1,
                        business_id: currentUser.business_id
                    });
                }
            }
        } catch (error) {
            console.error('Error logging skip:', error);
        }
    }, [currentUser]);

    // Play a song with crossfade capability
    const playSong = useCallback(async (song, playlistSongs = null, useCrossfade = true, isWsSync = false) => {
        if (!song) return;

        if (isPlayingSongRef.current && !isWsSync) {
            console.log('🔄 [playSong] Concurrent execution detected. Clearing fade interval.');
            if (fadeIntervalRef.current) {
                clearInterval(fadeIntervalRef.current);
                fadeIntervalRef.current = null;
            }
        }
        isPlayingSongRef.current = true;
        const myGeneration = ++playGenerationRef.current;

        lastPlayedSongIdRef.current = song.id;
        lastPlayedSongTimeRef.current = Date.now();

        // Skip disliked
        if ((song.myRating || 0) === 1) {
            isPlayingSongRef.current = false;
            setTimeout(() => handleNextRef.current(useCrossfade), 100);
            return;
        }

        setIsPlaying(true); // 🚀 Immediate UI feedback
        setIsLoading(true);

        // Lazy-init Web Audio API analyser on first play
        if (!audioContextRef.current && typeof window !== 'undefined') {
            try {
                // TEMPORARILY DISABLED TO PREVENT BROWSER METALLIC ECHO BUG
                /*
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                const ctx = new AudioContext();
                const analyser = ctx.createAnalyser();
                analyser.fftSize = 256;
                analyser.smoothingTimeConstant = 0.8;

                const src1 = ctx.createMediaElementSource(audio1Ref.current);
                const src2 = ctx.createMediaElementSource(audio2Ref.current);
                src1.connect(analyser);
                src2.connect(analyser);
                analyser.connect(ctx.destination);

                audioContextRef.current = ctx;
                analyserRef.current = analyser;
                sourceNode1Ref.current = src1;
                sourceNode2Ref.current = src2;
                console.log('🎛️ Web Audio API analyser initialised (fftSize=256)');
                */
                console.log('🎛️ Web Audio API analyser temporarily disabled to prevent echo');
            } catch (err) {
                console.warn('⚠️ Web Audio API init failed:', err);
            }
        }
        // Resume AudioContext if it was suspended (browser autoplay policy)
        if (audioContextRef.current?.state === 'suspended') {
            await audioContextRef.current.resume();
        }

        try {
            MusicCacheManager.trackPlay(song);

            const player1 = audio1Ref.current;
            const player2 = audio2Ref.current;
            const currentActiveIdx = activeAudioRef.current;
            const nextActiveIdx = currentActiveIdx === 1 ? 2 : 1;
            const currentPlayer = currentActiveIdx === 1 ? player1 : player2;
            const nextPlayer = nextActiveIdx === 1 ? player1 : player2;

            // Verify connection/path
            if (!song.file_path && !song.url) {
                console.error('❌ Playback blocked: No file path or URL for song:', song);
                isPlayingSongRef.current = false;
                return;
            }

            // Update Playlist Context: keep current playing song at index 0, cycle the rest
            let activePlaylist = playlistSongs && playlistSongs.length > 0 ? playlistSongs : playlist;
            let currentIdx = 0;
            if (activePlaylist && activePlaylist.length > 0) {
                const idx = activePlaylist.findIndex(s => s.id === song.id);
                if (idx !== -1) {
                    const cycledPlaylist = [...activePlaylist.slice(idx), ...activePlaylist.slice(0, idx)];
                    setPlaylist(cycledPlaylist);
                    setPlaylistIndex(0);
                    currentIdx = 0;
                    MusicQueueManager.setQueue(cycledPlaylist);
                    if (playlistSongs && playlistSongs !== playlist) {
                        setPlayedCount(0); // Reset played count for new play context
                    }
                } else {
                    const mergedPlaylist = [song, ...activePlaylist.filter(s => s.id !== song.id)];
                    setPlaylist(mergedPlaylist);
                    setPlaylistIndex(0);
                    currentIdx = 0;
                    MusicQueueManager.setQueue(mergedPlaylist);
                    if (playlistSongs && playlistSongs !== playlist) {
                        setPlayedCount(0);
                    }
                }
            } else {
                const singlePlaylist = [song];
                setPlaylist(singlePlaylist);
                setPlaylistIndex(0);
                currentIdx = 0;
                MusicQueueManager.setQueue(singlePlaylist);
                setPlayedCount(0);
            }

            console.log('🎵 Starting playback for:', song.title, 'Path:', song.file_path);

            // Immediate UI feedback — update display before any async work
            setCurrentSong(song);
            setDuration(song.duration_seconds || 0);
            setCurrentTime(0);

            const audioUrl = song.storage_url || `${MUSIC_API_URL}/music/stream?path=${encodeURIComponent(song.file_path || '')}&id=${song.id}`;

            // ── Server-Mode Playback via WebSocket ─────────────────────────────
            console.log('🎵 [MusicContext] playbackTarget current value:', playbackTarget);

            if (playbackTarget === 'server') {
                console.log('🔌 [ServerPlay] Syncing WS PLAY command:', song.title);

                // Sync the full queue to the server first to enable auto-advance and correct metadata broadcast
                let finalQueue = [];
                let activePlaylist = playlistSongs && playlistSongs.length > 0 ? playlistSongs : playlist;
                if (activePlaylist && activePlaylist.length > 0) {
                    const idx = activePlaylist.findIndex(s => s.id === song.id);
                    if (idx !== -1) {
                        finalQueue = [...activePlaylist.slice(idx), ...activePlaylist.slice(0, idx)];
                    } else {
                        finalQueue = [song, ...activePlaylist.filter(s => s.id !== song.id)];
                    }
                } else {
                    finalQueue = [song];
                }

                // Send queue (starts playback automatically on the server)
                if (!isWsSync) {
                    ws.loadQueue(finalQueue, 0);
                }

                if (!isMasterPlayer) {
                    // Stop ANY local playback immediately to avoid overlap
                    player1.pause(); player1.src = ''; player1.load();
                    player2.pause(); player2.src = ''; player2.load();
                    if (fadeIntervalRef.current) { clearInterval(fadeIntervalRef.current); fadeIntervalRef.current = null; }
                    if (serverProgressIntervalRef.current) { clearInterval(serverProgressIntervalRef.current); serverProgressIntervalRef.current = null; }

                    // Optimistic local state — WS state sync will confirm
                    setCurrentSong(song);
                    setDuration(song.duration_seconds || 0);
                    setCurrentTime(0);
                    setIsPlaying(true);
                    isPlayIntendedRef.current = true;
                    isPlayingSongRef.current = false;
                    return;
                }
            }

            // Perform Crossfade if requested AND current player is actually playing (check DOM directly)
            const isActuallyPlaying = !currentPlayer.paused;
            console.log(`🎵 playSong: Crossfade=${useCrossfade}, IsPlaying=${isActuallyPlaying} (State: ${isPlaying})`);

            if (useCrossfade && isActuallyPlaying) {
                console.log(`🎚️ Crossfading... Player ${currentActiveIdx} -> ${nextActiveIdx}`);

                // Clear any existing fade
                if (fadeIntervalRef.current) {
                    clearInterval(fadeIntervalRef.current);
                }

                isTransitionalRef.current = true;

                // Prepare next player
                nextPlayer.src = audioUrl;
                nextPlayer.volume = 0;
                nextPlayer.load();

                // Wait for metadata
                await new Promise((resolve, reject) => {
                    if (nextPlayer.readyState >= 1) { resolve(); return; }
                    const l = () => { nextPlayer.removeEventListener('loadedmetadata', l); nextPlayer.removeEventListener('error', e); resolve(); };
                    const e = (err) => { nextPlayer.removeEventListener('loadedmetadata', l); nextPlayer.removeEventListener('error', e); reject(err); };
                    nextPlayer.addEventListener('loadedmetadata', l);
                    nextPlayer.addEventListener('error', e);
                    setTimeout(resolve, 800); // Timeout fallback
                });

                // Abort if a newer playSong call has superseded us
                if (playGenerationRef.current !== myGeneration) {
                    console.log('🛑 [playSong] Aborted after metadata: superseded by newer call');
                    return;
                }

                // Start playing next
                try {
                    await nextPlayer.play();
                } catch (playErr) {
                    console.warn('⚠️ nextPlayer.play() failed:', playErr);
                }

                // Abort if a newer playSong call has superseded us
                if (playGenerationRef.current !== myGeneration) {
                    console.log('🛑 [playSong] Aborted after play(): superseded by newer call');
                    nextPlayer.pause();
                    return;
                }

                // Switch active audio element for events/controls
                switchActiveAudio(nextActiveIdx);
                setDuration(nextPlayer.duration || song.duration_seconds || 0);

                // Server-side Volume Ramp
                const steps = 30;
                const interval = (crossfadeSeconds * 1000) / steps;
                let step = 0;
                const startVol = targetVolumeRef.current;

                // Server crossfade: WS server handles this natively via auto-advance
                // No client-side crossfade needed in server mode
                if (playbackTarget === 'server' && !isMasterPlayer) {
                    // Server handles crossfade via queue auto-advance — just update local UI state
                    ws.play(song);
                    isTransitionalRef.current = false;
                } else {
                    // Local Audio Volume Ramp
                    fadeIntervalRef.current = setInterval(() => {
                        step++;
                        const progress = step / steps;
                        const easeOut = 1 - Math.pow(1 - progress, 2);
                        const easeIn = Math.pow(progress, 2);

                        currentPlayer.volume = Math.max(0, Math.min(1, startVol * (1 - easeOut)));
                        nextPlayer.volume = Math.max(0, Math.min(1, Math.min(startVol, startVol * easeIn)));

                        if (step >= steps) {
                            clearInterval(fadeIntervalRef.current);
                            fadeIntervalRef.current = null;
                            currentPlayer.pause();
                            currentPlayer.currentTime = 0;
                            isTransitionalRef.current = false;
                            nextPlayer.volume = Math.max(0, Math.min(1, targetVolumeRef.current || 0));
                        }
                    }, interval);
                }
            } else {
                // Immediate switch
                if (fadeIntervalRef.current) {
                    clearInterval(fadeIntervalRef.current);
                    fadeIntervalRef.current = null;
                }
                isTransitionalRef.current = false;
                currentPlayer.pause();

                nextPlayer.src = audioUrl;
                nextPlayer.volume = Math.max(0, Math.min(1, targetVolumeRef.current || 0));
                nextPlayer.load();
                try {
                    await nextPlayer.play();
                } catch (playErr) {
                    console.warn('⚠️ nextPlayer.play() failed:', playErr);
                }

                // Abort if a newer playSong call has superseded us
                if (playGenerationRef.current !== myGeneration) {
                    console.log('🛑 [playSong] Aborted after immediate play(): superseded by newer call');
                    nextPlayer.pause();
                    isPlayingSongRef.current = false;
                    return;
                }

                switchActiveAudio(nextActiveIdx);
                setDuration(nextPlayer.duration || song.duration_seconds || 0);
            }

            // Sync playlist state
            // Sync to Local Storage Queue
            if (playlistSongs) {
                MusicQueueManager.setQueue(playlistSongs);
                MusicQueueManager.setCurrent(song.id);
            } else {
                MusicQueueManager.setCurrent(song.id);
            }

            // Remote history & Current Playback Sync
            if (currentUser && currentUser.id) {
                try {
                    // 1. History
                    const historyData = {
                        song_id: song.id,
                        employee_id: currentUser.id,
                        was_skipped: false,
                    };

                    if (currentUser.business_id) {
                        historyData.business_id = currentUser.business_id;
                    }

                    await supabase.from('music_playback_history').insert(historyData);

                    // 2. Current Playback (for MiniPlayer sync)
                    if (currentUser.email) {
                        const playbackData = {
                            user_email: currentUser.email,
                            song_id: song.id,
                            song_title: song.title,
                            artist_name: song.artist?.name || 'Unknown Artist',
                            album_name: song.album?.name || 'Unknown Album',
                            cover_url: song.album?.cover_url || song.cover_url || song.thumbnail_url,
                            is_playing: true,
                            updated_at: new Date().toISOString()
                        };

                        if (currentUser.business_id) {
                            playbackData.business_id = currentUser.business_id;
                        }

                        // Upsert based on user_email
                        await supabase
                            .from('music_current_playback')
                            .upsert(playbackData, { onConflict: 'user_email' });
                    }
                } catch (syncErr) {
                    console.warn('⚠️ Playback sync failed (non-critical):', syncErr.message);
                }
            }
        } catch (error) {
            console.error('Error playing song:', error);
            isTransitionalRef.current = false;
        } finally {
            setIsLoading(false);
            isPlayingSongRef.current = false;
        }
    }, [currentUser, playlist, crossfadeSeconds, playbackTarget, MUSIC_API_URL]);

    // Play/Pause toggle
    const togglePlay = useCallback(() => {
        lastPlayToggleTimeRef.current = Date.now();
        if (playbackTarget === 'server') {
            if (!isMasterPlayer) {
                // Ensure local audio is silent
                audio1Ref.current.pause();
                audio2Ref.current.pause();
            }

            if (isPlaying) {
                ws.pause();          // ✅ WS PAUSE (replaces /music/stop-server)
                setIsPlaying(false);
                isPlayIntendedRef.current = false;
                
                if (isMasterPlayer) {
                    playGenerationRef.current++;
                    if (fadeIntervalRef.current) {
                        clearInterval(fadeIntervalRef.current);
                        fadeIntervalRef.current = null;
                        isTransitionalRef.current = false;
                    }
                    audio1Ref.current.pause();
                    audio2Ref.current.pause();
                }
            } else if (currentSong) {
                ws.resume();         // ✅ WS RESUME
                setIsPlaying(true);
                isPlayIntendedRef.current = true;
                
                if (isMasterPlayer) {
                    const audio = activeAudioRef.current === 1 ? audio1Ref.current : audio2Ref.current;
                    audio.play().catch(err => console.warn('⚠️ play() failed:', err));
                }
            }
            return;
        }

        const audio = activeAudioRef.current === 1 ? audio1Ref.current : audio2Ref.current;
        if (audio.paused) {
            audio.play().catch(err => console.warn('⚠️ play() failed:', err));
            isPlayIntendedRef.current = true;
        } else {
            // Abort pending playSong and clear crossfade
            playGenerationRef.current++;
            if (fadeIntervalRef.current) {
                clearInterval(fadeIntervalRef.current);
                fadeIntervalRef.current = null;
                isTransitionalRef.current = false;
            }
            audio1Ref.current.pause();
            audio2Ref.current.pause();
            isPlayIntendedRef.current = false;
        }
    }, [playbackTarget, isPlaying, currentSong, ws]);

    // Pause
    const pause = useCallback(() => {
        lastPlayToggleTimeRef.current = Date.now();
        isPlayIntendedRef.current = false;
        // Abort pending playSong and clear crossfade
        playGenerationRef.current++;
        if (fadeIntervalRef.current) {
            clearInterval(fadeIntervalRef.current);
            fadeIntervalRef.current = null;
            isTransitionalRef.current = false;
        }
        
        if (playbackTarget === 'server') {
            ws.pause();              // ✅ WS PAUSE
            setIsPlaying(false);
            if (isMasterPlayer) {
                audio1Ref.current.pause();
                audio2Ref.current.pause();
            }
            return;
        }
        audio1Ref.current.pause();
        audio2Ref.current.pause();
        setIsPlaying(false); // Explicit sync
    }, [playbackTarget, ws]);

    // Stop local audio when target changes to server
    useEffect(() => {
        if (playbackTarget === 'server' && !isMasterPlayer) {
            const a1 = audio1Ref.current;
            const a2 = audio2Ref.current;
            a1.pause();
            a1.src = '';
            a1.load();
            a2.pause();
            a2.src = '';
            a2.load();
            if (fadeIntervalRef.current) {
                clearInterval(fadeIntervalRef.current);
                fadeIntervalRef.current = null;
            }
            setIsPlaying(false);
        }
    }, [playbackTarget]);

    // Resume
    const resume = useCallback(() => {
        lastPlayToggleTimeRef.current = Date.now();
        isPlayIntendedRef.current = true;
        if (playbackTarget === 'server') {
            ws.resume();             // ✅ WS RESUME
            setIsPlaying(true);
            return;
        }
        const audio = activeAudioRef.current === 1 ? audio1Ref.current : audio2Ref.current;
        audio.play().catch(err => console.warn('⚠️ resume play() failed:', err));
    }, [playbackTarget, ws]);

    // Next song with forced crossfade option - FIFO cycling rotation loop
    const handleNext = useCallback((forceCrossfade = true) => {
        if (!playlist.length) return;

        const shouldCrossfade = typeof forceCrossfade === 'boolean' ? forceCrossfade : true;

        // Log skip history if needed
        const wasEarlySkip = currentTime < duration * SKIP_THRESHOLD;
        if (currentSong && wasEarlySkip) {
            logSkip(currentSong, true);
        }

        const nextCount = playedCount + 1;
        const isPlaylistQueue = playlist.some(s => s.playlist_id !== undefined && s.playlist_id !== null);

        if (isPlaylistQueue && nextCount >= playlist.length) {
            console.log("Playlist completed. Auto-reshuffling...");
            const reshuffled = [...playlist];
            for (let i = reshuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [reshuffled[i], reshuffled[j]] = [reshuffled[j], reshuffled[i]];
            }
            setPlaylist(reshuffled);
            setPlaylistIndex(0);
            MusicQueueManager.setQueue(reshuffled);
            setPlayedCount(0);
            playSong(reshuffled[0], reshuffled, shouldCrossfade);
        } else {
            // Normal FIFO rotation cycle
            const nextPlaylist = [...playlist.slice(1), playlist[0]];
            setPlaylist(nextPlaylist);
            setPlaylistIndex(0);
            MusicQueueManager.setQueue(nextPlaylist);
            setPlayedCount(nextCount);
            playSong(nextPlaylist[0], nextPlaylist, shouldCrossfade);
        }
    }, [playlist, currentSong, currentTime, duration, logSkip, playSong, playedCount]);

    // Keep ref in sync with handleNext
    useEffect(() => {
        handleNextRef.current = handleNext;
        playSongRef.current = playSong;
        togglePlayRef.current = togglePlay;
    }, [handleNext, playSong, togglePlay]);

    // Previous song - FIFO cycling rotation loop
    const handlePrevious = useCallback(() => {
        if (!playlist.length) return;

        setPlayedCount(prev => Math.max(0, prev - 1));

        const prevPlaylist = [playlist[playlist.length - 1], ...playlist.slice(0, playlist.length - 1)];
        setPlaylist(prevPlaylist);
        setPlaylistIndex(0);
        MusicQueueManager.setQueue(prevPlaylist);
        playSong(prevPlaylist[0], prevPlaylist, false); // No crossfade when skipping backwards
    }, [playlist, playSong]);

    // Seek to position
    const seek = useCallback((time) => {
        lastSeekTimeRef.current = Date.now();
        const audio = activeAudioRef.current === 1 ? audio1Ref.current : audio2Ref.current;
        audio.currentTime = time;
    }, []);

    // Rate a song (like/dislike only) - use backend service to bypass RLS
    const rateSong = useCallback(async (songId, rating) => {
        console.log('🎵 rateSong called:', { songId, rating, currentUser: currentUser?.id });
        if (!currentUser || !songId) {
            console.log('🎵 rateSong: missing user or songId');
            return false;
        }

        try {
            const response = await fetch(`${MUSIC_API_URL}/music/rate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    songId,
                    employeeId: currentUser.id,
                    businessId: currentUser.business_id || null,
                    rating
                })
            });

            const result = await response.json().catch(() => ({}));
            if (!response.ok || !result?.success) {
                throw new Error(result?.message || 'Failed to rate song');
            }

            // Update current playlist and current song with the new rating
            setPlaylist(prev => prev.map(s => s.id === songId ? { ...s, myRating: rating } : s));
            if (currentSong?.id === songId) {
                setCurrentSong(prev => ({ ...prev, myRating: rating }));

                // If the current song was just disliked, skip to next
                if (rating === 1) {
                    console.log('🎵 rateSong: current song disliked, skipping...');
                    handleNext();
                }
            }

            return true;
        } catch (error) {
            console.error('Error rating song:', error);
            return false;
        }
    }, [currentUser]);

    // Set volume
    const setVolume = useCallback((vol) => {
        const clampedVol = Math.max(0, Math.min(1, vol));
        setVolumeState(clampedVol);
        targetVolumeRef.current = clampedVol;

        if (playbackTarget === 'server') {
            // ✅ WS VOLUME (0-1 → 0-100 conversion)
            ws.setVolume(Math.round(clampedVol * 100));
        }

        // If not fading, update audio element volume directly
        if (!isTransitionalRef.current) {
            audio1Ref.current.volume = activeAudioRef.current === 1 ? Math.max(0, Math.min(1, clampedVol || 0)) : 0;
            audio2Ref.current.volume = activeAudioRef.current === 2 ? Math.max(0, Math.min(1, clampedVol || 0)) : 0;
        }
    }, [playbackTarget, ws]);

    // Update remaining refs
    useEffect(() => {
        handlePreviousRef.current = handlePrevious;
        setVolumeRef.current = setVolume;
        seekRef.current = seek;
    }, [handlePrevious, setVolume, seek]);


    // Stop playback
    const stop = useCallback(() => {
        playGenerationRef.current++; // Abort any pending playSong
        
        if (playbackTarget === 'server') {
            ws.stop();               // ✅ WS STOP
        }

        if (fadeIntervalRef.current) {
            clearInterval(fadeIntervalRef.current);
            fadeIntervalRef.current = null;
        }
        audio1Ref.current.pause();
        audio1Ref.current.src = '';
        audio1Ref.current.load();

        audio2Ref.current.pause();
        audio2Ref.current.src = '';
        audio2Ref.current.load();

        setCurrentSong(null);
        setIsPlaying(false);
        isTransitionalRef.current = false;
    }, [playbackTarget, ws]);

    // Remove from queue
    const removeFromQueue = useCallback(async (songId) => {
        setPlaylist(prev => prev.filter(s => s.id !== songId));
        await MusicQueueManager.removeTrack(songId);
    }, []);

    /**
     * ➕ Smart Queue Addition
     * @param {Object} item - Song, Album, or Playlist
     * @param {string} mode - 'next' | 'last' | 'shuffle'
     */
    const addToQueue = useCallback(async (song, mode = 'last') => {
        if (!song) return;

        setPlaylist(prev => {
            const newPlaylist = [...prev];
            // mode logic
            if (mode === 'next') {
                newPlaylist.splice(playlistIndex + 1, 0, song);
            } else if (mode === 'shuffle') {
                const upcomingStart = playlistIndex + 1;
                const insertPos = upcomingStart + Math.floor(Math.random() * (newPlaylist.length - upcomingStart + 1));
                newPlaylist.splice(insertPos, 0, song);
            } else {
                newPlaylist.push(song);
            }

            // Persist
            MusicQueueManager.setQueue(newPlaylist);
            // Prioritize local caching for queued songs
            MusicCacheManager.prefetch(newPlaylist, playlistIndex);
            return newPlaylist;
        });

        // If nothing playing, start it (use playlist length from updater to avoid stale closure)
        if (playlist.length === 0) {
            playSong(song);
        }
    }, [playlistIndex, playSong, playlist.length]);

    const addPlaylistToQueue = useCallback(async (songs, mode = 'last') => {
        if (!songs || songs.length === 0) return;

        setPlaylist(prev => {
            let newPlaylist = [...prev];
            if (mode === 'next') {
                newPlaylist.splice(playlistIndex + 1, 0, ...songs);
            } else if (mode === 'shuffle') {
                // Simple shuffle append
                const shuffled = [...songs].sort(() => Math.random() - 0.5);
                newPlaylist = [...newPlaylist, ...shuffled];
            } else {
                newPlaylist = [...newPlaylist, ...songs];
            }

            MusicQueueManager.setQueue(newPlaylist);
            // Prioritize local caching for queued songs
            MusicCacheManager.prefetch(newPlaylist, playlistIndex);
            return newPlaylist;
        });

        if (playlist.length === 0) {
            playSong(songs[0]);
        }
    }, [playlistIndex, playSong, playlist.length]);

    // handleNext/handlePrevious in server mode: delegate to WS
    const handleNextWs = useCallback(() => {
        if (playbackTarget === 'server' && !isMasterPlayer) { ws.next(); return; }
        handleNextRef.current(true);
    }, [playbackTarget, ws]);

    const handlePreviousWs = useCallback(() => {
        if (playbackTarget === 'server' && !isMasterPlayer) { ws.prev(); return; }
        // handlePrevious is already defined above via handlePreviousRef
        handlePreviousRef.current();
    }, [playbackTarget, ws]);

    const value = {
        // State
        isPlaying,
        currentSong,
        currentTime,
        duration,
        volume,
        playlist,
        playlistIndex,
        shuffle,
        repeat,
        isLoading,

        // WS connection status (useful for UI indicators)
        wsConnected: ws.isConnected,
        wsError: ws.connectionError,

        // Actions
        playSong: (song, pl, crossfade = true) => playSong(song, pl, crossfade),
        togglePlay,
        pause,
        resume,
        handleNext: handleNextWs,
        handlePrevious: handlePreviousWs,
        seek,
        setVolume,
        rateSong,
        stop,
        setShuffle,
        setRepeat,
        setPlaylist,
        handleReorder,
        removeFromQueue,
        addToQueue,
        addPlaylistToQueue,
        playbackTarget,
        setPlaybackTarget,
        updateSongInContext: (updatedSong) => {
            if (currentSong?.id === updatedSong.id) {
                setCurrentSong(prev => ({ ...prev, ...updatedSong }));
            }
            setPlaylist(prev => {
                const newPlaylist = prev.map(s => s.id === updatedSong.id ? { ...s, ...updatedSong } : s);
                // Also update Dexie Queue
                import('@/services/musicQueueManager').then(m => m.MusicQueueManager.setQueue(newPlaylist));
                return newPlaylist;
            });
        },

        // Raw WS hook for components that need fine-grained WS control
        rantunesWs: ws,

        // Refs
        audioRef: activeAudio === 1 ? audio1Ref : audio2Ref,

        // Web Audio analyser for visualizer
        analyserNode: analyserRef.current
    };

    return (
        <MusicContext.Provider value={value}>
            {children}
        </MusicContext.Provider>
    );
};

export const useMusic = () => {
    const context = useContext(MusicContext);
    if (!context) {
        throw new Error('useMusic must be used within a MusicProvider');
    }
    return context;
};

export default MusicContext;
