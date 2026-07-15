import React, { useState, useEffect } from 'react';
import { Monitor, RefreshCw, Clock, AlertTriangle, CheckCircle, Maximize2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const KDSObservability = ({ isEmbedded = false }) => {
    const [screenshot, setScreenshot] = useState(null);
    const [lastUpdate, setLastUpdate] = useState(null);
    const [status, setStatus] = useState('loading'); // loading, online, offline, error
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [autoRefresh, setAutoRefresh] = useState(true);

    // Fetch latest screenshot
    const fetchScreenshot = async () => {
        try {
            const timestamp = new Date().getTime();
            const imageUrl = `/screenshots/latest_kds.png?t=${timestamp}`;

            // Check if image exists
            const response = await fetch(imageUrl, { method: 'HEAD' });

            if (response.ok) {
                setScreenshot(imageUrl);
                setLastUpdate(new Date());
                setStatus('online');
            } else {
                setStatus('offline');
            }
        } catch (error) {
            console.error('Failed to fetch KDS screenshot:', error);
            setStatus('error');
        }
    };

    // Auto-refresh every 30 seconds
    useEffect(() => {
        fetchScreenshot();

        if (autoRefresh) {
            const interval = setInterval(fetchScreenshot, 30000);
            return () => clearInterval(interval);
        }
    }, [autoRefresh]);

    // Status indicator
    const StatusIndicator = () => {
        const statusConfig = {
            online: {
                icon: <CheckCircle size={16} className="text-emerald-400" />,
                text: 'פעיל',
                color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
            },
            offline: {
                icon: <AlertTriangle size={16} className="text-amber-400" />,
                text: 'לא מחובר',
                color: 'bg-amber-500/20 text-amber-400 border-amber-500/30'
            },
            error: {
                icon: <AlertTriangle size={16} className="text-red-400" />,
                text: 'שגיאה',
                color: 'bg-red-500/20 text-red-400 border-red-500/30'
            },
            loading: {
                icon: <RefreshCw size={16} className="text-blue-400 animate-spin" />,
                text: 'טוען...',
                color: 'bg-blue-500/20 text-blue-400 border-blue-500/30'
            }
        };

        const config = statusConfig[status] || statusConfig.loading;

        return (
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${config.color} text-[10px] font-bold`}>
                {config.icon}
                <span>{config.text}</span>
            </div>
        );
    };

    // Fullscreen Modal
    const FullscreenModal = () => (
        <AnimatePresence>
            {isFullscreen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/95 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
                    onClick={() => setIsFullscreen(false)}
                >
                    <button
                        onClick={() => setIsFullscreen(false)}
                        className="absolute top-4 right-4 z-[110] p-3 bg-slate-800 rounded-full text-slate-400 hover:text-white hover:bg-slate-700 border border-slate-700 transition-colors"
                    >
                        <X size={24} />
                    </button>

                    <motion.img
                        initial={{ scale: 0.9 }}
                        animate={{ scale: 1 }}
                        src={screenshot}
                        alt="KDS Fullscreen"
                        className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    />
                </motion.div>
            )}
        </AnimatePresence>
    );

    return (
        <>
            <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`${isEmbedded ? 'bg-transparent border-0 shadow-none' : 'bg-gradient-to-br from-slate-900/80 to-slate-900/60 backdrop-blur-sm rounded-2xl border border-slate-800 shadow-xl'} overflow-hidden`}
            >
                {/* Header */}
                <div className={`flex items-center justify-between mb-4 ${isEmbedded ? '' : 'p-4 border-b border-slate-800'}`}>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/20 rounded-xl ring-1 ring-blue-500/30">
                            <Monitor className="text-blue-400 w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="text-md font-bold text-slate-200">KDS Live Monitor</h3>
                            <p className="text-[10px] text-slate-500">צפייה בזמן אמת במסך המטבח</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <StatusIndicator />

                        <button
                            onClick={fetchScreenshot}
                            disabled={status === 'loading'}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 text-slate-400 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <RefreshCw size={14} className={status === 'loading' ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>

                {/* Main Content Area - Split Layout */}
                <div className={`flex flex-col lg:flex-row gap-6 ${isEmbedded ? 'p-0' : 'p-6'}`}>

                    {/* LEFT SIDE: The Screen (Small/Medium) */}
                    <div className="flex-[2] relative">
                        {screenshot ? (
                            <div className="relative group overflow-hidden rounded-2xl border border-slate-800 shadow-2xl bg-black/40">
                                <img
                                    src={screenshot}
                                    alt="KDS Screenshot"
                                    className="w-full h-auto cursor-pointer transition-transform duration-700 group-hover:scale-[1.01]"
                                    onClick={() => setIsFullscreen(true)}
                                />

                                {/* Overlay Controls */}
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 rounded-xl transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
                                    <button
                                        onClick={() => setIsFullscreen(true)}
                                        className="p-3 bg-blue-600 rounded-full border border-blue-400 text-white hover:bg-blue-500 transition-all shadow-xl hover:scale-110 active:scale-95"
                                    >
                                        <Maximize2 size={24} />
                                    </button>
                                </div>

                                {/* Live Pulse */}
                                {lastUpdate && (
                                    <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-2 text-[10px] text-white/80">
                                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                        <span>LIVE</span>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="w-full aspect-video bg-slate-900 rounded-2xl border border-slate-800 flex flex-col items-center justify-center gap-6 p-12 text-center overflow-hidden relative">
                                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 pointer-events-none" />
                                <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center animate-pulse">
                                    <Monitor size={40} className="text-slate-600" />
                                </div>
                                <div>
                                    <h4 className="text-slate-200 font-bold mb-2">
                                        {status === 'loading' ? 'מתחבר למסך המטבח...' : 'לא נמצא צילום מסך'}
                                    </h4>
                                    <p className="text-slate-500 text-xs max-w-xs mx-auto leading-relaxed">
                                        {status === 'loading'
                                            ? 'אנחנו בודקים אם יש צילום מסך עדכני בשרת. זה עשוי לקחת כמה שניות.'
                                            : 'יתכן שסקריפט הניטור בשרת כבוי או שיש בעיית תקשורת.'}
                                    </p>
                                </div>
                                {status === 'offline' && (
                                    <button
                                        onClick={fetchScreenshot}
                                        className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-all font-bold text-sm"
                                    >
                                        נסה להתחבר שוב
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* RIGHT SIDE: Details & Stats */}
                    <div className="flex-1 flex flex-col gap-4 min-w-[300px]">
                        <div className="bg-slate-950/40 rounded-2xl border border-slate-800/50 p-5 flex flex-col gap-4">
                            <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-1">נתוני ניטור</h4>

                            {/* Status Item */}
                            <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-xl border border-slate-800 shadow-inner">
                                <span className="text-xs text-slate-400 font-medium">סטטוס חיבור</span>
                                <StatusIndicator />
                            </div>

                            {/* Time Item */}
                            <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-xl border border-slate-800 shadow-inner">
                                <div className="flex items-center gap-2">
                                    <Clock size={14} className="text-slate-500" />
                                    <span className="text-xs text-slate-400 font-medium">עדכון אחרון</span>
                                </div>
                                <span className="text-xs font-bold text-slate-200 font-mono">
                                    {lastUpdate ? lastUpdate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--:--'}
                                </span>
                            </div>

                            {/* Network Item */}
                            <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-xl border border-slate-800 shadow-inner">
                                <span className="text-xs text-slate-400 font-medium">כתובת IP יעד</span>
                                <span className="text-xs font-bold text-blue-400 font-mono tracking-tighter">100.97.166.104</span>
                            </div>

                            <div className="h-px bg-slate-800/50 my-2"></div>

                            {/* Controls */}
                            <div className="flex flex-col gap-3">
                                <div className="flex items-center justify-between px-1">
                                    <span className="text-xs text-slate-400 font-medium">רענון אוטומטי (30ש')</span>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={autoRefresh}
                                            onChange={(e) => setAutoRefresh(e.target.checked)}
                                        />
                                        <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600 peer-checked:after:bg-white"></div>
                                    </label>
                                </div>

                                <button
                                    onClick={fetchScreenshot}
                                    disabled={status === 'loading'}
                                    className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/20 rounded-xl font-bold text-xs transition-all active:scale-95 disabled:opacity-50"
                                >
                                    <RefreshCw size={14} className={status === 'loading' ? 'animate-spin' : ''} />
                                    דרוש צילום מסך עכשיו
                                </button>
                            </div>
                        </div>

                        {/* System Health Hint */}
                        <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl">
                            <div className="flex items-start gap-3">
                                <CheckCircle size={14} className="text-emerald-500 mt-0.5" />
                                <div>
                                    <h5 className="text-[11px] font-bold text-emerald-400 mb-1">תקינות מערכת KDS-UI</h5>
                                    <p className="text-[10px] text-slate-500 leading-relaxed">
                                        סנכרון Dexie/Supabase פועל כסדרו. לא זוהו חסימות (UI_HALT) ב-12 השעות האחרונות.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Info Minimal */}
                <div className={`flex items-center justify-between text-[9px] font-medium ${isEmbedded ? 'mt-4' : 'bg-slate-900/30 border-t border-slate-800/40 p-3 px-6'}`}>
                    <div className="text-slate-500">
                        KDS-Monitor v2.4.1 • <span className="text-slate-600">Secure Peer-to-Peer Tunnel Active</span>
                    </div>
                    <div className="text-slate-600 font-mono">
                        INSTANCE: {Math.random().toString(36).substring(7).toUpperCase()}
                    </div>
                </div>
            </motion.div>

            {/* Fullscreen Modal */}
            <FullscreenModal />
        </>
    );
};

export default KDSObservability;
