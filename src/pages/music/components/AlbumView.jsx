import React, { useState, useEffect } from 'react';
import { ArrowRight, Play, Clock, Music, Sparkles, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { useMusic } from '@/context/MusicContext';
import { useAlbums } from '@/hooks/useAlbums';
import SongRow from '@/components/music/SongRow';
import QueueModeModal from '@/components/music/QueueModeModal';
import '@/styles/music.css';

import { getBackendApiUrl, getCoverUrl } from '@/utils/apiUtils';

const MUSIC_API_URL = getBackendApiUrl();

/**
 * Album view component - shows album details and song list
 */
const AlbumView = ({ album, onBack }) => {
    const { playSong, currentSong, isPlaying, rateSong, addToQueue, addPlaylistToQueue } = useMusic();
    const { fetchAlbumSongs } = useAlbums();

    const [songs, setSongs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [queueContext, setQueueContext] = useState(null); // { item, type: 'song'|'album' }

    // Fetch album songs on mount
    useEffect(() => {
        const loadSongs = async () => {
            setIsLoading(true);
            const albumSongs = await fetchAlbumSongs(album.id);
            setSongs(albumSongs);
            setIsLoading(false);
        };

        if (album?.id) {
            loadSongs();
        }
    }, [album?.id, fetchAlbumSongs]);

    // Handle play all
    const handlePlayAll = () => {
        if (songs.length > 0) {
            playSong(songs[0], songs, true);
        }
    };

    // Handle song play - Immediate play based on user request
    const handleSongPlay = (song) => {
        if ((song?.myRating || 0) === 1) return; // Skip if disliked
        playSong(song, songs, true);
    };

    // Handle rating
    const handleRate = async (songId, rating) => {
        await rateSong(songId, rating);
    };

    // Handle add to queue selection
    const handleQueueSelect = (mode) => {
        if (!queueContext) return;

        if (queueContext.type === 'album') {
            addPlaylistToQueue(songs, mode);
        } else {
            addToQueue(queueContext.item, mode);
        }
        setQueueContext(null);
    };


    // Calculate total duration
    const totalDuration = songs.reduce((sum, s) => sum + (s.duration_seconds || 0), 0);
    const formatTotalDuration = () => {
        const hours = Math.floor(totalDuration / 3600);
        const mins = Math.floor((totalDuration % 3600) / 60);
        if (hours > 0) {
            return `${hours} שעות ${mins} דקות`;
        }
        return `${mins} דקות`;
    };

    // Generate gradient based on album name - Wood Tones
    const getGradient = () => {
        const gradients = [
            'linear-gradient(135deg, #4e342e 0%, #3e2723 100%)', // Wood 1
            'linear-gradient(135deg, #5d4037 0%, #4e342e 100%)', // Wood 2
            'linear-gradient(135deg, #3e2723 0%, #1a0f0e 100%)', // Wood 3
            'linear-gradient(135deg, #795548 0%, #5d4037 100%)', // Wood 4
            'linear-gradient(135deg, #8d6e63 0%, #6d4c41 100%)'  // Wood 5
        ];
        const index = (album.name?.charCodeAt(0) || 0) % gradients.length;
        return gradients[index];
    };

    return (
        <div className="min-h-full">
            {/* Header with album info */}
            <div
                className="relative p-6 pb-32"
                style={{ background: getGradient() }}
            >
                {/* Back button */}
                <button
                    onClick={onBack}
                    className="absolute top-4 right-4 w-10 h-10 rounded-full music-glass 
                    flex items-center justify-center z-10"
                >
                    <ArrowRight className="w-5 h-5 text-white" />
                </button>

                {/* Album info */}
                <div className="flex items-end gap-6 mt-8">
                    {/* Cover */}
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="w-48 h-48 rounded-2xl shadow-2xl overflow-hidden flex-shrink-0"
                    >
                        {album.cover_url ? (
                            <img
                                src={getCoverUrl(album.cover_url, album.id)}
                                alt={album.name}
                                className="w-full h-full object-cover"
                                onError={(e) => { e.target.style.display = 'none'; }}
                            />
                        ) : (
                            <div className="w-full h-full music-glass flex items-center justify-center">
                                <Music className="w-20 h-20 text-white/30" />
                            </div>
                        )}
                    </motion.div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                        <p className="text-white/70 text-sm font-medium mb-1">אלבום</p>
                        <div className="flex items-center gap-4 mb-2">
                            <h1 className="text-white text-5xl font-black truncate drop-shadow-lg" dir="ltr" style={{ textAlign: 'right' }}>
                                {album.name}
                            </h1>
                            <button
                                onClick={() => setQueueContext({ item: album, type: 'album' })}
                                className="group relative"
                                title="הוסף אלבום לתור"
                            >
                                <div className="absolute inset-0 bg-white/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                                <div className="relative w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center transition-all group-hover:scale-110 group-hover:bg-white/20 group-active:scale-95 shadow-2xl">
                                    <Plus className="w-7 h-7 text-white" />
                                </div>
                            </button>
                        </div>
                        <p className="text-white/80 text-lg mb-4">
                            {album.artist?.name || 'אמן לא ידוע'}
                        </p>
                        <div className="flex items-center gap-4 text-white/60 text-sm">
                            {album.release_year && (
                                <span>{album.release_year}</span>
                            )}
                            <span>•</span>
                            <span>{songs.length} שירים</span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                {formatTotalDuration()}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Gradient fade */}
                <div className="absolute bottom-0 left-0 right-0 h-32 
                       bg-gradient-to-t from-[#1a1a2e] to-transparent" />
            </div>

            {/* Song list */}
            <div className="bg-[#1a1a2e] px-4 pb-32 -mt-20">
                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="w-8 h-8 border-3 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
                    </div>
                ) : songs.length === 0 ? (
                    <div className="text-center py-12">
                        <Music className="w-12 h-12 text-white/20 mx-auto mb-4" />
                        <p className="text-white/40">אין שירים באלבום זה</p>
                    </div>
                ) : (
                    <div className="space-y-1">
                        {songs.map((song, index) => (
                            <SongRow
                                key={song.id}
                                song={song}
                                index={index}
                                isPlaying={isPlaying}
                                isCurrentSong={currentSong?.id === song.id}
                                onPlay={handleSongPlay}
                                onRate={handleRate}
                                onQueue={(item) => setQueueContext({ item, type: 'song' })}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Queue Modal */}
            <QueueModeModal
                isOpen={!!queueContext}
                onClose={() => setQueueContext(null)}
                onSelect={handleQueueSelect}
                title={queueContext?.type === 'album' ? album.name : (queueContext?.item?.main || queueContext?.item?.title)}
            />
        </div>
    );
};

export default AlbumView;
