import React, { useState } from 'react';
import { Plus, Disc, Music, ListMusic, User, X, Check, Search, Download, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import YouTubeSearch from '../../pages/music/components/YouTubeSearch';
import { getBackendApiUrl } from '@/utils/apiUtils';

/**
 * Premium "Add New" component for RanTunes.
 * Replaces the first item in grids and handles multi-track selection for albums/playlists.
 */
const AddMusicCard = ({ tabId, onAdd }) => {
    const [showModal, setShowModal] = useState(false);

    const config = {
        albums: {
            icon: Disc,
            title: 'הוסף אלבום',
            subtitle: 'חפש וייבא אלבום שלם',
            gradient: 'from-purple-600/30 to-indigo-600/30',
            borderColor: 'border-purple-500/30',
            hoverBorder: 'hover:border-purple-400/60',
            iconBg: 'bg-purple-500/20',
            iconColor: 'text-purple-400',
            type: 'album'
        },
        singles: {
            icon: Music,
            title: 'הוסף שיר',
            subtitle: 'חפש וייבא שיר בודד',
            gradient: 'from-emerald-600/30 to-teal-600/30',
            borderColor: 'border-emerald-500/30',
            hoverBorder: 'hover:border-emerald-400/60',
            iconBg: 'bg-emerald-500/20',
            iconColor: 'text-emerald-400',
            type: 'track'
        },
        playlists: {
            icon: ListMusic,
            title: 'הוסף פלייליסט',
            subtitle: 'ייבא פלייליסט מ-YouTube',
            gradient: 'from-amber-600/30 to-orange-600/30',
            borderColor: 'border-amber-500/30',
            hoverBorder: 'hover:border-amber-400/60',
            iconBg: 'bg-amber-500/20',
            iconColor: 'text-amber-400',
            type: 'playlist'
        },
        artists: {
            icon: User,
            title: 'הוסף אמן',
            subtitle: 'הוסף מוזיקה חדשה',
            gradient: 'from-pink-600/30 to-rose-600/30',
            borderColor: 'border-pink-500/30',
            hoverBorder: 'hover:border-pink-400/60',
            iconBg: 'bg-pink-500/20',
            iconColor: 'text-pink-400',
            type: 'artist'
        }
    };

    const cfg = config[tabId];
    if (!cfg) return null;

    const Icon = cfg.icon;

    return (
        <>
            <motion.div
                whileHover={{ scale: 1.02, y: -4 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setShowModal(true)}
                className={`
                    group cursor-pointer rounded-2xl overflow-hidden
                    border border-white/10 ${cfg.hoverBorder}
                    bg-gradient-to-br ${cfg.gradient}
                    backdrop-blur-md relative
                    transition-all duration-500
                    hover:shadow-2xl hover:shadow-white/5
                    w-full h-full aspect-square
                `}
            >
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/5 rounded-full blur-3xl group-hover:bg-white/10 transition-colors" />
                <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-black/20 rounded-full blur-2xl" />

                <div className="flex flex-col items-center justify-center h-full relative z-10 p-6">
                    <div className={`
                        w-16 h-16 rounded-full ${cfg.iconBg}
                        flex items-center justify-center
                        border border-white/10
                        shadow-xl shadow-black/20
                        group-hover:scale-110 group-hover:rotate-90 
                        transition-all duration-700 ease-out
                        mb-4
                    `}>
                        <Plus className={`w-8 h-8 ${cfg.iconColor}`} />
                        <div className="absolute inset-0 rounded-full border border-white/20 animate-ping opacity-20 group-hover:opacity-40" />
                    </div>

                    <div className="text-center">
                        <h3 className="text-white font-black text-lg leading-tight">{cfg.title}</h3>
                        <p className="text-white/50 text-xs font-bold mt-1">{cfg.subtitle}</p>
                    </div>
                </div>

                <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${cfg.gradient} opacity-50 group-hover:opacity-100 transition-opacity`} />
            </motion.div>

            {/* Import Modal */}
            <AnimatePresence>
                {showModal && (
                    <ImportModal
                        type={cfg.type}
                        onClose={() => setShowModal(false)}
                        onAdd={onAdd}
                        config={cfg}
                    />
                )}
            </AnimatePresence>
        </>
    );
};

/**
 * Import Modal with Track Selection
 */
const ImportModal = ({ type, onClose, onAdd, config }) => {
    const [step, setStep] = useState('search'); // search, select, downloading
    const [selectedTracks, setSelectedTracks] = useState([]);
    const [importData, setImportData] = useState(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const [progress, setProgress] = useState(0);

    const handleSelectFromYouTube = (track, extras, batchContext) => {
        const all = [track, ...(extras || [])];
        if (all.length > 1 || type === 'album' || type === 'playlist') {
            setImportData({ tracks: all, context: batchContext });
            setSelectedTracks(all);
            setStep('select');
        } else {
            // Single track import
            handleConfirmImport(all);
        }
    };

    const handleConfirmImport = async (tracks) => {
        setIsDownloading(true);
        setStep('downloading');

        // This actually calls the parent's onAdd which is likely 
        // setShowYouTubeIngest(true) or similar in the current index.jsx.
        // But we want to pass the selected tracks directly to the ingest logic.

        // Strategy: We close this modal and trigger the parent's add logic 
        // with the pre-selected tracks.
        onAdd(tracks);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 overflow-hidden" dir="rtl">
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-[#1e1e2e] w-full max-w-4xl max-h-[90vh] rounded-3xl border border-white/10 shadow-2xl flex flex-col relative"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className={`p-6 border-b border-white/10 bg-gradient-to-r ${config.gradient} flex justify-between items-center`}>
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl ${config.iconBg} flex items-center justify-center border border-white/20`}>
                            <config.icon className={`w-6 h-6 ${config.iconColor}`} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-white">
                                {step === 'search' ? config.title : 'בחר שירים לייבוא'}
                            </h2>
                            <p className="text-white/60 text-sm font-medium">
                                {step === 'search' ? config.subtitle : `${selectedTracks.length} שירים נבחרו`}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors">
                        <X className="w-5 h-5 text-white" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 min-h-[400px]">
                    {step === 'search' && (
                        <YouTubeSearch onPlayTrack={handleSelectFromYouTube} />
                    )}

                    {step === 'select' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between mb-2">
                                <button
                                    onClick={() => setSelectedTracks(selectedTracks.length === importData.tracks.length ? [] : importData.tracks)}
                                    className="text-white/50 hover:text-white text-sm font-bold flex items-center gap-2"
                                >
                                    <div className={`w-5 h-5 rounded border ${selectedTracks.length === importData.tracks.length ? 'bg-red-500 border-red-500' : 'border-white/20'}`}>
                                        {selectedTracks.length === importData.tracks.length && <Check size={14} className="text-white" />}
                                    </div>
                                    בחר הכל
                                </button>
                                <button onClick={() => setStep('search')} className="text-white/40 hover:text-white text-sm">חזרה לחיפוש</button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {importData.tracks.map((track, i) => {
                                    const isSelected = selectedTracks.find(t => t.id === track.id);
                                    return (
                                        <div
                                            key={track.id + i}
                                            onClick={() => {
                                                if (isSelected) setSelectedTracks(selectedTracks.filter(t => t.id !== track.id));
                                                else setSelectedTracks([...selectedTracks, track]);
                                            }}
                                            className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center gap-3 ${isSelected ? 'bg-white/10 border-white/30' : 'bg-white/5 border-transparent opacity-60'
                                                }`}
                                        >
                                            <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                                                <img src={track.thumbnail} className="w-full h-full object-cover" alt="" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="text-white font-bold text-sm truncate">{track.title}</h4>
                                                <p className="text-white/40 text-[10px] truncate">{track.artist}</p>
                                            </div>
                                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${isSelected ? 'bg-emerald-500 border-emerald-500' : 'border-white/20'}`}>
                                                {isSelected && <Check size={12} className="text-white" />}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {step === 'downloading' && (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <Loader2 className="w-16 h-16 text-white/20 animate-spin mb-6" />
                            <h3 className="text-xl font-bold text-white mb-2">מייבא שירים...</h3>
                            <p className="text-white/50">תהליך זה עלול לקחת מספר דקות</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {step === 'select' && (
                    <div className="p-6 border-t border-white/10 flex justify-between items-center bg-black/20">
                        <span className="text-white/40 text-sm">{selectedTracks.length} שירים לייבוא</span>
                        <button
                            disabled={selectedTracks.length === 0}
                            onClick={() => handleConfirmImport(selectedTracks)}
                            className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white px-8 py-3 rounded-2xl font-black shadow-xl shadow-red-600/20 transition-all flex items-center gap-2"
                        >
                            <Download size={20} />
                            ייבא שירים נבחרים
                        </button>
                    </div>
                )}
            </motion.div>
        </div>
    );
};

export default AddMusicCard;
