import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Download, Music, Youtube, Loader2, Check, X, ArrowRight, ChevronRight, Cloud, CloudOff, AlertTriangle, List, Disc, Play } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import UnifiedHeader from '@/components/UnifiedHeader';
import { getBackendApiUrl } from '@/utils/apiUtils';

const MUSIC_API_URL = getBackendApiUrl();

/**
 * YouTube Download Page — Standalone at /youtube
 * Full flow: Search → Select → Download → Auto-register to DB
 */
const YouTubePage = () => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();

    // Search state
    const [query, setQuery] = useState('');
    const [searchType, setSearchType] = useState('all'); // all, song, album, playlist
    const [results, setResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [searchError, setSearchError] = useState(null);
    const [quota, setQuota] = useState(null);

    // Playlist drill-down
    const [selectedPlaylist, setSelectedPlaylist] = useState(null);
    const [playlistItems, setPlaylistItems] = useState([]);
    const [selectedItems, setSelectedItems] = useState(new Set());
    const [isLoadingPlaylist, setIsLoadingPlaylist] = useState(false);

    // Download state
    const [downloadQueue, setDownloadQueue] = useState([]);
    const [downloadProgress, setDownloadProgress] = useState(null); // { current, total, title, status }
    const [completedDownloads, setCompletedDownloads] = useState([]);
    const [failedDownloads, setFailedDownloads] = useState([]);
    const [isDownloading, setIsDownloading] = useState(false);

    // Manager pin verification
    const [showPinVerify, setShowPinVerify] = useState(false);
    const [pinEntry, setPinEntry] = useState('');
    const [isVerifyingPin, setIsVerifyingPin] = useState(false);
    const [pendingDownloadAction, setPendingDownloadAction] = useState(null);
    const [pinError, setPinError] = useState(null);

    const accessLevel = (currentUser?.access_level || '').toLowerCase();
    const role = (currentUser?.role || '').toLowerCase();
    const isManager = role === 'admin' || role === 'manager' || role === 'owner' ||
        accessLevel === 'admin' || accessLevel === 'manager' || accessLevel === 'owner' ||
        currentUser?.is_admin || currentUser?.is_super_admin;

    // Fetch YouTube quota on mount
    useEffect(() => {
        fetchQuota();
    }, []);

    const fetchQuota = async () => {
        try {
            const res = await fetch(`${MUSIC_API_URL}/music/youtube/quota`);
            if (res.ok) {
                const data = await res.json();
                setQuota(data);
            }
        } catch (err) { }
    };

    // Search with debounce
    useEffect(() => {
        const timer = setTimeout(() => {
            if (query.length > 2) handleSearch();
        }, 600);
        return () => clearTimeout(timer);
    }, [query]);

    const handleSearch = async () => {
        if (!query.trim()) return;
        setIsSearching(true);
        setSearchError(null);
        setSelectedPlaylist(null);
        setPlaylistItems([]);
        try {
            const res = await fetch(`${MUSIC_API_URL}/music/youtube/search?q=${encodeURIComponent(query)}`);
            const data = await res.json();
            setResults(data.results || []);
            fetchQuota();
        } catch (err) {
            setSearchError('שגיאה בחיפוש');
        } finally {
            setIsSearching(false);
        }
    };

    // Filter results by type
    const filteredResults = searchType === 'all'
        ? results
        : results.filter(r => {
            if (searchType === 'playlist') return r.type === 'playlist';
            return r.type !== 'playlist';
        });

    // Playlist drill-down
    const handleViewPlaylist = async (playlist) => {
        setIsLoadingPlaylist(true);
        setSelectedPlaylist(playlist);
        setSelectedItems(new Set());
        try {
            const res = await fetch(`${MUSIC_API_URL}/music/youtube/playlist-items?playlistId=${playlist.id}`);
            const data = await res.json();
            const items = data.results || [];
            setPlaylistItems(items);
            setSelectedItems(new Set(items.map((_, i) => i)));
        } catch (err) {
            setSearchError('נכשל בטעינת הפלייליסט');
        } finally {
            setIsLoadingPlaylist(false);
        }
    };

    const handleBackFromPlaylist = () => {
        setSelectedPlaylist(null);
        setPlaylistItems([]);
        setSelectedItems(new Set());
    };

    const toggleItem = (index) => {
        setSelectedItems(prev => {
            const next = new Set(prev);
            if (next.has(index)) next.delete(index);
            else next.add(index);
            return next;
        });
    };

    const toggleAll = () => {
        if (selectedItems.size === playlistItems.length) {
            setSelectedItems(new Set());
        } else {
            setSelectedItems(new Set(playlistItems.map((_, i) => i)));
        }
    };

    // Download single track
    const handleDownloadSingle = async (track) => {
        const action = () => downloadTracks([track], null);
        if (!isManager) {
            setPendingDownloadAction(() => action);
            setShowPinVerify(true);
            return;
        }
        action();
    };

    // Download selected playlist items
    const handleDownloadSelected = () => {
        const selected = playlistItems.filter((_, i) => selectedItems.has(i));
        if (selected.length === 0) return;
        const albumName = selectedPlaylist?.title || 'YouTube Download';
        const action = () => downloadTracks(selected, albumName);
        if (!isManager) {
            setPendingDownloadAction(() => action);
            setShowPinVerify(true);
            return;
        }
        action();
    };

    // Core download function
    const downloadTracks = async (tracks, albumName) => {
        setIsDownloading(true);
        setDownloadQueue(tracks);
        setCompletedDownloads([]);
        setFailedDownloads([]);

        for (let i = 0; i < tracks.length; i++) {
            const track = tracks[i];
            setDownloadProgress({
                current: i + 1,
                total: tracks.length,
                title: track.title,
                status: 'downloading'
            });

            try {
                // Get metadata first
                let metadata = null;
                try {
                    const metaRes = await fetch(`${MUSIC_API_URL}/music/youtube/metadata?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${track.id}`)}`);
                    if (metaRes.ok) metadata = await metaRes.json();
                } catch (e) { }

                // Parse artist/title
                let artist = track.artist || metadata?.uploader || 'Unknown Artist';
                let title = track.title || metadata?.title || 'Unknown Title';
                if (title.includes(' - ')) {
                    const [p1, ...p2] = title.split(' - ');
                    artist = p1.trim();
                    title = p2.join(' - ').trim();
                }

                const downloadParams = {
                    url: `https://www.youtube.com/watch?v=${track.id}`,
                    title: title,
                    artist: artist,
                    album: albumName || 'Single',
                    thumbnail: track.thumbnail
                };

                const res = await fetch(`${MUSIC_API_URL}/music/youtube/download`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(downloadParams)
                });

                if (!res.ok) throw new Error('Download failed');
                const result = await res.json();

                setCompletedDownloads(prev => [...prev, { ...track, path: result.path }]);
            } catch (err) {
                console.error('Download failed:', err);
                setFailedDownloads(prev => [...prev, track]);
            }
        }

        setDownloadProgress({
            current: tracks.length,
            total: tracks.length,
            title: '',
            status: 'complete'
        });
        setIsDownloading(false);
    };

    // PIN verification
    const handleVerifyPin = async () => {
        setIsVerifyingPin(true);
        setPinError(null);
        try {
            const { data, error: rpcError } = await supabase.rpc('verify_manager_pin', { p_pin: pinEntry });
            if (rpcError) throw rpcError;
            if (data?.valid) {
                setShowPinVerify(false);
                setPinEntry('');
                if (pendingDownloadAction) {
                    pendingDownloadAction();
                    setPendingDownloadAction(null);
                }
            } else {
                setPinError('קוד שגוי או חסר הרשאות מנהל');
                setPinEntry('');
            }
        } catch (err) {
            setPinError('שגיאה באימות');
        } finally {
            setIsVerifyingPin(false);
        }
    };

    const SEARCH_TYPES = [
        { id: 'all', label: 'הכל', icon: Search },
        { id: 'song', label: 'שירים', icon: Music },
        { id: 'playlist', label: 'פלייליסטים', icon: List },
    ];

    return (
        <div className="h-screen overflow-hidden flex flex-col" dir="rtl" style={{ background: 'linear-gradient(145deg, #0f0f1a 0%, #1a1025 40%, #0d0d1a 100%)' }}>
            {/* Header */}
            <UnifiedHeader
                title="הורדות"
                onHome={() => navigate('/music')}
                forceMusicDark={true}
                showMusicPlayer={false}
                rightContent={
                    <div className="flex items-center gap-3">
                        {quota && (
                            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold ${quota.isExceeded ? 'text-slate-500 border-slate-600 bg-slate-800/50' : 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10'}`}>
                                {quota.isExceeded ? <CloudOff size={14} /> : <Cloud size={14} />}
                                <span>{quota.mode === 'yt-dlp' ? 'yt-dlp ✓' : `YouTube API: ${Math.round((quota.used / quota.limit) * 100)}%`}</span>
                            </div>
                        )}
                    </div>
                }
            />

            {/* Main Content */}
            <div className="flex-1 overflow-hidden flex flex-col max-w-5xl mx-auto w-full px-6 py-6 gap-5">

                {/* Search Section */}
                {!isDownloading && downloadProgress?.status !== 'complete' && (
                    <div className="space-y-4 shrink-0">
                        {/* Search Type Tabs */}
                        <div className="flex items-center gap-2">
                            {SEARCH_TYPES.map(t => (
                                <button
                                    key={t.id}
                                    onClick={() => setSearchType(t.id)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all
                                        ${searchType === t.id
                                            ? 'bg-red-600 text-white shadow-lg shadow-red-600/20'
                                            : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10 border border-white/10'}`}
                                >
                                    <t.icon size={16} />
                                    {t.label}
                                </button>
                            ))}
                        </div>

                        {/* Search Input */}
                        {!selectedPlaylist && (
                            <div className="relative group">
                                <div className="absolute inset-y-0 right-0 pr-5 flex items-center pointer-events-none">
                                    <Search className="w-5 h-5 text-white/30 group-focus-within:text-red-400 transition-colors" />
                                </div>
                                <input
                                    type="text"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                    placeholder="חפש שיר, אמן או פלייליסט ב-YouTube..."
                                    className="w-full bg-white/5 text-white pr-14 pl-5 py-4 rounded-2xl border border-white/10 
                                        focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20 focus:bg-white/8
                                        transition-all outline-none text-lg placeholder:text-white/30 backdrop-blur-sm"
                                    autoFocus
                                />
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center">
                                    <Youtube className="w-6 h-6 text-red-500/60" />
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Playlist Header */}
                {selectedPlaylist && !isDownloading && (
                    <div className="space-y-3 shrink-0">
                        <div className="flex items-center justify-between bg-white/5 p-4 rounded-2xl border border-white/10 backdrop-blur-sm">
                            <div className="flex items-center gap-4 overflow-hidden">
                                <button onClick={handleBackFromPlaylist} className="p-2.5 hover:bg-white/10 rounded-xl transition-colors text-white/60 hover:text-white">
                                    <ArrowRight size={20} />
                                </button>
                                <div className="min-w-0">
                                    <h3 className="text-white font-bold text-lg truncate" dir="ltr" style={{ textAlign: 'right' }}>{selectedPlaylist.title}</h3>
                                    <p className="text-sm text-white/40">פלייליסט • {playlistItems.length} שירים</p>
                                </div>
                            </div>
                            <img src={selectedPlaylist.thumbnail} className="w-14 h-14 rounded-xl object-cover flex-shrink-0 border border-white/10" alt="" />
                        </div>

                        {playlistItems.length > 0 && (
                            <div className="flex items-center justify-between px-2">
                                <button
                                    onClick={toggleAll}
                                    className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors"
                                >
                                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all
                                        ${selectedItems.size === playlistItems.length
                                            ? 'bg-red-500 border-red-500'
                                            : 'border-white/30 hover:border-white/60'}`}>
                                        {selectedItems.size === playlistItems.length && <Check size={12} className="text-white" />}
                                    </div>
                                    {selectedItems.size === playlistItems.length ? 'בטל הכל' : 'בחר הכל'}
                                </button>

                                <button
                                    onClick={handleDownloadSelected}
                                    disabled={selectedItems.size === 0}
                                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all
                                        ${selectedItems.size > 0
                                            ? 'bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white shadow-lg shadow-red-600/30'
                                            : 'bg-white/5 text-white/30 cursor-not-allowed border border-white/10'}`}
                                >
                                    <Download size={16} />
                                    הורד {selectedItems.size} שירים
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Results / Playlist Items */}
                {!isDownloading && downloadProgress?.status !== 'complete' && (
                    <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                        {isSearching || isLoadingPlaylist ? (
                            <div className="py-20 flex flex-col items-center justify-center text-white/30 gap-4">
                                <Loader2 className="animate-spin w-10 h-10 text-red-500" />
                                <p className="text-lg">טוען...</p>
                            </div>
                        ) : searchError ? (
                            <div className="py-20 flex flex-col items-center justify-center text-white/30 gap-3">
                                <AlertTriangle className="w-10 h-10 text-amber-500" />
                                <p>{searchError}</p>
                            </div>
                        ) : (
                            <AnimatePresence mode="popLayout">
                                {(selectedPlaylist ? playlistItems : filteredResults).map((item, idx) => (
                                    <motion.div
                                        key={`${item.id}-${idx}`}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.03 }}
                                        className={`p-3 rounded-xl flex items-center gap-4 cursor-pointer group transition-all border backdrop-blur-sm
                                            ${selectedPlaylist
                                                ? (selectedItems.has(idx)
                                                    ? 'bg-red-500/10 border-red-500/30 hover:bg-red-500/15'
                                                    : 'bg-white/3 border-white/5 hover:bg-white/5 opacity-50')
                                                : 'bg-white/3 hover:bg-white/8 border-white/5 hover:border-white/15'}`}
                                        onClick={() => {
                                            if (selectedPlaylist) {
                                                toggleItem(idx);
                                            } else if (item.type === 'playlist') {
                                                handleViewPlaylist(item);
                                            } else {
                                                handleDownloadSingle(item);
                                            }
                                        }}
                                    >
                                        {/* Checkbox for playlist items */}
                                        {selectedPlaylist && (
                                            <div className={`w-6 h-6 rounded-lg border flex items-center justify-center flex-shrink-0 transition-all
                                                ${selectedItems.has(idx)
                                                    ? 'bg-red-500 border-red-500'
                                                    : 'border-white/30'}`}>
                                                {selectedItems.has(idx) && <Check size={14} className="text-white" />}
                                            </div>
                                        )}

                                        {/* Thumbnail */}
                                        <div className="relative w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-white/5 shadow-inner">
                                            <img src={item.thumbnail} alt="" className="w-full h-full object-cover" />
                                            {item.source === 'YOUTUBE' && (
                                                <div className="absolute top-0.5 right-0.5 bg-red-600 text-white text-[7px] font-bold px-1 py-0.5 rounded-md">YT</div>
                                            )}
                                            {item.type === 'playlist' && (
                                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                                    <List size={18} className="text-white" />
                                                </div>
                                            )}
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-medium text-white truncate text-sm" dir="ltr" style={{ textAlign: 'right' }}>{item.title}</h4>
                                            <p className="text-xs text-white/40 truncate mt-0.5">{item.artist} {item.type === 'playlist' ? '• פלייליסט' : ''}</p>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            {!selectedPlaylist && item.type === 'playlist' ? (
                                                <button
                                                    className="h-9 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 text-xs border border-white/10 transition-colors flex items-center gap-1.5 font-medium"
                                                    onClick={(e) => { e.stopPropagation(); handleViewPlaylist(item); }}
                                                >
                                                    <ChevronRight size={14} />
                                                    הצג שירים
                                                </button>
                                            ) : !selectedPlaylist ? (
                                                <button
                                                    className="w-9 h-9 rounded-xl bg-white/5 hover:bg-red-500/20 text-white/40 hover:text-red-400 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                                                    onClick={(e) => { e.stopPropagation(); handleDownloadSingle(item); }}
                                                >
                                                    <Download size={16} />
                                                </button>
                                            ) : null}
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        )}

                        {/* Empty State */}
                        {!isSearching && !selectedPlaylist && results.length === 0 && query.length === 0 && (
                            <div className="py-20 flex flex-col items-center justify-center text-white/20 gap-4">
                                <Youtube className="w-16 h-16 text-red-500/30" />
                                <p className="text-xl font-medium">חפש מוזיקה ב-YouTube</p>
                                <p className="text-sm text-white/30">שירים, אלבומים, פלייליסטים</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Download Progress */}
                {(isDownloading || downloadProgress?.status === 'complete') && (
                    <div className="flex-1 flex flex-col items-center justify-center gap-6">
                        {isDownloading ? (
                            <>
                                <div className="relative w-32 h-32">
                                    <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                                        <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                                        <circle
                                            cx="50" cy="50" r="42" fill="none"
                                            stroke="url(#redGradient)" strokeWidth="8"
                                            strokeLinecap="round"
                                            strokeDasharray={264}
                                            strokeDashoffset={264 - (264 * (downloadProgress?.current || 0) / (downloadProgress?.total || 1))}
                                            className="transition-all duration-500"
                                        />
                                        <defs>
                                            <linearGradient id="redGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                                <stop offset="0%" stopColor="#ef4444" />
                                                <stop offset="100%" stopColor="#f97316" />
                                            </linearGradient>
                                        </defs>
                                    </svg>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        <span className="text-3xl font-black text-white">{downloadProgress?.current}</span>
                                        <span className="text-xs text-white/40">מתוך {downloadProgress?.total}</span>
                                    </div>
                                </div>

                                <div className="text-center space-y-2 max-w-md">
                                    <p className="text-white font-bold text-lg">מוריד...</p>
                                    <p className="text-white/50 text-sm truncate" dir="ltr">{downloadProgress?.title}</p>
                                </div>

                                {/* Completed list */}
                                {completedDownloads.length > 0 && (
                                    <div className="w-full max-w-md space-y-1 max-h-48 overflow-y-auto">
                                        {completedDownloads.map((d, i) => (
                                            <div key={i} className="flex items-center gap-3 p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20 text-xs">
                                                <Check size={14} className="text-emerald-400 flex-shrink-0" />
                                                <span className="text-white/70 truncate" dir="ltr">{d.title}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        ) : downloadProgress?.status === 'complete' && (
                            <motion.div
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="text-center space-y-6"
                            >
                                <div className="w-24 h-24 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto">
                                    <Check className="w-12 h-12 text-emerald-400" />
                                </div>
                                <div>
                                    <p className="text-white font-bold text-2xl mb-2">ההורדה הושלמה!</p>
                                    <p className="text-white/50">
                                        {completedDownloads.length} שירים הורדו בהצלחה
                                        {failedDownloads.length > 0 && ` • ${failedDownloads.length} נכשלו`}
                                    </p>
                                    <p className="text-white/30 text-sm mt-1">השירים נרשמו אוטומטית בספריה</p>
                                </div>
                                <div className="flex items-center gap-3 justify-center">
                                    <button
                                        onClick={() => {
                                            setDownloadProgress(null);
                                            setDownloadQueue([]);
                                            setCompletedDownloads([]);
                                            setFailedDownloads([]);
                                        }}
                                        className="px-6 py-3 bg-white/10 text-white rounded-xl font-bold hover:bg-white/20 transition-all border border-white/10"
                                    >
                                        הורד עוד
                                    </button>
                                    <button
                                        onClick={() => navigate('/music')}
                                        className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-bold hover:from-purple-500 hover:to-indigo-500 transition-all shadow-lg shadow-purple-600/30"
                                    >
                                        לספריית המוזיקה
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </div>
                )}
            </div>

            {/* PIN Verification Modal */}
            <AnimatePresence>
                {showPinVerify && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => { setShowPinVerify(false); setPinEntry(''); setPinError(null); }}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-slate-900 rounded-2xl p-8 w-full max-w-sm border border-white/10 shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h3 className="text-white text-xl font-bold mb-2 text-center">אימות מנהל</h3>
                            <p className="text-white/40 text-center text-sm mb-6">הכנס קוד מנהל כדי להוריד</p>
                            <input
                                type="password"
                                value={pinEntry}
                                onChange={(e) => setPinEntry(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleVerifyPin()}
                                placeholder="קוד מנהל"
                                className="w-full bg-white/5 text-white text-center text-2xl tracking-[0.5em] py-4 rounded-xl border border-white/10 focus:border-red-500/50 outline-none mb-4"
                                autoFocus
                            />
                            {pinError && <p className="text-red-400 text-center text-sm mb-4">{pinError}</p>}
                            <button
                                onClick={handleVerifyPin}
                                disabled={isVerifyingPin || !pinEntry}
                                className="w-full py-3 bg-red-600 text-white rounded-xl font-bold disabled:opacity-50 hover:bg-red-500 transition-all"
                            >
                                {isVerifyingPin ? <Loader2 className="animate-spin w-5 h-5 mx-auto" /> : 'אשר'}
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default YouTubePage;
