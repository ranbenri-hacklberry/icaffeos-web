/**
 * useOrders Hook
 * Modular hook for managing orders with Dexie (local) + Supabase (remote) sync
 * 
 * Features:
 * - Local-first with Dexie for performance
 * - Real-time Supabase subscription
 * - Multi-tenant filtering by business_id
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
    console.log('🔍 [useOrders-DIAG] Hook initialized with businessId:', businessId);
    const [orders, setOrders] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const subscriptionRef = useRef(null);
    const ordersRef = useRef(orders);

    // Keep ref in sync for realtime listener
    useEffect(() => {
        ordersRef.current = orders;
    }, [orders]);

    // Filter: orders that need attention (pending and not yet seen) - for alerts
    // Only 'pending' orders trigger alerts - once acknowledged they become 'new' and stop beeping
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
                if (status === 'in_prep') return o.order_status === 'in_progress' || o.order_status === 'in_prep';
                return o.order_status === status;
            });

            // CUSTOM SORTING LOGIC:
            if (status === 'new') {
                // 'New' column: Oldest orders at the top (by creation time)
                filtered.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
            } else if (status === 'in_prep') {
                // 'In Prep' column: ตามลำดับที่ผู้ใช้ย้ายการ์ד (Sort by updated_at ASC)
                // This preserves the sequence of movement into this column.
                filtered.sort((a, b) => new Date(a.updated_at || a.created_at || 0) - new Date(b.updated_at || b.created_at || 0));
            } else {
                // Others: Default to oldest first for consistency
                filtered.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
            }

            grouped[status] = filtered;
        });
        return grouped;
    }, [orders]);

    // Fetch orders from Dexie (local-first)
    const fetchFromDexie = useCallback(async () => {
        if (!businessId) {
            console.log('🔍 [useOrders-DIAG] No businessId provided, skipping fetch');
            return [];
        }

        console.log('🔍 [useOrders-DIAG] Fetching from Dexie for businessId:', businessId);
        try {
            const cutoff = new Date();
            cutoff.setHours(cutoff.getHours() - 12); // Narrow window for active Kanban (12h)
            const cutoffISO = cutoff.toISOString();

            let allOrders;
            const rawOrders = await db.orders.where('business_id').equals(businessId).toArray();
            console.log(`🔍 [useOrders-DIAG] Found ${rawOrders.length} raw orders in Dexie for this business`);

            if (filters.statuses && filters.statuses.length > 0) {
                allOrders = rawOrders.filter(o => filters.statuses.includes(o.order_status) && (o.created_at || o.updated_at) >= cutoffISO);
                console.log(`🔍 [useOrders-DIAG] ${allOrders.length} orders passed status + date filters`);
            } else {
                allOrders = rawOrders.filter(o => (o.created_at || o.updated_at) >= cutoffISO);
                console.log(`🔍 [useOrders-DIAG] ${allOrders.length} orders passed date filter`);
            }

            if (allOrders.length > 0) {
                const sample = allOrders[0];
                console.log('🔍 [useOrders-DIAG] Sample order before hydration:', {
                    id: sample.id,
                    status: sample.order_status,
                    created: sample.created_at
                });
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

            // SIMPLIFIED: Use order's own fields directly - they are already synced from Supabase
            // No need for complex customer table join unless explicitly needed
            const finalOrders = allOrders.map(order => {
                return {
                    ...order,
                    // Status & ID fields
                    orderStatus: order.order_status,
                    orderNumber: order.order_number,

                    // CRITICAL: Customer info comes DIRECTLY from order - same as KDS!
                    customerName: order.customer_name || 'אורח',
                    customerPhone: order.customer_phone,
                    deliveryAddress: order.delivery_address,
                    delivery_address: order.delivery_address, // Also provide snake_case for component compatibility

                    // Payment & amounts
                    isPaid: order.is_paid,
                    totalAmount: order.total_amount,

                    // Order type & delivery
                    orderType: order.order_type,
                    order_type: order.order_type,
                    deliveryFee: order.delivery_fee,
                    deliveryNotes: order.delivery_notes,

                    // Timestamps - format like KDS does
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

            console.log('📋 [useOrders-DIAG] Hydrated Orders Summary:', finalOrders.map(o => ({ id: o.id.slice(0, 8), status: o.orderStatus, rawStatus: o.order_status })));
            return finalOrders;
        } catch (err) {
            console.error('[useOrders] fetchFromDexie error:', err);
            return [];
        }
    }, [businessId, filters.statuses, filters.orderType]);

    // Sync from Supabase to Dexie
    const syncFromSupabase = useCallback(async () => {
        if (!businessId) return;

        try {
            // Fetch active orders (not delivered/cancelled in last 24h)
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
                                // console.log(`🛡️ [useOrders] Protecting local pending state for ${order.id}`);
                                continue;
                            }
                        }
                        await db.orders.put(order);
                    }
                });
            }

            return data;
        } catch (err) {
            console.error('[useOrders] Supabase sync error:', err);
            throw err;
        }
    }, [businessId]);

    // Update order status (Supabase first, then Dexie)
    const updateStatus = useCallback(async (orderId, targetStatus) => {
        console.log('🔄 [useOrders] updateStatus called!', { orderId, targetStatus });

        // Find the current order - check both ID and internal status
        const currentOrder = ordersRef.current.find(o => String(o.id) === String(orderId));
        if (!currentOrder) {
            console.warn('❌ [useOrders] Order not found in state!', { orderId, availableCount: ordersRef.current.length });
            // Fallback: try to update anyway with the targetStatus
        }

        const currentStatus = currentOrder?.order_status;
        console.log('🔄 [useOrders] Status update attempt:', {
            orderId,
            from: currentStatus,
            to: targetStatus
        });

        // 🛑 GROK FIX: Remove implicit auto-transitions. 
        // We update exactly what was requested. Transitions should be handled by the caller.
        let resolvedStatus = targetStatus;

        // Legacy KDS mapping: in_prep UI status -> in_progress DB status
        const dbStatus = resolvedStatus === 'in_prep' ? 'in_progress' : resolvedStatus;
        console.log('🔄 [useOrders] Final DB status to send:', dbStatus);

        try {
            const updates = {
                order_status: dbStatus,
                updated_at: new Date().toISOString(),
                pending_sync: true
            };

            const isLocal = String(orderId).startsWith('L');

            // Add timestamps for specific statuses
            if (resolvedStatus === 'ready') updates.ready_at = new Date().toISOString();
            if (resolvedStatus === 'delivered') updates.completed_at = new Date().toISOString();

            // Mark as seen when acknowledging an order
            if (['new', 'pending', 'in_progress'].includes(resolvedStatus)) {
                updates.seen_at = new Date().toISOString();
            }

            // Optimistic update - sync UI fields too
            const uiUpdates = {
                ...updates,
                orderStatus: dbStatus
            };

            console.log('🔄 [useOrders] Optimistic update (Dexie + State):', { orderId, status: dbStatus });
            await db.orders.update(orderId, updates);
            setOrders(prev => prev.map(o => String(o.id) === String(orderId) ? { ...o, ...uiUpdates } : o));

            // Push to Supabase via Safe RPC to bypass RLS issues
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

                console.log('🌐 [useOrders-RPC-DEBUG]', {
                    params: rpcParams,
                    response: rpcData,
                    error: updateError
                });

                if (updateError || rpcData?.success === false) {
                    const failDetail = updateError?.message || (rpcData?.success === false ? '0 rows affected (check IDs)' : 'Unknown');
                    console.error(`❌ [useOrders-SYNC] FAIL: ${failDetail}`);

                    // REVERT UI: Prevents the "Ghost New" status
                    await db.orders.update(orderId, { pending_sync: false });
                    await fetchFromDexie().then(setOrders);
                    return false;
                }
            } else {
                console.log('📝 [useOrders] Local only order - waiting for syncService upload');
            }

            // Success: Clear the pending flag in Dexie
            console.log('✅ [useOrders] Supabase push success!');
            await db.orders.update(orderId, { pending_sync: false });
            setOrders(prev => prev.map(o => String(o.id) === String(orderId) ? { ...o, pending_sync: false } : o));

            return true;
        } catch (err) {
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

            if (error) throw error;
        } catch (err) {
            console.error('[useOrders] Mark seen failed:', err);
            await db.orders.update(orderId, { pending_sync: false }); // Ensure clear even on error
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

    // Setup real-time subscription
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
                    console.log('[useOrders] Realtime event:', payload.eventType);

                    if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                        const order = payload.new;

                        // 🛡️ REAL-TIME GUARD: Check if we have a local change pending
                        const localOrder = await db.orders.get(order.id);
                        if (localOrder && localOrder.pending_sync) {
                            console.log(`⏳ [useOrders] Ignoring Realtime UPDATE for ${order.id.slice(0, 8)} - Local write in progress`);
                            return;
                        }

                        // Update Dexie
                        await db.orders.put({ ...order, pending_sync: false });

                        // Fetch items, customers, and menu items for hydration
                        let customerData = order.customer_id ? await db.customers.get(order.customer_id) : null;

                        // NEW: Fallback to phone lookup if ID fails or is missing
                        if (!customerData && (order.customer_phone || order.customerPhone)) {
                            const phone = order.customer_phone || order.customerPhone;
                            customerData = await db.customers.where('phone_number').equals(phone).first();
                        }

                        // If not in Dexie, try fetching from Supabase to ensure name is shown
                        if (!customerData && order.customer_id) {
                            const { data: remoteCustomer } = await supabase.from('customers').select('*').eq('id', order.customer_id).single();
                            if (remoteCustomer) {
                                customerData = remoteCustomer;
                                await db.customers.put(remoteCustomer); // Cache it
                            }
                        }

                        const [orderItems, allMenuItems] = await Promise.all([
                            db.order_items.where('order_id').equals(order.id).toArray(),
                            db.menu_items.toArray()
                        ]);

                        const menuMap = new Map(allMenuItems.map(m => [m.id, m]));

                        // Maya's Fix: Fallback to existing items if DB lookup is empty/fails
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
                            order_status: order.order_status, // Ensure DB field is present
                            orderStatus: order.order_status, // Ensure UI field is present and synced
                            orderNumber: order.order_number,
                            customerName: order.customer_name || customerData?.name || customerData?.customer_name || 'אורח',
                            customerPhone: order.customer_phone || customerData?.phone_number || customerData?.phone,
                            deliveryAddress: order.delivery_address || order.deliveryAddress || customerData?.address || customerData?.delivery_address,
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

                        // Phone fallback if name is still Guest
                        if (hydratedOrder.customerName === 'אורח' && (order.customer_phone || order.customerPhone)) {
                            const phone = order.customer_phone || order.customerPhone;
                            const localContact = await db.customers.where('phone').equals(phone).first() ||
                                await db.customers.where('phone_number').equals(phone).first();
                            if (localContact) {
                                hydratedOrder.customerName = localContact.name || localContact.customer_name;
                            } else {
                                // Last resort: Supabase by phone
                                const { data: remoteContact } = await supabase.from('customers')
                                    .select('name, customer_name')
                                    .or(`phone.eq."${phone}",phone_number.eq."${phone}"`)
                                    .limit(1)
                                    .maybeSingle();
                                if (remoteContact) {
                                    hydratedOrder.customerName = remoteContact.name || remoteContact.customer_name;
                                }
                            }
                        }

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

    // Initial load
    // The handleClick function seems to be for a component, not this hook.
    // I'll place it as a comment or assume it's meant for a component that uses this hook.
    /*
    const handleClick = (e) => {
        // Only trigger if clicking the card background, not buttons
        if (e.target.closest('button')) return;
        
        console.log('🖱️ [DraggableOrderCard] Card clicked!', { id: order.id, isUnseen });
        if (isUnseen && onMarkSeen) {
            onMarkSeen(order.id);
        }
    };
    */
    useEffect(() => {
        if (!businessId) {
            setIsLoading(false);
            return;
        }

        const init = async () => {
            console.log('🔍 [useOrders-DIAG] Running init for:', businessId);
            setIsLoading(true);
            try {
                // Load from Dexie first (instant)
                const localOrders = await fetchFromDexie();
                console.log(`🔍 [useOrders-DIAG] Local load complete: ${localOrders.length} orders`);
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
