import React, { useState, useEffect } from 'react';
import { Download, Search, Music, Disc, User, Check, AlertCircle, Loader2, Link, X, List, Layers, Lock, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { getBackendApiUrl } from '@/utils/apiUtils';
import YouTubeSearch from './YouTubeSearch';

const YouTubeIngest = ({ onClose, onSuccess, initialVideo = null, initialQuery = '', initialTracks = null, context = null, isManager = false }) => {
    const [mode, setMode] = useState(initialVideo ? 'url' : 'search'); // search, url
    const [url, setUrl] = useState(initialVideo ? `https://www.youtube.com/watch?v=${initialVideo.id}` : '');
    const [step, setStep] = useState(initialVideo ? 'analyzing' : (initialTracks ? 'review_batch' : 'input')); // input, analyzing, review, review_batch, downloading, success, error, batch_downloading
    const [error, setError] = useState(null);
    const [quota, setQuota] = useState(null);
    const [pinEntry, setPinEntry] = useState('');
    const [isVerifyingPin, setIsVerifyingPin] = useState(false);
    const [pendingAction, setPendingAction] = useState(null); // { type: 'single'|'batch', data: any }
    const MUSIC_API_URL = getBackendApiUrl();

    // Single item metadata
    const [metadata, setMetadata] = useState({
        title: initialVideo?.title || '',
        artist: initialVideo?.artist || '',
        album: context?.type === 'album' && context?.collectionId ? context.label : (initialVideo?.album || (context?.type === 'album' ? 'Unknown Album' : 'Single')),
        thumbnail: initialVideo?.thumbnail || '',
        duration: initialVideo?.duration || 0
    });

    // Batch download state
    const [downloadQueue, setDownloadQueue] = useState([]);
    const [completedQueue, setCompletedQueue] = useState([]);
    const [currentBatchItem, setCurrentBatchItem] = useState(null);

    useEffect(() => {
        if (initialVideo) {
            handleAnalyze(`https://www.youtube.com/watch?v=${initialVideo.id}`);
        } else if (initialTracks) {
            setDownloadQueue(initialTracks);
            setStep('review_batch');
        }
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

    const handleAnalyze = async (targetUrl, existingMetadata = null) => {
        setStep('analyzing');
        setError(null);
        setUrl(targetUrl);

        try {
            // Check Quota
            if (quota?.isExceeded) {
                throw new Error('המכסה היומית של YouTube הסתיימה. נסה שוב מחר.');
            }

            let data;
            if (window.electron?.music?.getYoutubeMetadata) {
                data = await window.electron.music.getYoutubeMetadata(targetUrl);
            } else {
                const res = await fetch(`${MUSIC_API_URL}/music/youtube/metadata?url=${encodeURIComponent(targetUrl)}`);
                if (!res.ok) throw new Error(await res.text() || 'Failed to fetch metadata from server');
                data = await res.json();
            }

            // Basic heuristic to split Artist - Title if not provided
            let artist = existingMetadata?.artist || data.uploader || 'Unknown Artist';
            let title = existingMetadata?.title || data.title || 'Unknown Title';

            if (!existingMetadata && data.title && data.title.includes('-')) {
                const parts = data.title.split('-');
                if (parts.length >= 2) {
                    artist = parts[0].trim();
                    title = parts.slice(1).join('-').trim();
                }
            }

            setMetadata({
                title: title,
                artist: artist,
                album: metadata.album || 'Single',
                thumbnail: data.thumbnail || existingMetadata?.thumbnail,
                duration: data.duration
            });
            setStep('review');
            fetchQuota();
        } catch (err) {
            console.error('Analysis failed:', err);
            setError(err.message || 'Failed to analyze URL');
            setStep('input');
        }
    };

    const handleDownload = async () => {
        if (!isManager && step !== 'verifying_manager') {
            setPendingAction({ type: 'single' });
            setStep('verifying_manager');
            return;
        }

        setStep('downloading');
        setError(null);

        try {
            const downloadParams = {
                url: url,
                title: metadata.title,
                artist: metadata.artist,
                album: metadata.album,
                thumbnail: metadata.thumbnail
            };

            if (window.electron?.music?.downloadYoutube) {
                const result = await window.electron.music.downloadYoutube(downloadParams);
                if (result.success) {
                    // Registration happens in backend_server.js for electron
                    await fetch(`${MUSIC_API_URL}/music/library/register`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            ...downloadParams,
                            file_path: result.path,
                            duration: metadata.duration
                        })
                    });
                }
            } else {
                const res = await fetch(`${MUSIC_API_URL}/music/youtube/download`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(downloadParams)
                });
                if (!res.ok) throw new Error(await res.text() || 'Download failed');
            }

            setStep('success');
            if (onSuccess) onSuccess();
        } catch (err) {
            setError(err.message);
            setStep('review');
        }
    };

    const handleSearchSelect = (track, extras, batchContext) => {
        if (extras && extras.length > 0) {
            handleBatchPlay(track, extras, batchContext);
        } else {
            handleAnalyze(`https://www.youtube.com/watch?v=${track.id}`, track);
        }
    };

    const handleBatchPlay = (track, extras, batchContext) => {
        const all = [track, ...(extras || [])];
        startBatchDownload(all, batchContext);
    };

    // New: Handle Batch Downloads
    const startBatchDownload = async (tracks, batchContext) => {
        if (!isManager && step !== 'verifying_manager') {
            setPendingAction({ type: 'batch', data: { tracks, batchContext } });
            setStep('verifying_manager');
            return;
        }

        setStep('batch_downloading');
        setDownloadQueue(tracks);
        setCompletedQueue([]);

        // Process one by one
        for (let i = 0; i < tracks.length; i++) {
            const track = tracks[i];
            setCurrentBatchItem({ ...track, index: i + 1, total: tracks.length });

            try {
                const videoUrl = track.url || `https://www.youtube.com/watch?v=${track.id}`;

                let albumName = 'Single';
                if (batchContext?.type === 'playlist') {
                    albumName = batchContext.title;
                } else if (context?.type === 'album') {
                    albumName = context.label;
                }

                const downloadParams = {
                    url: videoUrl,
                    title: track.title,
                    artist: track.artist || 'YouTube Artist',
                    album: albumName,
                    thumbnail: track.thumbnail
                };

                if (window.electron?.music?.downloadYoutube) {
                    const result = await window.electron.music.downloadYoutube(downloadParams);
                    if (result.success) {
                        await fetch(`${MUSIC_API_URL}/music/library/register`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                ...downloadParams,
                                file_path: result.path,
                                duration: track.duration
                            })
                        });
                    }
                } else {
                    const res = await fetch(`${MUSIC_API_URL}/music/youtube/download`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(downloadParams)
                    });
                    if (!res.ok) throw new Error('Download failed');
                }

                setCompletedQueue(prev => [...prev, track.id]);
            } catch (err) {
                console.error('Batch item failed:', err);
            }
        }

        setStep('success');
        if (onSuccess) onSuccess();
    };

    const handleVerifyPin = async () => {
        setIsVerifyingPin(true);
        setError(null);
        try {
            const { data, error: rpcError } = await supabase.rpc('verify_manager_pin', { p_pin: pinEntry });

            if (rpcError) throw rpcError;

            if (data?.valid) {
                if (pendingAction?.type === 'single') {
                    handleDownload();
                } else if (pendingAction?.type === 'batch') {
                    startBatchDownload(pendingAction.data.tracks, pendingAction.data.batchContext);
                }
                setPendingAction(null);
                setPinEntry('');
            } else {
                setError('קוד שגוי או חסר הרשאות מנהל');
                setPinEntry('');
            }
        } catch (err) {
            console.error('PIN verification failed:', err);
            setError('שגיאה באימות הקוד');
        } finally {
            setIsVerifyingPin(false);
        }
    };

    const reset = () => {
        setUrl('');
        setMetadata({
            title: '',
            artist: '',
            album: context?.type === 'album' && context?.collectionId ? context.label : 'Single',
            thumbnail: '',
            duration: 0
        });
        setStep('input');
        setDownloadQueue([]);
        setCompletedQueue([]);
        setCurrentBatchItem(null);
        setPendingAction(null);
        setPinEntry('');
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-[#1e1e2e] rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl border border-white/10"
                dir="rtl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-gradient-to-l from-red-600/20 to-transparent">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center shadow-lg">
                            <Download className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">ייבוא מ-YouTube</h2>
                            <p className="text-xs text-white/50">הורד שירים ישירות לכונן ה-SSD</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
                        <X className="w-4 h-4 text-white/70" />
                    </button>
                </div>

                <div className="p-6">
                    {step === 'input' && (
                        <div className="flex flex-col h-[500px]">
                            <div className="flex gap-2 mb-6">
                                <button
                                    onClick={() => setMode('search')}
                                    className={`flex-1 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${mode === 'search' ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'bg-white/5 text-white/50 hover:bg-white/10'}`}
                                >
                                    <Search size={18} />
                                    חיפוש
                                </button>
                                <button
                                    onClick={() => setMode('url')}
                                    className={`flex-1 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${mode === 'url' ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'bg-white/5 text-white/50 hover:bg-white/10'}`}
                                >
                                    <Link size={18} />
                                    כתובת URL
                                </button>
                            </div>

                            {mode === 'url' ? (
                                <div className="space-y-4">
                                    <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                                        <label className="block text-xs font-bold text-white/40 mb-2 uppercase">כתובת סרטון או פלייליסט</label>
                                        <input
                                            type="text"
                                            value={url}
                                            onChange={(e) => setUrl(e.target.value)}
                                            placeholder="https://www.youtube.com/watch?v=..."
                                            className="w-full bg-transparent text-white text-lg font-medium outline-none"
                                        />
                                    </div>
                                    <button
                                        onClick={() => handleAnalyze(url)}
                                        disabled={!url || step === 'analyzing'}
                                        className="w-full bg-white text-black py-4 rounded-xl font-black text-lg shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                                    >
                                        {step === 'analyzing' ? 'מנתח...' : 'נתח כתובת'}
                                    </button>
                                </div>
                            ) : (
                                <div className="flex-1 overflow-hidden">
                                    <YouTubeSearch onPlayTrack={handleSearchSelect} />
                                </div>
                            )}
                        </div>
                    )}

                    {step === 'analyzing' && (
                        <div className="py-20 flex flex-col items-center justify-center gap-6">
                            <div className="relative">
                                <Loader2 className="w-16 h-16 text-red-600 animate-spin" />
                                <Search className="w-6 h-6 text-white absolute inset-0 m-auto" />
                            </div>
                            <div className="text-center">
                                <h3 className="text-xl font-bold text-white mb-2">מנתח את הקישור...</h3>
                                <p className="text-white/50">מושך מטא-דאטה מ-YouTube</p>
                            </div>
                        </div>
                    )}

                    {(step === 'review' || step === 'review_batch') && (
                        <div className="space-y-6">
                            {step === 'review' ? (
                                <div className="flex gap-4 p-4 bg-white/5 rounded-2xl border border-white/10">
                                    <img src={metadata.thumbnail} className="w-24 h-24 rounded-xl object-cover shadow-lg" alt="" />
                                    <div className="flex-1 min-w-0">
                                        <input
                                            defaultValue={metadata.title}
                                            onChange={(e) => setMetadata({ ...metadata, title: e.target.value })}
                                            className="w-full bg-transparent text-white font-bold text-lg outline-none border-b border-transparent focus:border-white/20 mb-1"
                                        />
                                        <input
                                            defaultValue={metadata.artist}
                                            onChange={(e) => setMetadata({ ...metadata, artist: e.target.value })}
                                            className="w-full bg-transparent text-white/70 font-medium outline-none border-b border-transparent focus:border-white/20 mb-3"
                                        />
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center gap-1.5 px-2 py-1 bg-white/10 rounded text-[10px] font-bold text-white/70 uppercase">
                                                <Disc size={10} />
                                                <input
                                                    defaultValue={metadata.album}
                                                    onChange={(e) => setMetadata({ ...metadata, album: e.target.value })}
                                                    className="bg-transparent outline-none w-24"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-white font-bold">ייבוא קבוצתי ({downloadQueue.length} שירים)</h3>
                                        <button onClick={reset} className="text-white/40 text-sm hover:text-white">שינוי בחירה</button>
                                    </div>
                                    <div className="max-h-60 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                                        {downloadQueue.map((t, idx) => (
                                            <div key={idx} className="flex items-center gap-3 p-2 bg-white/5 rounded-lg border border-white/5">
                                                <img src={t.thumbnail} className="w-10 h-10 rounded object-cover" alt="" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-white text-xs font-bold truncate">{t.title}</p>
                                                    <p className="text-white/40 text-[10px] truncate">{t.artist}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-3">
                                <button
                                    onClick={reset}
                                    className="flex-1 py-4 rounded-xl bg-white/10 text-white font-bold hover:bg-white/20 transition-all"
                                >
                                    ביטול
                                </button>
                                <button
                                    onClick={() => step === 'review' ? handleDownload() : startBatchDownload(downloadQueue)}
                                    className="flex-[2] py-4 rounded-xl bg-red-600 text-white font-black text-lg shadow-xl shadow-red-600/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                                >
                                    {step === 'review' ? 'הורד עכשיו' : `הורד ${downloadQueue.length} שירים`}
                                </button>
                            </div>
                        </div>
                    )}

                    {(step === 'downloading' || step === 'batch_downloading') && (
                        <div className="py-12 flex flex-col items-center">
                            <div className="relative w-32 h-32 mb-8">
                                <svg className="w-full h-full rotate-[-90deg]">
                                    <circle cx="64" cy="64" r="60" fill="transparent" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                                    <motion.circle
                                        cx="64" cy="64" r="60" fill="transparent" stroke="#dc2626" strokeWidth="8"
                                        strokeDasharray="377"
                                        animate={{ strokeDashoffset: step === 'batch_downloading' ? 377 - (377 * (completedQueue.length / downloadQueue.length)) : 100 }}
                                        transition={{ duration: 1 }}
                                    />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <Download className="w-8 h-8 text-white mb-1" />
                                    <span className="text-xl font-black text-white">
                                        {step === 'batch_downloading'
                                            ? `${Math.round((completedQueue.length / downloadQueue.length) * 100)}%`
                                            : '...'}
                                    </span>
                                </div>
                            </div>
                            <div className="text-center">
                                <h3 className="text-xl font-bold text-white mb-2">
                                    {step === 'batch_downloading' ? 'מוריד אלבום...' : 'מוריד שיר...'}
                                </h3>
                                <p className="text-white/50 text-sm max-w-[280px] mx-auto italic">
                                    {step === 'batch_downloading' ? currentBatchItem?.title : metadata.title}
                                </p>
                            </div>
                        </div>
                    )}

                    {step === 'verifying_manager' && (
                        <div className="py-8 space-y-6">
                            <div className="flex flex-col items-center gap-4 text-center">
                                <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center border border-amber-500/30">
                                    <Lock className="w-8 h-8 text-amber-500" />
                                </div>
                                <h3 className="text-xl font-bold text-white">אימות מנהל</h3>
                                <p className="text-white/50 text-sm">הזן קוד מנהל כדי לאשר את ההורדה</p>
                            </div>

                            <div className="flex flex-col gap-4">
                                <input
                                    type="password"
                                    value={pinEntry}
                                    onChange={(e) => setPinEntry(e.target.value)}
                                    placeholder="הזן קוד 4 ספרות"
                                    maxLength={4}
                                    autoFocus
                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-4 text-center text-2xl font-black tracking-[1em] text-white outline-none focus:border-amber-500/50 transition-all"
                                />
                                {error && <p className="text-red-400 text-sm text-center font-bold">{error}</p>}
                                <button
                                    onClick={handleVerifyPin}
                                    disabled={pinEntry.length < 4 || isVerifyingPin}
                                    className="w-full bg-amber-500 text-black py-4 rounded-xl font-black text-lg hover:scale-[1.02] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isVerifyingPin ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
                                    אמת והמשך
                                </button>
                                <button onClick={() => setStep('input')} className="text-white/30 text-sm hover:text-white">ביטול</button>
                            </div>
                        </div>
                    )}

                    {step === 'success' && (
                        <div className="py-16 text-center">
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/20"
                            >
                                <Check className="w-10 h-10 text-white" strokeWidth={3} />
                            </motion.div>
                            <h3 className="text-2xl font-black text-white mb-2">ההורדה הושלמה!</h3>
                            <p className="text-white/50 mb-8">השיר נוסף לספרייה שלך בהצלחה</p>
                            <button
                                onClick={onClose}
                                className="px-12 py-4 bg-white text-black rounded-xl font-black text-lg hover:scale-105 transition-all shadow-xl"
                            >
                                סגור
                            </button>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
};

export default YouTubeIngest;
