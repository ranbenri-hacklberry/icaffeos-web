/**
 * Supabase → Dexie Sync Service
 * Handles data synchronization between Supabase (cloud) and Dexie (local)
 * 
 * ⚠️ IMPORTANT: RLS (Row Level Security) is ALWAYS enabled on Supabase!
 * This is a multi-tenant application. If data is not syncing:
 * 1. FIRST check RLS policies in Supabase Dashboard
 * 2. Verify the user's business_id matches the data
 * 3. Check if the auth token is being sent correctly
 * 
 * @module services/syncService
 */

import { db, sync_meta, clearAllData } from '../db/database.js';
import { supabase } from '../lib/supabase.js';
import { syncQueue, getPendingActions } from './offlineQueue.js';
import { getBackendApiUrl } from '../utils/apiUtils.js';

// Sync configuration
const SYNC_CONFIG = {
    // Tables to sync with their Supabase table names and optional filters
    tables: [
        { local: 'businesses', remote: 'businesses' },
        { local: 'menu_items', remote: 'menu_items' },
        { local: 'customers', remote: 'customers' },
        { local: 'employees', remote: 'employees' },
        { local: 'discounts', remote: 'discounts' },
        { local: 'orders', remote: 'orders' },
        { local: 'order_items', remote: 'order_items' },
        // Option groups and values for modifiers (milk type, size, etc.)
        { local: 'optiongroups', remote: 'optiongroups' },
        { local: 'optionvalues', remote: 'optionvalues' },
        { local: 'menuitemoptions', remote: 'menuitemoptions' },
        // Loyalty tracking
        { local: 'loyalty_cards', remote: 'loyalty_cards' },
        { local: 'loyalty_transactions', remote: 'loyalty_transactions' },
        // Tasks and Prep
        { local: 'recurring_tasks', remote: 'recurring_tasks' },
        { local: 'task_completions', remote: 'task_completions' },
        { local: 'prepared_items_inventory', remote: 'prepared_items_inventory' },
        { local: 'suppliers', remote: 'suppliers' },
        { local: 'inventory_items', remote: 'inventory_items' },
        { local: 'item_category', remote: 'item_category' },
    ],
    // How many records to fetch per batch
    batchSize: 1000,
};

/**
 * Check if device is online
 */
export const isOnline = () => {
    return navigator.onLine;
};

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {Object} options - Retry options
 * @param {number} options.maxRetries - Maximum number of retries (default: 3)
 * @param {number} options.baseDelay - Base delay in ms (default: 1000)
 * @param {number} options.maxDelay - Maximum delay in ms (default: 10000)
 * @returns {Promise} Result of the function or throws after all retries
 */
export const retryWithBackoff = async (fn, { maxRetries = 3, baseDelay = 1000, maxDelay = 10000 } = {}) => {
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            // Don't retry on certain errors
            const noRetryErrors = ['RLS', 'permission', 'unauthorized', '401', '403'];
            if (noRetryErrors.some(e => error.message?.toLowerCase().includes(e.toLowerCase()))) {
                throw error;
            }

            if (attempt < maxRetries) {
                // Exponential backoff with jitter
                const delay = Math.min(baseDelay * Math.pow(2, attempt) + Math.random() * 500, maxDelay);
                console.warn(`⏳ [Sync] Retry ${attempt + 1}/${maxRetries} in ${Math.round(delay)}ms:`, error.message);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    throw lastError;
};

/**
 * @param {Object} filter - Optional filter for the query
 * @param {string} businessId - Business ID for multi-tenant filtering
 */

/**
 * MIGRATION CHECK:
 * Detects if this is a fresh Local Server environment or legacy browser cache.
 * If legacy/unknown, performs a HARD RESET of Dexie to prevent stale data conflicts.
 */
export const autoDetectMigrationAndReset = async () => {
    const MIGRATION_KEY = 'kds_local_migration_v3'; // FORCE RUN: Bumped version to v3
    const hasMigrated = localStorage.getItem(MIGRATION_KEY);

    if (!hasMigrated) {
        console.warn('🚀 [Migration] New Environment Detected! Performing Hard Reset of Dexie...');

        try {
            // WIPE EVERYTHING to ensure clean slate
            await db.transaction('rw', db.tables, async () => {
                await Promise.all(db.tables.map(table => table.clear()));
            });

            console.log('✅ [Migration] Dexie Wiped Successfully.');
            localStorage.setItem(MIGRATION_KEY, 'true');

            // 📡 Notify Server (Alerts Admin that computer is online)
            try {
                const baseUrl = getBackendApiUrl();
                await fetch(`${baseUrl}/api/admin/notify-online`, { method: 'POST' });
                console.log('📡 [Migration] Notification sent to Admin.');
            } catch (e) { console.warn('Notification failed', e); }

            return true; // Indicates reset happened
        } catch (e) {
            console.error('❌ [Migration] Failed to wipe Dexie:', e);
            return false;
        }
    }
    return false;
};

export const syncTable = async (localTable, remoteTable, filter = null, businessId = null) => {
    if (!isOnline()) {
        console.log(`⏸️ Offline - skipping sync for ${localTable}`);
        return { success: false, reason: 'offline' };
    }

    try {
        console.log(`🔄 Syncing ${localTable}...`);



        // 🛡️ RECONCILIATION MODE: We no longer WIPE before sync.
        // Wiping causes white screens and race conditions in useLiveQuery.
        // We let bulkPut handle reconciliation (upsert).
        if (businessId) {
            try {
                // If the table has a business_id index, we could prune stale local records if needed.
                // But for now, we just proceed to pull new data and reconcile.
                console.log(`📡 [Sync] Reconciling ${localTable} for business context...`);
            } catch (wipeErr) {
                console.warn(`⚠️ Dexie context check failed for ${localTable}:`, wipeErr);
            }
        }

        // --- SPECIAL SYNC LOGIC ---

        // 1. Customers, Loyalty, etc. (RPC with pagination fallback)
        if ((remoteTable === 'customers' || remoteTable === 'loyalty_cards') && businessId) {
            console.log(`🔄 Syncing ${remoteTable} via specialized RPC/Query...`);
            const rpcName = remoteTable === 'customers' ? 'get_customers_for_sync' : 'get_loyalty_cards_for_sync';

            let allRemoteData = [];
            let rpcPage = 0;
            let hasMoreRpc = true;

            while (hasMoreRpc) {
                const { data, error } = await supabase.rpc(rpcName, { p_business_id: businessId })
                    .range(rpcPage * 1000, (rpcPage + 1) * 1000 - 1);

                if (error || !data || data.length === 0) {
                    hasMoreRpc = false;
                } else {
                    allRemoteData.push(...data);
                    if (data.length < 1000) hasMoreRpc = false;
                    rpcPage++;
                }
            }

            // Fallback
            if (allRemoteData.length === 0) {
                const { data: fallbackData } = await supabase.from(remoteTable).select('*').eq('business_id', businessId).limit(1000);
                if (fallbackData) allRemoteData = fallbackData;
            }

            if (allRemoteData.length > 0) {
                const recordsToPut = allRemoteData.map(r => ({ ...r, business_id: r.business_id || businessId }));
                await db[localTable].bulkPut(recordsToPut);
                console.log(`✅ Synced ${allRemoteData.length} ${remoteTable}`);
                return { success: true, count: allRemoteData.length };
            }
            return { success: true, count: 0 };
        }

        // 1.5 Loyalty Transactions - 3 Days ONLY
        if (remoteTable === 'loyalty_transactions' && businessId) {
            console.log(`🔄 Syncing loyalty_transactions (LAST 24 HOURS only)...`);
            const oneDayAgo = new Date();
            oneDayAgo.setDate(oneDayAgo.getDate() - 1);
            const isoDate = oneDayAgo.toISOString();

            let page = 0;
            let hasMore = true;
            let syncedCount = 0;

            while (hasMore) {
                const { data, error } = await supabase
                    .from(remoteTable)
                    .select('*')
                    .eq('business_id', businessId)
                    .gte('created_at', isoDate) // Filter by date
                    .range(page * 1000, (page + 1) * 1000 - 1);

                if (error || !data || data.length === 0) {
                    hasMore = false;
                } else {
                    await db[localTable].bulkPut(data);
                    syncedCount += data.length;
                    if (data.length < 1000) hasMore = false;
                    page++;
                }
            }
            console.log(`✅ Synced ${syncedCount} recent loyalty transactions.`);
            return { success: true, count: syncedCount };
        }




        if (remoteTable === 'order_items' && businessId) {
            console.log(`🔄 Syncing order_items (LAST 24 HOURS only) using JOIN...`);

            // 🕒 1-Day Window Calculation
            const oneDayAgo = new Date();
            oneDayAgo.setDate(oneDayAgo.getDate() - 1);
            const isoDate = oneDayAgo.toISOString();

            let page = 0;
            let hasMore = true;
            let syncedCount = 0;

            while (hasMore) {
                // Use retry with backoff for network resilience
                const fetchPage = async () => {
                    // Optimized single query using JOIN to filter by orders.business_id
                    // AND join menu_items to get the name for offline robustness
                    const { data, error } = await supabase
                        .from('order_items')
                        .select('*, menu_items(name), orders!inner(business_id, created_at)')
                        .eq('orders.business_id', businessId)
                        .gte('created_at', isoDate) // Use order_items.created_at for date window
                        .range(page * 1000, (page + 1) * 1000 - 1);

                    if (error) throw error;
                    return data;
                };

                try {
                    const data = await retryWithBackoff(fetchPage, { maxRetries: 2 });

                    if (data && data.length > 0) {
                        // Strip the join objects (orders, menu_items) before saving to Dexie
                        // but preserve the joined name for offline-first resilience
                        const itemsToSave = data.map(({ orders, menu_items, ...item }) => ({
                            ...item,
                            name: item.name || menu_items?.name
                        }));
                        await db[localTable].bulkPut(itemsToSave);
                        syncedCount += data.length;
                        if (data.length < 1000) hasMore = false;
                        else page++;
                    } else {
                        hasMore = false;
                    }
                } catch (error) {
                    console.error(`❌ order_items sync failed:`, error.message);
                    hasMore = false;
                }
            }
            console.log(`✅ Synced ${syncedCount} recent order_items.`);
            return { success: true, count: syncedCount };
        }

        if (remoteTable === 'orders' && businessId) {
            console.log(`🔄 Syncing orders (LAST 24 HOURS only)...`);
            const oneDayAgo = new Date();
            oneDayAgo.setDate(oneDayAgo.getDate() - 1);
            const isoDate = oneDayAgo.toISOString();

            let page = 0;
            let hasMore = true;
            let syncedCount = 0;

            while (hasMore) {
                // Use retry with backoff for network resilience
                const fetchPage = async () => {
                    const { data, error } = await supabase
                        .from(remoteTable)
                        .select('*')
                        .eq('business_id', businessId)
                        .gte('created_at', isoDate)
                        .range(page * SYNC_CONFIG.batchSize, (page + 1) * SYNC_CONFIG.batchSize - 1);

                    if (error) throw error;
                    return data;
                };

                try {
                    const data = await retryWithBackoff(fetchPage, { maxRetries: 2 });

                    if (data && data.length > 0) {
                        await db[localTable].bulkPut(data);
                        syncedCount += data.length;
                        if (data.length < SYNC_CONFIG.batchSize) hasMore = false;
                        page++;
                    } else {
                        hasMore = false;
                    }
                } catch (error) {
                    console.error(`❌ Orders sync failed after retries:`, error.message);
                    hasMore = false;
                }
            }
            console.log(`✅ Synced ${syncedCount} recent orders.`);
            return { success: true, count: syncedCount };
        }

        // 2. Option Groups/Values (Simplified Sync)
        // Previous logic tried to filter by valid groups, but this was fragile and caused missing data.
        // We now sync them as standard tables. If the Docker contains them, we want them.
        if (remoteTable === 'optionvalues' || remoteTable === 'menuitemoptions') {
            // Let the General Sync Flow handle it below.
            // We intentionally skip the special block here to fall through to standard sync.
            console.log(`🎯 Syncing ${remoteTable} using standard flow...`);
        }

        // --- GENERAL SYNC FLOW ---
        let query = supabase.from(remoteTable).select('*');


        // Apply business filter ONLY for multi-tenant tables
        const multiTenantTables = [
            'menu_items',
            'customers',
            'employees',
            'discounts',
            'orders',
            'optiongroups',
            'loyalty_cards',
            'recurring_tasks',
            'task_completions',
            'suppliers',
            'inventory_items',
            'item_category',
            'businesses'
        ];
        if (businessId && multiTenantTables.includes(remoteTable)) {
            if (remoteTable === 'businesses') {
                query = query.eq('id', businessId);
            } else {
                query = query.eq('business_id', businessId);
            }
        }

        // Apply date filter for orders (only today's orders)
        if (filter && filter.column === 'created_at' && filter.value === 'today') {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            query = query.gte('created_at', today.toISOString());
        }

        // Fetch data
        const { data, error } = await query.limit(SYNC_CONFIG.batchSize);

        if (error) {
            console.error(`❌ Sync error for ${localTable}:`, error.message, error);
            return { success: false, error: error.message };
        }

        if (!data || data.length === 0) {
            console.log(`📭 No data for ${localTable}`);
            return { success: true, count: 0 };
        }

        // 🔒 CONFLICT PROTECTION: Check for local pending changes and timestamps
        const dataWithIds = data.map((record, index) => {
            const enriched = { ...record, business_id: record.business_id || businessId };
            // Ensure ID exists for Dexie
            if (!enriched.id && localTable !== 'prepared_items_inventory') {
                const compositeId = `${enriched.item_id || ''}_${enriched.group_id || ''}_${index}`;
                enriched.id = enriched.id || compositeId;
            }
            // For prepared_items_inventory, item_id is the key
            if (localTable === 'prepared_items_inventory' && !enriched.item_id) {
                enriched.item_id = enriched.id;
            }
            return enriched;
        });

        let recordsToSave = [];
        const pendingActions = await getPendingActions();
        const dirtyIds = new Set(pendingActions.map(a => String(a.recordId || a.payload?.id)));

        for (const remoteRecord of dataWithIds) {
            // 🛡️ EXPLICIT FILTER: Ensure record belongs to this business
            // (Double protection against leaky queries or cross-tenant contamination)
            if (remoteRecord.business_id && remoteRecord.business_id !== businessId) {
                console.warn(`🛑 Blocked cross-tenant leak for ${localTable}:${remoteRecord.id} (Biz: ${remoteRecord.business_id})`);
                continue;
            }

            const id = remoteRecord.id || remoteRecord.item_id; // item_id for prep
            if (dirtyIds.has(String(id))) {
                console.log(`🛡️ Skipping sync for dirty record: ${localTable}:${id}`);
                continue;
            }

            // Timestamp check (if both have updated_at)
            const localRecord = await db[localTable].get(id);
            if (localRecord && localRecord.updated_at && remoteRecord.updated_at) {
                if (new Date(localRecord.updated_at) > new Date(remoteRecord.updated_at)) {
                    console.log(`🛡️ Keeping newer local record for ${localTable}:${id}`);
                    continue;
                }
            }
            recordsToSave.push(remoteRecord);
        }

        if (recordsToSave.length > 0) {
            await db[localTable].bulkPut(recordsToSave);
        }

        // Update sync metadata
        await sync_meta.put({
            table_name: localTable,
            last_synced_at: new Date().toISOString(),
            record_count: dataWithIds.length
        });

        console.log(`✅ Synced ${dataWithIds.length} records to ${localTable}`);
        return { success: true, count: dataWithIds.length };

    } catch (err) {
        console.error(`❌ Sync failed for ${localTable}:`, err);
        return { success: false, error: err };
    }
};



/**
 * Sync orders and order items (real-time sync for KDS)
 * Uses RPC to bypass RLS restrictions
 * @param {string} businessId - Business ID
 */
export const syncOrders = async (businessId) => {
    console.log('🔍 [syncOrders] Starting sync for businessId:', businessId);

    if (!isOnline()) {
        console.log('📴 [syncOrders] Offline, skipping sync');
        return { success: false, reason: 'offline' };
    }

    // Lean Diet: Sync 1 day of history (local Supabase has full history)
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 1);
    const fromDateISO = fromDate.toISOString();
    const toDateISO = new Date().toISOString();

    const clientBrand = (supabase.supabaseUrl.includes('127.0.0.1') || supabase.supabaseUrl.includes('localhost') || supabase.supabaseUrl.includes('10.')) ? 'DOCKER' : 'CLOUD';
    console.log(`📅 [syncOrders] ${clientBrand} Sync - Filtering and Pruning from:`, fromDateISO, 'to:', toDateISO);

    // The frontend client (Dexie) must ALWAYS sync from the active Supabase provider (Docker or Cloud).
    // DO NOT skip sync for DOCKER, because Dexie needs to receive updates from the local POS via Docker.

    try {
        let orders = [];
        let historyPage = 0;
        let hasMoreHistory = true;

        console.log(`📅 [syncOrders] Fetching history from ${clientBrand} since ${fromDateISO} (Last 3 Days)...`);

        while (hasMoreHistory) {
            const { data, error } = await supabase.rpc('get_orders_history', {
                p_from_date: fromDateISO,
                p_to_date: toDateISO,
                p_business_id: businessId
            }).range(historyPage * 1000, (historyPage + 1) * 1000 - 1);

            if (error || !data || data.length === 0) {
                hasMoreHistory = false;
                if (error) console.error('❌ Orders history RPC error:', error);
            } else {
                orders.push(...data);
                if (data.length < 1000) hasMoreHistory = false;
                historyPage++;
            }
        }

        const cloudOrderIds = new Set(orders.map(o => o.id));
        let prunedCount = 0;

        console.log(`📦 [syncOrders] Cloud returned ${orders.length} total orders (after pagination). Starting sync & pruning...`);

        await db.transaction('rw', [db.orders, db.order_items], async () => {
            // 🛡️ REMOVED AGGRESSIVE CLEARING: Wiping the DB causes white screens/flickers 
            // in useLiveQuery. We now let bulkPut handle reconciliation (upsert).
            // Pruning is handled separately below for truly deleted records.
            console.log(`📦 [syncOrders] Reconciling ${orders.length} orders into local cache...`);

            // 1. Prepare bulk data
            const ordersToPut = [];
            const itemsToPut = [];

            if (orders.length > 0) {
                for (const order of orders) {
                    const existing = await db.orders.get(order.id);
                    // 🛡️ CONFLICT RESOLUTION (Recommendation #2)
                    // If we have a local record with pending_sync, we only overwrite it 
                    // if the server has a STRICTLY NEWER update.
                    if (existing) {
                        const serverTime = new Date(order.server_updated_at || order.updated_at || 0).getTime();
                        const localTime = new Date(existing._localUpdatedAt || existing.updated_at || 0).getTime();

                        // If local is currently being synced (pending) and server is not newer, skip it.
                        // This prevents server from reverting a status change we just made locally.
                        if (existing.pending_sync && serverTime <= localTime) {
                            console.log(`⏳ [syncOrders] Skipping stale server update for ${order.id} (Local is newer or pending)`);
                            continue;
                        }
                    }

                    ordersToPut.push({
                        id: order.id,
                        order_number: order.order_number,
                        order_status: order.order_status,
                        is_paid: order.is_paid,
                        customer_id: order.customer_id,
                        customer_name: order.customer_name,
                        customer_phone: order.customer_phone,
                        total_amount: order.total_amount,
                        business_id: order.business_id || businessId,
                        order_type: order.order_type || 'dine_in',
                        delivery_address: order.delivery_address,
                        delivery_fee: order.delivery_fee,
                        delivery_notes: order.delivery_notes,
                        created_at: order.created_at,
                        updated_at: order.updated_at || new Date().toISOString(),
                        server_updated_at: order.server_updated_at || order.updated_at,
                        _localUpdatedAt: new Date().toISOString(), // Track when we last saw this on the client
                        pending_sync: false,
                        payment_screenshot_url: order.payment_screenshot_url,
                        payment_method: order.payment_method,
                        payment_verified: order.payment_verified,
                        seen_at: order.seen_at,
                        driver_id: order.driver_id,
                        driver_name: order.driver_name,
                        driver_phone: order.driver_phone,
                        courier_name: order.courier_name,
                        metadata: order.metadata || {},
                        items: order.items || order.items_detail || []
                    });


                    const orderItems = order.order_items || order.items_detail || [];
                    for (const item of orderItems) {
                        itemsToPut.push({
                            id: item.id,
                            order_id: order.id,
                            menu_item_id: item.menu_item_id || item.menu_items?.id,
                            name: item.name || item.menu_items?.name, // 🛡️ SAVE NAME FOR OFFLINE ROBUSTNESS
                            quantity: item.quantity,
                            price: item.price || item.menu_items?.price,
                            mods: item.mods,
                            notes: item.notes,
                            item_status: item.item_status,
                            course_stage: item.course_stage || 1,
                            created_at: item.created_at || order.created_at,
                            // 🎯 KDS HANDSHAKE FIELDS - Must be preserved or bulkPut erases them!
                            early_delivered_at: item.early_delivered_at || null,
                            is_early_delivered: !!(item.early_delivered_at || item.is_early_delivered),
                            kds_routing_logic: item.kds_routing_logic || null,
                            urgent_at: item.urgent_at || null
                        });
                    }
                }
            }

            // Perform bulk operations
            if (ordersToPut.length > 0) await db.orders.bulkPut(ordersToPut);
            if (itemsToPut.length > 0) await db.order_items.bulkPut(itemsToPut);


            // 2. AGGRESSIVE PRUNING: Only for CURRENT business to avoid loading whole DB
            const allLocalOrders = await db.orders.where('business_id').equals(businessId).toArray();

            // 🛡️ SAFETY: If the server returned ZERO orders, it's highly suspicious (potential network/RPC error).
            // We SKIP pruning in this case to avoid accidentally wiping all local data.
            if (orders.length > 0) {
                const ordersToDelete = allLocalOrders.filter(o => {
                    const orderDate = new Date(o.created_at);

                    // 1. Only prune within our 3-day sync window
                    if (orderDate < fromDate) return false;

                    // 2. 🛡️ PROTECTION: Never prune local orders that haven't synced yet
                    if (o.pending_sync === true) return false;
                    if (typeof o.id === 'string' && o.id.startsWith('L')) return false;

                    // 3. If it's a server order in our window but NOT in the cloud response -> Delete (it was probably deleted on server)
                    return !cloudOrderIds.has(o.id);
                });

                if (ordersToDelete.length > 0) {
                    prunedCount = ordersToDelete.length;
                    const idsToDelete = ordersToDelete.map(o => o.id);
                    console.warn(`🧹 [syncOrders] PRUNING: Removing ${idsToDelete.length} deleted/stale records...`);
                    await db.orders.bulkDelete(idsToDelete);
                    // Clean up orphaned items
                    await db.order_items.where('order_id').anyOf(idsToDelete).delete();
                }
            } else {
                console.log(`🛡️ [syncOrders] Server returned 0 orders. Skipping pruning to protect local data.`);
            }

            // 3. DEEP CLEANUP: Remove ANY orders older than 1 day to keep Dexie lean
            // Historical data is always available on-demand from Supabase
            const oneDayAgoCleanup = new Date();
            oneDayAgoCleanup.setDate(oneDayAgoCleanup.getDate() - 1);
            oneDayAgoCleanup.setHours(5, 0, 0, 0); // Business day starts at 05:00
            const staleOrders = allLocalOrders.filter(o => new Date(o.created_at) < oneDayAgoCleanup);
            if (staleOrders.length > 0) {
                const staleIds = staleOrders.map(o => o.id);
                console.log(`🧹 [syncOrders] DEEP CLEANUP: Removing ${staleIds.length} orders older than 1 business day`);
                await db.orders.bulkDelete(staleIds);
                await db.order_items.where('order_id').anyOf(staleIds).delete();
            }
        });

        return { success: true, ordersCount: orders.length, prunedCount };

    } catch (err) {
        console.error('❌ syncOrders exception:', err);
        return { success: false, error: err.message };
    }
};

/**
 * Sync loyalty data (cards and transactions)
 * @param {string} businessId
 */
export const syncLoyalty = async (businessId) => {
    if (!isOnline()) return { success: false, reason: 'offline' };

    try {
        console.log(`🔄 [syncLoyalty] Syncing loyalty for ${businessId}...`);

        // 1. Sync Cards
        const cardRes = await syncTable('loyalty_cards', 'loyalty_cards', null, businessId);

        // 2. Sync Transactions
        const txRes = await syncTable('loyalty_transactions', 'loyalty_transactions', null, businessId);

        return {
            success: true,
            cards: cardRes.count || 0,
            transactions: txRes.count || 0
        };
    } catch (err) {
        console.error('❌ syncLoyalty failed:', err);
        return { success: false, error: err.message };
    }
};

/**
 * 🚀 High-Level Sync Orchestrator
 * Performs the full sync sequence:
 * 1. Cloud -> Docker (Postgres) via Backend API
 * 2. Supabase/Docker -> Lexie (Browser) via initialLoad
 * 
 * @param {string} businessId - Mandatory business ID
 * @param {Object} options - { onProgress, clearLocal }
 */
export const triggerCloudToLocalSync = async (businessId, { onProgress, clearLocal = false } = {}) => {
    if (!businessId) {
        throw new Error('Missing businessId for sync');
    }

    if (!isOnline()) {
        return { success: false, reason: 'offline' };
    }

    // 🛡️ [SMART WIPE] Context Switch Detection
    // If the businessId has changed since the last sync, force a full wipe to prevent "Phantom Data"
    const LAST_BIZ_KEY = 'last_synced_business_id';
    const lastBizId = localStorage.getItem(LAST_BIZ_KEY);
    if (lastBizId && lastBizId !== businessId) {
        console.warn(`🔄 [Sync] Business Context Switch: ${lastBizId} -> ${businessId}. FORCING FULL WIPE.`);
        clearLocal = true;
    }
    localStorage.setItem(LAST_BIZ_KEY, businessId);

    const report = (stage, progress, message) => {
        if (onProgress) onProgress(stage, 0, progress, message);
    };

    try {
        // STEP 1: Backend Sync (Cloud -> Docker)
        report('docker_sync', 0, clearLocal ? 'מנקה ומסנכרן בסיס נתונים מקומי...' : 'מסנכרן בסיס נתונים מקומי (Docker)...');

        const baseUrl = getBackendApiUrl();
        const backendResp = await fetch(`${baseUrl}/api/sync-cloud-to-local`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ businessId, clearLocal })
        });

        if (!backendResp.ok) {
            const errData = await backendResp.json();
            throw new Error(errData.error || 'Backend sync failed');
        }

        // Poll for backend progress
        let backendDone = false;
        const baseUrlPolling = getBackendApiUrl();
        while (!backendDone) {
            const statusResp = await fetch(`${baseUrlPolling}/api/sync/status`);
            const status = await statusResp.json();

            if (status.error) throw new Error(status.error);

            if (!status.inProgress) {
                backendDone = true;
                report('docker_sync', 50, 'סנכרון Docker הושלם');
            } else {
                report(status.currentTable || 'docker', status.progress * 0.5, `Docker: ${status.currentTable} (${status.progress}%)`);
                await new Promise(r => setTimeout(r, 1000));
            }
        }

        // STEP 2: Clear stale data if requested
        if (clearLocal) {
            console.log('🧹 [SyncService] Full clear requested - performing Nuclear Wipe of Dexie...');

            // Step 2.1: Tell backend to archive stale orders (Best effort)
            try {
                const baseUrlArchive = getBackendApiUrl();
                await fetch(`${baseUrlArchive}/api/orders/archive-stale`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ businessId, olderThanHours: 12, fromStatuses: ['new', 'in_progress', 'ready', 'held', 'pending'] })
                });
            } catch (e) { console.warn('Archive failed', e); }

            // Step 2.2: Nuclear Wipe of Dexie
            await clearAllData();

            // Clear metadata
            localStorage.removeItem('last_full_sync');
            localStorage.removeItem('last_orders_sync');
            localStorage.removeItem('kds_orders_cache');

            // Step 2.3: Force metadata reset on backend
            try {
                const baseUrlReset = getBackendApiUrl();
                await fetch(`${baseUrlReset}/api/sync/reset-metadata`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ businessId })
                });
            } catch (e) {
                console.warn('Backend metadata reset failed', e);
            }
        }

        // STEP 3: Frontend Sync (Docker/Cloud -> Dexie)
        report('dexie_sync', 50, 'טוען נתונים לדפדפן...');

        const dexieResult = await initialLoad(businessId, (tableName, count, dexieProgress, message) => {
            // Map 0-100 Dexie progress back to 50-100 overall
            const overallProgress = 50 + (dexieProgress * 0.5);
            if (onProgress) onProgress(tableName, count, overallProgress, message);
        });

        return { success: dexieResult.success, duration: dexieResult.duration };

    } catch (err) {
        console.error('❌ triggerCloudToLocalSync CRITICAL ERROR:', err);
        throw err;
    }
};

/**
 * Initial load - hydrate all tables from Supabase
 * Uses standard sync for config tables and specialized RPC sync for orders
 * @param {string} businessId - The business ID to filter data
 */
export const initialLoad = async (businessId, onProgress = null) => {
    if (!isOnline()) {
        console.log('⏸️ Device is offline - using cached data');
        return { success: false, reason: 'offline' };
    }

    console.log('🚀 Starting initial data load...');
    const startTime = Date.now();
    const results = {};
    // 🛑 STRICT SAFETY: Never sync without a Business ID in a multi-tenant system
    if (!businessId) {
        console.error('❌ [initialLoad] CRITICAL: Missing businessId! Aborting sync to prevent data leak.');
        return { success: false, error: 'missing_business_id' };
    }

    const totalTables = SYNC_CONFIG.tables.length + 1; // +1 for Orders

    // 1. Sync Standard Tables
    for (let i = 0; i < SYNC_CONFIG.tables.length; i++) {
        const table = SYNC_CONFIG.tables[i];
        const result = await syncTable(table.local, table.remote, table.filter, businessId);
        results[table.local] = result;

        const progress = Math.round(((i + 1) / totalTables) * 100);
        // Map table name to Hebrew friendly name
        const tableHebrew = {
            'menu_items': 'תפריט',
            'ingredients': 'מרכיבים',
            'businesses': 'פרופיל עסק',
            'customers': 'לקוחות',
            'employees': 'עובדים',
            'discounts': 'מבצעים',
            'optiongroups': 'קבוצות תוספות',
            'optionvalues': 'ערכי תוספות',
            'menuitemoptions': 'חיבורי תוספות',
            'loyalty_cards': 'מועדון לקוחות',
            'loyalty_transactions': 'היסטוריית מועדון',
            'recurring_tasks': 'משימות קבועות',
            'task_completions': 'ביצועי משימות',
            'prepared_items_inventory': 'מלאי מוכן',
            'suppliers': 'ספקים'
        }[table.local] || table.local;

        console.log(`📊 Sync progress: ${progress}% - ${table.local}`);
        if (onProgress) {
            const countMsg = result.count > 0 ? `עודכנו ${result.count} רשומות` : 'הכל מעודכן';
            onProgress(table.local, result.count || 0, progress, `טוען ${tableHebrew}... (${countMsg})`);
        }
    }

    // 2. Sync Orders (Specialized RPC for history + items)
    console.log('📦 Syncing Orders via RPC...');

    // 🛡️ [LOCAL OPTIMIZATION] If local, sync a much smaller window for initial load
    // The server already has the full history, the tablet just needs today's/recent data to start.
    const ordersResult = await syncOrders(businessId);
    results['orders'] = ordersResult;

    if (onProgress) {
        const orderCount = ordersResult.ordersCount || 0;
        const msg = orderCount > 0 ? `סונכרנו ${orderCount} הזמנות` : 'אין הזמנות חדשות';
        onProgress('orders', orderCount, 100, `מסנכרן הזמנות... (${msg})`);
    }

    // 3. POST-SYNC VALIDATION: Compare Dexie counts with Supabase for critical tables
    const discrepancies = [];
    const criticalTables = ['recurring_tasks', 'inventory_items', 'employees', 'customers', 'menu_items'];

    for (const tableName of criticalTables) {
        try {
            const localCount = await db[tableName].where('business_id').equals(businessId).count();
            const { count: remoteCount } = await supabase
                .from(tableName)
                .select('*', { count: 'exact', head: true })
                .eq('business_id', businessId);

            if (remoteCount !== null && localCount < remoteCount) {
                const missing = remoteCount - localCount;
                discrepancies.push({ table: tableName, local: localCount, remote: remoteCount, missing });
                console.warn(`⚠️ [Sync Validation] ${tableName}: Local has ${localCount}, Remote has ${remoteCount} (${missing} missing!)`);
            }
        } catch (e) {
            // Non-critical, just log
            console.warn(`⚠️ [Sync Validation] Could not validate ${tableName}:`, e.message);
        }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const hasDiscrepancies = discrepancies.length > 0;

    if (hasDiscrepancies) {
        console.warn(`⚠️ [Sync] Completed with ${discrepancies.length} discrepancies:`, discrepancies);
    } else {
        console.log(`✅ [Sync] All critical tables validated successfully`);
    }

    console.log(`🎉 Initial load complete in ${duration}s`, results);

    // Update last sync time for UI indicators (e.g., ConnectionStatusBar)
    localStorage.setItem('last_sync_time', Date.now().toString());

    return { success: !hasDiscrepancies, results, duration, discrepancies: hasDiscrepancies ? discrepancies : undefined };
};

/**
 * 🔄 Full Bidirectional Sync
 * 1. Pushes pending local changes (Upload)
 * 2. Pulls latest data from server (Download)
 * @param {string} businessId 
 */
export const fullSync = async (businessId) => {
    console.log('🔄 Initiating Full Bidirectional Sync...');
    // 1. Push
    await pushPendingChanges();
    // 2. Pull
    return await initialLoad(businessId);
};

/**
 * Push local changes to Supabase (for when coming back online)
 * This handles offline-created orders
 */
export const pushPendingChanges = async () => {
    // 🛡️ [LOCAL OPTIMIZATION] If we are on the local server, the server handles sync.
    // We only need to push if there's truly an offline queue that haven't hit the local DB yet.
    if (localStorage.getItem('is_local_instance') === 'true') {
        const pending = await getPendingActions();
        if (pending.length === 0) {
            console.log('🏘️ Local Mode: No pending queue, server is authoritative. Skipping Push.');
            return { success: true, count: 0 };
        }
    }

    console.log('📤 Pushing pending changes via OfflineQueue...');
    try {
        const result = await syncQueue();
        return { success: true, ...result };
    } catch (err) {
        console.error('❌ Push failed:', err);
        return { success: false, error: err };
    }
};

/**
 * Setup real-time subscription for orders
 * @param {string} businessId - Business ID
 * @param {Function} onUpdate - Callback when orders change
 */
export const subscribeToOrders = (businessId, onUpdate) => {
    const subscription = supabase
        .channel('orders-sync')
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'orders',
                filter: `business_id=eq.${businessId}`
            },
            async (payload) => {
                console.log('📡 Order change detected:', payload.eventType);

                if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                    // 🛡️ CONFLICT PROTECTION: Check for local pending changes
                    try {
                        const existing = await db.orders.get(payload.new.id);
                        if (existing && existing.pending_sync) {
                            console.log(`🛡️ [Realtime] Skipping external update for dirty order ${payload.new.order_number || payload.new.id}`);
                        } else {
                            await db.orders.put(payload.new);
                        }
                    } catch (e) {
                        await db.orders.put(payload.new);
                    }
                } else if (payload.eventType === 'DELETE') {
                    await db.orders.delete(payload.old.id);
                }

                onUpdate?.(payload);
            }
        )
        .subscribe();

    return subscription;
};

/**
 * Subscribe to order items changes
 */
export const subscribeToOrderItems = (businessId, onUpdate) => {
    const subscription = supabase
        .channel('order-items-sync')
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'order_items'
            },
            async (payload) => {
                console.log('📡 Order item change detected:', payload.eventType);

                if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                    await db.order_items.put(payload.new);
                } else if (payload.eventType === 'DELETE') {
                    await db.order_items.delete(payload.old.id);
                }

                onUpdate?.(payload);
            }
        )
        .subscribe();

    return subscription;
};

/**
 * Subscribe to ALL table changes for a business
 * Updates Dexie immediately when remote changes detected
 * Respects local pending changes to prevent overwrites (Last-Write-Wins check)
 */
export const subscribeToAllChanges = (businessId, tables = ['orders', 'order_items', 'menu_items', 'customers', 'employees', 'discounts', 'ingredients']) => {
    const subscriptions = [];

    // Cleanup any existing? usually this is called once on mount
    console.log(`🔌 Subscribing to Realtime changes for: ${tables.join(', ')}`);

    for (const table of tables) {
        const channel = supabase
            .channel(`${table}-sync-${businessId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table,
                    // Filter by business_id for all tables except order_items (which doesn't have it directly usually, or we rely on RLS/cascade)
                    // Actually order_items doesn't have business_id in schema usually, it's joined. 
                    // But Supabase Realtime filters must match column existence. 
                    // We'll filter client-side for order_items if needed or rely on the Fact that we only get what we can see (RLS).
                    // However, 'postgres_changes' ignores RLS for subscription *filters* often, but receives RLS'd rows? 
                    // Safest is to specific filter if column exists.
                    filter: (table !== 'order_items' && table !== 'ingredients') ? `business_id=eq.${businessId}` : undefined
                },
                async (payload) => {
                    // console.log(`📡 [${table}] ${payload.eventType}`); // noisy

                    try {
                        // INSERT / UPDATE
                        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                            const record = payload.new;
                            if (!record || !record.id) return;

                            // Conflict Check: Do we have a pending local change?
                            const localRecord = await db[table].get(record.id);

                            if (localRecord && localRecord.pending_sync) {
                                console.log(`⏳ [${table}] Local change pending for ${record.id}, skipping Realtime update`);
                                return;
                            }

                            // Safe to update
                            await db[table].put({
                                ...record,
                                pending_sync: false,
                                _syncError: null,
                                _localUpdatedAt: new Date().toISOString() // Treat server update as fresh local baseline
                            });
                        }
                        // DELETE
                        else if (payload.eventType === 'DELETE') {
                            const oldRecord = payload.old;
                            if (!oldRecord || !oldRecord.id) return;

                            // Check if we have pending changes on this deleted item? (Unlikely edge case)
                            await db[table].delete(oldRecord.id);
                        }
                    } catch (err) {
                        console.warn(`❌ Error processing Realtime event for ${table}:`, err);
                    }
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    // console.log(`✅ Subscribed to ${table}`);
                }
            });

        subscriptions.push(channel);
    }

    return subscriptions;
};

/**
 * Sync Doctor - Finds discrepancies between Dexie and Supabase for critical orders
 * @param {string} businessId
 */
export const getSyncDiffs = async (businessId) => {
    if (!isOnline()) return { success: false, reason: 'offline' };

    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayISO = today.toISOString();

        // 1. Get local orders
        const localOrders = await db.orders
            .where('business_id').equals(businessId)
            .filter(o => o.created_at >= todayISO)
            .toArray();

        // 2. Get remote orders
        const { data: remoteOrders, error } = await supabase
            .from('orders')
            .select('*')
            .eq('business_id', businessId)
            .gte('created_at', todayISO);

        if (error) throw error;

        // 3. Find mismatches
        const diffs = localOrders.map(local => {
            const remote = remoteOrders.find(r => r.id === local.id);
            if (!remote) return null; // Let standard sync handle missing remotes for now

            const hasStatusDiff = remote.order_status !== local.order_status;
            const hasSeenDiff = remote.seen_at !== local.seen_at;

            if (hasStatusDiff || hasSeenDiff) {
                // NEW: Cooldown - skip if updated in last 60 seconds to allow real-time settling
                const recentlyUpdated = new Date(local.updated_at) > new Date(Date.now() - 60000);
                if (recentlyUpdated) return null;

                // Determine direction: 
                // IF local has pending_sync -> PUSH (local is newer/truth)
                // ELSE -> PULL (remote is truth, local is stale)
                const direction = local.pending_sync ? 'PUSH' : 'PULL';

                return {
                    id: local.id,
                    orderNumber: local.order_number,
                    type: 'mismatch',
                    direction,
                    local: { status: local.order_status, seen_at: local.seen_at },
                    remote: { status: remote.order_status, seen_at: remote.seen_at }
                };
            }
            return null;
        }).filter(Boolean);

        return { success: true, diffs };
    } catch (err) {
        console.error('❌ Sync Doctor failed:', err);
        return { success: false, error: err.message };
    }
};

/**
 * Reconcile a specific order based on Sync Doctor's findings
 */
export const healOrder = async (diff, businessId) => {
    try {
        if (diff.direction === 'PUSH') {
            console.log(`📤 [SyncDoctor] Pushing local truth for ${diff.orderNumber}`);
            const local = await db.orders.get(diff.id);
            if (!local) return false;

            // Use Safe RPC for pushing
            const { error: rpcError } = await supabase.rpc('update_order_status_v3', {
                p_order_id: diff.id,
                p_new_status: local.order_status,
                p_business_id: businessId
            });

            if (rpcError) throw rpcError;
            await db.orders.update(diff.id, { pending_sync: false });
            return true;
        } else {
            console.log(`📥 [SyncDoctor] Pulling remote truth for ${diff.orderNumber}`);
            // Direction is PULL - update Dexie with remote data
            await db.orders.update(diff.id, {
                order_status: diff.remote.status,
                seen_at: diff.remote.seen_at,
                updated_at: new Date().toISOString()
            });
            return true;
        }
    } catch (err) {
        console.error('❌ healOrder failed:', err);
        return false;
    }
};

export default {
    isOnline,
    syncTable,
    initialLoad,
    syncOrders,
    syncLoyalty,
    pushPendingChanges,
    subscribeToOrders,
    subscribeToOrderItems,
    subscribeToAllChanges,
    getSyncDiffs,
    healOrder,
    fullSync
};
