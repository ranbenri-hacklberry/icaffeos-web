import React from 'react';
import { Music } from 'lucide-react';

import { getBackendApiUrl, getCoverUrl } from '../../utils/apiUtils';

const MUSIC_API_URL = getBackendApiUrl();

/**
 * Vinyl Turntable Component (RanTunes Professional Edition)
 * Restored to original design with wood base, tonearm, and platter.
 * Uses CSS classes from src/styles/music.css
 */
const VinylTurntable = ({ song, isPlaying, albumArt, onTogglePlay, queue = [] }) => {
    // If no song is actively playing, show the first song in queue as preview
    const displaySong = song || (queue.length > 0 ? queue[0] : null);

    // Determine cover URL with robust fallback
    const resolveCover = () => {
        const possibleCover = albumArt || (displaySong?.album?.cover_url || displaySong?.cover_url || displaySong?.thumbnail_url);
        return getCoverUrl(possibleCover);
    };

    const coverUrl = resolveCover();

    return (
        <div
            className="vinyl-container cursor-pointer active:scale-95 transition-transform"
            dir="ltr"
            onClick={() => onTogglePlay && onTogglePlay(!isPlaying)}
        >
            {/* Turntable base - wood texture (defined in music.css) */}
            <div className="vinyl-base">
                {/* Platter */}
                <div className="vinyl-platter-ring">
                    {/* Vinyl record */}
                    <div
                        className={`vinyl-disc ${isPlaying ? 'vinyl-spinning' : ''}`}
                    >
                        {/* Grooves */}
                        <div className="vinyl-groove" style={{ width: '90%', height: '90%', opacity: 0.1 }}></div>
                        <div className="vinyl-groove" style={{ width: '75%', height: '75%', opacity: 0.1 }}></div>
                        <div className="vinyl-groove" style={{ width: '60%', height: '60%', opacity: 0.1 }}></div>
                        <div className="vinyl-groove" style={{ width: '50%', height: '50%', opacity: 0.1 }}></div>

                        {/* Center label */}
                        <div className="vinyl-center-label">
                            {coverUrl ? (
                                <img src={coverUrl} alt="Album Art" className="vinyl-album-art" />
                            ) : (
                                <div className="vinyl-no-art">
                                    <Music className="w-8 h-8 text-white/50" />
                                </div>
                            )}
                            <div className="vinyl-spindle-hole"></div>
                        </div>

                        {/* Shine effect */}
                        <div className="vinyl-reflection"></div>
                    </div>
                </div>

                {/* Tonearm - Rotates when isPlaying is true */}
                <div className={`vinyl-arm ${isPlaying ? 'vinyl-arm-playing' : ''}`}>
                    <div className="vinyl-arm-pivot"></div>
                    <div className="vinyl-arm-stick">
                        <div className="vinyl-arm-head"></div>
                    </div>
                </div>

                {/* Armrest - where tonearm rests when not playing */}
                <div className="vinyl-armrest"></div>

                {/* LED indicator */}
                <div className={`vinyl-led ${isPlaying ? 'vinyl-led-on' : ''}`}></div>
            </div>

            {/* Song info (Visualized below the base) */}
            {displaySong && (
                <div className="vinyl-info mt-6 text-center">
                    <p className="vinyl-title text-xl font-bold text-white mb-1">
                        {displaySong.title}
                    </p>
                    <p className="vinyl-artist text-sm text-white/60">
                        {displaySong.artist?.name || displaySong.artist || displaySong.album?.name || 'אמן לא ידוע'}
                    </p>
                </div>
            )}
        </div>
    );
};

export default VinylTurntable;
