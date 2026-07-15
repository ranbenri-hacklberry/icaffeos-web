import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { initialLoad, syncOrders, subscribeToAllChanges, isOnline } from '../services/syncService';
import { useAuth } from './AuthContext';

const OfflineContext = createContext();

export const useOffline = () => {
    const context = useContext(OfflineContext);
    if (!context) {
        throw new Error('useOffline must be used within OfflineProvider');
    }
    return context;
};

export const OfflineProvider = ({ children }) => {
    const { currentUser } = useAuth();
    const [online, setOnline] = useState(navigator.onLine);
    const [syncing, setSyncing] = useState(false);
    const [lastSyncTime, setLastSyncTime] = useState(null);
    const [syncError, setSyncError] = useState(null);
    const [showOfflinePopup, setShowOfflinePopup] = useState(false);
    const [showOnlinePopup, setShowOnlinePopup] = useState(false);
    const [syncStatus, setSyncStatus] = useState(null);
    const [hasLocalData, setHasLocalData] = useState(false);

    // Handle online/offline events
    useEffect(() => {
        const handleOnline = () => {
            console.log('🌐 Device is now ONLINE');
            setOnline(true);
            setShowOnlinePopup(true);
            setTimeout(() => setShowOnlinePopup(false), 3000); // Hide after 3 seconds
            // Trigger sync when coming back online
            if (currentUser?.business_id) {
                performSync(currentUser.business_id);
            }
        };

        const handleOffline = () => {
            console.log('📴 Device is now OFFLINE');
            setOnline(false);
            setShowOfflinePopup(true);
            setTimeout(() => setShowOfflinePopup(false), 4000); // Hide after 4 seconds
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [currentUser]);

    // Initial sync on mount
    useEffect(() => {
        if (currentUser?.business_id && online && !hasLocalData) {
            console.log('🚀 Running initial data load...');
            performInitialLoad(currentUser.business_id);
        }
    }, [currentUser?.business_id, online, hasLocalData]);

    // Subscribe to real-time changes
    useEffect(() => {
        if (!currentUser?.business_id || !online) return;

        console.log('🔌 initializing Realtime subscriptions...');
        // Subscribe to ALL tables (orders, menu, customers, modifiers, etc.)
        const subscriptions = subscribeToAllChanges(currentUser.business_id);

        return () => {
            console.log('🔌 cleaning up Realtime subscriptions...');
            subscriptions.forEach(sub => sub.unsubscribe());
        };
    }, [currentUser?.business_id, online]);

    // Auto-sync queue when coming back online
    useEffect(() => {
        if (online && currentUser?.business_id) {
            console.log('🌐 Back online - syncing pending changes...');
            const syncPending = async () => {
                try {
                    const { syncQueue } = await import('../services/offlineQueue');
                    const result = await syncQueue();
                    if (result.synced > 0) {
                        console.log(`✅ Synced ${result.synced} pending actions to Supabase`);
                    }
                } catch (err) {
                    console.error('Failed to sync queue:', err);
                }
            };
            syncPending();
        }
    }, [online, currentUser?.business_id]);

    // 🔄 Background sync interval - fallback if realtime drops
    // Runs every 5 minutes to ensure data stays fresh
    useEffect(() => {
        if (!online || !currentUser?.business_id) return;

        // Check if background sync is enabled (default: true)
        const isBackgroundSyncEnabled = localStorage.getItem('background_sync_enabled') !== 'false';
        if (!isBackgroundSyncEnabled) {
            console.log('⏸️ Background sync disabled by user preference');
            return;
        }

        const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes

        const intervalId = setInterval(async () => {
            console.log('🔄 [BackgroundSync] Running periodic sync...');
            try {
                await performSync(currentUser.business_id);
                console.log('✅ [BackgroundSync] Periodic sync complete');
            } catch (err) {
                console.warn('⚠️ [BackgroundSync] Failed:', err.message);
            }
        }, SYNC_INTERVAL);

        return () => clearInterval(intervalId);
    }, [online, currentUser?.business_id, performSync]);

    // Perform initial load
    const performInitialLoad = useCallback(async (businessId) => {
        if (!isOnline()) {
            console.log('⏸️ Cannot perform initial load - offline');
            return;
        }

        setSyncing(true);
        setSyncError(null);

        try {
            const result = await initialLoad(businessId);
            if (result.success) {
                setLastSyncTime(new Date());
                console.log('✅ Initial load complete');
            } else {
                setSyncError(result.reason || 'Unknown error');
            }
        } catch (error) {
            console.error('❌ Initial load failed:', error);
            setSyncError(error.message);
        } finally {
            setSyncing(false);
        }
    }, []);

    // Perform orders sync
    const performSync = useCallback(async (businessId) => {
        if (!isOnline()) {
            return { success: false, reason: 'offline' };
        }

        setSyncing(true);
        setSyncError(null);

        try {
            const result = await syncOrders(businessId);
            if (result.success) {
                setLastSyncTime(new Date());
            }
            return result;
        } catch (error) {
            console.error('❌ Sync failed:', error);
            setSyncError(error.message);
            return { success: false, error };
        } finally {
            setSyncing(false);
        }
    }, []);

    // Manual refresh trigger
    const refresh = useCallback(() => {
        if (currentUser?.business_id) {
            return performSync(currentUser.business_id);
        }
        return Promise.resolve({ success: false, reason: 'no_business' });
    }, [currentUser?.business_id, performSync]);

    const value = {
        // Connection status
        online,
        offline: !online,

        // Sync status
        syncing,
        lastSyncTime,
        syncError,
        syncStatus,
        hasLocalData,

        // Actions
        refresh,
        performInitialLoad,

        // Utilities
        isOnline
    };

    return (
        <OfflineContext.Provider value={value}>
            {/* Offline TOAST (Non-blocking) */}
            {showOfflinePopup && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] animate-in slide-in-from-top-4 duration-300">
                    <div className="bg-amber-600/90 backdrop-blur-md text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-3 border border-amber-400/30">
                        <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                        <div>
                            <span className="font-bold text-sm">אין חיבור לאינטרנט</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Online TOAST (Non-blocking, Green) */}
            {showOnlinePopup && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] animate-in slide-in-from-top-4 duration-300">
                    <div className="bg-emerald-600/90 backdrop-blur-md text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-3 border border-emerald-400/30">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        <div>
                            <span className="font-bold text-sm">החיבור חזר! מסנכרן...</span>
                        </div>
                    </div>
                </div>
            )}

            {children}
        </OfflineContext.Provider>
    );
};

export default OfflineProvider;
