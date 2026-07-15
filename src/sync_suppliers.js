import { createClient } from '@supabase/supabase-js';

const sourceUrl = 'http://100.82.152.52:54321';
const targetUrl = 'http://100.67.107.59:54321';
const key = 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';

// We use service key for target to bypass RLS/policies if any are active
const targetServiceKey = 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz';

const sourceSupabase = createClient(sourceUrl, key);
const targetSupabase = createClient(targetUrl, targetServiceKey);

async function sync() {
  console.log(`🚀 Starting suppliers sync: ${sourceUrl} -> ${targetUrl}`);
  
  try {
    // 1. Fetch from source
    const { data: sourceSuppliers, error: fetchErr } = await sourceSupabase
      .from('suppliers')
      .select('*');

    if (fetchErr) {
      console.error("❌ Failed to fetch suppliers from source:", fetchErr);
      return;
    }

    console.log(`✅ Loaded ${sourceSuppliers.length} suppliers from source.`);

    if (sourceSuppliers.length === 0) {
      console.log("No suppliers to sync.");
      return;
    }

    // 2. Insert/Upsert into target
    const { data: result, error: insertErr } = await targetSupabase
      .from('suppliers')
      .upsert(sourceSuppliers, { onConflict: 'id' });

    if (insertErr) {
      console.error("❌ Failed to insert suppliers to target:", insertErr);
    } else {
      console.log(`🎉 Successfully synchronized ${sourceSuppliers.length} suppliers to target database!`);
    }
  } catch (err) {
    console.error("🔥 Sync crashed:", err);
  }
}

sync();
