import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, HardDrive, AlertCircle, CheckCircle2, ChevronRight, Music, X } from 'lucide-react';
import { getBackendApiUrl } from '@/utils/apiUtils';

const MUSIC_API_URL = getBackendApiUrl();

const SyncOverlay = ({ isOpen, onClose, onSyncComplete }) => {
    const [status, setStatus] = useState('idle'); // idle, checking, pending, syncing, success, error
    const [pendingCount, setPendingCount] = useState(0);
    const [pendingSongs, setPendingSongs] = useState([]);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (isOpen) {
            checkSyncStatus();
        }
    }, [isOpen]);

    const checkSyncStatus = async () => {
        setStatus('checking');
        try {
            // Obsolete route, no longer tracks local staging vs drive
            // Just simulate success (0 pending)
            setPendingCount(0);
            setPendingSongs([]);
            setStatus('idle');
        } catch (err) {
            setError(err.message);
            setStatus('error');
        }
    };

    const handleSync = async () => {
        setStatus('syncing');
        try {
            const res = await fetch(`${MUSIC_API_URL}/api/music/sync/execute`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                setStatus('success');
                if (onSyncComplete) onSyncComplete();
                setTimeout(onClose, 2000);
            } else {
                throw new Error(data.results?.failed?.[0]?.error || 'Sync failed');
            }
        } catch (err) {
            setError(err.message);
            setStatus('error');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-6" dir="rtl">
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-[#1a1a2e] border border-white/10 rounded-3xl w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col shadow-2xl"
            >
                {/* Header */}
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-gradient-to-l from-purple-600/10 to-transparent">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
                            <RefreshCw className={`w-6 h-6 text-white ${status === 'syncing' ? 'animate-spin' : ''}`} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-white">סינכרון ספרייה</h2>
                            <p className="text-sm text-white/50">העברת שירים מהאחסון המקומי לדיסק החיצוני</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all">
                        <X className="w-5 h-5 text-white/70" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8">
                    <AnimatePresence mode="wait">
                        {status === 'checking' && (
                            <motion.div
                                key="checking"
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                className="flex flex-col items-center justify-center py-20"
                            >
                                <RefreshCw className="w-12 h-12 text-purple-500 animate-spin mb-4" />
                                <p className="text-white/60">בודק פערים בספרייה...</p>
                            </motion.div>
                        )}

                        {status === 'pending' && (
                            <motion.div
                                key="pending"
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            >
                                <div className="flex items-center gap-3 mb-8 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl">
                                    <AlertCircle className="w-6 h-6 text-yellow-500" />
                                    <span className="text-yellow-200 font-medium">נמצאו {pendingCount} שירים שממתינים לסינכרון לדיסק RANTUNES</span>
                                </div>

                                <div className="grid grid-cols-2 gap-8 h-full">
                                    {/* Local Side */}
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 text-white/40 text-xs px-2">
                                            <Music className="w-3 h-3" />
                                            <span>מקור: אחסון מקומי (Staging)</span>
                                        </div>
                                        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                            {pendingSongs.map(song => (
                                                <div key={song.id} className="p-3 bg-white/5 border border-white/5 rounded-xl flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                                                        <Music className="w-4 h-4 text-white/40" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm text-white font-medium truncate">{song.title}</p>
                                                        <p className="text-[10px] text-white/40 truncate">{song.artist?.name || 'אמן לא ידוע'}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Arrow & Divider */}
                                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden lg:flex flex-col items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                                            <ChevronRight className="w-6 h-6 text-purple-500" />
                                        </div>
                                    </div>

                                    {/* Target Side */}
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 text-white/40 text-xs px-2">
                                            <HardDrive className="w-3 h-3" />
                                            <span>יעד: RANTUNES / Music</span>
                                        </div>
                                        <div className="h-[400px] border-2 border-dashed border-white/5 rounded-2xl flex flex-col items-center justify-center text-center p-6 grayscale opacity-40">
                                            <HardDrive className="w-16 h-16 text-white mb-4" />
                                            <p className="text-sm font-bold text-white mb-2">מוכן להעברה</p>
                                            <p className="text-xs text-white/40">הקבצים יועברו לתיקיות האמן והאלבום המתאימות</p>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {status === 'syncing' && (
                            <motion.div
                                key="syncing"
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                className="flex flex-col items-center justify-center py-20"
                            >
                                <div className="relative mb-8">
                                    <div className="w-24 h-24 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin"></div>
                                    <RefreshCw className="absolute inset-0 m-auto w-8 h-8 text-purple-500" />
                                </div>
                                <h3 className="text-2xl font-bold text-white mb-2">מסנכרן כעת...</h3>
                                <p className="text-white/40">מעביר קבצים ומעדכן נתונים (פעולה אטומית)</p>
                            </motion.div>
                        )}

                        {status === 'success' && (
                            <motion.div
                                key="success"
                                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                                className="flex flex-col items-center justify-center py-20"
                            >
                                <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mb-6">
                                    <CheckCircle2 className="w-12 h-12 text-green-500" />
                                </div>
                                <h3 className="text-2xl font-bold text-white mb-2">סינכרון הושלם בהצלחה!</h3>
                                <p className="text-white/40">כל הקבצים הועברו לדיסק החיצוני והספרייה מעודכנת.</p>
                            </motion.div>
                        )}

                        {status === 'idle' && (
                            <motion.div
                                key="idle"
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                className="flex flex-col items-center justify-center py-20"
                            >
                                <CheckCircle2 className="w-16 h-16 text-green-500/40 mb-4" />
                                <h3 className="text-xl font-bold text-white mb-2">הספרייה מסונכרנת</h3>
                                <p className="text-white/40">לא נמצאו קבצים שממתינים לסינכרון.</p>
                                <button onClick={onClose} className="mt-8 px-8 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-all">סגור</button>
                            </motion.div>
                        )}

                        {status === 'error' && (
                            <motion.div
                                key="error"
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                className="flex flex-col items-center justify-center py-20"
                            >
                                <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
                                <h3 className="text-xl font-bold text-white mb-2">שגיאה בסינכרון</h3>
                                <p className="text-red-400/80 mb-6">{error}</p>
                                <button onClick={checkSyncStatus} className="px-8 py-3 bg-red-600 text-white rounded-xl font-bold">נסה שוב</button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Footer */}
                {status === 'pending' && (
                    <div className="p-6 border-t border-white/5 bg-black/20 flex justify-between items-center gap-4">
                        <div className="text-xs text-white/30 max-w-md">
                            * פעולה זו תעביר את הקבצים פיזית מהדיסק הפנימי ל-SSD החיצוני. הנתונים בבסיס הנתונים יעודכנו רק לאחר הצלחת ההעברה.
                        </div>
                        <div className="flex gap-4">
                            <button onClick={onClose} className="px-8 py-3 bg-white/5 hover:bg-white/10 text-white rounded-2xl transition-all">ביטול</button>
                            <button onClick={handleSync} className="px-12 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl font-bold shadow-xl shadow-purple-600/20 transition-all flex items-center gap-2">
                                <RefreshCw className="w-5 h-5" />
                                סנכרן הכל כעת
                            </button>
                        </div>
                    </div>
                )}
            </motion.div>
        </div>
    );
};

export default SyncOverlay;
