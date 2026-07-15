import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Pause, SkipForward, Music, Plus, Minus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

/**
 * Compact Mini Music Bar for iCaffe Headers
 * Design: Light/white theme, max 1/3 screen width
 * Embedded in individual screen headers (left side)
 */
const MiniMusicBar = ({ className = '' }) => {
    const { currentUser } = useAuth();
    const [playback, setPlayback] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [volumeLevel, setVolumeLevel] = useState(7); // Default 7 (70%)

    // Fetch initial server volume
    useEffect(() => {
        const fetchVolume = async () => {
            try {
                const res = await fetch('/api/music/volume-server');
                if (res.ok) {
                    const data = await res.json();
                    if (data.success && data.volume !== undefined) {
                        const level = Math.max(1, Math.min(10, Math.round(data.volume * 10)));
                        setVolumeLevel(level);
                    }
                }
            } catch (err) {
                console.warn('Error fetching server volume:', err);
            }
        };
        fetchVolume();
    }, []);

    const handleVolumeChange = async (direction) => {
        let nextLevel = volumeLevel;
        if (direction === 'up' && volumeLevel < 10) {
            nextLevel = volumeLevel + 1;
        } else if (direction === 'down' && volumeLevel > 1) {
            nextLevel = volumeLevel - 1;
        }
        if (nextLevel === volumeLevel) return;

        setVolumeLevel(nextLevel);

        try {
            await fetch('/api/music/volume-server', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ volume: nextLevel / 10 })
            });
        } catch (err) {
            console.error('Error setting server volume:', err);
        }
    };

    // Fetch initial playback state
    useEffect(() => {
        const fetchPlayback = async () => {
            if (!currentUser?.email) return;

            try {
                const { data } = await supabase
                    .from('music_current_playback')
                    .select('*')
                    .eq('user_email', currentUser.email)
                    .maybeSingle();

                if (data) setPlayback(data);
            } catch (err) {
                console.error('Error fetching playback:', err);
            }
        };

        fetchPlayback();
    }, [currentUser?.id]);

    // Subscribe to realtime updates
    useEffect(() => {
        if (!currentUser?.email) return;

        const channel = supabase
            .channel('playback-updates')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'music_current_playback',
                    filter: `user_email=eq.${currentUser.email}`
                },
                (payload) => {
                    if (payload.new) {
                        setPlayback(payload.new);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [currentUser?.email]);

    // Send command to RanTunes via Supabase
    const sendCommand = async (command) => {
        if (!currentUser?.email || isLoading) return;

        setIsLoading(true);
        try {
            await supabase
                .from('music_commands')
                .insert({
                    user_email: currentUser.email,
                    user_id: currentUser.id,
                    command: command,
                    created_at: new Date().toISOString()
                });
        } catch (err) {
            console.error('Error sending command:', err);
        } finally {
            setIsLoading(false);
        }
    };

    // Rate the current song
    const rateSong = async (rating) => {
        if (!playback?.song_id || !currentUser?.id) return;

        try {
            await supabase
                .from('rantunes_ratings')
                .upsert({
                    song_id: playback.song_id,
                    user_id: currentUser.id,
                    rating: rating,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id, song_id' });

            setPlayback(prev => ({ ...prev, userRating: rating }));
        } catch (err) {
            console.error('Error rating song:', err);
        }
    };

    // Parse title: Extract content in parentheses or after a dash
    const parseTitle = (title) => {
        if (!title) return { main: '', sub: '' };
        let main = title;
        let subParts = [];
        if (main.includes(' - ')) {
            const parts = main.split(' - ');
            main = parts[0];
            subParts.push(...parts.slice(1));
        } else if (main.includes(' – ')) {
            const parts = main.split(' – ');
            main = parts[0];
            subParts.push(...parts.slice(1));
        }
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

    const navigate = useNavigate();

    // Open RanTunes internal page
    const openRanTunes = () => {
        navigate('/music');
    };

    // Don't render if user not logged in or no playback
    if (!currentUser || !currentUser.email || !playback || !playback.song_title) {
        return null;
    }

    const isLiked = playback.userRating === 5;
    const isDisliked = playback.userRating === 1;

    return (
        <div
            className={`flex items-center gap-2 bg-gray-100 hover:bg-gray-200 rounded-xl px-3 py-1.5 transition-all max-w-[340px] min-w-[200px] ${className}`}
            dir="ltr"
        >
            {/* Mini Vinyl Record */}
            <div
                className={`w-8 h-8 rounded-full overflow-hidden shrink-0 cursor-pointer shadow-lg bg-[#111] relative flex items-center justify-center border border-black/20
                    ${playback.is_playing ? 'animate-[spin_4s_linear_infinite]' : ''}`}
                onClick={openRanTunes}
            >
                {/* Vinyl Grooves */}
                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle,_transparent_30%,_rgba(255,255,255,0.1)_35%,_transparent_40%,_rgba(255,255,255,0.1)_45%,_transparent_50%)]" />

                <div className="w-4 h-4 rounded-full overflow-hidden border border-black/20 flex items-center justify-center bg-white z-10">
                    {playback.cover_url ? (
                        <img
                            src={playback.cover_url}
                            alt={playback.album_name || 'Album'}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-200">
                            <Music className="w-2 h-2 text-gray-400" />
                        </div>
                    )}
                    <div className="w-1 h-1 rounded-full bg-black absolute z-30" />
                </div>
            </div>

            {/* Song & Artist */}
            <div className="min-w-0 flex-1 cursor-pointer text-left" onClick={openRanTunes}>
                <p className="text-gray-800 text-xs font-bold truncate leading-tight">
                    {parseTitle(playback.song_title).main}
                </p>
                {parseTitle(playback.song_title).sub ? (
                    <p className="text-gray-400 text-[8px] font-bold uppercase tracking-widest truncate leading-tight mt-0.5">
                        {parseTitle(playback.song_title).sub}
                    </p>
                ) : (
                    <p className="text-gray-500 text-[10px] truncate leading-tight">
                        {playback.artist_name}
                    </p>
                )}
            </div>

            {/* Controls */}
            <div className="flex items-center gap-1 shrink-0">
                {/* Play/Pause */}
                <button
                    onClick={() => sendCommand(playback.is_playing ? 'pause' : 'play')}
                    disabled={isLoading}
                    className="w-7 h-7 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-all"
                    title={playback.is_playing ? 'השהה' : 'נגן'}
                >
                    {playback.is_playing ? (
                        <Pause className="w-3 h-3 text-gray-700 fill-gray-700" />
                    ) : (
                        <Play className="w-3 h-3 text-gray-700 fill-gray-700" />
                    )}
                </button>

                {/* Volume Controller (Minus, Value Display, Plus) */}
                <div className="flex items-center bg-gray-200 rounded-full px-1 py-0.5" dir="ltr">
                    <button
                        onClick={() => handleVolumeChange('down')}
                        className="w-5 h-5 rounded-full hover:bg-gray-300 flex items-center justify-center transition-all text-gray-600 hover:text-gray-900"
                        title="החלש ווליום בשרת"
                    >
                        <Minus className="w-2.5 h-2.5" />
                    </button>
                    <span className="w-5 text-center text-[10px] font-bold text-gray-700 select-none">
                        {volumeLevel}
                    </span>
                    <button
                        onClick={() => handleVolumeChange('up')}
                        className="w-5 h-5 rounded-full hover:bg-gray-300 flex items-center justify-center transition-all text-gray-600 hover:text-gray-900"
                        title="הגבר ווליום בשרת"
                    >
                        <Plus className="w-2.5 h-2.5" />
                    </button>
                </div>

                {/* Next */}
                <button
                    onClick={() => sendCommand('next')}
                    disabled={isLoading}
                    className="w-6 h-6 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-200 flex items-center justify-center transition-all"
                    title="שיר הבא"
                >
                    <SkipForward className="w-3 h-3" />
                </button>
            </div>
        </div>
    );
};

export default MiniMusicBar;
