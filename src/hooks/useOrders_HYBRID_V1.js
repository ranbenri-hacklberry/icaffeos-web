/**
 * useOrders Hook - HYBRID VERSION V1
 * Combines the best of Maya's fixes with the original Dexie-first approach
 * 
 * Features:
 * - ✅ Anti-Jump Protection (from Maya)
 * - ✅ Auto-Healing (from Maya)
 * - ✅ Fixed Status Mapping (from Maya)
 * - ✅ Original Dexie hydration (kept from original)
 * - ✅ Improved Real-time handling
 * - ✅ Better error recovery
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
    console.log('🔍 [useOrders-HYBRID] Hook initialized with businessId:', businessId);
    const [orders, setOrders] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const subscriptionRef = useRef(null);
    const ordersRef = useRef(orders);

    // 🆕 MAYA FIX: Anti-Jump Protection - prevents real-time from overwriting optimistic updates
    const skipFetchUntilRef = useRef(0);

    // Keep ref in sync for realtime listener
    useEffect(() => {
        ordersRef.current = orders;
    }, [orders]);

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
        const columns = ['new', 'in_prep', 'ready', 'shipped', 'delivered'];

        columns.forEach(status => {
            let filtered = orders.filter(o => {
                if (status === 'new') return o.order_status === 'new' || o.order_status === 'pending';
                // 🆕 MAYA FIX: Only 'in_progress' maps to 'in_prep' column (was inconsistent before)
                if (status === 'in_prep') return o.order_status === 'in_progress';
                return o.order_status === status;
            });

            // CUSTOM SORTING LOGIC:
            if (status === 'new') {
                filtered.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
            } else if (status === 'in_prep') {
                filtered.sort((a, b) => new Date(a.updated_at || a.created_at || 0) - new Date(b.updated_at || b.created_at || 0));
            } else {
                filtered.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
            }

            grouped[status] = filtered;
        });
        return grouped;
    }, [orders]);

    // Fetch orders from Dexie (local-first) - KEPT ORIGINAL APPROACH
    const fetchFromDexie = useCallback(async () => {
        if (!businessId) {
            console.log('🔍 [useOrders-HYBRID] No businessId provided, skipping fetch');
            return [];
        }

        console.log('🔍 [useOrders-HYBRID] Fetching from Dexie for businessId:', businessId);
        try {
            const cutoff = new Date();
            cutoff.setHours(cutoff.getHours() - 12);
            const cutoffISO = cutoff.toISOString();

            let allOrders;
            const rawOrders = await db.orders.where('business_id').equals(businessId).toArray();
            console.log(`🔍 [useOrders-HYBRID] Found ${rawOrders.length} raw orders in Dexie`);

            if (filters.statuses && filters.statuses.length > 0) {
                allOrders = rawOrders.filter(o => filters.statuses.includes(o.order_status) && (o.created_at || o.updated_at) >= cutoffISO);
            } else {
                allOrders = rawOrders.filter(o => (o.created_at || o.updated_at) >= cutoffISO);
            }

            if (filters.orderType) {
                allOrders = allOrders.filter(o => o.order_type === filters.orderType);
            }

            // Fetch order items and menu items for hydration
            const orderIds = allOrders.map(o => o.id);
            const [allItems, allMenuItems] = await Promise.all([
                db.order_items.where('order_id').anyOf(orderIds).toArray(),
                db.menu_items.toArray()
            ]);

            const menuMap = new Map(allMenuItems.map(m => [m.id, m]));

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

                    // Timestamps
                    timestamp: order.created_at ? new Date(order.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : '',
                    created_at: order.created_at,
                    updated_at: order.updated_at,
                    ready_at: order.ready_at,

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

            console.log('📋 [useOrders-HYBRID] Hydrated Orders:', finalOrders.length);
            return finalOrders;
        } catch (err) {
            console.error('[useOrders-HYBRID] fetchFromDexie error:', err);
            return [];
        }
    }, [businessId, filters.statuses, filters.orderType]);

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
                                console.log(`🛡️ [useOrders-HYBRID] Protecting local pending state for ${order.id.slice(0, 8)}`);
                                continue;
                            }
                        }
                        await db.orders.put(order);
                    }
                });
            }

            return data;
        } catch (err) {
            console.error('[useOrders-HYBRID] Supabase sync error:', err);
            throw err;
        }
    }, [businessId]);

    // 🆕 MAYA FIX: Update order status with Anti-Jump Protection
    const updateStatus = useCallback(async (orderId, targetStatus) => {
        console.log('🔄 [useOrders-HYBRID] updateStatus called!', { orderId, targetStatus });

        // 🆕 Check anti-jump protection
        if (Date.now() < skipFetchUntilRef.current) {
            console.log('⏳ [useOrders-HYBRID] Skipping - anti-jump protection active');
            return false;
        }

        const currentOrder = ordersRef.current.find(o => String(o.id) === String(orderId));
        if (!currentOrder) {
            console.warn('❌ [useOrders-HYBRID] Order not found in state!', { orderId });
        }

        const currentStatus = currentOrder?.order_status;
        console.log('🔄 [useOrders-HYBRID] Status update:', { orderId, from: currentStatus, to: targetStatus });

        // 🆕 MAYA FIX: Consistent mapping - UI 'in_prep' -> DB 'in_progress'
        const dbStatus = targetStatus === 'in_prep' ? 'in_progress' : targetStatus;
        console.log('🔄 [useOrders-HYBRID] Final DB status:', dbStatus);

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

            console.log('🔄 [useOrders-HYBRID] Optimistic update (Dexie + State):', { orderId, status: dbStatus });
            await db.orders.update(orderId, updates);
            setOrders(prev => prev.map(o => String(o.id) === String(orderId) ? { ...o, ...uiUpdates } : o));

            // Push to Supabase via Safe RPC
            if (!isLocal) {
                const rpcParams = {
                    p_order_id: orderId,
                    p_new_status: dbStatus,
                    p_business_id: businessId
                };

                // If we are acknowledging a pending order, also update items
                if (dbStatus === 'new') {
                    rpcParams.p_item_status = 'new';
                }

                const { data: rpcData, error: updateError } = await supabase.rpc('update_order_status_v3', rpcParams);

                console.log('🌐 [useOrders-HYBRID-RPC]', {
                    params: rpcParams,
                    response: rpcData,
                    error: updateError
                });

                if (updateError || rpcData?.success === false) {
                    const failDetail = updateError?.message || (rpcData?.success === false ? '0 rows affected' : 'Unknown');
                    console.error(`❌ [useOrders-HYBRID-SYNC] FAIL: ${failDetail}`);

                    // REVERT UI
                    await db.orders.update(orderId, { pending_sync: false });
                    await fetchFromDexie().then(setOrders);
                    return false;
                }
            } else {
                console.log('📝 [useOrders-HYBRID] Local only order - waiting for syncService upload');
            }

            // Success: Clear the pending flag
            console.log('✅ [useOrders-HYBRID] Supabase push success!');
            await db.orders.update(orderId, { pending_sync: false });
            setOrders(prev => prev.map(o => String(o.id) === String(orderId) ? { ...o, pending_sync: false } : o));

            // 🆕 MAYA FIX: Activate anti-jump protection for 3 seconds
            skipFetchUntilRef.current = Date.now() + 3000;
            console.log('🛡️ [useOrders-HYBRID] Anti-jump protection activated for 3s');

            return true;
        } catch (err) {
            console.error('[useOrders-HYBRID] updateStatus error:', err);
            setError(err.message);
            return false;
        }
    }, [businessId, fetchFromDexie]);

    // Mark order as seen (stops alert)
    const markOrderSeen = useCallback(async (orderId) => {
        const seenAt = new Date().toISOString();

        try {
            // Optimistic update with protection
            await db.orders.update(orderId, { seen_at: seenAt, pending_sync: true });
            setOrders(prev => prev.map(o => String(o.id) === String(orderId) ? { ...o, seen_at: seenAt, pending_sync: true } : o));

            // Push to Supabase via Safe RPC
            if (!String(orderId).startsWith('L')) {
                const currentOrder = ordersRef.current.find(o => String(o.id) === String(orderId));
                const { data: rpcData, error } = await supabase.rpc('update_order_status_v3', {
                    p_order_id: orderId,
                    p_new_status: currentOrder?.order_status || 'pending',
                    p_business_id: businessId
                });

                if (error || rpcData?.success === false) {
                    throw new Error(error?.message || 'Update failed on server (0 rows)');
                }
            }

            // Clear protection
            await db.orders.update(orderId, { pending_sync: false });
            setOrders(prev => prev.map(o => String(o.id) === String(orderId) ? { ...o, pending_sync: false } : o));
        } catch (err) {
            console.error('[useOrders-HYBRID] Mark seen failed:', err);
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

    // 🆕 MAYA FIX: Setup real-time subscription with Anti-Jump Protection
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
                    // 🆕 MAYA FIX: Check anti-jump protection
                    if (Date.now() < skipFetchUntilRef.current) {
                        console.log('⏳ [useOrders-HYBRID] Ignoring realtime event - anti-jump protection active');
                        return;
                    }

                    console.log('[useOrders-HYBRID] Realtime event:', payload.eventType);

                    if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                        const order = payload.new;

                        // 🛡️ REAL-TIME GUARD: Check if we have a local change pending
                        const localOrder = await db.orders.get(order.id);
                        if (localOrder && localOrder.pending_sync) {
                            console.log(`⏳ [useOrders-HYBRID] Ignoring Realtime UPDATE for ${order.id.slice(0, 8)} - Local write in progress`);
                            return;
                        }

                        // Update Dexie
                        await db.orders.put({ ...order, pending_sync: false });

                        // Fetch items and menu items for hydration
                        const [orderItems, allMenuItems] = await Promise.all([
                            db.order_items.where('order_id').equals(order.id).toArray(),
                            db.menu_items.toArray()
                        ]);

                        const menuMap = new Map(allMenuItems.map(m => [m.id, m]));

                        // Fallback to existing items if DB lookup is empty
                        let finalItems = orderItems;
                        if (!finalItems || finalItems.length === 0) {
                            const existing = ordersRef.current.find(o => o.id === order.id);
                            if (existing && existing.items) {
                                finalItems = existing.items.map(i => ({
                                    ...i,
                                    item_status: i.status || i.item_status
                                }));
                            }
                        }

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
    }, [businessId]);

    // 🆕 MAYA FIX: Auto-healing on mount
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
                    console.log(`✅ [useOrders-HYBRID] Auto-Healed ${healedCount} orders`);
                }
            } catch (err) {
                console.error('[useOrders-HYBRID] Auto-heal failed:', err);
            }
        };

        healDexieData();
    }, [businessId]);

    // Initial load
    useEffect(() => {
        if (!businessId) {
            setIsLoading(false);
            return;
        }

        const init = async () => {
            console.log('🔍 [useOrders-HYBRID] Running init for:', businessId);
            setIsLoading(true);
            try {
                // Load from Dexie first (instant)
                const localOrders = await fetchFromDexie();
                console.log(`🔍 [useOrders-HYBRID] Local load complete: ${localOrders.length} orders`);
                setOrders(localOrders);
                setIsLoading(false);

                // Then sync from Supabase in background
                await syncFromSupabase();
                const freshOrders = await fetchFromDexie();
                setOrders(freshOrders);
            } catch (err) {
                setError(err.message);
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
        markOrderSeen,
        refresh
    };
}

export default useOrders;
