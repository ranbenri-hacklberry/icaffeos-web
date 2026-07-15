import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { useConnection } from '@/context/ConnectionContext';

/**
 * BusinessInfoBar - Thin bar showing business name and version
 * Used below headers on all screens for consistent branding
 */
const BusinessInfoBar = () => {
    const { currentUser, appVersion } = useAuth();
    const { status } = useConnection();

    const isOnline = status === 'online' || status === 'local-only' || status === 'cloud-only';
    const businessName = currentUser?.impersonating_business_name || currentUser?.business_name || null;

    return (
        <div className="bg-slate-800 px-4 py-1.5 flex items-center justify-between shrink-0" dir="rtl">
            <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-400 shadow-[0_0_4px_rgba(34,197,94,0.6)]' : 'bg-red-400'}`} />
                <span className={`text-[10px] font-bold leading-none ${isOnline ? 'text-green-400' : 'text-red-400'}`}>
                    {isOnline ? (businessName || 'מחובר') : 'לא מחובר'}
                </span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">{appVersion || 'v1.0'}</span>
        </div>
    );
};

export default BusinessInfoBar;
