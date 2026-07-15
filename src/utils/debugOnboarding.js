/**
 * 🕵️‍♂️ iCaffeOS Data Flow Debugger
 * Run this in the Browser Console (F12) while on the /menu-editor page.
 * It will test the Store, Supabase Sync, and Modifiers persistence.
 */
async function runOnboardingDebug() {
    console.log("%c🚀 Starting Data Flow Audit...", "color: #6366f1; font-weight: bold; font-size: 1.2rem;");

    try {
        const store = window.useOnboardingStore;
        if (!store) {
            console.error("❌ Store not found on window. Make sure it's exported or accessible.");
            // Try to find it via a hack if not on window
            return;
        }

        const state = store.getState();
        const { businessId, items, updateItem, addNewItem } = state;

        console.log("📊 %cCurrent State:", "font-weight: bold;", {
            businessId,
            itemCount: items.length,
            isLoading: state.isLoading,
            sessionId: state.sessionId
        });

        if (!businessId) {
            console.warn("⚠️ No businessId found. Are you logged in?");
            return;
        }

        // 1. Create a Test Item
        console.log("🛠️ %cStep 1: Creating Test Item...", "color: #indigo-500; font-weight: bold;");
        const newItem = addNewItem("Debug_Test");
        console.log("✅ Created item:", newItem);

        // 2. Add a Modifier to the item
        console.log("🧪 %cStep 2: Adding Modifiers...", "color: #indigo-500; font-weight: bold;");
        const testModifiers = [{
            name: "Debug Group",
            requirement: "O",
            logic: "A",
            minSelection: 0,
            maxSelection: 1,
            items: [{ name: "Test Option", price: 5 }]
        }];

        await updateItem(newItem.id, {
            name: "Debug Burger " + Date.now(),
            modifiers: testModifiers
        });
        console.log("✅ Update called for modifiers.");

        // 3. Verify Local Persistence (Dexie)
        console.log("💾 %cStep 3: Checking Local Persistence...", "color: #indigo-500; font-weight: bold;");
        // We can't easily wait for Dexie from here without importing, but we can check store state again
        const updatedItem = store.getState().items.find(i => i.id === newItem.id);
        if (updatedItem?.modifiers?.length > 0) {
            console.log("✅ Modifiers exist in Store memory.");
        } else {
            console.error("❌ Modifiers missing from Store memory!");
        }

        // 4. Verify Supabase Sync
        console.log("☁️ %cStep 4: Checking Supabase Sync...", "color: #indigo-500; font-weight: bold;");
        // We'll give it a moment to finish the async update
        await new Promise(r => setTimeout(r, 2000));

        const { data, error } = await window.supabase
            .from('menu_items')
            .select('id, name, modifiers')
            .eq('business_id', businessId)
            .eq('name', updatedItem.name)
            .single();

        if (error) {
            console.error("❌ Supabase fetch failed:", error);
        } else if (data && data.modifiers?.length > 0) {
            console.log("%c🎯 SUCCESS! Modifiers synced to Cloud DB:", "color: #10b981; font-weight: bold;", data.modifiers);
            console.log("%cClean up: Deleting debug item...", "color: #94a3b8;");
            await state.deleteItem(newItem.id);
        } else {
            console.error("❌ Supabase record found but MODIFIERS ARE EMPTY!", data);
        }

    } catch (err) {
        console.error("💥 Debugger crashed:", err);
    }
}

// Attach to window so user can run it
window.runOnboardingDebug = runOnboardingDebug;
console.log("%c✅ Debugger Loaded! Type 'runOnboardingDebug()' and press Enter.", "color: #10b981; font-weight: bold;");
