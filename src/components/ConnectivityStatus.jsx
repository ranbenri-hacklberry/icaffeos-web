import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { isLocalInstance } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { resolveUrl, CORTEX_CLOUD_URL, BACKEND_CLOUD_URL } from '../utils/apiUtils';
import db from '../db/database';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';

/**
 * ConnectivityStatus Component
 * Displays the current business name, connection status, and last sync time.
 */
const ConnectivityStatus = ({ mode = 'fixed', invert = false, forceShow = false, className = '' }) => {
    const location = useLocation();
    const { currentUser } = useAuth();
    const { t, i18n } = useTranslation();
    const { isDarkMode } = useTheme();
    const [isLocal, setIsLocal] = useState(false);
    const [lastSyncLabel, setLastSyncLabel] = useState('');
    const [pendingCount, setPendingCount] = useState(0);
    const [isN150Down, setIsN150Down] = useState(false);
    const [machineName, setMachineName] = useState('Ryzen AI');

    const isManagerPage = location.pathname.startsWith('/data-manager') ||
        location.pathname.startsWith('/super-admin') ||
        location.pathname.startsWith('/dexie-admin') ||
        location.pathname.startsWith('/prep') ||
        location.pathname.startsWith('/kds') ||
        location.pathname.startsWith('/inventory') ||
        location.pathname === '/' ||
        location.pathname === '/music' ||
        location.pathname.startsWith('/music') ||
        location.pathname.startsWith('/mode-selection') ||
        location.pathname.startsWith('/menu-ordering') ||
        location.pathname.startsWith('/menu-editor') ||
        location.pathname.startsWith('/ipad-menu-editor');

    useEffect(() => {
        const checkStatus = async () => {
            const isLocalClient = window.location.hostname !== new URL(CORTEX_CLOUD_URL).hostname &&
                window.location.hostname !== new URL(BACKEND_CLOUD_URL).hostname &&
                window.location.hostname !== 'icaffe.vercel.app';
            setIsLocal(isLocalClient);

            try {
                const baseUrl = await resolveUrl();
                if (baseUrl === BACKEND_CLOUD_URL || baseUrl === CORTEX_CLOUD_URL) {
                    const isCloudDomain = window.location.hostname.includes('vercel.app') ||
                        window.location.hostname.includes('run.app') ||
                        window.location.hostname.includes('hacklberryfinn.com');

                    setIsN150Down(!isCloudDomain);
                    setMachineName(isCloudDomain ? 'Cloud' : 'Offline');
                    return;
                }

                setIsN150Down(false);
                setMachineName(t('pos.local_pos_engine', 'Local POS Engine'));
            } catch (err) {
                console.warn('Connectivity check failed:', err);
                setIsN150Down(false);
            }

            try {
                const count = await db.offline_queue_v3.where('status').equals('pending').count();
                setPendingCount(count);
            } catch { /* ignore */ }

            const lastSync = localStorage.getItem('last_sync_time');
            if (lastSync) {
                const diffMin = Math.floor((Date.now() - parseInt(lastSync)) / 60000);
                if (diffMin < 1) setLastSyncLabel(t('pos.just_synced', 'Synced now'));
                else if (diffMin < 60) setLastSyncLabel(t('pos.synced_ago', '{{count}}m ago', { count: diffMin }));
                else {
                    const date = new Date(parseInt(lastSync));
                    setLastSyncLabel(date.toLocaleTimeString(i18n.language === 'he' ? 'he-IL' : 'en-US', { hour: '2-digit', minute: '2-digit' }));
                }
            }
        };

        checkStatus();
        const interval = setInterval(checkStatus, 5000);
        return () => clearInterval(interval);
    }, []);

    if (!forceShow && isManagerPage) return null;
    if (mode === 'fixed' && isManagerPage) return null;

    const displayName = currentUser?.business_name || '';

    const Content = () => (
        <div className={`flex flex-col items-start pointer-events-auto ${className}`}>
            <div className={`text-[17px] font-black tracking-tight leading-none mb-0.5 whitespace-nowrap drop-shadow-sm/50 ${(isDarkMode || invert) ? 'text-white' : 'text-slate-900'}`}>
                {displayName}
            </div>
            <div className="flex items-center gap-1.5">
                <div
                    onClick={() => window.dispatchEvent(new CustomEvent('open-sync-modal'))}
                    className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity"
                >
                    <div className="relative flex h-1.5 w-1.5">
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isN150Down ? 'bg-red-400' : (pendingCount > 0 ? 'bg-amber-400' : 'bg-emerald-400')}`}></span>
                        <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${isN150Down ? 'bg-red-500' : (pendingCount > 0 ? 'bg-amber-500' : 'bg-emerald-500')}`}></span>
                    </div>
                    <span className={`text-[10px] font-bold leading-none ${isN150Down ? ((isDarkMode || invert) ? 'text-red-400' : 'text-red-800') : ((isDarkMode || invert) ? 'text-emerald-400' : 'text-emerald-700')}`}>
                        {isN150Down ? (window.location.hostname.includes('vercel.app') ? 'Not Connected' : 'Offline') : (machineName === 'n150' ? 'Ryzen AI' : machineName)}
                    </span>
                </div>
            </div>
        </div>
    );

    if (mode === 'inline') return <Content />;

    return (
        <div
            className="fixed top-3 z-[9999] pointer-events-none select-none flex flex-col items-end"
            style={{ left: 'calc(50% - 160px)', transform: 'translateX(-100%)' }}
            dir={i18n.language === 'he' ? 'rtl' : 'ltr'}
        >
            <Content />
        </div>
    );
};

export default ConnectivityStatus;
