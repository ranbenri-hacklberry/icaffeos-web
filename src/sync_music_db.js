import { createClient } from '@supabase/supabase-js';

const sourceUrl = 'http://100.82.152.52:54321';
const targetUrl = 'http://100.67.107.59:54321';
const key = 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';

// We use service key for target to bypass RLS/policies
const targetServiceKey = 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz';

const sourceSupabase = createClient(sourceUrl, key);
const targetSupabase = createClient(targetUrl, targetServiceKey);

async function syncDB() {
  console.log(`🚀 Starting Music DB Synchronization:`);
  console.log(`Source DB: ${sourceUrl}`);
  console.log(`Target DB: ${targetUrl}`);

  try {
    // 1. Fetch local playlists
    const { data: localPlaylists, error: plErr } = await sourceSupabase
      .from('music_playlists')
      .select('*');
    if (plErr) throw plErr;
    console.log(`📋 Loaded ${localPlaylists.length} playlists from local.`);

    // 2. Fetch local songs
    const { data: localSongs, error: songErr } = await sourceSupabase
      .from('music_songs')
      .select('*');
    if (songErr) throw songErr;
    console.log(`🎵 Loaded ${localSongs.length} songs from local.`);

    // 3. Fetch local playlist songs
    const { data: localPlaylistSongs, error: plsErr } = await sourceSupabase
      .from('music_playlist_songs')
      .select('*');
    if (plsErr) throw plsErr;
    console.log(`🔗 Loaded ${localPlaylistSongs.length} playlist-song links from local.`);

    // 4. Clean target database to prevent constraint/primary key conflicts
    console.log("🧹 Cleaning existing music records in target database...");
    await targetSupabase.from('music_playlist_songs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await targetSupabase.from('music_songs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await targetSupabase.from('music_playlists').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    console.log("✅ Target cleaned.");

    // 5. Upload Playlists
    if (localPlaylists.length > 0) {
      console.log("📤 Uploading playlists...");
      const { error: plInsertErr } = await targetSupabase
        .from('music_playlists')
        .insert(localPlaylists);
      if (plInsertErr) throw plInsertErr;
      console.log(`   Done: ${localPlaylists.length} playlists.`);
    }

    // 6. Upload Songs (with updated file_path)
    if (localSongs.length > 0) {
      console.log("📤 Uploading songs with updated file paths...");
      
      const mappedSongs = localSongs.map(song => {
        let cleanPath = song.file_path || '';
        // Convert MacBook path (/Users/user/) to Mac Mini path (/Users/icaffeos/)
        cleanPath = cleanPath.replace('/Users/user/', '/Users/icaffeos/');
        
        return {
          ...song,
          file_path: cleanPath
        };
      });

      // Split into batches of 100 to prevent large payload issues
      const batchSize = 100;
      for (let i = 0; i < mappedSongs.length; i += batchSize) {
        const batch = mappedSongs.slice(i, i + batchSize);
        const { error: songInsertErr } = await targetSupabase
          .from('music_songs')
          .insert(batch);
        if (songInsertErr) throw songInsertErr;
        console.log(`   Done: batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(mappedSongs.length / batchSize)}`);
      }
    }

    // 7. Upload Playlist-Song relationships
    if (localPlaylistSongs.length > 0) {
      console.log("📤 Uploading playlist-song relationships...");
      // Split into batches of 100
      const batchSize = 100;
      for (let i = 0; i < localPlaylistSongs.length; i += batchSize) {
        const batch = localPlaylistSongs.slice(i, i + batchSize);
        const { error: plsInsertErr } = await targetSupabase
          .from('music_playlist_songs')
          .insert(batch);
        if (plsInsertErr) throw plsInsertErr;
        console.log(`   Done: batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(localPlaylistSongs.length / batchSize)}`);
      }
    }

    console.log(`🎉 DB Synchronization Complete!`);
    console.log(`👉 Playlists: ${localPlaylists.length}`);
    console.log(`👉 Songs: ${localSongs.length}`);
    console.log(`👉 Links: ${localPlaylistSongs.length}`);

  } catch (err) {
    console.error("🔥 DB Sync Failed:", err);
  }
}

syncDB();
