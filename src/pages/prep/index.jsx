import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    House, RotateCcw, List, CheckCircle, Sunrise, Sunset,
    Utensils, Clock, ChevronRight, ChevronLeft, ChefHat, ArrowRight,
    Snowflake, ClipboardList, Package, Plus, Save, Minus, Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/db/database';
import UnifiedHeader from '@/components/UnifiedHeader';
import TaskManagementView from '@/components/kds/TaskManagementView';
import { isCategoryMatch, getCategoryAliases, TASK_CATEGORIES } from '@/config/taskCategories';

const PrepPage = () => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();

    // Main Tab State: 'tasks' | 'prepared' | 'defrost'
    const [mainTab, setMainTab] = useState('tasks');

    // Intelligent Initial Sub-tab based on time
    const getInitialSubTab = () => {
        const hour = new Date().getHours();
        if (hour >= 5 && hour < 11) return 'opening';
        if (hour >= 19 || hour < 5) return 'closing';
        return 'prep';
    };

    // Tasks Sub-tab (now matches Manager IDs: 'opening' | 'pre_closing' | 'closing')
    const [tasksSubTab, setTasksSubTab] = useState(getInitialSubTab() === 'prep' ? 'pre_closing' : getInitialSubTab());

    // Data State
    const [openingTasks, setOpeningTasks] = useState([]);
    const [prepBatches, setPrepBatches] = useState([]);
    const [closingTasks, setClosingTasks] = useState([]);
    const [supplierTasks, setSupplierTasks] = useState([]);
    const [allPreparedItems, setAllPreparedItems] = useState({ production: [], defrost: [] });

    const [currentHour, setCurrentHour] = useState(new Date().getHours());
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [stockUpdates, setStockUpdates] = useState({});
    const [showSuccess, setShowSuccess] = useState(false);
    const [successItemName, setSuccessItemName] = useState('');
    const [hidePrepInfo, setHidePrepInfo] = useState(localStorage.getItem('hidePrepInfo') === 'true');
    const [showInfoModal, setShowInfoModal] = useState(false);
    const [businessSettings, setBusinessSettings] = useState(null);
    const [hasAutoSwitched, setHasAutoSwitched] = useState(false);

    // Open Orders Check State
    const [openOrdersCount, setOpenOrdersCount] = useState(0);
    const [staleOrdersCount, setStaleOrdersCount] = useState(0);
    const [showOpenOrdersModal, setShowOpenOrdersModal] = useState(false);

    // 🕵️ Check for Open Orders when switching to Closing
    // 🕵️ Check for Open Orders when switching to Closing - DISABLED PER USER REQUEST
    /*
    useEffect(() => {
        if (tasksSubTab === 'closing') {
            const checkOrders = async () => {
                try {
                    // 🕒 Anchor Logic: The day starts at 5:00 AM.
                    const now = new Date();
                    const anchor = new Date(now);
                    anchor.setHours(5, 0, 0, 0);
                    if (now < anchor) anchor.setDate(anchor.getDate() - 1);
                    const anchorISO = anchor.toISOString();

                    // Check for any active orders
                    const allActive = await db.orders
                        .where('order_status')
                        .anyOf('new', 'in_progress', 'ready', 'pending')
                        .filter(o => String(o.business_id) === String(currentUser?.business_id))
                        .toArray();

                    const currentShiftOrders = allActive.filter(o => (o.created_at || o.updated_at) >= anchorISO);
                    const staleCount = allActive.length - currentShiftOrders.length;

                    if (allActive.length > 0) {
                        setOpenOrdersCount(allActive.length);
                        setStaleOrdersCount(staleCount);
                        setShowOpenOrdersModal(true);
                    }
                } catch (e) {
                    console.error('Failed to check open orders:', e);
                }
            };
            checkOrders();
        }
    }, [tasksSubTab]);
    */

    const handleClearStale = async () => {
        try {
            const now = new Date();
            const anchor = new Date(now);
            anchor.setHours(5, 0, 0, 0);
            if (now < anchor) anchor.setDate(anchor.getDate() - 1);
            const anchorISO = anchor.toISOString();

            const staleOrders = await db.orders
                .where('order_status')
                .anyOf('new', 'in_progress', 'ready', 'pending')
                .filter(o => (o.created_at || o.updated_at) < anchorISO && String(o.business_id) === String(currentUser?.business_id))
                .toArray();

            if (staleOrders.length === 0) return;

            const ids = staleOrders.map(o => o.id);
            const nowISO = new Date().toISOString();

            // 1. Supabase Update
            const { error } = await supabase
                .from('orders')
                .update({
                    order_status: 'completed',
                    updated_at: nowISO,
                    ready_at: nowISO
                })
                .in('id', ids);

            if (error) throw error;

            // 🏆 Also update order items in Supabase to be consistent
            await supabase
                .from('order_items')
                .update({ item_status: 'completed' })
                .in('order_id', ids);

            // 2. Dexie Update
            await db.orders.where('id').anyOf(ids).modify({
                order_status: 'completed',
                updated_at: nowISO,
                ready_at: nowISO
            });
            await db.order_items.where('order_id').anyOf(ids).modify({ item_status: 'completed' });

            // 3. Update UI
            setStaleOrdersCount(0);
            const newCount = openOrdersCount - ids.length;
            setOpenOrdersCount(newCount);

            if (newCount <= 0) {
                setShowOpenOrdersModal(false);
            }
        } catch (e) {
            console.error('Failed to clear stale orders:', e);
            alert('שגיאה בניקוי הזמנות ישנות: ' + e.message);
        }
    };

    // --- Handlers ---
    const handleExit = () => navigate('/mode-selection');



    const handleCompleteTask = async (task, notes = '') => {
        try {
            // 🕒 Transition at 05:00 AM local time.
            const now = new Date();
            const businessTime = new Date(now.getTime() - (5 * 60 * 60 * 1000));
            const dateStr = businessTime.toLocaleDateString('en-CA');

            const isImplicit = String(task.id).startsWith('implicit_prep_');
            const completionPayload = {
                recurring_task_id: isImplicit ? null : task.id,
                completion_date: dateStr,
                completed_by: currentUser?.id,
                notes: String(notes || task.id), // Ensure string
                business_id: currentUser?.business_id
            };

            console.log(`🚀 [Prep] Completing task: ${task.name} | Date: ${dateStr}`);

            // 1. OPTIMISTIC UPDATE: Local State First
            setOpeningTasks(prev => prev.filter(t => t.id !== task.id));
            setClosingTasks(prev => prev.filter(t => t.id !== task.id));
            setPrepBatches(prev => prev.filter(t => t.id !== task.id));
            setSupplierTasks(prev => prev.filter(t => t.id !== task.id));

            // Also remove from prepared items if it's an inventory trackable task
            setAllPreparedItems(prev => ({
                production: prev.production.filter(i => i.id !== task.id),
                defrost: prev.defrost.filter(i => i.id !== task.id)
            }));

            // 2. Write to Dexie (Offline First)
            await db.task_completions.add({
                ...completionPayload,
                id: `local_${Date.now()}_${task.id}`
            });

            // 3. Write to Supabase (Background-ish, if online)
            if (navigator.onLine) {
                const { error: logErr } = await supabase
                    .from('task_completions')
                    .insert(completionPayload);
                if (logErr) console.warn('☁️ Cloud task completion failed (will sync later):', logErr.message);
            }

            console.log(`✅ Task "${task.name}" completed and removed from view`);
        } catch (err) {
            console.error('Error completing task:', err);
            setError('שגיאה ברישום השלמת משימה');
        }
    };

    const getActiveRecurringTasks = () => {
        if (tasksSubTab === 'opening') return openingTasks;
        if (tasksSubTab === 'closing') return closingTasks;
        return [...prepBatches, ...supplierTasks];
    };

    const getCountsForShift = useCallback((shiftId) => {
        const getShiftTasks = (tasks) => tasks.filter(t => {
            const name = (t.name || '').toLowerCase();
            const cat = (t.category || '').toLowerCase();
            const isOpening = isCategoryMatch('opening', cat) || name.includes('פתיחה') || name.includes('בקר') || name.includes('בוקר');
            const isClosing = isCategoryMatch('closing', cat) || name.includes('סגירה') || name.includes('ערב') || name.includes('סיום');
            const isPrep = !isOpening && !isClosing;

            if (shiftId === 'opening') return isOpening;
            if (shiftId === 'closing') return isClosing;
            return isPrep;
        });

        const filterPrepByShift = (items, targetTab) => {
            const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            const dayKey = dayNames[new Date().getDay()];

            console.log(`🔍 Filtering Preps for [${targetTab}] (Day: ${dayKey}) - Total Input: ${items?.length}`);

            return items.filter(t => {
                const shift = t.menu_item?.inventory_settings?.parShifts?.[dayKey];

                // Log only if item has inventory settings to avoid spam
                if (t.menu_item?.inventory_settings) {
                    // console.log(`  - Item: ${t.name}, Shift: ${shift}, Tab: ${targetTab}`);
                }

                if (shift) {
                    if (targetTab === 'opening' && shift === 'opening') return true;
                    if (targetTab === 'closing' && shift === 'closing') return true;
                    if (targetTab === 'pre_closing' && (shift === 'prep' || shift === 'mid')) return true;
                }

                // Fallback for Prep Tab
                if (targetTab === 'pre_closing' && !shift && !isCategoryMatch('opening', t.category) && !isCategoryMatch('closing', t.category)) {
                    return true;
                }

                return false;
            });
        };

        const taskCount = getShiftTasks([...openingTasks, ...prepBatches, ...closingTasks, ...supplierTasks]).length;
        const prepCount = filterPrepByShift(allPreparedItems.production, shiftId).length;
        const defrostCount = filterPrepByShift(allPreparedItems.defrost, shiftId).length;

        return taskCount + prepCount + defrostCount;
    }, [openingTasks, prepBatches, closingTasks, supplierTasks, allPreparedItems]);

    // ... (existing code for preparedItemsToList and defrostItemsToList) ...

    // ... (prepareItemsWithSort is now memoized) ...

    // ... (rest of code) ...



    const preparedItemsToList = useMemo(() => {
        const items = allPreparedItems.production || [];
        const targetTab = tasksSubTab; // 'opening', 'prep', 'closing'

        // Determine current day of week string for parShifts lookup
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayKey = dayNames[new Date().getDay()];

        return items.filter(t => {
            // 1. Check strict category match
            if (isCategoryMatch(targetTab, t.category)) return true;

            // 2. Check parShifts match for menu items
            const shift = t.menu_item?.inventory_settings?.parShifts?.[dayKey];

            if (shift) {
                if (targetTab === 'opening' && shift === 'opening') return true;
                if (targetTab === 'closing' && shift === 'closing') return true;
                if (targetTab === 'pre_closing' && (shift === 'prep' || shift === 'mid')) return true;
                return false; // If shift is specified but doesn't match current tab, hide it
            }

            // 3. Fallback: If NO shift specified/found
            // If we are in the main "Prep" tab ('pre_closing'), show everything by default
            // unless it's strictly categorized as opening/closing elsewhere.
            if (targetTab === 'pre_closing') {
                // If it's NOT explicitly Opening or Closing category (already checked in step 1), show it in Prep.
                return true;
            }

            return false;
        });
    }, [allPreparedItems.production, tasksSubTab]);

    const defrostItemsToList = useMemo(() => {
        const items = allPreparedItems.defrost || [];
        const targetTab = tasksSubTab;

        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayKey = dayNames[new Date().getDay()];

        return items.filter(t => {
            if (isCategoryMatch(targetTab, t.category)) return true;

            const shift = t.menu_item?.inventory_settings?.parShifts?.[dayKey];
            if (shift) {
                if (targetTab === 'opening' && shift === 'opening') return true;
                if (targetTab === 'closing' && shift === 'closing') return true;
                if (targetTab === 'pre_closing' && (shift === 'prep' || shift === 'mid')) return true;
                return false;
            }

            // Fallback: Default to showing in Prep tab if no strict shift assigned
            if (targetTab === 'pre_closing') return true;

            return false;
        });
    }, [allPreparedItems.defrost, tasksSubTab]);

    const prepareItemsWithSort = useCallback((items) => {
        if (!items) return [];

        const getDeptIndex = (cat, name) => {
            const c = String(cat || '').toLowerCase();
            const n = String(name || '').toLowerCase();

            // Index 1: Vegetables & Fruits (High priority check for names too)
            if (c.includes('ירק') || c.includes('פיר') || c.includes('fruit') || c.includes('veg') ||
                n.includes('עגבנ') || n.includes('מלפפ') || n.includes('חסה') || n.includes('גזר') ||
                n.includes('בצל') || n.includes('בטטה') || n.includes('פטרוזי') || n.includes('נענע') ||
                n.includes('כוסבר') || n.includes('שום') || n.includes('פטרי') || n.includes('תפוח') || n.includes('פלפל') || n.includes('קולורבי')) return 1;

            // Index 2: Dairy
            if (c.includes('חלב') || c.includes('גבינ') || c.includes('dairy') || n.includes('חלב') || n.includes('גבינ') || n.includes('צפתית') || n.includes('קוטג')) return 2;

            // Index 3: Bakery
            if (c.includes('מאפ') || c.includes('לחם') || c.includes('pastry') || c.includes('bread') || c.includes('פיתה') ||
                n.includes('לחם') || n.includes('לחמנ') || n.includes('בורקס') || n.includes('עוגה') || n.includes('קרואס')) return 3;

            // Index 4: Meat/Fish
            if (c.includes('בשר') || c.includes('דג') || c.includes('עוף') || c.includes('meat') || c.includes('fish') || n.includes('המבורגר') || n.includes('נקניק') || n.includes('שניצל') || n.includes('קבב')) return 4;

            // Index 5: Pantry / Dry
            if (c.includes('יבש') || c.includes('גלם') || c.includes('מזווה') || c.includes('dry') || n.includes('סוכר') || n.includes('מלח') || n.includes('קמח') || n.includes('אבקת')) return 5;

            // Index 6: Frozen
            if (c.includes('קפוא') || c.includes('frozen') || n.includes('גלידה') || n.includes('צ\'יפס')) return 6;

            // Index 7: Cleaning
            if (c.includes('נקה') || n.includes('סבון') || n.includes('כלים') || n.includes('ספוג')) return 7;

            // Index 8: Disposable
            if (c.includes('חד פעמי') || c.includes('disposable') || n.includes('נייר') || n.includes('מפית')) return 8;

            return 99;
        };

        return [...items].sort((a, b) => {
            const catA = a.category || a.menu_item?.category || '';
            const catB = b.category || b.menu_item?.category || '';
            const nameA = a.name || a.menu_item?.name || '';
            const nameB = b.name || b.menu_item?.name || '';

            const indexA = getDeptIndex(catA, nameA);
            const indexB = getDeptIndex(catB, nameB);

            if (indexA !== indexB) return indexA - indexB;

            // If same department/index, sort by category name alphabetically
            if (catA !== catB) return String(catA).localeCompare(String(catB), 'he');

            // Finally by item name
            return String(nameA).localeCompare(String(nameB), 'he');
        });
    }, []);

    // --- Fetch Logic: Recurring Tasks ---
    const fetchAllData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // Effective day transitions at 05:00 AM local time.
            const now = new Date();
            const businessTime = new Date(now.getTime() - (5 * 60 * 60 * 1000));
            const todayIdx = businessTime.getDay();
            const dateStr = businessTime.toLocaleDateString('en-CA');

            if (!currentUser?.business_id) {
                setLoading(false);
                return;
            }

            console.log(`🕒 [PrepPage] Fetching local data for Business: ${currentUser.business_id} | Effective Date: ${dateStr}`);

            // 1. Fetch Recurring Tasks from local DB (Optimistic)
            const bId = String(currentUser.business_id);
            let rawTasks = await db.recurring_tasks
                .where('business_id').equals(bId)
                .filter(t => t.is_active)
                .toArray();

            // 1b. Fallback to Supabase if local is empty and we are online
            if (rawTasks.length === 0 && navigator.onLine) {
                console.log('⚠️ Local recurring tasks empty, fetching from Supabase...');
                const { data: remoteTasks, error: remoteErr } = await supabase
                    .from('recurring_tasks')
                    .select('*')
                    .eq('business_id', bId)
                    .eq('is_active', true);

                if (!remoteErr && remoteTasks) {
                    rawTasks = remoteTasks;
                    // Async sync to Dexie for next time
                    db.recurring_tasks.bulkPut(remoteTasks).catch(e => console.warn('Failed to sync tasks to Dexie:', e));
                }
            }

            // 2. Fetch Completions for this business day
            let logs = await db.task_completions
                .where('business_id').equals(bId)
                .filter(l => l.completion_date === dateStr)
                .toArray();

            // 2b. Fallback to Supabase for completions
            if (logs.length === 0 && navigator.onLine) {
                const { data: remoteLogs } = await supabase
                    .from('task_completions')
                    .select('*')
                    .eq('business_id', bId)
                    .eq('completion_date', dateStr);
                if (remoteLogs) logs = remoteLogs;
            }

            const completedIds = new Set(logs.map(l => String(l.recurring_task_id)));
            const completedNotes = new Set(logs.map(l => l.notes));

            // 3. Map to UI tasks with joined Menu Item data
            const activeTasks = [];
            for (const t of rawTasks) {
                if (completedIds.has(String(t.id))) continue;

                // Simple check for schedule match
                const schedule = t.weekly_schedule || {};
                const isStrictlyWeekly = (schedule && Object.keys(schedule).length > 0) || (t.day_of_week !== null && t.day_of_week !== undefined);
                let isToday = true;

                if (isStrictlyWeekly && !t.is_daily) {
                    if (schedule[todayIdx]) {
                        isToday = schedule[todayIdx].qty > 0;
                    } else if (t.day_of_week !== null) {
                        isToday = Number(t.day_of_week) === todayIdx;
                    }
                }

                if (!isToday) continue;

                // Join with Menu Item from local DB (try local first, then remote)
                let menuItem = t.menu_item_id ? await db.menu_items.get(t.menu_item_id) : null;
                if (!menuItem && t.menu_item_id && navigator.onLine) {
                    const { data: remoteItem } = await supabase.from('menu_items').select('*').eq('id', t.menu_item_id).single();
                    if (remoteItem) menuItem = remoteItem;
                }

                let inv = menuItem ? await db.prepared_items_inventory.get(menuItem.id) : null;
                if (!inv && menuItem && navigator.onLine) {
                    const { data: remoteInv } = await supabase.from('prepared_items_inventory').select('*').eq('item_id', menuItem.id).single();
                    if (remoteInv) inv = remoteInv;
                }

                activeTasks.push({
                    ...t,
                    target_qty: (schedule[todayIdx]?.qty) || t.quantity,
                    logic_type: (schedule[todayIdx]?.mode) || t.logic_type || 'fixed',
                    due_time: t.due_time || (isCategoryMatch('opening', t.category) ? '08:00' : null),
                    menu_item: menuItem ? {
                        ...menuItem,
                        prepared_items_inventory: inv ? [inv] : []
                    } : null
                });
            }

            // 4a. Fetch Tracked Menu Items (Implicit Prep Tasks) from local DB
            let trackedItems = await db.menu_items
                .where('business_id').equals(bId)
                .filter(item => {
                    const settings = item.inventory_settings || {};
                    return settings.prepType && ['production', 'completion', 'defrost', 'requires_prep'].includes(settings.prepType);
                })
                .filter(item => {
                    const settings = item.inventory_settings || {};
                    return settings.prepType && ['production', 'completion', 'defrost', 'requires_prep'].includes(settings.prepType);
                })
                .toArray();

            console.log(`📋 [PrepPage] Local Recurring Tasks: ${rawTasks.length}, Tracked Items: ${trackedItems.length}`);

            // 4a-2. Fallback for tracked items
            if (trackedItems.length === 0 && navigator.onLine) {
                const { data: remoteItems } = await supabase
                    .from('menu_items')
                    .select('*')
                    .eq('business_id', bId);

                if (remoteItems && remoteItems.length > 0) {
                    trackedItems = remoteItems.filter(item => {
                        const settings = item.inventory_settings || {};
                        return settings.prepType && ['production', 'completion', 'defrost', 'requires_prep'].includes(settings.prepType);
                    });
                } else {
                    console.log('⚠️ [PrepPage] No remote menu items found for this business.');
                }
            }

            const existingMenuItemIds = new Set(activeTasks.map(t => t.menu_item_id).filter(Boolean));
            const implicitTasks = [];

            for (const item of trackedItems) {
                if (existingMenuItemIds.has(item.id)) continue;

                let inv = await db.prepared_items_inventory.get(item.id);
                if (!inv && navigator.onLine) {
                    const { data: remoteInv } = await supabase.from('prepared_items_inventory').select('*').eq('item_id', item.id).single();
                    if (remoteInv) inv = remoteInv;
                }

                // Check implicit completion (if notes exist matching pattern)
                const implicitKey = `implicit_prep_${item.id}`;
                if (completedNotes.has(implicitKey)) continue;

                implicitTasks.push({
                    id: `implicit_prep_${item.id}`,
                    menu_item_id: item.id,
                    name: item.name,
                    description: item.description || 'פריט דורש הכנה',
                    category: item.category,
                    image_url: item.image_url,
                    logic_type: 'production',
                    target_qty: 0,
                    menu_item: {
                        ...item,
                        prepared_items_inventory: inv ? [inv] : []
                    },
                    is_implicit: true
                });
            }

            const combinedTasks = [...activeTasks, ...implicitTasks];

            // 4b. Supplier tasks from local DB
            let localSuppliers = await db.suppliers
                .where('business_id').equals(bId)
                .toArray();

            if (localSuppliers.length === 0 && navigator.onLine) {
                const { data: remoteSuppliers } = await supabase.from('suppliers').select('*').eq('business_id', bId);
                if (remoteSuppliers) localSuppliers = remoteSuppliers;
            }

            const tomorrowIdx = ((businessTime.getDay() + 1) % 7);
            const supplierVirtualTasks = localSuppliers
                .filter(s => {
                    let days = [];
                    if (Array.isArray(s.delivery_days)) days = s.delivery_days;
                    else if (typeof s.delivery_days === 'string') {
                        try { days = JSON.parse(s.delivery_days); }
                        catch (e) { days = s.delivery_days.split(',').map(d => d.trim()); }
                    }
                    return days.map(d => Number(d)).includes(tomorrowIdx);
                })
                .map(s => ({
                    id: `inv-count-${s.id}`,
                    supplier_id: s.id,
                    name: `ספירת מלאי: ${s.name}`,
                    description: `הספק מגיע מחר. יש לבצע ספירת מלאי.`,
                    target_qty: 1,
                    category: 'prep',
                    is_supplier_task: true
                }))
                .filter(t => !completedNotes.has(t.id)); // Using ID as it is stored in completion notes if no specific notes provided

            // 5. Categorize and flatten
            const finalActiveTasks = [...combinedTasks, ...supplierVirtualTasks]; // Add supplier tasks here to flatten logic
            console.log('📋 [PrepPage] All Active Tasks (Combined):', finalActiveTasks.length, finalActiveTasks);

            const getFlattenedItem = (t) => {
                const inv = t.menu_item?.prepared_items_inventory?.[0] || {};
                return {
                    ...t,
                    current_stock: Number(inv.current_stock) || 0,
                    unit: inv.unit || 'יח׳',
                    image_url: t.menu_item?.image_url || t.image_url,
                    category: t.menu_item?.category || t.category
                };
            };

            const productionTasksFiltered = finalActiveTasks
                .filter(t => {
                    const pt = t.menu_item?.inventory_settings?.prepType;
                    return pt === 'production' || pt === 'completion' || pt === 'requires_prep';
                })
                .map(getFlattenedItem);

            const defrostTasksFiltered = finalActiveTasks
                .filter(t => t.menu_item?.inventory_settings?.prepType === 'defrost')
                .map(getFlattenedItem);

            const opening = [];
            const closing = [];
            const prepGroup = [];
            const supplierGroup = [];

            finalActiveTasks.forEach(t => {
                const name = (t.name || '').toLowerCase();
                const cat = (t.category || '').toLowerCase();
                const pt = t.menu_item?.inventory_settings?.prepType;

                if (t.is_supplier_task) {
                    supplierGroup.push(t);
                    return;
                }

                const isInventoryItem = pt === 'production' || pt === 'completion' || pt === 'requires_prep' || pt === 'defrost';
                if (isInventoryItem) return;

                const isOpening = isCategoryMatch('opening', cat) || name.includes('פתיחה') || name.includes('בקר') || name.includes('בוקר');
                const isClosing = isCategoryMatch('closing', cat) || name.includes('סגירה') || name.includes('ערב') || name.includes('סיום');

                if (isOpening) opening.push(t);
                else if (isClosing) closing.push(t);
                else prepGroup.push(t);
            });

            setOpeningTasks(opening);
            setClosingTasks(closing);
            setPrepBatches(prepGroup);
            setSupplierTasks(supplierGroup);

            setAllPreparedItems({
                production: productionTasksFiltered,
                defrost: defrostTasksFiltered
            });

            // 6. Fetch settings from local DB if possible (else fallback to supabase for now)
            const bData = await db.businesses.get(bId);
            if (bData) {
                setBusinessSettings(bData);
            } else {
                const { data: remoteB } = await supabase.from('businesses').select('*').eq('id', bId).single();
                if (remoteB) setBusinessSettings(remoteB);
            }

        } catch (err) {
            console.error('Error fetching data from local DB:', err);
            setError('שגיאה בטעינת נתונים מקומיים.');
        } finally {
            setLoading(false);
        }
    }, [currentUser?.business_id]);

    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    // Intelligent Auto-Switch Tab based on Business Settings
    useEffect(() => {
        if (!businessSettings || hasAutoSwitched) return;

        const now = new Date();
        const hour = now.getHours();
        const mins = now.getMinutes();
        const currentTimeDecimal = hour + (mins / 60);

        // Parse closing time (e.g. "15:00:00" -> 15.0)
        let closingThreshold = 19; // Default
        if (businessSettings.closing_tasks_start_time) {
            const [h, m] = businessSettings.closing_tasks_start_time.split(':').map(Number);
            closingThreshold = h + (m / 60);
        }

        let newTab = 'pre_closing';
        if (hour >= 5 && hour < 11) {
            newTab = 'opening';
        } else if (currentTimeDecimal >= closingThreshold || hour < 5) {
            newTab = 'closing';
        }

        setTasksSubTab(newTab);
        setHasAutoSwitched(true);
        console.log(`🤖 Auto-switched tab to "${newTab}" based on business closing time (${closingThreshold})`);

    }, [businessSettings, hasAutoSwitched]);

    const totalTasksCount = openingTasks.length + prepBatches.length + closingTasks.length + supplierTasks.length;

    const PrepItemCard = ({ item }) => {
        const initialSuggestion = item.current_stock > 0 ? item.current_stock : (item.target_qty || 0);
        const hasChange = stockUpdates[item.id] !== undefined;
        const currentVal = hasChange ? stockUpdates[item.id] : initialSuggestion;
        const canSave = hasChange || currentVal > 0;

        // Dynamic Color based on Tab
        const buttonColorClass = tasksSubTab === 'opening' ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white' :
            tasksSubTab === 'pre_closing' ? 'bg-orange-50 text-orange-600 hover:bg-orange-500 hover:text-white' :
                'bg-purple-50 text-purple-600 hover:bg-purple-500 hover:text-white';

        return (
            <div className={`group flex items-center gap-4 p-2.5 rounded-2xl border transition-all duration-200 bg-white border-slate-100 hover:border-slate-200 shadow-sm`}>

                {/* Complete Button (Unified Style) - FIRST CHILD IS RIGHTMOST IN RTL */}
                <button
                    onClick={() => canSave && handleStockUpdate(item, currentVal)}
                    disabled={!canSave}
                    className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center transition-all shadow-sm active:scale-90
                        ${canSave ? buttonColorClass : 'bg-slate-50 text-slate-200 cursor-not-allowed'}`}
                >
                    <CheckCircle size={20} strokeWidth={2.5} />
                </button>

                {/* Name & Info (Middle/Right) */}
                <div className="flex-1 min-w-0 flex flex-col justify-center text-right">
                    <div className="flex items-center gap-2 justify-start">
                        <h4 className="font-black text-slate-800 text-sm leading-tight truncate">{item.name}</h4>
                        {item.target_qty > 0 && (
                            <span className="text-[10px] text-slate-400 font-bold bg-slate-50 px-1.5 py-0.5 rounded-md shrink-0">
                                יעד: {item.target_qty}
                            </span>
                        )}
                        {/* Status changed indicator */}
                        {hasChange && (
                            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                        )}
                    </div>
                </div>

                {/* Counter (Left - Last Child) */}
                <div className="flex items-center bg-slate-50 p-1 rounded-xl border border-slate-100 h-10 shrink-0">
                    <button
                        onClick={() => setStockUpdates(p => ({ ...p, [item.id]: (p[item.id] ?? initialSuggestion) + 1 }))}
                        className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm text-slate-400 hover:text-emerald-500 transition active:scale-90"
                    >
                        <Plus size={14} />
                    </button>
                    <div className="w-10 text-center flex flex-col justify-center leading-none">
                        <span className={`text-sm font-black ${hasChange ? 'text-indigo-600' : 'text-slate-600'}`}>
                            {currentVal}
                        </span>
                        <span className="text-[9px] text-slate-400 font-bold">{item.unit || 'יח\''}</span>
                    </div>
                    <button
                        onClick={() => setStockUpdates(p => ({ ...p, [item.id]: Math.max(0, (p[item.id] ?? initialSuggestion) - 1) }))}
                        className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm text-slate-400 hover:text-rose-500 transition active:scale-90"
                    >
                        <Minus size={14} />
                    </button>
                </div>
            </div>
        );
    };

    const handleStockUpdate = async (item, newQty) => {
        try {
            const menu_item_id = item.menu_item_id || item.id;

            if (!menu_item_id || String(menu_item_id).startsWith('inv-count-')) return;
            if (!currentUser?.business_id) return;

            const payload = {
                item_id: Number(menu_item_id),
                business_id: currentUser.business_id,
                current_stock: newQty,
                initial_stock: item.current_stock || newQty,
                unit: item.unit || 'יח׳',
                last_updated: new Date().toISOString()
            };

            // 1. OPTIMISTIC UPDATE: Write to Dexie (Offline First)
            try {
                // Update local inventory
                await db.prepared_items_inventory.put(payload);

                // Log local task completion
                const now = new Date();
                const businessTime = new Date(now.getTime() - (5 * 60 * 60 * 1000));
                const dateStr = businessTime.toLocaleDateString('en-CA');

                const isImplicit = String(item.id).startsWith('implicit_prep_');
                const logPayload = {
                    recurring_task_id: isImplicit ? null : item.id,
                    notes: isImplicit ? `implicit_prep_${item.menu_item_id}` : `Inventory Update: ${item.name}`,
                    completion_date: dateStr,
                    completed_by: currentUser?.id,
                    quantity_produced: newQty,
                    business_id: currentUser?.business_id,
                    id: `local_${Date.now()}_${item.id}` // Local ID
                };
                await db.task_completions.add(logPayload);
            } catch (localErr) {
                console.error('❌ Dexie write failed:', localErr);
                // Critical local fail - might stop here, but let's try cloud as backup
            }

            // 2. ATTEMPT CLOUD SYNC (Non-blocking or catch & ignore for offline)
            if (navigator.onLine) {
                try {
                    const { error: upsertErr } = await supabase
                        .from('prepared_items_inventory')
                        .upsert(payload, { onConflict: 'item_id' });

                    if (upsertErr) console.warn('☁️ Cloud inventory update failed:', upsertErr);

                    // Sync completion log to cloud (remove local ID first)
                    const now = new Date();
                    const businessTime = new Date(now.getTime() - (5 * 60 * 60 * 1000));
                    const dateStr = businessTime.toLocaleDateString('en-CA');

                    const isImplicit = String(item.id).startsWith('implicit_prep_');
                    const cloudLogPayload = {
                        recurring_task_id: isImplicit ? null : item.id,
                        notes: isImplicit ? `implicit_prep_${item.menu_item_id}` : `Inventory Update: ${item.name}`,
                        completion_date: dateStr,
                        completed_by: currentUser?.id,
                        quantity_produced: newQty,
                        business_id: currentUser?.business_id
                    };
                    await supabase.from('task_completions').insert(cloudLogPayload);
                } catch (cloudErr) {
                    console.warn('☁️ Offline/Cloud sync failed, data saved locally:', cloudErr);
                }
            } else {
                console.log('🔌 Offline mode: Data saved locally to Dexie');
            }

            console.log(`✅ Prep item "${item.name}" stock updated to ${newQty}`);

            // 3. Clear local update state & Remove from view immediately
            // 3. Clear local update state & Remove from view immediately
            setStockUpdates(prev => {
                const next = { ...prev };
                delete next[item.id];
                return next;
            });

            // Remove from local list immediately
            setAllPreparedItems(prev => ({
                production: prev.production.filter(i => i.id !== item.id),
                defrost: prev.defrost.filter(i => i.id !== item.id)
            }));

            // Defensive: Also remove from task lists if it was duplicated there
            setOpeningTasks(prev => prev.filter(t => t.id !== item.id));
            setClosingTasks(prev => prev.filter(t => t.id !== item.id));
            setPrepBatches(prev => prev.filter(t => t.id !== item.id));
            setSupplierTasks(prev => prev.filter(t => t.id !== item.id));

            // Trigger Info/Success Message
            setSuccessItemName(item.name || item.menu_item?.name || 'הפריט');
            if (hidePrepInfo) {
                setShowSuccess(true);
                setTimeout(() => setShowSuccess(false), 3000);
            } else {
                setShowInfoModal(true);
            }

            // Background refresh (optional, but good for consistency)
            // fetchAllData(); dont fetch immediately to avoid flicker, let local state handle UI
        } catch (err) {
            console.error('Error updating stock:', err);
            setError('שגיאה בעדכון המלאי.');
        }
    };

    const tasksList = useMemo(() => prepareItemsWithSort(getActiveRecurringTasks()), [getActiveRecurringTasks, prepareItemsWithSort]);
    const prepList = useMemo(() => prepareItemsWithSort(preparedItemsToList), [preparedItemsToList, prepareItemsWithSort]);
    const defrostList = useMemo(() => prepareItemsWithSort(defrostItemsToList), [defrostItemsToList, prepareItemsWithSort]);
    const isAllEmpty = !loading && tasksList.length === 0 && prepList.length === 0 && defrostList.length === 0;

    return (
        <div className="flex flex-col h-[100dvh] bg-[#F8FAFC] overflow-hidden font-heebo" dir="rtl">

            <UnifiedHeader
                title="משימות והכנות"
                subtitle="ניהול משימות יומיות, הכנות והפשרות"
                headerTabs={[
                    { id: 'opening', label: 'פתיחה', icon: <Sunrise size={16} strokeWidth={2.5} />, isActive: tasksSubTab === 'opening', onClick: () => setTasksSubTab('opening'), count: getCountsForShift('opening'), colorClass: 'text-emerald-600' },
                    { id: 'pre_closing', label: 'הכנות', icon: <Utensils size={16} strokeWidth={2.5} />, isActive: tasksSubTab === 'pre_closing', onClick: () => setTasksSubTab('pre_closing'), count: getCountsForShift('pre_closing'), colorClass: 'text-orange-600' },
                    { id: 'closing', label: 'סגירה', icon: <Sunset size={16} strokeWidth={2.5} />, isActive: tasksSubTab === 'closing', onClick: () => setTasksSubTab('closing'), count: getCountsForShift('closing'), colorClass: 'text-purple-600' }
                ]}
            />

            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6 text-right" dir="rtl">
                {isAllEmpty ? (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="h-full flex flex-col items-center justify-center -mt-10"
                    >
                        <div className="relative mb-8">
                            <div className="absolute inset-0 bg-emerald-100 blur-3xl rounded-full opacity-50" />
                            <div className="relative w-40 h-40 bg-white shadow-2xl shadow-emerald-100 rounded-[2.5rem] flex items-center justify-center text-emerald-500 ring-4 ring-emerald-50">
                                <CheckCircle size={80} strokeWidth={2.5} />
                            </div>
                        </div>

                        <h2 className="text-4xl md:text-5xl font-black text-slate-800 tracking-tight mb-4 text-center">
                            הכל מוכן! עבודה מצוינת.
                        </h2>
                        <p className="text-xl font-medium text-slate-400 max-w-md text-center leading-relaxed">
                            אין משימות פתוחות כרגע.
                            <br />
                            זה הזמן לקחת הפסקה קצרה או לעזור בעמדות אחרות.
                        </p>
                    </motion.div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 mx-auto max-w-[1600px]">
                        {/* Section 1: Tasks */}
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center justify-between px-2">
                                <h4 className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    <ClipboardList size={14} />
                                    משימות שוטפות
                                </h4>
                                <span className="text-[10px] font-black bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full">
                                    {tasksList.length}
                                </span>
                            </div>
                            <TaskManagementView
                                key={tasksSubTab}
                                tasks={tasksList}
                                onComplete={handleCompleteTask}
                                tabType={tasksSubTab}
                            />
                        </div>

                        {/* Section 2: Preparations */}
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center justify-between px-2">
                                <h4 className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    <ChefHat size={14} />
                                    הכנות לייצור
                                </h4>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full">
                                        {prepList.length}
                                    </span>
                                </div>
                            </div>
                            <div className="flex flex-col gap-3 min-h-[100px]">
                                {loading ? (
                                    <div className="flex items-center justify-center flex-1 py-12">
                                        <div className="w-8 h-8 border-4 border-slate-200 border-t-orange-500 rounded-full animate-spin" />
                                    </div>
                                ) : (
                                    <>
                                        {prepList.map(item => (
                                            <PrepItemCard key={item.id} item={item} />
                                        ))}
                                        {prepList.length === 0 && (
                                            <div className="flex flex-col items-center justify-center py-12 bg-white/50 rounded-3xl border border-dashed border-slate-200">
                                                <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-200 mb-2">
                                                    <ChefHat size={24} />
                                                </div>
                                                <p className="font-black text-[10px] text-slate-300 uppercase tracking-widest">אין הכנות פתוחות</p>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Section 3: Defrosting */}
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center justify-between px-2">
                                <h4 className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    <Snowflake size={14} />
                                    הפשרות
                                </h4>
                                <span className="text-[10px] font-black bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full">
                                    {defrostList.length}
                                </span>
                            </div>
                            <div className="flex flex-col gap-3 min-h-[100px]">
                                {loading ? (
                                    <div className="flex items-center justify-center flex-1 py-12">
                                        <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
                                    </div>
                                ) : (
                                    <>
                                        {defrostList.map(item => (
                                            <PrepItemCard key={item.id} item={item} />
                                        ))}
                                        {defrostList.length === 0 && (
                                            <div className="flex flex-col items-center justify-center py-12 bg-white/50 rounded-3xl border border-dashed border-slate-200">
                                                <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-200 mb-2">
                                                    <Snowflake size={24} />
                                                </div>
                                                <p className="font-black text-[10px] text-slate-300 uppercase tracking-widest">אין הפשרות פתוחות</p>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {/* Detailed Info Modal (Prep Instruction) */}
            <AnimatePresence>
                {showInfoModal && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-white rounded-[3rem] p-8 max-w-lg w-full shadow-2xl"
                        >
                            <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
                                <Info size={40} />
                            </div>

                            <h2 className="text-2xl font-black text-slate-800 text-center mb-4">השלמת הכנה / הפשרה</h2>

                            <div className="bg-slate-50 p-6 rounded-3xl space-y-4 mb-8 text-center">
                                <p className="font-bold text-slate-600 leading-relaxed italic">
                                    "ניתן לעדכן את המלאי בכל עת במסך המלאי הראשי תחת כפתור <span className="text-indigo-600">'מלאי הכנות'</span> (מימין למטה)"
                                </p>
                                <div className="h-px bg-slate-200 w-24 mx-auto" />
                                <p className="text-sm text-slate-400 font-bold">
                                    הפריט יוסר כעת מרשימת המשימות ויועדכן בקופה.
                                </p>
                            </div>

                            <div className="flex flex-col gap-4">
                                <button
                                    onClick={() => setShowInfoModal(false)}
                                    className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-lg shadow-xl shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all outline-none"
                                >
                                    הבנתי, בצע!
                                </button>

                                <label className="flex items-center justify-center gap-2 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={hidePrepInfo}
                                        onChange={(e) => {
                                            const val = e.target.checked;
                                            setHidePrepInfo(val);
                                            localStorage.setItem('hidePrepInfo', val ? 'true' : 'false');
                                        }}
                                        className="w-5 h-5 rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span className="text-sm font-bold text-slate-400 group-hover:text-slate-600 transition-colors">אל תראה מודעה זו שוב</span>
                                </label>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Open Orders Warning Modal */}
            <AnimatePresence>
                {showOpenOrdersModal && (
                    <div className="fixed inset-0 z-[201] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="bg-white rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl relative overflow-hidden text-center"
                        >
                            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-orange-400 to-rose-500" />

                            <div className="w-20 h-20 bg-orange-100 text-orange-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-orange-100">
                                <Utensils size={40} strokeWidth={2.5} />
                            </div>

                            <h2 className="text-3xl font-black text-slate-800 mb-2">רגע אחד!</h2>
                            <div className="flex flex-col gap-1 mb-6">
                                <p className="text-lg font-bold text-slate-600">
                                    ישנן <span className="text-orange-600 font-black text-xl mx-1">{openOrdersCount}</span> הזמנות פתוחות.
                                </p>
                                {staleOrdersCount > 0 && (
                                    <p className="text-sm font-bold text-slate-400">
                                        מתוכן <span className="text-rose-500">{staleOrdersCount}</span> הזמנות משמרות קודמות ("זומבים")
                                    </p>
                                )}
                                <p className="text-sm text-slate-400 font-medium mt-1">
                                    לפני סגירת המשמרת, מומלץ לסיים את הטיפול בהן.
                                </p>
                            </div>

                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={() => navigate('/kds')}
                                    className="w-full py-5 bg-slate-900 text-white rounded-[1.5rem] font-black text-xl shadow-xl shadow-slate-200 hover:bg-slate-800 active:scale-[0.98] transition-all flex items-center justify-center gap-3 group"
                                >
                                    <ChefHat className="group-hover:rotate-12 transition-transform" />
                                    מעבר למסך מטבח
                                </button>

                                {staleOrdersCount > 0 && (
                                    <button
                                        onClick={handleClearStale}
                                        className="w-full py-4 bg-rose-50 text-rose-600 rounded-[1.2rem] font-black text-lg hover:bg-rose-100 active:scale-[0.98] transition-all flex items-center justify-center gap-2 border-2 border-rose-100"
                                    >
                                        <RotateCcw size={20} />
                                        נקה {staleOrdersCount} הזמנות ישנות
                                    </button>
                                )}

                                <button
                                    onClick={() => setShowOpenOrdersModal(false)}
                                    className="w-full py-3 text-slate-400 font-bold hover:text-slate-600 transition-colors bg-white hover:bg-slate-50 rounded-2xl"
                                >
                                    התעלם והמשך בסגירה
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Success Message Overlay */}
            <AnimatePresence>
                {showSuccess && (
                    <motion.div
                        initial={{ opacity: 0, y: 50, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] bg-slate-900/95 backdrop-blur-xl border border-slate-700 p-6 rounded-[2.5rem] shadow-2xl flex items-center gap-6 min-w-[400px]"
                    >
                        <div className="w-16 h-16 bg-emerald-500 rounded-3xl flex items-center justify-center text-white shrink-0 shadow-lg shadow-emerald-500/20">
                            <CheckCircle size={32} strokeWidth={3} />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-white font-black text-xl mb-1">עודכן בהצלחה!</h3>
                            <p className="text-slate-400 text-sm font-bold leading-relaxed">
                                מלאי <span className="text-emerald-400">"{successItemName}"</span> עודכן.
                                <br />
                                ניתן לערוך את המלאי במסך מלאי בכפתור <span className="text-white">"ספירה ודיווח"</span> מימין למטה.
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default PrepPage;
