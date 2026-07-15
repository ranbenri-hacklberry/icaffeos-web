import { createClient } from '@supabase/supabase-js';

const url = 'http://100.67.107.59:54321';
const key = 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';

const supabase = createClient(url, key);

try {
  const { data, error } = await supabase.from('music_playback_history')
    .select(`
      id,
      played_at,
      song:music_songs(title, artist_name)
    `)
    .order('played_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Recent playback history:", data);
  }
} catch (err) {
  console.error("Crash:", err);
}
