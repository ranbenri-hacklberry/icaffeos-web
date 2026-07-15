import React, { useState } from 'react';
import { X, Sparkles, Music, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAlbums } from '@/hooks/useAlbums';
import { useMusic } from '@/context/MusicContext';
import '@/styles/music.css';

/**
 * Playlist builder modal - create smart playlists based on preferences
 */
const PlaylistBuilder = ({ onClose, onSuccess }) => {
    const { artists, generateSmartPlaylist, isLoading } = useAlbums();
    const { playSong } = useMusic();

    const [playlistName, setPlaylistName] = useState('פלייליסט חדש');
    const [selectedArtists, setSelectedArtists] = useState([]);
    const [maxSongs, setMaxSongs] = useState(100);
    const [result, setResult] = useState(null);

    // Toggle artist selection
    const toggleArtist = (artistId) => {
        setSelectedArtists(prev =>
            prev.includes(artistId)
                ? prev.filter(id => id !== artistId)
                : [...prev, artistId]
        );
    };

    // Generate playlist
    const handleGenerate = async () => {
        const genResult = await generateSmartPlaylist({
            name: playlistName,
            artistIds: selectedArtists.length > 0 ? selectedArtists : null,
            maxSongs,
            saveToDb: true
        });

        setResult(genResult);

        // Auto-play and close if successful
        if (genResult.success && genResult.playlist?.songs?.length) {
            playSong(genResult.playlist.songs[0], genResult.playlist.songs);
            setTimeout(() => {
                onSuccess?.();
            }, 1000); // Small delay to let user see success message
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-[#1a1a2e] rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden"
                dir="rtl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl music-gradient-purple flex items-center justify-center">
                            <Sparkles className="w-5 h-5 text-white" />
                        </div>
                        <h2 className="text-white text-xl font-bold">בונה פלייליסט</h2>
                    </div>

                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"
                    >
                        <X className="w-5 h-5 text-white" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 overflow-y-auto max-h-[60vh] music-scrollbar">
                    {/* Playlist name */}
                    <div className="mb-6">
                        <label className="text-white/60 text-sm block mb-2">שם הפלייליסט</label>
                        <input
                            type="text"
                            value={playlistName}
                            onChange={(e) => setPlaylistName(e.target.value)}
                            className="w-full bg-white/10 border border-white/10 rounded-xl py-3 px-4
                       text-white placeholder-white/40 focus:outline-none focus:border-purple-500"
                            placeholder="לדוגמה: מיקס בוקר"
                        />
                    </div>


                    {/* Max songs */}
                    <div className="mb-6">
                        <label className="text-white/60 text-sm block mb-2">
                            מספר שירים מקסימלי: <span className="text-purple-400 font-bold">{maxSongs}</span>
                        </label>
                        <input
                            type="range"
                            min="10"
                            max="200"
                            step="10"
                            value={maxSongs}
                            onChange={(e) => setMaxSongs(parseInt(e.target.value))}
                            className="w-full music-volume-slider"
                        />
                        <div className="flex justify-between text-white/30 text-xs mt-1">
                            <span>10</span>
                            <span>200</span>
                        </div>
                    </div>

                    {/* Artist filter */}
                    <div className="mb-6">
                        <label className="text-white/60 text-sm block mb-3">
                            בחר אמנים (רשות - השאר ריק לכל האמנים)
                        </label>
                        <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto music-scrollbar">
                            {artists.map(artist => (
                                <button
                                    key={artist.id}
                                    onClick={() => toggleArtist(artist.id)}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all
                             ${selectedArtists.includes(artist.id)
                                            ? 'music-gradient-purple text-white'
                                            : 'bg-white/10 text-white/60 hover:bg-white/20'}`}
                                >
                                    {selectedArtists.includes(artist.id) && (
                                        <Check className="w-4 h-4" />
                                    )}
                                    <span className="text-sm">{artist.name}</span>
                                </button>
                            ))}
                            {artists.length === 0 && (
                                <p className="text-white/30 text-sm">אין אמנים להציג</p>
                            )}
                        </div>
                    </div>

                    {/* Result message */}
                    {result && (
                        <div className={`p-4 rounded-xl mb-4 ${result.success ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                            <p className={result.success ? 'text-green-400' : 'text-red-400'}>
                                {result.message}
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/10">
                    <button
                        onClick={handleGenerate}
                        disabled={isLoading}
                        className="w-full py-3 rounded-xl music-gradient-rainbow text-white font-bold
                      disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isLoading ? (
                            <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>
                                <Sparkles className="w-5 h-5" />
                                צור פלייליסט
                            </>
                        )}
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

export default PlaylistBuilder;
