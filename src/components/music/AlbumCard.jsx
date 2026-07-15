import React, { useState } from 'react';
import { Play, Music, Trash2, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { getBackendApiUrl, getCoverUrl } from '@/utils/apiUtils';

const MUSIC_API_URL = getBackendApiUrl();

/**
 * Album card with cover art, always-visible info, and hover play/delete buttons.
 * Uses aspect-square for consistent grid sizing.
 */
const AlbumCard = ({
    album,
    onPlay,
    onClick,
    onDelete,
    selectionMode = false,
    isSelected = false,
    showPlayCount = false
}) => {
    const [coverError, setCoverError] = useState(false);

    const handlePlay = (e) => {
        e.stopPropagation();
        onPlay?.(album);
    };

    const handleClick = () => {
        onClick?.(album);
    };

    const handleDelete = (e) => {
        e.stopPropagation();
        onDelete?.(album);
    };

    // Generate a gradient based on album name for albums without covers
    const getGradient = (name) => {
        const gradients = [
            'music-gradient-purple',
            'music-gradient-pink',
            'music-gradient-blue',
            'music-gradient-orange',
            'music-gradient-green',
            'music-gradient-sunset'
        ];
        const index = name?.charCodeAt(0) % gradients.length || 0;
        return gradients[index];
    };

    const coverUrl = getCoverUrl(album.cover_url, album.id);
    // Show cover only if URL exists AND the image hasn't errored out
    const showCover = coverUrl && !coverError;

    return (
        <motion.div
            whileHover={!selectionMode ? { scale: 1.03, y: -4 } : { scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            className={`music-album-card group relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-300
                ${selectionMode ? (isSelected ? 'ring-4 ring-purple-500 shadow-2xl' : 'opacity-60 grayscale-[0.5]') : 'bg-black/20'}`}
            onClick={handleClick}
        >
            {/* Album Cover Container – always square */}
            <div className="aspect-square relative overflow-hidden bg-zinc-900 shadow-inner">
                {showCover ? (
                    <div className="w-full h-full relative">
                        <img
                            src={coverUrl}
                            alt={album.name}
                            className={`w-full h-full object-cover transition-transform duration-700 brightness-90
                                ${!selectionMode ? 'group-hover:scale-110 group-hover:brightness-100' : ''}`}
                            loading="lazy"
                            onError={() => setCoverError(true)}
                        />

                        {/* 💿 Vintage Effects Overlay */}
                        <div className="absolute inset-4 rounded-full border border-white/[0.03] shadow-[inset_0_0_40px_rgba(255,255,255,0.02)] pointer-events-none" />
                        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/paper-fibers.png')] opacity-[0.07] mix-blend-overlay pointer-events-none" />
                        <div className="absolute inset-0 shadow-[inset_0_0_30px_rgba(0,0,0,0.4)] pointer-events-none" />
                        <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-bl from-white/[0.08] via-transparent to-transparent pointer-events-none" />
                    </div>
                ) : (
                    <div className={`w-full h-full ${getGradient(album.name)} flex items-center justify-center`}>
                        <Music className="w-16 h-16 text-white/40" />
                        <div className="absolute inset-0 bg-black/10 mix-blend-multiply" />
                    </div>
                )}

                {/* Selection Overlay */}
                {selectionMode && (
                    <div className={`absolute inset-0 flex items-center justify-center transition-colors duration-300 z-30
                        ${isSelected ? 'bg-purple-600/20' : 'bg-black/10'}`}>
                        <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all duration-300
                            ${isSelected ? 'bg-purple-500 border-white scale-110' : 'bg-white/10 border-white/40'}`}>
                            {isSelected && <div className="w-4 h-2 border-l-3 border-b-3 border-white -rotate-45 mt-[-2px]" />}
                        </div>
                    </div>
                )}

                {/* 🏷️ Quality Badge */}
                {album?.audio_quality && !selectionMode && (
                    <div className={`absolute top-2 right-2 px-2 py-0.5 rounded-md text-[9px] font-black z-20 border backdrop-blur-md shadow-lg
                        ${album.audio_quality === 'Hi-Fi' ? 'bg-amber-500/20 text-amber-500 border-amber-500/40' :
                            album.audio_quality === 'HD' ? 'bg-blue-500/20 text-blue-400 border-blue-500/40' :
                                'bg-white/10 text-white/40 border-white/10'}`}
                    >
                        {album.audio_quality}
                    </div>
                )}

                {/* Always-visible gradient + info at bottom */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent pt-14 pb-3 px-3 z-10 text-center">
                    <h3 className="text-white font-black text-[13px] truncate leading-tight tracking-tight drop-shadow-md" dir="ltr">
                        {album.name}
                    </h3>
                    <p className="text-white/50 text-[10px] truncate font-bold mt-1 tracking-tight" dir="ltr">
                        {album.artist?.name || 'אמן לא ידוע'}
                    </p>
                </div>

            </div>
        </motion.div>
    );
};

export default AlbumCard;
