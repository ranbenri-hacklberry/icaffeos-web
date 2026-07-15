import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    Activity,
    Clock,
    Thermometer,
    Network,
    RefreshCw,
    Database,
    Zap,
    Cpu,
    ChevronRight,
    Key
} from 'lucide-react';
import MatrixRain from '@/components/common/MatrixRain';


import { supabase } from '@/lib/supabase';

/**
 * 🛰️ BusinessNodeCard
 * High-density observability integrated directly into the business management card.
 * Features: Live KDS Preview (33% width), Health Text Labels, and Hardware Metrics.
 */
const BusinessNodeCard = ({ business, onClick, onDiagnostics }) => {
    const [health, setHealth] = useState({ 4028: 'pending', 8081: 'pending', 54321: 'pending' });
    const [metrics, setMetrics] = useState({ temp: '--', node: 'N150', integrations: {} });
    const [lowStockCount, setLowStockCount] = useState(0);

    useEffect(() => {
        const fetchLowStock = async () => {
            const { data } = await supabase
                .from('inventory_items')
                .select('current_stock, low_stock_threshold_units')
                .eq('business_id', business.id);

            if (data) {
                const count = data.filter(item => item.current_stock < item.low_stock_threshold_units).length;
                setLowStockCount(count);
            }
        };
        fetchLowStock();
    }, [business.id]);
    const getBackendUrl = () => {
        const hostname = window.location.hostname;
        return `http://${hostname}:8081`;
    };

    const [isRefreshing, setIsRefreshing] = useState(false);
    const [screenshotUrl, setScreenshotUrl] = useState(`${getBackendUrl()}/screenshots/latest_kds_${business.id}.png?t=${Date.now()}`);
    const [lastFetch, setLastFetch] = useState(new Date());

    useEffect(() => {
        setScreenshotUrl(`${getBackendUrl()}/screenshots/latest_kds_${business.id}.png?t=${Date.now()}`);
    }, [business.id]);

    useEffect(() => {
        const fetchHealth = async () => {
            try {
                const baseUrl = window.location.port === '8081' ? '' : `http://${window.location.hostname}:8081`;
                const response = await fetch(`${baseUrl}/api/system/health`);

                if (response.ok) {
                    const data = await response.json();
                    setHealth({
                        4028: 'online', // Frontend is online
                        8081: 'online', // Backend is online
                        54321: data.services?.database === 'online' ? 'online' : 'offline'
                    });
                    setMetrics(prev => ({
                        ...prev,
                        temp: data.services?.temp || prev.temp,
                        integrations: data.services || {}
                    }));
                } else {
                    setHealth({ 4028: 'online', 8081: 'offline', 54321: 'offline' });
                }
                setLastFetch(new Date());
            } catch (e) {
                setHealth({ 4028: 'online', 8081: 'offline', 54321: 'offline' });
            }
        };

        fetchHealth();
        const interval = setInterval(fetchHealth, 15000);
        return () => clearInterval(interval);
    }, [business.id]);

    const handleManualRefresh = async (e) => {
        e.stopPropagation();
        if (isRefreshing) return;
        setIsRefreshing(true);
        try {
            await fetch(`/api/system/capture-screenshot?businessId=${business.id}`);
            setTimeout(() => {
                setImageError(false); // Reset error state on refresh
                setScreenshotUrl(`${getBackendUrl()}/screenshots/latest_kds_${business.id}.png?cache_bust=${Date.now()}`);
                setLastFetch(new Date());
                setIsRefreshing(false);
            }, 3000); // Wait a bit longer for capture
        } catch (e) {
            setIsRefreshing(false);
        }
    };

    const [imageError, setImageError] = useState(false);

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => onClick(business)}
            className="group relative bg-slate-900/40 hover:bg-slate-900/60 border border-white/5 hover:border-blue-500/30 rounded-2xl overflow-hidden transition-all flex h-52 cursor-pointer shadow-lg"
        >
            {/* LEFT: Live KDS Preview (1/3) */}
            <div className="w-1/3 relative bg-black border-r border-white/5 overflow-hidden">
                {!imageError ? (
                    <img
                        src={screenshotUrl}
                        alt="KDS View"
                        onError={() => setImageError(true)}
                        className={`w-full h-full object-cover transition-all duration-700 ${isRefreshing ? 'opacity-20 blur-md' : 'opacity-60 group-hover:opacity-100'}`}
                    />
                ) : (
                    <div className="w-full h-full relative overflow-hidden bg-black/90">
                        <MatrixRain />
                    </div>
                )}

                <button
                    onClick={handleManualRefresh}
                    className="absolute bottom-2 right-2 p-2 bg-black/40 hover:bg-blue-600 rounded-lg text-white/50 hover:text-white transition-all backdrop-blur-md border border-white/10 z-20"
                >
                    <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
                </button>
                <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/60 px-2 py-1 rounded text-[9px] font-black text-white/40 uppercase tracking-widest border border-white/5 z-20">
                    <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${imageError ? 'bg-red-500' : 'bg-green-500'}`} />
                    {imageError ? 'OFFLINE' : 'LIVE'}
                </div>
            </div>

            {/* RIGHT: Meta & Health (2/3) */}
            <div className="w-2/3 p-5 flex flex-col justify-between" dir="rtl">
                {/* Header: Title & Health Labels */}
                <div>
                    <div className="flex items-start justify-between mb-3">
                        <div>
                            <h3 className="text-lg font-black text-slate-100 group-hover:text-blue-400 transition-colors">
                                {business.name}
                            </h3>
                            <div className="flex gap-3 mt-1.5">
                                <span className="flex items-center gap-1">
                                    <div className={`w-1.5 h-1.5 rounded-full ${health[4028] === 'online' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                    <span className="text-[10px] font-black text-slate-400">FE</span>
                                </span>
                                <span className="flex items-center gap-1">
                                    <div className={`w-1.5 h-1.5 rounded-full ${health[8081] === 'online' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                    <span className="text-[10px] font-black text-slate-400">BE</span>
                                </span>
                                <span className="flex items-center gap-1">
                                    <div className={`w-1.5 h-1.5 rounded-full ${health[54321] === 'online' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                    <span className="text-[10px] font-black text-slate-400">DB</span>
                                </span>
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">
                                {new Date(lastFetch).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <div className="flex items-center gap-1.5 text-xs bg-white/5 px-2.5 py-1 rounded-md border border-white/5">
                                <Thermometer size={12} className="text-amber-500" />
                                <span className="font-mono font-bold text-slate-300">{metrics.temp}</span>
                            </div>

                            {/* Low Stock Alert */}
                            {lowStockCount > 0 && (
                                <div className="mt-1 flex items-center gap-1.5 px-2 py-0.5 bg-red-500/10 border border-red-500/20 rounded text-[10px] font-bold text-red-400 animate-pulse">
                                    <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                                    <span>{lowStockCount} חסרים במלאי</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Integrated Keys Status (Text Only) */}
                    <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4 opacity-80 group-hover:opacity-100 transition-opacity">
                        <KeyText label="Gemini" status={metrics.integrations?.gemini === 'online'} />
                        <KeyText label="Gateway" status={metrics.integrations?.cortex_gateway === 'online'} />
                        <KeyText label="Ollama" status={metrics.integrations?.ollama === 'online'} />
                        <KeyText label="DB" status={metrics.integrations?.database === 'online'} />
                        <KeyText label="BE" status={health[8081] === 'online'} />
                    </div>
                </div>

                {/* Footer: Actions & HW Info */}
                <div className="flex items-center justify-between border-t border-white/5 pt-4 mt-auto">
                    <div className="flex items-center gap-2">
                        <div
                            onClick={(e) => { e.stopPropagation(); onDiagnostics(business); }}
                            className="p-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg border border-blue-500/20 transition-all active:scale-90"
                        >
                            <Activity size={14} />
                        </div>
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{metrics.node}</span>
                    </div>

                    <div className="flex items-center gap-1.5 text-blue-500 text-[11px] font-black">
                        <span>ניהול עסק</span>
                        <ChevronRight size={14} />
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

const KeyText = ({ label, status }) => (
    <div className="flex items-center gap-1.5">
        <div className={`w-1.5 h-1.5 rounded-full ${status ? 'bg-emerald-500' : 'bg-red-500'}`} />
        <span className="text-[10px] font-black uppercase text-slate-400">{label}</span>
    </div>
);

export default BusinessNodeCard;
