import React, { useState, useEffect, useContext } from 'react';
import { supabase, cloudSupabase } from '../lib/supabase.js'; // 🆕 FIX: Import supabase client
import AuthContext from './AuthContextCore.jsx';

// API URL for sync endpoint - Favor relative paths when running locally to use Vite proxy
import { getBackendApiUrl } from '../utils/apiUtils.js';

const API_URL = getBackendApiUrl();

import { APP_VERSION } from '../version.js';

export { APP_VERSION };
export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [deviceMode, setDeviceMode] = useState(null); // 'kiosk', 'kds', 'manager', 'music'
    const [isLoading, setIsLoading] = useState(true);

    /* 
    // 🚀 רני ביקש: בכל העלאה מחדש להכריח כניסה עם פין
    // [DISABLED] This was causing 'flashing old memory' issues and UX confusion on Mac App reloads.
    // We now favor standard session expiry based on inactivity/time instead of mount-clearing.
    useEffect(() => {
        // If we are in the middle of an impersonation flow, DO NOT clear the session
        const isImpersonating = localStorage.getItem('original_super_admin');
        if (isImpersonating) {
            console.log('🎭 [Auth] Impersonation active - Preserving session across reload');
            return;
        }

        console.log('🔄 [Auth] Fresh Load - Clearing session to force PIN entry');
        localStorage.removeItem('kiosk_user');
        localStorage.removeItem('kiosk_auth_time');
        localStorage.removeItem('kiosk_mode');
        localStorage.setItem('app_version', APP_VERSION);
    }, []);
    */

    const [syncStatus, setSyncStatus] = useState({
        inProgress: false,
        lastSync: null,
        progress: 0,
        error: null
    });

    const triggerSync = async (businessId = null, options = {}) => {
        const { triggerCloudToLocalSync } = await import('../services/syncService');
        const targetBusinessId = businessId || currentUser?.business_id;

        if (!targetBusinessId) {
            console.warn('⚠️ [Sync] No business ID available for sync');
            return;
        }

        console.log(`🔄 [AuthContext] High-Level Sync Triggered for: ${targetBusinessId}`);
        setSyncStatus(prev => ({ ...prev, inProgress: true, error: null }));

        try {
            const result = await triggerCloudToLocalSync(targetBusinessId, {
                onProgress: (table, count, progress, message) => {
                    setSyncStatus({
                        inProgress: true,
                        currentTable: table,
                        progress: progress,
                        message: message,
                        lastSync: Date.now()
                    });
                },
                ...options
            });

            if (result.success) {
                console.log('🎉 [AuthContext] Sync Complete!');
                setSyncStatus(prev => ({ ...prev, inProgress: false, progress: 100 }));
            } else {
                throw new Error(result.reason || 'Sync failed');
            }
        } catch (err) {
            console.error('❌ [AuthContext] Sync failed:', err.message);
            setSyncStatus(prev => ({
                ...prev,
                inProgress: false,
                error: err.message
            }));
        }
    };

    // Load state from localStorage on mount with expiration check
    useEffect(() => {
        const checkAuth = async () => {
            // 🤖 ELECTRON AUTO-LOGIN (Machine ID)
            // If running in Electron, prioritize Hardware ID over localStorage
            let isImpersonating = false;
            try {
                const storedUser = localStorage.getItem('kiosk_user');
                if (storedUser) {
                    const parsedUser = JSON.parse(storedUser);
                    if (parsedUser.is_impersonating || localStorage.getItem('original_super_admin')) {
                        isImpersonating = true;
                        console.log('👑 Super Admin Impersonation detected. Skipping Machine-ID Strategy in AuthContext.');
                    }
                }
            } catch (e) { }

            if (window.electron && window.electron.auth && !isImpersonating) {
                console.log('⚡ Detected Electron Environment. Applying Machine-ID Strategy...');
                try {
                    const machineId = await window.electron.auth.getMachineId();
                    if (machineId) {
                        console.log(`🔑 Machine ID: ${machineId}`);

                        // 1. Check if we have a valid session already (to skip network if offline)
                        // If offline and localStorage matches Machine ID, allow it.
                        // (Simplified for now - always try to refresh or use local)

                        // 2. Validate against Backend (RPC)
                        // Note: validation should happen via our API route or Supabase RPC
                        const { data, error } = await supabase.rpc('verify_kiosk_device', {
                            p_machine_id_hash: machineId
                        });

                        if (data && data.success) {
                            // Support both snake_case (business_id) and camelCase (businessId) from RPC
                            const rawUser = data.user || data;
                            const bizId = rawUser.business_id || rawUser.businessId || null;
                            console.log('✅ [Auth] Device Authorized (Local):', rawUser.name, '| business_id:', bizId);

                            let deviceUser = {
                                ...rawUser,
                                business_id: bizId,
                                machine_id: machineId,
                                is_device: true
                            };

                            // 🔑 ALWAYS resolve the real primary employee in device/kiosk mode.
                            // The device RPC returns a hardware identity (machine name or business name),
                            // NOT a personal identity. We must always find the real person.
                            // ⛔ NO fallback to random employees — only elevated roles (super_admin, owner, admin, manager)
                            if (bizId) {
                                try {
                                    console.log('🔍 [Auth] Resolving primary employee for business:', bizId);

                                    // 1. Try super admins first
                                    const { data: superAdmins, error: saErr } = await supabase
                                        .from('employees')
                                        .select('id, name, access_level, is_super_admin, is_admin, pin_code')
                                        .eq('business_id', bizId)
                                        .eq('is_super_admin', true)
                                        .limit(1);
                                    console.log('🔍 [Auth] Super admins found:', superAdmins?.length || 0, saErr?.message || '');

                                    // 2. Try owners/admins/managers (elevated roles only)
                                    // NOTE: DB may have mixed case (e.g. 'Manager' vs 'manager') — include both
                                    const { data: elevated, error: owErr } = await supabase
                                        .from('employees')
                                        .select('id, name, access_level, is_super_admin, is_admin, pin_code')
                                        .eq('business_id', bizId)
                                        .in('access_level', ['owner', 'admin', 'manager', 'Owner', 'Admin', 'Manager'])
                                        .order('created_at', { ascending: true });
                                    console.log('🔍 [Auth] Elevated employees found:', elevated?.length || 0, owErr?.message || '');

                                    const primaryEmployee = superAdmins?.[0] || elevated?.[0];
                                    if (primaryEmployee?.name) {
                                        console.log(`👤 [Auth] Resolved: ${primaryEmployee.name} | access_level: ${primaryEmployee.access_level}`);
                                        deviceUser = {
                                            ...deviceUser,
                                            id: primaryEmployee.id,
                                            name: primaryEmployee.name,
                                            access_level: primaryEmployee.access_level,
                                            is_super_admin: primaryEmployee.is_super_admin || false,
                                            is_admin: primaryEmployee.is_admin || primaryEmployee.is_super_admin || false,
                                            pin_code: primaryEmployee.pin_code || null,
                                        };

                                        setCurrentUser(deviceUser);
                                        localStorage.setItem('kiosk_user', JSON.stringify(deviceUser));
                                        localStorage.setItem('kiosk_auth_time', Date.now().toString());
                                        console.log('✅ [Auth] Personal identity secured via Machine ID.');
                                    } else {
                                        console.warn('⚠️ [Auth] No elevated employee found. Forcing manual login.');
                                        // Still set context so login screen knows which business we are
                                        localStorage.setItem('business_id', bizId);
                                        localStorage.setItem('businessId', bizId);
                                    }
                                } catch (e) {
                                    console.warn('⚠️ [Auth] Could not fetch primary employee:', e.message);
                                }
                            }

                            // POLICY: No auto-mode.
                            setDeviceMode(null);
                            localStorage.removeItem('kiosk_mode');
                            setIsLoading(false);
                            return;
                        } else {
                            const isBanned = data?.reason?.toLowerCase?.()?.includes('ban');
                            if (isBanned) {
                                console.warn('🚫 [Auth] Device is Banned:', data?.reason);
                                setIsLoading(false);
                                return;
                            } else {
                                // Device is simply not registered as a kiosk — fall through to web session/auto-discovery
                                console.warn('⚠️ [Auth] Device not registered as kiosk — falling through to web session check:', data?.reason);
                                // (do not return — continue to web fallback below)
                            }
                        }
                    }
                } catch (err) {
                    console.error('❌ Machine ID Check Failed:', err);
                }
            }

            console.log('🔐 AuthContext: Checking stored session (Web Fallback)...');
            const storedSession = localStorage.getItem('kiosk_user');
            const storedTime = localStorage.getItem('kiosk_auth_time');
            const storedMode = localStorage.getItem('kiosk_mode');

            if (storedSession && storedTime) {
                const now = Date.now();
                // 18 hours expiration (Daily login requirement)
                const hoursPassed = (now - parseInt(storedTime)) / (1000 * 60 * 60);

                if (hoursPassed < 18) {
                    try {
                        let sessionUser = JSON.parse(storedSession);

                        // 🛡️ GHOST SESSION PURGE: If this is a generic device session without a real human ID, clear it immediately.
                        // Real employees have UUIDs, ghost devices start with 'device-'.
                        if (sessionUser.is_device && (!sessionUser.id || sessionUser.id.startsWith('device-'))) {
                            console.warn('⚠️ [Auth] Purging ghost device session. Official login required.');
                            localStorage.removeItem('kiosk_user');
                            localStorage.removeItem('kiosk_auth_time');
                            localStorage.removeItem('kiosk_mode');
                            setIsLoading(false);
                            return;
                        }

                        // ALWAYS fetch fresh business metadata to check status
                        if (sessionUser.business_id && navigator.onLine) {
                            try {
                                const { data: businessData } = await supabase
                                    .from('businesses')
                                    .select('name, settings')
                                    .eq('id', sessionUser.business_id)
                                    .single();

                                if (businessData) {
                                    sessionUser.business_name = businessData.name;
                                    sessionUser.business = businessData;
                                    localStorage.setItem('kiosk_user', JSON.stringify(sessionUser));
                                }
                            } catch (e) {
                                console.warn('❌ Could not validate business name:', e);
                            }
                        }

                        setCurrentUser(sessionUser);

                        // DEEP FIX: If accessing through icaffe domain, ensure we don't get stuck in old kiosk mode
                        const isIffeDomain = window.location.hostname === 'icaffe.hacklberryfinn.com';
                        if (isIffeDomain && storedMode === 'kiosk') {
                            console.log('🧹 Clearing old kiosk mode for production domain');
                            localStorage.removeItem('kiosk_mode');
                            setDeviceMode(null);
                        } else if (storedMode) {
                            setDeviceMode(storedMode);
                        }

                        // Trigger sync on page load if user exists (background refresh)
                        const lastSyncTime = localStorage.getItem('last_sync_time');
                        const syncAge = lastSyncTime ? (now - parseInt(lastSyncTime)) / (1000 * 60) : Infinity;
                        if (syncAge > 30) { // Sync if older than 30 minutes
                            // triggerSync(sessionUser?.business_id); // DISABLED for Cloud-Only Mode
                        }
                    } catch (e) {
                        console.error('Failed to parse session user', e);
                        localStorage.removeItem('kiosk_user');
                        localStorage.removeItem('kiosk_auth_time');
                        localStorage.removeItem('kiosk_mode');
                    }
                } else {
                    localStorage.removeItem('kiosk_user');
                    localStorage.removeItem('kiosk_auth_time');
                    localStorage.removeItem('kiosk_mode');
                }
            } else {
                localStorage.removeItem('kiosk_mode');

                // ✨ NEW: ZERO-CONFIG AUTO DISCOVERY
                // If no session exists, try to discover who we are from the local backend
                try {
                    console.log('🔍 [Auth] Attempting Zero-Config auto-discovery...');
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
                    const res = await fetch(`${API_URL}/api/admin/identity`, { signal: controller.signal });
                    clearTimeout(timeoutId);

                    if (res.ok) {
                        const { businesses, count } = await res.json();
                        if (count === 1) {
                            const biz = businesses[0];
                            console.log(`🚀 [Auth] Auto-discovered unique business: ${biz.name}. Priming context...`);

                            // Persist business info for login page context, but DO NOT log in ghost user
                            localStorage.setItem('business_id', biz.id);
                            localStorage.setItem('businessId', biz.id);
                            localStorage.setItem('business_name', biz.name);

                            // IMPORTANT: We do NOT setCurrentUser here.
                            // This ensures ProtectedRoute catches the missing user and sends to /login
                            console.log(`🔒 [Auth] Business context set. Redirecting to official login.`);
                        } else if (count > 1) {
                            console.log(`🏢 [Auth] Multiple businesses discovered (${count}). Waiting for manual login.`);
                        }
                    }
                } catch (discoveryErr) {
                    console.warn('ℹ [Auth] Auto-discovery skipped:', discoveryErr.message);
                }
            }

            setIsLoading(false);
            console.log('🏁 [AuthContext] checkAuth complete (isLoading -> false)');
        };

        // Run checkAuth with a safety timeout
        checkAuth().catch(err => {
            console.error('❌ [Auth] checkAuth failed:', err);
            setIsLoading(false); // Ensure loading ends even on error
        });

        // Safety fallback: Force loading to end after 10 seconds no matter what
        const safetyTimeout = setTimeout(() => {
            setIsLoading(prev => {
                if (prev) {
                    console.warn('⏰ [Auth] Safety timeout - forcing loading to end');
                    return false;
                }
                return prev;
            });
        }, 10000);

        return () => clearTimeout(safetyTimeout);
    }, []);

    // Auto-sync queue when coming back online
    useEffect(() => {
        const handleOnline = async () => {
            if (currentUser?.business_id) {
                console.log('🌐 [AuthContext] Back online - syncing pending changes...');
                try {
                    const { syncQueue } = await import('../services/offlineQueue');
                    const result = await syncQueue();
                    if (result.synced > 0) {
                        console.log(`✅ [AuthContext] Synced ${result.synced} pending actions`);
                    }
                } catch (err) {
                    console.error('Failed to sync queue:', err);
                }
            }
        };

        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, [currentUser?.business_id]);

    // Background sync every 5 minutes (when user is logged in)
    useEffect(() => {
        if (!currentUser?.business_id) return;

        const runBackgroundSync = async () => {
            try {
                console.log('🔄 [Background] Starting periodic sync...');
                const { syncOrders, syncLoyalty, isOnline } = await import('../services/syncService');
                const { syncQueue } = await import('../services/offlineQueue');

                if (!isOnline()) {
                    console.log('📴 [Background] Offline, skipping sync');
                    return;
                }

                if (localStorage.getItem('block_background_sync') === 'true') {
                    console.log('🛑 [Background] Sync blocked by DatabaseExplorer operation');
                    return;
                }

                // First, sync local changes TO cloud
                await syncQueue();

                // Check if we need a FULL sync (Initial Load)
                // DISABLED: We now handle this via SyncStatusModal with a proactive user prompt

                // Just sync orders and loyalty frequently in the background
                const res = await syncOrders(currentUser.business_id);
                const loyRes = await syncLoyalty(currentUser.business_id);

                if (res.success) {
                    console.log(`✅ [Background] Synced ${res.ordersCount} orders`);
                }
                if (loyRes.success) {
                    console.log(`✅ [Background] Synced ${loyRes.transactions} transactions`);
                }

                localStorage.setItem('last_sync_time', Date.now().toString());
            } catch (err) {
                console.warn('⚠️ [Background] Sync failed:', err.message);
            }
        };

        // Check for Lite Mode
        const isLiteMode = localStorage.getItem('lite_mode') === 'true';

        // 🛡️ DELAY INITIAL SYNC: Allow UI to render Mode Selection before hammering the CPU
        // This prevents the "Frozen after Splash" feeling
        const startupTimer = setTimeout(() => {
            console.log('⏰ [Background] Startup delay finished - triggering sync');
            runBackgroundSync();
        }, 3000);

        // Adjust interval based on device capability
        const syncIntervalMs = isLiteMode ? 10 * 60 * 1000 : 5 * 60 * 1000;
        const interval = setInterval(runBackgroundSync, syncIntervalMs);

        return () => {
            clearTimeout(startupTimer);
            clearInterval(interval);
        };
    }, [currentUser?.business_id]);

    // 🕛 MIDNIGHT AUTO-LOGOUT: Force logout at midnight every day
    useEffect(() => {
        const checkMidnightLogout = () => {
            const now = new Date();
            const hours = now.getHours();
            const minutes = now.getMinutes();

            // Check if it's between 00:00 and 00:05 (5-minute window)
            if (hours === 0 && minutes < 5) {
                const lastMidnightLogout = localStorage.getItem('last_midnight_logout');
                const today = now.toDateString();

                // Only logout once per day
                if (lastMidnightLogout !== today) {
                    console.log('🕛 MIDNIGHT AUTO-LOGOUT: Clearing all sessions...');

                    // Mark that we did midnight logout today
                    localStorage.setItem('last_midnight_logout', today);

                    // Clear ALL session data
                    localStorage.removeItem('kiosk_user');
                    localStorage.removeItem('kiosk_auth_time');
                    localStorage.removeItem('kiosk_mode');
                    localStorage.removeItem('manager_auth_key');
                    localStorage.removeItem('manager_auth_time');
                    localStorage.removeItem('manager_employee_id');
                    localStorage.removeItem('currentCustomer');
                    sessionStorage.removeItem('employee_session');

                    // Force reload to login screen
                    window.location.href = '/mode-selection';
                }
            }
        };

        // Check immediately
        checkMidnightLogout();

        // Then check every minute
        const midnightInterval = setInterval(checkMidnightLogout, 60 * 1000);

        return () => clearInterval(midnightInterval);
    }, []);

    const login = async (employee) => {
        // If business_name is missing, fetch it from the database
        let enrichedEmployee = { ...employee };

        if (employee.business_id) {
            try {
                const { data: businessData } = await supabase
                    .from('businesses')
                    .select('name, settings')
                    .eq('id', employee.business_id)
                    .single();

                if (businessData) {
                    enrichedEmployee.business_name = businessData.name;
                    enrichedEmployee.business = businessData;
                }
            } catch (e) {
                console.warn('Could not fetch business name:', e);
            }
        }

        setCurrentUser(enrichedEmployee);
        localStorage.setItem('kiosk_user', JSON.stringify(enrichedEmployee));
        localStorage.setItem('kiosk_auth_time', Date.now().toString());

        // 🛡️ [SYNC STABILITY] Update business context keys to prevent data mixing
        // This ensures hooks that rely on localStorage fallbacks use the correct business ID
        if (enrichedEmployee.business_id) {
            localStorage.setItem('business_id', enrichedEmployee.business_id);
            localStorage.setItem('businessId', enrichedEmployee.business_id);
        }
        if (enrichedEmployee.business_name) {
            localStorage.setItem('business_name', enrichedEmployee.business_name);
        }

        // Color force full sync on next background run
        localStorage.removeItem('last_full_sync');
        localStorage.setItem('last_sync_time', Date.now().toString());
    };

    const logout = () => {
        const originalAdminStr = localStorage.getItem('original_super_admin');

        if (originalAdminStr) {
            // RESTORE SUPER ADMIN SESSION
            try {
                const originalAdmin = JSON.parse(originalAdminStr);
                console.log('🔙 Restoring Super Admin session:', originalAdmin.name);

                setCurrentUser(originalAdmin);
                localStorage.setItem('kiosk_user', originalAdminStr);
                localStorage.setItem('kiosk_auth_time', Date.now().toString());

                // Cleanup impersonation flags
                localStorage.removeItem('original_super_admin');
                localStorage.removeItem('return_to_super_portal');
                localStorage.removeItem('last_full_sync'); // Clear sync state from the other business

                // 🔄 RESET Business ID in localStorage to prevent data mixing!
                const bId = originalAdmin.business_id || originalAdmin.businessId;
                if (bId) {
                    localStorage.setItem('business_id', bId);
                    localStorage.setItem('businessId', bId);
                }
                if (originalAdmin.business_name) {
                    localStorage.setItem('business_name', originalAdmin.business_name);
                }

                window.location.href = '/super-admin';
                return;
            } catch (e) {
                console.error('Failed to restore super admin', e);
                // Fallthrough to normal logout
            }
        }

        // Normal Logout
        setCurrentUser(null);
        setDeviceMode(null);
        localStorage.removeItem('kiosk_user');
        localStorage.removeItem('kiosk_auth_time');
        localStorage.removeItem('kiosk_mode');
        localStorage.removeItem('last_sync_time');

        // Clean up any pending order/edit state
        sessionStorage.removeItem('pendingCartState');
        sessionStorage.removeItem('editOrderData');
        sessionStorage.removeItem('order_origin');

        window.location.href = '/mode-selection';
    };

    const setMode = (mode) => {
        setDeviceMode(mode);
        if (mode) {
            localStorage.setItem('kiosk_mode', mode);
        } else {
            localStorage.removeItem('kiosk_mode');
        }
    };

    const switchBusinessContext = (businessId, businessName) => {
        // Support both snake_case and camelCase for super admin check
        const isSuperAdmin = currentUser?.is_super_admin || currentUser?.isSuperAdmin;
        if (!isSuperAdmin) {
            console.error('Only super admins can switch business context');
            return;
        }

        // Save original identity
        localStorage.setItem('original_super_admin', JSON.stringify(currentUser));

        const impersonatedUser = {
            ...currentUser,
            business_id: businessId,
            business_name: businessName, // Sync business_name for UI components
            access_level: 'owner', // Elevate to owner for full access
            is_admin: true,
            impersonating_business_name: businessName,
            is_impersonating: true
        };

        console.log('🚀 Switching context to:', businessName);

        setCurrentUser(impersonatedUser);
        localStorage.setItem('kiosk_user', JSON.stringify(impersonatedUser));
        localStorage.setItem('business_id', businessId);
        localStorage.setItem('businessId', businessId);
        localStorage.setItem('business_name', businessName); // Ensure localStorage is also updated
        localStorage.setItem('return_to_super_portal', 'true');

        // Force sync for new business
        localStorage.removeItem('last_full_sync');
        localStorage.setItem('last_sync_time', Date.now().toString());

        // Clear mode so they can choose
        setDeviceMode(null);
        localStorage.removeItem('kiosk_mode');

        // 🔄 FORCE REFRESH: This ensures all hooks (like useMenuItems) reset with the new business identity
        window.location.href = '/mode-selection';
    };

    return (
        <AuthContext.Provider value={{
            currentUser,
            isAuthenticated: !!currentUser,
            deviceMode,
            login,
            logout,
            setMode,
            switchBusinessContext,
            isLoading,
            syncStatus,
            triggerSync,
            appVersion: APP_VERSION
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

// Export the context itself for rare cases or testing
export { AuthContext };

