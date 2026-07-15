import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { db, menu_cache } from '@/db/database';

// Map database categories to frontend category IDs (legacy fallback)
const CATEGORY_MAP = {};

// Fallback categories removed to prevent "Ghost" state flicker
const FALLBACK_CATEGORIES = [];

/**
 * Custom hook for menu items management
 */
export const useMenuItems = (defaultCategory = 'hot-drinks', businessId = null) => {
    // 🚩 TRACE: Initial State Log
    const [rawMenuData, setRawMenuData] = useState([]);
    const [categories, setCategories] = useState([]); // Initialize empty to avoid ghost categories

    // Track fetch completion for tighter hydration gate
    const [categoriesFetched, setCategoriesFetched] = useState(false);
    const [itemsFetched, setItemsFetched] = useState(false);

    if (!categories.length) console.log('🔍 [useMenuItems] Initial categories state: []');

    const [menuLoading, setMenuLoading] = useState(true);

    // isHydrated is now derived from both categories and items being definitely fetched
    const isHydrated = useMemo(() => categoriesFetched && itemsFetched, [categoriesFetched, itemsFetched]);

    const [error, setError] = useState(null);
    const [activeCategory, setActiveCategory] = useState(defaultCategory);

    const getCategoryId = useCallback((dbCategory, categoryId) => {
        if (categoryId) {
            const foundById = categories.find(c => c.id === categoryId);
            if (foundById) return foundById.id;
        }
        const found = categories.find(c =>
            c.name === dbCategory ||
            c.name_he === dbCategory ||
            c.db_name === dbCategory
        );
        if (found) return found.id;
        return CATEGORY_MAP[dbCategory] || 'other';
    }, [categories]);

    const isFoodItem = useCallback((item) => {
        if (!item) return false;
        if (item.kds_routing_logic === 'MADE_TO_ORDER') return true;
        const dbCat = (item.db_category || '').toLowerCase();
        const name = (item.name || '').toLowerCase();
        if (dbCat.includes('כריך') || dbCat.includes('טוסט') || dbCat.includes('פיצה') || dbCat.includes('סלט')) return true;
        if (name.includes('כריך') || name.includes('טוסט') || name.includes('פיצה')) return true;
        return false;
    }, []);

    const fetchCategories = useCallback(async () => {
        const effectiveId = businessId || localStorage.getItem('businessId') || localStorage.getItem('business_id');
        if (!effectiveId) return;

        try {
            console.log('🚀 [Supabase Direct] Fetching categories for business:', effectiveId);

            const { data } = await supabase
                .from('item_category')
                .select('id, name, name_he, icon, position, is_hidden')
                .eq('business_id', effectiveId)
                .or('is_deleted.is.null,is_deleted.eq.false')
                .or('is_hidden.is.null,is_hidden.eq.false')
                .order('position', { ascending: true, nullsFirst: false });

            if (data && data.length > 0) {
                console.log(`✅ [Supabase Direct] Got ${data.length} categories`);
                setCategories(data.map(cat => ({
                    id: cat.id,
                    name: cat.name_he || cat.name,
                    name_he: cat.name_he,
                    db_name: cat.name,
                    icon: cat.icon || 'Folder',
                    position: cat.position
                })));
                // Passive backup to Dexie
                db.item_category.bulkPut(data.map(d => ({ ...d, business_id: effectiveId }))).catch(() => {});
            }
            setCategoriesFetched(true);
        } catch (e) {
            console.error('Categories fetch error:', e);
            setCategoriesFetched(true);
        }
    }, [businessId]);

    const fetchMenuItems = useCallback(async () => {
        const effectiveId = businessId || localStorage.getItem('businessId') || localStorage.getItem('business_id');

        if (!effectiveId) {
            console.warn('⚠️ [Blocked] No Business ID.');
            setMenuLoading(false);
            setItemsFetched(true);
            return;
        }

        try {
            console.log('🚀 [Supabase Direct] Fetching menu for business:', effectiveId);

            // Always fetch from Supabase first — it's local, fast, and authoritative
            const [{ data: cloudData, error: menuError }, { data: cloudInventory }] = await Promise.all([
                supabase.from('menu_items')
                    .select('id, name, price, sale_price, category, category_id, is_hot_drink, kds_routing_logic, allow_notes, is_in_stock, description, modifiers, image_url, inventory_settings, is_deleted, kds_station, production_area, display_kds')
                    .eq('business_id', effectiveId)
                    .not('is_deleted', 'eq', true)
                    .order('id', { ascending: true }),
                supabase.from('prepared_items_inventory')
                    .select('item_id, current_stock')
                    .eq('business_id', effectiveId),
            ]);

            if (menuError) throw menuError;

            if (cloudData && cloudData.length > 0) {
                console.log(`✅ [Supabase Direct] Got ${cloudData.length} items`);

                // Merge prepared_items_inventory stock into menu items
                const invMap = new Map((cloudInventory || []).map(inv => [inv.item_id, inv.current_stock]));
                const enrichedData = cloudData.map(item => ({
                    ...item,
                    current_stock: invMap.get(item.id) ?? null
                }));

                setRawMenuData(enrichedData);
                setMenuLoading(false);
                setItemsFetched(true);

                // Passive backup to Dexie (fire-and-forget)
                db.menu_items.bulkPut(cloudData).catch(() => {});
                if (cloudInventory) db.prepared_items_inventory.bulkPut(cloudInventory).catch(() => {});

                // Cache images lazily
                import('@/services/imageSyncService').then(m => m.syncMenuImages(cloudData)).catch(() => {});
            } else {
                console.warn('⚠️ [Supabase Direct] No items returned');
                setRawMenuData([]);
                setMenuLoading(false);
                setItemsFetched(true);
            }
        } catch (err) {
            console.error('🔥 Fetch Error:', err);
            setMenuLoading(false);
            setItemsFetched(true);
        }
    }, [businessId]);

    useEffect(() => {
        fetchCategories();
        fetchMenuItems();
    }, [fetchCategories, fetchMenuItems]);

    // 🚩 TRACE: Hydration State Log
    useEffect(() => {
        if (isHydrated) {
            console.log('✅ [useMenuItems] isHydrated became TRUE. Categories:', categories.length, 'Items:', rawMenuData.length);
        }
    }, [isHydrated, categories.length, rawMenuData.length]);

    // REAL-TIME INVENTORY SUBSCRIPTION (prepared_items_inventory only)
    useEffect(() => {
        if (!businessId) return;

        const channel = supabase
            .channel('inventory_updates')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'prepared_items_inventory'
                },
                (payload) => {
                    const updated = payload.new;
                    setRawMenuData(prev => prev.map(item => {
                        if (item.id === updated.item_id) {
                            return { ...item, current_stock: updated.current_stock };
                        }
                        return item;
                    }));
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [businessId]);

    const updateStockLocally = useCallback((itemId, newStock) => {
        setRawMenuData(prev => prev.map(item => {
            if (item.id === itemId) {
                return { ...item, current_stock: newStock };
            }
            return item;
        }));
    }, []);

    const updateMenuItemLocally = useCallback((itemId, updates) => {
        setRawMenuData(prev => prev.map(item => {
            if (item.id === itemId) {
                return { ...item, ...updates };
            }
            return item;
        }));
    }, []);

    const menuItems = useMemo(() => {
        const seen = new Set();
        return rawMenuData
            .filter(item => {
                if (seen.has(item.id)) return false;
                seen.add(item.id);
                return true;
            })
            .sort((a, b) => a.id - b.id)
            .map(item => ({
                id: item.id,
                name: item.name,
                price: item.sale_price > 0 ? item.sale_price : item.price,
                originalPrice: item.sale_price > 0 ? item.price : null,
                category: getCategoryId(item.category, item.category_id),
                image: item.image_url || null,
                is_hot_drink: !!(
                    item.is_hot_drink || 
                    item.modifiers?.is_hot_drink || 
                    item.modifiers?.config?.is_hot_drink ||
                    (Array.isArray(item.modifiers) && item.modifiers.some(m => m.is_hot_drink))
                ),
                kds_routing_logic: item.kds_routing_logic,
                kds_station: item.kds_station,
                production_area: item.production_area,
                display_kds: item.display_kds,
                is_in_stock: item.is_in_stock,
                db_category: item.category,
                modifiers: item.modifiers || [],
                // Only show stock badge ("מוכנים") for prepared items, not regular inventory
                current_stock: (item.inventory_settings?.isPreparedItem || item.kds_routing_logic === 'hybrid')
                    ? (item.current_stock ?? 0)
                    : null,
                available: (item.inventory_settings?.isPreparedItem || item.kds_routing_logic === 'hybrid')
                    ? ((item.current_stock ?? 0) > 0 || item.inventory_settings?.hideOnZeroStock === false)
                    : true,
                inventory_settings: item.inventory_settings,
                prepared_items_inventory: item.prepared_items_inventory,
                business_id: item.business_id
            }));
    }, [rawMenuData, getCategoryId]);

    // 🎯 Filter out categories that have no items and deduplicate
    const availableCategories = useMemo(() => {
        const deduplicate = (cats) => {
            const unique = [];
            const seenNames = new Set();
            for (const c of cats) {
                const name = (c.name_he || c.name || '').trim();
                if (name && !seenNames.has(name)) {
                    seenNames.add(name);
                    unique.push(c);
                }
            }
            return unique;
        };

        // 🚀 CRITICAL: DO NOT show categories until hydrated.
        // Avoid "ghost" categories starting with FALLBACK_CATEGORIES.
        if (!isHydrated || (menuLoading && categories.length === 0)) {
            return []; // Return empty during initial block
        }

        const usedCategories = new Set();
        menuItems.forEach(item => {
            if (item.category) usedCategories.add(String(item.category));
            if (item.db_category) usedCategories.add(String(item.db_category));
        });

        // 1. Show ALL non-hidden categories (including empty ones so new categories appear)
        const filtered = categories.filter(cat => !cat.is_hidden);

        // 2. Deduplicate visually by name to avoid empty ghost tabs
        return deduplicate(filtered).sort((a, b) => (a.position || 0) - (b.position || 0));
    }, [categories, menuItems, menuLoading, isHydrated]);

    // Create a mapping from any variant (name, name_he, id) to the representative ID
    const categoryRepresentativeMap = useMemo(() => {
        const mapping = new Map();
        const nameToRepresentativeId = new Map();

        // Pass 1: Establish representatives for each name
        availableCategories.forEach(cat => {
            const name = (cat.name_he || cat.name || '').trim();
            if (name && !nameToRepresentativeId.has(name)) {
                nameToRepresentativeId.set(name, cat.id);
            }
        });

        // Pass 2: Map all original categories to their representative
        categories.forEach(cat => {
            const name = (cat.name_he || cat.name || '').trim();
            const repId = nameToRepresentativeId.get(name);
            if (repId) {
                mapping.set(String(cat.id), repId);
                if (cat.name) mapping.set(cat.name, repId);
                if (cat.name_he) mapping.set(cat.name_he, repId);
            }
        });

        return mapping;
    }, [categories, availableCategories]);

    // 🚀 Handle initial category selection or invalid selection
    useEffect(() => {
        if (availableCategories.length > 0) {
            const currentRepId = categoryRepresentativeMap.get(String(activeCategory));
            const isCurrentValid = availableCategories.some(c => c.id === currentRepId);

            if (!isCurrentValid || activeCategory === null) {
                setActiveCategory(availableCategories[0].id);
            } else if (activeCategory !== currentRepId) {
                // If we are on a "duplicate" category ID, switch to the representative one
                setActiveCategory(currentRepId);
            }
        }
    }, [availableCategories, activeCategory, categoryRepresentativeMap]);

    const itemsForDisplay = useMemo(() => {
        return menuItems.map(item => ({
            ...item,
            displayCategory: categoryRepresentativeMap.get(String(item.category)) || item.category
        }));
    }, [menuItems, categoryRepresentativeMap]);

    const filteredItems = useMemo(() => {
        return itemsForDisplay.filter(item => item.displayCategory === activeCategory);
    }, [itemsForDisplay, activeCategory]);

    return {
        menuItems: itemsForDisplay,
        menuLoading,
        isHydrated, // Export hydration status
        error,
        activeCategory,
        filteredItems,
        categories: availableCategories,
        handleCategoryChange: setActiveCategory,
        isFoodItem,
        fetchMenuItems,
        fetchCategories,
        updateStockLocally,
        updateMenuItemLocally
    };
};

export default useMenuItems;
