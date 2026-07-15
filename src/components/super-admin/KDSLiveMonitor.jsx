import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/database';
import { supabase } from '../../lib/supabase';
import {
    Monitor,
    Activity,
    Clock,
    CheckCircle2,
    Cpu,
    Thermometer,
    Network,
    RefreshCw,
    Shield,
    Database,
    Zap,
    AlertTriangle,
    Key,
    Server
} from 'lucide-react';

/**
 * 🚀 KDSLiveMonitor - Senior Architect Version (Final)
 * Zero-latency observability for Morefine N150 edge nodes.
 * Hybrid Dexie + Supabase Realtime Architecture.
 */
const KDSLiveMonitor = () => {
    // --- 1. DATA LAYER (DEXIE PRIMARY) ---
    const activeCount = useLiveQuery(() => db.active_order_items.count(), []);
    const recentOrders = useLiveQuery(() =>
        db.active_order_items.orderBy('created_at').reverse().limit(6).toArray(),
        []);

    // --- 2. CONNECTIVITY & HEALTH STATE ---
    const [health, setHealth] = useState({
        4028: 'pending', // Frontend
        8081: 'pending', // Backend
        54321: 'pending' // Local Supabase
    });
    const [metrics, setMetrics] = useState({ temp: '--', node: 'N150', integrations: {} });
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [screenshotUrl, setScreenshotUrl] = useState(`/screenshots/latest_kds.png?t=${Date.now()}`);
    const [lastFetch, setLastFetch] = useState(new Date());

    // --- 3. PROBE LOOP (30s POLLING) ---
    useEffect(() => {
        const probeNodes = async () => {
            const ports = [4028, 8081, 54321];
            const nextHealth = { ...health };

            for (const port of ports) {
                try {
                    const isSameOrigin = window.location.port === port.toString();
                    const baseUrl = isSameOrigin ? '' : `http://${window.location.hostname}:${port}`;
                    const url = port === 8081 ? '/api/system/validate-integrations' : (port === 54321 ? '/rest/v1/' : '/');

                    const controller = new AbortController();
                    const timeout = setTimeout(() => controller.abort(), 2000);

                    const response = await fetch(`${baseUrl}${url}`, {
                        method: port === 8081 ? 'GET' : 'HEAD',
                        signal: controller.signal
                    });

                    if (port === 8081 && response.ok) {
                        const data = await response.json();
                        setMetrics({
                            temp: data.checks?.hardware?.temp || 'N/A',
                            node: data.checks?.hardware?.node || 'N150',
                            integrations: data.checks || {}
                        });
                    }

                    clearTimeout(timeout);
                    nextHealth[port] = response.ok ? 'online' : 'offline';
                } catch (e) {
                    nextHealth[port] = 'offline';
                }
            }
            setHealth(nextHealth);
        };

        probeNodes();
        const interval = setInterval(probeNodes, 30000);
        return () => clearInterval(interval);
    }, []);

    // --- 4. REFRESH LOGIC ---
    const handleManualRefresh = async () => {
        if (isRefreshing) return;
        setIsRefreshing(true);
        try {
            await fetch('/api/system/capture-screenshot');
            setTimeout(() => {
                setScreenshotUrl(`/screenshots/latest_kds.png?cache_bust=${Date.now()}`);
                setLastFetch(new Date());
                setIsRefreshing(false);
            }, 1500);
        } catch (e) {
            setIsRefreshing(false);
        }
    };

    // --- 5. REALTIME SYNC (SUPABASE FALLBACK) ---
    useEffect(() => {
        const channel = supabase
            .channel('kds_orders_sync')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'active_order_items' }, () => {
                console.log('Realtime Order Sync Received');
            })
            .subscribe();

        return () => supabase.removeChannel(channel);
    }, []);

    // Helper: Pulse Indicator
    const Pulse = ({ status }) => (
        <div className={`w-1.5 h-1.5 rounded-full ${status === 'online' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse' :
                status === 'offline' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]' : 'bg-slate-600'
            }`} />
    );

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-6xl bg-slate-900/90 backdrop-blur-3xl border border-white/10 rounded-[2rem] overflow-hidden shadow-[0_30px_60px_-15px_rgba(0,0,0,0.7)] flex flex-col"
            dir="ltr"
        >
            {/* STICKY HEADER: Global Health */}
            <div className="bg-white/[0.03] border-b border-white/5 px-8 py-4 flex items-center justify-between">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-600/20 rounded-xl border border-blue-500/30">
                            <Activity size={18} className="text-blue-400" />
                        </div>
                        <div>
                            <h3 className="text-xs font-black text-white uppercase tracking-tight">Node Observability</h3>
                            <div className="flex items-center gap-3 mt-0.5">
                                <div className="flex items-center gap-1.5 bg-black/30 px-2 py-0.5 rounded-md border border-white/5">
                                    <Pulse status={health[4028]} />
                                    <span className="text-[8px] font-bold text-slate-500 font-mono">4028</span>
                                </div>
                                <div className="flex items-center gap-1.5 bg-black/30 px-2 py-0.5 rounded-md border border-white/5">
                                    <Pulse status={health[8081]} />
                                    <span className="text-[8px] font-bold text-slate-500 font-mono">8081</span>
                                </div>
                                <div className="flex items-center gap-1.5 bg-black/30 px-2 py-0.5 rounded-md border border-white/5">
                                    <Pulse status={health[54321]} />
                                    <span className="text-[8px] font-bold text-slate-500 font-mono">54321</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    {health[54321] === 'offline' && (
                        <motion.div
                            animate={{ opacity: [0.5, 1, 0.5] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 px-3 py-1 rounded-full text-[9px] font-black text-red-500"
                        >
                            <AlertTriangle size={10} />
                            LOCAL MODE
                        </motion.div>
                    )}
                    <div className="flex items-center gap-4">
                        <div className="flex flex-col items-end">
                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">CPU TEMP</span>
                            <div className="flex items-center gap-1.5">
                                <Thermometer size={12} className={parseFloat(metrics.temp) > 60 ? 'text-red-500' : 'text-amber-500'} />
                                <span className="text-[10px] font-black font-mono text-slate-200">{metrics.temp}</span>
                            </div>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">ACTIVE NODE</span>
                            <div className="flex items-center gap-1.5">
                                <Cpu size={12} className="text-blue-400" />
                                <span className="text-[10px] font-black font-mono text-slate-200">{metrics.node}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* MAIN CONTENT: 1/3 Screenshot | 2/3 Intelligence Panel */}
            <div className="flex flex-col lg:flex-row min-h-[300px] lg:h-[340px]">

                {/* LEFT: Live Screenshot (33% Width) */}
                <div className="w-full lg:w-1/3 relative bg-black group overflow-hidden border-b lg:border-b-0 lg:border-r border-white/5">
                    <img
                        src={screenshotUrl}
                        alt="Live Screenshot"
                        className={`w-full h-full object-cover transition-all duration-1000 ${isRefreshing ? 'opacity-20 scale-110 blur-xl' : 'opacity-70 group-hover:opacity-100'}`}
                    />

                    <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-xl px-2 py-1 rounded-md border border-white/10 flex items-center gap-1.5">
                        <div className="w-1 h-1 bg-red-500 rounded-full animate-ping" />
                        <span className="text-[8px] font-black text-white tracking-widest uppercase">Stream</span>
                    </div>

                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/80 to-transparent p-4 pointer-events-none">
                        <div className="flex items-center gap-2 text-[9px] font-black text-white/40">
                            <Clock size={10} />
                            <span>SYNC: {lastFetch.toLocaleTimeString('he-IL')}</span>
                        </div>
                    </div>

                    <button
                        onClick={handleManualRefresh}
                        disabled={isRefreshing}
                        className="absolute bottom-4 right-4 p-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl border border-blue-400/50 text-white shadow-2xl transition-all hover:scale-110 active:scale-95 disabled:bg-slate-800"
                    >
                        <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
                    </button>
                </div>

                {/* RIGHT: Intelligence Panel (66% Width) */}
                <div className="w-full lg:w-2/3 bg-slate-950/40 flex flex-col p-6 gap-6 overflow-hidden">

                    {/* SECTION 1: Integration Status (Splash details) */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        <StatusCard icon={<Zap size={12} />} label="Ollama" status={metrics.integrations?.ollama?.status === 'ok'} msg={metrics.integrations?.ollama?.message} />
                        <StatusCard icon={<Key size={12} />} label="Gemini" status={metrics.integrations?.gemini?.status === 'ok'} msg={metrics.integrations?.gemini?.message} />
                        <StatusCard icon={<Key size={12} />} label="Grok" status={metrics.integrations?.grok?.status === 'ok'} msg={metrics.integrations?.grok?.message} />
                        <StatusCard icon={<Key size={12} />} label="Claude" status={metrics.integrations?.claude?.status === 'ok'} msg={metrics.integrations?.claude?.message} />
                        <StatusCard icon={<Network size={12} />} label="WhatsApp" status={metrics.integrations?.whatsapp?.status === 'ok'} msg={metrics.integrations?.whatsapp?.message} />
                    </div>

                    <div className="h-px bg-white/5" />

                    {/* SECTION 2: Real-time Order Feed */}
                    <div className="flex flex-col gap-3 flex-1 overflow-hidden">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Database size={12} className="text-slate-500" />
                                <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Live Flow (Dexie)</h4>
                            </div>
                            <span className="text-[9px] font-black text-blue-500 font-mono tracking-tighter">
                                {activeCount || 0} IN QUEUE
                            </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 overflow-y-auto pr-1 custom-scrollbar">
                            <AnimatePresence mode="popLayout">
                                {recentOrders?.map((order, idx) => (
                                    <motion.div
                                        key={order.id}
                                        initial={{ opacity: 0, x: 10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -10 }}
                                        transition={{ delay: idx * 0.03 }}
                                        className="bg-white/[0.03] border border-white/5 p-2 rounded-xl flex items-center justify-between group hover:bg-white/[0.06] hover:border-white/10 transition-all"
                                    >
                                        <div className="flex items-center gap-2.5 overflow-hidden">
                                            <div className="w-1 h-1 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-black text-slate-200">#{order.order_id.split('-')[0].toUpperCase()}</span>
                                                <span className="text-[8px] font-medium text-slate-600 truncate max-w-[100px]">ID: {order.id.split('-')[0]}</span>
                                            </div>
                                        </div>
                                        <div className="px-1.5 py-0.5 bg-blue-500/10 rounded-md text-[8px] font-black text-blue-400 uppercase">
                                            {order.item_status}
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                            {(!recentOrders || recentOrders.length === 0) && (
                                <div className="col-span-full py-6 flex flex-col items-center justify-center opacity-10">
                                    <Server size={32} className="mb-2" />
                                    <span className="text-[9px] font-black uppercase tracking-widest">No Traffic</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* MINIMAL FOOTER: Infrastructure Details */}
            <div className="bg-black/40 px-8 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-8">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 size={10} className="text-emerald-500" />
                        <span className="text-[9px] font-black text-slate-500 uppercase">v5.0.2 Stable Cluster</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Network size={10} className="text-blue-500" />
                        <span className="text-[9px] font-mono text-slate-700">100.97.166.104</span>
                    </div>
                </div>
                <div className="text-[9px] font-black text-slate-700 uppercase tracking-widest">N150_NODE_EDGE</div>
            </div>
        </motion.div>
    );
};

// Compact Status Card Component
const StatusCard = ({ icon, label, status, msg }) => (
    <div className="bg-black/40 border border-white/5 p-2 rounded-xl flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
            <div className="text-slate-500">{icon}</div>
            <div className={`w-1 h-1 rounded-full ${status ? 'bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]' : 'bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.5)]'}`} />
        </div>
        <div className="overflow-hidden">
            <div className="text-[8px] font-black text-slate-500 uppercase tracking-tighter truncate">{label}</div>
            <div className={`text-[7px] font-bold truncate leading-none mt-0.5 ${status ? 'text-slate-400' : 'text-red-900/80'}`}>{msg || 'No Data'}</div>
        </div>
    </div>
);

export default KDSLiveMonitor;
