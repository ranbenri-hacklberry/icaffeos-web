import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    LayoutDashboard,
    FileText,
    LogOut,
    RefreshCcw,
    Reply,
    Settings,
    ShoppingCart
} from 'lucide-react';
import { initialLoad } from '@/services/syncService';
import { useAuth } from '@/context/AuthContext';
import UnifiedHeader from '@/components/UnifiedHeader';

const ManagerHeader = ({ activeTab, onTabChange, currentUser, isImpersonating, onLogout }) => {
    const navigate = useNavigate();
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncProgress, setSyncProgress] = useState(0);

    const handleManualSync = async () => {
        if (isSyncing || !currentUser?.business_id) return;
        setIsSyncing(true);
        setSyncProgress(0);
        try {
            await initialLoad(currentUser.business_id, (table, count, progress) => {
                setSyncProgress(progress);
            });
        } catch (err) {
            console.error('Manual sync failed:', err);
        } finally {
            setIsSyncing(false);
            setSyncProgress(0);
        }
    };

    const navItems = [
        { id: 'orders', label: 'הזמנות', icon: <ShoppingCart size={16} />, path: '/data-manager-interface' },
        { id: 'reports', label: 'דוחות', icon: <FileText size={16} />, path: '/data-manager-interface' },
        { id: 'settings', label: 'הגדרות', icon: <Settings size={16} />, path: '/data-manager-interface' }
    ];

    const handleNavClick = (item) => {
        if (item.id === activeTab && window.location.pathname === item.path) return;
        if (onTabChange && item.path === '/data-manager-interface') {
            if (window.location.pathname === '/data-manager-interface') {
                onTabChange(item.id);
            } else {
                navigate(item.path, { state: { initialTab: item.id } });
            }
        } else {
            navigate(item.path);
        }
    };

    const headerTabs = navItems.map(item => ({
        id: item.id,
        label: item.label,
        icon: item.icon,
        isActive: activeTab === item.id,
        onClick: () => handleNavClick(item)
    }));

    return (
        <UnifiedHeader
            title="קוקפיט מנהלים"
            subtitle={isImpersonating ? "מצב התחזות מנהל" : "ניהול העסק"}
            headerTabs={headerTabs}
        >
            <div className="flex items-center gap-2">
                <button
                    onClick={handleManualSync}
                    disabled={isSyncing}
                    className={`group flex items-center justify-center h-9 px-3 rounded-xl transition-all border shadow-sm text-xs font-bold ${
                        isSyncing
                            ? 'bg-blue-500/10 border-blue-500/50 text-blue-600'
                            : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                    }`}
                    title="סנכרן נתונים מהענן"
                >
                    <RefreshCcw size={14} className={isSyncing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'} />
                    <span className="mr-1.5 hidden sm:inline">
                        {isSyncing ? `${syncProgress}%` : 'סנכרן מהענן'}
                    </span>
                </button>

                <button
                    onClick={onLogout}
                    className="group flex items-center justify-center w-9 h-9 rounded-xl transition-all bg-white border border-slate-200 text-slate-500 hover:bg-red-50 hover:text-red-600 hover:border-red-200 shadow-sm"
                    title={isImpersonating ? 'חזור לסופר אדמין' : 'התנתק'}
                >
                    {isImpersonating ? <Reply size={16} /> : <LogOut size={14} />}
                </button>
            </div>
        </UnifiedHeader>
    );
};

export default ManagerHeader;
