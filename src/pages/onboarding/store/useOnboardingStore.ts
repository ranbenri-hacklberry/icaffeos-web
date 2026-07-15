import { create } from 'zustand';
import { onboarding_sessions } from '@/db/database';
import { OnboardingItem, AtmosphereSeed, ModifierLogic, ModifierRequirement } from '@/pages/onboarding/types/onboardingTypes';
import { validateMenuRow, mapRowToItem, validateModifierGroups, enrichItemVisually, generateImagePrompt, generateImageGemini, normalizeCategory, parseModifierString } from '@/pages/onboarding/logic/onboardingLogic';
import { syncModifiersToRelational } from '@/pages/onboarding/logic/modifierSync';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/lib/supabase';
// @ts-ignore
import { queueAction } from '@/services/offlineQueue';

interface OnboardingState {
    sessionId: number | null;
    businessId: number | string | null;
    businessName: string | null;
    step: number;
    items: OnboardingItem[];
    atmosphereSeeds: AtmosphereSeed[];
    isLoading: boolean;
    error: string | null;
    eventSource: EventSource | null;
    isGenerating: boolean;
    generationProgress: number;
    currentItemName: string | null;
    geminiApiKey: string | null;
    businessContext: string | null;
    aiSettings: {
        ai_prompt_template?: string;
        generation_timeout_seconds?: number;
        use_image_composition?: boolean;
        composition_style?: string;
        background_blur_radius?: number;
    } | null;
    categorySeeds: Record<string, { backgroundIds?: string[]; containerIds?: string[]; prompt?: string }>;
    setCategorySeed: (category: string, config: { backgroundIds?: string[]; containerIds?: string[]; prompt?: string }) => void;
    setGeminiApiKey: (key: string) => void;
    setBusinessContext: (context: string) => void;
    setError: (error: string | null) => void;
    initSession: (businessId: string | number) => Promise<void>;
    saveSession: () => Promise<void>;
    setStep: (step: number) => void;
    addAtmosphereSeed: (seed: AtmosphereSeed) => void;
    removeAtmosphereSeed: (id: string) => void;
    processExcelData: (rows: any[]) => Promise<void>;
    updateItem: (itemId: string, updates: Partial<OnboardingItem>, saveToCloud?: boolean) => Promise<void>;
    deleteItem: (itemId: string) => Promise<void>;
    addNewItem: (category?: string) => OnboardingItem;
    cleanupDuplicates: () => void;
    applyAtmosphereToCategory: (category: string, backgroundId?: string, containerId?: string) => void;
    startLiveGeneration: () => Promise<void>;
    cancelGeneration: () => Promise<void>;
    regenerateSingleItem: (itemId: string) => Promise<void>;
    uploadOriginalImage: (itemId: string, fileOrBase64: File | string | Blob) => Promise<string>;
    syncRecurringTasks: (businessId: string | number, menuItemId: number, item: OnboardingItem) => Promise<void>;
    exposeDebug: () => void;
}

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
    sessionId: null,
    businessId: null,
    businessName: null,
    step: 1,
    items: [],
    atmosphereSeeds: [],
    isLoading: false,
    error: null,
    isGenerating: false,
    generationProgress: 0,
    currentItemName: null,
    eventSource: null,
    geminiApiKey: localStorage.getItem('onboarding_gemini_api_key'),
    businessContext: null,
    aiSettings: null,
    categorySeeds: {},

    setCategorySeed: (category, config) => {
        set(state => ({
            categorySeeds: { ...state.categorySeeds, [category]: { ...state.categorySeeds[category], ...config } }
        }));
    },

    exposeDebug: () => {
        if (typeof window !== 'undefined') {
            (window as any).useOnboardingStore = useOnboardingStore;
            (window as any).supabase = supabase;
        }
    },

    setGeminiApiKey: async (key) => {
        localStorage.setItem('onboarding_gemini_api_key', key);
        set({ geminiApiKey: key });
        const { businessId } = get();
        if (businessId) {
            // 🔒 REFACTORED: Save to business_secrets via RPC
            await supabase.rpc('upsert_business_secret', {
                p_business_id: businessId,
                p_field: 'gemini_api_key',
                p_value: key
            });
        }
    },

    setBusinessContext: (context) => set({ businessContext: context }),
    setError: (error) => set({ error }),

    initSession: async (businessId) => {
        // 🔒 CONCURRENCY LOCK: Prevent accidental double-triggers
        if (get().isLoading) {
            console.log('⏳ initSession already in progress, skipping...');
            return;
        }

        set({ isLoading: true, businessId });
        console.log(`🚀 [initSession] Starting for ${businessId}...`);

        try {
            get().exposeDebug();

            // 🏎️ PARALLEL CORE FETCH: Get business info, menu items, and secrets in one go
            const [businessRes, menuItemsRes, secretsRes] = await Promise.all([
                supabase.from('businesses').select('name, settings').eq('id', businessId).single(),
                supabase.from('menu_items').select('*')
                    .eq('business_id', businessId)
                    .or('is_deleted.is.null,is_deleted.eq.false')
                    .order('name'),
                // 🔒 REFACTORED: Fetch API key from business_secrets
                supabase.from('business_secrets').select('gemini_api_key').eq('business_id', businessId).single()
            ]);

            if (businessRes.data) {
                const bData = businessRes.data;
                const apiKey = secretsRes.data?.gemini_api_key || (bData.settings as any)?.gemini_api_key;
                set({ businessName: bData.name, geminiApiKey: apiKey });
            }

            const cloudItems = menuItemsRes.data || [];
            const cloudMap = new Map();
            cloudItems.forEach(ci => {
                const key = `${normalizeCategory(ci.category || 'General').toLowerCase()}:${ci.name.trim().toLowerCase()}`;
                if (!cloudMap.has(key) || (!cloudMap.get(key).image_url && ci.image_url)) {
                    cloudMap.set(key, ci);
                }
            });

            const allItemIds = cloudItems.map(ci => ci.id);

            // 🏎️ PARALLEL MODIFIER FETCH: Reconstruct modifiers from relational source of truth
            let groupMapByItem = new Map();
            if (allItemIds.length > 0) {
                // Fetch group links and private groups in parallel
                const [privGroupsRes, linksRes] = await Promise.all([
                    supabase.from('optiongroups').select('*, optionvalues(*)').in('menu_item_id', allItemIds),
                    supabase.from('menuitemoptions').select('item_id, group_id').in('item_id', allItemIds)
                ]);

                privGroupsRes.data?.forEach(g => {
                    const itemId = String(g.menu_item_id);
                    if (!groupMapByItem.has(itemId)) groupMapByItem.set(itemId, []);
                    groupMapByItem.get(itemId).push(g);
                });

                const sharedGroupIds = [...new Set(linksRes.data?.map(l => l.group_id) || [])];
                if (sharedGroupIds.length > 0) {
                    const { data: sharedGroups } = await supabase.from('optiongroups').select('*, optionvalues(*)').in('id', sharedGroupIds);
                    linksRes.data?.forEach(link => {
                        const itemId = String(link.item_id);
                        const group = sharedGroups?.find(g => g.id === link.group_id);
                        if (group) {
                            if (!groupMapByItem.has(itemId)) groupMapByItem.set(itemId, []);
                            if (!groupMapByItem.get(itemId).some((g: any) => g.id === group.id)) {
                                groupMapByItem.get(itemId).push(group);
                            }
                        }
                    });
                }
            }

            // Map results to OnboardingItem interface
            const mappedCloudItems = Array.from(cloudMap.values()).map(ci => {
                let modifiers = [];
                const fetchedGroups = groupMapByItem.get(String(ci.id));

                if (fetchedGroups && fetchedGroups.length > 0) {
                    modifiers = fetchedGroups.map((g: any) => ({
                        id: g.id,
                        name: g.name,
                        requirement: g.is_required ? ModifierRequirement.MANDATORY : ModifierRequirement.OPTIONAL,
                        logic: g.is_replacement ? ModifierLogic.REPLACE : ModifierLogic.ADD,
                        minSelection: g.min_selection || (g.is_required ? 1 : 0),
                        maxSelection: g.max_selection || (g.is_multiple_select ? 10 : 1),
                        items: (g.optionvalues || []).map((v: any) => ({
                            id: v.id,
                            name: v.value_name,
                            price: v.price_adjustment || 0,
                            isDefault: v.is_default
                        })).sort((a: any, b: any) => a.price - b.price)
                    }));
                } else {
                    const raw = ci.modifiers;
                    if (typeof raw === 'string' && raw.length > 0) {
                        try { modifiers = JSON.parse(raw); } catch (e) { modifiers = parseModifierString(raw); }
                    } else if (Array.isArray(raw)) {
                        modifiers = raw;
                    }
                }

                return {
                    id: ci.id.toString(),
                    name: ci.name,
                    category: normalizeCategory(ci.category || 'General'),
                    description: ci.description || '',
                    price: ci.price || 0,
                    salePrice: ci.sale_price,
                    ingredients: ci.ingredients || [],
                    imageUrl: ci.image_url,
                    modifiers: Array.isArray(modifiers) ? modifiers : [],
                    status: ci.image_url ? 'completed' : 'pending',
                    visualDescription: ci.visual_description,
                    prompt: ci.ai_prompt,
                    productionArea: ci.production_area || 'Checker',
                    displayKDS: (ci.production_area || 'Checker').split(',').map(s=>s.trim()),
                    categoryId: ci.category_id,
                    originalImageUrls: ci.original_image_urls || [],
                    preparationMode: ci.kds_routing_logic === 'GRAB_AND_GO' ? 'ready' :
                        ci.kds_routing_logic === 'CONDITIONAL' ? 'cashier_choice' :
                            'requires_prep', // Default to MADE_TO_ORDER logic
                };
            }) as OnboardingItem[];

            // Merge with local Dexie session
            const localSession = await onboarding_sessions.where('business_id').equals(businessId).first();
            let finalItems = mappedCloudItems;

            if (localSession) {
                const existingItems = [...localSession.items];
                mappedCloudItems.forEach(cloudItem => {
                    const idx = existingItems.findIndex(li =>
                        String(li.id) === String(cloudItem.id) ||
                        (li.name.trim().toLowerCase() === cloudItem.name.trim().toLowerCase() && li.category === cloudItem.category)
                    );
                    if (idx !== -1) {
                        const existing = existingItems[idx];
                        existingItems[idx] = {
                            ...existing,
                            ...cloudItem,
                            modifiers: (cloudItem.modifiers && cloudItem.modifiers.length > 0) ? cloudItem.modifiers : (existing.modifiers || []),
                            ingredients: (cloudItem.ingredients && cloudItem.ingredients.length > 0) ? cloudItem.ingredients : (existing.ingredients || []),
                            imageUrl: (cloudItem.imageUrl && cloudItem.imageUrl.length > 5) ? cloudItem.imageUrl : existing.imageUrl,
                            originalImageUrls: (cloudItem.originalImageUrls && cloudItem.originalImageUrls.length > 0) ? cloudItem.originalImageUrls : existing.originalImageUrls
                        };
                    } else {
                        existingItems.push(cloudItem);
                    }
                });
                finalItems = existingItems;
                set({ sessionId: localSession.id, step: localSession.step, items: finalItems, atmosphereSeeds: localSession.atmosphereSeeds || [] });
            } else {
                const step = finalItems.length > 0 ? 3 : 1;
                const id = await onboarding_sessions.add({ business_id: businessId, step, items: finalItems, atmosphereSeeds: [], updated_at: Date.now() });
                set({ sessionId: id, step, items: finalItems });
            }

            console.log(`✅ [initSession] Complete. Loaded ${finalItems.length} items.`);
        } catch (err) {
            console.error('❌ [initSession] Error:', err);
            set({ error: 'שגיאה בטעינת הנתונים מהשרת. נסה לרענן.' });
        } finally {
            set({ isLoading: false });
        }
    },

    saveSession: async () => {
        const { sessionId, step, items, atmosphereSeeds } = get();
        if (!sessionId) return;
        try {
            // 🛡️ Added a safety timeout for the local DB update to prevent UI hang
            await Promise.race([
                onboarding_sessions.update(sessionId, { step, items, atmosphereSeeds, updated_at: Date.now() }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Local DB Timeout')), 5000))
            ]);
        } catch (err) {
            console.warn('⚠️ Local session save failed or timed out:', err);
        }
    },

    setStep: (step) => { set({ step }); get().saveSession(); },
    addAtmosphereSeed: (seed) => { set(state => ({ atmosphereSeeds: [...state.atmosphereSeeds, seed] })); get().saveSession(); },
    removeAtmosphereSeed: (id) => { set(state => ({ atmosphereSeeds: state.atmosphereSeeds.filter(s => s.id !== id) })); get().saveSession(); },

    processExcelData: async (rows) => {
        set({ isLoading: true });
        const items = rows.map((row, index) => {
            const item = mapRowToItem(row, uuidv4());
            item.validationErrors = validateMenuRow(row, index);
            if (item.validationErrors.length > 0) item.status = 'error';
            return item;
        });
        set({ items, isLoading: false });
        get().saveSession();
    },

    updateItem: async (itemId, updates, saveToCloud = true) => {
        let updatedItem: OnboardingItem | undefined;
        set(state => {
            const newItems = state.items.map(item => {
                if (item.id === itemId) {
                    updatedItem = { ...item, ...updates };
                    return updatedItem;
                }
                return item;
            });
            return { items: newItems };
        });

        get().saveSession();

        if (saveToCloud && updatedItem) {
            const { businessId } = get();
            if (!businessId) return;

            const item = updatedItem;
            console.log(`☁️ [Cloud Sync] Syncing item "${item.name}"...`);

            // 🔄 KDS Routing Logic Mapping
            let kdsLogic = 'MADE_TO_ORDER'; // Default to "Always Prepare"
            if (item.preparationMode === 'ready') kdsLogic = 'GRAB_AND_GO'; // Grab n Go
            else if (item.preparationMode === 'cashier_choice') kdsLogic = 'CONDITIONAL'; // Decision at POS

            const dbItem: any = {
                business_id: businessId,
                name: item.name,
                category: item.category,
                description: item.description || '',
                price: item.price || 0,
                sale_price: item.salePrice || null,
                image_url: item.imageUrl,
                modifiers: item.modifiers || [],
                // Enforce Checker lock before sending to DB
                production_area: Array.from(new Set([
                    ...(item.productionArea ? item.productionArea.split(',').map(s=>s.trim()) : []), 
                    ...(item.displayKDS || []), 
                    'Checker'
                ])).join(','),
                ingredients: item.ingredients || [],
                visual_description: item.visualDescription,
                ai_prompt: item.prompt,
                english_name: item.englishName || '',
                cost: item.cost || 0,
                kds_routing_logic: kdsLogic, // ✅ Correctly mapped field
                inventory_settings: item.inventorySettings || null,
                is_deleted: false,
                original_image_urls: item.originalImageUrls || []
            };

            const isNumericId = !isNaN(Number(itemId)) && itemId.toString().indexOf('-') === -1;

            try {
                // 🛡️ Safety timeout for Cloud DB sync
                const cloudPromise = (async () => {
                    if (isNumericId) {
                        const syncId = Number(itemId);
                        const { error } = await supabase.from('menu_items').update(dbItem).eq('id', syncId);
                        if (error) throw error;
                        await syncModifiersToRelational(syncId, item.modifiers || [], businessId); // 🆕 Sync relational tables
                        await get().syncRecurringTasks(businessId, syncId, item);
                    } else {
                        const { data, error } = await supabase.from('menu_items').insert([dbItem]).select();
                        if (error) throw error;
                        if (data?.[0]) {
                            const newId = data[0].id.toString();
                            set(state => ({ items: state.items.map(i => i.id === itemId ? { ...i, id: newId } : i) }));
                            get().saveSession(); // 🆕 Persist the new ID to local session
                            await syncModifiersToRelational(Number(newId), item.modifiers || [], businessId); // 🆕 Sync relational tables
                            await get().syncRecurringTasks(businessId, Number(newId), item);
                        }
                    }
                })();

                await Promise.race([
                    cloudPromise,
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Cloud Sync Timeout')), 10000))
                ]);
                console.log(`✅ [Cloud Sync] "${item.name}" synced successfully.`);
            } catch (err: any) {
                console.error(`❌ [Cloud Sync] Failed for "${item.name}"... switching to Offline Queue`, err);

                // Queuing logic: If fails, queue generic UPDATE
                if (isNumericId) {
                    const syncId = Number(itemId);
                    try {
                        await queueAction('UPDATE', dbItem, 'menu_items', syncId);
                        // Using browser console as notification since we don't have a Toast system here easily
                        console.log('✅ Changes saved to Offline Queue (Server Unreachable)');
                        // Optionally notify UI
                        // alert('נשמר במצב אופליין (יסונכרן כשהשרת יחזור)');
                    } catch (qErr: any) {
                        console.error('Failed to queue offline action:', qErr);
                        alert(`שגיאה בשמירת פריט "${item.name}": ${err.message || 'תקשורת נכשלה'}`);
                    }
                } else {
                    // Creating new item offline is tricky with IDs. For now, alert user.
                    alert(`שגיאה בשמירת פריט חדש "${item.name}": חיבור לשרת נכשל.`);
                }
            }
        }
    },

    deleteItem: async (itemId) => {
        set(state => ({ items: state.items.filter(i => i.id !== itemId) }));
        get().saveSession();
        // 🛡️ Soft Delete to handle FK constraints (Recurring Tasks, Orders)
        if (!isNaN(Number(itemId))) {
            try {
                await supabase.from('menu_items').update({ is_deleted: true }).eq('id', Number(itemId));
            } catch (err: any) {
                console.warn(`❌ Delete failed online, queuing offline action for ${itemId}`);
                await queueAction('DELETE', {}, 'menu_items', Number(itemId));
            }
            // Optional: clean up recurring tasks logic if needed, but soft delete is safer
        }
    },

    addNewItem: (category = 'General') => {
        const item: OnboardingItem = { id: `local-${Date.now()}`, name: 'New Item', category, description: '', price: 0, status: 'completed', productionArea: 'Kitchen', ingredients: [], modifiers: [] };
        set(state => ({ items: [item, ...state.items] }));
        get().saveSession();
        return item;
    },

    cleanupDuplicates: () => {
        const { items } = get();
        const seen = new Set();
        const clean = items.filter(i => {
            const key = `${i.category}:${i.name}`.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
        set({ items: clean });
    },

    applyAtmosphereToCategory: (category, bgId, contId) => {
        set(state => ({ items: state.items.map(i => i.category === category ? { ...i, selectedBackgroundId: bgId, selectedContainerId: contId } : i) }));
        get().saveSession();
    },

    startLiveGeneration: async () => {
        set({ isGenerating: true, error: null });
        const pending = get().items.filter(i => i.status === 'pending');
        for (const item of pending) {
            if (!get().isGenerating) break;
            try {
                // 🔄 Set status to 'generating' to trigger animations
                set(state => ({ items: state.items.map(i => i.id === item.id ? { ...i, status: 'generating' } : i) }));

                const { prompt, negativePrompt, seeds } = await generateImagePrompt(item, get().atmosphereSeeds, get().geminiApiKey || undefined, get().businessContext || undefined);
                const res = await generateImageGemini(prompt, get().geminiApiKey!, negativePrompt, seeds);
                if (res) await get().updateItem(item.id, { imageUrl: res.url, status: 'completed', lastPrompt: prompt, powerSource: res.powerSource });
                else await get().updateItem(item.id, { status: 'pending' });
            } catch (err: any) {
                // Reset status on error
                set(state => ({ items: state.items.map(i => i.id === item.id ? { ...i, status: 'pending' } : i) }));
                console.error("Generation failed:", err);
                if (err.message.includes("GEMINI_KEY")) {
                    set({ error: err.message, isGenerating: false });
                    return;
                }
            }
        }
        set({ isGenerating: false });
    },

    cancelGeneration: async () => set({ isGenerating: false }),

    regenerateSingleItem: async (itemId) => {
        const item = get().items.find(i => i.id === itemId);
        if (!item) return;
        set({ error: null });
        try {
            // 🔄 Set status to 'generating' to trigger animations
            set(state => ({ items: state.items.map(i => i.id === itemId ? { ...i, status: 'generating' } : i) }));

            const { prompt, negativePrompt, seeds } = await generateImagePrompt(item, get().atmosphereSeeds, get().geminiApiKey || undefined, get().businessContext || undefined);
            const res = await generateImageGemini(prompt, get().geminiApiKey!, negativePrompt, seeds);
            if (res) await get().updateItem(itemId, { imageUrl: res.url, status: 'completed', lastPrompt: prompt, powerSource: res.powerSource });
            else await get().updateItem(itemId, { status: 'pending' });
        } catch (err: any) {
            // Reset status on error
            set(state => ({ items: state.items.map(i => i.id === itemId ? { ...i, status: 'pending' } : i) }));
            console.error("Single generation failed:", err);
            if (err.message.includes("GEMINI_KEY")) {
                set({ error: err.message });
            }
            throw err; // Allow UI to handle error
        }
    },

    uploadOriginalImage: async (itemId: string, fileOrBase64: File | string | Blob) => {
        const { businessId } = get();
        try {
            const tempId = uuidv4();
            const folder = businessId || 'anonymous';
            let blob: Blob;
            let fileName: string;

            if (fileOrBase64 instanceof File || fileOrBase64 instanceof Blob) {
                blob = fileOrBase64;
                const fileExt = (fileOrBase64 as File).name?.split('.').pop() || 'jpg';
                fileName = `wizard/${folder}/${itemId}_${tempId}.${fileExt}`;
            } else if (typeof fileOrBase64 === 'string') {
                if (fileOrBase64.startsWith('data:')) {
                    const base64Data = fileOrBase64.split(',')[1] || fileOrBase64;
                    const byteCharacters = atob(base64Data);
                    const byteNumbers = new Array(byteCharacters.length);
                    for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
                    blob = new Blob([new Uint8Array(byteNumbers)], { type: 'image/jpeg' });
                    fileName = `wizard/${folder}/${itemId}_generated_${tempId}.jpg`;
                } else {
                    return fileOrBase64;
                }
            } else {
                throw new Error('Invalid image format');
            }

            const { error } = await supabase.storage.from('menu-images').upload(fileName, blob, { contentType: blob.type, upsert: true });
            if (error) throw error;
            const { data: { publicUrl } } = supabase.storage.from('menu-images').getPublicUrl(fileName);
            return publicUrl;
        } catch (err: any) {
            console.error('Upload failed:', err);
            set({ error: err.message });
            throw err;
        }
    },

    syncRecurringTasks: async (businessId, menuItemId, item) => {
        if (!item.inventorySettings) return;
        const { prepType, parShifts, dailyPars } = item.inventorySettings;
        if (!['production', 'defrost', 'completion', 'requires_prep'].includes(prepType)) return;

        const tasksByCategory: Record<string, { qtyByDay: Record<number, number> }> = {};
        ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].forEach((day, idx) => {
            const shift = parShifts?.[day as keyof typeof parShifts] || 'prep';
            let category = 'Prep';
            if (shift === 'opening') category = 'Opening';
            if (shift === 'closing') category = 'Closing';
            if (!tasksByCategory[category]) tasksByCategory[category] = { qtyByDay: {} };
            tasksByCategory[category].qtyByDay[idx] = dailyPars[day as keyof typeof dailyPars] || 0;
        });

        const categoriesWithWork = Object.keys(tasksByCategory).filter(cat => Object.values(tasksByCategory[cat].qtyByDay).some(q => q > 0));

        // Log for debugging
        console.log('🔄 Syncing Tasks:', { item: item.name, categories: categoriesWithWork, schedule: tasksByCategory });

        const { data: existingTasks } = await supabase.from('recurring_tasks').select('id, category').eq('menu_item_id', menuItemId);
        const existingMap = new Map();
        existingTasks?.forEach((t: any) => existingMap.set(t.category, t.id));

        const logicType = prepType === 'completion' ? 'par_level' : 'fixed';
        for (const cat of categoriesWithWork) {
            const weeklySchedule: any = {};
            Object.entries(tasksByCategory[cat].qtyByDay).forEach(([dayIdx, qty]) => { weeklySchedule[dayIdx] = { qty, mode: logicType }; });
            const payload = {
                business_id: businessId,
                menu_item_id: menuItemId,
                name: item.name,
                category: cat,
                frequency: 'Daily',
                weekly_schedule: weeklySchedule,
                logic_type: logicType,
                is_active: true,
                image_url: item.imageUrl,
                quantity: 0,
                display_kds: item.displayKDS || [item.productionArea || 'Checker'] // 🆕 Sync KDS routing to tasks
            };
            const exId = existingMap.get(cat);
            if (exId) { await supabase.from('recurring_tasks').update(payload).eq('id', exId); existingMap.delete(cat); }
            else { await supabase.from('recurring_tasks').insert([payload]); }
        }
        if (existingMap.size > 0) await supabase.from('recurring_tasks').delete().in('id', Array.from(existingMap.values()));
    },

}));
