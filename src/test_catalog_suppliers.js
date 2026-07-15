import { createClient } from '@supabase/supabase-js';

const localUrl = 'http://100.82.152.52:54321';
const remoteUrl = 'http://100.67.107.59:54321';
const key = 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';

const localSupabase = createClient(localUrl, key);
const remoteSupabase = createClient(remoteUrl, key);

try {
  const { data: localCatSuppliers, error: err1 } = await localSupabase
    .from('catalog_item_suppliers')
    .select('*');

  const { data: remoteCatSuppliers, error: err2 } = await remoteSupabase
    .from('catalog_item_suppliers')
    .select('*');

  console.log("local catalog_item_suppliers count:", localCatSuppliers?.length);
  console.log("remote catalog_item_suppliers count:", remoteCatSuppliers?.length);
} catch (err) {
  console.error("Crash:", err);
}
