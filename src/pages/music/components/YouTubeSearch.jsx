import React, { useState, useEffect, useCallback } from 'react';
import { Search, Youtube, WifiOff, Loader2, Music, AlertTriangle, Cloud, CloudOff, Check, ChevronRight, Download, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { getBackendApiUrl } from '@/utils/apiUtils';

const YouTubeSearch = ({ onPlayTrack, initialQuery = '' }) => {
    const [query, setQuery] = useState(initialQuery);
    const [results, setResults] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [quota, setQuota] = useState(null);
    const [isOffline, setIsOffline] = useState(false);
    const [selectedPlaylist, setSelectedPlaylist] = useState(null);
    const [playlistItems, setPlaylistItems] = useState([]);
    // Multi-select for playlist items
    const [selectedItems, setSelectedItems] = useState(new Set());

    const MUSIC_API_URL = getBackendApiUrl();

    const handleViewPlaylist = async (playlist) => {
        setIsLoading(true);
        setSelectedPlaylist(playlist);
        setSelectedItems(new Set()); // reset selection
        try {
            const res = await fetch(`${MUSIC_API_URL}/music/youtube/playlist-items?playlistId=${playlist.id}`);
            const data = await res.json();
            const items = data.results || [];
            setPlaylistItems(items);
            // Auto-select all items
            setSelectedItems(new Set(items.map((_, i) => i)));
        } catch (err) {
            setError('נכשל בטעינת פלייליסט');
        } finally {
            setIsLoading(false);
        }
    };

    const handleBack = () => {
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

    const handleDownloadSelected = () => {
        // Download each selected item one by one via onPlayTrack
        const selected = playlistItems.filter((_, i) => selectedItems.has(i));
        if (selected.length === 0) return;

        // Pass all selected tracks; the parent (YouTubeIngest) will handle them
        const batchContext = {
            type: 'playlist',
            title: selectedPlaylist?.title || 'YouTube Download'
        };

        if (selected.length === 1) {
            onPlayTrack(selected[0], null, batchContext);
        } else {
            // Pass with a flag indicating batch
            onPlayTrack(selected[0], selected.slice(1), batchContext);
        }
    };

    // Existing effects
    useEffect(() => {
        const timer = setTimeout(() => {
            if (query.length > 2) {
                handleSearch();
            }
        }, 800);
        return () => clearTimeout(timer);
    }, [query]);

    useEffect(() => {
        fetchQuotaStatus();
        const interval = setInterval(fetchQuotaStatus, 60000);
        return () => clearInterval(interval);
    }, []);

    const fetchQuotaStatus = async () => {
        try {
            let status;
            if (window.electron?.youtube?.getQuotaStatus) status = await window.electron.youtube.getQuotaStatus();
            else {
                const res = await fetch(`${MUSIC_API_URL}/music/youtube/quota`);
                if (res.ok) status = await res.json();
            }
            if (status) {
                setQuota(status);
                setIsOffline(!!status.isExceeded);
            }
        } catch (err) { }
    };

    const handleSearch = async () => {
        if (!query.trim()) return;
        setIsLoading(true);
        setError(null);
        setSelectedPlaylist(null);
        try {
            let response;
            if (window.electron?.youtube?.search) response = await window.electron.youtube.search(query);
            else {
                const res = await fetch(`${MUSIC_API_URL}/music/youtube/search?q=${encodeURIComponent(query)}`);
                response = await res.json();
            }
            setResults(response.results || []);
            setIsOffline(!!response.offline);
            fetchQuotaStatus();
        } catch (err) {
            setError('שגיאה בחיפוש');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="w-full max-w-4xl mx-auto space-y-4">
            {/* Header / Search Bar */}
            {!selectedPlaylist && (
                <div className="relative">
                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                        <Search className={`w-5 h-5 ${isOffline ? 'text-slate-500' : 'text-slate-400'}`} />
                    </div>
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={isOffline ? "חיפוש מקומי בלבד..." : "חפש שיר, אמן או פלייליסט..."}
                        className={`w-full bg-slate-800/80 text-white pr-12 pl-4 py-4 rounded-xl border transition-all shadow-lg backdrop-blur-sm outline-none ${isOffline ? 'border-slate-700' : 'border-slate-700 focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20'
                            }`}
                    />
                    {quota && (
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center gap-2">
                            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs font-medium ${quota.isExceeded ? 'text-slate-500 border-slate-700' : 'text-emerald-400 border-emerald-500/20'
                                }`}>
                                {quota.isExceeded ? <CloudOff size={12} /> : <Cloud size={12} />}
                                <span>{Math.round((quota.used / quota.limit) * 100)}%</span>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Playlist View Header */}
            {selectedPlaylist && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between bg-slate-800/60 p-3 rounded-xl border border-slate-700">
                        <div className="flex items-center gap-3 overflow-hidden">
                            <button onClick={handleBack} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/60 hover:text-white">
                                <ArrowRight size={18} />
                            </button>
                            <div className="min-w-0">
                                <h3 className="text-white font-bold truncate">{selectedPlaylist.title}</h3>
                                <p className="text-xs text-slate-400">פלייליסט • {playlistItems.length} שירים</p>
                            </div>
                        </div>
                        <img src={selectedPlaylist.thumbnail} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" alt="" />
                    </div>

                    {/* Selection Controls */}
                    {playlistItems.length > 0 && (
                        <div className="flex items-center justify-between px-2">
                            <button
                                onClick={toggleAll}
                                className="flex items-center gap-2 text-xs text-white/60 hover:text-white transition-colors"
                            >
                                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all
                                    ${selectedItems.size === playlistItems.length
                                        ? 'bg-red-500 border-red-500'
                                        : 'border-white/30 hover:border-white/60'}`}
                                >
                                    {selectedItems.size === playlistItems.length && <Check size={12} />}
                                </div>
                                {selectedItems.size === playlistItems.length ? 'בטל הכל' : 'בחר הכל'}
                            </button>

                            <button
                                onClick={handleDownloadSelected}
                                disabled={selectedItems.size === 0}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                                    ${selectedItems.size > 0
                                        ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg'
                                        : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}
                            >
                                <Download size={14} />
                                הורד {selectedItems.size} שירים
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Results List */}
            <div className="space-y-1 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                {isLoading && (
                    <div className="py-12 flex flex-col items-center justify-center text-slate-500 gap-3">
                        <Loader2 className="animate-spin w-8 h-8 text-red-500" />
                        <p>טוען תוצאות...</p>
                    </div>
                )}

                <AnimatePresence mode="popLayout">
                    {(selectedPlaylist ? playlistItems : results).map((item, idx) => (
                        <motion.div
                            key={item.id + idx}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.03 }}
                            className={`p-2 rounded-lg flex items-center gap-3 cursor-pointer group transition-all border
                                ${selectedPlaylist
                                    ? (selectedItems.has(idx)
                                        ? 'bg-red-500/10 border-red-500/30 hover:bg-red-500/20'
                                        : 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-800/60 opacity-60')
                                    : 'bg-slate-800/40 hover:bg-slate-800/80 border-slate-700/50 hover:border-slate-500'}`}
                            onClick={() => {
                                if (selectedPlaylist) {
                                    toggleItem(idx);
                                } else if (item.type === 'playlist') {
                                    handleViewPlaylist(item);
                                } else {
                                    onPlayTrack(item);
                                }
                            }}
                        >
                            {/* Checkbox for playlist items */}
                            {selectedPlaylist && (
                                <div className={`w-6 h-6 rounded border flex items-center justify-center flex-shrink-0 transition-all
                                    ${selectedItems.has(idx)
                                        ? 'bg-red-500 border-red-500'
                                        : 'border-white/30'}`}
                                >
                                    {selectedItems.has(idx) && <Check size={14} className="text-white" />}
                                </div>
                            )}

                            <div className="relative w-12 h-12 rounded-md overflow-hidden flex-shrink-0 bg-slate-900 shadow-inner">
                                <img src={item.thumbnail} alt="" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-all" />
                                {item.source === 'YOUTUBE' && <div className="absolute top-0 right-0 bg-red-600 text-white text-[8px] px-1 rounded-bl">YT</div>}
                            </div>

                            <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-white truncate text-sm group-hover:text-red-400 transition-colors">{item.title}</h4>
                                <p className="text-[11px] text-slate-500 truncate">{item.artist} {item.type === 'playlist' ? '• פלייליסט' : ''}</p>
                            </div>

                            <div className="flex items-center gap-2">
                                {!selectedPlaylist && item.type === 'playlist' ? (
                                    <button
                                        className="h-8 px-3 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs border border-red-500/20 transition-colors flex items-center gap-1"
                                        onClick={(e) => { e.stopPropagation(); handleViewPlaylist(item); }}
                                    >
                                        <ChevronRight size={12} />
                                        הצג שירים
                                    </button>
                                ) : !selectedPlaylist ? (
                                    <button
                                        className="w-8 h-8 rounded-full bg-slate-700/50 hover:bg-red-500/20 text-slate-400 hover:text-red-400 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                                    >
                                        <Music size={14} />
                                    </button>
                                ) : null}
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default YouTubeSearch;
