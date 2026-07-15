import { createClient } from '@supabase/supabase-js';

const url = 'http://100.67.107.59:54321';
const key = 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';
const businessId = '11111111-1111-1111-1111-111111111111';

const supabase = createClient(url, key);

try {
  const { data, error } = await supabase.from('menu_items')
    .select('id, name, price, sale_price, category, category_id, is_hot_drink, kds_routing_logic, allow_notes, is_in_stock, description, modifiers, image_url, inventory_settings, is_deleted, kds_station, production_area, display_kds')
    .eq('business_id', businessId)
    .not('is_deleted', 'eq', true)
    .order('id', { ascending: true });

  if (error) {
    console.error("❌ Menu items select query failed:", error);
  } else {
    console.log("✅ Query succeeded! Items count:", data.length);
  }
} catch (err) {
  console.error("🔥 Query crashed:", err);
}
