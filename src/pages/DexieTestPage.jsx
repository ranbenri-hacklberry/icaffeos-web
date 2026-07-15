/**
 * Dexie Test Page
 * Use this page to test and debug the offline-first database
 * 
 * Access via: /dexie-test
 */

import React, { useState } from 'react';
import { db, clearAllData, getSyncStatus, isDatabaseReady } from '@/db/database';
import { initialLoad, syncOrders, isOnline } from '@/services/syncService';
import { syncQueue, getQueueStats, getPendingActions } from '@/services/offlineQueue';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuth } from '@/context/AuthContext';
import { Database, RefreshCw, Trash2, Download, Wifi, WifiOff, CheckCircle, XCircle, Upload, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

// Local Hooks Definitions
const useOrders = () => useLiveQuery(() => db.orders.orderBy('created_at').reverse().toArray()) || [];
const useMenuItems = () => useLiveQuery(() => db.menu_items.toArray()) || [];
const useSyncStatus = () => useLiveQuery(() => db.sync_status.toArray()) || [];
const useHasLocalData = () => useLiveQuery(async () => {
    const count = await db.orders.count();
    return count > 0;
}) || false;

const DexieTestPage = () => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [dbStats, setDbStats] = useState(null);
    const [queueStats, setQueueStats] = useState({ pending: 0, failed: 0, completed: 0 });
    const [directOrders, setDirectOrders] = useState([]); // Direct from Dexie, not via hook
    const [expandedTable, setExpandedTable] = useState(null); // Which table is expanded
    const [tableData, setTableData] = useState([]); // Data for expanded table
    const [orderItemsMap, setOrderItemsMap] = useState({});
    const [activeTab, setActiveTab] = useState('all'); // 'all', 'in_progress', 'ready', 'completed', 'pending'
    const [expandedOrderId, setExpandedOrderId] = useState(null); // Which order is expanded
    const [validationResult, setValidationResult] = useState(null); // Dexie vs Supabase comparison
    const [customerSearch, setCustomerSearch] = useState(''); // Customer search query
    const [customerResults, setCustomerResults] = useState([]); // Customer search results

    // Live queries - these auto-update!
    const orders = useOrders();
    const menuItems = useMenuItems();
    const syncStatus = useSyncStatus();
    const hasLocalData = useHasLocalData();

    useEffect(() => {
        const fetchItems = async () => {
            if (directOrders.length === 0) return;

            const orderIds = directOrders.map(o => o.id);
            const items = await db.order_items.where('order_id').anyOf(orderIds).toArray();

            // Group by order_id
            const map = {};
            items.forEach(item => {
                if (!map[item.order_id]) map[item.order_id] = [];
                map[item.order_id].push(item);
            });

            // Also need menu items for names
            const menuItems = await db.menu_items.toArray();
            const menuMap = {};
            menuItems.forEach(m => menuMap[m.id] = m);

            // Enrich items with names
            Object.keys(map).forEach(oid => {
                map[oid] = map[oid].map(item => ({
                    ...item,
                    menu_item_name: menuMap[item.menu_item_id]?.name || 'Unknown Item'
                }));
            });

            setOrderItemsMap(map);
        };

        fetchItems();
    }, [directOrders]);

    const businessId = currentUser?.business_id;

    // Load queue stats
    const updateQueueStats = async () => {
        const stats = await getQueueStats();
        setQueueStats(stats);
    };

    // Manual sync queue (push offline orders to Supabase)
    const manualSyncQueue = async () => {
        setLoading(true);
        setMessage('🔄 Syncing offline queue to Supabase...');

        try {
            const pending = await getPendingActions();
            console.log('Pending actions:', pending);

            if (pending.length === 0) {
                setMessage('✅ No pending actions to sync');
                setLoading(false);
                return;
            }

            const result = await syncQueue();
            setMessage(`✅ Synced ${result.synced} actions, ${result.failed} failed`);
            await updateQueueStats();
        } catch (e) {
            setMessage(`❌ Sync error: ${e.message}`);
            console.error('Sync error:', e);
        }

        setLoading(false);
    };

    // Test database connection
    const testConnection = async () => {
        setLoading(true);
        try {
            const ready = await isDatabaseReady();
            setMessage(ready ? '✅ Database connection OK!' : '❌ Database connection failed');
        } catch (e) {
            setMessage(`❌ Error: ${e.message}`);
        }
        setLoading(false);
    };

    // Load all data from Supabase
    const loadFromSupabase = async () => {
        if (!businessId) {
            setMessage('❌ No business ID - please log in first');
            return;
        }

        setLoading(true);
        setMessage('🔄 Loading data from Supabase...');

        try {
            const result = await initialLoad(businessId);
            if (result.success) {
                setMessage(`✅ Loaded in ${result.duration}s!`);
                await updateStats();
            } else {
                setMessage(`⚠️ ${result.reason || 'Load failed'}`);
            }
        } catch (e) {
            setMessage(`❌ Error: ${e.message}`);
        }

        setLoading(false);
    };

    // Sync only orders
    const syncOrdersOnly = async () => {
        if (!businessId) {
            setMessage('❌ No business ID');
            return;
        }

        setLoading(true);
        setMessage('🔄 Syncing orders...');

        try {
            const result = await syncOrders(businessId);
            setMessage(`✅ Synced ${result.ordersCount || 0} orders`);
            await updateStats();
        } catch (e) {
            setMessage(`❌ Error: ${e.message}`);
        }

        setLoading(false);
    };

    // Clear all local data
    const clearData = async () => {
        if (!window.confirm('Are you sure you want to clear all local data?')) return;

        setLoading(true);
        try {
            await clearAllData();
            setMessage('🗑️ All local data cleared');
            await updateStats();
        } catch (e) {
            setMessage(`❌ Error: ${e.message}`);
        }
        setLoading(false);
    };

    // Update database stats
    const updateStats = async () => {
        const stats = {};
        for (const table of db.tables) {
            stats[table.name] = await table.count();
        }
        setDbStats(stats);
    };

    // Initial stats load + AUTO SYNC
    React.useEffect(() => {
        updateStats();
        updateQueueStats();

        // AUTO-SYNC: Push queue, pull from Supabase, cleanup synced orders
        (async () => {
            // Only auto-sync if online
            if (!isOnline()) {
                console.log('📴 [DexieTestPage] Offline - skipping auto-sync');
                setMessage('📴 Offline - showing cached data');

                // Still load from Dexie for display
                const { db: dynamicDb } = await import('@/db/database');
                await dynamicDb.open();
                const allOrders = await dynamicDb.orders.toArray();
                setDirectOrders(allOrders);
                await updateStats();
                return;
            }

            try {
                setLoading(true);

                // STEP 1: Push pending offline queue to Supabase first
                setMessage('🔄 Step 1/3: Pushing offline queue...');
                const pending = await getPendingActions();
                if (pending.length > 0) {
                    console.log(`📤 [DexieTestPage] Pushing ${pending.length} pending actions...`);
                    const pushResult = await syncQueue();
                    console.log('📤 Push result:', pushResult);
                    await updateQueueStats();
                }

                // STEP 2: Pull orders from Supabase
                if (businessId) {
                    setMessage('🔄 Step 2/3: Pulling orders from Supabase...');
                    console.log('🚀 [DexieTestPage] Auto-sync starting for business:', businessId);
                    const result = await syncOrders(businessId);
                    console.log('📦 [DexieTestPage] Sync result:', result);
                }

                // STEP 3: Clean up local orders that have been synced
                setMessage('🔄 Step 3/3: Cleaning synced local orders...');
                const { db: dynamicDb } = await import('@/db/database');
                await dynamicDb.open();

                const allOrders = await dynamicDb.orders.toArray();

                // Find orders that are marked as synced (have serverOrderId) or have is_offline/pending_sync but already exist in Supabase
                const ordersToClean = allOrders.filter(o => {
                    // Order has serverOrderId - the sync created a new record, this old one should be deleted
                    if (o.serverOrderId && o.id !== o.serverOrderId) return true;

                    // Order is marked offline but has a real UUID-style ID that might be synced
                    // We can check if pending_sync is still true but we already pushed the queue
                    if ((o.is_offline || o.pending_sync) && o.serverOrderId) return true;

                    return false;
                });

                if (ordersToClean.length > 0) {
                    console.log(`🧹 [DexieTestPage] Cleaning ${ordersToClean.length} already-synced local orders...`);
                    for (const order of ordersToClean) {
                        await dynamicDb.orders.delete(order.id);
                        await dynamicDb.order_items.where('order_id').equals(order.id).delete();
                    }
                }

                // Also clear pending_sync and is_offline flags for orders that exist in both places
                // (The offlineQueue CREATE_ORDER handler should do this, but just in case)
                const remainingOrders = await dynamicDb.orders.toArray();
                for (const order of remainingOrders) {
                    if (order.pending_sync || order.is_offline) {
                        // Check if this order exists in Supabase by matching order_number or id
                        // For simplicity, if it has a serverOrderId that matches its id, clear the flags
                        if (order.id === order.serverOrderId || !order.serverOrderId) {
                            // This order's id IS the server id, clear flags
                            if (!String(order.order_number).startsWith('L')) {
                                await dynamicDb.orders.update(order.id, {
                                    pending_sync: false,
                                    is_offline: false
                                });
                            }
                        }
                    }
                }

                // Refresh display
                const finalOrders = await dynamicDb.orders.toArray();
                console.log(`🔍 [DexieTestPage] Dexie now has ${finalOrders.length} orders`);
                setDirectOrders(finalOrders);

                await updateStats();
                await updateQueueStats();

                const cleanCount = ordersToClean.length;
                setMessage(`✅ Sync complete! ${cleanCount > 0 ? `Cleaned ${cleanCount} synced orders.` : 'All data current.'}`);
                setLoading(false);

            } catch (err) {
                console.error('❌ [DexieTestPage] Sync/Load Error:', err);
                setMessage(`❌ Error: ${err.message}`);
                setLoading(false);
            }
        })();
    }, [businessId]);

    // Manual refresh stats (direct from DB, not hooks)
    const manualRefreshStats = async () => {
        setLoading(true);
        setMessage('🔄 Counting records directly from Dexie...');
        const stats = {};
        for (const table of db.tables) {
            stats[table.name] = await table.count();
        }
        setDbStats(stats);

        // Get orders directly and update state
        const allOrders = await db.orders.toArray();
        setDirectOrders(allOrders);
        console.log('📊 DIRECT Dexie Orders:', allOrders.length, allOrders.slice(0, 5).map(o => ({ id: o.id, order_number: o.order_number, status: o.order_status })));

        setMessage(`✅ Found ${stats.orders || 0} orders in Dexie`);
        setLoading(false);
    };

    // Clean up stale local orders (L-prefix or numeric ID) that are stuck
    const cleanupStaleOrders = async () => {
        setLoading(true);
        try {
            const { db: dynamicDb } = await import('@/db/database');
            const allOrders = await dynamicDb.orders.toArray();

            // Find orders with L-prefix order_number or non-UUID ids
            const staleOrders = allOrders.filter(o =>
                (o.order_number && String(o.order_number).startsWith('L')) ||
                (o.id && !String(o.id).includes('-'))
            );

            console.log(`🧹 Found ${staleOrders.length} stale orders to clean:`,
                staleOrders.map(o => ({ id: o.id, order_number: o.order_number })));

            if (staleOrders.length > 0) {
                for (const order of staleOrders) {
                    await dynamicDb.orders.delete(order.id);
                    // Also clean related items
                    await dynamicDb.order_items.where('order_id').equals(order.id).delete();
                }
                setMessage(`🧹 Cleaned ${staleOrders.length} stale local orders`);
            } else {
                setMessage('✅ No stale orders to clean');
            }

            await manualRefreshStats();
        } catch (e) {
            setMessage(`❌ Cleanup error: ${e.message}`);
        }
        setLoading(false);
    };

    // Clear completed queue entries
    const clearCompletedQueue = async () => {
        setLoading(true);
        try {
            const { db: dynamicDb } = await import('@/db/database');
            if (dynamicDb.offline_queue_v2) {
                const completed = await dynamicDb.offline_queue_v2.where('status').equals('completed').count();
                await dynamicDb.offline_queue_v2.where('status').equals('completed').delete();
                setMessage(`🗑️ Cleared ${completed} completed queue entries`);
            }
            await updateQueueStats();
        } catch (e) {
            setMessage(`❌ Queue cleanup error: ${e.message}`);
        }
        setLoading(false);
    };

    // Load data for selected table
    const handleTableClick = async (tableName) => {
        setLoading(true);
        try {
            const table = db.table(tableName);
            const data = await table.toArray();
            setExpandedTable(tableName);
            setTableData(data);
            setMessage(`📂 Loaded ${data.length} records from ${tableName}`);
        } catch (e) {
            setMessage(`❌ Error loading table ${tableName}: ${e.message}`);
        }
        setLoading(false);
    };

    // Delete a specific order from Dexie
    const deleteOrderFromDexie = async (orderId) => {
        if (!window.confirm(`האם אתה בטוח שברצונך למחוק את הזמנה ${orderId} מ-Dexie בלבד?`)) return;

        setLoading(true);
        try {
            const { db: dynamicDb } = await import('@/db/database');
            await dynamicDb.orders.delete(orderId);
            await dynamicDb.order_items.where('order_id').equals(orderId).delete();
            setMessage(`🗑️ הזמנה ${orderId} נמחקה מ-Dexie`);

            // Re-validate if we were in validation view
            if (validationResult) {
                await validateData();
            } else {
                await manualRefreshStats();
            }
        } catch (e) {
            setMessage(`❌ שגיאה במחיקה: ${e.message}`);
        }
        setLoading(false);
    };

    // Validate: Compare Dexie data with Supabase
    const validateData = async () => {
        setLoading(true);
        setMessage('🔍 בודק התאמה בין Dexie ל-Supabase...');
        setValidationResult(null);

        try {
            const { supabase } = await import('@/lib/supabase');

            // DATE LIMIT: Yesterday 00:00 onwards (matching KDS filter)
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            yesterday.setHours(0, 0, 0, 0);

            const { data: supabaseData, error } = await supabase.rpc('get_orders_history', {
                p_from_date: yesterday.toISOString(),
                p_to_date: new Date().toISOString(),
                p_business_id: businessId
            });

            if (error) throw error;

            // RPC returns JSONB array
            const supabaseOrders = Array.isArray(supabaseData) ? supabaseData : (supabaseData || []);

            // Get Dexie orders (filter to same date range for fair comparison)
            const dexieOrders = (await db.orders.toArray()).filter(o =>
                o.created_at && new Date(o.created_at) >= yesterday
            );

            // Compare
            const supabaseIds = new Set(supabaseOrders.map(o => o.id));
            const dexieIds = new Set(dexieOrders.map(o => o.id));

            const inSupabaseOnly = supabaseOrders.filter(o => !dexieIds.has(o.id));
            const inDexieOnly = dexieOrders.filter(o => !supabaseIds.has(o.id));

            // Status mismatches
            const statusMismatches = [];
            for (const sOrder of supabaseOrders) {
                const dOrder = dexieOrders.find(d => d.id === sOrder.id);
                if (dOrder && dOrder.order_status !== sOrder.order_status) {
                    statusMismatches.push({
                        id: sOrder.id,
                        order_number: sOrder.order_number,
                        supabase: sOrder.order_status,
                        dexie: dOrder.order_status
                    });
                }
            }

            // Valid only if counts match and no mismatches
            const isValid =
                inSupabaseOnly.length === 0 &&
                inDexieOnly.length === 0 &&
                statusMismatches.length === 0;

            const result = {
                supabaseCount: supabaseOrders.length,
                dexieCount: dexieOrders.length,
                inSupabaseOnly: inSupabaseOnly.length,
                inDexieOnly: inDexieOnly.length,
                statusMismatches: statusMismatches.length,
                mismatches: statusMismatches.slice(0, 10), // Show first 10
                dexieOnlyOrders: inDexieOnly,
                isValid
            };

            setValidationResult(result);

            if (isValid) {
                setMessage('✅ הנתונים מסונכרנים בהצלחה!');
            } else {
                const issues = [];
                if (inSupabaseOnly.length > 0) issues.push(`${inSupabaseOnly.length} חסרים ב-Dexie`);
                if (inDexieOnly.length > 0) issues.push(`${inDexieOnly.length} עודפים ב-Dexie`);
                if (statusMismatches.length > 0) issues.push(`${statusMismatches.length} סטטוסים שונים`);
                setMessage(`⚠️ אי-התאמות: ${issues.join(', ')}`);
            }

        } catch (err) {
            setMessage(`❌ שגיאה באימות: ${err.message}`);
        }

        setLoading(false);
    };

    // Export all Dexie data as JSON backup
    const exportData = async () => {
        setLoading(true);
        setMessage('📦 מייצא נתונים...');

        try {
            const exportObj = {
                exportDate: new Date().toISOString(),
                businessId: businessId,
                tables: {}
            };

            // Export all tables
            for (const table of db.tables) {
                const data = await table.toArray();
                exportObj.tables[table.name] = data;
            }

            // Create and download file
            const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `dexie-backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            const totalRecords = Object.values(exportObj.tables).reduce((sum, arr) => sum + arr.length, 0);
            setMessage(`✅ יוצאו ${totalRecords} רשומות בהצלחה!`);
        } catch (err) {
            setMessage(`❌ שגיאה בייצוא: ${err.message}`);
        }

        setLoading(false);
    };

    // Export Orders only (for server debugging)
    const exportOrdersOnly = async () => {
        setLoading(true);
        setMessage('📦 מייצא הזמנות...');

        try {
            const orders = await db.orders.toArray();
            const orderItems = await db.order_items.toArray();

            const exportObj = {
                exportDate: new Date().toISOString(),
                businessId: businessId,
                ordersCount: orders.length,
                itemsCount: orderItems.length,
                orders: orders,
                order_items: orderItems
            };

            const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `orders-debug-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            setMessage(`✅ יוצאו ${orders.length} הזמנות + ${orderItems.length} פריטים!`);
        } catch (err) {
            setMessage(`❌ שגיאה בייצוא: ${err.message}`);
        }

        setLoading(false);
    };

    // Search customers in Dexie by name or phone
    const searchCustomers = async (query) => {
        if (!query || query.length < 2) {
            setCustomerResults([]);
            return;
        }

        try {
            const allCustomers = await db.customers.toArray();
            const lowerQuery = query.toLowerCase();

            const results = allCustomers.filter(c => {
                const name = (c.name || '').toLowerCase();
                const phone = c.phone_number || c.phone || '';
                return name.includes(lowerQuery) || phone.includes(query);
            }).slice(0, 50); // Limit to 50 results

            setCustomerResults(results);
            console.log(`🔍 Found ${results.length} customers matching "${query}"`);
        } catch (err) {
            console.error('Customer search error:', err);
            setCustomerResults([]);
        }
    };


    // Tab Filtering Logic
    const counts = {
        all: directOrders.length,
        in_progress: directOrders.filter(o => o.order_status === 'in_progress').length,
        ready: directOrders.filter(o => o.order_status === 'ready').length,
        completed: directOrders.filter(o => o.order_status === 'completed').length,
        pending: directOrders.filter(o => o.pending_sync).length
    };

    const filteredOrders = directOrders.filter(o => {
        if (activeTab === 'all') return true;
        if (activeTab === 'pending') return o.pending_sync;
        return o.order_status === activeTab;
    });

    return (
        <div className="min-h-screen bg-gray-100 p-6" dir="ltr">
            <div className="max-w-4xl mx-auto">

                {/* Header */}
                <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => navigate('/login')}
                                className="p-2 hover:bg-gray-100 rounded-full transition-colors mr-2"
                                title="Back to Login"
                            >
                                <ArrowLeft size={24} className="text-gray-600" />
                            </button>
                            <Database size={32} className="text-blue-600" />
                            <div>
                                <h1 className="text-2xl font-bold text-gray-800">Dexie.js Test Page</h1>
                                <p className="text-gray-500 text-sm">Offline-first database testing</p>
                            </div>
                        </div>

                        {/* Online/Offline indicator */}
                        <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${isOnline() ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                            {isOnline() ? <Wifi size={18} /> : <WifiOff size={18} />}
                            <span className="font-medium">{isOnline() ? 'Online' : 'Offline'}</span>
                        </div>
                    </div>

                    {/* User Info */}
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm">
                        <strong>User:</strong> {currentUser?.name || 'Not logged in'} |
                        <strong> Business:</strong> {businessId || 'None'}
                    </div>

                    {/* Message */}
                    {message && (
                        <div className={`mt-4 p-3 rounded-lg text-sm ${message.includes('✅') ? 'bg-green-100 text-green-700' :
                            message.includes('❌') ? 'bg-red-100 text-red-700' :
                                'bg-blue-100 text-blue-700'
                            }`}>
                            {message}
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <button
                        onClick={testConnection}
                        disabled={loading}
                        className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl shadow hover:shadow-lg transition disabled:opacity-50"
                    >
                        <CheckCircle size={24} className="text-green-600" />
                        <span className="font-medium">Test DB</span>
                    </button>

                    <button
                        onClick={loadFromSupabase}
                        disabled={loading || !businessId}
                        className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl shadow hover:shadow-lg transition disabled:opacity-50"
                    >
                        <Download size={24} className="text-blue-600" />
                        <span className="font-medium">Initial Load</span>
                    </button>

                    <button
                        onClick={syncOrdersOnly}
                        disabled={loading || !businessId}
                        className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl shadow hover:shadow-lg transition disabled:opacity-50"
                    >
                        <RefreshCw size={24} className={`text-purple-600 ${loading ? 'animate-spin' : ''}`} />
                        <span className="font-medium">Sync Orders</span>
                    </button>

                    <button
                        onClick={clearData}
                        disabled={loading}
                        className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl shadow hover:shadow-lg transition disabled:opacity-50"
                    >
                        <Trash2 size={24} className="text-red-600" />
                        <span className="font-medium">Clear All</span>
                    </button>

                    <button
                        onClick={manualSyncQueue}
                        disabled={loading}
                        className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl shadow hover:shadow-lg transition disabled:opacity-50 relative"
                    >
                        <Upload size={24} className="text-orange-600" />
                        <span className="font-medium">Push Queue</span>
                        {queueStats.pending > 0 && (
                            <span className="absolute -top-2 -right-2 bg-orange-500 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
                                {queueStats.pending}
                            </span>
                        )}
                    </button>

                    <button
                        onClick={manualRefreshStats}
                        disabled={loading}
                        className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl shadow hover:shadow-lg transition disabled:opacity-50"
                    >
                        <Database size={24} className="text-teal-600" />
                        <span className="font-medium">Direct Count</span>
                    </button>

                    <button
                        onClick={cleanupStaleOrders}
                        disabled={loading}
                        className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl shadow hover:shadow-lg transition disabled:opacity-50"
                    >
                        <Trash2 size={24} className="text-amber-600" />
                        <span className="font-medium">Cleanup L-Orders</span>
                    </button>

                    <button
                        onClick={clearCompletedQueue}
                        disabled={loading}
                        className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl shadow hover:shadow-lg transition disabled:opacity-50"
                    >
                        <Trash2 size={24} className="text-gray-500" />
                        <span className="font-medium">Clear Queue Done</span>
                    </button>

                    <button
                        onClick={validateData}
                        disabled={loading || !businessId}
                        className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl shadow hover:shadow-lg transition disabled:opacity-50"
                    >
                        <CheckCircle size={24} className="text-indigo-600" />
                        <span className="font-medium">בדוק התאמה</span>
                    </button>

                    <button
                        onClick={exportData}
                        disabled={loading}
                        className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl shadow hover:shadow-lg transition disabled:opacity-50"
                    >
                        <Download size={24} className="text-emerald-600" />
                        <span className="font-medium">ייצא גיבוי</span>
                    </button>

                    <button
                        onClick={exportOrdersOnly}
                        disabled={loading}
                        className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl shadow hover:shadow-lg transition disabled:opacity-50"
                    >
                        <Download size={24} className="text-blue-600" />
                        <span className="font-medium">ייצא הזמנות</span>
                    </button>
                </div>

                {/* Customer Search Section */}
                <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
                    <h2 className="text-lg font-bold text-gray-800 mb-4">🔍 חיפוש לקוחות ב-Dexie</h2>

                    <div className="flex gap-3 mb-4">
                        <input
                            type="text"
                            value={customerSearch}
                            onChange={(e) => {
                                setCustomerSearch(e.target.value);
                                searchCustomers(e.target.value);
                            }}
                            placeholder="חפש לפי שם או טלפון..."
                            className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-lg"
                            dir="rtl"
                        />
                        <button
                            onClick={() => {
                                setCustomerSearch('');
                                setCustomerResults([]);
                            }}
                            className="px-4 py-2 bg-gray-200 rounded-xl hover:bg-gray-300 transition"
                        >
                            נקה
                        </button>
                    </div>

                    {customerResults.length > 0 && (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-100">
                                    <tr>
                                        <th className="px-3 py-2 text-right">Business ID</th>
                                        <th className="px-3 py-2 text-right">ID</th>
                                        <th className="px-3 py-2 text-right">שם</th>
                                        <th className="px-3 py-2 text-right">טלפון</th>
                                        <th className="px-3 py-2 text-right">נאמנות</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {customerResults.map((c, idx) => (
                                        <tr key={c.id || idx} className={`border-b ${c.business_id === businessId ? 'bg-green-50' : 'bg-yellow-50'}`}>
                                            <td className="px-3 py-2 font-mono text-xs">
                                                {c.business_id || 'NULL'}
                                                {c.business_id === businessId && <span className="ml-1 text-green-600">✓</span>}
                                            </td>
                                            <td className="px-3 py-2 font-mono text-xs">{c.id}</td>
                                            <td className="px-3 py-2 font-bold">{c.name || '-'}</td>
                                            <td className="px-3 py-2 font-mono" dir="ltr">{c.phone_number || c.phone || '-'}</td>
                                            <td className="px-3 py-2 text-center">{c.loyalty_coffee_count || 0} ☕</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <div className="mt-2 text-sm text-gray-500 text-center">
                                נמצאו {customerResults.length} לקוחות | Business ID הנוכחי: {businessId}
                            </div>
                        </div>
                    )}

                    {customerSearch.length >= 2 && customerResults.length === 0 && (
                        <div className="text-center py-4 text-gray-500">
                            לא נמצאו לקוחות מתאימים ל-"{customerSearch}"
                        </div>
                    )}
                </div>

                {/* Validation Results */}
                {validationResult && (
                    <div className={`bg-white rounded-2xl shadow-lg p-6 mb-6 border-2 ${validationResult.isValid ? 'border-green-300' : 'border-orange-300'
                        }`}>
                        <h2 className="text-lg font-bold text-gray-800 mb-4">
                            {validationResult.isValid ? '✅ אימות נתונים - תקין' : '⚠️ אימות נתונים - נמצאו הפרשים'}
                        </h2>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                            <div className="bg-blue-50 p-3 rounded-lg text-center">
                                <div className="text-2xl font-bold text-blue-600">{validationResult.supabaseCount}</div>
                                <div className="text-xs text-gray-500">Supabase</div>
                            </div>
                            <div className="bg-teal-50 p-3 rounded-lg text-center">
                                <div className="text-2xl font-bold text-teal-600">{validationResult.dexieCount}</div>
                                <div className="text-xs text-gray-500">Dexie</div>
                            </div>
                            <div className={`p-3 rounded-lg text-center ${validationResult.inSupabaseOnly > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                                <div className={`text-2xl font-bold ${validationResult.inSupabaseOnly > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                    {validationResult.inSupabaseOnly}
                                </div>
                                <div className="text-xs text-gray-500">חסר ב-Dexie</div>
                            </div>
                            <div className={`p-3 rounded-lg text-center ${validationResult.inDexieOnly > 0 ? 'bg-orange-50' : 'bg-green-50'}`}>
                                <div className={`text-2xl font-bold ${validationResult.inDexieOnly > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                                    {validationResult.inDexieOnly}
                                </div>
                                <div className="text-xs text-gray-500">עודף ב-Dexie (לא בסופבייס)</div>
                            </div>
                        </div>

                        {validationResult.dexieOnlyOrders && validationResult.dexieOnlyOrders.length > 0 && (
                            <div className="mt-4 bg-orange-50 rounded-xl p-4 border border-orange-100">
                                <div className="text-sm font-bold text-orange-800 mb-3 flex items-center justify-between">
                                    <span>📦 הזמנות שקיימות רק ב-Dexie ({validationResult.dexieOnlyOrders.length}):</span>
                                    <button
                                        onClick={async () => {
                                            if (window.confirm(`למחוק את כל ${validationResult.dexieOnlyOrders.length} ההזמנות העודפות?`)) {
                                                for (const o of validationResult.dexieOnlyOrders) {
                                                    await db.orders.delete(o.id);
                                                    await db.order_items.where('order_id').equals(o.id).delete();
                                                }
                                                validateData();
                                            }
                                        }}
                                        className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded hover:bg-red-200 transition"
                                    >
                                        מחק את כולם
                                    </button>
                                </div>
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                    {validationResult.dexieOnlyOrders.map(o => (
                                        <div key={o.id} className="bg-white p-3 rounded-lg shadow-sm border border-orange-50 flex items-center justify-between text-xs">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-blue-600">#{o.order_number || 'L-Order'}</span>
                                                    <span className="font-medium text-gray-800">{o.customer_name || 'אורח'}</span>
                                                </div>
                                                <div className="text-gray-500 flex gap-3">
                                                    <span>🕒 {new Date(o.created_at).toLocaleString('he-IL')}</span>
                                                    <span>📍 סטטוס: {o.order_status}</span>
                                                    <span className="font-mono text-[10px]">{o.id}</span>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => deleteOrderFromDexie(o.id)}
                                                className="p-2 text-red-500 hover:bg-red-50 rounded-full transition"
                                                title="מחק מ-Dexie"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {validationResult.statusMismatches > 0 && (
                            <div className={`p-3 rounded-lg text-center mt-4 bg-orange-50 border border-orange-200`}>
                                <div className={`text-2xl font-bold text-orange-600`}>
                                    {validationResult.statusMismatches}
                                </div>
                                <div className="text-xs text-gray-500">סטטוס שונה</div>
                            </div>
                        )}

                        {validationResult.mismatches.length > 0 && (
                            <div className="mt-4 bg-gray-50 rounded-lg p-3">
                                <div className="text-sm font-bold text-gray-600 mb-2">הפרשי סטטוס:</div>
                                <div className="space-y-1 text-xs max-h-40 overflow-y-auto">
                                    {validationResult.mismatches.map(m => (
                                        <div key={m.id} className="flex justify-between bg-white p-2 rounded">
                                            <span>#{m.order_number}</span>
                                            <span>Supabase: <strong>{m.supabase}</strong></span>
                                            <span>Dexie: <strong>{m.dexie}</strong></span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Database Stats used as Navigation */}
                <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
                    <h2 className="text-lg font-bold text-gray-800 mb-4">📊 Select Table to View Data</h2>

                    {dbStats ? (
                        <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                            {Object.entries(dbStats).map(([table, count]) => (
                                <button
                                    key={table}
                                    onClick={() => handleTableClick(table)}
                                    className={`p-3 rounded-lg text-center transition ${expandedTable === table
                                        ? 'bg-blue-100 ring-2 ring-blue-500'
                                        : 'bg-gray-50 hover:bg-gray-100'
                                        }`}
                                >
                                    <div className="text-2xl font-bold text-blue-600">{count}</div>
                                    <div className="text-xs text-gray-500 truncate">{table}</div>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <p className="text-gray-500">Click "Test DB" to load stats</p>
                    )}
                </div>

                {/* Expanded Table View */}
                {expandedTable && (
                    <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 overflow-hidden">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-gray-800">
                                📂 Table: {expandedTable}
                                <span className="ml-2 text-sm font-normal text-gray-500">
                                    {tableData.length} records
                                </span>
                            </h2>
                            <button
                                onClick={() => setExpandedTable(null)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <XCircle size={24} />
                            </button>
                        </div>

                        <div className="overflow-x-auto">
                            {tableData.length > 0 ? (
                                <table className="min-w-full text-xs text-left">
                                    <thead className="bg-gray-50 uppercase font-medium text-gray-500">
                                        <tr>
                                            {Object.keys(tableData[0]).slice(0, 8).map(key => (
                                                <th key={key} className="px-4 py-2 border-b">{key}</th>
                                            ))}
                                            <th className="px-4 py-2 border-b">RAW</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {tableData.slice(0, 50).map((row, i) => (
                                            <tr key={i} className="hover:bg-gray-50 font-mono">
                                                {Object.keys(tableData[0]).slice(0, 8).map(key => (
                                                    <td key={key} className="px-4 py-2 truncate max-w-[150px]">
                                                        {typeof row[key] === 'object' ? JSON.stringify(row[key]).substring(0, 30) + '...' : String(row[key])}
                                                    </td>
                                                ))}
                                                <td className="px-4 py-2">
                                                    <details>
                                                        <summary className="cursor-pointer text-blue-500">JSON</summary>
                                                        <pre className="text-[10px] mt-1 p-2 bg-gray-100 rounded">{JSON.stringify(row, null, 2)}</pre>
                                                    </details>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <p className="text-gray-400 italic">Table is empty</p>
                            )}
                        </div>
                    </div>
                )}

                {/* Detailed Orders List - Full Width */}
                <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
                    {/* Tabs Navigation */}
                    <div className="flex flex-col lg:flex-row items-center justify-between mb-4 gap-4">
                        <div className="flex bg-gray-100 p-1 rounded-xl overflow-x-auto max-w-full">
                            {[
                                { id: 'all', label: 'All' },
                                { id: 'in_progress', label: 'Active' },
                                { id: 'ready', label: 'Ready' },
                                { id: 'completed', label: 'History' },
                                { id: 'pending', label: 'Unsynced' },
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === tab.id
                                        ? 'bg-white text-blue-600 shadow-sm'
                                        : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                >
                                    <span>{tab.label}</span>
                                    {counts[tab.id] > 0 && (
                                        <span className={`px-1.5 py-0.5 rounded-md text-[10px] min-w-[20px] text-center ${activeTab === tab.id ? 'bg-blue-100' : 'bg-gray-200'
                                            }`}>
                                            {counts[tab.id]}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={manualRefreshStats}
                            className="text-xs bg-teal-100 text-teal-700 px-3 py-2 rounded-lg hover:bg-teal-200 font-medium whitespace-nowrap flex items-center gap-1"
                        >
                            <RefreshCw size={14} /> Refresh
                        </button>
                    </div>

                    {(() => {
                        // Sort by order_number descending (newest first)
                        const sortedOrders = [...filteredOrders].sort((a, b) => {
                            const numA = parseInt(a.order_number) || 0;
                            const numB = parseInt(b.order_number) || 0;
                            return numB - numA;
                        });

                        // Group by date
                        const groupedByDate = sortedOrders.reduce((groups, order) => {
                            const date = new Date(order.created_at).toLocaleDateString('he-IL', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                            });
                            if (!groups[date]) groups[date] = [];
                            groups[date].push(order);
                            return groups;
                        }, {});

                        // Calculate prep time helper
                        const calcPrepTime = (order) => {
                            if (!order.updated_at || !order.created_at) return null;
                            if (order.order_status !== 'completed' && order.order_status !== 'ready') return null;
                            const start = new Date(order.created_at);
                            const end = new Date(order.updated_at);
                            const diffMs = end - start;
                            const mins = Math.floor(diffMs / 60000);
                            if (mins < 1) return '< 1 דק׳';
                            if (mins < 60) return `${mins} דק׳`;
                            return `${Math.floor(mins / 60)} שע׳ ${mins % 60} דק׳`;
                        };

                        if (sortedOrders.length === 0) {
                            return (
                                <div className="text-center py-8">
                                    <p className="text-gray-400 mb-2">אין הזמנות בקטגוריה זו</p>
                                    <p className="text-xs text-gray-300">לחץ על "Refresh" לעדכון</p>
                                </div>
                            );
                        }

                        return (
                            <div className="space-y-6 max-h-[600px] overflow-y-auto pr-2">
                                {Object.entries(groupedByDate).map(([date, orders]) => (
                                    <div key={date}>
                                        {/* Date Header */}
                                        <div className="sticky top-0 bg-gray-100 py-2 px-3 rounded-lg mb-3 z-10">
                                            <span className="font-bold text-gray-700">📅 {date}</span>
                                            <span className="text-gray-500 text-sm ml-2">({orders.length} הזמנות)</span>
                                        </div>

                                        {/* Orders for this date */}
                                        <div className="space-y-2">
                                            {orders.map(order => {
                                                const isExpanded = expandedOrderId === order.id;
                                                const prepTime = calcPrepTime(order);
                                                const phone = order.customer_phone?.startsWith('GUEST_')
                                                    ? null
                                                    : order.customer_phone;

                                                return (
                                                    <div
                                                        key={order.id}
                                                        className={`border rounded-lg overflow-hidden transition-all ${isExpanded ? 'border-blue-300 shadow-md' : 'border-gray-200'
                                                            }`}
                                                    >
                                                        {/* Collapsed Header - Always Visible */}
                                                        <div
                                                            onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                                                            className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 transition"
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <span className="text-lg font-bold text-blue-600">
                                                                    #{order.order_number || '?'}
                                                                </span>
                                                                <span className="text-gray-700 font-medium">
                                                                    {order.customer_name || 'אורח'}
                                                                </span>
                                                                {phone && (
                                                                    <span className="text-gray-400 text-sm">
                                                                        📱 {phone}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                {prepTime && (
                                                                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                                                                        ⏱ {prepTime}
                                                                    </span>
                                                                )}
                                                                <span className={`px-2 py-1 rounded text-xs font-medium ${order.order_status === 'completed' ? 'bg-green-100 text-green-700' :
                                                                    order.order_status === 'ready' ? 'bg-blue-100 text-blue-700' :
                                                                        order.order_status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' :
                                                                            'bg-gray-100 text-gray-700'
                                                                    }`}>
                                                                    {order.order_status === 'completed' ? '✓ הושלם' :
                                                                        order.order_status === 'ready' ? '🍽 מוכן' :
                                                                            order.order_status === 'in_progress' ? '⏳ בהכנה' :
                                                                                order.order_status}
                                                                </span>
                                                                <span className="font-bold text-gray-800">
                                                                    ₪{order.total_amount || 0}
                                                                </span>
                                                                {order.is_paid && (
                                                                    <span className="text-green-600">💳</span>
                                                                )}
                                                                <span className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                                                                    ▼
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* Expanded Content */}
                                                        {isExpanded && (
                                                            <div className="border-t border-gray-200 p-4 bg-gray-50">
                                                                {/* Meta Info */}
                                                                <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 mb-3">
                                                                    <div>🕐 נוצר: {new Date(order.created_at).toLocaleTimeString('he-IL')}</div>
                                                                    <div>🔄 עודכן: {order.updated_at ? new Date(order.updated_at).toLocaleTimeString('he-IL') : '-'}</div>
                                                                    <div>🆔 {String(order.id).substring(0, 12)}...</div>
                                                                    {order.pending_sync && <div className="text-orange-600 font-bold">⏳ ממתין לסנכרון</div>}
                                                                </div>

                                                                {/* Items */}
                                                                <div className="bg-white rounded p-3 border border-gray-200">
                                                                    <div className="text-xs font-bold text-gray-600 mb-2 border-b pb-1">
                                                                        פריטים ({orderItemsMap[order.id]?.length || 0})
                                                                    </div>
                                                                    {orderItemsMap[order.id]?.length > 0 ? (
                                                                        <div className="space-y-1">
                                                                            {orderItemsMap[order.id].map(item => (
                                                                                <div key={item.id} className="flex flex-col py-1 border-b border-gray-100 last:border-0">
                                                                                    <div className="flex justify-between text-sm">
                                                                                        <span>
                                                                                            <span className="font-bold text-blue-600">{item.quantity}×</span> {item.menu_item_name}
                                                                                        </span>
                                                                                        <span className={`px-2 py-0.5 rounded text-xs ${item.item_status === 'completed' ? 'bg-green-100 text-green-700' :
                                                                                            item.item_status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' :
                                                                                                item.item_status === 'ready' ? 'bg-blue-100 text-blue-700' :
                                                                                                    'bg-gray-200 text-gray-600'
                                                                                            }`}>
                                                                                            {item.item_status || 'pending'}
                                                                                        </span>
                                                                                    </div>
                                                                                    {/* Mods Display */}
                                                                                    {item.mods && Array.isArray(item.mods) && item.mods.length > 0 && (
                                                                                        <div className="ml-6 mt-0.5 text-xs text-gray-500">
                                                                                            {item.mods.map((mod, idx) => (
                                                                                                <span key={idx} className="inline-block bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded mr-1 mb-0.5">
                                                                                                    {typeof mod === 'object' ? (mod.name || mod.value_name || JSON.stringify(mod)) : mod}
                                                                                                </span>
                                                                                            ))}
                                                                                        </div>
                                                                                    )}
                                                                                    {/* Notes Display */}
                                                                                    {item.notes && (
                                                                                        <div className="ml-6 mt-0.5 text-xs text-purple-600 italic">
                                                                                            📝 {item.notes}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    ) : (
                                                                        <div className="text-xs text-red-400 italic">
                                                                            אין פריטים מקומיים להזמנה זו
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        );
                    })()}
                </div>

                {/* Stats Grid */}
                <div className="grid md:grid-cols-2 gap-6">

                    {/* Menu Items (Live) */}
                    <div className="bg-white rounded-2xl shadow-lg p-6">
                        <h2 className="text-lg font-bold text-gray-800 mb-4">
                            🍽️ Menu Items (Live Query)
                            <span className="text-sm font-normal text-gray-500 ml-2">
                                {menuItems?.length || 0} records
                            </span>
                        </h2>

                        <div className="max-h-64 overflow-y-auto space-y-2">
                            {menuItems && menuItems.length > 0 ? (
                                menuItems.slice(0, 10).map(item => (
                                    <div key={item.id} className="p-2 bg-gray-50 rounded text-sm flex justify-between">
                                        <span>{item.name}</span>
                                        <span className="text-gray-500">{item.category}</span>
                                    </div>
                                ))
                            ) : (
                                <p className="text-gray-400 text-center py-8">No menu items cached locally</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Sync Status */}
                <div className="bg-white rounded-2xl shadow-lg p-6 mt-6">
                    <h2 className="text-lg font-bold text-gray-800 mb-4">🔄 Sync Status</h2>

                    {Object.keys(syncStatus).length > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {Object.entries(syncStatus).map(([table, status]) => (
                                <div key={table} className="bg-gray-50 rounded-lg p-3">
                                    <div className="font-medium text-sm">{table}</div>
                                    <div className="text-xs text-gray-500">
                                        {status.recordCount} records
                                    </div>
                                    <div className="text-xs text-gray-400">
                                        {new Date(status.lastSynced).toLocaleTimeString()}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-gray-500">No sync history yet</p>
                    )}
                </div>

            </div>
        </div>
    );
};

export default DexieTestPage;
