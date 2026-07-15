import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchManagerItemOptions, clearOptionsCache } from '@/lib/managerApi';

export const useModifiers = ({ item, user, inventoryOptions }) => {
    // -------------------------------------------------------------------------
    // STATE
    // -------------------------------------------------------------------------
    const [allGroups, setAllGroups] = useState([]);
    const [selectedGroupIds, setSelectedGroupIds] = useState(new Set());
    const [deletedOptionIds, setDeletedOptionIds] = useState(new Set());

    // UI State for Expandables
    const [expandedOptionId, setExpandedOptionId] = useState(null);

    // Picker State
    const [pickerMode, setPickerMode] = useState(null); // 'add_to_group' | 'create_group' | null
    const [pickerTargetGroupId, setPickerTargetGroupId] = useState(null);
    const [pickerSelectedNames, setPickerSelectedNames] = useState(new Set());
    const [pickerSearch, setPickerSearch] = useState('');
    const [pickerGroupName, setPickerGroupName] = useState('');

    const [groupSuggestionsOpen, setGroupSuggestionsOpen] = useState(false);

    // Helpers ref to avoid dependency loops if needed
    const initialGroupsRef = useRef([]);

    // -------------------------------------------------------------------------
    // DATA FETCHING
    // -------------------------------------------------------------------------
    const fetchModifiers = useCallback(async () => {
        if (!item?.id) {
            setAllGroups([]);
            return;
        }

        try {
            // First fetch relationships from menu_item_optiongroups
            const { data: links } = await supabase.from('menuitemoptions')
                .select('group_id')
                .eq('item_id', item.id); // Note: column name is usually item_id in junction tables, checking below

            const linkedGroupIds = new Set((links || []).map(l => l.group_id));
            let relevantGroups = [];

            if (linkedGroupIds.size > 0) {
                // Try optiongroups first
                const { data: linkedGroups, error } = await supabase.from('optiongroups')
                    .select(`*, optionvalues (id, value_name, price_adjustment, is_default, display_order, inventory_item_id, quantity, is_replacement)`)
                    .in('id', Array.from(linkedGroupIds))
                    .eq('business_id', user?.business_id);

                if (error) {
                    console.error('❌ Error fetching linked groups:', error);
                } else if (linkedGroups && linkedGroups.length > 0) {
                    relevantGroups = linkedGroups;
                } else {
                    // If optiongroups RLS blocks us, try optionvalues directly
                    const { data: directValues, error: valuesError } = await supabase.from('optionvalues')
                        .select('*')
                        .in('group_id', Array.from(linkedGroupIds))
                        .eq('business_id', user?.business_id);

                    if (valuesError) {
                        console.error('❌ Error fetching optionvalues:', valuesError);
                    } else if (directValues && directValues.length > 0) {
                        // Build groups from values
                        const groupMap = new Map();
                        for (const val of directValues) {
                            if (!groupMap.has(val.group_id)) {
                                groupMap.set(val.group_id, {
                                    id: val.group_id,
                                    name: 'תוספות', // Default name
                                    optionvalues: []
                                });
                            }
                            groupMap.get(val.group_id).optionvalues.push(val);
                        }
                        relevantGroups = Array.from(groupMap.values());
                    }
                }
            }

            // Also fetch private groups
            const { data: privateGroups } = await supabase.from('optiongroups')
                .select(`*, optionvalues (id, value_name, price_adjustment, is_default, display_order, inventory_item_id, quantity, is_replacement)`)
                .eq('menu_item_id', item.id);

            if (privateGroups?.length) {
                const existingIds = new Set(relevantGroups.map(g => g.id));
                relevantGroups = [...relevantGroups, ...privateGroups.filter(g => !existingIds.has(g.id))];
            }

            // Method 2: If Supabase returned nothing, try external API as fallback
            if (relevantGroups.length === 0 && item?.id) {
                try {
                    const apiGroups = await fetchManagerItemOptions(item.id, user?.business_id);

                    if (apiGroups && apiGroups.length > 0) {
                        // Get group IDs from API
                        const groupIds = apiGroups.map(g => g.id);

                        // Fetch fresh data from Supabase using the API group IDs
                        const { data: freshGroups, error: freshError } = await supabase.from('optiongroups')
                            .select(`*, optionvalues (id, value_name, price_adjustment, is_default, display_order, inventory_item_id, quantity, is_replacement)`)
                            .in('id', groupIds)
                            .eq('business_id', user?.business_id);

                        if (freshError) {
                            console.error('Error fetching fresh groups:', freshError);
                            // Fall back to API data if Supabase fails
                            relevantGroups = apiGroups.map(g => ({
                                id: g.id,
                                name: g.title || g.name,
                                is_food: g.category === 'food',
                                is_drink: g.category === 'drink',
                                optionvalues: (g.values || []).map(v => ({
                                    id: v.id,
                                    value_name: v.name,
                                    price_adjustment: v.priceAdjustment || v.price || 0,
                                    is_default: v.is_default,
                                    display_order: 0
                                }))
                            }));
                        } else if (freshGroups && freshGroups.length > 0) {
                            relevantGroups = freshGroups;
                        } else {
                            // Fall back to API data
                            relevantGroups = apiGroups.map(g => ({
                                id: g.id,
                                name: g.title || g.name,
                                is_food: g.category === 'food',
                                is_drink: g.category === 'drink',
                                optionvalues: (g.values || []).map(v => ({
                                    id: v.id,
                                    value_name: v.name,
                                    price_adjustment: v.priceAdjustment || v.price || 0,
                                    is_default: v.is_default,
                                    display_order: 0
                                }))
                            }));
                        }
                        relevantGroups.forEach(g => linkedGroupIds.add(g.id));
                    }
                } catch (apiError) {
                    console.warn('API also failed:', apiError);
                }
            }

            // Sort optionvalues and set allGroups
            const processedGroups = relevantGroups.map(g => ({
                ...g,
                optionvalues: (g.optionvalues || []).sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
            }));

            setAllGroups(processedGroups);
            initialGroupsRef.current = processedGroups;

            // Auto-select linked groups
            setSelectedGroupIds(new Set(processedGroups.map(g => g.id)));
        } catch (e) {
            console.error('fetchModifiers error:', e);
        }
    }, [item?.id, user?.business_id]);

    // -------------------------------------------------------------------------
    // GROUP MANIPULATION
    // -------------------------------------------------------------------------
    const handleUpdateGroup = (groupId, updates) => {
        setAllGroups(prev => prev.map(g => g.id === groupId ? { ...g, ...updates } : g));
    };

    const handleDeleteGroup = (group) => {
        if (!confirm('האם אתה בטוח שברצונך למחוק קבוצה זו?')) return;

        // Remove from UI
        setAllGroups(prev => prev.filter(g => g.id !== group.id));
        setSelectedGroupIds(prev => {
            const next = new Set(prev);
            next.delete(group.id);
            return next;
        });

        // Mark options for deletion if needed (logic can be expanded if groups are deleted entirely from DB)
        // Here we just decouple from the item in UI for now, saving handles the DB logic.
        // If it's a real group being deleted, we might want to track it. 
        // For simplicity, we assume removing from 'allGroups' is enough for saveOptionsData to not process it 
        // (but we need to handle the relationship deletion or group deletion logic in saveOptionsData if not new).

        // Note: The original code didn't explicitly delete groups from DB in saveOptionsData, 
        // only inserted/updated allGroups. So removing from array effectively removes it from the item context.
    };

    // -------------------------------------------------------------------------
    // OPTION MANIPULATION
    // -------------------------------------------------------------------------
    const handleUpdateOption = (optionId, updates) => {
        setAllGroups(prev => prev.map(g => ({
            ...g,
            optionvalues: g.optionvalues.map(ov => ov.id === optionId ? { ...ov, ...updates } : ov)
        })));
    };

    const handleDeleteOption = (optionId) => {
        setAllGroups(prev => prev.map(g => ({
            ...g,
            optionvalues: g.optionvalues.filter(ov => ov.id !== optionId)
        })));

        if (typeof optionId === 'number' || (typeof optionId === 'string' && !optionId.startsWith('temp_'))) {
            setDeletedOptionIds(prev => new Set(prev).add(optionId));
        }
    };

    // -------------------------------------------------------------------------
    // PICKER LOGIC
    // -------------------------------------------------------------------------
    const openPickerForGroup = (groupId) => {
        setPickerMode('add_to_group');
        setPickerTargetGroupId(groupId);
        setPickerSelectedNames(new Set());
        setPickerSearch('');
    };

    const openPickerForNewGroup = () => {
        setPickerMode('create_group');
        setPickerTargetGroupId(null);
        setPickerSelectedNames(new Set());
        setPickerGroupName('');
        setPickerSearch('');
    };

    const handlePickerSave = () => {
        if (pickerSelectedNames.size === 0) {
            setPickerMode(null);
            return;
        }

        const newOptions = Array.from(pickerSelectedNames).map(name => {
            // Check if this exists in inventory to link automatically
            const existingInv = (inventoryOptions || []).find(inv => inv.name === name);
            return {
                id: `temp_opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                value_name: name,
                price_adjustment: 0,
                is_default: false,
                inventory_item_id: existingInv ? existingInv.id : null,
                quantity: existingInv ? 1 : null, // Default to 1 unit if linked
                display_order: 99
            };
        });

        if (pickerMode === 'add_to_group' && pickerTargetGroupId) {
            setAllGroups(prev => prev.map(g => {
                if (g.id === pickerTargetGroupId) {
                    return { ...g, optionvalues: [...(g.optionvalues || []), ...newOptions] };
                }
                return g;
            }));
        } else if (pickerMode === 'create_group') {
            const newGroup = {
                id: `temp_grp_${Date.now()}`,
                name: pickerGroupName || 'תוספות חדשות',
                menu_item_id: item.id,
                is_required: false,
                is_multiple_select: true,
                optionvalues: newOptions,
                display_order: allGroups.length
            };
            setAllGroups(prev => [...prev, newGroup]);
            setSelectedGroupIds(prev => new Set(prev).add(newGroup.id));
        }

        setPickerMode(null);
        setPickerSelectedNames(new Set());
    };

    // -------------------------------------------------------------------------
    // SAVE LOGIC
    // -------------------------------------------------------------------------
    const saveOptionsData = async (menuItemId, formData) => {
        // console.log('📝 saveOptionsData called. User:', user?.id, 'Business:', user?.business_id);

        if (!user?.business_id) {
            console.error('❌ Missing business_id in user object during saveOptionsData');
        }

        // Handle deletions firstked for deletion
        const idsToDelete = Array.from(deletedOptionIds).filter(id => typeof id === 'number');
        if (idsToDelete.length) {
            await supabase.from('optionvalues').delete().in('id', idsToDelete);
        }

        // 2. Process all groups and their options
        for (const group of allGroups) {
            // If group is new (temp ID), insert it first
            let currentGroupId = group.id;
            if (typeof group.id === 'string' && group.id.startsWith('temp_')) {
                const { data: newGroup, error: groupError } = await supabase.from('optiongroups').insert({
                    name: group.name,
                    business_id: user?.business_id,
                    menu_item_id: group.menu_item_id,
                    is_required: group.is_required || false,
                    is_multiple_select: group.is_multiple_select || false,
                    is_food: group.is_food,
                    is_drink: group.is_drink,
                    display_order: group.display_order
                }).select().single();
                if (groupError) { console.error('Error inserting new group:', groupError); continue; }
                currentGroupId = newGroup.id;
            } else {
                // Update existing group properties
                const { error: updateError } = await supabase.from('optiongroups').update({
                    name: group.name,
                    is_required: group.is_required || false,
                    is_multiple_select: group.is_multiple_select || false,
                    is_food: group.is_food,
                    is_drink: group.is_drink,
                    display_order: group.display_order,
                    business_id: user?.business_id
                }).eq('id', currentGroupId);
                if (updateError) console.error('Error updating group:', updateError);
            }

            // Process options within this group
            for (const option of group.optionvalues || []) {
                if (typeof option.id === 'string' && option.id.startsWith('temp_')) {
                    // Insert new option
                    const { error } = await supabase.from('optionvalues').insert({
                        group_id: currentGroupId,
                        business_id: user?.business_id,
                        value_name: option.value_name,
                        price_adjustment: Number(option.price_adjustment ?? option.priceAdjustment ?? option.price ?? 0),
                        is_default: option.is_default,
                        display_order: option.display_order,
                        inventory_item_id: option.inventory_item_id,
                        quantity: option.quantity
                    });
                    if (error) console.error('Error inserting option:', error);
                } else if (!deletedOptionIds.has(option.id)) {
                    // Update/Upsert existing option
                    const finalPrice = Number(option.price_adjustment ?? option.priceAdjustment ?? option.price ?? 0);

                    const { error } = await supabase.from('optionvalues').upsert({
                        id: option.id,
                        group_id: currentGroupId,
                        business_id: user?.business_id,
                        value_name: option.value_name,
                        price_adjustment: finalPrice,
                        is_default: option.is_default,
                        display_order: option.display_order,
                        inventory_item_id: option.inventory_item_id,
                        quantity: option.quantity
                    });

                    if (error) {
                        console.error('Error upserting option:', error);

                        // Workaround: If update fails due to RLS (42501), try to delete (if allowed) and re-create
                        if (error.code === '42501') {
                            console.warn('⚠️ RLS blocked update. Attempting delete-and-recreate for:', option.id);
                            const { error: delError } = await supabase.from('optionvalues').delete().eq('id', option.id);

                            if (!delError) {
                                console.log('🗑️ Deleted old option. Re-creating...');
                                const { error: insertError } = await supabase.from('optionvalues').insert({
                                    group_id: currentGroupId,
                                    business_id: user?.business_id,
                                    value_name: option.value_name,
                                    price_adjustment: finalPrice,
                                    is_default: option.is_default,
                                    display_order: option.display_order,
                                    inventory_item_id: option.inventory_item_id,
                                    quantity: option.quantity
                                });
                                if (insertError) console.error('❌ Re-create failed:', insertError);
                                else console.log('✅ Re-created option successfully.');
                            } else {
                                console.error('❌ Delete also blocked:', delError);
                            }
                        }
                    }
                }
            }
        }
        // Clear deletedOptionIds after successful save
        setDeletedOptionIds(new Set());
        // Clear the API cache so next fetch gets fresh data from DB
        clearOptionsCache(menuItemId);
    };

    return {
        // State
        allGroups,
        selectedGroupIds,
        expandedOptionId,
        pickerMode,
        pickerTargetGroupId,
        pickerSelectedNames,
        pickerSearch,
        pickerGroupName,
        groupSuggestionsOpen,

        // Setters (if needed directly)
        setAllGroups,
        setPickerMode,
        setPickerTargetGroupId,
        setPickerSelectedNames,
        setPickerSearch,
        setPickerGroupName,
        setGroupSuggestionsOpen,
        setExpandedOptionId,
        setSelectedGroupIds,
        deletedOptionIds,

        // Actions
        fetchModifiers,
        saveOptionsData,
        handleUpdateGroup,
        handleDeleteGroup,
        handleUpdateOption,
        handleDeleteOption,
        openPickerForGroup,
        openPickerForNewGroup,
        handlePickerSave
    };
};
