/**
 * LAST UPDATE: 2026-01-19 19:25
 * ⚠️ IMPORTANT: RLS (Row Level Security) is ALWAYS enabled on Supabase!
 * This is a multi-tenant application. If orders are not loading:
 * 1. FIRST check RLS policies in Supabase Dashboard for 'orders' and 'order_items' tables
 * 2. Verify the user's business_id matches the data
 * 3. Check if the auth token is being sent correctly
 * 4. Use Supabase Dashboard → SQL Editor to test queries directly
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase, isLocalInstance } from '@/lib/supabase';
import { getBackendApiUrl } from '@/utils/apiUtils';
import { useAuth } from '@/context/AuthContext';
import { sendSms } from '@/services/smsService';
import { groupOrderItems, sortItems } from '@/utils/kdsUtils';
import { v4 as uuidv4 } from 'uuid';
import { db } from '@/db/database';
import { syncQueue } from '@/services/offlineQueue';

// 🌸 MAYA'S MODULAR ARCHITECTURE: Import pure helpers for testability
import {
    extractString,
    processOrderItems,
    determineCardStatus,
    buildBaseOrder,
    groupItemsByStatus,
    hasActiveItems,
    getSmartId
} from '@/pages/kds/hooks/kdsProcessingHelpers';
import { useKDSSms } from '@/pages/kds/hooks/useKDSSms';

/**
 * 📘 TABLE OF CONTENTS (INDEX)
 * ─────────────────────────────────────────────────────────────────────────────
 * 1.  INITIALIZATION & STATE ............................. Line 55
 * 2.  LOGGING & DEBUG HELPERS ............................ Line 80
 * 3.  AUTO-HEAL (DEXIE CONSISTENCY) ...................... Line 105
 * 4.  DATA FETCHING (fetchOrders) ........................ Line 185
 * 5.  SMS SENDING LOGIC (handleSendSms) .................. Line 1025
 * 6.  STATUS UPDATES (updateOrderStatus) ................. Line 1085
 * 7.  OPTIMISTIC UI & DEXIE UPDATES ...................... Line 1460
 * 8.  ITEM-LEVEL ACTIONS (Fire/Ready/EarlyDelivered) ..... Line 1590
 * 9.  UNDO & CANCEL LOGIC ................................ Line 1715
 * 10. PAYMENT CONFIRMATION ............................... Line 1775
 * 11. HEARTBEAT & DIAGNOSTICS ............................ Line 2030
 * 12. POLLING & SUBSCRIPTIONS ............................ Line 2130
 * ─────────────────────────────────────────────────────────────────────────────
 */


// Check if device is online
const checkOnline = () => navigator.onLine;

export const useKDSData = () => {
    const { currentUser } = useAuth();
    const [currentOrders, setCurrentOrders] = useState([]);
    const [completedOrders, setCompletedOrders] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    const [lastUpdated, setLastUpdated] = useState(new Date());
    const [lastAction, setLastAction] = useState(null);
    const [errorModal, setErrorModal] = useState(null);

    // 📱 SMS HOOK integration
    const { smsToast, setSmsToast, isSendingSms, handleSendSms, fireAndForgetSms, getSmsStatus } = useKDSSms();

    // OPTIMIZATION: Cache option map to avoid fetching on every poll
    const optionMapRef = useRef(new Map());

    // ANTI-JUMP: Skip auto-fetch for 3 seconds after manual status update
    // This prevents polling/realtime from overwriting optimistic state before animation completes
    const skipFetchUntilRef = useRef(0);

    // ANTI-FLICKER: Track recent local updates to override stale server data
    const recentLocalUpdatesRef = useRef(new Map());

    // OPTIMIZATION: Cache menu map to avoid fetching all menu items on every process loop
    const menuMapRef = useRef(new Map());
    const lastMenuUpdateRef = useRef(0);

    // 🕒 TIME SYNC: Offset between Server and Client to resolve merge conflicts accurately
    const serverTimeOffsetRef = useRef(0);

    const checkServerTime = async () => {
        try {
            // HEAD request to Supabase gets server time from headers
            const start = Date.now();
            // Use URL from supabase client or env
            const supabaseUrl = supabase.supabaseUrl || import.meta.env.VITE_SUPABASE_URL;
            if (!supabaseUrl) return;

            const response = await fetch(`${supabaseUrl}/rest/v1/`, {
                method: 'HEAD',
                headers: { 'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || supabase.supabaseKey }
            });

            const serverDateStr = response.headers.get('date');
            if (serverDateStr) {
                const serverTime = new Date(serverDateStr).getTime();
                const now = Date.now();
                const latency = (now - start) / 2;
                // Offset = Server - Client => ServerTime ≈ ClientTime + offset
                const offset = (serverTime + latency) - now;
                serverTimeOffsetRef.current = offset;

                if (Math.abs(offset) > 5000) {
                    console.warn(`🕒 [KDS-TIME] Clock Drift Detected! Client is ${Math.round(offset / 1000)}s relative to Server.`);
                } else {
                    console.log(`🕒 [KDS-TIME] Sync: Offset is ${Math.round(offset)}ms`);
                }
            }
        } catch (e) {
            console.warn('Failed to sync server time:', e);
        }
    };

    useEffect(() => {
        checkServerTime();
        const interval = setInterval(checkServerTime, 5 * 60 * 1000); // Every 5 mins
        return () => clearInterval(interval);
    }, []);

    // 🟢 PRODUCTION LOGGING HELPERS
    const DEBUG = true;
    const log = (msg, ...args) => {
        const timestamp = new Date().toLocaleTimeString('he-IL', { hour12: false });
        console.log(`%c[KDS ${timestamp}] ${msg}`, 'color: #10b981; font-weight: bold;', ...args);
    };
    const warn = (msg, ...args) => {
        const timestamp = new Date().toLocaleTimeString('he-IL', { hour12: false });
        console.warn(`[KDS ${timestamp}] ⚠️ ${msg}`, ...args);
    };
    const error = (msg, ...args) => {
        const timestamp = new Date().toLocaleTimeString('he-IL', { hour12: false });
        console.error(`[KDS ${timestamp}] ❌ ${msg}`, ...args);
    };

    // NOTE: getSmartId is now imported from kdsProcessingHelpers.js

    // --- 🔋 LITE MODE SUPPORT ---
    const isLiteMode = localStorage.getItem('lite_mode') === 'true';

    // 🔍 DEBUG + BACKEND PING on mount
    useEffect(() => {
        const isLan = window.location.hostname.startsWith('192.168.') ||
            window.location.hostname.startsWith('10.') ||
            window.location.hostname.startsWith('100.') ||
            window.location.hostname.startsWith('172.');
        console.log(`🔗 [KDS-INIT] isLocal=${isLocalInstance()}, isLAN=${isLan}, hostname=${window.location.hostname}, LiteMode=${isLiteMode}`);

        // 📱 Ping backend so we can see in backend logs that the iPad opened KDS
        if (isLan) {
            const backendUrl = getBackendApiUrl();
            fetch(`${backendUrl}/api/kds/ping`)
                .then(r => r.json())
                .then(d => console.log(`✅ [KDS-INIT] Backend ping OK:`, d))
                .catch(e => console.error(`❌ [KDS-INIT] Backend ping FAILED — cannot reach backend at ${backendUrl}:`, e.message));
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // 🛠️ GLOBAL AUTO-HEAL: Run once on mount to fix ALL Dexie inconsistencies
    /**
     * 🧹 AGGRESSIVE CLEANUP: Remove ANY order from previous business days
     */
    const cleanupOldData = useCallback(async () => {
        try {
            const now = new Date();
            const businessDayStart = new Date(now);
            businessDayStart.setHours(5, 0, 0, 0);
            if (now.getHours() < 5) businessDayStart.setDate(businessDayStart.getDate() - 1);

            const oldOrders = await db.orders
                .filter(o => new Date(o.created_at) < businessDayStart)
                .toArray();

            if (oldOrders.length > 0) {
                const oldIds = oldOrders.map(o => o.id);
                console.log(`🧹 [KDS-CLEANUP] Removing ${oldOrders.length} stale orders from Dexie`);
                await db.orders.bulkDelete(oldIds);
                await db.order_items.where('order_id').anyOf(oldIds).delete();
            }
        } catch (err) {
            console.error('Cleanup failed:', err);
        }
    }, []);

    // Initial Cleanup on Mount
    useEffect(() => {
        cleanupOldData();
    }, [cleanupOldData]);

    /**
     * 🚀 Helper to process raw order data and update React state
     * Extracted from fetchOrders to allow multiple call points (SWR)
     */
    const processAndSetUI = useCallback(async (ordersData, menuMapFromRef) => {
        // 🔍 VERSION CHECK: If iPad shows "KDS v2" in title, it loaded the new code
        if (typeof document !== 'undefined' && !document.title.includes('v2')) {
            document.title = document.title.replace(/\s*v\d+/, '') + ' v2';
        }
        if (!ordersData || ordersData.length === 0) {
            setCurrentOrders([]);
            setCompletedOrders([]);
            setIsLoading(false);
            return;
        }

        try {
            console.log(`📊 [UI-PROCESS] Processing ${ordersData.length} raw orders. Sample:`, ordersData[0]?.id);
            if (ordersData.length > 0) {
                console.log(`📊 [UI-PROCESS] Order statuses:`, ordersData.map(o => `${o.order_number}: ${o.order_status}`).join(', '));
            }

            // 🕒 Calculate business day start (5:00 AM)
            const now = new Date();
            const businessDayStart = new Date(now);
            businessDayStart.setHours(5, 0, 0, 0);
            if (now.getHours() < 5) {
                businessDayStart.setDate(businessDayStart.getDate() - 1);
            }

            // 🔧 Load menu items for fallback names (Optimized Cache)
            let menuMap = menuMapFromRef || menuMapRef.current;
            if (menuMap.size === 0) {
                try {
                    const allMenuItems = await db.menu_items.toArray();
                    menuMap = new Map(allMenuItems.map(m => [m.id, m]));
                    menuMapRef.current = menuMap;
                } catch (e) { /* ignore */ }
            }

            const processedOrders = [];
            const recentUpdates = recentLocalUpdatesRef.current;
            const processTimestamp = Date.now();

            ordersData.forEach((order) => {
                // 🛡️ BUSINESS DAY FILTER: Skip orders from previous business days
                // unless they are pending sync (local changes that need to be saved)
                const orderDate = new Date(order.created_at);
                if (orderDate < businessDayStart && !order.pending_sync && !order._useLocalStatus) {
                    // Skip old orders - they shouldn't appear today
                    return;
                }
                // ANTI-FLICKER: Aggressive Local Authority
                const recentUpdate = recentUpdates.get(order.id) || recentUpdates.get(order.serverOrderId);
                const localOverride = order._useLocalStatus || order.pending_sync; // Flag set during fetch merge

                // If we have a local decision (either from merge or recent update), ENFORCE IT.
                if (localOverride || (recentUpdate && processTimestamp - recentUpdate.timestamp < 10000)) { // 10s protection
                    const targetStatus = recentUpdate?.status || order.order_status; // Trust local status from merge if no recent update

                    if (order.order_status !== targetStatus) {
                        log(`🛡️ [AUTHORITY] Enforcing local status for ${order.order_number}: ${order.order_status} -> ${targetStatus}`);
                        order.order_status = targetStatus;
                    }

                    // FORCE item statuses to match if order is completed/ready
                    // 🛡️ PARTIALITY FIX: Only force items if the order itself is definitively effectively closed
                    // OR if the items are not specifically tracked as separate active entities.
                    if (['completed', 'ready'].includes(targetStatus)) {
                        // Check if we have mixed states in the raw data that we should respect?
                        // Actually, if localStatus says "completed", it usually means the WHOLE order is done.
                        // But for SPLIT orders, the order status might remain 'in_progress' while some items complete.

                        // If the targetStatus is 'completed', we assume the whole order is done.
                        if (targetStatus === 'completed') {
                            if (order.order_items) {
                                order.order_items.forEach(i => {
                                    if (i.item_status !== 'cancelled') i.item_status = 'completed';
                                });
                            }
                        }
                    }
                }

                if (!order.order_items && order.items_detail) order.order_items = order.items_detail;
                if (!order.order_items && order.items) order.order_items = order.items;

                // 🔍 DEBUG SPECIFIC ORDERS
                const debugIds = ['3624', '3625', '3710'];
                if (debugIds.includes(String(order.order_number))) {
                    console.log(`🕵️ DEBUG_ORDER ${order.order_number}:`, {
                        status: order.order_status,
                        itemsCount: order.order_items?.length,
                        items: order.order_items
                    });
                }

                const rawItems = processOrderItems(order, menuMap);
                const hasActiveItemsFlag = rawItems.some(item =>
                    ['in_progress', 'new', 'pending', 'ready', 'held'].includes(item.item_status)
                );

                // 🍫 SHOKO FIX: Check specifically for held items
                const hasHeldItems = rawItems.some(item => item.item_status === 'held');

                // 🔍 DEBUG POST-PROCESS
                if (debugIds.includes(String(order.order_number))) {
                    console.log(`🕵️ DEBUG_ORDER ${order.order_number} POST-PROCESS:`, {
                        rawItemsCount: rawItems.length,
                        hasActiveItemsFlag,
                        hasHeldItems,
                        orderStatus: order.order_status
                    });
                }

                // 🛡️ UI FILTER: Don't show fully completed orders on the main KDS screens 
                // unless they were updated very recently (e.g. 30 minutes) to allow for "Undo"
                const isVeryRecent = (Date.now() - new Date(order.updated_at || 0).getTime()) < 30 * 60 * 1000;

                // 🛡️ NUCLEAR SHOKO FIX: If an order has ANY item in 'held' status, 
                // it is NOT effectively done, regardless of the order_status field!
                const isEffectivelyDone = (order.order_status === 'completed' || order.order_status === 'ready') && !hasHeldItems;

                // 💰 Keep unpaid orders on screen for manual payment/archiving
                const isUnpaid = order.is_paid === false || (order.total_amount > (order.paid_amount || 0));

                if (isEffectivelyDone && !hasActiveItemsFlag && !isVeryRecent && !isUnpaid) return;

                // 🛡️ SKELETON FILTER: Never display orders with no items.
                // If the order arrived without items, it's a "skeleton" - skip it entirely.
                if (!rawItems || rawItems.length === 0) {
                    console.log(`🦴 [SKELETON] Skipping order ${order.order_number || order.id} — no items`);
                    return;
                }

                const baseOrder = buildBaseOrder(order);

                // 🛡️ ENSURE STABILITY: If the order is 'completed' but has held items, 
                // we treat the card as 'in_progress' so it stays in the Active/Delayed list.
                if (order.order_status === 'completed' && hasHeldItems) {
                    baseOrder.order_status = 'in_progress';
                }
                const itemsByGroup = groupItemsByStatus(rawItems);

                Object.entries(itemsByGroup).forEach(([groupKey, groupItems]) => {
                    const { cardType, cardStatus } = determineCardStatus(groupKey, groupItems, order);
                    const cardId = groupKey === 'active' ? order.id : `${order.id}-${groupKey}`;

                    // 🛡️ [KDS-STABILITY] SKIP FULLY COMPLETED CARDS:
                    // If every item in this specific status group is 'completed', 
                    // we don't want to show this card on the KDS anymore.
                    // (Unless the order is unpaid - we want to keep unpaid cards visible)
                    const allCompleted = groupItems.every(i => i.item_status === 'completed');
                    if (allCompleted && !isUnpaid) {
                        return;
                    }

                    processedOrders.push({
                        ...baseOrder,
                        id: cardId,
                        serverOrderId: order.id,
                        status: cardStatus,
                        type: cardType,
                        items: sortItems(groupOrderItems(groupItems)),
                        is_delayed: groupKey === 'delayed'
                    });
                });
            });

            // --- 📊 SORTING LOGIC ---

            // 1. ACTIVE ORDERS: Oldest Fired -> Right side (Stable relative positions)
            const current = processedOrders
                .filter(o => (o.type === 'active' || o.type === 'delayed'))
                .sort((a, b) => {
                    const aDelayed = a.type === 'delayed';
                    const bDelayed = b.type === 'delayed';
                    if (aDelayed && !bDelayed) return 1;
                    if (!aDelayed && bDelayed) return -1;

                    // 🔒 STABLE SORT: Always use created_at to prevent jumping when firing new items
                    const aTime = new Date(a.created_at || 0).getTime();
                    const bTime = new Date(b.created_at || 0).getTime();

                    if (aTime !== bTime) return aTime - bTime;

                    // Secondary deterministic sort: Order ID or Number
                    return String(a.order_number || a.id).localeCompare(String(b.order_number || b.id));
                });

            // 2. COMPLETED/READY ORDERS (The "Bottom Room")
            // ⚠️ STABILITY CRITICAL: New items must be APPENDED, existing items must NOT move.
            // We sort by 'Oldest Ready First' (ASC) so index 0 stays the same.
            const completed = processedOrders.filter(o =>
                (o.type === 'ready' || o.type === 'active_ready_split' || o.type === 'unpaid_delivered')
            ).sort((a, b) => {
                // Priority A: Unpaid comes FIRST (Right-most side)
                if (a.isPaid !== b.isPaid) return a.isPaid ? 1 : -1;

                // Priority B: Oldest Ready First (ASC) -> STABILITY
                const aTime = new Date(a.ready_at || a.created_at || 0).getTime();
                const bTime = new Date(b.ready_at || b.created_at || 0).getTime();
                return aTime - bTime;
            });

            // Lite Mode slicing
            let finalCurrent = current;
            let finalCompleted = completed;
            if (isLiteMode) {
                if (current.length > 20) finalCurrent = current.slice(0, 20);
                if (completed.length > 20) finalCompleted = completed.slice(0, 20);
            }

            // 🛑 ANTI-JUMP PREVENTION: only update state if data ACTUALLY changed
            // This prevents React from destroy/recreating DOM nodes which causes the visual "flash/jump"
            setCurrentOrders(prev => {
                const prevStr = JSON.stringify(prev.map(o => ({ id: o.id, status: o.status, items: o.items?.length })));
                const nextStr = JSON.stringify(finalCurrent.map(o => ({ id: o.id, status: o.status, items: o.items?.length })));
                return prevStr === nextStr ? prev : finalCurrent;
            });

            setCompletedOrders(prev => {
                const prevStr = JSON.stringify(prev.map(o => ({ id: o.id, status: o.status, items: o.items?.length })));
                const nextStr = JSON.stringify(finalCompleted.map(o => ({ id: o.id, status: o.status, items: o.items?.length })));
                return prevStr === nextStr ? prev : finalCompleted;
            });

            console.log(`✅ [UI-UPDATE] Displaying ${finalCurrent.length} active and ${finalCompleted.length} ready/completed cards.`);

            setLastUpdated(new Date());
            setIsLoading(false);
        } catch (e) {
            console.error('UI Processing error:', e);
            setIsLoading(false);
        }
    }, [isLiteMode]);

    /**
     * 🌸 FETCH ORDERS - Main Data Loading Function
     * 
     * This function is complex due to hybrid online/offline support.
     * It follows this structured flow:
     * 
     * ┌─────────────────────────────────────────────────────────────────────┐
     * │ PHASE 1: INITIALIZATION                                             │
     * │   - Set loading state, check online status, load option map cache   │
     * ├─────────────────────────────────────────────────────────────────────┤
     * │ PHASE 2: ONLINE - SUPABASE FETCH                                    │
     * │   - Sync pending queue, call get_kds_orders RPC                     │
     * ├─────────────────────────────────────────────────────────────────────┤
     * │ PHASE 3: ONLINE - DEXIE CACHE UPDATE                                │
     * │   - Save fetched orders to Dexie, handle merge with local changes   │
     * ├─────────────────────────────────────────────────────────────────────┤
     * │ PHASE 4: OFFLINE - DEXIE LOAD                                       │
     * │   - Load orders from Dexie when offline or Supabase fails           │
     * ├─────────────────────────────────────────────────────────────────────┤
     * │ PHASE 5: ONLINE - SUPPLEMENTAL FETCHES                              │
     * │   - Fetch ready items, rescue orders with active items              │
     * ├─────────────────────────────────────────────────────────────────────┤
     * │ PHASE 6: MERGE LOCAL PENDING ORDERS                                 │
     * │   - Merge truly offline orders (created locally, not yet synced)    │
     * ├─────────────────────────────────────────────────────────────────────┤
     * │ PHASE 7: PROCESS ORDERS FOR DISPLAY                                 │
     * │   - Apply filters, group items, create split course cards           │
     * ├─────────────────────────────────────────────────────────────────────┤
     * │ PHASE 8: UPDATE STATE                                               │
     * │   - Set React state with processed orders                           │
     * └─────────────────────────────────────────────────────────────────────┘
     * 
     * @param {AbortSignal} signal - Optional abort signal for cancellation
     */
    const fetchOrders = useCallback(async (isForced = false, signal, silent = false) => {
        try {
            // 🧹 Clean up zombie data before we even start
            await cleanupOldData();

            // 🔒 ANTI-JUMP: Ignore background fetches during cooldown
            if (!isForced && Date.now() < skipFetchUntilRef.current) {
                log('⏳ [fetchOrders] Skipping background fetch - in anti-jump cooldown');
                return;
            }

            // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            // PHASE 1: INITIALIZATION
            // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            // 🌸 STABILITY FIX: Only show full loading spinner if we have NO orders at all
            if (!silent && currentOrders.length === 0 && completedOrders.length === 0) {
                setIsLoading(true);
            }

            const businessId = currentUser?.business_id;
            const isOnline = navigator.onLine;

            // Track if we're working offline
            setIsOffline(!isOnline);

            log(`🔍 [useKDSData] Fetching orders... ${isOnline ? '🌐 Online' : '📴 Offline'}`, {
                businessId,
                userId: currentUser?.id,
                liteMode: isLiteMode
            });

            if (!businessId) {
                warn('❌ Missing businessId. currentUser details:', currentUser);
            }

            // Build option map (from Dexie first, for speed and offline support)
            // CACHING: Only load options if cache is empty
            if (optionMapRef.current.size === 0) {
                try {
                    const localOptionValues = await db.optionvalues.toArray();
                    localOptionValues?.forEach(ov => {
                        optionMapRef.current.set(String(ov.id), ov.value_name);
                        optionMapRef.current.set(ov.id, ov.value_name);
                    });
                    // If online, try to update from Supabase (background update)
                    if (isOnline) {
                        supabase.from('optionvalues').select('id, value_name').then(({ data }) => {
                            data?.forEach(ov => {
                                optionMapRef.current.set(String(ov.id), ov.value_name);
                                optionMapRef.current.set(ov.id, ov.value_name);
                            });
                        });
                    }
                } catch (e) {
                    console.warn('Failed to load option map:', e);
                }
            }
            // Use cached map
            const optionMap = optionMapRef.current;

            // If online, try to update option map from Supabase
            // Supabase update moved to background promise above to not block UI render

            // 🕒 KDS ANCHOR: The day starts at 5:00 AM. 
            // Everything before 5:00 AM is "yesterday" and should be cleared.
            // 🚨 MAYA FIX: Fetch active orders for last 7 days to ensure old/stuck orders are seen!
            const fetchStartTime = new Date();
            const anchor = new Date(fetchStartTime);
            anchor.setHours(5, 0, 0, 0);

            // If it is currently earlier than 5:00 AM, the start of our "day" was yesterday at 5:00 AM
            if (fetchStartTime < anchor) {
                anchor.setDate(anchor.getDate() - 1);
            }

            // Go back 7 days for active orders
            anchor.setDate(anchor.getDate() - 7);

            const today = anchor;
            log(`📅 [KDS] Use T-7 days anchor for Active Orders (Anchor: ${today.toISOString()})`);

            let ordersData = [];
            let supabaseFailed = false;

            // 🚀 STEP 1: LOAD FROM DEXIE / LOCAL CACHE
            const isLocal = isLocalInstance();
            let localPendingOrders = [];

            try {
                // 🕒 BUSINESS DAY ANCHOR (Same as server - T-7 Days)
                const now = new Date();
                const businessDayStart = new Date(now);
                businessDayStart.setHours(5, 0, 0, 0);
                if (now.getHours() < 5) businessDayStart.setDate(businessDayStart.getDate() - 1);
                // 🚨 MAYA FIX: Look back 7 days for local orders too!
                businessDayStart.setDate(businessDayStart.getDate() - 7);

                // ALWAYS load pending/unsynced orders from Dexie first.
                // 🛡️ CRITICAL: Only load orders from TODAY'S business day.
                // Old "pending" orders from yesterday are likely sync-errors that shouldn't haunt the KDS.
                const rawPendingOrders = await db.orders
                    .filter(o => {
                        const orderDate = new Date(o.created_at);
                        const isFromToday = orderDate >= businessDayStart;

                        // If it's not from today, we don't show it in KDS regardless of status
                        if (!isFromToday) return false;

                        return o.pending_sync === true ||
                            o.is_offline === true ||
                            o._useLocalStatus === true ||
                            (o.order_status === 'completed' && o.updated_at > new Date(Date.now() - 15 * 60 * 1000).toISOString())
                    })
                    .toArray();

                localPendingOrders = await Promise.all(rawPendingOrders.map(async (o) => {
                    const items = await db.order_items.where('order_id').equals(o.id).toArray();
                    return { ...o, order_items: items };
                }));

                if (localPendingOrders.length > 0) {
                    log(`💾 [KDS] Found ${localPendingOrders.length} locally pending orders for today.`);
                }
            } catch (err) {
                warn('Failed to load pending local orders:', err);
            }

            // Re-declare to ensure scope availability if needed, though 'let localPendingOrders' is above.

            // 🚀 FIRE AND FORGET: IMMEDIATELY LOAD FROM DEXIE TO UNBLOCK UI
            try {
                const localOrders = await db.orders
                    .filter(o => {
                        const isToday = new Date(o.created_at) >= today;
                        const isActiveState = ['in_progress', 'ready', 'new', 'pending'].includes(o.order_status);
                        const isUnpaidCompleted = o.order_status === 'completed' && o.is_paid === false;
                        const isPending = o.pending_sync === true || o.is_offline === true;
                        const businessMatch = !businessId || String(o.business_id) === String(businessId);
                        return businessMatch && (((isActiveState || isUnpaidCompleted) && isToday) || isPending);
                    })
                    .toArray();

                ordersData = localOrders || [];

                if (localOrders && localOrders.length > 0) {
                    const localOrderIds = localOrders.map(o => o.id);
                    const orderItems = await db.order_items.where('order_id').anyOf(localOrderIds).toArray();
                    const menuItems = await db.menu_items.toArray();
                    const menuMap = new Map(menuItems.map(m => [m.id, m]));

                    ordersData = localOrders.map(order => ({
                        id: order.id,
                        order_number: order.order_number,
                        customer_name: order.customer_name || 'אורח',
                        customer_phone: order.customer_phone,
                        is_paid: order.is_paid,
                        total_amount: order.total_amount,
                        created_at: order.created_at,
                        updated_at: order.updated_at,
                        order_status: order.order_status,
                        pending_sync: order.pending_sync || false,
                        order_items: orderItems
                            .filter(i => String(i.order_id) === String(order.id))
                            .map(item => {
                                const menuItem = menuMap.get(item.menu_item_id);
                                const name = menuItem?.name || item.name || 'פריט מהתפריט';
                                return {
                                    ...item,
                                    name,
                                    menu_items: {
                                        name: name,
                                        price: item.price || menuItem?.price || 0,
                                        kds_routing_logic: menuItem?.kds_routing_logic || 'MADE_TO_ORDER',
                                        is_prep_required: menuItem?.is_prep_required !== false
                                    }
                                };
                            })
                    }));

                    log(`🚀 [Hydration] Extracted ${ordersData.length} active orders instantly`);
                    // IMMMEDIATELY RENDER the Local Data so the KDS isn't empty!
                    processAndSetUI(ordersData, menuMap);
                } else {
                    log('ℹ️ [Hydration] No cached active orders found instantly');
                }
            } catch (err) {
                warn('Initial Dexie Load failed:', err);
            }

            // If it's local, we still go to supabase (LAN/cloud).
            if (isLocal) {
                log('🏘️ [Local Mode] Background syncing from Supabase (Edge Hub)...');
            } else {
                log('🌐 [Cloud Mode] Background syncing from Supabase...');
            }

            // 🚀 STEP 2: SUPABASE FETCH (Background Refresh)
            if (!isOnline) {
                log('📴 [useKDSData] Offline mode - skipping Supabase');
                supabaseFailed = true;
                // If offline and no SWR data, we must stop loading anyway
                if (ordersData.length === 0) setIsLoading(false);
            } else {
                // ONLINE: First sync any pending queue items with a TIMEOUT
                try {
                    // syncQueue is imported at top level
                    // ⏱️ Don't let sync hang the whole fetch - limit to 5 seconds
                    const syncPromise = syncQueue();
                    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Sync timeout')), 5000));

                    const syncResult = await Promise.race([syncPromise, timeoutPromise]).catch(e => ({ synced: 0, failed: 0, error: e.message }));

                    if (syncResult.synced > 0) {
                        console.log(`🔄 [useKDSData] Synced ${syncResult.synced} pending actions.`);
                        // Removed 500ms arbitrary delay - let realtime or state handles the rest
                    }
                } catch (syncErr) {
                    console.warn('Queue sync failed or timed out, continuing:', syncErr);
                }

                // ONLINE: Try fetching orders
                // ✅ UNIFIED PATH: All devices (including iPad/tablets on LAN) call Supabase RPC directly.
                // Kong listens on 0.0.0.0:54321 and is accessible from LAN.
                // The previous backend proxy path (/api/kds/orders) was causing iPad to show 0 orders.
                try {
                    let ordersData_raw = null;

                    log(`📡 [KDS] Calling RPC get_kds_orders: date=${today.toISOString()}, businessId=${businessId}`);

                    const fetchController = new AbortController();
                    const fetchTimeoutId = setTimeout(() => fetchController.abort(new Error('KDS Fetch Timeout (5000ms)')), 5000);

                    // Link the component unmount signal with the timeout signal
                    const handleUnmount = () => fetchController.abort();
                    signal.addEventListener('abort', handleUnmount);

                    let rpcData = null;
                    let error = null;

                    try {
                        const res = await supabase.rpc('get_kds_orders', {
                            p_date: today.toISOString(),
                            p_business_id: businessId || null
                        }).abortSignal(fetchController.signal);

                        rpcData = res.data;
                        error = res.error;
                    } catch (fetchErr) {
                        error = fetchErr;
                    } finally {
                        clearTimeout(fetchTimeoutId);
                        signal.removeEventListener('abort', handleUnmount);
                    }

                    if (error) {
                        console.error('❌ [KDS-ERROR] RPC get_kds_orders failed:', error.message, error.details);
                        throw error;
                    }
                    ordersData_raw = rpcData;

                    // Ping backend for connection logging (non-blocking)
                    try {
                        const backendUrl = getBackendApiUrl();
                        fetch(`${backendUrl}/api/kds/ping`).catch(() => { });
                    } catch (_) { }

                    const data = ordersData_raw;

                    log(`📦 [KDS] RPC returned ${data?.length || 0} orders from Supabase`);
                    if (data && data.length > 0) {
                        log(`📦 [KDS] Sample order IDs: ${data.slice(0, 3).map(o => o.id).join(', ')}`);
                    }
                    ordersData = data || [];

                    // 🛡️ MERGE-BACK: If we have local pending orders, they OVERRIDE the server data.
                    // This handles the "Undo Ready" -> Refresh -> Reappear bug.
                    if (localPendingOrders.length > 0) {
                        console.log('🔄 [MERGE-BACK] Applying local pending overrides to server data...');
                        localPendingOrders.forEach(localOrder => {
                            const existingIndex = ordersData.findIndex(o => o.id === localOrder.id);
                            if (existingIndex !== -1) {
                                // Order exists in server response - OVERRIDE IT
                                const serverOrder = ordersData[existingIndex];

                                // If local is explicitly more recent or has pending_sync, we trust it for status
                                // especially if local status is 'completed' and server is 'ready'
                                if (localOrder.pending_sync || localOrder._useLocalStatus || localOrder.order_status === 'completed') {
                                    console.log(`🛡️ [OVERRIDE] ${localOrder.order_number}: Server(${serverOrder.order_status}) -> Local(${localOrder.order_status})`);
                                    ordersData[existingIndex] = {
                                        ...serverOrder, // Keep server structure (items etc)
                                        order_status: localOrder.order_status,
                                        // 🛡️ CRITICAL FIX: Also Override items if they exist locally!
                                        // This ensures partial updates (split cards) are respected
                                        order_items: localOrder.order_items || serverOrder.order_items,
                                        pending_sync: !!localOrder.pending_sync,
                                        _useLocalStatus: !!localOrder._useLocalStatus
                                    };
                                }
                            } else {
                                // Order doesn't exist on server yet (or filtered out because it's completed)
                                // 🛡️ Proactive Cleanup: If it's already completed locally and isn't on server, 
                                // it's likely already old/processed. Stop appending it to keep screen clean.
                                if (localOrder.order_status === 'completed' && !localOrder.is_offline) {
                                    console.log(`🧹 [MERGE-CLEAN] Cleaning up completed order ${localOrder.order_number} not in server list`);
                                    db.orders.update(localOrder.id, { pending_sync: false, _useLocalStatus: false });
                                    return;
                                }
                                ordersData.push(localOrder);
                            }
                        });
                    }

                    // 💾 CACHE TO DEXIE: Save orders locally for offline access
                    try {
                        // db is imported at top level

                        // 1. Get IDs of currently active orders from Supabase
                        const activeServerOrderIds = new Set(ordersData.map(o => o.id));

                        // 2. Cache the active ones
                        try {
                            // 2. Cache the active ones & MERGE with local pending changes
                            const mergedOrders = [];
                            const ordersToCache = [];
                            const itemsToCache = [];
                            const itemsToCleanup = []; // orderId -> payloadItemIds

                            // Fetch ALL relevant local orders at once to avoid loop-awaits
                            const localOrdersArr = await db.orders.toArray();
                            const localOrdersMap = new Map(localOrdersArr.map(o => [String(o.id), o]));

                            for (const order of ordersData) {
                                // Robust ID handling: ensure it's saved correctly
                                const sId = getSmartId(order.id);
                                const smartId = String(sId);

                                // MAP RPC structure to Local structure
                                if (!order.order_items && order.items_detail) {
                                    order.order_items = order.items_detail;
                                }

                                // PROTECTION: Don't overwrite local changes that haven't synced yet!
                                const existingLocal = localOrdersMap.get(smartId);

                                // CLOUD FIRST: If online, trust server unless it's a completely unsynced L-order
                                const isOrderLocalOnly = String(order.id).startsWith('L');
                                if (existingLocal && existingLocal.pending_sync && !isOrderLocalOnly && isOnline && order.order_status !== 'completed') {
                                    // Skip merge, trust server payload.
                                    log(`🌐 [Merge] Online: Trusting server version for ${order.order_number}`);
                                } else if (existingLocal && existingLocal.pending_sync && order.order_status !== 'completed') {
                                    const serverUpdatedAt = new Date(order.server_updated_at || order.updated_at || 0).getTime();

                                    // 🕒 ADJUST LOCAL TIME TO SERVER TIME FRAME
                                    const localRaw = new Date(existingLocal.server_updated_at || existingLocal.updated_at || 0).getTime();
                                    const localInServerTime = localRaw + serverTimeOffsetRef.current;

                                    const serverMatchesLocal = order.order_status === existingLocal.order_status;

                                    if (!(serverUpdatedAt > localInServerTime || serverMatchesLocal)) {
                                        // Still local-newer
                                        mergedOrders.push({
                                            ...order,
                                            order_status: existingLocal.order_status,
                                            updated_at: existingLocal.updated_at || new Date().toISOString(),
                                            pending_sync: true,
                                            _useLocalStatus: true
                                        });
                                        continue;
                                    }
                                }

                                // 🛡️ HYDRATION GATE: Only cache orders that have items.
                                // Skeleton orders (no items) must NOT be written to Dexie.
                                if (!order.order_items || order.order_items.length === 0) {
                                    console.log(`🦴 [SKELETON-GATE] NOT caching order ${order.order_number || sId} to Dexie — no items`);
                                    // Still push to mergedOrders for display consideration
                                    // (processAndSetUI will filter it out via the skeleton filter)
                                    mergedOrders.push(order);
                                    continue;
                                }

                                // No pending changes or server caught up - prepare for bulk cache
                                ordersToCache.push({
                                    id: sId,
                                    order_number: order.order_number,
                                    order_status: order.order_status,
                                    is_paid: order.is_paid,
                                    customer_id: order.customer_id,
                                    customer_name: order.customer_name,
                                    customer_phone: order.customer_phone,
                                    total_amount: order.total_amount,
                                    business_id: order.business_id || businessId,
                                    created_at: order.created_at,
                                    updated_at: order.updated_at || new Date().toISOString(),
                                    pending_sync: false
                                });

                                // Prepare items for bulk cache
                                if (order.order_items) {
                                    const payloadItemIds = new Set();
                                    for (const item of order.order_items) {
                                        payloadItemIds.add(item.id);
                                        itemsToCache.push({
                                            id: item.id,
                                            order_id: sId,
                                            menu_item_id: item.menu_item_id || item.menu_items?.id,
                                            quantity: item.quantity,
                                            price: item.price || item.menu_items?.price,
                                            mods: item.mods,
                                            notes: item.notes,
                                            item_status: item.item_status,
                                            is_early_delivered: !!item.is_early_delivered,
                                            course_stage: item.course_stage || 1,
                                            created_at: item.created_at || order.created_at
                                        });
                                    }
                                    itemsToCleanup.push({ smartId: sId, payloadItemIds });
                                }

                                // Push server version to merged list
                                mergedOrders.push(order);
                            }

                            // Perform BULK Dexie updates
                            if (ordersToCache.length > 0) await db.orders.bulkPut(ordersToCache);
                            if (itemsToCache.length > 0) await db.order_items.bulkPut(itemsToCache);

                            // Handle item cleanups if any items were filtered out by RPC (e.g. marked completed)
                            for (const cleanup of itemsToCleanup) {
                                await db.order_items
                                    .where('order_id')
                                    .equals(cleanup.smartId)
                                    .filter(i => !cleanup.payloadItemIds.has(i.id))
                                    .modify({ item_status: 'completed' });
                            }

                            // ✅ USE MERGED DATA
                            ordersData = mergedOrders;

                            // ✅ USE MERGED DATA (local pending + server confirmed)
                            ordersData = mergedOrders;

                            const realCount = await db.orders.count();
                            const sampleOrders = await db.orders.limit(3).toArray();
                            console.log(`💾 [KDS→Dexie] Attempted to cache ${ordersData.length} orders. ACTUAL DB COUNT: ${realCount}`);
                            console.log(`💾 [KDS→Dexie] Sample IDs in Dexie: ${sampleOrders.map(o => o.id).join(', ')}`);
                        } catch (cacheErr) {
                            console.error('❌ Failed to cache orders to Dexie:', cacheErr);
                        }

                        // 2.5 Cache Menu Items (Throttled: Every 5 minutes)
                        if (Date.now() - lastMenuUpdateRef.current > 5 * 60 * 1000) {
                            try {
                                const { data: menuItemsData } = await supabase.from('menu_items')
                                    .select('id, name, price, kds_routing_logic, is_prep_required, category');
                                if (menuItemsData) {
                                    await db.menu_items.clear(); // Refresh cache
                                    await db.menu_items.bulkPut(menuItemsData);
                                    lastMenuUpdateRef.current = Date.now();
                                    // Update local ref as well
                                    menuMapRef.current = new Map(menuItemsData.map(m => [m.id, m]));
                                }
                            } catch (e) { console.warn('Menu cache failed:', e); }
                        }

                        // 3. CLEANUP: Find orders in Dexie that ARE active locally but NOT in Supabase active list
                        if (ordersData.length > 0) {
                            const staleOrders = await db.orders
                                .where('order_status')
                                .anyOf(['new', 'in_progress', 'ready', 'pending', 'prep_started', 'held'])
                                .filter(o => {
                                    // CRITICAL FIX: Staged orders (UUID-stage-X) MUST NOT be cleaned if parent is active
                                    const baseId = String(o.id).replace(/-stage-\d+/, '').replace(/-ready$/, '');

                                    return !activeServerOrderIds.has(o.id) && // Strict check
                                        !activeServerOrderIds.has(String(o.id)) && // Loose check
                                        !activeServerOrderIds.has(Number(o.id)) && // Loose check
                                        !activeServerOrderIds.has(baseId) && // CHECK PARENT/BASE ID
                                        !o.pending_sync &&
                                        !String(o.id).startsWith('L');
                                })
                                .toArray();

                            for (const stale of staleOrders) {
                                console.log(`🧹 Cleaning up stale order ${stale.order_number || stale.id} in Dexie (ID: ${stale.id})`);
                                await db.orders.update(stale.id, { order_status: 'completed', pending_sync: false, _useLocalStatus: false });
                                await db.order_items.where('order_id').equals(stale.id).modify({ item_status: 'completed', pending_sync: false });
                            }
                        }

                        // 4. GARBAGE COLLECTION: Delete orders older than 3 days to keep database tiny
                        const lastGC = localStorage.getItem('kds_last_gc');
                        if (!lastGC || Date.now() - parseInt(lastGC) > 10 * 60 * 1000) { // Every 10 mins
                            const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
                            const deletedCount = await db.orders.where('created_at').below(threeDaysAgo).delete();
                            if (deletedCount > 0) {
                                console.log(`♻️ Garbage Collection: Deleted ${deletedCount} orders older than 3 days from Dexie`);
                                await db.order_items.where('created_at').below(threeDaysAgo).delete();
                            }
                            localStorage.setItem('kds_last_gc', Date.now().toString());
                        }

                        console.log(`💾 Synced Dexie cache with ${ordersData.length} active orders`);
                    } catch (cacheErr) {
                        console.warn('Failed to cache orders to Dexie:', cacheErr);
                    }
                } catch (err) {
                    console.warn('Supabase fetch failed, continuing with local data:', err?.message);
                    supabaseFailed = true;
                }
            } // End of isOnline block

            // 🚀 STEP 3: [SYNC] Background sync and cleanup
            if (!supabaseFailed && isOnline) {

                // 🔋 LITE MODE OPTIMIZATION: Skip heavy supplemental fetches
                if (isLiteMode) {
                    log('🐌 Lite Mode: Skipping supplemental items/rescue fetches');
                } else {
                    // WORKAROUND REMOVED: The RPC already includes all non-cancelled items.
                    // Redundant fetch was causing URI length limits / "Network connection lost" errors.
                    /*
                    if (ordersData && ordersData.length > 0) {
                        ...
                    }
                    */

                    // ⚠️ SAFETY NET: Fetch orders that have ANY active items, regardless of order_status.
                    // This ensures orders with new items added (even if previously completed) show up!
                    try {
                        // Look back 12 hours to catch any revived orders from the current shift
                        const lookbackTime = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();

                        // Fetch orders with active items (in_progress, new, pending, ready)
                        const { data: rescueOrders } = await supabase
                            .from('orders')
                            .select('*, order_items!inner(id, item_status, is_early_delivered, mods, notes, course_stage, quantity, menu_items!inner(name, price, kds_routing_logic, is_prep_required))')
                            .gt('updated_at', lookbackTime)
                            .in('order_items.item_status', ['in_progress', 'new', 'pending', 'ready'])
                            .eq('business_id', businessId)
                            .abortSignal(signal);

                        if (rescueOrders && rescueOrders.length > 0) {
                            console.log(`🛟 Rescued ${rescueOrders.length} orders with active items`);

                            // Merge rescued orders into main list if not already present
                            rescueOrders.forEach(rescueOrder => {
                                const existingIndex = ordersData.findIndex(o => o.id === rescueOrder.id);
                                if (existingIndex === -1) {
                                    // Not in list - add it
                                    ordersData.push(rescueOrder);
                                } else {
                                    // Already in list - merge items that might be missing
                                    const existing = ordersData[existingIndex];
                                    rescueOrder.order_items.forEach(ri => {
                                        if (!existing.order_items.some(oi => oi.id === ri.id)) {
                                            existing.order_items.push(ri);
                                        }
                                    });
                                }
                            });
                        }
                    } catch (rescueErr) {
                        console.warn('Rescue query failed (non-critical):', rescueErr);
                    }
                }

                // 🔌 OFFLINE ORDERS: Merge local Dexie orders that haven't been synced yet
                try {
                    const { db } = await import('@/db/database');
                    // 📅 DATE LIMIT: Only consider orders from today's anchor (5:00 AM)
                    const anchor = new Date();
                    anchor.setHours(5, 0, 0, 0);
                    if (new Date() < anchor) anchor.setDate(anchor.getDate() - 1);
                    const anchorISO = anchor.toISOString();

                    // 🧹 AGGRESSIVE KDS CLEANUP: Moved to App.jsx for better lifecycle management
                    /*
                    const cleanLookbackHours = isLiteMode ? 12 : 24;
                    const cleanDate = new Date(Date.now() - cleanLookbackHours * 60 * 60 * 1000).toISOString();
                    */

                    /*
                    if (!isLiteMode || Math.random() < 0.2) {
                        const oldCompleted = await db.orders
                            .where('updated_at')
                            .below(cleanDate)
                            .filter(o => ['completed', 'cancelled'].includes(o.order_status) && !o.pending_sync)
                            .primaryKeys();
    
                        if (oldCompleted.length > 0) {
                            log(`🧹 KDS Purge: Removing ${oldCompleted.length} old completed orders from local device`);
                            await db.orders.bulkDelete(oldCompleted);
                            await db.order_items.where('order_id').anyOf(oldCompleted).delete();
                        }
                    }
                    */

                    // Get local orders using INDEXES where possible for speed
                    const localOrders = await db.orders
                        .where('order_status')
                        .anyOf(['in_progress', 'ready', 'new', 'pending'])
                        .filter(o => {
                            // 1. Business ID Check
                            if (businessId && String(o.business_id) !== String(businessId)) return false;

                            // 2. DATE CHECK: Removed for active orders to allow clearing zombie orders
                            // const orderDate = o.created_at || o.updated_at;
                            // if (orderDate && orderDate < anchorISO) return false;

                            // 3. Sync Status Check - take if NOT yet synced OR has pending local update
                            const isPending = o.pending_sync === true || o.is_offline === true;

                            // Allow orders with server ID if they have a pending local update
                            // This is critical for "Undo Ready" stability!
                            return isPending && !o._processing;
                        })
                        .toArray();

                    if (localOrders.length > 0) log(`📴 [KDS] Loaded ${localOrders.length} local orders for display`);

                    if (localOrders && localOrders.length > 0) {
                        // Get items for these orders
                        const localOrderIds = localOrders.map(o => o.id);
                        const localItems = await db.order_items
                            .filter(item => localOrderIds.includes(item.order_id))
                            .toArray();

                        // Get menu item names
                        const menuItemIds = [...new Set(localItems.map(i => i.menu_item_id))];
                        const menuItems = await db.menu_items
                            .where('id')
                            .anyOf(menuItemIds)
                            .toArray();
                        const menuMap = new Map(menuItems.map(m => [m.id, m]));

                        console.log(`📴 [KDS] Mapping ${localItems.length} items for ${localOrders.length} pending orders`);

                        // Build order objects in the same format as Supabase
                        localOrders.forEach(localOrder => {
                            console.log(`🔍 [OFFLINE-CHECK] Checking ${localOrder.order_number}:`, {
                                localId: String(localOrder.id).slice(0, 8),
                                localStatus: localOrder.order_status,
                                hasPendingSync: localOrder.pending_sync
                            });

                            // IMPROVED MATCHING: Check ID and ServerOrderId against everything in ordersData
                            const existingIdx = ordersData?.findIndex(o => {
                                const idMatch = String(o.id) === String(localOrder.id);
                                const serverIdMatch = localOrder.serverOrderId && String(o.id) === String(localOrder.serverOrderId);
                                const numberMatch = o.order_number &&
                                    localOrder.order_number &&
                                    String(o.order_number) === String(localOrder.order_number) &&
                                    !String(localOrder.order_number).startsWith('L');
                                return idMatch || serverIdMatch || numberMatch;
                            }) ?? -1;

                            if (existingIdx !== -1) {
                                const existing = ordersData[existingIdx];

                                console.log(`🎯 [MATCH] Found in ordersData:`, {
                                    existingStatus: existing.order_status,
                                    existingHasFlag: !!existing._useLocalStatus,
                                    matchIndex: existingIdx
                                });

                                // ✅ DOUBLE SAFETY NET: Check if existing version has correct local status
                                if (existing.order_status === 'completed' && localOrder.order_status === 'ready') {
                                    console.log(`🛡️ [MERGE-SHIELD] Preventing server-merger from reverting 'completed' back to 'ready' for ${localOrder.order_number}`);
                                    return;
                                }

                                // Case 0: Server caught up! Clear local dirty flags proactively.
                                if (localOrder.pending_sync && existing.order_status === localOrder.order_status) {
                                    console.log(`✨ [SYNC-CONFIRMED] Server caught up for ${localOrder.order_number} (${existing.order_status}). Cleaning Dexie flags.`);
                                    db.orders.update(localOrder.id, { pending_sync: false, _useLocalStatus: false });
                                    return;
                                }

                                // Case 1: Already merged correctly (has _useLocalStatus or pending_sync flag)
                                if (existing._useLocalStatus || (existing.pending_sync && existing.order_status === localOrder.order_status)) {
                                    console.log(`✅ [OFFLINE-SKIP] Already has _useLocalStatus flag or matches status`);
                                    return;
                                }

                                // 🟢 FORCE OVERRIDE if local is 'in_progress' (Undo case safety net)
                                // Even if pending_sync was cleared, if we have a local in_progress copy, we show it!
                                if (localOrder.order_status === 'in_progress') {
                                    console.log(`🔄 [OFFLINE-FORCE] Enforcing local in_progress for ${localOrder.order_number}`);
                                    ordersData[existingIdx] = {
                                        ...existing,
                                        order_status: 'in_progress',
                                        updated_at: localOrder.updated_at,
                                        _useLocalStatus: true,
                                        pending_sync: localOrder.pending_sync // Preserve actual sync state
                                    };
                                    return;
                                }

                                // Case 2: Existing has pending_sync BUT wrong status
                                if (existing.pending_sync && existing.order_status !== localOrder.order_status) {
                                    console.warn(`⚠️ Conflicting pending_sync statuses detected for ${localOrder.order_number} - using local Dexie version`);
                                }

                                // Case 3: Local has pending_sync but existing doesn't (or has wrong status) - OVERRIDE!
                                if (localOrder.pending_sync && !existing._useLocalStatus) {
                                    console.log(`🔄 [OFFLINE-OVERRIDE] Overriding server status: ${existing.order_status} → ${localOrder.order_status}`);

                                    // ✅ SIMPLE FIX: Keep server data (especially items with full menu_items!), just override status
                                    // We DO NOT reconstruct items from local Dexie data because Dexie might lack the full joined menu_items object,
                                    // causing filters downstream to drop the items as "invalid".
                                    ordersData[existingIdx] = {
                                        ...existing,  // Keep everything from server (including items with menu_items!)
                                        order_status: localOrder.order_status,  // Override status
                                        customer_name: localOrder.customer_name, // Override customer info if local is newer/pending
                                        customer_phone: localOrder.customer_phone,
                                        updated_at: localOrder.updated_at,
                                        pending_sync: true,
                                        _useLocalStatus: true
                                        // We intentionally leave order_items alone so they retain their server attributes
                                    };

                                    return; // Overridden successfully
                                }

                                // Case 4: No conflict - it's truly a duplicate, skip
                                console.log(`⏭️ [OFFLINE-SKIP] No override needed`);
                                return;
                            }

                            // If we reached here, order is NOT in ordersData - add it
                            const orderItems = localItems
                                .filter(i => String(i.order_id) === String(localOrder.id))
                                .map(item => {
                                    const menuItem = menuMap.get(item.menu_item_id);
                                    const name = menuItem?.name || item.name || 'פריט חדש';
                                    const price = item.price || menuItem?.price || 0;

                                    return {
                                        id: item.id,
                                        mods: item.mods || [],
                                        notes: item.notes,
                                        item_status: item.item_status,
                                        is_early_delivered: !!item.is_early_delivered, // 🔥 PRESERVE FLAG
                                        course_stage: item.course_stage || 1,
                                        quantity: item.quantity,
                                        order_id: item.order_id,
                                        menu_items: {
                                            name: name,
                                            price: price,
                                            kds_routing_logic: menuItem?.kds_routing_logic || 'MADE_TO_ORDER',
                                            is_prep_required: menuItem?.is_prep_required !== false
                                        }
                                    };
                                });

                            const formattedLocalOrder = {
                                id: localOrder.id,
                                order_number: localOrder.order_number,
                                order_status: localOrder.order_status,
                                is_paid: localOrder.is_paid,
                                customer_name: localOrder.customer_name,
                                customer_phone: localOrder.customer_phone,
                                total_amount: localOrder.total_amount,
                                created_at: localOrder.created_at || new Date().toISOString(),
                                updated_at: localOrder.updated_at || new Date().toISOString(),
                                ready_at: localOrder.ready_at,
                                business_id: localOrder.business_id,
                                is_offline: !!localOrder.is_offline,
                                pending_sync: !!localOrder.pending_sync,
                                _useLocalStatus: !!localOrder._useLocalStatus,  // Preserve, don't force!
                                order_items: orderItems
                            };

                            if (!ordersData) ordersData = [];
                            ordersData.push(formattedLocalOrder);
                        });

                        console.log(`✅ Merged ${localOrders.length} offline orders into KDS`);
                    }
                } catch (offlineErr) {
                    console.warn('Failed to load offline orders:', offlineErr);
                }
            } // END of if (!supabaseFailed)

            // NOTE: Completed orders are NOT fetched for active KDS.
            // They belong only in History tab and are fetched separately when viewing history.

            // 🚀 FINAL STEP: PROCESS AND UPDATE UI (Final Server Data)
            processAndSetUI(ordersData, null);

        } catch (err) {
            // Only stop loading if we actually started it
            setIsLoading(false);
            if (err.name === 'AbortError') return;
            error('Fetch error:', err);
        }
    }, [currentUser, isLiteMode]);






    const updateOrderStatus = async (orderId, currentStatus) => {
        const businessId = currentUser?.business_id;
        log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        log('🔄 [STATUS-UPDATE] START', new Date().toISOString());
        log('📋 Input:', { orderId, currentStatus, online: navigator.onLine });
        log('📊 Current State BEFORE:', {
            currentOrdersCount: currentOrders.length,
            completedOrdersCount: completedOrders.length,
            currentOrderIds: currentOrders.map(o => o.id).slice(0, 5),
            completedOrderIds: completedOrders.map(o => o.id).slice(0, 5)
        });


        // Note: statusLower is defined after order lookup to use effectiveStatus

        // CRITICAL FIX: Default should be null to catch unexpected states
        let nextStatus = null;

        // Search for the order in both lists to ensure we have its data
        const order = currentOrders.find(o => o.id === orderId) || completedOrders.find(o => o.id === orderId);

        // CRITICAL FIX: If currentStatus is undefined, use the order's actual status!
        const effectiveStatus = currentStatus || order?.status || order?.orderStatus;
        const statusLower = (effectiveStatus || '').toLowerCase();

        const hasInProgress = order?.items?.some(i => i.status === 'in_progress' || i.status === 'new' || !i.status);

        // STATUS TRANSITION LOGIC - follows lifecycle: pending → new → in_progress → ready → completed
        if (currentStatus === 'undo_ready') {
            // UNDO: Move back to in_progress
            nextStatus = 'in_progress';
        } else if (statusLower === 'shipped') {
            // SHIPPED -> COMPLETED (delivery completed)
            nextStatus = 'completed';
        } else if (statusLower === 'completed') {
            // ALREADY COMPLETED -> User manually archives unpaid completed order
            nextStatus = 'archived';
        } else if (statusLower === 'ready') {
            // READY -> Next step depends on order type
            // 🛡️ MODIFICATION: Only move to 'completed' if the action came from a card that was ALREADY 'ready'.
            // This prevents an 'in_progress' card from skipping 'ready' and going straight to 'completed'.
            if (currentStatus === 'ready' || order?.status === 'ready') {
                if (order?.type === 'delivery' || order?.order_type === 'delivery') {
                    nextStatus = 'shipped';
                } else {
                    nextStatus = 'completed';
                }
            } else {
                nextStatus = 'ready';
            }
        } else if (statusLower === 'in_progress') {
            // IN_PROGRESS -> READY
            nextStatus = 'ready';
        } else if (statusLower === 'new') {
            // NEW -> IN_PROGRESS (start preparation)
            nextStatus = 'in_progress';
        } else if (statusLower === 'pending') {
            // PENDING -> NEW (acknowledge order)
            nextStatus = 'new';
        } else if (hasInProgress) {
            // Fallback: If order has in_progress items, move to ready
            nextStatus = 'ready';
        } else {
            // SAFETY FALLBACK: Log error and use current status
            console.error(`⚠️ [STATUS-UPDATE] Unexpected status: "${effectiveStatus}". Defaulting to in_progress.`);
            nextStatus = 'in_progress';
        }

        log('🎯 [STATUS] Transition:', effectiveStatus, '→', nextStatus, '| Order:', orderId?.slice(-8));

        const smartOrderId = getSmartId(orderId);

        // ANTI-FLICKER: Record update immediately
        recentLocalUpdatesRef.current.set(smartOrderId, { status: nextStatus, timestamp: Date.now() });
        if (orderId !== smartOrderId) {
            recentLocalUpdatesRef.current.set(orderId, { status: nextStatus, timestamp: Date.now() });
        }

        // Helper to check if ID is likely a valid UUID
        const isUUID = (id) => typeof id === 'string' && id.length > 20 && id.includes('-');

        // CRITICAL FIX: Treat numeric IDs or short IDs as Local Only to prevent Supabase errors
        const isLocalOnly = String(orderId).startsWith('L') ||
            order?.is_offline ||
            String(orderId).length < 20 || // FORCE SAFEGUARD: Short IDs are ALWAYS local
            !isUUID(orderId);

        // 2. OFFLINE HANDLING (or Local Only)
        // We force this path if it's a local order that hasn't synced yet, even if we are online now
        if (!navigator.onLine || isLocalOnly) {
            console.log(`📴 Handling status update locally (Offline: ${!navigator.onLine}, Next: ${nextStatus}, Action: ${currentStatus})`);
            try {
                // db is imported at top level
                const { queueAction } = await import('@/services/offlineQueue');

                let itemStatus = nextStatus === 'completed' ? 'completed' :
                    nextStatus === 'ready' ? 'ready' : 'in_progress';

                // Specific override for UNDO action
                if (currentStatus === 'undo_ready') {
                    nextStatus = 'in_progress';
                    itemStatus = 'in_progress';
                }

                console.log(`📴 Marking local order ${smartOrderId} as ${nextStatus}`);

                // Update local order
                const updateFields = {
                    order_status: nextStatus,
                    updated_at: new Date().toISOString(),
                    pending_sync: true
                };
                if (nextStatus === 'ready') updateFields.ready_at = new Date().toISOString();

                await db.orders.update(smartOrderId, updateFields);

                // Update local items
                const itemStatusForItems = nextStatus === 'completed' ? 'completed' :
                    nextStatus === 'ready' ? 'ready' : 'in_progress';
                const shouldResetEarlyMarks = ['ready', 'completed', 'shipped'].includes(nextStatus);

                await db.order_items
                    .where('order_id')
                    .equals(smartOrderId)
                    .modify(it => {
                        // 🍫 SHOKO PROTECTION: NEVER overwrite a 'held' status during an order-level status change.
                        if (it.item_status !== 'held') {
                            it.item_status = itemStatusForItems;
                        }
                        if (shouldResetEarlyMarks) it.is_early_delivered = false;
                        it.updated_at = new Date().toISOString();
                    });

                // ALWAYS queue status updates
                await queueAction('UPDATE_ORDER_STATUS', {
                    orderId: smartOrderId,
                    localOrderId: isLocalOnly ? smartOrderId : null,
                    newStatus: nextStatus,
                    isLocalOrder: isLocalOnly
                });

                if (nextStatus === 'ready' && order?.customer_phone && navigator.onLine) {
                    fireAndForgetSms(orderId, order.customer_phone, order.customer_name);
                }

                console.log(`✅ Local update complete for ${smartOrderId} -> ${nextStatus}`);

                // 🛡️ SMART OPTIMISTIC UI:
                if (nextStatus === 'completed') {
                    fetchOrders(false, null, true);
                } else if (nextStatus === 'ready') {
                    fetchOrders(false, null, true);
                }

                // Background silent refresh
                fetchOrders(false, null, true);

                return;
            } catch (offlineErr) {
                console.error('❌ Local order update failed:', offlineErr);
                setErrorModal({
                    show: true,
                    title: 'שגיאה בעדכון',
                    message: 'לא הצלחתי לעדכן את ההזמנה מקומית',
                    details: offlineErr.message,
                    retryLabel: 'נסה שוב',
                    onRetry: () => updateOrderStatus(orderId, currentStatus)
                });
                return;
            }
        }

        // 3. ONLINE HANDLING
        try {
            const realOrderId = typeof orderId === 'string'
                ? orderId.replace(/-stage-\d+/, '').replace('-ready', '').replace('-delayed', '').replace('-new', '')
                : orderId;
            const smartId = getSmartId(orderId);
            const now = new Date().toISOString();

            // 📸 STEP 1: SNAPSHOT (For Rollback)
            const currentOrdersSnapshot = [...currentOrders];
            const completedOrdersSnapshot = [...completedOrders];

            const orderToMove = currentOrders.find(o => o.id === orderId || o.originalOrderId === orderId) ||
                completedOrders.find(o => o.id === orderId || o.originalOrderId === orderId);

            // 🔍 DETECT PARTIAL UPDATE: Check if other cards for this order exist in the current view
            const otherActiveCards = currentOrders.filter(o =>
                (o.serverOrderId === realOrderId || o.id === realOrderId) && o.id !== orderId
            );
            const isPartialCard = otherActiveCards.length > 0 || String(orderId) !== String(realOrderId);
            const cardItemIds = orderToMove?.items?.flatMap(i => i.ids || [i.id]) || [];

            log('📋 [UPDATE-DEBUG]', {
                orderId,
                realOrderId,
                isPartialCard,
                otherActiveCardsCount: otherActiveCards.length,
                cardItemIdsCount: cardItemIds.length,
                nextStatus
            });

            log('📋 [ATOMIC-MODE] Dexie will update ONLY after server confirmation.');

            // 🎯 ATOMIC PERSISTENCE: Dexie update function — called AFTER server confirms
            const applyDexieUpdate = async () => {
                try {
                    // Update global order status if it's NOT a partial card
                    if (!isPartialCard) {
                        const updateFields = {
                            order_status: nextStatus,
                            updated_at: now,
                            pending_sync: false  // Already confirmed by server
                        };
                        if (nextStatus === 'ready') updateFields.ready_at = now;
                        await db.orders.update(smartId, updateFields);
                        log(`💾 [DEXIE-ATOMIC] Updated Order ${smartId} to ${nextStatus}`);
                    }

                    const itemStatus = nextStatus === 'completed' ? 'completed' :
                        nextStatus === 'ready' ? 'ready' :
                            nextStatus === 'new' ? 'new' : 'in_progress';

                    const shouldResetEarlyMarks = ['ready', 'completed', 'shipped'].includes(nextStatus);

                    const itemQuery = isPartialCard
                        ? db.order_items.where('id').anyOf(cardItemIds)
                        : db.order_items.where('order_id').equals(smartId);

                    await itemQuery.modify(it => {
                        // 🍫 Protection for held items
                        if (it.item_status !== 'held') {
                            it.item_status = itemStatus;
                        }
                        if (shouldResetEarlyMarks) it.is_early_delivered = false;
                        it.updated_at = now;
                    });
                    log(`💾 [DEXIE-ATOMIC] Updated ${isPartialCard ? 'PARTIAL' : 'FULL'} items to ${itemStatus}`);
                } catch (e) {
                    console.warn('Dexie background update failed:', e);
                }
            };
            // ⛔ NOT calling applyDexieUpdate() here — it runs AFTER server success below

            // 🌐 STEP 4: SUPABASE UPDATE
            try {
                let rpcData, rpcError;

                if (isPartialCard && ['ready', 'completed', 'in_progress', 'undo_ready'].includes(nextStatus || currentStatus)) {
                    log(`🌐 [SUPABASE] Partial Card Update (${nextStatus}) for ${cardItemIds.length} items`);

                    if (nextStatus === 'ready') {
                        ({ data: rpcData, error: rpcError } = await supabase.rpc('mark_items_ready_v2', {
                            p_order_id: realOrderId,
                            p_item_ids: cardItemIds
                        }));
                    } else if (nextStatus === 'completed') {
                        ({ data: rpcData, error: rpcError } = await supabase.rpc('complete_order_part_v2', {
                            p_order_id: realOrderId,
                            p_item_ids: cardItemIds,
                            p_keep_order_open: true
                        }));
                    } else {
                        // Reversion / Fire
                        ({ data: rpcData, error: rpcError } = await supabase.rpc('fire_items_v2', {
                            p_order_id: realOrderId,
                            p_item_ids: cardItemIds
                        }));
                    }
                } else {
                    // FULL ORDER UPDATE
                    const rpcParams = {
                        p_order_id: realOrderId,
                        p_new_status: nextStatus,
                        p_business_id: businessId
                    };

                    // Specific tweaks for certain transitions
                    if (nextStatus === 'new') {
                        rpcParams.p_item_status = 'new';
                    } else if (currentStatus === 'undo_ready' || nextStatus === 'in_progress') {
                        rpcParams.p_item_status = 'in_progress';
                    }

                    log('🌐 [SUPABASE] Calling update_order_status_v3', rpcParams);
                    ({ data: rpcData, error: rpcError } = await supabase.rpc('update_order_status_v3', rpcParams));
                }

                if (rpcError || (rpcData && rpcData.success === false)) {
                    const failMsg = rpcError?.message || rpcData?.error || 'Unknown database rejection';
                    console.warn('⚠️ Supabase RPC reported error, verifying if update actually took effect...', failMsg);

                    // Wait 1.5s for DB to settle and sync to catch up
                    await new Promise(r => setTimeout(r, 1500));

                    // Re-fetch this specific order from Supabase to check actual state
                    const { data: verifyData } = await supabase
                        .from('orders')
                        .select('order_status')
                        .eq('id', smartId)
                        .single();

                    if (verifyData && verifyData.order_status === nextStatus) {
                        log('✅ Verification success: Server actually updated despite RPC error reporting.');
                    } else {
                        console.error('🚨 DATABASE UPDATE FAILED after verification:', failMsg);
                        throw rpcError || new Error(failMsg);
                    }
                }

                if (nextStatus === 'ready' && orderToMove?.customer_phone) {
                    fireAndForgetSms(orderId, orderToMove.customer_phone, orderToMove.customer_name);
                }

                log('✅ [SERVER] Supabase update confirmed:', rpcData);

                // 🎯 [ATOMIC PERSISTENCE] Now that server confirmed, write to Dexie
                await applyDexieUpdate();
                log(`💾 [DEXIE-ATOMIC] Dexie updated AFTER server confirmation for ${smartId}`);

                // 🎯 STEP 3: PESSIMISTIC UI UPDATE
                if (orderToMove) {
                    log(`🎯 [UI-UPDATE] Applying pessimistic update for card ${orderId} -> ${nextStatus}`);
                    // Determine target stable ID (active orders use base UUID, others use suffix)
                    const targetId = nextStatus === 'in_progress' ? smartId : (nextStatus === 'ready' ? `${smartId}-ready` : orderId);

                    if (nextStatus === 'completed') {
                        // 🛡️ [STABILITY FIX] ONLY remove the specific card updated (orderId).
                        // DO NOT remove all cards with serverOrderId (smartId) as that breaks split cards!
                        fetchOrders(false, null, true);
                        setCompletedOrders(prev => prev.filter(o => o.id !== orderId));
                        log(`🗑️ [UI] Removed card ${orderId} from view (Moved to history/completed)`);
                    } else if (nextStatus === 'ready') {
                        // For ready, we ONLY move the specific card being updated.
                        fetchOrders(false, null, true);
                        setCompletedOrders(prev => {
                            const newList = prev.filter(o => o.id !== targetId);
                            newList.push({
                                ...orderToMove,
                                id: targetId,
                                orderStatus: 'ready',
                                type: 'ready',
                                ready_at: now,
                                items: orderToMove.items?.map(i => ({ ...i, status: 'ready', item_status: 'ready' }))
                            });
                            return newList;
                        });
                        log(`📦 [UI] Moved card ${orderId} to READY list as ${targetId}`);
                    } else if (nextStatus === 'in_progress') {
                        setCompletedOrders(prev => prev.filter(o => o.id !== orderId));
                        setCurrentOrders(prev => {
                            const newOrder = {
                                ...orderToMove,
                                id: targetId,
                                orderStatus: 'in_progress',
                                type: 'active',
                                items: orderToMove.items?.map(i => ({ ...i, status: 'in_progress', item_status: 'in_progress' }))
                            };
                            const filtered = prev.filter(o => o.id !== targetId);
                            const orderTime = new Date(orderToMove.created_at || 0).getTime();
                            let idx = filtered.findIndex(o => new Date(o.created_at || 0).getTime() > orderTime);
                            if (idx === -1) idx = filtered.length;
                            return [...filtered.slice(0, idx), newOrder, ...filtered.slice(idx)];
                        });
                        log(`🔥 [UI] Moved card ${orderId} to ACTIVE list as ${targetId}`);
                    }
                    setLastUpdated(new Date());
                    // 🛡️ INCREASED COOLDOWN: Let local state "soak" for 5 seconds
                    // This prevents background sync from clearing the undid order
                    // before the server has fully caught up.
                    skipFetchUntilRef.current = Date.now() + 5000;
                }

                // ✅ Reset early delivered marks on Supabase if order moved to ready/completed
                if (['ready', 'completed', 'shipped'].includes(nextStatus)) {
                    supabase.from('order_items')
                        .update({ is_early_delivered: false })
                        .eq('order_id', realOrderId)
                        .then(() => log('🧹 [SERVER] Cleared early marks for', realOrderId));
                }

                // 🎯 FINAL RECONCILIATION: Silent background refresh
                fetchOrders(false, null, true);

            } catch (supabaseErr) {
                console.error('❌ Supabase update failed:', supabaseErr);
                const errorDetails = supabaseErr?.message || JSON.stringify(supabaseErr);
                console.error('📋 Exact Error Details:', errorDetails);

                setErrorModal({
                    show: true,
                    title: 'שגיאה בעדכון',
                    message: 'העדכון בשרת נכשל. נסה שוב.',
                    details: errorDetails,
                    retryLabel: 'נסה שוב',
                    onRetry: () => updateOrderStatus(orderId, currentStatus)
                });
            }
        } catch (globalErr) {
            console.error('❌ Global error in updateOrderStatus:', globalErr);
        }
    };

    const handleFireItems = async (orderId, itemsToFire) => {
        try {
            const itemIds = itemsToFire.map(i => i.id);
            const smartOrderId = getSmartId(orderId);
            const now = new Date().toISOString();

            // 💾 DEXIE FIRST: Mark items as in_progress immediately
            try {
                const { db } = await import('@/db/database');
                await db.order_items.where('id').anyOf(itemIds).modify({
                    item_status: 'in_progress',
                    updated_at: now
                });
                log(`💾 [DEXIE] Fired ${itemIds.length} items locally`);
            } catch (e) { console.warn('Dexie fire update failed:', e); }

            setIsLoading(true);

            // FIX: Extract clean UUID if it's a composite ID (e.g. "uuid-delayed")
            const cleanOrderId = (typeof orderId === 'string' && orderId.length > 36)
                ? orderId.replace('-delayed', '').replace('-stage-1', '').replace('-stage-2', '')
                : orderId;

            const { error } = await supabase.rpc('fire_items_v2', {
                p_order_id: cleanOrderId,
                p_item_ids: itemIds
            });

            if (error) throw error;

            // Background refresh (silent)
            await fetchOrders(false, null, true);
        } catch (err) {
            console.error('Error firing items:', err);
            setErrorModal({
                show: true,
                title: 'שגיאה בהפעלת פריטים',
                message: 'לא הצלחנו לעדכן את סטטוס הפריטים',
                details: err.message,
                retryLabel: 'נסה שוב',
                onRetry: () => handleFireItems(orderId, itemsToFire)
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleReadyItems = async (orderId, itemsToReady) => {
        try {
            const itemIds = itemsToReady.map(i => i.id);
            const smartOrderId = getSmartId(orderId);
            const now = new Date().toISOString();

            // 🚀 OPTIMISTIC UI UPDATE: Update UI immediately before server call
            const updateItemsInList = (list) => list.map(order => {
                if (order.id !== orderId) return order;
                return {
                    ...order,
                    items: order.items?.map(item => {
                        const ids = item.ids || [item.id];
                        if (itemIds.some(id => ids.includes(id))) {
                            return { ...item, item_status: 'ready' };
                        }
                        return item;
                    })
                };
            });
            setCurrentOrders(prev => updateItemsInList(prev));
            log(`🚀 [OPTIMISTIC] Marked ${itemIds.length} items as READY in UI`);

            // 💾 DEXIE: Mark items as ready locally
            try {
                const { db } = await import('@/db/database');
                await db.order_items.where('id').anyOf(itemIds).modify({
                    item_status: 'ready',
                    updated_at: now
                });
                log(`💾 [DEXIE] Mark ${itemIds.length} items as READY locally`);
            } catch (e) { console.warn('Dexie ready items update failed:', e); }

            // 🌐 SUPABASE: Send to server (no loading spinner - already updated)
            const { error } = await supabase.rpc('mark_items_ready_v2', {
                p_order_id: orderId,
                p_item_ids: itemIds
            });

            if (error) throw error;
            // Soft refresh in background (won't cause flicker due to anti-jump)
            fetchOrders(false, null, true);
        } catch (err) {
            console.error('Error marking items ready:', err);
            setErrorModal({
                show: true,
                title: 'שגיאה בהעברה למוכן',
                message: 'לא הצלחנו לעדכן את סטטוס הפריטים',
                details: err.message,
                retryLabel: 'נסה שוב',
                onRetry: () => handleReadyItems(orderId, itemsToReady)
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggleEarlyDelivered = async (orderId, itemId, currentValue) => {
        try {
            const newValue = !currentValue;
            log(`🔄 [TOGGLE-EARLY] Item ${itemId}: ${currentValue} -> ${newValue}`);

            // 1. Optimistic UI update
            const updateItemInList = (list) => list.map(order => ({
                ...order,
                items: order.items?.map(item => {
                    const ids = item.ids || [item.id];
                    if (ids.includes(itemId)) {
                        return { ...item, is_early_delivered: newValue };
                    }
                    return item;
                })
            }));

            setCurrentOrders(prev => updateItemInList(prev));

            // 2. Supabase Update
            const { error } = await supabase.rpc('toggle_early_delivered', {
                p_item_id: itemId,
                p_value: newValue
            });

            if (error) {
                // Revert state on error
                const revertItemInList = (list) => list.map(order => ({
                    ...order,
                    items: order.items?.map(item => {
                        const ids = item.ids || [item.id];
                        if (ids.includes(itemId)) {
                            return { ...item, is_early_delivered: currentValue };
                        }
                        return item;
                    })
                }));
                setCurrentOrders(prev => revertItemInList(prev));
                throw error;
            }

            // 3. Dexie Update
            await db.order_items.update(itemId, { is_early_delivered: newValue });

            log('✅ [TOGGLE-EARLY] Success');
            return true;
        } catch (err) {
            console.error('❌ [TOGGLE-EARLY] Error:', err);
            return false;
        }
    };

    const handleUndoLastAction = async () => {
        if (!lastAction) return;
        setIsLoading(true);
        try {
            // Targeted Undo using specific Item IDs
            if (lastAction.itemIds && lastAction.itemIds.length > 0) {
                console.log('↺ Targeted Undo:', lastAction);

                if (lastAction.previousStatus === 'ready') {
                    // Revert from Completed -> Ready
                    // Retrieve realOrderId from stored orderId (which implies stripping suffix if present, though lastAction.orderId should be clean usually)
                    // But safe to clean again just in case
                    const realOrderId = typeof lastAction.orderId === 'string'
                        ? lastAction.orderId.replace(/-stage-\d+/, '').replace('-ready', '')
                        : lastAction.orderId;

                    // Determine keep_open. If returning to READY, usually keeps open if not fully fully archived. 
                    // Let's assume false or calculate? Since we can't easily calculating from here without full state, 
                    // Let's use false because Ready usually means "Done with kitchen".
                    // HOWEVER, if we have other active items, we might need true.
                    // Ideally we should know. But complete_order_part_v2 is forgiving.
                    const { error } = await supabase.rpc('complete_order_part_v2', {
                        p_order_id: String(realOrderId).trim(),
                        p_item_ids: lastAction.itemIds,
                        p_keep_order_open: true // Must keep open to show in Ready section
                    });
                    if (error) throw error;
                } else if (lastAction.previousStatus === 'in_progress') {
                    // Revert from Ready -> In Progress
                    const { error } = await supabase.rpc('fire_items_v2', {
                        p_order_id: lastAction.orderId,
                        p_item_ids: lastAction.itemIds
                    });
                    if (error) throw error;
                } else {
                    // Fallback for other statuses
                    const { error } = await supabase.rpc('update_order_status', {
                        p_order_id: lastAction.orderId,
                        p_status: lastAction.previousStatus
                    });
                    if (error) throw error;
                }
            } else {
                // Legacy / Fallback for whole order undo
                console.warn('⚠️ Legacy Undo (Whole Order) for:', lastAction.orderId);
                const { error } = await supabase.rpc('update_order_status', {
                    p_order_id: lastAction.orderId,
                    p_status: lastAction.previousStatus
                });
                if (error) throw error;
            }

            setLastAction(null);
            await fetchOrders();
        } catch (err) {
            console.error('Failed to undo:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleConfirmPayment = async (orderId, paymentMethod = 'cash') => {
        // Clean orderId - remove KDS suffixes like "-ready" or "-stage-2"
        let cleanOrderId = orderId;
        if (typeof orderId === 'string') {
            if (orderId.endsWith('-ready')) {
                cleanOrderId = orderId.replace(/-ready$/, '');
            }
            cleanOrderId = cleanOrderId.replace(/-stage-\d+$/, '');
        }

        // OFFLINE HANDLING: Update locally and queue for sync
        if (!navigator.onLine) {
            console.log('📴 Offline: Confirming payment locally');
            try {
                // db is imported at top level
                const { queueAction } = await import('@/services/offlineQueue');

                // Update local order
                await db.orders.update(cleanOrderId, {
                    is_paid: true,
                    payment_method: paymentMethod,
                    updated_at: new Date().toISOString()
                });

                // Queue for later sync
                await queueAction('CONFIRM_PAYMENT', {
                    orderId: cleanOrderId,
                    paymentMethod: paymentMethod
                });

                console.log(`✅ Payment confirmed locally: ${cleanOrderId} (${paymentMethod})`);

                await fetchOrders();
                return;
            } catch (offlineErr) {
                console.error('❌ Offline payment confirmation failed:', offlineErr);
                setErrorModal({
                    show: true,
                    title: 'שגיאה באישור תשלום',
                    message: 'לא הצלחתי לעדכן את התשלום מקומית',
                    details: offlineErr.message,
                    retryLabel: 'נסה שוב',
                    onRetry: () => handleConfirmPayment(orderId, paymentMethod)
                });
                throw offlineErr;
            }
        } // Removed extra try

        try {
            // Use RPC function to bypass RLS - now also passing payment_method
            const { data, error } = await supabase.rpc('confirm_order_payment', {
                p_order_id: cleanOrderId,
                p_payment_method: paymentMethod
            });

            if (error) throw error;

            // 🆕 Show Success Toast
            setSmsToast({ message: 'התשלום עודכן בהצלחה!', isError: false });
            setTimeout(() => setSmsToast(null), 3000);

            await fetchOrders();
        } catch (err) {
            console.error('❌ Error confirming payment:', err);
            setErrorModal({
                show: true,
                title: 'שגיאה באישור תשלום',
                message: 'לא הצלחנו לעדכן את התשלום במערכת',
                details: err.message,
                retryLabel: 'נסה שוב',
                onRetry: () => handleConfirmPayment(orderId, paymentMethod)
            });
            throw err;
        }
    };

    const handleCancelOrder = async (orderId) => {
        try {
            // Clean orderId - remove KDS suffixes
            let cleanOrderId = orderId;
            if (typeof orderId === 'string') {
                if (orderId.endsWith('-ready')) {
                    cleanOrderId = orderId.replace(/-ready$/, '');
                }
                cleanOrderId = cleanOrderId.replace(/-stage-\d+$/, '');
            }
            console.log('🗑️ Cancelling order:', cleanOrderId, '(original:', orderId, ')');

            // Mark order as cancelled
            const { error } = await supabase
                .from('orders')
                .update({ order_status: 'cancelled' })
                .eq('id', cleanOrderId);

            if (error) throw error;

            // Also cancel all order items
            await supabase
                .from('order_items')
                .update({ item_status: 'cancelled' })
                .eq('order_id', cleanOrderId);

            await fetchOrders();
        } catch (err) {
            console.error('Error cancelling order:', err);
            setErrorModal({
                show: true,
                title: 'שגיאה בביטול הזמנה',
                message: 'לא הצלחנו לבטל את ההזמנה',
                details: err.message,
                retryLabel: 'נסה שוב',
                onRetry: () => handleCancelOrder(orderId)
            });
        }
    };

    /**
     * 🔚 End of Day: Close all active orders
     */
    const closeAllDailyOrders = async () => {
        try {
            setIsLoading(true);
            const businessId = currentUser?.business_id;

            if (!businessId) throw new Error('No business_id found');

            log('🏁 [END-DAY] Closing active orders...');

            // Try RPC first
            try {
                const { data, error } = await supabase.rpc('close_business_day', { p_business_id: businessId });
                if (!error) {
                    log('✅ [END-DAY] RPC Success:', data);
                    fetchOrders();
                    return data;
                }
                log('⚠️ [END-DAY] RPC Failed/Missing, falling back to iterative update', error);
            } catch (e) {
                // Ignore RPC error and fallback
            }

            // Fallback: Query active orders and update them
            // We use the same query logic as KDS
            const { data: openOrders, error: fetchError } = await supabase
                .from('orders')
                .select('id')
                .eq('business_id', businessId)
                .in('order_status', ['new', 'in_progress', 'pending', 'held', 'ready']);

            if (fetchError) throw fetchError;

            if (!openOrders || openOrders.length === 0) {
                log('🏁 [END-DAY] No open orders to close.');
                return { closed_orders: 0 };
            }

            const ids = openOrders.map(o => o.id);
            log(`🏁 [END-DAY] Closing ${ids.length} orders directly...`);

            const { error: updateError } = await supabase
                .from('orders')
                .update({
                    order_status: 'completed',
                    updated_at: new Date().toISOString()
                })
                .in('id', ids);

            if (updateError) throw updateError;

            log('✅ [END-DAY] Successfully closed all orders.');
            fetchOrders();
            return { closed_orders: ids.length };

        } catch (err) {
            console.error('❌ Error closing daily orders:', err);
            throw err;
        } finally {
            setIsLoading(false);
        }
    };

    const realtimeDebounceTimer = useRef(null);

    // Polling (Every 10 seconds - less aggressive for production)
    useEffect(() => {
        const controller = new AbortController();
        let isInitialFetch = true;
        const runFetch = () => {
            // ANTI-JUMP: Skip fetch if we're in the "cooldown" window after a manual status update
            // BUT always allow the initial fetch
            if (!isInitialFetch && Date.now() < skipFetchUntilRef.current) {
                log('⏳ [POLL] Skipping - in anti-jump cooldown');
                return;
            }
            isInitialFetch = false;
            // Removed navigator.onLine check here - fetchOrders handles hybrid logic internally
            fetchOrders(false, controller.signal);
        };

        runFetch(); // Initial fetch (bypasses cooldown)

        // 📱 iPad NOTE: Even in Lite Mode, keep polling at max 10s.
        // 30s was causing ~3 minute delays on iPad due to iOS timer freezing.
        const intervalMs = isLiteMode ? 10000 : 3000;
        const interval = setInterval(runFetch, intervalMs);

        return () => {
            controller.abort();
            clearInterval(interval);
        };
    }, [fetchOrders, currentUser]); // ✅ Runs on mount AND when fetchOrders/auth changes

    // 📱 iOS FIX: Visibility Change Handler
    // iOS Safari freezes setInterval when the screen locks or the tab goes to background.
    // When the user returns to the KDS tab, we trigger an immediate fetch so orders
    // don't sit stale for minutes waiting for the next polling cycle.
    useEffect(() => {
        if (!currentUser) return;

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                log('👁️ [VISIBILITY] Tab became visible - triggering immediate fetch');
                fetchOrders(true); // isForced=true bypasses anti-jump cooldown
            }
        };

        const handleFocus = () => {
            log('🔆 [FOCUS] Window focused - triggering immediate fetch');
            fetchOrders(true);
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('focus', handleFocus);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('focus', handleFocus);
        };
    }, [currentUser, fetchOrders]);

    // Realtime
    useEffect(() => {
        if (!currentUser) return;

        const schema = 'public';
        const businessId = currentUser?.business_id;

        // 🎯 LITE MODE: Only listen for orders, skip order_items to save CPU storm
        const shouldListenToItems = !isLiteMode;

        log(`🔌 Connecting to Realtime on schema: ${schema}, business: ${businessId} ${isLiteMode ? '(Lite Mode: Skipping Items Realtime)' : ''}`);

        // Helper to create filter string
        const filter = businessId ? `business_id=eq.${businessId}` : undefined;

        const debouncedFetch = (payload) => {
            // CRITICAL: Don't fetch on realtime events if offline
            if (!navigator.onLine) {
                log('📴 [REALTIME] Ignoring event - device is offline');
                return;
            }

            // Still trigger a debounced full fetch to ensure Dexie and items are synced
            if (Date.now() < skipFetchUntilRef.current) {
                log('⏳ [REALTIME] Skipping full fetch - in anti-jump cooldown');
                return;
            }
            if (realtimeDebounceTimer.current) clearTimeout(realtimeDebounceTimer.current);

            // 🔋 LITE MODE: 2.5s debounce to save CPU
            const debounceMs = isLiteMode ? 2500 : 500;

            realtimeDebounceTimer.current = setTimeout(() => {
                if (!navigator.onLine || Date.now() < skipFetchUntilRef.current) return;
                log(`🔄 [REALTIME] Executing debounced full fetchOrders (${debounceMs}ms)`);
                fetchOrders();
                realtimeDebounceTimer.current = null;
            }, debounceMs);
        };

        const channel = supabase
            .channel(`kds-status-${businessId}`) // Unique channel name
            .on('postgres_changes', {
                event: '*',
                schema: schema,
                table: 'orders',
                filter: filter
            }, (payload) => {
                log('🔔 Realtime update received (orders):', payload.eventType);
                debouncedFetch(payload);
            });

        if (shouldListenToItems) {
            channel.on('postgres_changes', {
                event: '*',
                schema: schema,
                table: 'order_items'
            }, (payload) => {
                log('🔔 Realtime update received (order_items):', payload.eventType);
                debouncedFetch(payload);
            });
        }

        channel.subscribe((status) => {
            log('🔌 Realtime subscription status:', status);
        });

        return () => {
            if (realtimeDebounceTimer.current) clearTimeout(realtimeDebounceTimer.current);
            supabase.removeChannel(channel);
        };
    }, [currentUser, fetchOrders]);

    // Heartbeat for System Health (Super Admin Stats)
    useEffect(() => {
        if (!currentUser?.business_id) return;

        // Generate or retrieve device ID
        let deviceId = localStorage.getItem('kds_device_id');
        if (!deviceId) {
            deviceId = 'kds_' + uuidv4();
            localStorage.setItem('kds_device_id', deviceId);
        }

        // Get public IP - fetch once at start, then use cached
        const fetchIp = async () => {
            // OFFLINE GUARD: Don't try to fetch IP if offline
            if (!navigator.onLine) return null;

            const cached = sessionStorage.getItem('device_public_ip');
            if (cached) return cached;
            try {
                // Try multiple IP services in case one fails
                const services = [
                    'https://api.ipify.org?format=json',
                    'https://api.my-ip.io/ip.json'
                ];
                for (const url of services) {
                    try {
                        const res = await fetch(url, { timeout: 5000 });
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
            // OFFLINE GUARD: Don't send heartbeat if offline
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
                console.log('💓 Sending heartbeat:', { deviceId, ip, screenRes, user: payload.p_user_name });
                const { data, error } = await supabase.rpc('send_device_heartbeat', payload);
                if (error) {
                    console.error('❌ Heartbeat error:', error);
                    throw error;
                }
                console.log('✅ Heartbeat success');
            } catch (err) {
                console.warn('⚠️ Device heartbeat failed:', err.message);
                // Fallback to old heartbeat only if still online
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

        // Fetch IP first, then start heartbeat cycle
        fetchIp().then(() => {
            sendHeartbeat(); // Initial call after IP is fetched
        });

        const intervalMs = isLiteMode ? 60000 : 30000;
        const interval = setInterval(sendHeartbeat, intervalMs); // 60s for Lite, 30s for Pro

        return () => clearInterval(interval);
    }, [currentUser]);

    const fetchHistoryOrders = useCallback(async (date, signal) => {
        try {
            setIsLoading(true);
            const businessId = currentUser?.business_id;

            // OFFLINE FALLBACK: Load from Dexie
            if (!navigator.onLine) {
                console.log('📴 Offline: Loading history from Dexie');
                try {
                    const { db } = await import('@/db/database');

                    // Get completed orders from local DB
                    const startOfDay = new Date(date);
                    startOfDay.setHours(0, 0, 0, 0);
                    const endOfDay = new Date(date);
                    endOfDay.setHours(23, 59, 59, 999);

                    const localOrders = await db.orders
                        .filter(o => {
                            const created = new Date(o.created_at);
                            // Only show truly finished orders in history: either paid completed OR cancelled
                            const isTrulyFinished = (o.order_status === 'completed' && o.is_paid === true) || o.order_status === 'cancelled';

                            return created >= startOfDay && created <= endOfDay &&
                                isTrulyFinished &&
                                o.business_id === businessId;
                        })
                        .toArray();

                    // Get order items
                    const orderIds = localOrders.map(o => o.id);
                    const allItems = await db.order_items.toArray();
                    const menuItems = await db.menu_items.toArray();
                    const menuMap = new Map(menuItems.map(m => [m.id, m]));

                    const processedOrders = localOrders.map(order => {
                        const items = allItems.filter(i => orderIds.includes(i.order_id) && i.order_id === order.id);
                        return {
                            id: order.id,
                            orderNumber: order.order_number,
                            customerName: order.customer_name || 'אורח',
                            customerPhone: order.customer_phone,
                            isPaid: order.is_paid,
                            total: order.total_amount,
                            createdAt: order.created_at,
                            items: items.map(item => {
                                const menu = menuMap.get(item.menu_item_id) || { name: 'פריט', price: 0 };
                                return {
                                    id: item.id,
                                    name: menu.name,
                                    quantity: item.quantity,
                                    price: item.price || menu.price,
                                    status: item.item_status
                                };
                            })
                        };
                    });

                    console.log(`📴 Loaded ${processedOrders.length} history orders from Dexie`);
                    return processedOrders;
                } catch (dexieErr) {
                    console.error('Dexie history load failed:', dexieErr);
                    return [];
                } finally {
                    setIsLoading(false);
                }
            }

            // 1. Fetch Option Map
            const { data: allOptionValues } = await supabase
                .from('optionvalues')
                .select('id, value_name')
                .abortSignal(signal); // Pass signal

            const optionMap = new Map();
            allOptionValues?.forEach(ov => {
                optionMap.set(String(ov.id), ov.value_name);
                optionMap.set(ov.id, ov.value_name);
            });

            // 2. Date Range (Local Day)
            const startOfDay = new Date(date);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999);

            console.log('📜 Fetching history for:', startOfDay.toLocaleString());
            let historyData = [];
            let usedRpc = false;

            // 1. Determine if we should fetch a range (Last 7 Days) or Single Date
            // If the user selected "Today", we default to showing the last 7 days of history.
            const today = new Date();
            const isRequestingToday = startOfDay.getDate() === today.getDate() &&
                startOfDay.getMonth() === today.getMonth() &&
                startOfDay.getFullYear() === today.getFullYear();

            let targetDates = [startOfDay];
            if (isRequestingToday) {
                console.log('📜 [HISTORY] "Today" selected - Fetching last 7 days of history...');
                targetDates = [];
                for (let i = 0; i < 7; i++) {
                    const d = new Date(startOfDay);
                    d.setDate(d.getDate() - i);
                    targetDates.push(d);
                }
            }

            console.log(`📜 [HISTORY-FETCH] Fetching ${targetDates.length} dates (Pallelled)...`);

            // Helper to fetch a single date
            const fetchSingleDate = async (dateObj) => {
                const dStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;

                // Try V3
                const { data, error } = await supabase
                    .rpc('get_kds_history_orders_v3', {
                        p_date: dStr,
                        p_business_id: currentUser?.business_id,
                        p_limit: 500,
                        p_offset: 0
                    })
                    .abortSignal(signal);

                if (!error && data) return data;

                // Fallback V1 (Only if V3 failed/empty and not aborted)
                if (!signal?.aborted) {
                    const dateStart = new Date(dateObj); dateStart.setHours(0, 0, 0, 0);
                    const dateEnd = new Date(dateObj); dateEnd.setHours(23, 59, 59, 999);

                    const { data: v1Data } = await supabase
                        .rpc('get_kds_history_orders', {
                            p_start_date: dateStart.toISOString(),
                            p_end_date: dateEnd.toISOString(),
                            p_business_id: currentUser?.business_id
                        })
                        .abortSignal(signal);

                    if (v1Data) return v1Data;
                }

                return [];
            };

            // Execute Parallel Fetches
            const results = await Promise.all(targetDates.map(d => fetchSingleDate(d)));
            const rawAll = results.flat();

            // Deduplicate by ID (Safety)
            const uniqueHistory = Array.from(new Map(rawAll.map(item => [item.id, item])).values());

            if (uniqueHistory.length > 0) {
                console.log(`📜 [HISTORY-DEBUG] Total unique orders fetched: ${uniqueHistory.length}`);

                historyData = uniqueHistory.filter(o => {
                    const isCancelled = o.order_status === 'cancelled';
                    const isCompleted = o.order_status === 'completed';
                    // Rule: Only show truly completed or cancelled orders.
                    return isCompleted || isCancelled;
                });

                usedRpc = true;
            } else {
                console.warn('⚠️ No history orders found for the requested period.');
            }

            // NORMALIZE: Ensure order_items is a valid array
            historyData = (historyData || []).map(o => ({
                ...o,
                order_items: o.order_items || o.items_detail || []
            }));

            // 3. Process Items (Normalize Structure and Parse Mods)
            const processedHistory = (historyData || []).map(order => {
                try {
                    const items = (order.order_items || [])
                        .map(item => {
                            let modsArray = [];
                            if (item.mods) {
                                try {
                                    const parsed = typeof item.mods === 'string' ? JSON.parse(item.mods) : item.mods;
                                    if (Array.isArray(parsed)) {
                                        modsArray = parsed.map(m => {
                                            if (typeof m === 'object' && m?.value_name) return m.value_name;
                                            return String(m);
                                        }).filter(m => m && !m.toLowerCase().includes('default') && m !== 'רגיל' && !String(m).includes('KDS_OVERRIDE'));
                                    } else if (typeof parsed === 'object' && parsed !== null) {
                                        // Handle object-style mods if they exist
                                        modsArray = Object.values(parsed).map(v => typeof v === 'object' ? v.value_name : String(v)).filter(Boolean);
                                    }
                                } catch (e) { /* ignore */ }
                            }

                            if (item.notes) {
                                modsArray.push({ name: item.notes, is_note: true });
                            }

                            // Construct Modifiers for React (Safe Colors)
                            const structuredModifiers = modsArray.map(mod => {
                                if (typeof mod === 'object' && mod.is_note) {
                                    return { text: mod.name, color: 'mod-color-purple', isNote: true };
                                }
                                const modName = typeof mod === 'string' ? mod : (mod.name || String(mod));
                                let color = 'mod-color-gray';
                                if (modName.includes('סויה')) color = 'mod-color-lightgreen';
                                else if (modName.includes('שיבולת')) color = 'mod-color-beige';
                                else if (modName.includes('שקדים')) color = 'mod-color-lightyellow';
                                else if (modName.includes('נטול')) color = 'mod-color-blue';
                                else if (modName.includes('רותח')) color = 'mod-color-red';
                                else if (modName.includes('קצף') && !modName.includes('בלי')) color = 'mod-color-foam-up';
                                else if (modName.includes('בלי קצף')) color = 'mod-color-foam-none';
                                return { text: modName, color: color, isNote: false };
                            });

                            const itemName = item.menu_items?.name || item.name || 'פריט';
                            const itemPrice = item.menu_items?.price || item.price || 0;
                            const category = item.menu_items?.category || '';
                            const modsKey = (modsArray || []).map(m => typeof m === 'object' ? m.name : m).sort().join('|');

                            return {
                                id: item.id || Math.random().toString(),
                                menuItemId: item.menu_items?.id || item.menu_item_id,
                                name: itemName,
                                modifiers: structuredModifiers,
                                quantity: item.quantity || 1,
                                status: item.item_status || 'completed',
                                price: itemPrice,
                                category: category,
                                modsKey: modsKey,
                                course_stage: item.course_stage || 1,
                                item_fired_at: item.item_fired_at || order.created_at,
                                is_early_delivered: item.is_early_delivered || false
                            };
                        });

                    // Group similar items for cleaner display
                    const groupedItems = groupOrderItems(items);

                    // Robust check for paid status from various possible field names
                    const isPaid = order.is_paid || order.isPaid || (Number(order.paid_amount) > 0);
                    const orderStatus = order.order_status || order.status || 'unknown';

                    // Ensure date is valid back-up
                    const orderDate = order.created_at ? new Date(order.created_at) : new Date();
                    const safeDate = isNaN(orderDate.getTime()) ? new Date() : orderDate;

                    if (String(order.order_number).includes('1790') || String(order.id).includes('d264b6c9')) {
                        console.log(`🎯 [HISTORY-PROCESS] Order ${order.order_number}:`, {
                            isPaid,
                            orderStatus,
                            itemsCount: items.length,
                            paymentMethod: order.payment_method
                        });
                    }

                    const refundAmt = Number(order.refund_amount) || 0;

                    return {
                        id: order.id || Math.random().toString(),
                        orderNumber: order.order_number || `#${String(order.id).slice(0, 8)}`,
                        customerName: order.customer_name || 'אורח',
                        customerPhone: order.customer_phone || '',
                        isPaid: !!isPaid,
                        totalAmount: order.total_amount || 0,
                        paidAmount: order.paid_amount || 0,
                        fullTotalAmount: order.total_amount || 0,
                        is_refund: order.is_refund || (refundAmt > 0),
                        refund_amount: refundAmt,
                        refund_method: order.refund_method || order.payment_method,
                        totalOriginalAmount: (Number(order.total_amount) || 0) + refundAmt,
                        timestamp: safeDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }),
                        created_at: order.created_at || new Date().toISOString(),
                        fired_at: order.fired_at,
                        ready_at: order.ready_at,
                        updated_at: order.updated_at,
                        orderStatus: orderStatus,
                        items: groupedItems,
                        type: 'history',
                        status: orderStatus,
                        payment_method: order.payment_method || 'cash',
                        business_id: order.business_id,
                        notes: order.notes || ''
                    };
                } catch (cardErr) {
                    console.error('Critical failure processing card in history:', cardErr, order);
                    return null; // Group cleanup will remove this
                }
            }).filter(Boolean);

            // LOG 2: Separation Check
            const ourOrder = processedHistory.find(o =>
                String(o.id).includes('d264b6c9') ||
                String(o.orderNumber).includes('1790')
            );

            if (ourOrder) {
                console.log(`📌 [SEPARATION] Our order:`, {
                    id: ourOrder.id,
                    orderNumber: ourOrder.orderNumber,
                    type: ourOrder.type,
                    orderStatus: ourOrder.orderStatus,
                    willGoTo: (ourOrder.type === 'active' || ourOrder.type === 'delayed') ? 'CURRENT 🟢' : 'COMPLETED 🔴'
                });
            }

            // A. Current / Active Orders
            // Filter out completed/cancelled unless they are delayed/active typed
            const current = processedHistory.filter(o =>
                o.type === 'active' ||
                o.type === 'delayed' ||
                (o.orderStatus !== 'completed' && o.orderStatus !== 'cancelled')
            ).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

            // B. Completed / Ready Orders
            // Show ONLY ready or completed
            // B. Completed / Ready Orders
            // Sort: Paid First (Left), Unpaid Last (Right).
            // Secondary Sort: Oldest First (Left), Newest Last (Right).
            // Result in flex-row-reverse RTL: left [Oldest Paid ... Newest Paid ... Oldest Unpaid ... Newest Unpaid] right
            const completed = processedHistory.filter(o => o.type === 'ready' || o.orderStatus === 'ready' || o.orderStatus === 'completed').sort((a, b) => {
                // 1. Priority: Unpaid comes LAST (1) so it is at the end (Right side)
                if (a.isPaid !== b.isPaid) {
                    return a.isPaid ? -1 : 1; // Paid (-1) comes before Unpaid (1)
                }

                // 2. Priority: Newest time comes LAST (Right side)
                const timeA = new Date(a.ready_at || a.updated_at || a.created_at).getTime();
                const timeB = new Date(b.ready_at || b.updated_at || b.created_at).getTime();

                return timeA - timeB; // Ascending Sort (Oldest -> Newest)
            });

            // LOG 3: Final Lists
            console.log(`📊 [FINAL] Lists:`, {
                currentCount: current.length,
                completedCount: completed.length,
                ourOrderInCurrent: current.some(o => String(o.orderNumber).includes('1790')),
                ourOrderInCompleted: completed.some(o => String(o.orderNumber).includes('1790'))
            });

            return processedHistory;

        } finally {
            setIsLoading(false);
        }
    }, [currentUser?.business_id]);

    const findNearestActiveDate = useCallback(async (fromDate) => {
        try {
            const businessId = currentUser?.business_id;
            if (!businessId) return null;

            // Start of the day we're looking before
            const startOfFromDate = new Date(fromDate);
            startOfFromDate.setHours(0, 0, 0, 0);

            const { data, error } = await supabase
                .from('orders')
                .select('created_at')
                .eq('business_id', businessId)
                .lt('created_at', startOfFromDate.toISOString())
                .eq('order_status', 'completed') // חיפוש רק של הזמנות שהושלמו (היסטוריה)
                .order('created_at', { ascending: false })
                .limit(1);

            if (error) throw error;
            if (data && data.length > 0) {
                return new Date(data[0].created_at);
            }
            return null;
        } catch (err) {
            console.error('Error finding nearest active date:', err);
            return null;
        }
    }, [currentUser?.business_id]);

    // Force refresh - bypasses anti-jump cooldown for intentional refreshes
    const forceRefresh = useCallback(() => {
        skipFetchUntilRef.current = 0; // Reset cooldown
        fetchOrders();
    }, [fetchOrders]);

    return {
        currentOrders,
        completedOrders,
        isLoading,
        lastUpdated,
        lastAction,
        smsToast,
        setSmsToast,
        errorModal,
        setErrorModal,
        isSendingSms,
        getSmsStatus,
        fetchOrders,
        forceRefresh, // Bypasses anti-jump cooldown
        fetchHistoryOrders,
        findNearestActiveDate, // Exported
        updateOrderStatus,
        handleFireItems,
        handleReadyItems,
        handleToggleEarlyDelivered,
        handleUndoLastAction,
        handleConfirmPayment,
        handleCancelOrder,
        handleSendSms
    };
};
