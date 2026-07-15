import React from 'react';
import { GripVertical } from 'lucide-react';

/**
 * Clean Song row component for queue and playlist view
 */
const SongRow = ({
    song,
    isCurrentSong = false,
    isPlaying = false,
    onEdit,
    isDraggable = false,
    dragControls
}) => {
    // Parse title: Extract content in parentheses or after a dash
    const parseTitle = (title) => {
        if (!title) return { main: '', sub: '' };

        let main = title;
        let subParts = [];

        // Handle dash (-)
        if (main.includes(' - ')) {
            const parts = main.split(' - ');
            main = parts[0];
            subParts.push(...parts.slice(1));
        } else if (main.includes(' – ')) { // em-dash
            const parts = main.split(' – ');
            main = parts[0];
            subParts.push(...parts.slice(1));
        }

        // Match content in parentheses
        const parenRegex = /\(([^)]+)\)/g;
        const matches = main.match(parenRegex);

        if (matches) {
            matches.forEach(m => {
                main = main.replace(m, '');
                subParts.push(m);
            });
        }

        return {
            main: main.trim().replace(/\s+/g, ' '),
            sub: subParts.join(' ').trim()
        };
    };

    const { main, sub } = parseTitle(song.title);

    // Format duration (seconds to MM:SS)
    const formatDuration = (seconds) => {
        if (!seconds) return '--:--';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div
            className={`music-song-row ${isCurrentSong ? 'playing bg-purple-500/10 border-purple-500/30' : ''} group flex items-center justify-between`}
        >
            {/* Clickable info area */}
            <div 
                className="flex flex-1 items-center min-w-0 py-2 cursor-pointer"
                onClick={() => onEdit?.(song)}
            >
                {/* Duration / Playing indicator */}
                <div className="w-14 flex-shrink-0 flex justify-center items-center text-white/40 text-xs font-mono mr-1">
                    {isCurrentSong && isPlaying ? (
                        <div className="music-playing-indicator">
                            <span></span>
                            <span></span>
                            <span></span>
                            <span></span>
                        </div>
                    ) : (
                        <span>{formatDuration(song.duration_seconds)}</span>
                    )}
                </div>

                {/* Song info */}
                <div className="flex-1 min-w-0 mr-3 py-1">
                    <h4 className={`font-bold truncate text-sm leading-none mb-1 ${isCurrentSong ? 'text-purple-400' : 'text-white'}`}>
                        {main}
                    </h4>
                    {sub ? (
                        <p className="text-white/20 text-[9px] font-medium truncate leading-none uppercase tracking-wider">
                            {sub}
                        </p>
                    ) : song.artist?.name ? (
                        <p className="text-white/40 text-[10px] truncate leading-none mt-1">
                            {song.artist.name}
                        </p>
                    ) : null}
                </div>
            </div>

            {/* Drag Grip handle (Left side) */}
            {isDraggable && (
                <div 
                    className="w-10 flex-shrink-0 flex justify-center items-center text-white/20 group-hover:text-white/40 transition-colors cursor-grab active:cursor-grabbing py-3 touch-none select-none"
                    onPointerDown={(e) => {
                        if (dragControls) dragControls.start(e);
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <GripVertical className="w-4 h-4" />
                </div>
            )}
        </div>
    );
};

export default SongRow;
