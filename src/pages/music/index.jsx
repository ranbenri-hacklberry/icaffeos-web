import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Music, Disc, ListMusic, Search, Plus, RefreshCw,
    ArrowRight, Sparkles, User, Play, FolderOpen, Heart, Youtube,
    Pause, SkipForward, SkipBack, Trash2, X, HardDrive, AlertCircle, Home, Download, Archive, List,
    Volume2, VolumeX, ThumbsUp, ThumbsDown, Edit2, ChevronDown, Minus
} from 'lucide-react';
import { motion, AnimatePresence, Reorder, useDragControls } from 'framer-motion';
import { useMusic } from '@/context/MusicContext';
import { useAlbums } from '@/hooks/useAlbums';
import { useImportContext } from '@/hooks/useImportContext';
import { useAuth } from '@/context/AuthContext';
import AlbumCard from '@/components/music/AlbumCard';
import AddMusicCard from '@/components/music/AddMusicCard';
import VinylTurntable from '@/components/music/VinylTurntable';
import AudioVisualizer from '@/components/music/AudioVisualizer';
import SongRow from '@/components/music/SongRow';

// Reorderable wrapper for SongRow using Framer Motion's useDragControls for touch-friendly dragging on mobile
const ReorderableSongRow = React.forwardRef(({ song, isCurrentSong = false, isPlaying = false, onPlay }, ref) => {
    const dragControls = useDragControls();
    return (
        <Reorder.Item
            value={song}
            dragListener={false}
            dragControls={dragControls}
            className="list-none"
            ref={ref}
        >
            <SongRow
                song={song}
                isCurrentSong={isCurrentSong}
                isPlaying={isPlaying}
                onEdit={onPlay}
                isDraggable={true}
                dragControls={dragControls}
            />
        </Reorder.Item>
    );
});
ReorderableSongRow.displayName = 'ReorderableSongRow';
import MiniMusicPlayer from '@/components/music/MiniMusicPlayer';
import AlbumView from '@/pages/music/components/AlbumView';
import PlaylistBuilder from '@/pages/music/components/PlaylistBuilder';
import SyncOverlay from '@/pages/music/components/SyncOverlay';
import CDImportModal from '@/pages/music/components/CDImportModal';
import QueueModeModal from '@/components/music/QueueModeModal';
import UnifiedHeader from '@/components/UnifiedHeader';

import DirectoryScanner from '@/pages/music/components/DirectoryScanner';
import YouTubeIngest from '@/pages/music/components/YouTubeIngest';
import ExternalIngestManager from '@/pages/music/components/ExternalIngestManager';
// Removed YouTubeSearch import as it is now used within YouTubeIngest

import { getBackendApiUrl } from '@/utils/apiUtils';
import '@/styles/music.css';

const isStandaloneRanTunes = import.meta.env.VITE_STANDALONE_RANTUNES === 'true';
const MUSIC_API_URL = getBackendApiUrl();

// Tabs for navigation
const TABS = isStandaloneRanTunes ? [
    { id: 'songs', label: 'שירים', icon: Music },
    { id: 'albums', label: 'אלבומים', icon: Disc },
    { id: 'playlists', label: 'פלייליסטים', icon: ListMusic },
] : [
    { id: 'playlists', label: 'פלייליסטים', icon: ListMusic },
];

// Helper to generate gradients for song cards without album art
const getSongGradient = (title) => {
    const gradients = [
        'bg-gradient-to-br from-violet-900 to-indigo-900',
        'bg-gradient-to-br from-rose-900 to-pink-900',
        'bg-gradient-to-br from-emerald-900 to-teal-900',
        'bg-gradient-to-br from-amber-900 to-orange-900',
        'bg-gradient-to-br from-sky-900 to-cyan-900',
        'bg-gradient-to-br from-fuchsia-900 to-purple-900',
    ];
    const index = (title?.charCodeAt(0) || 0) % gradients.length;
    return gradients[index];
};

const MusicPageContent = () => {
    const navigate = useNavigate();
    const { currentUser: authUser } = useAuth();
    const isStandalone = import.meta.env.VITE_STANDALONE_RANTUNES === 'true';

    const currentUser = isStandalone ? {
        id: '0f043e57-ce9a-4843-b661-83088299da26',
        name: 'Ran Ben-Ri',
        role: 'admin',
        access_level: 'admin',
        is_admin: true,
        business_id: 'standalone',
        business_name: 'RanTunes'
    } : authUser;

    // Permissions: Everyone can see the player, but maybe only admins can ingest?
    const accessLevel = (currentUser?.access_level || '').toLowerCase();
    const role = (currentUser?.role || '').toLowerCase();
    const isManager = isStandalone || role === 'admin' || role === 'manager' || role === 'owner' ||
        accessLevel === 'admin' || accessLevel === 'manager' || accessLevel === 'owner' ||
        currentUser?.is_admin || currentUser?.is_super_admin;

    const {
        albums,
        artists,
        playlists,
        isLoading,
        error,
        isMusicDriveConnected,
        diskStatus,
        checkMusicDriveConnection,
        refreshAll,
        addSongToPlaylist,
        scanMusicDirectory,
        fetchArtists,
        fetchAlbums,
        fetchAlbumSongs,
        fetchAllSongs,
        fetchPlaylists,
        fetchPlaylistSongs,
        fetchArtistSongs,
        fetchFavoritesSongs,
        deleteSong,
        deleteAlbum,
        deletePlaylist,
        archiveItem,
        generateSmartPlaylist,
        updateSongDetails,
        fetchSongPlaylistId,
        reorderPlaylistSongs
    } = useAlbums();

    const {
        currentSong,
        playSong,
        isPlaying,
        togglePlay,
        handleNext,
        handlePrevious,
        playlist, // This is the current playback queue
        playlistIndex,
        rateSong,
        currentTime,
        duration,
        volume,
        seek,
        setVolume,
        handleReorder,
        removeFromQueue,
        addToQueue,
        addPlaylistToQueue,
        playbackTarget,
        setPlaybackTarget,
        wsConnected,
        wsError,
        updateSongInContext,
    } = useMusic();

    const [activeTab, setActiveTab] = useState(isStandaloneRanTunes ? 'songs' : 'playlists');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedAlbum, setSelectedAlbum] = useState(null);
    const [showPlaylistBuilder, setShowPlaylistBuilder] = useState(false);
    const [showScanner, setShowScanner] = useState(false);
    
    // Song editing & BPM filtering states
    const [editingSong, setEditingSong] = useState(null);
    const [editTitle, setEditTitle] = useState('');
    const [editArtistName, setEditArtistName] = useState('');
    const [editPlaylistId, setEditPlaylistId] = useState('');
    const [editBpmType, setEditBpmType] = useState('chill'); // 'chill' | 'upbeat'
    const [isSavingEdit, setIsSavingEdit] = useState(false);
    const [bpmFilter, setBpmFilter] = useState('all'); // 'all' | 'chill' | 'upbeat'
    const [queueContext, setQueueContext] = useState(null); // { item, type: 'song'|'album' }
    const [showYouTubeIngest, setShowYouTubeIngest] = useState(false);
    const [selectedBatch, setSelectedBatch] = useState(null);
    const [showDirectoryScanner, setShowDirectoryScanner] = useState(false);
    const [selectedYoutubeVideo, setSelectedYoutubeVideo] = useState(null);
    const [currentAlbumSongs, setCurrentAlbumSongs] = useState([]);
    const [favoriteSongs, setFavoriteSongs] = useState([]);
    const [allSongs, setAllSongs] = useState([]);

    // SYNC STATE
    const [showSyncOverlay, setShowSyncOverlay] = useState(false);
    const [mismatchDetected, setMismatchDetected] = useState(false);
    const [pendingSyncCount, setPendingSyncCount] = useState(0);

    // CD STATE
    const [showCDImport, setShowCDImport] = useState(false);
    const [isCdMounted, setIsCdMounted] = useState(false);

    // NETWORK STATUS
    const [networkSource, setNetworkSource] = useState('local'); // 'local', 'yt'
    const [isMasterOnline, setIsMasterOnline] = useState(true);
    const [libraryStats, setLibraryStats] = useState(null);
    const [isEditMode, setIsEditMode] = useState(false);
    const [selectedItems, setSelectedItems] = useState([]); // Array of IDs

    const [isPlayerExpanded, setIsPlayerExpanded] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    const activeSongRef = useRef(null);
    const scrollContainerRef = useRef(null);

    // Scroll active song into view at the top of the scroll container
    useEffect(() => {
        if (activeSongRef.current && scrollContainerRef.current) {
            const container = scrollContainerRef.current;
            const element = activeSongRef.current;
            
            const containerTop = container.getBoundingClientRect().top;
            const elementTop = element.getBoundingClientRect().top;
            const relativeTop = elementTop - containerTop;
            
            container.scrollTo({
                top: container.scrollTop + relativeTop,
                behavior: 'smooth'
            });
        }
    }, [currentSong?.id, playlistIndex]);

    // Set dynamic document title and manifest for iMusic mode
    useEffect(() => {
        document.title = 'iCaffeOS - iMusic';
    }, []);

    // Track mobile viewport
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth <= 760);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Scroll lock on mobile when player is expanded
    useEffect(() => {
        if (isMobile && isPlayerExpanded) {
            document.body.classList.add('overflow-hidden', 'touch-none');
        } else {
            document.body.classList.remove('overflow-hidden', 'touch-none');
        }
        return () => {
            document.body.classList.remove('overflow-hidden', 'touch-none');
        };
    }, [isMobile, isPlayerExpanded]);

    const toggleItemSelection = (id) => {
        setSelectedItems(prev =>
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    const handleBulkDelete = async () => {
        if (selectedItems.length === 0) return;
        if (!window.confirm(`האם אתה בטוח שברצונך למחוק ${selectedItems.length} פריטים?`)) return;

        try {
            for (const id of selectedItems) {
                if (activeTab === 'albums') await deleteAlbum(id, false);
                else if (activeTab === 'playlists') await deletePlaylist(id);
                else if (activeTab === 'singles') await deleteSong(id, false);
            }
            setSelectedItems([]);
            setIsEditMode(false);
            refreshAll();
        } catch (err) {
            console.error('Bulk delete failed:', err);
        }
    };

    const fetchLibraryStats = useCallback(async () => {
        try {
            const res = await fetch(`${MUSIC_API_URL}/api/music/library/stats`);
            const data = await res.json();
            if (data.success) setLibraryStats(data.stats);
        } catch (err) { }
    }, []);

    useEffect(() => {
        // Start Heartbeat if we are on the Edge Hub
        const isEdgeHub = window.location.hostname.includes('edge') || true; // Auto-detect in real env
        fetch(`${MUSIC_API_URL}/api/music/discovery/start`, {
            method: 'POST',
            body: JSON.stringify({ device_type: isEdgeHub ? 'edge_hub' : 'mac' }),
            headers: { 'Content-Type': 'application/json' }
        }).catch(err => console.warn('Discovery skipped:', err));

        fetchLibraryStats();
    }, [fetchLibraryStats]);

    // NEW: Music Source State (simplified to local only)
    const [showDiskPopup, setShowDiskPopup] = useState(false);
    // Context for deletion
    const [itemToDelete, setItemToDelete] = useState(null); // { type: 'song'|'album'|'playlist', item }
    const [deleteFiles, setDeleteFiles] = useState(false);

    // Context for imports
    const importContext = useImportContext(activeTab);

    // Reuse disk connection helper
    const handleRetryDisk = async () => {
        const connected = await checkMusicDriveConnection();
        if (connected) {
            setShowDiskPopup(false);
            refreshAll();
        }
    };

    // Generic delete handler
    const handleDeleteClick = (type, item) => {
        setItemToDelete({ type, item });
        setDeleteFiles(false); // Reset checkbox
    };

    const confirmDelete = async () => {
        if (!itemToDelete) return;
        const { type, item } = itemToDelete;

        try {
            if (type === 'playlist') {
                await deletePlaylist(item.id);
            } else if (type === 'album') {
                await deleteAlbum(item.id, deleteFiles);
            } else if (type === 'song') {
                await deleteSong(item.id, deleteFiles);
            }
            refreshAll();
        } catch (err) {
            console.error('Delete failed:', err);
        } finally {
            setItemToDelete(null);
        }
    };

    const confirmArchive = async () => {
        if (!itemToDelete) return;
        const { type, item } = itemToDelete;
        // Only songs and albums can be archived (playlists are DB-only)
        if (type === 'playlist') {
            await deletePlaylist(item.id);
            setItemToDelete(null);
            refreshAll();
            return;
        }

        try {
            await archiveItem(item.id, type);
            refreshAll();
        } catch (err) {
            console.error('Archive failed:', err);
        } finally {
            setItemToDelete(null);
        }
    };

    // Filter albums/artists/playlists/singles by search
    const filteredArtists = (artists || []).filter(artist =>
        artist.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Group albums by name + artist to avoid "split" albums in the grid
    const processedAlbums = React.useMemo(() => {
        const groups = new Map();
        (albums || []).forEach(album => {
            const key = `${album.name?.toLowerCase()}|${album.artist?.name?.toLowerCase()}`;
            if (!groups.has(key)) {
                groups.set(key, album);
            }
        });
        return Array.from(groups.values());
    }, [albums]);

    // Build album folder-path lookup: normalized_folder -> album.id
    // Sorted LONGEST-FIRST so nested paths match before their parents
    // (e.g. /Music/Artist/Album matches before /Music/Artist)
    const albumFolderMap = React.useMemo(() => {
        const pairs = (albums || [])
            .filter(a => a.folder_path)
            .map(a => [a.folder_path.replace(/\/+$/, ''), a.id]);
        // Sort longest path first for correct prefix matching
        pairs.sort((a, b) => b[0].length - a[0].length);
        return new Map(pairs);
    }, [albums]);

    // Count songs per album from allSongs.
    // Handles both: songs with album_id set (normal) and songs with album_id = null
    // (scan race condition) by falling back to file_path prefix matching.
    const albumCounts = React.useMemo(() => {
        const counts = {};
        (allSongs || []).forEach(s => {
            if (s.album_id) {
                counts[s.album_id] = (counts[s.album_id] || 0) + 1;
            } else if (s.file_path) {
                // Fallback: match song to album by folder prefix
                for (const [folderPath, albumId] of albumFolderMap) {
                    if (s.file_path.startsWith(folderPath + '/') || s.file_path === folderPath) {
                        counts[albumId] = (counts[albumId] || 0) + 1;
                        break;
                    }
                }
            }
        });
        return counts;
    }, [allSongs, albumFolderMap]);

    const filteredAlbums = processedAlbums.filter(album => {
        // Prefer folder-based count (handles album_id = null songs) over DB song_count = 0
        const count = albumCounts[album.id] || album.song_count;
        // Albums with exactly 1 song belong in the Singles tab, not here
        return (count === undefined || count !== 1) &&
            (album.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                album.artist?.name?.toLowerCase().includes(searchQuery.toLowerCase()));
    });

    const filteredPlaylists = (playlists || []).filter(playlist =>
        playlist.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredSingles = React.useMemo(() => {
        // Build set of album folder prefixes (with trailing slash) for fast membership check
        const albumFolderPrefixes = Array.from(albumFolderMap.keys()).map(fp => fp + '/');

        // Real singles: songs with no album_id AND whose file_path doesn't belong to any album folder.
        // (Prevents all songs from appearing here when album_id = null due to scan bug.)
        const realSingles = (allSongs || []).filter(song => {
            if (song.album_id) return false; // belongs to an album → not a single
            if (!song.file_path) return true; // no path info → treat as single
            // If it starts with any album folder prefix, it's an album track, not a single
            return !albumFolderPrefixes.some(fp => song.file_path.startsWith(fp));
        });

        // Single-song albums — use processedAlbums (already deduplicated by name+artist)
        const seenAlbumIds = new Set();
        const albumSingles = (processedAlbums || [])
            .filter(a => {
                const count = albumCounts[a.id] || a.song_count;
                return count === 1;
            })
            .filter(a => {
                if (seenAlbumIds.has(a.id)) return false;
                seenAlbumIds.add(a.id);
                return true;
            })
            .map(a => ({
                id: a.id,
                title: a.name,
                artist: a.artist,
                album: a,
                isAlbumSingle: true,
                track_id: a.id,
                cover_url: a.cover_url,
                thumbnail_url: a.cover_url,
                actual_song_id: (allSongs || []).find(s =>
                    s.album_id === a.id ||
                    (s.file_path && a.folder_path && s.file_path.startsWith(a.folder_path.replace(/\/+$/, '') + '/'))
                )?.id
            }));

        // Deduplicate realSingles too (songs that also appear as album singles)
        const albumSingleSongIds = new Set(albumSingles.map(a => a.actual_song_id).filter(Boolean));
        const uniqueRealSingles = realSingles.filter(s => !albumSingleSongIds.has(s.id));

        const combined = [...uniqueRealSingles, ...albumSingles];
        return combined.filter(song =>
            song.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            song.artist?.name?.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [allSongs, processedAlbums, searchQuery, albumCounts, albumFolderMap]);

    // Load ALL songs on mount — needed for albumCounts used by both Albums and Singles tabs
    useEffect(() => {
        fetchAllSongs().then(results => setAllSongs(results || []));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Once on mount

    // Re-fetch allSongs whenever the album list changes (e.g. after a scan)
    // so album song counts and in-memory filtering stay in sync.
    const albumCount = albums?.length || 0;
    useEffect(() => {
        if (albumCount === 0) return;
        fetchAllSongs().then(results => setAllSongs(results || []));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [albumCount]);

    // Check Sync Status (Obsolete, route removed)
    const checkSyncStatus = useCallback(async () => {
        // Obsolete route, just set mismatch detected false
        setMismatchDetected(false);
    }, []);

    useEffect(() => {
        checkSyncStatus();

        // Periodically refresh drive status in background
        const interval = setInterval(() => {
            checkMusicDriveConnection();
        }, 15000);

        // Listen for drive mount events
        if (window.electron?.ipcRenderer) {
            const removeListener = window.electron.ipcRenderer.on('system:volume-change', (data) => {
                console.log('📦 Volume change event received:', data);
                if (data.isMounted && data.filename === 'RANTUNES') {
                    checkSyncStatus();
                    refreshAll();
                }
            });

            const removeCdListener = window.electron.ipcRenderer.on('system:cd-event', (data) => {
                console.log('📀 CD event received:', data);
                setIsCdMounted(data.isMounted);
                if (data.isMounted) setShowCDImport(true);
            });

            return () => {
                clearInterval(interval);
                removeListener();
                removeCdListener();
            };
        }
        return () => clearInterval(interval);
    }, [checkSyncStatus, checkMusicDriveConnection, refreshAll]);

    // Load songs when album/playlist is selected
    useEffect(() => {
        const loadSongs = async () => {
            if (selectedAlbum?.id) {
                if (selectedAlbum.isPlaylist) {
                    const songs = await fetchPlaylistSongs(selectedAlbum.id);
                    setCurrentAlbumSongs(songs);
                } else if (selectedAlbum.isArtist) {
                    const songs = await fetchArtistSongs(selectedAlbum.id);
                    setCurrentAlbumSongs(songs);
                } else {
                    // Try to match songs from the already-loaded allSongs first.
                    // This works regardless of whether album_id FK links are set in the DB.
                    const fromMemory = (allSongs || []).filter(s => {
                        const albumArtist = s.album_artist || s.artist_name || 'Unknown Artist';
                        const isSameAlbum = s.album_name === selectedAlbum.name && albumArtist === selectedAlbum.artist_name;
                        if (isSameAlbum) return true;
                        
                        const folderPath = selectedAlbum.folder_path?.replace(/\/+$/, '');
                        if (folderPath && s.file_path) {
                            return s.file_path.startsWith(folderPath + '/') || s.file_path === folderPath;
                        }
                        return false;
                    }).sort((a, b) => {
                        const trackSort = (a.track_number || 0) - (b.track_number || 0);
                        if (trackSort !== 0) return trackSort;
                        return (a.title || '').localeCompare(b.title || '', 'he');
                    });

                    if (fromMemory.length > 0) {
                        // Found songs in memory — use them immediately (no network needed)
                        setCurrentAlbumSongs(fromMemory);
                    } else {
                        // Fallback: fetch from backend (e.g. allSongs not yet loaded)
                        const songs = await fetchAlbumSongs(selectedAlbum.id);
                        setCurrentAlbumSongs(songs);
                    }
                }
            }
        };
        loadSongs();
    }, [selectedAlbum, allSongs, fetchAlbumSongs, fetchPlaylistSongs, fetchArtistSongs]);

    // Handle artist click
    const handleArtistClick = async (artist) => {
        setSelectedAlbum({ ...artist, isArtist: true });
    };

    // Handle album click - just view songs, don't play
    const handleAlbumClick = async (album) => {
        setSelectedAlbum({ ...album, isPlaylist: false, isArtist: false });
        // Songs will be loaded by effect
    };

    // Handle playlist click
    const handlePlaylistClick = async (playlist) => {
        setSelectedAlbum({ ...playlist, isPlaylist: true, artist: { name: 'פלייליסט חכם' } });
        // Songs will be loaded by effect
    };

    // Handle album play - play all songs
    const handleAlbumPlay = async (album, mode = 'last') => {
        const songs = await fetchAlbumSongs(album.id);
        const playable = (songs || []).filter(s => (s?.myRating || 0) !== 1);
        if (playable.length > 0) {
            addPlaylistToQueue(playable, mode);
        }
    };

    // Handle playlist play - Shuffles and plays immediately
    const handlePlaylistPlay = async (playlist, mode = 'last') => {
        const songs = await fetchPlaylistSongs(playlist.id);
        const playable = (songs || []).filter(s => (s?.myRating || 0) !== 1);
        if (playable.length > 0) {
            const shuffled = [...playable].map(s => ({ ...s, playlist_id: playlist.id }));
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            playSong(shuffled[0], shuffled, true);
        }
    };

    // Handle playlist song click - plays selected song first, followed by the rest of the playlist songs shuffled
    const handlePlaylistSongClick = async (clickedSong) => {
        if (!selectedAlbum) return;
        
        const songs = await fetchPlaylistSongs(selectedAlbum.id);
        const playable = (songs || []).filter(s => (s?.myRating || 0) !== 1);
        
        if (playable.length > 0) {
            // Map songs to have the playlist_id
            const mapped = playable.map(s => ({ ...s, playlist_id: selectedAlbum.id }));
            
            // Separate the clicked song from the rest
            const clickedSongWithId = mapped.find(s => s.id === clickedSong.id) || { ...clickedSong, playlist_id: selectedAlbum.id };
            const rest = mapped.filter(s => s.id !== clickedSong.id);
            
            // Shuffle the rest of the songs
            for (let i = rest.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [rest[i], rest[j]] = [rest[j], rest[i]];
            }
            
            // Combine: clicked song first, then shuffled rest
            const finalQueue = [clickedSongWithId, ...rest];
            
            // Play immediately starting from clickedSong
            playSong(finalQueue[0], finalQueue, true);
        }
    };

    // Edit song handlers
    const handleEditClick = async (song) => {
        setEditingSong(song);
        setEditTitle(song.title || '');
        setEditArtistName(song.artist?.name || song.artist || '');
        
        // Pre-select BpmType based on current song bpm
        if (song.bpm && song.bpm > 100) {
            setEditBpmType('upbeat');
        } else {
            setEditBpmType('chill');
        }
        
        // Fetch which playlist the song is in
        setEditPlaylistId('');
        try {
            const playlistId = await fetchSongPlaylistId(song.id);
            if (playlistId) {
                setEditPlaylistId(playlistId);
            }
        } catch (err) {
            console.error('Error fetching song playlist:', err);
        }
    };

    const handleSaveEdit = async () => {
        if (!editingSong) return;
        setIsSavingEdit(true);
        try {
            const bpmValue = editBpmType === 'chill' ? 80 : 120;
            const res = await updateSongDetails(editingSong.id, editTitle, editArtistName, editPlaylistId, bpmValue);
            if (res.success) {
                // Instantly update the current context queue and playing song
                updateSongInContext({ id: editingSong.id, title: editTitle, artist: { name: editArtistName }, playlist_id: editPlaylistId, bpm: bpmValue });
                
                // If the selected item is the current playlist/album being viewed, reload its songs!
                if (selectedAlbum) {
                    if (selectedAlbum.isPlaylist) {
                        const updatedSongs = await fetchPlaylistSongs(selectedAlbum.id);
                        setCurrentAlbumSongs(updatedSongs);
                    } else if (selectedAlbum.isArtist) {
                        // TODO: Artist songs might not have a direct fetcher yet, fallback
                        const updatedSongs = await fetchAlbumSongs(selectedAlbum.id);
                        setCurrentAlbumSongs(updatedSongs);
                    } else {
                        const updatedSongs = await fetchAlbumSongs(selectedAlbum.id);
                        setCurrentAlbumSongs(updatedSongs);
                    }
                }
                setEditingSong(null);
            } else {
                alert(`שגיאה בעדכון השיר: ${res.message}`);
            }
        } catch (err) {
            console.error('Error saving song edit:', err);
            alert(`שגיאה בעדכון השיר: ${err.message}`);
        } finally {
            setIsSavingEdit(false);
        }
    };

    // Filter songs by BPM tempo selection
    const filterSongs = (songList) => {
        if (!songList) return [];
        if (bpmFilter === 'chill') {
            return songList.filter(s => s.bpm && s.bpm <= 100);
        }
        if (bpmFilter === 'upbeat') {
            return songList.filter(s => s.bpm && s.bpm > 100);
        }
        return songList;
    };

    // Handle add to queue selection
    const handleQueueSelect = async (mode) => {
        if (!queueContext) return;

        if (queueContext.type === 'album') {
            handleAlbumPlay(queueContext.item, mode);
        } else {
            let item = queueContext.item;
            // If it's a "Single" that's actually an album with 1 song, fetch the song object
            if (item.isAlbumSingle) {
                const songs = await fetchAlbumSongs(item.id);
                if (songs?.[0]) {
                    item = songs[0];
                }
            }
            addToQueue(item, mode);
        }
        setQueueContext(null);
    };

    // Handle back from album view
    const handleBack = () => {
        setSelectedAlbum(null);
        setCurrentAlbumSongs([]);
        setQueueContext(null);
    };

    // Handle exit
    const handleExit = () => {
        navigate('/mode-selection');
    };

    // Handle song play - Immediate play (User request: "Click plays immediately")
    const handleSongPlay = async (song) => {
        if ((song?.myRating || 0) === 1) return;

        let songToPlay = song;
        // If this is a single-song album wrapper, we need the actual song file path
        if (song.isAlbumSingle) {
            // Priority 1: Use the pre-calculated song ID if available
            if (song.actual_song_id && allSongs) {
                const found = allSongs.find(s => s.id === song.actual_song_id);
                if (found) {
                    playSong(found, [found], true);
                    return;
                }
            }

            try {
                const songs = await fetchAlbumSongs(song.id);
                if (songs && songs.length > 0) {
                    songToPlay = songs[0];
                }
            } catch (err) {
                console.error("Failed to fetch song for album single:", err);
                return;
            }
        }

        // When playing a song from context of an album or playlist, pass the full song list
        let queueSongs;
        if (currentAlbumSongs.length > 0) {
            const filteredDetailSongs = filterSongs(currentAlbumSongs).filter(s => (s?.myRating || 0) !== 1);
            if (selectedAlbum?.isPlaylist) {
                // Shuffle playlist songs except the clicked one
                const rest = filteredDetailSongs.filter(s => s.id !== songToPlay.id);
                for (let i = rest.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [rest[i], rest[j]] = [rest[j], rest[i]];
                }
                queueSongs = [songToPlay, ...rest];
            } else {
                queueSongs = filteredDetailSongs;
            }
        } else {
            queueSongs = [songToPlay];
        }
        playSong(songToPlay, queueSongs, true);
    };

    // Handle rating
    const handleRate = async (songId, rating) => {
        // Find the song to get current rating
        const songToUpdate = currentAlbumSongs.find(s => s.id === songId) ||
            favoriteSongs.find(s => s.id === songId) ||
            allSongs.find(s => s.id === songId);

        const currentRating = songToUpdate?.myRating || 0;

        // Toggle logic: if same rating, set to 0 (remove)
        const finalRating = currentRating === rating ? 0 : rating;

        console.log('🎵 handleRate toggle:', { songId, current: currentRating, requested: rating, final: finalRating });

        const ok = await rateSong(songId, finalRating);
        if (!ok) return;

        // Optimistic UI update
        setCurrentAlbumSongs(prev => prev.map(s => s.id === songId ? { ...s, myRating: finalRating } : s));
        setAllSongs(prev => prev.map(s => s.id === songId ? { ...s, myRating: finalRating } : s));
        setFavoriteSongs(prev => {
            const exists = prev.some(s => s.id === songId);
            if (finalRating === 5) {
                if (exists) return prev.map(s => s.id === songId ? { ...s, myRating: 5 } : s);
                const src = currentAlbumSongs.find(s => s.id === songId) || allSongs.find(s => s.id === songId);
                return src ? [{ ...src, myRating: 5 }, ...prev] : prev;
            }
            if (finalRating === 1 || finalRating === 0) {
                // remove from favorites if disliked or removed
                return prev.filter(s => s.id !== songId);
            }
            return prev;
        });

        // Refresh from server after a short delay
        setTimeout(async () => {
            try {
                if (selectedAlbum) {
                    if (selectedAlbum.isPlaylist) {
                        const songs = await fetchPlaylistSongs(selectedAlbum.id);
                        setCurrentAlbumSongs(songs);
                    } else {
                        // Prefer in-memory allSongs to avoid 0-song issue from DB album_id = null
                        const fromMem = (allSongs || []).filter(s => {
                            const albumArtist = s.album_artist || s.artist_name || 'Unknown Artist';
                            const isSameAlbum = s.album_name === selectedAlbum.name && albumArtist === selectedAlbum.artist_name;
                            if (isSameAlbum) return true;
                            
                            const fp = selectedAlbum.folder_path?.replace(/\/+$/, '');
                            if (fp && s.file_path) {
                                return s.file_path.startsWith(fp + '/') || s.file_path === fp;
                            }
                            return false;
                        }).sort((a, b) => (a.track_number || 0) - (b.track_number || 0));
                        if (fromMem.length > 0) {
                            setCurrentAlbumSongs(fromMem);
                        } else {
                            const songs = await fetchAlbumSongs(selectedAlbum.id);
                            setCurrentAlbumSongs(songs);
                        }
                    }
                }
                // Refresh favorites if we're on that tab
                if (activeTab === 'favorites') {
                    await loadFavorites();
                }
            } catch (err) {
                console.error('Error refreshing after rating:', err);
            }
        }, 500);
    };



    // Load favorites
    const loadFavorites = useCallback(async () => {
        const songs = await fetchFavoritesSongs();
        setFavoriteSongs(songs || []);
    }, [fetchFavoritesSongs]);

    // Load favorites when opening the favorites tab
    useEffect(() => {
        if (activeTab === 'favorites') loadFavorites();
    }, [activeTab, loadFavorites]);

    // Sync active queue with database songs when new ones are added or deleted
    useEffect(() => {
        const isPlayingThisPlaylist = selectedAlbum?.isPlaylist && playlist.length > 0 && playlist.some(s => s.playlist_id === selectedAlbum.id);
        
        if (selectedAlbum?.isPlaylist && isPlayingThisPlaylist && currentAlbumSongs.length > 0) {
            // 1. Filter out songs in the active queue that no longer exist in the DB playlist
            const filteredQueue = playlist.filter(qSong => 
                currentAlbumSongs.some(dbSong => dbSong.id === qSong.id)
            );

            // 2. Find songs in the DB playlist that are missing from the active queue
            const missingSongs = currentAlbumSongs.filter(dbSong => 
                !filteredQueue.some(qSong => qSong.id === dbSong.id)
            );

            // If there's any mismatch, update the active queue
            if (missingSongs.length > 0 || filteredQueue.length !== playlist.length) {
                const updatedQueue = [...filteredQueue, ...missingSongs];
                console.log('🔄 Syncing active queue with database playlist songs. Added:', missingSongs.length, 'Removed:', playlist.length - filteredQueue.length);
                
                const timer = setTimeout(() => {
                    handleReorder(updatedQueue);
                }, 50);
                return () => clearTimeout(timer);
            }
        }
    }, [currentAlbumSongs, selectedAlbum, playlist, handleReorder]);

    // Get songs to display (current album or playlist)
    const displaySongs = currentAlbumSongs.length > 0 ? currentAlbumSongs : playlist;

    return (
        <div className="h-screen overflow-hidden music-gradient-dark flex flex-col" dir="rtl">
            {/* Unified Header - Dark Mode Forced */}
            <UnifiedHeader
                title="מוזיקה"
                subtitle="ניהול ספריית מוזיקה ופלייליסטים"
                onHome={() => navigate('/mode-selection')}
                forceMusicDark={true}
                showMusicPlayer={false}
                className="music-header"
                rightContent={
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => navigate('/')}
                            className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all"
                        >
                            <Home className="w-5 h-5 text-white/70" />
                        </button>



                        {/* Library Tools / Edit Actions */}
                        {isEditMode ? (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleBulkDelete}
                                    disabled={selectedItems.length === 0}
                                    className={`flex items-center gap-2 px-4 h-10 rounded-2xl font-bold text-xs transition-all active:scale-95
                                        ${selectedItems.length > 0 ? 'bg-red-500 text-white shadow-lg' : 'bg-white/5 text-white/30 cursor-not-allowed border border-white/10'}`}
                                >
                                    <Trash2 className="w-4 h-4" />
                                    <span>מחק {selectedItems.length}</span>
                                </button>
                                <button
                                    onClick={() => {
                                        setIsEditMode(false);
                                        setSelectedItems([]);
                                    }}
                                    className="px-4 h-10 rounded-2xl bg-white/10 text-white font-bold text-xs hover:bg-white/20 border border-white/10 transition-all active:scale-95"
                                >
                                    ביטול
                                </button>
                            </div>
                        ) : (
                            isManager && (
                                <button
                                    onClick={() => setIsEditMode(true)}
                                    className="flex items-center gap-2 px-4 h-10 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 font-bold text-xs hover:bg-indigo-500/30 transition-all active:scale-95 shadow-sm"
                                >
                                    <List className="w-4 h-4" />
                                    <span>עריכה</span>
                                </button>
                            )
                        )}

                        {!isEditMode && (
                            <>
                                {isCdMounted && (
                                    <button
                                        onClick={() => setShowCDImport(true)}
                                        className="w-10 h-10 rounded-2xl bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/30 flex items-center justify-center animate-pulse"
                                        title="דיסק פיזי זוהה"
                                    >
                                        <Disc className="w-4 h-4 text-blue-400" />
                                    </button>
                                )}



                                <button
                                    onClick={() => setShowScanner(true)}
                                    className="w-10 h-10 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-all active:scale-95 shadow-sm"
                                    title="סרוק ספרייה"
                                >
                                    <FolderOpen className="w-4 h-4 text-white/70" />
                                </button>

                                <button
                                    onClick={refreshAll}
                                    className={`w-10 h-10 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-all active:scale-95 shadow-sm
                                            ${isLoading ? 'animate-spin' : ''}`}
                                    title="רענן"
                                >
                                    <RefreshCw className="w-4 h-4 text-white/70" />
                                </button>
                            </>
                        )}
                    </div>
                }
            />

            {/* Sync Notification Banner */}
            <AnimatePresence>
                {mismatchDetected && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="bg-purple-600 overflow-hidden"
                    >
                        <div className="max-w-7xl mx-auto px-6 py-2 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                                <RefreshCw className="w-4 h-4 text-white animate-pulse" />
                                <span className="text-white text-sm font-bold">
                                    זוהה פער בספרייה: {pendingSyncCount} שירים ממתינים לסינכרון לדיסק RANTUNES
                                </span>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setShowSyncOverlay(true)}
                                    className="px-4 py-1 bg-white text-purple-600 rounded-lg text-xs font-bold hover:bg-white/90 transition-colors"
                                >
                                    סינכרון כעת
                                </button>
                                <button
                                    onClick={() => setMismatchDetected(false)}
                                    className="p-1 hover:bg-black/10 rounded-full transition-colors"
                                >
                                    <X className="w-4 h-4 text-white/70" />
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="music-split-layout flex-1 flex overflow-hidden">
                {/* Right side - Vinyl Turntable or Queue */}
                <div
                    className={`music-split-right order-last flex flex-col items-center justify-center p-6 relative transition-all duration-300
                        ${isMobile ? (isPlayerExpanded ? 'mobile-expanded' : 'mobile-collapsed') : ''}`}
                    onClick={() => {
                        if (isMobile && !isPlayerExpanded) {
                            setIsPlayerExpanded(true);
                        }
                    }}
                >
                    {/* Chevron down collapse button shown ONLY in mobile-expanded state */}
                    {isMobile && isPlayerExpanded && (
                        <div 
                            className="absolute top-0 left-0 right-0 w-full h-16 flex flex-col items-center justify-start pt-4 z-50 cursor-pointer"
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsPlayerExpanded(false);
                            }}
                        >
                            <div className="w-12 h-1.5 bg-white/30 rounded-full mb-2" />
                            <ChevronDown className="w-5 h-5 text-white/50" />
                        </div>
                    )}

                    {/* Vinyl Turntable is always rendered so it doesn't unmount */}
                    <div className="flex flex-col items-center justify-center w-full vinyl-container">
                        <VinylTurntable
                            song={currentSong}
                            isPlaying={isPlaying}
                            albumArt={currentSong?.album?.cover_url || currentSong?.cover_url || currentSong?.thumbnail_url}
                            onTogglePlay={(forcePlayFirst) => {
                                if (forcePlayFirst && playlist.length > 0 && !currentSong) {
                                    playSong(playlist[0], null, true);
                                } else {
                                    togglePlay();
                                }
                            }}
                            queue={playlist}
                        />

                        {/* Player controls (hidden on mobile-collapsed via CSS/JS) */}
                        <div className="flex flex-col items-center w-full max-w-sm mt-8 vinyl-info">
                            {/* Progress & Time - Always show if we have a song OR a queue */}
                            {(currentSong || playlist.length > 0) && (
                                <>
                                    <div className="w-full flex items-center gap-3 mb-6 px-4" dir="ltr">
                                        <span className="text-white/40 text-xs w-10 text-right font-mono">
                                            {Math.floor(currentTime / 60)}:{(Math.floor(currentTime % 60)).toString().padStart(2, '0')}
                                        </span>

                                        {/* Interactive Progress Bar */}
                                        <div
                                            className="relative flex-1 h-6 group cursor-pointer flex items-center"
                                            onClick={(e) => {
                                                if (!duration) return;
                                                const rect = e.currentTarget.getBoundingClientRect();
                                                const percent = (e.clientX - rect.left) / rect.width;
                                                seek(Math.min(Math.max(0, percent), 1) * duration);
                                            }}
                                        >
                                            {/* Background Track */}
                                            <div className="absolute w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                                                {/* Progress Fill */}
                                                <motion.div
                                                    className="h-full bg-gradient-to-r from-purple-500 to-indigo-500"
                                                    style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                                                    layoutId="progressBar"
                                                />
                                            </div>

                                            {/* Scrubber Knob */}
                                            <motion.div
                                                className="absolute w-3 h-3 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                                style={{ left: `${(currentTime / (duration || 1)) * 100}%`, transform: 'translateX(-50%)' }}
                                            />
                                        </div>

                                        <span className="text-white/40 text-xs w-10 font-mono">
                                            {Math.floor(duration / 60)}:{(Math.floor(duration % 60)).toString().padStart(2, '0')}
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-center gap-6 animate-fade-in w-full" dir="ltr">
                                        {/* Previous Button */}
                                        <button
                                            onClick={handlePrevious}
                                            disabled={!currentSong && playlist.length === 0}
                                            className="w-14 h-14 rounded-full music-glass flex items-center justify-center hover:scale-110 transition-transform border border-white/10 disabled:opacity-50"
                                            title="שיר קודם"
                                        >
                                            <SkipBack className="w-6 h-6 text-white" />
                                        </button>

                                        {/* Play/Pause Button */}
                                        <button
                                            onClick={() => {
                                                if (!currentSong && playlist.length > 0) {
                                                    playSong(playlist[0], null, true);
                                                } else {
                                                    togglePlay();
                                                }
                                            }}
                                            className="w-20 h-20 rounded-full music-gradient-purple flex items-center justify-center shadow-2xl hover:scale-105 transition-transform border border-white/20"
                                            title={isPlaying ? "השהה" : "נגן"}
                                        >
                                            {isPlaying ? (
                                                <Pause className="w-9 h-9 text-white fill-current" />
                                            ) : (
                                                <Play className="w-9 h-9 text-white fill-current" />
                                            )}
                                        </button>

                                        {/* Next Button */}
                                        <button
                                            onClick={handleNext}
                                            disabled={!currentSong && playlist.length === 0}
                                            className="w-14 h-14 rounded-full music-glass flex items-center justify-center hover:scale-110 transition-transform border border-white/10 disabled:opacity-50"
                                            title="שיר הבא"
                                        >
                                            <SkipForward className="w-6 h-6 text-white" />
                                        </button>
                                    </div>

                                    {/* Volume Control */}
                                    <div className="flex items-center gap-3 mt-8 w-full px-4" dir="ltr">
                                        <VolumeX className="w-4 h-4 text-white/40 cursor-pointer hover:text-white" onClick={() => setVolume(0)} />
                                        <input
                                            type="range"
                                            min="0"
                                            max="1"
                                            step="0.01"
                                            value={volume}
                                            onChange={(e) => setVolume(parseFloat(e.target.value))}
                                            className="flex-1 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-purple-500"
                                        />
                                        <Volume2 className="w-4 h-4 text-white/40 cursor-pointer hover:text-white" onClick={() => setVolume(1)} />
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Inline Collapsed Mobile Bar Elements (shown ONLY when collapsed on mobile) */}
                    {isMobile && !isPlayerExpanded && (
                        <div className="absolute top-0 left-0 right-0 h-[72px] flex items-center justify-between w-full px-4 cursor-pointer select-none bg-[#1c1c1e]">
                            {/* Progress bar line */}
                            <div className="absolute top-0 left-0 right-0 h-1 bg-white/10">
                                <div 
                                    className="h-full bg-gradient-to-r from-purple-500 to-indigo-500" 
                                    style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                                />
                            </div>

                            <div className="flex-1 flex items-center min-w-0 pl-1 pr-3" dir="rtl">
                                <div className="min-w-0 text-right w-full">
                                    <p className="text-white text-sm font-bold truncate leading-tight">
                                        {currentSong?.title}
                                    </p>
                                    <p className="text-white/60 text-xs truncate leading-tight mt-0.5 uppercase tracking-wider">
                                        {currentSong?.artist?.name || currentSong?.artist_name || 'Unknown Artist'}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()} dir="ltr">
                                {/* Play/Pause */}
                                <button
                                    onClick={togglePlay}
                                    className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center border border-white/10 active:scale-95 transition-all"
                                >
                                    {isPlaying ? (
                                        <Pause className="w-4 h-4 text-white fill-current" />
                                    ) : (
                                        <Play className="w-4 h-4 text-white fill-current ml-0.5" />
                                    )}
                                </button>

                                {/* Volume Controller */}
                                <div className="flex items-center bg-white/10 rounded-full px-2 py-1.5">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const currentVol = Math.round((volume || 1) * 10);
                                            if (currentVol > 1) setVolume((currentVol - 1) / 10);
                                        }}
                                        className="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center transition-all text-white/70 hover:text-white"
                                    >
                                        <Minus className="w-4 h-4" />
                                    </button>
                                    <span className="w-6 text-center text-sm font-bold text-white select-none">
                                        {Math.round((volume || 1) * 10)}
                                    </span>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const currentVol = Math.round((volume || 1) * 10);
                                            if (currentVol < 10) setVolume((currentVol + 1) / 10);
                                        }}
                                        className="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center transition-all text-white/70 hover:text-white"
                                    >
                                        <Plus className="w-4 h-4" />
                                    </button>
                                </div>

                                {/* Next */}
                                <button
                                    onClick={handleNext}
                                    className="w-10 h-10 rounded-full bg-transparent hover:bg-white/10 flex items-center justify-center transition-all text-white/70 hover:text-white active:scale-95"
                                >
                                    <SkipForward className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Left side - Song list / Albums */}
                <div className="music-split-left flex-1 flex flex-col overflow-hidden">
                    {error && String(error).includes('Missing Supabase Credentials') && (
                        <div className="p-4">
                            <div className="music-glass rounded-2xl p-4 border border-red-500/30">
                                <p className="text-white font-bold mb-1">שרת המוזיקה לא מוגדר</p>
                                <p className="text-white/60 text-sm">
                                    חסרים משתני סביבה בשרת: <span className="font-mono">SUPABASE_URL</span> ו-<span className="font-mono">SUPABASE_SERVICE_KEY</span>.
                                    בלי זה לא ניתן לשמור/לקרוא את ספריית המוזיקה.
                                </p>
                            </div>
                        </div>
                    )}

                    {selectedAlbum ? (
                        /* Selected album - FIXED HEADER + SCROLLABLE LIST */
                        <div className="flex-1 flex flex-col overflow-hidden">
                            {/* STICKY ALBUM HEADER */}
                            <div className="p-6 pb-4 bg-black/40 backdrop-blur-xl border-b border-white/10 z-20 shrink-0">
                                <div className="flex items-center gap-5">
                                    <button
                                        onClick={handleBack}
                                        className="w-12 h-12 rounded-2xl music-glass flex items-center justify-center border border-white/10 hover:bg-white/10 transition-all active:scale-95"
                                    >
                                        <ArrowRight className="w-6 h-6 text-white" />
                                    </button>
                                    <div className="flex flex-col flex-1 min-w-0">
                                        <div className="flex items-center gap-4 mb-1">
                                            <h2 className="text-white text-4xl font-black tracking-tight truncate drop-shadow-lg" dir="ltr" style={{ textAlign: 'right' }}>{selectedAlbum.name}</h2>
                                            <button
                                                onClick={async () => {
                                                    const songs = selectedAlbum.isPlaylist
                                                        ? await fetchPlaylistSongs(selectedAlbum.id)
                                                        : await fetchAlbumSongs(selectedAlbum.id);
                                                    const playable = (songs || []).filter(s => (s?.myRating || 0) !== 1);
                                                    if (playable.length > 0) {
                                                        let queueSongs = [...playable];
                                                        if (selectedAlbum.isPlaylist) {
                                                            // Map to include playlist_id for auto-reshuffling
                                                            queueSongs = queueSongs.map(s => ({ ...s, playlist_id: selectedAlbum.id }));
                                                            // Shuffle playlist songs
                                                            queueSongs.sort(() => Math.random() - 0.5);
                                                        } else {
                                                            // Sort album songs by track number
                                                            queueSongs.sort((a, b) => (a.track_number || 0) - (b.track_number || 0));
                                                        }
                                                        playSong(queueSongs[0], queueSongs, true);
                                                    }
                                                }}
                                                className="group relative animate-fade-in animate-duration-300"
                                                title="נגן הכל"
                                            >
                                                <div className="absolute inset-0 bg-purple-500/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                                                <div className="relative w-11 h-11 rounded-2xl bg-purple-600 border border-purple-500 flex items-center justify-center transition-all group-hover:scale-110 group-active:scale-95 shadow-2xl">
                                                    <Play className="w-6 h-6 text-white fill-current" />
                                                </div>
                                            </button>
                                        </div>
                                        <div className="flex items-center justify-between mt-1">
                                            <p className="text-white/60 font-bold">
                                                {selectedAlbum.isPlaylist ? (
                                                    `${currentAlbumSongs.length} שירים`
                                                ) : (
                                                    `${selectedAlbum.artist?.name} • ${currentAlbumSongs.length} שירים`
                                                )}
                                            </p>
                                            
                                            {/* BPM Filter Pills */}
                                            <div className="flex items-center gap-2 select-none" dir="rtl">
                                                <span className="text-white/40 text-[10px] font-bold ml-1">סינון קצב:</span>
                                                <button
                                                    onClick={() => setBpmFilter('all')}
                                                    className={`px-2.5 py-0.5 text-[10px] rounded-full border transition-all ${bpmFilter === 'all' ? 'bg-purple-600 border-purple-500 text-white' : 'border-white/10 bg-white/5 text-white/60 hover:text-white'}`}
                                                >
                                                    הכל
                                                </button>
                                                <button
                                                    onClick={() => setBpmFilter('chill')}
                                                    className={`px-2.5 py-0.5 text-[10px] rounded-full border transition-all ${bpmFilter === 'chill' ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-white/10 bg-white/5 text-white/60 hover:text-white'}`}
                                                >
                                                    שקטים
                                                </button>
                                                <button
                                                    onClick={() => setBpmFilter('upbeat')}
                                                    className={`px-2.5 py-0.5 text-[10px] rounded-full border transition-all ${bpmFilter === 'upbeat' ? 'bg-pink-600 border-pink-500 text-white' : 'border-white/10 bg-white/5 text-white/60 hover:text-white'}`}
                                                >
                                                    קצביים
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* SCROLLABLE SONG LIST */}
                            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto music-scrollbar p-4">
                                <div className="space-y-1">
                                    {(() => {
                                        const filteredSongs = filterSongs(currentAlbumSongs);
                                        const isQueueViewActive = selectedAlbum && playlist.length > 0 && (
                                            (selectedAlbum.isPlaylist && playlist.some(s => s.playlist_id === selectedAlbum.id)) ||
                                            (!selectedAlbum.isPlaylist && playlist.some(s => s.album_name === selectedAlbum.name))
                                        );

                                        if (isQueueViewActive) {
                                            return (
                                                <div className="flex flex-col animate-fade-in">
                                                    {/* Currently playing song */}
                                                    {playlist[0] && (
                                                        <div className="mb-2" ref={activeSongRef}>
                                                            <div className="text-purple-300 text-[10px] font-black uppercase tracking-[0.2em] mb-2 pr-2 flex items-center gap-2">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                                                                מתנגן כעת
                                                            </div>
                                                            <SongRow
                                                                song={playlist[0]}
                                                                isCurrentSong={true}
                                                                isPlaying={isPlaying}
                                                                onEdit={handleEditClick}
                                                                isDraggable={false}
                                                            />
                                                        </div>
                                                    )}

                                                    {/* Upcoming tracks */}
                                                    {playlist.length > 1 && (
                                                        <div className="mt-2">
                                                            <div className="text-white/20 text-[10px] font-black uppercase tracking-[0.2em] mb-2 pr-2">
                                                                הבאים בתור ({playlist.length - 1})
                                                            </div>
                                                            <Reorder.Group
                                                                axis="y"
                                                                values={playlist.slice(1)}
                                                                onReorder={(newUpcoming) => {
                                                                    handleReorder([playlist[0], ...newUpcoming]);
                                                                }}
                                                                className="space-y-1"
                                                            >
                                                                {playlist.slice(1).map((song, sIdx) => (
                                                                    <ReorderableSongRow
                                                                        key={song.id || song.track_id || `upcoming-${sIdx}`}
                                                                        song={song}
                                                                        isCurrentSong={false}
                                                                        isPlaying={false}
                                                                        onPlay={handleEditClick}
                                                                    />
                                                                ))}
                                                            </Reorder.Group>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        }

                                        // Static display of album/playlist songs
                                        if (selectedAlbum?.isPlaylist) {
                                            return (
                                                <Reorder.Group
                                                    axis="y"
                                                    values={currentAlbumSongs}
                                                    onReorder={async (newSongsOrder) => {
                                                        setCurrentAlbumSongs(newSongsOrder);
                                                        await reorderPlaylistSongs(selectedAlbum.id, newSongsOrder);
                                                    }}
                                                    className="space-y-1"
                                                >
                                                    {currentAlbumSongs.map((song, index) => (
                                                        <ReorderableSongRow
                                                            key={song.id || `playlist-song-${index}`}
                                                            song={song}
                                                            isCurrentSong={currentSong?.id === song.id}
                                                            isPlaying={isPlaying && currentSong?.id === song.id}
                                                            onPlay={handleEditClick}
                                                        />
                                                    ))}
                                                </Reorder.Group>
                                            );
                                        }

                                        const sortedSongs = [...filteredSongs].sort((a, b) => {
                                            if (selectedAlbum?.isPlaylist) {
                                                return (a.position || 0) - (b.position || 0);
                                            }
                                            const trackDiff = (a.track_number || 0) - (b.track_number || 0);
                                            if (trackDiff !== 0) return trackDiff;
                                            return (a.title || '').localeCompare(b.title || '', 'he');
                                        });
                                        return sortedSongs.map((song) => (
                                            <SongRow
                                                key={song.id}
                                                song={song}
                                                isPlaying={isPlaying && currentSong?.id === song.id}
                                                isCurrentSong={currentSong?.id === song.id}
                                                onEdit={handleEditClick}
                                            />
                                        ));
                                    })()}
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* Main landing area (Playlists Grid by default, or Search Results) */
                        <div className="flex-1 flex flex-col overflow-hidden">
                            {/* Tab Navigation */}
                            <div className="px-6 pt-6 pb-2 shrink-0">
                                <nav className="flex items-center gap-2">
                                    {TABS.map(tab => {
                                        const Icon = tab.icon;
                                        return (
                                            <button
                                                key={tab.id}
                                                onClick={() => {
                                                    setActiveTab(tab.id);
                                                    setSearchQuery('');
                                                }}
                                                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all
                                                    ${activeTab === tab.id
                                                        ? 'bg-purple-600 text-white shadow-lg'
                                                        : 'text-white/60 hover:text-white hover:bg-white/10'}`}
                                            >
                                                <Icon className="w-4 h-4" />
                                                <span className="font-medium text-sm">{tab.label}</span>
                                            </button>
                                        );
                                    })}
                                </nav>
                            </div>

                            <div className="flex-1 overflow-y-auto music-scrollbar p-6 pt-2">
                                {searchQuery.trim() !== '' ? (
                                    /* Search Results of all songs */
                                    <div className="space-y-1">
                                        <div className="text-white/40 text-xs font-bold mb-4 pr-2">תוצאות חיפוש:</div>
                                        {(() => {
                                            const searchedSongs = allSongs.filter(song =>
                                                song.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                                song.artist?.name?.toLowerCase().includes(searchQuery.toLowerCase())
                                            );
                                            const sortedSearchedSongs = [...searchedSongs].sort((a, b) => (a.title || '').localeCompare(b.title || '', 'he'));
                                            if (sortedSearchedSongs.length === 0) {
                                                return <div className="text-white/40 text-sm pr-2">לא נמצאו שירים התואמים את החיפוש</div>;
                                            }
                                            return filterSongs(sortedSearchedSongs).map((song) => (
                                                <SongRow
                                                    key={song.id}
                                                    song={song}
                                                    isPlaying={isPlaying && currentSong?.id === song.id}
                                                    isCurrentSong={currentSong?.id === song.id}
                                                    onEdit={handleEditClick}
                                                />
                                            ));
                                        })()}
                                    </div>
                                ) : activeTab === 'songs' ? (
                                    /* All songs list */
                                    <div className="space-y-1">
                                        <div className="text-white/40 text-xs font-bold mb-4 pr-2">כל השירים ({allSongs.length}):</div>
                                        {(() => {
                                            const sortedSongs = [...allSongs].sort((a, b) => (a.title || '').localeCompare(b.title || '', 'he'));
                                            if (sortedSongs.length === 0) {
                                                return <div className="text-white/40 text-sm pr-2">אין שירים בספרייה עדיין</div>;
                                            }

                                            const filteredAll = filterSongs(sortedSongs);
                                            const isSongActive = currentSong && filteredAll.some(s => s.id === currentSong.id);

                                            if (isSongActive) {
                                                const activeSong = filteredAll.find(s => s.id === currentSong.id);
                                                const otherSongs = filteredAll.filter(s => s.id !== currentSong.id);
                                                return (
                                                    <div className="flex flex-col">
                                                        <div className="mb-2">
                                                            <div className="text-purple-300 text-[10px] font-black uppercase tracking-[0.2em] mb-2 pr-2 flex items-center gap-2">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                                                                מתנגן כעת
                                                            </div>
                                                            <SongRow
                                                                song={activeSong}
                                                                isCurrentSong={true}
                                                                isPlaying={isPlaying}
                                                                onEdit={handleSongPlay}
                                                            />
                                                        </div>
                                                        {otherSongs.length > 0 && (
                                                            <div className="mt-2">
                                                                <div className="text-white/20 text-[10px] font-black uppercase tracking-[0.2em] mb-2 pr-2">
                                                                    שירים בספרייה ({otherSongs.length})
                                                                </div>
                                                                <div className="space-y-1">
                                                                    {otherSongs.map((song) => (
                                                                        <SongRow
                                                                            key={song.id}
                                                                            song={song}
                                                                            isPlaying={false}
                                                                            isCurrentSong={false}
                                                                            onEdit={handleSongPlay}
                                                                        />
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            }

                                            return filteredAll.map((song) => (
                                                <SongRow
                                                    key={song.id}
                                                    song={song}
                                                    isPlaying={isPlaying && currentSong?.id === song.id}
                                                    isCurrentSong={currentSong?.id === song.id}
                                                    onEdit={handleSongPlay}
                                                />
                                            ));
                                        })()}
                                    </div>
                                ) : activeTab === 'albums' ? (
                                    /* Albums Grid */
                                    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                                        {filteredAlbums.length === 0 ? (
                                            <div className="col-span-full text-center py-12">
                                                <Disc className="w-12 h-12 text-white/20 mx-auto mb-4" />
                                                <p className="text-white/40 text-sm">אין אלבומים בספרייה עדיין</p>
                                            </div>
                                        ) : (
                                            filteredAlbums.map(album => (
                                                <AlbumCard
                                                    key={album.id}
                                                    album={album}
                                                    onClick={handleAlbumClick}
                                                    onPlay={handleAlbumPlay}
                                                    onDelete={(item) => handleDeleteClick('album', item)}
                                                />
                                            ))
                                        )}
                                    </div>
                                ) : (
                                    /* Playlists Grid (default landing view) */
                                    (() => {
                                        const activePlaylistId = playlist[0]?.playlist_id;
                                        return (
                                    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">

                                        {filteredPlaylists.map(pl => {
                                            const isSelected = selectedItems.includes(pl.id);
                                            const isNowPlaying = activePlaylistId && activePlaylistId === pl.id && isPlaying;
                                            return (
                                                <motion.div
                                                    key={pl.id}
                                                    whileHover={!isEditMode ? { scale: 1.03 } : { scale: 1.01 }}
                                                    whileTap={{ scale: 0.98 }}
                                                    className={`rounded-2xl overflow-hidden group relative cursor-pointer transition-all
                                                        ${isNowPlaying ? 'ring-2 ring-purple-500 shadow-lg shadow-purple-500/20' : ''}
                                                        ${isEditMode && isSelected ? 'ring-4 ring-purple-500 opacity-100' : isEditMode ? 'opacity-60' : ''}`}
                                                    onClick={() => isEditMode ? toggleItemSelection(pl.id) : handlePlaylistClick(pl)}
                                                >
                                                    <div className="aspect-square bg-gradient-to-br from-purple-900 to-blue-900 flex items-center justify-center relative overflow-hidden w-full h-full">
                                                        <ListMusic className={`w-16 h-16 ${isNowPlaying ? 'text-white/10' : 'text-white/25'}`} />

                                                        {/* Now Playing Visualizer Overlay */}
                                                        {isNowPlaying && (
                                                            <div className="absolute inset-0 flex items-center justify-center z-10">
                                                                <div className="flex items-end gap-[3px] h-12">
                                                                    <span className="w-[4px] bg-purple-400 rounded-full animate-[musicBar1_1.2s_ease-in-out_infinite]" />
                                                                    <span className="w-[4px] bg-purple-300 rounded-full animate-[musicBar2_1.0s_ease-in-out_infinite]" />
                                                                    <span className="w-[4px] bg-indigo-400 rounded-full animate-[musicBar3_1.4s_ease-in-out_infinite]" />
                                                                    <span className="w-[4px] bg-purple-400 rounded-full animate-[musicBar4_0.9s_ease-in-out_infinite]" />
                                                                    <span className="w-[4px] bg-indigo-300 rounded-full animate-[musicBar5_1.1s_ease-in-out_infinite]" />
                                                                </div>
                                                            </div>
                                                        )}

                                                        {isEditMode && (
                                                            <div className={`absolute top-3 left-3 w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all z-20
                                                                ${isSelected ? 'bg-purple-500 border-white' : 'bg-black/20 border-white/30'}`}>
                                                                {isSelected && <div className="w-3 h-1.5 border-l-2 border-b-2 border-white -rotate-45 mt-[-2px]" />}
                                                            </div>
                                                        )}

                                                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-10 pb-2.5 px-3 z-10 text-right">
                                                            <h3 className="text-white font-bold text-sm truncate">{pl.name}</h3>
                                                            <p className={`text-xs ${isNowPlaying ? 'text-purple-300 font-bold' : 'text-white/60'}`}>
                                                                {isNowPlaying ? '♫ מתנגן כעת' : (pl.created_at ? new Date(pl.created_at).toLocaleDateString('he-IL') : 'פלייליסט')}
                                                            </p>
                                                        </div>

                                                    </div>
                                                </motion.div>
                                            );
                                        })}
                                    </div>
                                        );
                                    })()
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Popups & Overlays */}
                {/* Playlist builder modal */}
                {showPlaylistBuilder && (
                    <PlaylistBuilder
                        onClose={() => setShowPlaylistBuilder(false)}
                        onSuccess={() => {
                            setShowPlaylistBuilder(false);
                            fetchPlaylists();
                        }}
                    />
                )}

                {/* Directory scanner modal */}
                <AnimatePresence>
                    {showScanner && (
                        <DirectoryScanner
                            isOpen={showScanner}
                            onClose={() => setShowScanner(false)}
                            onScan={scanMusicDirectory}
                            isDriveConnected={isMusicDriveConnected}
                        />
                    )}
                </AnimatePresence>

                {/* YouTube Ingest */}
                {showYouTubeIngest && (
                    <YouTubeIngest
                        initialVideo={selectedYoutubeVideo}
                        initialTracks={selectedBatch}
                        initialQuery={searchQuery}
                        context={importContext}
                        isManager={isManager}
                        onClose={() => {
                            setShowYouTubeIngest(false);
                            setSelectedYoutubeVideo(null);
                            setSelectedBatch(null);
                            setSearchQuery('');
                        }}
                        onSuccess={() => {
                            refreshAll();
                            checkSyncStatus();
                            setShowYouTubeIngest(false);
                            setSelectedBatch(null);
                        }}
                    />
                )}

                {/* CD Import Modal */}
                <CDImportModal
                    isOpen={showCDImport}
                    onClose={() => setShowCDImport(false)}
                    onSuccess={() => {
                        refreshAll();
                        checkSyncStatus();
                    }}
                />

                {/* Queue Selection Modal */}
                <QueueModeModal
                    isOpen={!!queueContext}
                    onClose={() => setQueueContext(null)}
                    onSelect={handleQueueSelect}
                    title={queueContext?.type === 'album' ? selectedAlbum?.name : (queueContext?.item?.title)}
                />

                {/* Sync Overlay */}
                <AnimatePresence>
                    {showSyncOverlay && (
                        <SyncOverlay
                            isOpen={showSyncOverlay}
                            onClose={() => setShowSyncOverlay(false)}
                            onSyncComplete={() => {
                                refreshAll();
                                checkSyncStatus();
                            }}
                        />
                    )}
                </AnimatePresence>



                {/* Disk Not Connected Popup */}
                <AnimatePresence>
                    {showDiskPopup && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                            onClick={() => setShowDiskPopup(false)}
                        >
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.9, opacity: 0 }}
                                className="music-glass rounded-3xl p-8 max-w-md w-full border border-white/20 shadow-2xl"
                                onClick={e => e.stopPropagation()}
                            >
                                <div className="text-center">
                                    <div className="w-20 h-20 rounded-full bg-amber-500/20 mb-6 flex items-center justify-center mx-auto">
                                        <AlertCircle className="w-10 h-10 text-amber-400" />
                                    </div>
                                    <h3 className="text-white text-2xl font-bold mb-3">כונן לא מחובר</h3>
                                    <p className="text-white/60 mb-8">
                                        לא הצלחנו לזהות את כונן המוזיקה.
                                        <br />
                                        וודא שהכונן מחובר כראוי ונסה שוב.
                                    </p>

                                    <div className="flex gap-3 justify-center">
                                        <button
                                            onClick={handleRetryDisk}
                                            className="px-8 py-3 music-gradient-purple hover:opacity-90 rounded-xl text-white font-bold transition-all flex items-center gap-2"
                                        >
                                            <RefreshCw className="w-5 h-5" />
                                            נסה שוב
                                        </button>
                                        <button
                                            onClick={() => setShowDiskPopup(false)}
                                            className="px-8 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-white font-medium transition-colors"
                                        >
                                            ביטול
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
                {/* Edit Song Modal */}
                {editingSong && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4" dir="rtl">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="w-full max-w-md bg-zinc-900/90 border border-white/10 rounded-3xl p-6 shadow-2xl relative"
                        >
                            <button
                                onClick={() => setEditingSong(null)}
                                className="absolute top-4 left-4 p-2 text-white/40 hover:text-white rounded-full bg-white/5 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>

                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center border border-purple-500/30 text-purple-400">
                                    <Edit2 className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-white font-black text-xl">עריכת פרטי שיר</h3>
                                    <p className="text-white/40 text-xs">שנה את השם, האמן או שיוך הפלייליסט</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-white/60 text-sm font-medium mb-1.5">שם השיר</label>
                                    <input
                                        type="text"
                                        value={editTitle}
                                        onChange={(e) => setEditTitle(e.target.value)}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
                                        placeholder="שם השיר"
                                    />
                                </div>

                                <div>
                                    <label className="block text-white/60 text-sm font-medium mb-1.5">שם האמן</label>
                                    <input
                                        type="text"
                                        value={editArtistName}
                                        onChange={(e) => setEditArtistName(e.target.value)}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
                                        placeholder="שם האמן"
                                    />
                                </div>

                                <div>
                                    <label className="block text-white/60 text-sm font-medium mb-1.5">קצב / סגנון השיר</label>
                                    <select
                                        value={editBpmType}
                                        onChange={(e) => setEditBpmType(e.target.value)}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
                                    >
                                        <option value="chill">שקט / רגוע (Chill - עד 100 BPM)</option>
                                        <option value="upbeat">קצבי / מהיר (Upbeat - מעל 100 BPM)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-white/60 text-sm font-medium mb-1.5">שיוך לרשימת השמעה (פלייליסט)</label>
                                    <select
                                        value={editPlaylistId}
                                        onChange={(e) => setEditPlaylistId(e.target.value)}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
                                    >
                                        <option value="">ללא פלייליסט (שירים בלבד)</option>
                                        {playlists && playlists.map(pl => (
                                            <option key={pl.id} value={pl.id}>
                                                {pl.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="flex flex-col gap-3 mt-8">
                                <div className="flex gap-3 w-full">
                                    <button
                                        onClick={handleSaveEdit}
                                        disabled={isSavingEdit || !editTitle.trim() || !editArtistName.trim()}
                                        className="flex-1 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-purple-900/30"
                                    >
                                        {isSavingEdit ? (
                                            <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                        ) : (
                                            <span>שמור שינויים</span>
                                        )}
                                    </button>
                                    <button
                                        onClick={() => setEditingSong(null)}
                                        className="px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 font-bold border border-white/10 transition-all"
                                    >
                                        ביטול
                                    </button>
                                </div>
                                
                                <button
                                    onClick={() => {
                                        setEditingSong(null);
                                        handleDeleteClick('song', editingSong);
                                    }}
                                    className="w-full py-3 rounded-xl bg-red-500/10 hover:bg-red-500 hover:text-white text-red-400 font-bold border border-red-500/20 transition-all flex items-center justify-center gap-2"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    <span>מחק שיר לצמיתות</span>
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}

                {/* Delete Confirmation Dialog */}
                <AnimatePresence>
                    {itemToDelete && (
                        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={() => setItemToDelete(null)}>
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.9, opacity: 0 }}
                                className="bg-[#1e1e2e] rounded-3xl p-8 max-w-md w-full border border-white/10 shadow-2xl"
                                onClick={e => e.stopPropagation()}
                                dir="rtl"
                            >
                                <div className="text-center">
                                    <div className="w-20 h-20 rounded-full bg-red-500/10 mb-6 flex items-center justify-center mx-auto">
                                        <Trash2 className="w-10 h-10 text-red-500" />
                                    </div>
                                    <h3 className="text-white text-2xl font-bold mb-3">אישור מחיקה</h3>
                                    <p className="text-white/60 mb-6">
                                        האם אתה בטוח שברצונך למחוק את {itemToDelete.type === 'album' ? 'האלבום' : itemToDelete.type === 'playlist' ? 'הפלייליסט' : 'השיר'}
                                        <br />
                                        <span className="text-white font-bold">"{itemToDelete.item.name || itemToDelete.item.title}"</span>?
                                    </p>

                                    {(itemToDelete.type === 'album' || itemToDelete.type === 'song') && (
                                        <div className="bg-white/5 p-4 rounded-2xl mb-8 flex items-center justify-between cursor-pointer hover:bg-white/10 transition-colors"
                                            onClick={() => setDeleteFiles(!deleteFiles)}>
                                            <div className="text-right">
                                                <p className="text-white font-medium text-sm">מחק גם קבצים פיזיים מהדיסק</p>
                                                <p className="text-white/40 text-xs text-red-400/80">אזהרה: פעולה זו לא ניתנת לביטול</p>
                                            </div>
                                            <div className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${deleteFiles ? 'bg-red-600 border-red-600' : 'border-white/20'}`}>
                                                {deleteFiles && <Check className="w-4 h-4 text-white" />}
                                            </div>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-3 mb-3">
                                        <button
                                            onClick={confirmArchive}
                                            className="py-3 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-xl text-purple-400 font-bold transition-all flex flex-col items-center justify-center p-2"
                                        >
                                            <Archive className="w-5 h-5 mb-1" />
                                            <span className="text-xs">העבר לארכיון SSD</span>
                                        </button>
                                        <button
                                            onClick={confirmDelete}
                                            className="py-3 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 rounded-xl text-red-400 font-bold transition-all flex flex-col items-center justify-center p-2"
                                        >
                                            <Trash2 className="w-5 h-5 mb-1" />
                                            <span className="text-xs">מחק לצמיתות</span>
                                        </button>
                                    </div>
                                    <button
                                        onClick={() => setItemToDelete(null)}
                                        className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl text-white/50 text-sm font-medium transition-colors"
                                    >
                                        ביטול
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </div >
    );
};

// Export without wrapper
const MusicPage = () => {
    return <MusicPageContent />;
};

export default MusicPage;