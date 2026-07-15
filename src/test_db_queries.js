import { createClient } from '@supabase/supabase-js';

const url = 'http://100.67.107.59:54321';
const key = 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';
const businessId = '11111111-1111-1111-1111-111111111111'; // default business ID

const supabase = createClient(url, key);

console.log("Testing Supabase connection and queries to:", url);

try {
  const { data: categories, error: catError } = await supabase
    .from('item_category')
    .select('id, name, name_he')
    .eq('business_id', businessId);

  if (catError) {
    console.error("❌ Category Query Error:", catError);
  } else {
    console.log("✅ Categories found:", categories.length, categories);
  }

  const { data: items, error: itemError } = await supabase
    .from('menu_items')
    .select('id, name, price')
    .eq('business_id', businessId);

  if (itemError) {
    console.error("❌ Menu Items Query Error:", itemError);
  } else {
    console.log("✅ Menu items found:", items.length, items.slice(0, 5));
  }
} catch (err) {
  console.error("🔥 Query crashed:", err);
}
