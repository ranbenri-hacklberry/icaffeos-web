import React, { useState, useEffect } from 'react';
import {
    Play, Pause, SkipForward, SkipBack, Volume2, VolumeX,
    Shuffle, Repeat, Repeat1, Music, List, ChevronDown,
    Heart
} from 'lucide-react';
import { useMusic } from '@/context/MusicContext';
import VinylTurntable from './VinylTurntable';
import '@/styles/music.css';

/**
 * Full-size music player component
 */
const MusicPlayer = ({ onMinimize, showPlaylist = false }) => {
    const {
        isPlaying,
        currentSong,
        currentTime,
        duration,
        volume,
        playlist,
        playlistIndex,
        shuffle,
        repeat,
        togglePlay,
        handleNext,
        handlePrevious,
        seek,
        setVolume,
        setShuffle,
        setRepeat
    } = useMusic();


    // Format time (seconds to MM:SS)
    const formatTime = (seconds) => {
        if (!seconds || isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Progress percentage
    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

    // Handle seek
    const handleSeek = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        seek(percent * duration);
    };


    // Toggle repeat mode
    const toggleRepeat = () => {
        const modes = ['none', 'all', 'one'];
        const currentIndex = modes.indexOf(repeat);
        const nextMode = modes[(currentIndex + 1) % modes.length];
        setRepeat(nextMode);
    };

    // Get gradient based on album/song
    const getGradientStyle = () => {
        if (!currentSong) {
            return { background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)' };
        }

        const gradients = [
            'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
            'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)'
        ];
        const index = (currentSong.title?.charCodeAt(0) || 0) % gradients.length;
        return { background: gradients[index] };
    };

    if (!currentSong) {
        return (
            <div className="fixed inset-0 flex items-center justify-center music-gradient-dark">
                <div className="text-center">
                    <Music className="w-20 h-20 text-white/20 mx-auto mb-4" />
                    <p className="text-white/40 text-xl">בחר שיר להתחיל</p>
                </div>
            </div>
        );
    }

    return (
        <div
            className="fixed inset-0 flex flex-col"
            style={getGradientStyle()}
        >
            {/* Header */}
            <div className="flex items-center justify-between p-4">
                <button
                    onClick={onMinimize}
                    className="w-10 h-10 rounded-full music-glass flex items-center justify-center"
                >
                    <ChevronDown className="w-5 h-5 text-white" />
                </button>

                <div className="text-center">
                    <p className="text-white/60 text-sm">מנגן עכשיו</p>
                </div>

                <button className="w-10 h-10 rounded-full music-glass flex items-center justify-center">
                    <List className="w-5 h-5 text-white" />
                </button>
            </div>

            {/* Album art / Turntable */}
            <div className="flex-1 flex items-center justify-center p-4">
                <VinylTurntable
                    song={currentSong}
                    isPlaying={isPlaying}
                    albumArt={currentSong.cover_url || currentSong.album?.cover_url}
                    onTogglePlay={togglePlay}
                />
            </div>

            {/* Song info */}
            <div className="px-8 pb-4">
                <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                        <h2 className="text-white text-2xl font-bold truncate">
                            {currentSong.title}
                        </h2>
                        <p className="text-white/60 text-lg truncate">
                            {currentSong.artist?.name || currentSong.album?.name || 'אמן לא ידוע'}
                        </p>
                    </div>

                </div>
            </div>

            {/* Progress bar */}
            <div className="px-8 pb-4">
                <div
                    className="music-progress-container"
                    onClick={handleSeek}
                >
                    <div
                        className="music-progress-bar"
                        style={{ width: `${progress}%` }}
                    />
                </div>
                <div className="flex justify-between mt-2">
                    <span className="text-white/40 text-sm">{formatTime(currentTime)}</span>
                    <span className="text-white/40 text-sm">{formatTime(duration)}</span>
                </div>
            </div>

            {/* Controls */}
            <div className="px-8 pb-8">
                <div className="flex items-center justify-between">
                    {/* Shuffle */}
                    <button
                        onClick={() => setShuffle(!shuffle)}
                        className={`w-10 h-10 rounded-full flex items-center justify-center
                       ${shuffle ? 'text-purple-400' : 'text-white/40'}`}
                    >
                        <Shuffle className="w-5 h-5" />
                    </button>

                    {/* Previous */}
                    <button
                        onClick={handlePrevious}
                        className="w-14 h-14 rounded-full music-glass flex items-center justify-center"
                    >
                        <SkipBack className="w-7 h-7 text-white" />
                    </button>

                    {/* Play/Pause */}
                    <button
                        onClick={togglePlay}
                        className="w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-xl"
                    >
                        {isPlaying ? (
                            <Pause className="w-10 h-10 text-purple-600" />
                        ) : (
                            <Play className="w-10 h-10 text-purple-600 mr-[-4px]" />
                        )}
                    </button>

                    {/* Next */}
                    <button
                        onClick={handleNext}
                        className="w-14 h-14 rounded-full music-glass flex items-center justify-center"
                    >
                        <SkipForward className="w-7 h-7 text-white" />
                    </button>

                    {/* Repeat */}
                    <button
                        onClick={toggleRepeat}
                        className={`w-10 h-10 rounded-full flex items-center justify-center
                       ${repeat !== 'none' ? 'text-purple-400' : 'text-white/40'}`}
                    >
                        {repeat === 'one' ? (
                            <Repeat1 className="w-5 h-5" />
                        ) : (
                            <Repeat className="w-5 h-5" />
                        )}
                    </button>
                </div>

                {/* Volume */}
                <div className="flex items-center justify-center gap-4 mt-6">
                    <VolumeX className="w-4 h-4 text-white/40" />
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={volume}
                        onChange={(e) => setVolume(parseFloat(e.target.value))}
                        className="music-volume-slider flex-1 max-w-[200px]"
                    />
                    <Volume2 className="w-4 h-4 text-white/40" />
                </div>
            </div>
        </div>
    );
};

export default MusicPlayer;
