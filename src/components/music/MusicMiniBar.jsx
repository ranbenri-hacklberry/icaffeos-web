import React, { useState } from 'react';
import {
    Play, Pause, SkipForward, SkipBack, Volume2, VolumeX,
    Music, ChevronUp
} from 'lucide-react';
import { useMusic } from '@/context/MusicContext';
import '@/styles/music.css';

/**
 * Mini music bar for KDS screen - compact player controls
 */
const MusicMiniBar = ({ onExpandClick }) => {
    const {
        isPlaying,
        currentSong,
        volume,
        togglePlay,
        handleNext,
        handlePrevious,
        setVolume
    } = useMusic();

    const [showVolume, setShowVolume] = useState(false);

    // Generate gradient based on song/album name
    const getGradientClass = () => {
        if (!currentSong) return 'music-gradient-dark';
        const gradients = [
            'music-gradient-purple',
            'music-gradient-pink',
            'music-gradient-blue',
            'music-gradient-orange',
            'music-gradient-green'
        ];
        const index = (currentSong.title?.charCodeAt(0) || 0) % gradients.length;
        return gradients[index];
    };

    if (!currentSong) {
        return (
            <div className="music-mini-bar justify-center py-2">
                <Music className="w-4 h-4 text-white/30" />
                <span className="text-white/30 text-sm">אין שיר מתנגן</span>
            </div>
        );
    }

    return (
        <div className="music-mini-bar relative">
            {/* Album art */}
            <div className="flex-shrink-0 relative">
                {currentSong.album?.cover_url ? (
                    <img
                        src={currentSong.album.cover_url}
                        alt={currentSong.album?.name}
                        className={`music-mini-albumart ${isPlaying ? 'music-vinyl-spin' : ''}`}
                    />
                ) : (
                    <div className={`music-mini-albumart ${getGradientClass()} flex items-center justify-center`}>
                        <Music className="w-5 h-5 text-white/50" />
                    </div>
                )}
            </div>

            {/* Song info */}
            <div className="flex-1 min-w-0 mx-2">
                <p className="text-white font-medium text-sm truncate">
                    {currentSong.title}
                </p>
                <p className="text-white/50 text-xs truncate">
                    {currentSong.artist?.name || currentSong.album?.name || ''}
                </p>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-1">
                {/* Previous */}
                <button
                    onClick={handlePrevious}
                    className="music-mini-btn"
                >
                    <SkipBack className="w-4 h-4" />
                </button>

                {/* Play/Pause */}
                <button
                    onClick={togglePlay}
                    className="music-mini-btn music-gradient-purple"
                >
                    {isPlaying ? (
                        <Pause className="w-4 h-4" />
                    ) : (
                        <Play className="w-4 h-4 mr-[-2px]" />
                    )}
                </button>

                {/* Next */}
                <button
                    onClick={handleNext}
                    className="music-mini-btn"
                >
                    <SkipForward className="w-4 h-4" />
                </button>

                {/* Divider */}
                <div className="w-px h-5 bg-white/20 mx-1" />

                {/* Volume */}
                <div className="relative">
                    <button
                        onClick={() => { setShowVolume(!showVolume); setShowRating(false); }}
                        className="music-mini-btn"
                    >
                        {volume === 0 ? (
                            <VolumeX className="w-4 h-4" />
                        ) : (
                            <Volume2 className="w-4 h-4" />
                        )}
                    </button>

                    {/* Volume popup */}
                    {showVolume && (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-3 
                          music-glass-dark rounded-xl shadow-xl z-50"
                        >
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.05"
                                value={volume}
                                onChange={(e) => setVolume(parseFloat(e.target.value))}
                                className="music-volume-slider w-24 rotate-[-90deg] origin-center"
                                style={{ height: '4px', marginTop: '40px', marginBottom: '40px' }}
                            />
                        </div>
                    )}
                </div>


                {/* Expand button */}
                {onExpandClick && (
                    <button
                        onClick={onExpandClick}
                        className="music-mini-btn"
                    >
                        <ChevronUp className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* Click outside to close popups */}
            {showVolume && (
                <div
                    className="fixed inset-0 z-40"
                    onClick={() => { setShowRating(false); setShowVolume(false); }}
                />
            )}
        </div>
    );
};

export default MusicMiniBar;
