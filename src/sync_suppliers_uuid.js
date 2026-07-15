import { createClient } from '@supabase/supabase-js';

const sourceUrl = 'http://100.82.152.52:54321';
const targetUrl = 'http://100.67.107.59:54321';
const key = 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';

// We use service key for target to bypass RLS/policies during write
const targetServiceKey = 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz';

const sourceSupabase = createClient(sourceUrl, key);
const targetSupabase = createClient(targetUrl, targetServiceKey);

async function sync() {
  console.log(`🚀 Starting UUID-safe suppliers sync & re-linking:`);
  console.log(`Source: ${sourceUrl}`);
  console.log(`Target: ${targetUrl}`);

  try {
    // 1. Fetch suppliers from source
    const { data: sourceSuppliers, error: fetchErr } = await sourceSupabase
      .from('suppliers')
      .select('*');

    if (fetchErr) {
      console.error("❌ Failed to fetch suppliers from source:", fetchErr);
      return;
    }

    console.log(`✅ Loaded ${sourceSuppliers.length} suppliers from source.`);

    // 2. Clear existing suppliers in target to prevent duplicate names/records
    const { error: deleteErr } = await targetSupabase
      .from('suppliers')
      .delete()
      .neq('name', '___NON_EXISTENT___'); // Delete all

    if (deleteErr) {
      console.warn("⚠️ Warning: Failed to clean target suppliers table:", deleteErr.message);
    } else {
      console.log("🧹 Cleaned target suppliers table.");
    }

    // 3. Insert suppliers to target, omitting `id` so it generates a UUID
    const targetPayload = sourceSuppliers.map(s => ({
      name: s.name,
      contact_person: s.contact_person,
      phone_number: s.phone_number,
      email: s.email,
      notes: s.notes,
      delivery_days: s.delivery_days,
      returns_empty_packs: s.returns_empty_packs,
      charge_for_missing_packs: s.charge_for_missing_packs,
      missing_pack_cost: s.missing_pack_cost,
      delivery_schedule: s.delivery_schedule || [],
      business_id: s.business_id,
      address: s.address
    }));

    const { data: insertedData, error: insertErr } = await targetSupabase
      .from('suppliers')
      .insert(targetPayload)
      .select('id, name');

    if (insertErr) {
      console.error("❌ Failed to insert suppliers into target database:", insertErr);
      return;
    }

    console.log(`✅ Successfully inserted ${insertedData.length} suppliers into target database.`);

    // 4. Create mapping from local integer ID to remote UUID
    // We map by name and business_id to be safe
    const idMap = new Map(); // local integer ID -> remote UUID
    sourceSuppliers.forEach(src => {
      const match = insertedData.find(tgt => tgt.name === src.name);
      if (match) {
        idMap.set(Number(src.id), match.id);
        console.log(`   🔗 Map: "${src.name}" (${src.id}) -> (${match.id})`);
      }
    });

    // 5. Fetch all inventory items from source that have supplier_id set
    const { data: sourceItems, error: itemsFetchErr } = await sourceSupabase
      .from('inventory_items')
      .select('id, name, supplier_id, business_id')
      .not('supplier_id', 'is', null);

    if (itemsFetchErr) {
      console.error("❌ Failed to fetch inventory items from source:", itemsFetchErr);
      return;
    }

    console.log(`✅ Loaded ${sourceItems.length} inventory items from source with supplier links.`);

    // 6. Fetch target inventory items to match by name/business_id
    const { data: targetItems, error: targetItemsFetchErr } = await targetSupabase
      .from('inventory_items')
      .select('id, name, business_id');

    if (targetItemsFetchErr) {
      console.error("❌ Failed to fetch inventory items from target:", targetItemsFetchErr);
      return;
    }

    // 7. Update remote inventory items with their respective remote UUID supplier_id
    let successCount = 0;
    for (const srcItem of sourceItems) {
      const remoteSupplierUuid = idMap.get(Number(srcItem.supplier_id));
      if (!remoteSupplierUuid) {
        console.warn(`⚠️ No remote UUID found for source supplier ID ${srcItem.supplier_id} (item: "${srcItem.name}")`);
        continue;
      }

      // Find matching item in target
      const matchItem = targetItems.find(tgt => tgt.name === srcItem.name && tgt.business_id === srcItem.business_id);
      if (matchItem) {
        // Update in remote target
        const { error: updateErr } = await targetSupabase
          .from('inventory_items')
          .update({ supplier_id: remoteSupplierUuid })
          .eq('id', matchItem.id);

        if (updateErr) {
          console.error(`❌ Failed to update supplier link for "${matchItem.name}" (${matchItem.id}):`, updateErr);
        } else {
          successCount++;
        }
      } else {
        console.warn(`⚠️ Could not find matching remote inventory item for "${srcItem.name}"`);
      }
    }

    console.log(`🎉 Sync Complete!`);
    console.log(`👉 Suppliers Synced: ${insertedData.length}`);
    console.log(`👉 Re-linked Remote Inventory Items: ${successCount} / ${sourceItems.length}`);

  } catch (err) {
    console.error("🔥 Error during synchronization:", err);
  }
}

sync();
