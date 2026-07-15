import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export const useAlbums = () => {
    const { currentUser } = useAuth();
    const [artists, setArtists] = useState([]);
    const [albums, setAlbums] = useState([]);
    const [playlists, setPlaylists] = useState([]);
    const [songs, setSongs] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    // Fetch Ratings Map directly using Supabase
    const fetchRatingsMap = useCallback(async (songIds) => {
        if (!currentUser?.id) {
            return new Map();
        }
        try {
            const { data, error } = await supabase
                .from('music_ratings')
                .select('song_id, rating')
                .in('song_id', songIds)
                .eq('employee_id', currentUser.id);
            if (error) throw error;
            const m = new Map();
            (data || []).forEach(r => m.set(r.song_id, r.rating));
            return m;
        } catch {
            return new Map();
        }
    }, [currentUser?.id]);

    // Fetch Favorites (Songs rated 5)
    const fetchFavoritesSongs = useCallback(async () => {
        if (!currentUser?.id) return [];
        try {
            const { data: rated, error: rErr } = await supabase
                .from('music_ratings')
                .select('song_id')
                .eq('employee_id', currentUser.id)
                .eq('rating', 5);
            if (rErr) throw rErr;
            const songIds = (rated || []).map(r => r.song_id);
            if (songIds.length === 0) return [];
            
            const { data: songs, error: sErr } = await supabase
                .from('music_songs')
                .select('*')
                .in('id', songIds);
            if (sErr) throw sErr;
            return songs || [];
        } catch (err) {
            console.error('Error fetching favorites:', err);
            return [];
        }
    }, [currentUser?.id]);

    // Fetch all artists dynamically from music_songs list
    const fetchArtists = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('music_songs')
                .select('artist_name')
                .order('artist_name');
            if (error) throw error;
            const uniqueNames = [...new Set(data.map(s => s.artist_name).filter(Boolean))];
            const artistList = uniqueNames.map(name => ({
                id: `artist:${name}`,
                name: name,
                image_url: null
            }));
            setArtists(artistList);
        } catch (err) {
            console.error('Error fetching artists:', err);
            setError(err.message);
        }
    }, []);

    // Fetch all albums dynamically from music_songs list
    const fetchAlbums = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('music_songs')
                .select('album_name, artist_name, album_artist, thumbnail_url')
                .order('album_name');
            if (error) throw error;
            
            const albumMap = new Map();
            data.forEach(s => {
                const albumArtist = s.album_artist || s.artist_name || 'Unknown Artist';
                const key = `${s.album_name}|||${albumArtist}`;
                if (!albumMap.has(key)) {
                    albumMap.set(key, {
                        id: `album:${s.album_name}|||${albumArtist}`,
                        name: s.album_name || 'Singles',
                        artist_name: albumArtist,
                        artist: { name: albumArtist },
                        cover_url: s.thumbnail_url || null
                    });
                }
            });
            setAlbums(Array.from(albumMap.values()));
        } catch (err) {
            console.error('Error fetching albums:', err);
            setError(err.message);
        }
    }, []);

    // Fetch all playlists
    const fetchPlaylists = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('music_playlists')
                .select('*')
                .order('name');
            if (error) throw error;
            setPlaylists(data || []);
        } catch (err) {
            console.error('Error fetching playlists:', err);
            setError(err.message);
        }
    }, []);

    // Delete a song
    const deleteSong = useCallback(async (songId) => {
        try {
            const { error } = await supabase
                .from('music_songs')
                .delete()
                .eq('id', songId);
            if (error) throw error;
            setSongs(prev => prev.filter(s => s.id !== songId));
            return true;
        } catch (err) {
            console.error('Error deleting song:', err);
            return false;
        }
    }, []);

    // Delete an album (dummy function for signature compatibility)
    const deleteAlbum = useCallback(async () => {
        return true;
    }, []);

    // Delete an artist (dummy function for signature compatibility)
    const deleteArtist = useCallback(async () => {
        return true;
    }, []);

    // Archive an item (dummy function for signature compatibility)
    const archiveItem = useCallback(async () => {
        return true;
    }, []);

    // Delete a playlist
    const deletePlaylist = useCallback(async (playlistId) => {
        try {
            const { error } = await supabase
                .from('music_playlists')
                .delete()
                .eq('id', playlistId);
            if (error) throw error;
            setPlaylists(prev => prev.filter(p => p.id !== playlistId));
            return true;
        } catch (err) {
            console.error('Error deleting playlist:', err);
            return false;
        }
    }, []);

    // Remove song from playlist
    const removePlaylistSong = useCallback(async (entryId) => {
        try {
            const { error } = await supabase
                .from('music_playlist_songs')
                .delete()
                .eq('id', entryId);
            if (error) throw error;
            return true;
        } catch (err) {
            console.error('Error removing playlist song:', err);
            return false;
        }
    }, []);

    // Add song to playlist
    const addSongToPlaylist = useCallback(async (playlistId, songId) => {
        try {
            const { data: maxPos } = await supabase
                .from('music_playlist_songs')
                .select('position')
                .eq('playlist_id', playlistId)
                .order('position', { ascending: false })
                .limit(1);

            const nextPos = (maxPos?.[0]?.position || 0) + 1;

            const { data, error } = await supabase
                .from('music_playlist_songs')
                .insert({
                    playlist_id: playlistId,
                    song_id: songId,
                    position: nextPos
                })
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (err) {
            console.error('Error adding playlist song:', err);
            return null;
        }
    }, []);

    // Fetch songs for a playlist
    const fetchPlaylistSongs = useCallback(async (playlistId) => {
        try {
            setIsLoading(true);
            const { data, error } = await supabase
                .from('music_playlist_songs')
                .select(`
                    id,
                    position,
                    song:music_songs (
                        id,
                        title,
                        album_id,
                        artist_id,
                        track_number,
                        duration_seconds,
                        file_path,
                        file_name,
                        bpm,
                        album:music_albums (
                            id,
                            name,
                            cover_url
                        ),
                        artist:music_artists (
                            id,
                            name
                        )
                    )
                `)
                .eq('playlist_id', playlistId)
                .order('position');
            if (error) throw error;
            const songs = (data || []).map(item => {
                const s = item.song;
                if (!s) return null;
                return {
                    ...s,
                    artist_name: s.artist?.name,
                    album_name: s.album?.name,
                    playlist_song_entry_id: item.id,
                    position: item.position
                };
            }).filter(Boolean);
            const ratingMap = await fetchRatingsMap(songs.map(s => s.id).filter(Boolean));
            return songs.map(s => ({ ...s, myRating: ratingMap.get(s.id) || 0 }));
        } catch (err) {
            console.error('Error fetching playlist songs:', err);
            setError(err.message);
            return [];
        } finally {
            setIsLoading(false);
        }
    }, [fetchRatingsMap]);

    // Fetch songs for an album matching album_name
    const fetchAlbumSongs = useCallback(async (albumId) => {
        try {
            setIsLoading(true);
            let cleanAlbumName = albumId;
            let albumArtist = null;
            if (albumId?.startsWith('album:')) {
                const parts = albumId.substring(6).split('|||');
                cleanAlbumName = parts[0];
                if (parts.length > 1) {
                    albumArtist = parts[1];
                }
            }

            let query = supabase
                .from('music_songs')
                .select('*')
                .eq('album_name', cleanAlbumName);

            if (albumArtist) {
                query = query.eq('album_artist', albumArtist);
            }

            const { data, error } = await query
                .order('track_number', { ascending: true })
                .order('title', { ascending: true });
            if (error) throw error;
            const ratingMap = await fetchRatingsMap((data || []).map(s => s.id).filter(Boolean));
            return (data || []).map(s => ({ ...s, myRating: ratingMap.get(s.id) || 0 }));
        } catch (err) {
            console.error('Error fetching album songs:', err);
            setError(err.message);
            return [];
        } finally {
            setIsLoading(false);
        }
    }, [fetchRatingsMap]);

    // Fetch all songs
    const fetchAllSongs = useCallback(async () => {
        try {
            setIsLoading(true);
            const { data, error } = await supabase
                .from('music_songs')
                .select('*')
                .order('title');
            if (error) throw error;
            setSongs(data || []);
            return data || [];
        } catch (err) {
            console.error('Error fetching songs:', err);
            setError(err.message);
            return [];
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Get songs by artist
    const fetchArtistSongs = useCallback(async (artistName) => {
        try {
            setIsLoading(true);
            const { data, error } = await supabase
                .from('music_songs')
                .select('*')
                .eq('artist_name', artistName)
                .order('title');
            if (error) throw error;
            return data || [];
        } catch (err) {
            console.error('Error fetching artist songs:', err);
            setError(err.message);
            return [];
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Update song details
    const updateSongDetails = useCallback(async (songId, title, artistName, playlistId, bpm) => {
        try {
            const { error } = await supabase
                .from('music_songs')
                .update({ title, artist_name: artistName, bpm })
                .eq('id', songId);
            if (error) throw error;
            
            if (playlistId) {
                await addSongToPlaylist(playlistId, songId);
            }
            
            await fetchAllSongs();
            await fetchPlaylists();
            return { success: true, message: 'פרטי השיר עודכנו בהצלחה' };
        } catch (err) {
            console.error('Error in updateSongDetails:', err);
            return { success: false, message: err.message };
        }
    }, [fetchAllSongs, fetchPlaylists, addSongToPlaylist]);

    // Fetch playlist ID for a song
    const fetchSongPlaylistId = useCallback(async (songId) => {
        try {
            const { data, error } = await supabase
                .from('music_playlist_songs')
                .select('playlist_id')
                .eq('song_id', songId)
                .limit(1)
                .maybeSingle();
            if (error) throw error;
            return data?.playlist_id || null;
        } catch (err) {
            console.error('Error fetching song playlist:', err);
            return null;
        }
    }, []);

    // Reorder playlist songs
    const reorderPlaylistSongs = useCallback(async (playlistId, reorderedSongs) => {
        try {
            setIsLoading(true);
            const updates = reorderedSongs.map((song, index) => ({
                id: song.playlist_song_entry_id, // The primary key of the row in music_playlist_songs
                playlist_id: playlistId,
                song_id: song.id, // The song's ID in music_songs
                position: index + 1 // Keep it 1-based indexing for consistency
            }));

            const { error } = await supabase
                .from('music_playlist_songs')
                .upsert(updates, { onConflict: 'id' });

            if (error) throw error;
            return { success: true };
        } catch (err) {
            console.error('Error reordering playlist songs:', err);
            return { success: false, error: err };
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Initial load
    useEffect(() => {
        fetchArtists();
        fetchAlbums();
        fetchPlaylists();
    }, [fetchArtists, fetchAlbums, fetchPlaylists]);

    return {
        artists,
        albums,
        playlists,
        songs,
        isLoading,
        error,
        fetchArtists,
        fetchAlbums,
        fetchAlbumSongs,
        fetchAllSongs,
        fetchArtistSongs,
        fetchPlaylists,
        fetchPlaylistSongs,
        fetchFavoritesSongs,
        deletePlaylist,
        deleteSong,
        deleteAlbum,
        deleteArtist,
        archiveItem,
        removePlaylistSong,
        addSongToPlaylist,
        updateSongDetails,
        fetchSongPlaylistId,
        reorderPlaylistSongs,

        isMusicDriveConnected: true,
        diskStatus: { mounted: true, path: '/Volumes/RanTunesBackup' },
        checkMusicDriveConnection: useCallback(async () => true, []),
        refreshAll: async () => {
            await fetchArtists();
            await fetchAlbums();
            await fetchPlaylists();
            await fetchAllSongs();
        }
    };
};

export default useAlbums;
