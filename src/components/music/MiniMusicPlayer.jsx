import React, { useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useAnimation } from 'framer-motion';
import { Play, Pause, SkipForward, Volume2, Music } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import MusicContext from '../../context/MusicContext';

/**
 * Compact Mini music player for headers
 * Uses MusicContext directly for instant sync - no Supabase polling needed.
 * Light/white theme, ~1/3 screen width
 */
const MiniMusicPlayer = ({ className = '', forceDark = false, forceLight = false }) => {
    const { isDarkMode: themeDarkMode } = useTheme();
    const isDarkMode = forceDark ? true : (forceLight ? false : themeDarkMode);

    const music = useContext(MusicContext);
    const navigate = useNavigate();
    const controls = useAnimation();

    const currentSong = music?.currentSong;
    const isPlaying = music?.isPlaying;
    const togglePlay = music?.togglePlay;
    const handleNext = music?.handleNext;
    const volume = music?.volume !== undefined ? music.volume : 0.7;
    const setVolume = music?.setVolume;

    // 📀 Realistic "Coast to Stop" Effect
    useEffect(() => {
        if (isPlaying) {
            controls.start({
                rotate: 360,
                transition: { duration: 4, repeat: Infinity, ease: "linear" }
            });
        } else {
            // Coast slightly further before stopping
            controls.start({
                rotate: "+=45",
                transition: { duration: 1.2, ease: "easeOut" }
            });
        }
    }, [isPlaying, controls]);

    // Open RanTunes internal page
    const openRanTunes = () => {
        navigate('/music');
    };

    // Don't render if no music context or no current song
    // MUST BE AFTER ALL HOOKS
    if (!music || !currentSong || !currentSong.title) {
        return null;
    }



    const coverUrl = currentSong.album?.cover_url || currentSong.cover_url || currentSong.thumbnail_url;
    const artistName = currentSong.artist?.name || currentSong.artist_name || 'Unknown Artist';

    return (
        <div
            className={`flex items-center gap-3 rounded-xl px-4 py-2 transition-all max-w-[390px] min-w-[250px] border transition-colors duration-300 ${isDarkMode
                ? 'music-gradient-wood border-white/10 shadow-black/20 text-white'
                : 'bg-gray-100 hover:bg-gray-50 border-gray-200 shadow-sm'
                } ${className}`}
            style={{ transform: 'translateX(-10px)' }}
            dir="rtl"
        >
            {/* Mini Vinyl Record */}
            <motion.div
                className="w-9 h-9 rounded-full overflow-hidden shrink-0 cursor-pointer shadow-lg bg-[#111] relative flex items-center justify-center border border-black/20"
                animate={controls}
                onClick={openRanTunes}
            >
                {/* Vinyl Grooves */}
                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle,_transparent_30%,_rgba(255,255,255,0.1)_35%,_transparent_40%,_rgba(255,255,255,0.1)_45%,_transparent_50%)]" />

                <div className="w-5 h-5 rounded-full overflow-hidden border border-black/20 flex items-center justify-center bg-white z-10">
                    {coverUrl ? (
                        <img
                            src={coverUrl}
                            alt={currentSong.album?.name || 'Album'}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-200">
                            <Music className="w-2 h-2 text-gray-400" />
                        </div>
                    )}
                    <div className="w-1 h-1 rounded-full bg-black absolute z-30" />
                </div>
            </motion.div>

            {/* Song & Artist */}
            <div className="min-w-0 flex-1 cursor-pointer text-right" onClick={openRanTunes}>
                <p className={`text-[15px] font-bold truncate leading-tight ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                    {currentSong.title}
                </p>
                <p className={`text-xs truncate leading-tight mt-0.5 ${isDarkMode ? 'text-white/60' : 'text-gray-500'}`}>
                    {artistName}
                </p>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2 shrink-0">
                {/* Server Volume Control (Plus/Minus Buttons & Level Display) */}
                <div className="flex items-center bg-white/5 rounded-lg border border-white/10 overflow-hidden" dir="ltr">
                    <button
                        onClick={() => setVolume?.(Math.max(0, volume - 0.1))}
                        className={`w-8 h-8 flex items-center justify-center font-bold text-xs transition-all hover:bg-white/10 active:scale-95 ${isDarkMode ? 'text-white/60 hover:text-white' : 'text-gray-600 hover:text-black'}`}
                        title="הנמך ווליום"
                    >
                        -
                    </button>
                    <div className={`px-1.5 text-xs font-mono font-bold select-none text-center min-w-[22px] ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`}>
                        {Math.round(volume * 10)}
                    </div>
                    <button
                        onClick={() => setVolume?.(Math.min(1, volume + 0.1))}
                        className={`w-8 h-8 flex items-center justify-center font-bold text-xs transition-all hover:bg-white/10 active:scale-95 ${isDarkMode ? 'text-white/60 hover:text-white' : 'text-gray-600 hover:text-black'}`}
                        title="הגבר ווליום"
                    >
                        +
                    </button>
                </div>


                <button
                    onClick={handleNext}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isDarkMode
                        ? 'text-slate-400 hover:text-white hover:bg-slate-700'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
                        }`}
                    title="שיר הבא"
                >
                    <SkipForward className="w-4 h-4" />
                </button>

                <button
                    onClick={togglePlay}
                    className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${isDarkMode
                        ? 'bg-slate-700 hover:bg-slate-600'
                        : 'bg-gray-200 hover:bg-gray-300'
                        }`}
                    title={isPlaying ? 'השהה' : 'נגן'}
                >
                    {isPlaying ? (
                        <Pause className={`w-4 h-4 ${isDarkMode ? 'text-slate-200 fill-slate-200' : 'text-gray-700 fill-gray-700'}`} />
                    ) : (
                        <Play className={`w-4 h-4 ${isDarkMode ? 'text-slate-200 fill-slate-200' : 'text-gray-700 fill-gray-700'}`} />
                    )}
                </button>
            </div>
        </div>
    );
};

export default MiniMusicPlayer;
