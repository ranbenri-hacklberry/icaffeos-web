/**
 * useOrders Hook - HYBRID VERSION V2 (MAYA REVIEWED & FIXED)
 * Combines the best of Maya's fixes with the original Dexie-first approach
 * 
 * V2 Changes (Based on Maya's Code Review):
 * - ✅ Fixed: timestamp in realtime hydration
 * - ✅ Fixed: Anti-Jump Protection now per-order (Map instead of global timer)
 * - ✅ Fixed: Menu Items Cache (reduces Dexie reads)
 * - ✅ Fixed: Better error handling in auto-healing
 * - ✅ Fixed: Improved fallback for realtime items hydration
 * - ⚠️  TODO: markOrderSeen needs RPC update to accept p_seen_at parameter
 * 
 * Features:
 * - ✅ Anti-Jump Protection per order (from Maya V2)
 * - ✅ Auto-Healing (from Maya)
 * - ✅ Fixed Status Mapping (from Maya)
 * - ✅ Original Dexie hydration (kept from original)
 * - ✅ Improved Real-time handling
 * - ✅ Better error recovery
 * - ✅ Performance optimizations
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { db } from '@/db/database';
import { supabase } from '@/lib/supabase';

// Order status flow - UNIFIED with KDS/DB
export const ORDER_STATUSES = ['pending', 'new', 'in_progress', 'ready', 'shipped', 'delivered', 'cancelled'];

// Status labels in Hebrew
export const STATUS_LABELS = {
    new: 'חדש / ממתין',
    pending: 'ממתין',
    in_progress: 'בהכנה',
    ready: 'מוכן',
    shipped: 'נשלח',
    delivered: 'נמסר',
    cancelled: 'בוטל'
};

export function useOrders({ businessId, filters = {} } = {}) {
    // console.log('🔍 [useOrders-V2] Hook initialized with businessId:', businessId);
    const [orders, setOrders] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const subscriptionRef = useRef(null);
    const ordersRef = useRef(orders);

    // 🆕 MAYA FIX V2: Anti-Jump Protection per order (Map instead of global timer)
    const skipMapRef = useRef(new Map());

    // 🆕 MAYA FIX V2: Menu Items Cache (reduces Dexie reads)
    const menuMapRef = useRef(null);

    // Keep ref in sync for realtime listener
    useEffect(() => {
        ordersRef.current = orders;
    }, [orders]);

    // 🆕 MAYA FIX V2: Helper to get cached menu map
    const getMenuMap = useCallback(async () => {
        if (!menuMapRef.current) {
            const allMenuItems = await db.menu_items.toArray();
            menuMapRef.current = new Map(allMenuItems.map(m => [m.id, m]));
            console.log('📋 [useOrders-V2] Menu items cached:', menuMapRef.current.size);
        }
        return menuMapRef.current;
    }, []);

    // Filter: orders that need attention (pending and not yet seen) - for alerts
    const pendingAlertOrders = useMemo(() => {
        return orders.filter(o =>
            o.order_status === 'pending' &&
            !o.seen_at
        );
    }, [orders]);

    // Get orders grouped by status with custom sorting
    const ordersByStatus = useMemo(() => {
        const grouped = {};
        const columns = ['pending', 'new', 'in_prep', 'ready', 'shipped', 'delivered'];

        columns.forEach(status => {
            let filtered = orders.filter(o => {
                if (status === 'in_prep') return o.order_status === 'in_progress' || o.order_status === 'in_prep';
                return o.order_status === status;
            });

            // ✅ STABLE FIFO SORTING (MAYA FIXED): Always use created_at.
            // Never use updated_at for UI positioning as it causes "jumping" (video game effect).
            filtered.sort((a, b) => {
                const timeA = new Date(a.created_at || 0).getTime();
                const timeB = new Date(b.created_at || 0).getTime();
                if (timeA !== timeB) return timeA - timeB;
                // Secondary stable sort by ID/OrderNumber
                return (Number(a.orderNumber) || 0) - (Number(b.orderNumber) || 0);
            });

            grouped[status] = filtered;
        });
        return grouped;
    }, [orders]);

    // Fetch orders from Dexie (local-first) - KEPT ORIGINAL APPROACH
    const fetchFromDexie = useCallback(async () => {
        if (!businessId) {
            console.log('🔍 [useOrders-V2] No businessId provided, skipping fetch');
            return [];
        }

        // console.log('🔍 [useOrders-V2] Fetching from Dexie for businessId:', businessId);
        try {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - 7); // Clean: No orders older than 7 days
            const cutoffISO = cutoff.toISOString();

            let allOrders;
            const rawOrders = await db.orders.where('business_id').equals(businessId).toArray();

            // IMPROVED FILTER: Keep ALL active orders, plus recent inactive ones
            const activeStatuses = ['new', 'pending', 'in_progress', 'ready', 'shipped'];

            console.log(`🔍 [useOrders Debug] Processing ${rawOrders.length} raw orders.`, {
                first: rawOrders[0],
                sampleStatus: rawOrders[0]?.order_status
            });

            allOrders = rawOrders.filter(o => {
                const isActive = activeStatuses.includes(o.order_status);
                const isRecent = (o.created_at || o.updated_at) >= cutoffISO;

                // Debug specific order #2389
                if (String(o.orderNumber) === '2389') {
                    console.log(`🕵️‍♂️ Checking Order #2389: Status=${o.order_status}, Active=${isActive}, Recent=${isRecent}`);
                }

                // Active orders ALWAYS show. Inactive (delivered/cancelled) show only if recent.
                if (isActive) return true;
                return isRecent;
            });
            console.log(`🔍 [useOrders Debug] Post-filter count: ${allOrders.length}`);

            // Apply external filters if any
            if (filters.statuses && filters.statuses.length > 0) {
                allOrders = allOrders.filter(o => filters.statuses.includes(o.order_status));
            }

            if (filters.orderType) {
                allOrders = allOrders.filter(o => o.order_type === filters.orderType);
            }

            // 🆕 Filter by Driver (ID or Name)
            if (filters.driverId) {
                allOrders = allOrders.filter(o => {
                    const idMatch = o.driver_id === filters.driverId;
                    const nameMatch = filters.driverName && o.driver_name === filters.driverName;
                    return idMatch || nameMatch;
                });
            }

            // Fetch order items and use cached menu items
            const orderIds = allOrders.map(o => o.id);
            const allItems = await db.order_items.where('order_id').anyOf(orderIds).toArray();
            const menuMap = await getMenuMap(); // 🆕 MAYA FIX V2: Use cached menu map

            // Hydrate orders
            const finalOrders = allOrders.map(order => {
                return {
                    ...order,
                    // Status & ID fields
                    orderStatus: order.order_status,
                    orderNumber: order.order_number,

                    // Customer info comes DIRECTLY from order
                    customerName: order.customer_name || 'אורח',
                    customerPhone: order.customer_phone,
                    deliveryAddress: order.delivery_address,
                    delivery_address: order.delivery_address,

                    // Payment & amounts
                    isPaid: order.is_paid,
                    totalAmount: order.total_amount,

                    // Order type & delivery
                    orderType: order.order_type,
                    order_type: order.order_type,
                    deliveryFee: order.delivery_fee,
                    deliveryNotes: order.delivery_notes,

                    // Delivery driver info
                    driver_id: order.driver_id,
                    driver_name: order.driver_name,
                    driver_phone: order.driver_phone,
                    courier_name: order.courier_name,

                    // Timestamps
                    timestamp: order.created_at ? new Date(order.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : '',
                    created_at: order.created_at,
                    updated_at: order.updated_at,
                    ready_at: order.ready_at,
                    // 🆕 Explicit fields for Kanban Payment & Shipping
                    payment_screenshot_url: order.payment_screenshot_url,
                    payment_verified: order.payment_verified,
                    payment_method: order.payment_method,
                    seen_at: order.seen_at,

                    // Items with menu name hydration
                    items: allItems
                        .filter(item => item.order_id === order.id)
                        .map(item => {
                            const menuItem = menuMap.get(item.menu_item_id);
                            return {
                                ...item,
                                menuItemId: item.menu_item_id,
                                name: item.name || menuItem?.name || 'פריט',
                                category: menuItem?.category || '',
                                status: item.item_status,
                                modifiers: (item.mods || []).map(m => ({
                                    text: typeof m === 'object' ? (m.name || m.text) : m,
                                    color: 'mod-color-gray'
                                }))
                            };
                        })
                };
            });

            // console.log('📋 [useOrders-V2] Hydrated Orders:', finalOrders.length);
            return finalOrders;
        } catch (err) {
            console.error('[useOrders-V2] fetchFromDexie error:', err);
            return [];
        }
    }, [businessId, filters.statuses, filters.orderType, getMenuMap]);

    // Sync from Supabase to Dexie - KEPT ORIGINAL WITH IMPROVEMENTS
    const syncFromSupabase = useCallback(async () => {
        if (!businessId) return;

        try {
            const cutoff = new Date();
            cutoff.setHours(cutoff.getHours() - 24);

            const { data, error: fetchError } = await supabase
                .from('orders')
                .select('*')
                .eq('business_id', businessId)
                .or(`order_status.neq.delivered,updated_at.gte.${cutoff.toISOString()}`)
                .order('created_at', { ascending: false })
                .limit(200);

            if (fetchError) throw fetchError;

            if (data && data.length > 0) {
                // 🛡️ PROTECT: Don't overwrite local pending changes with stale server data
                await db.transaction('rw', [db.orders], async () => {
                    for (const order of data) {
                        const local = await db.orders.get(order.id);
                        if (local && local.pending_sync) {
                            const serverTime = new Date(order.updated_at || 0).getTime();
                            const localTime = new Date(local.updated_at || 0).getTime();
                            if (serverTime <= localTime) {
                                // console.log(`🛡️ [useOrders-V2] Protecting local pending state for ${order.id.slice(0, 8)}`);
                                continue;
                            }
                        }
                        await db.orders.put(order);
                    }
                });
            }

            return data;
        } catch (err) {
            console.error('[useOrders-V2] Supabase sync error:', err);
            throw err;
        }
    }, [businessId]);

    // 🆕 MAYA FIX V2: Update order status with Per-Order Anti-Jump Protection
    const updateStatus = useCallback(async (orderId, targetStatus) => {
        console.log('🔄 [useOrders-V2] updateStatus called!', { orderId, targetStatus });

        // ❌ REMOVED: Manual check that was skipping user actions. 
        // We SHOULD allow the user to move cards as fast as they want.
        // The protection should only happen in the realtime listener.

        const currentOrder = ordersRef.current.find(o => String(o.id) === String(orderId));
        if (!currentOrder) {
            console.warn('❌ [useOrders-V2] Order not found in state!', { orderId });
        }

        const currentStatus = currentOrder?.order_status;
        console.log('🔄 [useOrders-V2] Status update:', { orderId, from: currentStatus, to: targetStatus });

        // 🆕 MAYA FIX: Consistent mapping - UI 'in_prep' -> DB 'in_progress'
        const dbStatus = targetStatus === 'in_prep' ? 'in_progress' : targetStatus;
        console.log('🔄 [useOrders-V2] Final DB status:', dbStatus);

        try {
            const updates = {
                order_status: dbStatus,
                updated_at: new Date().toISOString(),
                pending_sync: true
            };

            const isLocal = String(orderId).startsWith('L');

            // Add timestamps for specific statuses
            if (targetStatus === 'ready' || dbStatus === 'ready') updates.ready_at = new Date().toISOString();
            if (targetStatus === 'delivered' || dbStatus === 'delivered') updates.completed_at = new Date().toISOString();

            // Mark as seen when acknowledging an order
            if (['new', 'pending', 'in_progress', 'in_prep'].includes(targetStatus)) {
                updates.seen_at = new Date().toISOString();
            }

            // Optimistic update - sync UI fields too
            const uiUpdates = {
                ...updates,
                orderStatus: dbStatus
            };

            console.log('🔄 [useOrders-V2] Optimistic update (Dexie + State):', { orderId, status: dbStatus });
            await db.orders.update(orderId, updates);
            setOrders(prev => prev.map(o => String(o.id) === String(orderId) ? { ...o, ...uiUpdates } : o));

            // Push to Supabase via Safe RPC
            if (!isLocal) {
                const rpcParams = {
                    p_order_id: orderId,
                    p_new_status: dbStatus,
                    p_business_id: businessId
                };

                // 🆕 FIX: If moving to ready/shipped, also move items to ready
                // This ensures KDS stays in sync immediately
                if (dbStatus === 'new') {
                    rpcParams.p_item_status = 'new';
                } else if (['ready', 'shipped', 'delivered'].includes(dbStatus)) {
                    rpcParams.p_item_status = 'ready';
                }

                const { data: rpcData, error: updateError } = await supabase.rpc('update_order_status_v3', rpcParams);

                console.log('🌐 [useOrders-V2-RPC] DETAILED:', {
                    params: rpcParams,
                    response: rpcData,
                    success: rpcData?.success,
                    rows_affected: rpcData?.rows_affected,
                    error: updateError
                });

                if (updateError || rpcData?.success === false) {
                    const failDetail = updateError?.message || `RPC returned success=false, rows_affected=${rpcData?.rows_affected || 0}`;
                    console.error(`❌ [useOrders-V2-SYNC] FAIL: ${failDetail}`);

                    // REVERT UI
                    await db.orders.update(orderId, { pending_sync: false });
                    await fetchFromDexie().then(setOrders);
                    return false;
                }
            } else {
                console.log('📝 [useOrders-V2] Local only order - waiting for syncService upload');
            }

            // Success: Clear the pending flag
            console.log('✅ [useOrders-V2] Supabase push success!');
            await db.orders.update(orderId, { pending_sync: false });
            setOrders(prev => prev.map(o => String(o.id) === String(orderId) ? { ...o, pending_sync: false } : o));

            // 🆕 MAYA FIX V2: Activate per-order anti-jump protection for 3 seconds
            skipMapRef.current.set(orderId, Date.now() + 3000);
            console.log('🛡️ [useOrders-V2] Anti-jump protection activated for order:', orderId.slice(0, 8));

            return true;
        } catch (err) {
            console.error('[useOrders-V2] updateStatus error:', err);
            setError(err.message);
            return false;
        }
    }, [businessId, fetchFromDexie]);

    // 🆕 Generic Update Function for arbitrary fields (Driver, Notes, etc.)
    const updateOrderFields = useCallback(async (orderId, fields) => {
        console.log('🔄 [useOrders-V2] updateOrderFields:', { orderId, fields });
        try {
            const updates = {
                ...fields,
                updated_at: new Date().toISOString(),
                pending_sync: true
            };

            // Map some fields for UI consistency if they exist in updates
            const uiUpdates = { ...updates };
            if (fields.is_paid !== undefined) uiUpdates.isPaid = fields.is_paid;
            if (fields.order_status !== undefined) uiUpdates.orderStatus = fields.order_status;
            if (fields.customer_name !== undefined) uiUpdates.customerName = fields.customer_name;
            if (fields.customer_phone !== undefined) uiUpdates.customerPhone = fields.customer_phone;
            if (fields.total_amount !== undefined) uiUpdates.totalAmount = fields.total_amount;

            const isLocal = String(orderId).startsWith('L');

            // 1. Optimistic Update (Dexie + State)
            await db.orders.update(orderId, updates);
            setOrders(prev => prev.map(o => String(o.id) === String(orderId) ? { ...o, ...uiUpdates } : o));

            // 2. Push to Supabase
            if (!isLocal) {
                const { error } = await supabase
                    .from('orders')
                    .update(fields) // Send original fields without local flags
                    .eq('id', orderId);

                if (error) throw error;
            }

            // 3. Success - Clear pending flag
            await db.orders.update(orderId, { pending_sync: false });
            setOrders(prev => prev.map(o => String(o.id) === String(orderId) ? { ...o, pending_sync: false } : o));

            return true;
        } catch (err) {
            console.error('[useOrders-V2] updateOrderFields error:', err);
            return false;
        }
    }, []);

    // Mark order as seen (stops alert)
    // ✅ FIXED: Now passes p_seen_at parameter for efficiency (Maya's 10/10 fix)
    const markOrderSeen = useCallback(async (orderId) => {
        const seenAt = new Date().toISOString();

        try {
            // Optimistic update with protection
            await db.orders.update(orderId, { seen_at: seenAt, pending_sync: true });
            setOrders(prev => prev.map(o => String(o.id) === String(orderId) ? { ...o, seen_at: seenAt, pending_sync: true } : o));

            // Push to Supabase via Safe RPC
            if (!String(orderId).startsWith('L')) {
                const currentOrder = ordersRef.current.find(o => String(o.id) === String(orderId));

                // ✅ MAYA FIX: Now passing p_seen_at parameter directly to RPC V4
                const { data: rpcData, error } = await supabase.rpc('update_order_status_v3', {
                    p_order_id: orderId,
                    p_new_status: currentOrder?.order_status || 'pending',
                    p_business_id: businessId,
                    p_seen_at: seenAt  // 👈 THE 10/10 FIX!
                });

                if (error || rpcData?.success === false) {
                    throw new Error(error?.message || 'Update failed on server (0 rows)');
                }
            }

            // Clear protection
            await db.orders.update(orderId, { pending_sync: false });
            setOrders(prev => prev.map(o => String(o.id) === String(orderId) ? { ...o, pending_sync: false } : o));
        } catch (err) {
            console.error('[useOrders-V2] Mark seen failed:', err);
            await db.orders.update(orderId, { pending_sync: false });
        }
    }, [businessId]);

    // Manual refresh
    const refresh = useCallback(async () => {
        setIsLoading(true);
        try {
            await syncFromSupabase();
            const localOrders = await fetchFromDexie();
            setOrders(localOrders);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [syncFromSupabase, fetchFromDexie]);

    // 🆕 MAYA FIX V2: Setup real-time subscription with Per-Order Anti-Jump Protection
    useEffect(() => {
        if (!businessId) return;

        const channel = supabase
            .channel(`orders-${businessId}`)
            .on('postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'orders',
                    filter: `business_id=eq.${businessId}`
                },
                async (payload) => {
                    const orderId = payload.new?.id || payload.old?.id;

                    // 🆕 MAYA FIX V2: Check per-order anti-jump protection
                    if (orderId && skipMapRef.current.get(orderId) > Date.now()) {
                        console.log('⏳ [useOrders-V2] Ignoring realtime event - anti-jump protection active for order:', orderId.slice(0, 8));
                        return;
                    }

                    console.log('[useOrders-V2] Realtime event:', payload.eventType, orderId?.slice(0, 8));

                    if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                        const order = payload.new;

                        // 🛡️ REAL-TIME GUARD: Check if we have a local change pending
                        const localOrder = await db.orders.get(order.id);
                        if (localOrder && localOrder.pending_sync) {
                            console.log(`⏳ [useOrders-V2] Ignoring Realtime UPDATE for ${order.id.slice(0, 8)} - Local write in progress`);
                            return;
                        }

                        // Update Dexie
                        await db.orders.put({ ...order, pending_sync: false });

                        // Fetch items and use cached menu items
                        let orderItems = await db.order_items.where('order_id').equals(order.id).toArray();
                        const menuMap = await getMenuMap(); // 🆕 MAYA FIX V2: Use cached menu map

                        // 🆕 MAYA FIX V2: Improved fallback for items
                        let finalItems = orderItems;
                        if (!finalItems || finalItems.length === 0) {
                            // 1. Try local DB again
                            finalItems = await db.order_items.where('order_id').equals(order.id).toArray();

                            // 2. If still empty, try Existing State
                            if (!finalItems.length) {
                                const existing = ordersRef.current.find(o => o.id === order.id);
                                finalItems = existing?.items || [];
                            }

                            // 3. 🆕 REALTIME SYNC FIX: If absolutely no items, fetch from Supabase immediately
                            // This handles the race condition where Order arrives before Items sync
                            if (finalItems.length === 0) {
                                console.log(`📥 [useOrders-V2] Order ${order.id.slice(0, 8)} has no local items. Fetching from Supabase...`);
                                const { data: remoteItems } = await supabase
                                    .from('order_items')
                                    .select('*')
                                    .eq('order_id', order.id);

                                if (remoteItems && remoteItems.length > 0) {
                                    console.log(`📥 [useOrders-V2] Fetched ${remoteItems.length} items from server. Saving to Dexie.`);
                                    await db.order_items.bulkPut(remoteItems);
                                    finalItems = remoteItems;
                                }
                            }
                        }

                        // 🆕 MAYA FIX V2: Added timestamp field (was missing)
                        const hydratedOrder = {
                            ...order,
                            order_status: order.order_status,
                            orderStatus: order.order_status,
                            orderNumber: order.order_number,
                            customerName: order.customer_name || 'אורח',
                            customerPhone: order.customer_phone,
                            deliveryAddress: order.delivery_address,
                            isPaid: order.is_paid,
                            totalAmount: order.total_amount,
                            paymentMethod: order.payment_method,
                            orderType: order.order_type,
                            deliveryFee: order.delivery_fee,
                            deliveryNotes: order.delivery_notes,
                            driver_id: order.driver_id,
                            driver_name: order.driver_name,
                            driver_phone: order.driver_phone,
                            courier_name: order.courier_name,
                            timestamp: order.created_at ? new Date(order.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : '', // 🆕 MAYA FIX V2
                            created_at: order.created_at,
                            updated_at: order.updated_at,
                            ready_at: order.ready_at,
                            // 🆕 Explicit fields for Kanban Payment & Shipping
                            payment_screenshot_url: order.payment_screenshot_url,
                            payment_verified: order.payment_verified,
                            payment_method: order.payment_method,
                            seen_at: order.seen_at,
                            items: finalItems.map(item => {
                                const menuItem = menuMap.get(item.menu_item_id);
                                return {
                                    ...item,
                                    menuItemId: item.menu_item_id,
                                    name: item.name || menuItem?.name || 'פריט',
                                    category: menuItem?.category || '',
                                    status: item.item_status,
                                    modifiers: (item.mods || []).map(m => ({
                                        text: typeof m === 'object' ? (m.name || m.text) : m,
                                        color: 'mod-color-gray'
                                    }))
                                };
                            })
                        };

                        // Update state
                        setOrders(prev => {
                            const exists = prev.find(o => o.id === hydratedOrder.id);
                            if (exists) {
                                return prev.map(o => o.id === hydratedOrder.id ? hydratedOrder : o);
                            }
                            return [hydratedOrder, ...prev];
                        });
                    } else if (payload.eventType === 'DELETE') {
                        const orderId = payload.old.id;
                        await db.orders.delete(orderId);
                        setOrders(prev => prev.filter(o => o.id !== orderId));
                    }
                }
            )
            .subscribe();

        subscriptionRef.current = channel;

        return () => {
            if (subscriptionRef.current) {
                supabase.removeChannel(subscriptionRef.current);
            }
        };
    }, [businessId, getMenuMap]);

    // 🆕 MAYA FIX V2: Auto-healing on mount with improved error handling
    useEffect(() => {
        const healDexieData = async () => {
            if (!businessId) return;

            try {
                const activeOrders = await db.orders
                    .where('business_id').equals(businessId)
                    .and(o => ['new', 'in_progress', 'pending'].includes(o.order_status))
                    .toArray();

                const allItems = await db.order_items.toArray();

                let healedCount = 0;
                for (const order of activeOrders) {
                    const orderItems = allItems.filter(i => String(i.order_id) === String(order.id));
                    if (orderItems.length === 0) continue;

                    let correctStatus = order.order_status;

                    // Check if items are active
                    const hasActive = orderItems.some(i => ['in_progress', 'new', 'pending'].includes(i.item_status));
                    if (hasActive && !['in_progress', 'pending', 'new'].includes(order.order_status)) {
                        correctStatus = 'in_progress';
                    }

                    // Check if all items are done
                    const allDone = orderItems.every(i => ['ready', 'completed', 'cancelled'].includes(i.item_status));
                    if (allDone && order.order_status === 'in_progress') {
                        correctStatus = 'ready';
                    }

                    // Heal if needed
                    if (correctStatus !== order.order_status) {
                        await db.orders.update(order.id, {
                            order_status: correctStatus,
                            pending_sync: true,
                            updated_at: new Date().toISOString()
                        });
                        healedCount++;
                    }
                }

                if (healedCount > 0) {
                    console.log(`✅ [useOrders-V2] Auto-Healed ${healedCount} orders`);
                }
            } catch (err) {
                console.error('[useOrders-V2] Auto-heal failed:', err);
                // 🆕 MAYA FIX V2: Update error state so user knows
                setError(`Auto-healing failed: ${err.message}`);
            }
        };

        healDexieData();
    }, [businessId]);

    // Update status for specific items (e.g. for Packing Sidebar toggle)
    const setItemsStatus = useCallback(async (orderId, itemIds, targetStatus = 'ready') => {
        try {
            console.log('📦 [useOrders-V2] setItemsStatus:', { orderId, itemIds, targetStatus });

            // Optimistic update in Dexie
            await db.order_items.where('id').anyOf(itemIds).modify({ item_status: targetStatus });

            // Update state
            setOrders(prev => prev.map(o => {
                if (String(o.id) === String(orderId)) {
                    return {
                        ...o,
                        items: o.items.map(i => itemIds.includes(i.id) ? { ...i, item_status: targetStatus } : i)
                    };
                }
                return o;
            }));

            // Push to Supabase if not local
            if (!String(orderId).startsWith('L')) {
                // For 'ready', use the optimized RPC
                if (targetStatus === 'ready') {
                    const { error } = await supabase.rpc('mark_items_ready_v2', {
                        p_order_id: orderId,
                        p_item_ids: itemIds
                    });
                    if (error) throw error;
                } else {
                    // For other statuses (e.g. unchecking to 'in_progress'), use direct update for now
                    const { error } = await supabase
                        .from('order_items')
                        .update({ item_status: targetStatus })
                        .in('id', itemIds);

                    if (error) throw error;
                }
            }
            return true;
        } catch (err) {
            console.error('[useOrders-V2] setItemsStatus error:', err);
            return false;
        }
    }, []);

    // Backward compatibility wrapper
    const markItemsReady = useCallback((orderId, itemsToReady) => {
        const itemIds = itemsToReady.map(i => i.id);
        return setItemsStatus(orderId, itemIds, 'ready');
    }, [setItemsStatus]);

    // POLL INTERVAL: Fallback if Realtime fails (Every 30s) - START
    useEffect(() => {
        if (!businessId) return;

        const pollInterval = setInterval(() => {
            console.log('⏰ [useOrders-V2] Polling updates...');
            refresh();
        }, 30000); // 30 seconds

        return () => clearInterval(pollInterval);
    }, [businessId, refresh]);
    // POLL INTERVAL - END

    // Initial load
    useEffect(() => {
        if (!businessId) {
            setIsLoading(false);
            return;
        }

        const init = async () => {
            const { isLocalInstance } = await import('@/lib/supabase');
            const isLocal = isLocalInstance();

            console.log('🔍 [useOrders-V2] Running init for:', businessId, isLocal ? '(Local Mode)' : '(Cloud Mode)');
            setIsLoading(true);
            try {
                if (isLocal) {
                    // 🏘️ LOCAL MODE: Direct to Supabase (N150 is the source of truth)
                    await syncFromSupabase();
                    const freshOrders = await fetchFromDexie();
                    setOrders(freshOrders);
                } else {
                    // ☁️ CLOUD MODE: Dexie-first (SWR) for perceived performance
                    const localOrders = await fetchFromDexie();
                    console.log(`🔍 [useOrders-V2] Local load complete: ${localOrders.length} orders`);
                    setOrders(localOrders);
                    setIsLoading(false);

                    // Then sync from Supabase in background
                    await syncFromSupabase();
                    const freshOrders = await fetchFromDexie();
                    setOrders(freshOrders);
                }
            } catch (err) {
                setError(err.message);
                setIsLoading(false);
            } finally {
                setIsLoading(false);
            }
        };

        init();
    }, [businessId, fetchFromDexie, syncFromSupabase]);

    return {
        orders,
        ordersByStatus,
        pendingAlertOrders,
        isLoading,
        error,
        updateStatus,
        updateOrderFields, // 🆕 Generic update for arbitrary fields
        markOrderSeen,
        markItemsReady, // 🆕 Export for packing
        refresh
    };
}

export default useOrders;
