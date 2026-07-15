/**
 * useKDSDataLocal - Local-First KDS Data Hook
 * 
 * This is a simplified, local-first version of useKDSData that:
 * 1. Reads ALL data from Dexie (local IndexedDB)
 * 2. Uses useLiveQuery for real-time reactivity
 * 3. Writes go through offline queue for background sync
 * 
 * Benefits:
 * - Works offline by default
 * - Instant UI updates (no network latency)
 * - Automatic real-time sync via OfflineContext
 */

import { useMemo, useEffect, useRef, useCallback, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuth } from '@/context/AuthContext';
import db from '@/db/database';
import { groupOrderItems, isHotDrink as isHotDrinkUtil, isKitchenPrep } from '@/utils/kdsUtils';
import { useKDSSms } from '@/pages/kds/hooks/useKDSSms';

import { supabase } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';

export const useKDSDataLocal = () => {
    const { currentUser } = useAuth();
    const businessId = currentUser?.business_id;
    const hasAutoSynced = useRef(false);

    // 📱 SMS HOOK integration
    const { smsToast, setSmsToast, isSendingSms, handleSendSms, getSmsStatus } = useKDSSms();

    // 🛡️ Track order IDs we recently wrote to — suppress Realtime echo
    const recentSelfWrites = useRef(new Map()); // orderId → timestamp

    // Auto-sync on mount and Realtime subscriptions
    useEffect(() => {
        if (!businessId) return;

        // 🧹 Aggressive Dexie cleanup — runs on mount AND every 15 minutes
        const runCleanup = async () => {
            try {
                const cutoff = new Date();
                cutoff.setHours(5, 0, 0, 0); // Today at 05:00
                if (new Date().getHours() < 5) cutoff.setDate(cutoff.getDate() - 1);
                const cutoffISO = cutoff.toISOString();

                const oldOrders = await db.orders
                    .filter(o => o.created_at < cutoffISO)
                    .toArray();

                if (oldOrders.length > 0) {
                    const oldIds = oldOrders.map(o => o.id);
                    console.log(`🧹 [KDS] Cleaning ${oldOrders.length} old orders from Dexie...`);
                    await db.transaction('rw', db.orders, db.order_items, async () => {
                        await db.order_items.where('order_id').anyOf(oldIds).delete();
                        await db.orders.bulkDelete(oldIds);
                    });
                    console.log(`✅ [KDS] Cleanup complete — removed ${oldOrders.length} old orders`);
                }
            } catch (e) {
                console.warn('🧹 Cleanup error:', e);
            }
        };

        // Run immediately + every 15 min
        runCleanup();
        const cleanupInterval = setInterval(runCleanup, 15 * 60 * 1000);

        if (!hasAutoSynced.current) {
            hasAutoSynced.current = true;
            console.log('🔄 [KDS] Auto-syncing data on mount...');

            const autoSync = async () => {
                try {
                    const { syncOrders } = await import('@/services/syncService');
                    const result = await syncOrders(businessId);
                    if (result.success) {
                        console.log(`✅ [KDS] Auto-sync complete: ${result.ordersCount || 0} orders`);
                    }
                } catch (err) {
                    console.error('❌ [KDS] Auto-sync failed:', err);
                }
            };
            autoSync();
        }

        let debounceTimer = null;

        const triggerSync = () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(async () => {
                try {
                    console.log('🔄 [KDS Background Sync] Realtime event triggered sync...');
                    const { syncOrders } = await import('@/services/syncService');
                    await syncOrders(businessId);
                } catch (e) { console.error(e) }
            }, 500);
        };

        const channel = supabase
            .channel(`kds-local-sync-${businessId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'orders',
                filter: `business_id=eq.${businessId}`
            }, (payload) => {
                // Skip echo from our own writes
                const orderId = payload.new?.id || payload.old?.id;
                const selfWrite = recentSelfWrites.current.get(orderId);
                if (selfWrite && Date.now() - selfWrite < 3000) {
                    console.log(`🔇 [Realtime] Suppressing echo for order ${orderId}`);
                    return;
                }
                console.log(`🔔 KDS Realtime (orders): ${payload.eventType}`);
                triggerSync();
            })
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'order_items'
            }, (payload) => {
                // Skip echo from our own writes
                const itemOrderId = payload.new?.order_id || payload.old?.order_id;
                const selfWrite = recentSelfWrites.current.get(itemOrderId);
                if (selfWrite && Date.now() - selfWrite < 3000) {
                    return; // 🔇 Silently skip — we already updated Dexie
                }

                console.log(`🔔 KDS Realtime (items): ${payload.eventType}`, payload.new?.id);
                // ⚡ FAST PATH: Directly apply the Realtime payload to Dexie
                if (payload.eventType === 'UPDATE' && payload.new) {
                    db.order_items.update(payload.new.id, {
                        ...payload.new,
                        is_early_delivered: !!(payload.new.early_delivered_at || payload.new.is_early_delivered)
                    }).catch(e => console.warn('Realtime Dexie fast-path failed:', e));
                } else if (payload.eventType === 'INSERT' && payload.new) {
                    db.order_items.put(payload.new).catch(e => console.warn('Realtime Dexie insert failed:', e));
                } else if (payload.eventType === 'DELETE' && payload.old) {
                    db.order_items.delete(payload.old.id).catch(e => console.warn('Realtime Dexie delete failed:', e));
                }
                triggerSync();
            })
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'menu_items'
            }, (payload) => {
                console.log(`🔔 KDS Realtime (menu_items): ${payload.eventType}`, payload.new?.id);
                if (payload.eventType === 'UPDATE' && payload.new) {
                    db.menu_items.update(payload.new.id, payload.new)
                        .catch(e => console.warn('Realtime Dexie menu_items update failed:', e));
                } else if (payload.eventType === 'INSERT' && payload.new) {
                    db.menu_items.put(payload.new)
                        .catch(e => console.warn('Realtime Dexie menu_items insert failed:', e));
                } else if (payload.eventType === 'DELETE' && payload.old) {
                    db.menu_items.delete(payload.old.id)
                        .catch(e => console.warn('Realtime Dexie menu_items delete failed:', e));
                }
            });

        // 🔄 Polling fallback: Run sync every 3 seconds to guarantee KDS updates even if Realtime disconnects
        const pollingInterval = setInterval(() => {
            console.log('🔄 [KDS Polling] Running periodic fallback sync...');
            triggerSync();
        }, 3000);

        channel.subscribe();

        return () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            clearInterval(cleanupInterval);
            clearInterval(pollingInterval);
            supabase.removeChannel(channel);
        };
    }, [businessId]);

    // Heartbeat for System Health (Super Admin Stats)
    useEffect(() => {
        if (!currentUser?.business_id) return;

        let deviceId = localStorage.getItem('kds_device_id');
        if (!deviceId) {
            deviceId = 'kds_' + uuidv4();
            localStorage.setItem('kds_device_id', deviceId);
        }

        const fetchIp = async () => {
            if (!navigator.onLine) return null;
            const cached = sessionStorage.getItem('device_public_ip');
            if (cached) return cached;
            try {
                const services = [
                    'https://api.ipify.org?format=json',
                    'https://api.my-ip.io/ip.json'
                ];
                for (const url of services) {
                    try {
                        const res = await fetch(url);
                        const data = await res.json();
                        const ip = data.ip || data.success?.ip;
                        if (ip) {
                            sessionStorage.setItem('device_public_ip', ip);
                            console.log('🌐 Got IP:', ip);
                            return ip;
                        }
                    } catch { /* try next */ }
                }
                return null;
            } catch {
                return null;
            }
        };

        const sendHeartbeat = async () => {
            if (!navigator.onLine) {
                console.log('📴 Skipping heartbeat - device is offline');
                return;
            }
            try {
                const ip = await fetchIp();
                const screenRes = `${window.screen.width}x${window.screen.height}`;
                const payload = {
                    p_business_id: currentUser.business_id,
                    p_device_id: deviceId,
                    p_device_type: 'kds',
                    p_ip_address: ip || 'לא זמין',
                    p_user_agent: navigator.userAgent?.substring(0, 200) || 'Unknown',
                    p_screen_resolution: screenRes,
                    p_user_name: currentUser.name || currentUser.employee_name || 'אורח',
                    p_employee_id: currentUser.id || null
                };
                console.log('💓 Sending KDS heartbeat:', { deviceId, ip, screenRes, user: payload.p_user_name });
                const { error } = await supabase.rpc('send_device_heartbeat', payload);
                if (error) throw error;
                console.log('✅ Heartbeat success');
            } catch (err) {
                console.warn('⚠️ Device heartbeat failed:', err.message);
                if (navigator.onLine) {
                    try {
                        await supabase.rpc('send_kds_heartbeat', {
                            p_business_id: currentUser.business_id
                        });
                    } catch (e) {
                        console.error('❌ All heartbeats failed');
                    }
                }
            }
        };

        fetchIp().then(() => {
            sendHeartbeat();
        });

        const interval = setInterval(sendHeartbeat, 30000); // 30s heartbeat

        return () => clearInterval(interval);
    }, [currentUser]);

    // ============================================
    // LIVE QUERIES - Auto-update when data changes
    // ============================================

    // 🛡️ RECENT UPDATES MASK - Prevents sync-jumps by preserving local state for 10s
    const recentLocalUpdates = useRef(new Map());

    // 🚀 NEW: OPTIMISTIC STATE (Instantly decoupled from Dexie)
    const [optimisticState, setOptimisticState] = useState({
        orders: {}, // orderId: status
        items: {}   // itemId: status
    });

    // Get today's active orders
    const activeOrders = useLiveQuery(async () => {
        if (!businessId) {
            console.log('⏸️ [KDS] No businessId yet');
            return [];
        }

        // 🛠️ FIX: Use BUSINESS DAY starting at 05:00 AM, not a 24-hour window
        const now = new Date();
        const businessDayStart = new Date(now);
        businessDayStart.setHours(5, 0, 0, 0);

        // If it's before 5 AM, the business day started yesterday at 5 AM
        if (now.getHours() < 5) {
            businessDayStart.setDate(businessDayStart.getDate() - 1);
        }

        console.log('🔍 [KDS] Querying orders for businessId:', businessId, 'since:', businessDayStart.toISOString());

        // Get orders that are active AND from current business day
        const orders = await db.orders
            .where('business_id')
            .equals(businessId)
            .filter(o => {
                const orderDate = new Date(o.created_at);
                const isFromToday = orderDate >= businessDayStart;

                // 🛡️ Apply recent local update mask to prevent jumps during sync
                const localUpdate = recentLocalUpdates.current.get(o.id);
                if (localUpdate && Date.now() - localUpdate.timestamp < 30000) {
                    if (o.order_status !== localUpdate.status) {
                        console.log(`🛡️ [KDS-MASK] Protective mask applied to ${o.order_number}: ${o.order_status} -> ${localUpdate.status}`);
                        o.order_status = localUpdate.status;
                    }
                }

                const isTerminal = ['archived', 'cancelled'].includes(o.order_status);
                if (isTerminal) return false;

                const isActive = ['in_progress', 'ready', 'new', 'pending', 'preparing', 'fired'].includes(o.order_status);
                const isDone = ['completed', 'shipped'].includes(o.order_status);
                const isUnpaidDone = isDone && (!o.is_paid || (o.total_amount - (o.paid_amount || 0) > 0.01));
                const isPending = o.pending_sync === true;

                // 🎯 KDS INCLUSIVITY FIX: Include 'completed' and 'shipped' orders from today
                // so the memoized item-level filtering can decide if they still have active items.
                return (isActive) || (isFromToday && (isDone || isUnpaidDone || isPending));
            })
            .toArray();

        console.log(`📊 [KDS] Found ${orders.length} active orders from business day`);

        // 🛠️ SORT: Oldest first (will be on the RIGHT in RTL)
        return orders.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    }, [businessId]);

    // Get all order items for active orders
    const orderItems = useLiveQuery(async () => {
        if (!activeOrders || activeOrders.length === 0) {
            console.log('ℹ️ [KDS] No active orders - skipping items query');
            return [];
        }

        const orderIds = activeOrders.map(o => o.id);
        console.log('🔍 [KDS] Fetching items for order IDs using INDEXED query:', orderIds.length);

        // ⚡ PERFORMANCE FIX: Use anyOf() which uses the order_id index
        // Prevents full table scan on order_items which freezes the UI as DB grows
        const items = await db.order_items
            .where('order_id')
            .anyOf(orderIds)
            .toArray();

        console.log(`📊 [KDS] Fetched ${items.length} items`);
        return items;
    }, [activeOrders]);

    // Get menu items for display
    const menuItems = useLiveQuery(async () => {
        const items = await db.menu_items.toArray();
        console.log(`📋 [KDS] Loaded ${items.length} menu items from Dexie Cache`);
        return new Map(items.map(m => [m.id, m]));
    }, []);

    // Get option values for modifiers
    const optionValues = useLiveQuery(async () => {
        const values = await db.optionvalues.toArray();
        const map = new Map();
        values.forEach(v => {
            const name = v.name || v.value_name;
            map.set(String(v.id), name);
            map.set(v.id, name);
        });
        return map;
    }, []);

    // Get customers for active orders to resolve names
    // 🔍 ENHANCEMENT: Also map by phone for unlinked guest orders
    const { activeCustomers, activeCustomersByPhone } = useLiveQuery(async () => {
        const idMap = new Map();
        const phoneMap = new Map();
        
        try {
            // Fetch all customers for current business for better resolution
            const customers = await db.customers.toArray();
            customers.forEach(c => {
                if (c.id) idMap.set(String(c.id), c);
                const phone = c.phone_number || c.phone;
                if (phone) {
                    const cleanPhone = String(phone).replace(/\D/g, '');
                    if (cleanPhone) phoneMap.set(cleanPhone, c);
                }
            });
        } catch (e) { console.error('Failed to load customers for KDS mapping:', e); }

        return { activeCustomers: idMap, activeCustomersByPhone: phoneMap };
    }, [activeOrders]) || { activeCustomers: new Map(), activeCustomersByPhone: new Map() };

    // ============================================
    // PROCESS DATA
    // ============================================

    const processedOrders = useMemo(() => {
        console.log('🔄 [KDS-HOOK] Processing orders...', {
            active: !!activeOrders, items: !!orderItems, menu: !!menuItems, opts: !!optionValues, cust: !!activeCustomers
        });
        try {
            if (!activeOrders || !orderItems || !menuItems || !optionValues || !activeCustomers) {
                console.log('⏸️ [KDS-HOOK] Waiting for data (loading results)...');
                return { current: [], completed: [] };
            }

            const current = [];
            const completed = [];

            // ⚡ PERFORMANCE FIX: Pre-group items by order_id to avoid O(N*M) lookups in the loop
            const itemsByOrder = new Map();
            orderItems.forEach(item => {
                if (!item.order_id) return;
                const oid = String(item.order_id);
                if (!itemsByOrder.has(oid)) itemsByOrder.set(oid, []);
                itemsByOrder.get(oid).push(item);
            });

            // ⚡ STABLE SORT: Prevent jumping during updates (like payment confirmation)
            const sortedActiveOrders = [...activeOrders].sort((a, b) => 
                new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );

            sortedActiveOrders.forEach((o) => {
                if (!o || !o.id) return;

                // Create a shallow copy so we don't mutate Dexie's cached result
                const order = { ...o };

                // 🚀 OPTIMISTIC MASK (ORDERS)
                if (optimisticState.orders[order.id]) {
                    order.order_status = optimisticState.orders[order.id];
                }

                // ⚡ Optimized lookup with robust fallbacks for embedded item lists
                const items = itemsByOrder.get(String(order.id)) || order.order_items || order.items || order.items_detail || [];
                
                // CRITICAL: We also need to normalize the items if they came from JSON to ensure they have the order_id set correctly
                const normalizedItems = items.map(i => ({
                    ...i,
                    order_id: i.order_id || order.id,
                    item_status: i.item_status || i.status || 'new'
                }));

                // 🕵️ DEBUG ORDER 3757
                if (String(order.order_number).includes('3757')) {
                    console.log('🕵️ [KDS-PROCESS] Order 3757 details:', {
                        status: order.order_status,
                        customer_name: order.customer_name,
                        customerName: order.customerName,
                        normalizedItemsCount: normalizedItems.length,
                        is_paid: order.is_paid,
                        paid_amount: order.paid_amount,
                        total_amount: order.total_amount,
                        business_id: order.business_id,
                        created_at: order.created_at
                    });
                }

                if (normalizedItems.length === 0) {
                    if (String(order.order_number).includes('3757')) console.log('🕵️ [KDS-PROCESS] Skipping 3757: No items found!');
                    return;
                }

                // NEW: Calculate payment status early for filtering
                const allItems = normalizedItems.filter(i => i.item_status !== 'cancelled');
                const calculatedTotal = allItems.reduce((sum, i) => {
                    const menuItem = menuItems.get(i.menu_item_id);
                    return sum + (menuItem?.price || 0) * (i.quantity || 1);
                }, 0);

                const totalAmount = order.total_amount || calculatedTotal;
                const paidAmount = order.paid_amount || 0;
                const unpaidAmount = totalAmount - paidAmount;
                const isOrderPaid = order.is_paid === true;
                const isEffectivelyUnpaid = !isOrderPaid && unpaidAmount > 0.01;

                // 🎯 NEW KDS FILTERING LOGIC (USER REQUESTED): 
                // An order is "Active" if it has ANY item that is NOT 'completed', 'shipped', or 'cancelled'.
                // If ALL items are 'completed', 'shipped', or 'cancelled', it moves to History.
                
                const hasNonTerminalItems = normalizedItems.some(i => 
                    !['completed', 'shipped', 'cancelled'].includes(i.item_status)
                );

                const isTerminalStatus = ['archived', 'cancelled'].includes(order.order_status);
                
                // If the order is explicitly archived/cancelled at parent level, it's gone from active.
                if (isTerminalStatus) {
                    console.log(`🚮 [KDS-PROCESS] Removing ${order.order_number} - terminal status: ${order.order_status}`);
                    return;
                }

                // If all items are done AND it's paid, it shouldn't be in the active list at all.
                // 🛡️ EXCEPTION: 'ready' orders stay on screen for final handover even if all items are 'completed'.
                if (!hasNonTerminalItems && !isEffectivelyUnpaid && order.order_status !== 'ready') {
                    console.log(`⏭️ [KDS-PROCESS] Skipping fully completed & paid order ${order.order_number}`);
                    return;
                }

                // Process items
                const processedItems = normalizedItems
                    .filter(item => item.item_status !== 'cancelled')
                    .map(item => {
                        const menuItem = menuItems.get(item.menu_item_id);
                        // 🛡️ RE-DEFENSIVE: Try everything for the name (Dexie-cache, local-field, nested-server-join)
                        const itemName = menuItem?.name || item.name || item.menu_items?.name || 'Unknown Item';

                        // NEW: Unified Prep Check from shared utility
                        const isPrep = isKitchenPrep(item);

                        // prep logic
                        const kdsLogic = menuItem?.kds_routing_logic || 'MADE_TO_ORDER';

                        // Check for override
                        let hasOverride = false;
                        const mods = item.mods;
                        if (typeof mods === 'string' && (mods.includes('__KDS_OVERRIDE__') || mods.includes('__KDS_OVER_RIDE__'))) hasOverride = true;
                        else if (Array.isArray(mods) && mods.some(m => String(m).includes('__KDS_OVER_REIDE__'))) hasOverride = true;
                        else if (Array.isArray(mods) && mods.some(m => String(m).includes('__KDS_OVERRIDE__'))) hasOverride = true;

                        // Use the ORDER ITEM's own kds_routing_logic if it exists (set by POS clerk choice),
                        // otherwise fall back to the menu item's default
                        const effectiveLogic = item.kds_routing_logic || kdsLogic;

                        let isPrepRequired = true;
                        if (hasOverride) isPrepRequired = true;
                        else if (isPrep) isPrepRequired = true;
                        // 🚀 HERO: If explicitly set to MADE_TO_ORDER by clerk/modal, it ALWAYS needs prep
                        else if (effectiveLogic === 'MADE_TO_ORDER') isPrepRequired = true;
                        else if (effectiveLogic === 'GRAB_AND_GO') isPrepRequired = false;
                        else if (effectiveLogic === 'prep_override') isPrepRequired = false;
                        else if (effectiveLogic === 'CONDITIONAL') isPrepRequired = hasOverride;

                        // 🚀 OPTIMISTIC MASK (ITEMS)
                        let currentItemStatus = item.item_status;
                        if (optimisticState.items[item.id]) {
                            currentItemStatus = optimisticState.items[item.id];
                        }

                        // ⚡ AUTO-READY: If item doesn't need prep, it's effectively 'ready' instantly
                        if (!isPrepRequired && (currentItemStatus === 'new' || currentItemStatus === 'pending' || currentItemStatus === 'in_progress')) {
                            currentItemStatus = 'ready';
                        }

                        // Parse modifiers
                        let modsArray = [];
                        if (item.mods) {
                            try {
                                const parsed = typeof item.mods === 'string' ? JSON.parse(item.mods) : item.mods;
                                const parsedArray = Array.isArray(parsed) ? parsed : (parsed?.selectedOptions || []);
                                if (Array.isArray(parsedArray)) {
                                    modsArray = parsedArray.map(m => {
                                        if (typeof m === 'object') return m.value_name || m.valueName || m.name || m.text || m.label || '';
                                        return optionValues.get(String(m)) || String(m);
                                    }).filter(m =>
                                        m &&
                                        !m.toLowerCase().includes('default') &&
                                        m !== 'רגיל' &&
                                        !String(m).includes('KDS_OVERRIDE')
                                    );
                                }
                            } catch (e) { /* ignore */ }
                        }

                        // Add notes
                        if (item.notes) {
                            modsArray.push({ name: item.notes, is_note: true });
                        }

                        // Structure modifiers for display
                        const structuredModifiers = modsArray.map(mod => {
                            if (typeof mod === 'object' && mod.is_note) {
                                return { text: mod.name, color: 'mod-color-purple', isNote: true };
                            }

                            const modName = typeof mod === 'string' ? mod : (mod.name || mod.valueName || mod.value_name || mod.text || '');
                            let color = 'mod-color-gray';

                            if (modName.includes('סויה')) color = 'mod-color-lightgreen';
                            else if (modName.includes('שיבולת')) color = 'mod-color-beige';
                            else if (modName.includes('שקדים')) color = 'mod-color-lightyellow';
                            else if (modName.includes('נטול')) color = 'mod-color-blue';
                            else if (modName.includes('רותח')) color = 'mod-color-red';
                            else if (modName.includes('קצף') && !modName.includes('בלי')) color = 'mod-color-foam-up';
                            else if (modName.includes('בלי קצף')) color = 'mod-color-foam-none';

                            return { text: modName, color, isNote: false };
                        });

                        const modsKey = modsArray.map(m => typeof m === 'object' ? m.name : m).sort().join('|');

                        return {
                            id: item.id,
                            menuItemId: item.menu_item_id,
                            name: itemName,
                            modifiers: structuredModifiers,
                            quantity: item.quantity,
                            status: currentItemStatus,
                            price: menuItem?.price || item.price || 0,
                            category: menuItem?.category || '',
                            modsKey,
                            course_stage: item.course_stage || 1,
                            item_fired_at: item.item_fired_at,
                            is_early_delivered: !!(item.early_delivered_at || item.is_early_delivered),
                            early_delivered_at: item.early_delivered_at || null,
                            urgent_at: item.urgent_at || null,
                            production_area: menuItem?.production_area || null,
                            kds_routing_logic: effectiveLogic,
                            was_conditional: item.was_conditional || (kdsLogic === 'CONDITIONAL'),
                            isPrepRequired: isPrepRequired
                        };
                    })
                    .filter(item => item.isPrepRequired === true); // 🚀 HIDE ALL GRAB_AND_GO AND DELIVERED ITEMS FROM KDS ENTIRELY

                if (processedItems.length === 0) return;

                const cleanOrderPhone = String(order.customer_phone || order.customerPhone || '').replace(/\D/g, '');
                const customerFromPhone = cleanOrderPhone ? activeCustomersByPhone.get(cleanOrderPhone) : null;

                const baseOrder = {
                    id: order.id,
                    orderNumber: order.order_number || `#${String(order.id).slice(0, 8)}`,
                    customerName: order.customer_name || order.customerName || activeCustomers.get(String(order.customer_id))?.name || customerFromPhone?.name || '',
                    customerPhone: order.customer_phone || order.customerPhone || activeCustomers.get(String(order.customer_id))?.phone || activeCustomers.get(String(order.customer_id))?.phone_number || customerFromPhone?.phone_number || customerFromPhone?.phone || '',
                    customerId: order.customer_id,
                    isPaid: isOrderPaid,
                    isUnpaid: isEffectivelyUnpaid,
                    orderStatus: order.order_status,
                    totalAmount: unpaidAmount > 0 ? unpaidAmount : totalAmount,
                    paidAmount,
                    fullTotalAmount: totalAmount,
                    timestamp: new Date(order.created_at).toLocaleTimeString('he-IL', {
                        hour: '2-digit',
                        minute: '2-digit'
                    }),
                    fired_at: order.fired_at,
                    ready_at: order.ready_at,
                    updated_at: order.updated_at,
                    payment_method: order.payment_method,
                    is_offline: order.is_offline || String(order.id).startsWith('L'),
                    pending_sync: order.pending_sync,
                    created_at: order.created_at
                };

                // Group by course stage
                const itemsByStage = processedItems.reduce((acc, item) => {
                    const stage = item.course_stage || 1;
                    if (!acc[stage]) acc[stage] = [];
                    acc[stage].push(item);
                    return acc;
                }, {});

                // Process each stage
                Object.entries(itemsByStage).forEach(([stageStr, stageItems]) => {
                    const stage = Number(stageStr);
                    const cardId = stage === 1 ? order.id : `${order.id}-stage-${stage}`;

                    const isOrderCompleted = order.order_status === 'completed';

                    const allTerminal = stageItems.every(i =>
                        ['completed', 'shipped', 'cancelled'].includes(i.status)
                    );

                    if (allTerminal) return;

                    const allReady = stageItems.every(i =>
                        ['ready', 'completed', 'cancelled'].includes(i.status)
                    );
                    const hasActiveItems = stageItems.some(i =>
                        ['in_progress', 'new'].includes(i.status)
                    );
                    const hasHeldItems = stageItems.some(i => i.status === 'held');

                    let cardType, cardStatus;
                    if (allReady) {
                        cardType = 'ready';
                        cardStatus = (isOrderCompleted || order.order_status === 'archived' || order.order_status === 'shipped') ? 'completed' : 'ready';
                    } else if (hasActiveItems) {
                        cardType = 'active';
                        const allNew = stageItems.filter(i => ['in_progress', 'new'].includes(i.status)).every(i => i.status === 'new');
                        cardStatus = allNew ? 'new' : 'in_progress';
                    } else if (hasHeldItems) {
                        cardType = 'active';
                        cardStatus = 'held';
                    } else {
                        cardType = 'active';
                        cardStatus = 'in_progress';
                    }

                    const groupedItems = groupOrderItems(stageItems);

                    const processedOrder = {
                        ...baseOrder,
                        id: cardId,
                        originalOrderId: order.id,
                        items: groupedItems,
                        type: cardType,
                        status: cardStatus,
                        orderStatus: cardStatus,
                        courseStage: stage
                    };

                    if (cardType === 'ready') {
                        completed.push(processedOrder);
                    } else {
                        current.push(processedOrder);
                    }
                });
            });

            return { current, completed };
        } catch (err) {
            console.error('🔥 [KDS-PROCESS] Critical failure in data processing:', err);
            return { current: [], completed: [] };
        }
    }, [activeOrders, orderItems, menuItems, optionValues, activeCustomers, activeCustomersByPhone, optimisticState]);

    // ============================================
    // ACTIONS - All go through offline queue
    // ============================================

    const updateItemStatus = useCallback(async (itemId, newStatus) => {
        console.log(`🔄 [KDS Local] Updating item ${itemId} to status: ${newStatus}`);
        const now = new Date().toISOString();

        // ═══════════════════════════════════════════════════════════════
        // 🏗️ SUPABASE-FIRST: Write to server BEFORE touching Dexie
        // ═══════════════════════════════════════════════════════════════
        try {
            // supabase already imported at top of file
            const { error } = await supabase.from('order_items')
                .update({ item_status: newStatus, updated_at: now })
                .eq('id', itemId);

            if (error) {
                console.error(`❌ Supabase updateItemStatus FAILED for ${itemId}:`, error);
                return; // ❌ DO NOT touch Dexie
            }

            console.log(`📤 Supabase item ${itemId} -> ${newStatus} confirmed`);

            // ✅ CONFIRMED WRITE: Now mirror to Dexie
            await db.order_items.update(itemId, {
                item_status: newStatus,
                updated_at: now
            });
        } catch (err) {
            console.error(`🔥 updateItemStatus FAILED for ${itemId}:`, err);
        }
    }, []);

    const updateOrderStatus = useCallback(async (orderId, currentStatus, targetStatusOverride = null) => {
        console.time(`KDS_Update_Order_${orderId}`);
        console.log(`⏱️ START updateOrderStatus for ${orderId}`);
        // 🛠️ TECH FIX: Strip any stage suffixes (-stage-2, -ready) to get the real UUID
        const realId = String(orderId).replace(/-stage-\d+/, '').replace('-ready', '');
        const order = await db.orders.get(realId);
        if (!order) {
            console.error(`❌ [KDS Local] Order ${realId} not found for status update`);
            console.timeEnd(`KDS_Update_Order_${orderId}`);
            return;
        }

        // 🧠 Determine next status
        let nextStatus;
        if (targetStatusOverride) {
            nextStatus = targetStatusOverride;
        } else {
            const statusLower = (currentStatus || '').toLowerCase();

            if (statusLower === 'undo_ready') {
                nextStatus = 'in_progress';
            } else if (['archived', 'cancelled'].includes(statusLower)) {
                nextStatus = statusLower; // 🧱 TERMINAL PROTECTION
            } else if (['ready', 'shipped', 'completed', 'delivered', 'done'].includes(statusLower)) {
                // JUMP logic: If user clicks 'Delivered' when it's ready/delivered,
                // we move to 'archived' to make it vanish from active KDS completely.
                nextStatus = 'archived';
            } else if (['in_progress', 'new', 'pending', 'confirmed'].includes(statusLower)) {
                nextStatus = 'ready';
            } else {
                nextStatus = 'in_progress';
            }
        }

        console.log(`🔄 [KDS Local] Moving Order ${realId} (${currentStatus} -> ${nextStatus})`);
        const now = new Date().toISOString();

        const itemStatusForItems = (nextStatus === 'completed' || nextStatus === 'archived' || nextStatus === 'shipped') ? 'completed' :
            nextStatus === 'ready' ? 'ready' :
                nextStatus === 'new' ? 'new' :
                    nextStatus === 'cancelled' ? 'cancelled' :
                        'in_progress';
        const shouldResetEarlyMarks = ['ready', 'completed', 'shipped', 'archived'].includes(nextStatus);

        // 🎯 STAGE-AWARE UPDATE: Only update items for the specific stage if provided
        const stageMatch = String(orderId).match(/-stage-(\d+)/);
        const targetStage = stageMatch ? Number(stageMatch[1]) : null;

        const isUndoOperation = (currentStatus || '').toLowerCase() === 'undo_ready';

        // 🔇 Mark this order as self-write to suppress Realtime echo
        recentSelfWrites.current.set(realId, Date.now());
        // Auto-cleanup after 5s
        setTimeout(() => recentSelfWrites.current.delete(realId), 5000);

        // ═══════════════════════════════════════════════════════════════
        // 🏗️ SUPABASE-FIRST: Write to server BEFORE touching Dexie
        // ═══════════════════════════════════════════════════════════════
        try {
            // supabase already imported at top of file
            const { data, error } = await supabase.rpc('update_order_status_v3', {
                p_order_id: realId,
                p_new_status: nextStatus,
                p_business_id: order.business_id,
                p_item_status: itemStatusForItems
            });

            if (error) {
                console.error(`❌ Supabase updateOrderStatus FAILED for ${realId}:`, error);
                console.timeEnd(`KDS_Update_Order_${orderId}`);
                return;
            }

            console.log(`📤 Supabase updateOrderStatus succeeded for ${realId}:`, data);

            // ✅ CONFIRMED WRITE: Now mirror to Dexie
            const dexiePayload = {
                order_status: nextStatus,
                updated_at: now,
                _localUpdatedAt: now,
                ...(nextStatus === 'ready' && { ready_at: now }),
                pending_sync: false
            };

            await db.transaction('rw', db.orders, db.order_items, async () => {
                await db.orders.update(realId, dexiePayload);
                
                let itemsQuery = db.order_items.where('order_id').equals(realId);
                
                if (targetStage) {
                    itemsQuery = itemsQuery.filter(it => (it.course_stage || 1) === targetStage);
                }

                await itemsQuery.modify(it => {
                    const terminalStatuses = ['completed', 'shipped', 'cancelled'];
                    const isCurrentlyTerminal = terminalStatuses.includes(it.item_status);
                    const isTargetTerminal = terminalStatuses.includes(itemStatusForItems);

                    if (it.item_status !== 'held' && (!isCurrentlyTerminal || isTargetTerminal || isUndoOperation)) {
                        it.item_status = itemStatusForItems;
                    }

                    if (shouldResetEarlyMarks) it.is_early_delivered = false;
                    it.updated_at = now;
                });
            });

            // 🛡️ Update mask
            recentLocalUpdates.current.set(realId, { status: nextStatus, timestamp: Date.now() });

            // 🔔 Trigger SMS if ready
            if (nextStatus === 'ready' && navigator.onLine) {
                const phone = String(order.customer_phone || '').trim();
                const digits = phone.replace(/\D/g, '');
                if (phone && !phone.startsWith('GUEST') && phone !== '0500000000' && phone !== 'null' && digits.length >= 9) {
                    const custName = order.customer_name || order.customerName || 'אורח';
                    handleSendSms(realId, custName, phone);
                } else {
                    console.log('📵 Skipping SMS: No valid phone for order', realId);
                }
            }

        } catch (err) {
            console.error(`🔥 updateOrderStatus FAILED for ${realId}:`, err);
        }

        console.timeEnd(`KDS_Update_Order_${orderId}`);
    }, [handleSendSms]);

    const fireItem = useCallback(async (itemId) => {
        const payload = {
            item_status: 'in_progress',
            item_fired_at: new Date().toISOString()
        };

        // ═══════════════════════════════════════════════════════════════
        // 🏗️ SUPABASE-FIRST: Write to server BEFORE touching Dexie
        // ═══════════════════════════════════════════════════════════════
        try {
            // supabase already imported at top of file
            const { error } = await supabase.from('order_items')
                .update(payload)
                .eq('id', itemId);

            if (error) {
                console.error(`❌ Supabase fireItem FAILED for ${itemId}:`, error);
                return; // ❌ DO NOT touch Dexie
            }

            console.log(`📤 Supabase fire item ${itemId} confirmed`);

            // ✅ CONFIRMED WRITE: Now mirror to Dexie
            await db.order_items.update(itemId, payload);
        } catch (err) {
            console.error(`🔥 fireItem FAILED for ${itemId}:`, err);
        }
    }, []);

    const handleFireItems = useCallback(async (orderId, itemIds) => {
        for (const itemId of itemIds) {
            await fireItem(itemId);
        }
    }, [fireItem]);

    const handleReadyItems = useCallback(async (orderId, itemIds) => {
        for (const itemId of itemIds) {
            await updateItemStatus(itemId, 'ready');
        }

        // 📱 Check if ALL items in the order are now ready/completed
        // If so, and the order wasn't ready before, send SMS
        try {
            const oItems = await db.order_items.where('order_id').equals(orderId).toArray();
            const allReady = oItems.every(i => ['ready', 'completed', 'cancelled'].includes(i.item_status));

            if (allReady) {
                const order = await db.orders.get(orderId);
                if (order && order.order_status !== 'completed' && order.order_status !== 'ready') {
                    // Update order status to ready
                    await updateOrderStatus(orderId, null, 'ready');

                    // Send SMS if phone exists and valid
                    const phone = String(order.customer_phone || '').trim();
                    const digits = phone.replace(/\D/g, '');
                    if (phone && !phone.startsWith('GUEST') && phone !== '0500000000' && phone !== 'null' && digits.length >= 9) {
                        console.log(`📱 [KDS Local] Order ${orderId} is fully ready, sending SMS to ${phone}`);
                        handleSendSms(orderId, order.customer_name, phone);
                    } else {
                        console.log(`📵 [KDS Local] Order ${orderId} ready but no valid phone, skipping SMS`);
                    }
                }
            }
        } catch (e) {
            console.error('Error in SMS/Ready check:', e);
        }
    }, [updateItemStatus, updateOrderStatus, handleSendSms]);

    const handleDeliverItems = useCallback(async (orderId, itemIds) => {
        console.log(`🚚 [KDS Local] Delivering specific items for order ${orderId}:`, itemIds);
        for (const itemId of itemIds) {
            await updateItemStatus(itemId, 'completed');
        }

        // 🎯 AUTO-ARCHIVE CHECK: Only if ALL items are now terminal, update parent order to 'completed'
        try {
            const allItems = await db.order_items.where('order_id').equals(orderId).toArray();
            const allDone = allItems.every(i => ['completed', 'shipped', 'cancelled'].includes(i.item_status));
            
            if (allDone) {
                console.log(`🏁 [KDS Local] All items for order ${orderId} delivered. Archiving order.`);
                await updateOrderStatus(orderId, null, 'completed');
            } else {
                console.log(`⏳ [KDS Local] Order ${orderId} still has pending items. Parent order remains active.`);
            }
        } catch (e) {
            console.error('Error in Auto-Archive check:', e);
        }
    }, [updateItemStatus, updateOrderStatus]);

    const handleToggleEarlyDelivered = useCallback(async (orderId, itemId, currentValue) => {
        const newValue = !currentValue;
        const timestamp = newValue ? new Date().toISOString() : null;
        console.log(`🔄 [KDS Local] Toggling early delivery for item ${itemId}: ${currentValue} -> ${newValue}`);

        // ═══════════════════════════════════════════════════════════════
        // 🏗️ SUPABASE-FIRST: Write to server BEFORE touching Dexie
        // ═══════════════════════════════════════════════════════════════
        try {
            // supabase already imported at top of file
            const { error } = await supabase.rpc('toggle_early_delivered', {
                p_item_id: itemId,
                p_value: newValue
            });

            if (error) {
                console.error(`❌ Supabase toggleEarlyDelivered FAILED for ${itemId}:`, error);
                return; // ❌ DO NOT touch Dexie
            }

            console.log(`📤 Supabase early delivery ${itemId} -> ${newValue} confirmed`);

            // ✅ CONFIRMED WRITE: Now mirror to Dexie
            await db.order_items.update(itemId, {
                is_early_delivered: newValue,
                early_delivered_at: timestamp,
                updated_at: new Date().toISOString()
            });
        } catch (err) {
            console.error(`🔥 toggleEarlyDelivered FAILED for ${itemId}:`, err);
        }
    }, []);

    // Station View: Mark ALL items in an order as sent to checker
    const handleStationDelivered = useCallback(async (orderId, items) => {
        const timestamp = new Date().toISOString();
        const pendingItems = items.filter(item => !item.early_delivered_at);
        if (pendingItems.length === 0) return;
        console.log(`📤 [KDS Station] Marking ${pendingItems.length} items as sent to checker for order ${orderId}`);

        // ═══════════════════════════════════════════════════════════════
        // 🏗️ SUPABASE-FIRST: Write ALL to server BEFORE touching Dexie
        // ═══════════════════════════════════════════════════════════════
        try {
            // supabase already imported at top of file

            // 1. Batch RPC to Supabase first
            for (const item of pendingItems) {
                const { error } = await supabase.rpc('toggle_early_delivered', { p_item_id: item.id, p_value: true });
                if (error) {
                    console.error(`❌ Supabase stationDelivered FAILED for item ${item.id}:`, error);
                    return; // ❌ Abort — don't partially update Dexie
                }
            }

            console.log(`📤 Supabase confirmed all ${pendingItems.length} items sent to checker`);

            // ✅ CONFIRMED WRITE: Now mirror ALL to Dexie
            for (const item of pendingItems) {
                await db.order_items.update(item.id, {
                    is_early_delivered: true,
                    early_delivered_at: timestamp,
                    updated_at: timestamp
                });
            }
            console.log(`✅ [Station] Sent to checker for order ${orderId}`);
        } catch (err) {
            console.error(`🔥 handleStationDelivered FAILED for order ${orderId}:`, err);
        }
    }, []);

    // Checker View: Re-fire an item back to station with PANIC urgency
    const handleRefireItem = useCallback(async (orderId, itemId) => {
        const timestamp = new Date().toISOString();
        console.log(`🔥 [KDS Checker] Re-firing item ${itemId} to station`);

        // ═══════════════════════════════════════════════════════════════
        // 🏗️ SUPABASE-FIRST: Write to server BEFORE touching Dexie
        // ═══════════════════════════════════════════════════════════════
        try {
            // supabase already imported at top of file
            const { error } = await supabase.rpc('refire_item', { p_item_id: itemId });

            if (error) {
                console.error(`❌ Supabase refireItem FAILED for ${itemId}:`, error);
                return; // ❌ DO NOT touch Dexie
            }

            console.log(`📤 Supabase re-fire ${itemId} confirmed`);

            // ✅ CONFIRMED WRITE: Now mirror to Dexie
            await db.order_items.update(itemId, {
                is_early_delivered: false,
                early_delivered_at: null,
                urgent_at: timestamp,
                updated_at: timestamp
            });
        } catch (err) {
            console.error(`🔥 handleRefireItem FAILED for ${itemId}:`, err);
        }
    }, []);

    const handleCancelOrder = useCallback(async (orderId) => {
        await updateOrderStatus(orderId, null, 'cancelled');
    }, [updateOrderStatus]);

    const handleConfirmPayment = useCallback(async (orderId, paymentMethod) => {
        const order = await db.orders.get(orderId);
        if (!order) {
            console.error(`❌ [KDS] Order ${orderId} not found in local DB`);
            return;
        }

        console.log(`💰 [KDS Local] Confirming payment for ${orderId} via ${paymentMethod}`);
        const now = new Date().toISOString();

        // ═══════════════════════════════════════════════════════════════
        // 🏗️ SUPABASE-FIRST: Write to server BEFORE touching Dexie
        // ═══════════════════════════════════════════════════════════════
        try {
            // supabase already imported at top of file
            const { data, error } = await supabase.rpc('confirm_order_payment', {
                p_order_id: orderId,
                p_payment_method: paymentMethod
            });

            if (error) {
                console.error(`❌ Supabase confirmPayment FAILED for ${orderId}:`, error);
                return; // ❌ DO NOT touch Dexie
            }

            console.log(`📤 Supabase payment confirmed for ${orderId}`);

            // ✅ CONFIRMED WRITE: Now mirror to Dexie
            await db.orders.update(orderId, {
                is_paid: true,
                paid_amount: order.total_amount || 0,
                payment_method: paymentMethod,
                order_status: 'completed',
                updated_at: now,
                pending_sync: false
            });
        } catch (err) {
            console.error(`🔥 handleConfirmPayment FAILED for ${orderId}:`, err);
        }
    }, []);

    const fetchHistoryOrders = useCallback(async (selectedDate) => {
        if (!businessId) return [];
        try {
            // 🕒 CALENDAR DAY LOGIC: 00:00 start (per user request)
            const startOfDay = new Date(selectedDate);
            startOfDay.setHours(0, 0, 0, 0);
            
            const endOfDay = new Date(startOfDay);
            endOfDay.setDate(endOfDay.getDate() + 1);

            const startISO = startOfDay.toISOString();
            const endISO = endOfDay.toISOString();

            console.log(`📜 [KDS History] Fetching for range: ${startISO} to ${endISO}`);

            // ✅ SUPABASE-FIRST: Always fetch history from the server (source of truth)
            // Dexie is ONLY used as offline fallback
            let ordersList = [];
            let allItems = [];
            let usedSupabase = false;

            if (navigator.onLine) {
                try {
                    // supabase already imported at top of file
                    const { data: serverOrders } = await supabase.rpc('get_orders_history', {
                        p_from_date: startISO,
                        p_to_date: endISO,
                        p_business_id: businessId
                    });
                    if (serverOrders?.length > 0) {
                        ordersList = serverOrders;
                        usedSupabase = true;
                        console.log(`📜 [KDS History] ✅ Supabase returned ${ordersList.length} orders`);

                        // Also fetch items from Supabase to guarantee correct UUIDs
                        const orderIds = ordersList.map(o => o.id);
                        const { data: serverItems } = await supabase
                            .from('order_items')
                            .select('*')
                            .in('order_id', orderIds);
                        if (serverItems) allItems = serverItems;
                    }
                } catch (e) {
                    console.warn('📜 [KDS History] Supabase fetch failed, falling back to Dexie', e);
                }
            }

            // 📴 OFFLINE FALLBACK: Only use Dexie if Supabase failed or we're offline
            if (!usedSupabase) {
                console.log('📜 [KDS History] Using Dexie fallback (offline or server error)');
                ordersList = await db.orders
                    .where('[business_id+created_at]')
                    .between([businessId, startISO], [businessId, endISO])
                    .toArray();
                const orderIds = ordersList.map(o => o.id);
                allItems = await db.order_items.where('order_id').anyOf(orderIds).toArray();
            }

            const orderIds = ordersList.map(o => o.id);
            const [allCustomers, allMenuItems] = await Promise.all([
                db.customers.where('business_id').equals(businessId).toArray(),
                db.menu_items.where('business_id').equals(businessId).toArray()
            ]);

            const menuItemsMap = new Map(allMenuItems.map(m => [m.id, m]));
            const customersMap = new Map(allCustomers.map(c => [c.id, c]));
            const finalHistoryCards = [];

            // Helper for Duration Formatting (MM:SS)
            const formatDuration = (ms) => {
                if (!ms || ms < 0) return null;
                const totalSeconds = Math.floor(ms / 1000);
                const minutes = Math.floor(totalSeconds / 60);
                const seconds = totalSeconds % 60;
                return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            };

            ordersList.forEach(order => {
                const rawItems = allItems.filter(i => String(i.order_id) === String(order.id) && i.item_status !== 'cancelled');
                if (rawItems.length === 0) return;

                // 🛠️ Normalize statuses
                const orderItems = rawItems.map(i => ({
                    ...i,
                    item_status: i.item_status || (['completed', 'archived', 'shipped'].includes((order.orderStatus || order.order_status || '').toLowerCase()) ? 'completed' : 'new')
                }));

                const customer = customersMap.get(order.customer_id);
                const rawCName = order.customer_name || order.customerName || customer?.name;
                const isJustDigits = /^\d+$/.test(String(rawCName || ''));
                const derivedCustomerName = (rawCName && (rawCName.length > 15 || rawCName.includes('_') || isJustDigits)) ? '' : rawCName;

                const rawNum = String(order.order_number || '');
                const displayOrderNo = /^\d{1,5}$/.test(rawNum) ? rawNum : String(order.id).slice(-4).toUpperCase();

                // 📐 DURATION CALCULATIONS (Unified)
                const items1 = orderItems.filter(i => (i.course_stage || 1) === 1);
                const items2 = orderItems.filter(i => (i.course_stage || 1) === 2);

                let duration1 = null;
                let duration2 = null;

                // Duration 1: From created_at to latest Terminal Stage 1 Update
                if (items1.length > 0) {
                    const start1 = new Date(order.created_at).getTime();
                    const terminals1 = items1.filter(i => ['completed', 'shipped', 'ready', 'delivered'].includes(i.item_status));
                    if (terminals1.length > 0) {
                        const end1 = Math.max(...terminals1.map(i => new Date(i.updated_at || i.completed_at || order.updated_at).getTime()));
                        duration1 = formatDuration(end1 - start1);
                    }
                }

                // Duration 2: From earliest Fired_at to latest Terminal Stage 2 Update
                if (items2.length > 0) {
                    const firedItems = items2.filter(i => i.item_fired_at);
                    if (firedItems.length > 0) {
                        const start2 = Math.min(...firedItems.map(i => new Date(i.item_fired_at).getTime()));
                        const terminals2 = items2.filter(i => ['completed', 'shipped', 'ready', 'delivered'].includes(i.item_status));
                        if (terminals2.length > 0) {
                            const end2 = Math.max(...terminals2.map(i => new Date(i.updated_at || i.completed_at || order.updated_at).getTime()));
                            duration2 = formatDuration(end2 - start2);
                        }
                    }
                }

                finalHistoryCards.push({
                    id: order.id,
                    orderNumber: displayOrderNo,
                    customerName: derivedCustomerName,
                    customerPhone: order.customer_phone || order.customerPhone || customer?.phone_number,
                    isPaid: order.is_paid || order.isPaid,
                    totalAmount: order.totalAmount || order.total_amount,
                    created_at: order.created_at,
                    orderStatus: order.orderStatus || order.order_status,
                    timestamp: new Date(order.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }),
                    duration: duration1,
                    duration2: duration2,
                    items: orderItems.map(item => {
                        const menuItem = menuItemsMap.get(item.menu_item_id) || { name: item.name || 'Unknown', price: 0 };
                        let parsedMods = [];
                        try {
                            if (typeof item.mods === 'string') parsedMods = JSON.parse(item.mods);
                            else if (Array.isArray(item.mods)) parsedMods = item.mods;
                            else if (item.mods && typeof item.mods === 'object') parsedMods = item.mods.selectedOptions || [];
                        } catch (e) { }
                        if (Array.isArray(parsedMods)) {
                            parsedMods = parsedMods.filter(m => {
                                const name = (typeof m === 'object' ? (m.name || m.text || m.valueName) : String(m)) || '';
                                return !name.includes('KDS_OVERRIDE');
                            });
                        }
                        return { ...item, name: menuItem.name || item.name, modifiers: parsedMods, production_area: menuItem?.production_area || null };
                    })
                });
            });

            console.log(`📜 [KDS History] Unified count: ${finalHistoryCards.length}`);
            return finalHistoryCards;
        } catch (err) {
            console.error('❌ [KDS History] Failed to fetch:', err);
            return [];
        }
    }, [businessId]);

    const findNearestActiveDate = useCallback(async (currentDate) => {
        if (!businessId) return null;
        // Look for orders in the past 7 days (Lean Diet)
        const sevenDaysAgo = new Date(currentDate);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const ordersList = await db.orders
            .where('business_id')
            .equals(businessId)
            .filter(o => new Date(o.created_at) >= sevenDaysAgo)
            .toArray();

        if (ordersList.length === 0) return null;

        // Find the most recent date
        const dates = ordersList.map(o => new Date(o.created_at));
        dates.sort((a, b) => b - a); // Descending
        return dates[0];
    }, [businessId]);

    const handleUndoLastAction = useCallback(async () => {
        // TODO: Implement undo via offline queue
        console.log('Undo not yet implemented in local-first version');
    }, []);

    const fetchOrders = useCallback(async (signal) => {
        if (!businessId) return { success: false };
        console.log('🔄 [KDS] Refreshing - pulling latest from Supabase (Orders + Customers)...');
        try {
            const { syncOrders, syncLoyalty, syncTable } = await import('@/services/syncService');
            
            // Parallel sync of orders and supportive data (customers, loyalty)
            const [orderRes, custRes, loyaltyRes] = await Promise.all([
                syncOrders(businessId),
                syncTable('customers', 'customers', null, businessId),
                syncLoyalty(businessId).catch(() => ({ success: false })) // Non-critical fallback
            ]);

            if (orderRes.success && custRes.success) {
                console.log(`✅ [KDS] Refresh complete. Pulled ${orderRes.ordersCount || 0} orders and updated customers.`);
                return { success: true };
            } else {
                console.warn(`⚠️ [KDS] Refresh partial failure:`, { orderRes, custRes });
                return { success: false, error: 'Partial sync failure' };
            }
        } catch (err) {
            console.error('❌ [KDS] Refresh failed:', err);
            return { success: false, error: err.message };
        }
    }, [businessId]);

    // Station list from ALL menu_items in Dexie (always visible, not dependent on active orders)
    const [availableStations, setAvailableStations] = useState(['Checker', 'Kitchen', 'Bar']);
    useEffect(() => {
        const loadStations = async () => {
            try {
                // ARCHITECTURE RULE: M4 Master is the Single Source of Truth
                // Fetch full menu items to patch Dexie cache (Fixing the local sync trigger)
                const query = supabase.from('menu_items').select('*');
                if (businessId) {
                    query.eq('business_id', businessId);
                }
                query.or('is_deleted.is.null,is_deleted.eq.false');

                const { data, error } = await query;
                if (error) throw error;

                // MANIFESTO COMPLIANCE: Update the local cache (Dexie) so the rest of the UI (processedOrders) gets the new production_areas
                if (data && data.length > 0) {
                    await db.menu_items.bulkPut(data).catch(e => console.warn('Dexie silent sync error', e));
                }

                const stationSet = new Set(['Kitchen', 'Bar']);
                (data || []).forEach(item => {
                    if (item.production_area) {
                        item.production_area.split(',').forEach(s => {
                            const trimmed = s.trim();
                            if (trimmed && trimmed !== 'Checker' && trimmed !== 'צ׳קר') {
                                stationSet.add(trimmed);
                            }
                        });
                    }
                });
                const stations = ['Checker', ...Array.from(stationSet).sort()];
                setAvailableStations(stations);
            } catch (err) {
                console.warn('⚠️ [KDS] Failed to load stations from M4 Master:', err);
            }
        };
        loadStations();
    }, [businessId]);

    // Auto-complete orders that have only completed/terminal items and are fully paid
    useEffect(() => {
        if (!activeOrders || !orderItems || !menuItems) return;

        // Group items by order
        const itemsByOrder = new Map();
        orderItems.forEach(item => {
            if (!item.order_id) return;
            const oid = String(item.order_id);
            if (!itemsByOrder.has(oid)) itemsByOrder.set(oid, []);
            itemsByOrder.get(oid).push(item);
        });

        const ordersToAutoComplete = [];

        activeOrders.forEach(order => {
            if (order.order_status !== 'in_progress') return;

            const items = itemsByOrder.get(String(order.id)) || order.order_items || order.items || order.items_detail || [];
            if (items.length === 0) return;

            const hasNonTerminalItems = items.some(i => {
                const menuItem = menuItems.get(i.menu_item_id);
                const isPrep = isKitchenPrep(i);
                const kdsLogic = menuItem?.kds_routing_logic || 'MADE_TO_ORDER';

                let hasOverride = false;
                const mods = i.mods;
                if (typeof mods === 'string' && (mods.includes('__KDS_OVERRIDE__') || mods.includes('__KDS_OVER_RIDE__'))) hasOverride = true;
                else if (Array.isArray(mods) && mods.some(m => String(m).includes('__KDS_OVER_REIDE__'))) hasOverride = true;
                else if (Array.isArray(mods) && mods.some(m => String(m).includes('__KDS_OVERRIDE__'))) hasOverride = true;

                const effectiveLogic = i.kds_routing_logic || kdsLogic;

                let isPrepRequired = true;
                if (isPrep) isPrepRequired = true;
                else if (effectiveLogic === 'MADE_TO_ORDER') isPrepRequired = true;
                else if (effectiveLogic === 'GRAB_AND_GO') isPrepRequired = false;
                else if (effectiveLogic === 'prep_override') isPrepRequired = false;
                else if (effectiveLogic === 'CONDITIONAL') isPrepRequired = hasOverride;

                return isPrepRequired && !['completed', 'shipped', 'cancelled'].includes(i.item_status || i.status || 'new');
            });

            // Calculate paid status
            const allItems = items.filter(i => (i.item_status || i.status) !== 'cancelled');
            const calculatedTotal = allItems.reduce((sum, i) => {
                const menuItem = menuItems.get(i.menu_item_id);
                return sum + (menuItem?.price || 0) * (i.quantity || 1);
            }, 0);

            const totalAmount = order.total_amount || calculatedTotal;
            const paidAmount = order.paid_amount || 0;
            const unpaidAmount = totalAmount - paidAmount;
            const isOrderPaid = order.is_paid === true;
            const isEffectivelyUnpaid = !isOrderPaid && unpaidAmount > 0.01;

            if (!hasNonTerminalItems && !isEffectivelyUnpaid) {
                ordersToAutoComplete.push(order);
            }
        });

        if (ordersToAutoComplete.length > 0) {
            console.log(`🤖 [KDS Auto-Complete] Auto-completing ${ordersToAutoComplete.length} orders:`, ordersToAutoComplete.map(o => o.order_number));
            ordersToAutoComplete.forEach(o => {
                updateOrderStatus(o.id, o.order_status, 'completed').catch(err => {
                    console.error(`❌ [KDS Auto-Complete] Failed to complete order ${o.id}:`, err);
                });
            });
        }
    }, [activeOrders, orderItems, menuItems, updateOrderStatus]);

    const result = useMemo(() => ({
        currentOrders: processedOrders.current || [],
        completedOrders: processedOrders.completed || [],
        isLoading: false,
        isOffline: !navigator.onLine,
        lastUpdated: new Date(),
        lastAction: null,
        smsToast,
        setSmsToast,
        errorModal: null,
        setErrorModal: () => { },
        isSendingSms,
        getSmsStatus,
        updateItemStatus,
        updateOrderStatus,
        fireItem,
        handleFireItems,
        handleReadyItems,
        handleDeliverItems,
        handleCancelOrder,
        handleConfirmPayment,
        fetchOrders,
        fetchHistoryOrders,
        findNearestActiveDate,
        handleUndoLastAction,
        handleToggleEarlyDelivered,
        handleStationDelivered,
        handleRefireItem,
        availableStations,
        handleItemStatusChange: updateItemStatus,
        handleOrderStatusChange: updateOrderStatus
    }), [
        processedOrders,
        smsToast,
        setSmsToast,
        isSendingSms,
        getSmsStatus,
        updateItemStatus,
        updateOrderStatus,
        fireItem,
        handleFireItems,
        handleReadyItems,
        handleDeliverItems,
        handleCancelOrder,
        handleConfirmPayment,
        fetchOrders,
        fetchHistoryOrders,
        findNearestActiveDate,
        handleUndoLastAction,
        handleToggleEarlyDelivered,
        handleStationDelivered,
        handleRefireItem,
        availableStations
    ]);

    console.log('📦 [KDS-HOOK] Providing data to UI:', {
        current: result.currentOrders.length,
        completed: result.completedOrders.length,
        isOnline: navigator.onLine
    });

    return result;
};
