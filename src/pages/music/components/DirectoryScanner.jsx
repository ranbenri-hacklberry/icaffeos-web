import React, { useState, useEffect } from 'react';
import { X, FolderOpen, HardDrive, Music, RefreshCw, Check, Copy } from 'lucide-react';
import { motion } from 'framer-motion';
import '@/styles/music.css';

import { getBackendApiUrl } from '@/utils/apiUtils';

const MUSIC_API_URL = getBackendApiUrl();

/**
 * Directory scanner modal - input path to music folder on external drive
 */
const DirectoryScanner = ({ isOpen, onClose, onScan }) => {
    if (!isOpen) return null;

    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const [directoryPath, setDirectoryPath] = useState(isMac ? '/Volumes/RANTUNES' : '/mnt/music_ssd/');
    const [isScanning, setIsScanning] = useState(false);
    const [result, setResult] = useState(null);
    const [availableVolumes, setAvailableVolumes] = useState([]);
    const [loadingVolumes, setLoadingVolumes] = useState(true);
    const [progress, setProgress] = useState({ phase: '', current: 0, total: 0 });

    // Fetch available volumes from backend
    useEffect(() => {
        const fetchVolumes = async () => {
            try {
                const response = await fetch(`${MUSIC_API_URL}/music/volumes`);
                if (response.ok) {
                    const data = await response.json();
                    setAvailableVolumes(data.volumes || []);
                }
            } catch (err) {
                console.log('Could not fetch volumes:', err);
            } finally {
                setLoadingVolumes(false);
            }
        };
        fetchVolumes();
    }, []);

    // Common paths suggestions
    const suggestions = [
        { path: '/Volumes/RANTUNES', label: 'דיסק RANTUNES' },
        { path: '/mnt/music_ssd/', label: 'SSD חיצוני' },
        { path: '/Volumes/', label: 'דיסקים אחרים' },
        { path: '/Users/Shared/Music/', label: 'מוזיקה משותפת' },
        { path: `${window.location.hostname === 'localhost' ? '/Users/' : '~/'}Music/`, label: 'מוזיקה מקומית' },
    ];

    const handleScan = async (forceClean = false) => {
        if (!directoryPath.trim()) return;

        setIsScanning(true);
        setResult(null);
        setProgress({ phase: 'מתחיל...', current: 0, total: 0 });

        try {
            const scanResult = await onScan(directoryPath.trim(), forceClean, setProgress);
            setResult(scanResult);

            // 🚀 AUTO-CLOSE: If successful, close after a brief moment so user can see the "Done" state
            if (scanResult && scanResult.success) {
                setTimeout(() => {
                    onClose();
                }, 1500);
            }
        } catch (error) {
            setResult({ success: false, message: error.message });
        } finally {
            setIsScanning(false);
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-[#1a1a2e] rounded-2xl w-full max-w-lg max-h-[85vh] overflow-hidden"
                dir="rtl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl music-gradient-blue flex items-center justify-center">
                            <HardDrive className="w-5 h-5 text-white" />
                        </div>
                        <h2 className="text-white text-xl font-bold">סריקת ספריית מוזיקה</h2>
                    </div>

                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"
                    >
                        <X className="w-5 h-5 text-white" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[60vh]">
                    {/* Instructions */}
                    <div className="bg-purple-500/20 rounded-xl p-4 mb-6 border border-purple-500/30">
                        <h3 className="text-purple-300 font-bold mb-2 flex items-center gap-2">
                            <FolderOpen className="w-4 h-4" />
                            איך למצוא את הנתיב?
                        </h3>
                        <ol className="text-white/70 text-sm space-y-1 list-decimal list-inside">
                            <li>פתח את Finder</li>
                            <li>נווט לתיקיית המוזיקה בדיסק החיצוני</li>
                            <li>לחץ <span className="bg-white/20 px-2 py-0.5 rounded text-xs">Cmd + Option + C</span> להעתקת הנתיב</li>
                            <li>הדבק כאן</li>
                        </ol>
                    </div>

                    {/* Available Volumes */}
                    {availableVolumes.length > 0 && (
                        <div className="mb-6">
                            <label className="text-white/60 text-sm block mb-2">
                                דיסקים זמינים במחשב
                            </label>
                            <div className="space-y-2">
                                {availableVolumes.map((vol, idx) => (
                                    <button
                                        key={`vol-${vol.path}-${idx}`}
                                        onClick={() => setDirectoryPath(vol.path)}
                                        className="w-full flex items-center gap-3 px-4 py-3 bg-white/5 rounded-xl
                             hover:bg-white/10 transition-colors text-right"
                                    >
                                        <HardDrive className="w-5 h-5 text-blue-400 flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-white font-medium truncate">{vol.name}</p>
                                            <p className="text-white/40 text-xs truncate" dir="ltr">{vol.path}</p>
                                        </div>
                                        <Copy
                                            className="w-4 h-4 text-white/30 flex-shrink-0"
                                            onClick={(e) => { e.stopPropagation(); copyToClipboard(vol.path); }}
                                        />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Path input */}
                    <div className="mb-6">
                        <label className="text-white/60 text-sm block mb-2">
                            נתיב לספריית המוזיקה
                        </label>
                        <div className="relative">
                            <FolderOpen className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                            <input
                                type="text"
                                value={directoryPath}
                                onChange={(e) => setDirectoryPath(e.target.value)}
                                className="w-full bg-white/10 border border-white/10 rounded-xl py-3 pr-10 pl-4
                         text-white placeholder-white/40 focus:outline-none focus:border-purple-500
                         font-mono text-sm"
                                placeholder="/mnt/music_ssd/"
                                dir="ltr"
                            />
                        </div>
                    </div>

                    {/* Quick suggestions */}
                    <div className="mb-6">
                        <label className="text-white/60 text-sm block mb-2">נתיבים מהירים</label>
                        <div className="flex flex-wrap gap-2">
                            {suggestions.map(({ path: sPath, label }, idx) => (
                                <button
                                    key={`sug-${sPath}-${idx}`}
                                    onClick={() => setDirectoryPath(sPath)}
                                    className="px-3 py-2 bg-white/10 rounded-xl text-white/60 text-sm
                           hover:bg-white/20 transition-colors"
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Expected structure */}
                    <div className="bg-white/5 rounded-xl p-4 mb-6">
                        <div className="flex items-start gap-3">
                            <Music className="w-5 h-5 text-purple-400 mt-0.5" />
                            <div>
                                <p className="text-white/80 text-sm mb-2">
                                    מבנה ספריות מומלץ:
                                </p>
                                <pre className="text-white/50 text-xs bg-black/30 p-2 rounded-lg overflow-x-auto" dir="ltr">
                                    {`/Music/
├── Artist Name/
│   ├── Album Name/
│   │   ├── 01 - Song.mp3
│   │   └── cover.jpg`}
                                </pre>
                            </div>
                        </div>
                    </div>

                    {/* Progress bar */}
                    {isScanning && (
                        <div className="bg-blue-500/20 rounded-xl p-4 mb-6 border border-blue-500/30">
                            <p className="text-blue-300 font-medium mb-2">{progress.phase}</p>
                            {progress.total > 0 && (
                                <>
                                    <div className="w-full bg-black/30 rounded-full h-3 mb-2">
                                        <div
                                            className="bg-blue-500 rounded-full h-3 transition-all duration-300"
                                            style={{ width: `${Math.min(100, (progress.current / progress.total) * 100)}%` }}
                                        />
                                    </div>
                                    <p className="text-white/60 text-sm text-center">
                                        {progress.current} / {progress.total}
                                    </p>
                                </>
                            )}
                        </div>
                    )}

                    {/* Result */}
                    {result && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`p-4 rounded-xl mb-6 flex items-start gap-3
                         ${result.success ? 'bg-green-500/20' : 'bg-red-500/20'}`}
                        >
                            {result.success ? (
                                <Check className="w-5 h-5 text-green-400 mt-0.5" />
                            ) : (
                                <X className="w-5 h-5 text-red-400 mt-0.5" />
                            )}
                            <div>
                                <p className={result.success ? 'text-green-400' : 'text-red-400'}>
                                    {result.message || (result.success ? 'הסריקה הושלמה!' : 'שגיאה בסריקה')}
                                </p>
                                {result.stats && (
                                    <p className="text-white/60 text-sm mt-1">
                                        נמצאו {result.stats.artists} אמנים, {result.stats.albums} אלבומים, {result.stats.songs} שירים
                                    </p>
                                )}
                            </div>
                        </motion.div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/10 space-y-3">
                    {/* Regular scan */}
                    <button
                        onClick={() => handleScan(false)}
                        disabled={isScanning || !directoryPath.trim()}
                        className="w-full py-3 rounded-xl music-gradient-blue text-white font-bold
                      disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isScanning ? (
                            <>
                                <RefreshCw className="w-5 h-5 animate-spin" />
                                סורק...
                            </>
                        ) : (
                            <>
                                <FolderOpen className="w-5 h-5" />
                                התחל סריקה
                            </>
                        )}
                    </button>

                    {/* Clean scan - deletes all and rescans */}
                    <button
                        onClick={() => handleScan(true)}
                        disabled={isScanning || !directoryPath.trim()}
                        className="w-full py-2 rounded-xl bg-red-500/20 border border-red-500/50 text-red-300 font-medium
                      disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                    >
                        🗑️ סריקה נקייה (מוחק הכל ומתחיל מחדש)
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

export default DirectoryScanner;
