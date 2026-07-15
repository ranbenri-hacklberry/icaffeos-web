import { createClient } from '@supabase/supabase-js';

const remoteUrl = 'http://100.67.107.59:54321';
const targetServiceKey = 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz';

const remoteSupabase = createClient(remoteUrl, targetServiceKey);

async function runUpdate() {
  console.log("🚀 Running playlist updates ONLY on REMOTE DB...");

  const playlistToDeleteId = '41424966-dd77-4b6e-895b-2718403dc171'; // ארץ ישראל הישנה
  const playlistToRenameId = '6f0d9e48-fdcc-4f52-a8ff-a19664049887'; // 2000+
  const newName = 'ישראלים חדשים ישנים';

  try {
    // 1. Delete on Remote
    const { error: remoteDelErr } = await remoteSupabase
      .from('music_playlists')
      .delete()
      .eq('id', playlistToDeleteId);
    if (remoteDelErr) console.error("Remote Delete Error:", remoteDelErr);
    else console.log("✓ Deleted 'ארץ ישראל הישנה' on remote DB.");

    // 2. Rename on Remote
    const { error: remoteRenameErr } = await remoteSupabase
      .from('music_playlists')
      .update({ name: newName })
      .eq('id', playlistToRenameId);
    if (remoteRenameErr) console.error("Remote Rename Error:", remoteRenameErr);
    else console.log(`✓ Renamed '2000+' to '${newName}' on remote DB.`);

  } catch (err) {
    console.error("Crash:", err);
  }
}

runUpdate();
