import { createClient } from '@supabase/supabase-js';

const sourceUrl = 'http://100.82.152.52:54321';
const targetUrl = 'http://100.67.107.59:54321';
const key = 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';
const targetServiceKey = 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz';

const sourceSupabase = createClient(sourceUrl, key);
const targetSupabase = createClient(targetUrl, targetServiceKey);

async function syncRelationalData() {
  console.log("🚀 Syncing Music Artists and Albums Local -> Remote...");

  try {
    // 1. Sync Artists
    const { data: localArtists, error: artErr } = await sourceSupabase
      .from('music_artists')
      .select('*');
    if (artErr) throw artErr;
    console.log(`📋 Loaded ${localArtists.length} artists from local.`);

    if (localArtists.length > 0) {
      // Clean existing target artists
      await targetSupabase.from('music_artists').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      const { error: artInsertErr } = await targetSupabase
        .from('music_artists')
        .insert(localArtists);
      if (artInsertErr) throw artInsertErr;
      console.log(`✓ Synced ${localArtists.length} artists to remote.`);
    }

    // 2. Sync Albums
    const { data: localAlbums, error: albErr } = await sourceSupabase
      .from('music_albums')
      .select('*');
    if (albErr) throw albErr;
    console.log(`📋 Loaded ${localAlbums.length} albums from local.`);

    if (localAlbums.length > 0) {
      // Clean existing target albums
      await targetSupabase.from('music_albums').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      const { error: albInsertErr } = await targetSupabase
        .from('music_albums')
        .insert(localAlbums);
      if (albInsertErr) throw albInsertErr;
      console.log(`✓ Synced ${localAlbums.length} albums to remote.`);
    }

    console.log("🎉 Sync of artists and albums completed successfully!");

  } catch (err) {
    console.error("🔥 Sync Failed:", err);
  }
}

syncRelationalData();
