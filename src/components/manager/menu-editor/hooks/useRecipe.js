import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export const useRecipe = (businessId) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [inventoryOptions, setInventoryOptions] = useState([]);
    const [recipeId, setRecipeId] = useState(null);

    // Fetch Inventory Options (Reference Data)
    const fetchInventoryOptions = useCallback(async () => {
        if (!businessId) return;
        try {
            const { data, error } = await supabase.from('inventory_items')
                .select('id, name, base_unit, display_unit, cost_per_unit, price')
                .eq('business_id', businessId)
                .order('name');

            if (error) throw error;

            // Normalize data: cost_per_unit is primary cost, fallback to price
            const mapped = (data || []).map(item => ({
                ...item,
                cost: Number(item.cost_per_unit || item.price || 0),
                unit: item.display_unit || item.base_unit
            }));

            setInventoryOptions(mapped);
            return mapped;
        } catch (err) {
            console.error('Error fetching inventory:', err);
            return [];
        }
    }, [businessId]);

    // Load Recipe for an Item
    const loadRecipe = useCallback(async (menuItemId, existingInventory = []) => {
        if (!menuItemId) return [];
        setLoading(true);
        setError(null);
        try {
            // 1. Get Recipe ID
            const { data: recipeRows } = await supabase.from('recipes')
                .select('id')
                .eq('menu_item_id', menuItemId);

            const foundRecipeId = recipeRows?.[0]?.id;

            if (!foundRecipeId) {
                setRecipeId(null);
                setLoading(false);
                return [];
            }

            setRecipeId(foundRecipeId);

            // 2. Get Ingredients
            const { data: ingredients } = await supabase.from('recipe_ingredients')
                .select('*')
                .eq('recipe_id', foundRecipeId);

            // 3. Map to UI Model
            // Use existingInventory or fetch if empty (but typically passed)
            const lookupList = existingInventory.length ? existingInventory : inventoryOptions;
            const invMap = new Map(lookupList.map(i => [String(i.id), i]));

            const mappedComponents = (ingredients || []).map(row => {
                const invItem = invMap.get(String(row.inventory_item_id));
                // cost_per_unit removed from recipe_ingredients, fetch from invItem
                const price = Number(invItem?.cost_per_unit || invItem?.price || 0);
                const quantity = Number(row.quantity_used || 0);

                return {
                    id: row.id, // Database ID (number)
                    inventory_item_id: row.inventory_item_id,
                    name: invItem?.name || 'פריט לא ידוע',
                    quantity,
                    unit: row.unit_of_measure || invItem?.unit || 'kg',
                    price, // cost per unit
                    subtotal: price * quantity,
                    isNew: false
                };
            });

            return mappedComponents;

        } catch (err) {
            console.error('Error loading recipe:', err);
            setError('שגיאה בטעינת מתכון');
            return [];
        } finally {
            setLoading(false);
        }
    }, [inventoryOptions]); // Note: dependency on inventoryOptions might strict trigger re-loads if not careful, but okay for now.

    // Calculate Single Ingredient
    const calculateIngredient = (invId, quantityStr, unitStr) => {
        const invItem = inventoryOptions.find(i => String(i.id) === String(invId));
        if (!invItem) return null;

        const quantity = Number(quantityStr) || 0;
        const cost = invItem.cost_per_unit || invItem.price || 0;
        return {
            id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            inventory_item_id: Number(invId),
            name: invItem.name,
            quantity,
            unit: unitStr || invItem.unit || 'kg',
            price: cost,
            subtotal: cost * quantity,
            isNew: true
        };
    };

    // Save Logic
    const saveRecipe = async (menuItemId, components, deletedIds) => {
        let currentRecipeId = recipeId;

        // 1. Create Recipe if needed
        if (!currentRecipeId) {
            // Check if exists (race condition check)
            const { data: existing } = await supabase.from('recipes').select('id').eq('menu_item_id', menuItemId).maybeSingle();
            if (existing) {
                currentRecipeId = existing.id;
            } else {
                const { data: newRec } = await supabase.from('recipes')
                    .insert({ menu_item_id: menuItemId, name: 'Recipe' }) // Name is optional/derived
                    .select()
                    .single();
                if (!newRec) throw new Error('Failed to create recipe record');
                currentRecipeId = newRec.id;
            }
            setRecipeId(currentRecipeId);
        }

        // 2. Delete Removed Items
        if (deletedIds && deletedIds.size > 0) {
            const idsList = Array.from(deletedIds).filter(id => typeof id === 'number'); // Only real DB ids
            if (idsList.length) {
                await supabase.from('recipe_ingredients').delete().in('id', idsList);
            }
        }

        // 3. Upsert Components
        const attempts = components.map(async (comp) => {
            const payload = {
                recipe_id: currentRecipeId,
                inventory_item_id: comp.inventory_item_id,
                quantity_used: comp.quantity,
                unit_of_measure: comp.unit
                // cost_per_unit removed
            };

            if (comp.isNew || typeof comp.id === 'string') {
                // Insert
                return supabase.from('recipe_ingredients').insert(payload);
            } else {
                // Update
                return supabase.from('recipe_ingredients').update(payload).eq('id', comp.id);
            }
        });

        await Promise.all(attempts);
        return true;
    };

    return {
        recipeId,
        loading,
        error,
        inventoryOptions,
        fetchInventoryOptions,
        loadRecipe,
        calculateIngredient,
        saveRecipe
    };
};
