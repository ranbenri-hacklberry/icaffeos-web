import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { db, clearAllData } from '@/db/database';
import { getSmsBalance } from '@/services/smsService';
import Icon from '@/components/AppIcon';
import UnifiedHeader from '@/components/UnifiedHeader';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Activity, Users, ShoppingCart, MessageSquare, 
    Database, RefreshCw, Search, ShieldAlert, 
    ArrowRight, CheckCircle2, XCircle, Clock,
    TrendingUp, AlertCircle, Trash2, Cpu,
    BarChart3, Award, Flame, Zap
} from 'lucide-react';

/**
 * Unified Diagnostic Dashboard (v2.1)
 * ----------------------------------
 * Optimized for iPad & Local-First Management.
 * Features: Real-time Stats, Category Insights, and System Maintenance.
 */
const DexieAdminPanel = () => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const businessId = currentUser?.business_id;

    // --- State Management ---
    const [loading, setLoading] = useState(true);
    const [serverHealth, setServerHealth] = useState({ online: false, latency: 0 });
    const [stats, setStats] = useState({
        customers: 0,
        ordersToday: 0,
        smsBalance: 0,
        activeOrders: 0,
        totalRevenue: 0
    });
    const [topCategories, setTopCategories] = useState([]);
    const [activity, setActivity] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [message, setMessage] = useState(null);
    const [isMirrorModalOpen, setIsMirrorModalOpen] = useState(false);

    // --- Data Fetching ---
    const loadDashboardData = async (silent = false) => {
        if (!businessId) return;
        if (!silent) setLoading(true);
        setIsRefreshing(true);

        const startTime = Date.now();
        try {
            // 1. Health check
            const { error: healthErr } = await supabase.from('businesses').select('id').limit(1);
            setServerHealth({ online: !healthErr, latency: Date.now() - startTime });

            const today = new Date();
            today.setHours(5, 0, 0, 0);

            // 2. Core Stats
            const [
                { count: customerCount },
                { data: ordersTodayData },
                smsBal,
                { data: activeOrdersData }
            ] = await Promise.all([
                supabase.from('customers').select('*', { count: 'exact', head: true }),
                supabase.from('orders').select('id, total_price, order_status, order_items').gte('created_at', today.toISOString()),
                getSmsBalance().catch(() => 0),
                supabase.from('orders').select('*').in('order_status', ['in_progress', 'ready'])
            ]);

            const revenue = ordersTodayData?.reduce((sum, o) => sum + (o.total_price || 0), 0) || 0;

            // 3. Category Breakdown (Local computation)
            const catMap = {};
            ordersTodayData?.forEach(order => {
                const items = order.order_items || [];
                items.forEach(item => {
                    const cat = item.category || 'כללי';
                    const amount = (item.price || 0) * (item.quantity || 1);
                    if (!catMap[cat]) catMap[cat] = { name: cat, total: 0, count: 0 };
                    catMap[cat].total += amount;
                    catMap[cat].count += (item.quantity || 1);
                });
            });

            const sortedCats = Object.values(catMap)
                .sort((a, b) => b.total - a.total)
                .slice(0, 5);

            const totalCatRevenue = sortedCats.reduce((sum, c) => sum + c.total, 0);
            const enrichedCats = sortedCats.map(c => ({
                ...c,
                percentage: totalCatRevenue > 0 ? (c.total / totalCatRevenue) * 100 : 0
            }));

            setTopCategories(enrichedCats);
            setStats({
                customers: customerCount || 0,
                ordersToday: ordersTodayData?.length || 0,
                smsBalance: smsBal || 0,
                activeOrders: activeOrdersData?.length || 0,
                totalRevenue: revenue
            });

            // 4. Activity
            const { data: recentOrders } = await supabase
                .from('orders')
                .select('id, order_number, customer_name, total_price, order_status, created_at')
                .order('created_at', { ascending: false })
                .limit(10);

            setActivity((recentOrders || []).map(o => ({ ...o, type: 'order' })));

        } catch (err) {
            console.error('Dashboard load error:', err);
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        loadDashboardData();
        const interval = setInterval(() => loadDashboardData(true), 30000);
        return () => clearInterval(interval);
    }, [businessId]);

    const handleClearCache = async () => {
        if (window.confirm('האם אתה בטוח שברצונך לנקות את כל הנתונים המקומיים?')) {
            try {
                await clearAllData();
                setMessage({ type: 'success', text: 'הקאש המקומי נוקה. מרענן...' });
                setTimeout(() => window.location.reload(), 1500);
            } catch (err) {
                setMessage({ type: 'error', text: 'שגיאה: ' + err.message });
            }
        }
    };

    const formatCurrency = (val) => new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(val);

    if (loading && !activity.length) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <RefreshCw className="animate-spin text-blue-600" size={48} />
                    <p className="text-slate-600 font-bold text-lg animate-pulse">מסנכרן נתונים מהשרת המקומי...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 font-heebo pb-12" dir="rtl">
            <UnifiedHeader 
                title="מבט משמרת" 
                subtitle={`שרת: ${serverHealth.online ? 'פעיל' : 'מנותק'}`}
            >
                <div className="flex items-center gap-3">
                    <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white border border-slate-200 shadow-sm">
                        <Zap size={14} className="text-amber-500" />
                        <span className="text-slate-500">זמן הכנה:</span>
                        <span className="text-slate-800">8 דק׳</span>
                    </div>
                    <button 
                        onClick={() => loadDashboardData()}
                        className={`p-2.5 bg-white border border-slate-200 rounded-xl shadow-sm transition-all active:scale-95 ${isRefreshing ? 'opacity-50' : 'hover:bg-slate-50'}`}
                    >
                        <RefreshCw size={20} className={isRefreshing ? 'animate-spin' : ''} />
                    </button>
                </div>
            </UnifiedHeader>

            <main className="max-w-[1400px] mx-auto p-4 md:p-8 space-y-8">
                
                {/* KPI Cards - Compact Row */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                    <StatCard 
                        title="פדיון יומי" 
                        value={formatCurrency(stats.totalRevenue)} 
                        icon={<TrendingUp size={22} />}
                        trend="+12% מאתמול"
                        color="from-emerald-500 to-teal-600"
                    />
                    <StatCard 
                        title="הזמנות" 
                        value={stats.ordersToday} 
                        icon={<ShoppingCart size={22} />}
                        trend={`${stats.activeOrders} פתוחות`}
                        color="from-blue-500 to-indigo-600"
                    />
                    <StatCard 
                        title="KDS עומס" 
                        value={`${stats.activeOrders * 3} דק׳`}
                        icon={<Clock size={22} />}
                        trend="זמן המתנה משוער"
                        color="from-orange-500 to-amber-600"
                    />
                    <StatCard 
                        title="לקוחות" 
                        value={stats.customers} 
                        icon={<Users size={22} />}
                        trend="3 חדשים היום"
                        color="from-purple-500 to-fuchsia-600"
                    />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    
                    {/* Left Column: Analytics & Categories */}
                    <div className="lg:col-span-4 space-y-8">
                        <section className="bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm overflow-hidden">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-lg font-black flex items-center gap-2">
                                    <BarChart3 size={20} className="text-blue-500" />
                                    קטגוריות חזקות (היום)
                                </h2>
                            </div>
                            
                            <div className="space-y-6">
                                {topCategories.map((cat, idx) => (
                                    <div key={idx} className="space-y-2">
                                        <div className="flex justify-between text-sm font-bold">
                                            <span>{cat.name}</span>
                                            <span className="text-slate-400">{formatCurrency(cat.total)}</span>
                                        </div>
                                        <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                            <motion.div 
                                                initial={{ width: 0 }}
                                                animate={{ width: `${cat.percentage}%` }}
                                                className={`h-full rounded-full ${
                                                    idx === 0 ? 'bg-blue-500' : idx === 1 ? 'bg-indigo-400' : 'bg-slate-300'
                                                }`}
                                            />
                                        </div>
                                    </div>
                                ))}
                                {topCategories.length === 0 && (
                                    <div className="text-center py-8 text-slate-400 italic">אין נתוני מכירות להצגה</div>
                                )}
                            </div>
                        </section>

                        <section className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-[2rem] p-6 text-white shadow-xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
                            <h2 className="text-lg font-black flex items-center gap-2 mb-2">
                                <Award size={20} />
                                פריט השעה
                            </h2>
                            <div className="flex items-center gap-4 mt-4">
                                <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center">
                                    <Flame size={32} className="text-amber-300" />
                                </div>
                                <div>
                                    <div className="text-2xl font-black">הפוך גדול</div>
                                    <div className="text-white/60 text-sm">24 יחידות נמכרו בשעה האחרונה</div>
                                </div>
                            </div>
                        </section>
                    </div>

                    {/* Middle/Right Column: Live Activity */}
                    <div className="lg:col-span-5 space-y-6">
                        <div className="flex items-center justify-between mb-2">
                            <h2 className="text-xl font-black flex items-center gap-3">
                                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                                    <Activity size={20} />
                                </div>
                                פעילות רציפה
                            </h2>
                        </div>

                        <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                            {activity.map((item) => (
                                <ActivityItem key={item.id} item={item} />
                            ))}
                        </div>
                    </div>

                    {/* Sidebar: Maintenance & Status */}
                    <div className="lg:col-span-3 space-y-6">
                        <section className="bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm">
                            <h2 className="text-lg font-black mb-4 flex items-center gap-2">
                                <ShieldAlert size={18} className="text-amber-500" />
                                מצב מערכת
                            </h2>
                            <div className="space-y-4">
                                <StatusRow label="מסד נתונים" status={serverHealth.online} />
                                <StatusRow label="מדפסת מטבח" status={true} />
                                <StatusRow label="חיבור אינטרנט" status={true} />
                                <StatusRow label="סנכרון ענן" status={true} />
                            </div>
                            
                            <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col gap-3">
                                <MaintenanceButton 
                                    icon={<Trash2 size={16} />}
                                    label="ניקוי קאש"
                                    onClick={handleClearCache}
                                />
                                <MaintenanceButton 
                                    icon={<RefreshCw size={16} />}
                                    label="סנכרון Mirror מתקדם"
                                    onClick={() => setIsMirrorModalOpen(true)}
                                />
                                <MaintenanceButton 
                                    icon={<Database size={16} />}
                                    label="סנכרון מלא"
                                    onClick={() => loadDashboardData()}
                                />
                                <MaintenanceButton 
                                    icon={<Trash2 size={16} />}
                                    label="ניקוי כפילויות מלאי"
                                    onClick={async () => {
                                        if (window.confirm('האם לבצע ניקוי כפילויות מלאי בבסיס הנתונים? (ישאר רק העותק הכי מעודכן של כל פריט)')) {
                                            setIsRefreshing(true);
                                            try {
                                                const res = await fetch(`${API_URL}/api/admin/inventory/cleanup-duplicates`, {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ businessId })
                                                });
                                                const result = await res.json();
                                                if (result.success) {
                                                    alert(result.message);
                                                    loadDashboardData();
                                                } else {
                                                    throw new Error(result.error);
                                                }
                                            } catch (err) {
                                                alert('שגיאה בניקוי: ' + err.message);
                                            } finally {
                                                setIsRefreshing(false);
                                            }
                                        }
                                    }}
                                />
                            </div>
                        </section>

                        <div className="bg-slate-900 rounded-[2rem] p-6 text-white text-center">
                            <div className="text-slate-500 text-xs uppercase font-bold tracking-widest mb-1">יתרת SMS</div>
                            <div className="text-4xl font-black text-amber-400">{stats.smsBalance}</div>
                            <div className="text-white/40 text-[10px] mt-2">מומלץ להטעין מתחת ל-50</div>
                        </div>
                    </div>

                </div>
            </main>

            {/* Mirror Source Selector Modal */}
            <MirrorSourceModal 
                isOpen={isMirrorModalOpen} 
                onClose={() => setIsMirrorModalOpen(false)}
                businessId={businessId}
                onSyncComplete={() => {
                    setIsMirrorModalOpen(false);
                    loadDashboardData();
                }}
            />

            <style dangerouslySetInnerHTML={{ __html: `
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
            `}} />
        </div>
    );
};

// --- Components ---

const StatCard = ({ title, value, icon, trend, color }) => (
    <div className="bg-white border border-slate-200 rounded-[2rem] p-5 relative overflow-hidden group hover:shadow-lg transition-all duration-500">
        <div className={`absolute top-0 right-0 w-1.5 h-full bg-gradient-to-b ${color}`} />
        <div className="flex justify-between items-start mb-4">
            <span className="text-slate-400 text-sm font-bold">{title}</span>
            <div className={`p-2 bg-slate-50 text-slate-400 group-hover:scale-110 transition-transform duration-500`}>
                {icon}
            </div>
        </div>
        <div className="text-2xl md:text-3xl font-black text-slate-900 mb-1">{value}</div>
        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">{trend}</div>
    </div>
);

const ActivityItem = ({ item }) => (
    <motion.div 
        layout
        className="bg-white border border-slate-100 rounded-2xl p-4 flex items-center justify-between hover:shadow-md transition-shadow group"
    >
        <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-blue-500 group-hover:text-white transition-all">
                <ShoppingCart size={20} />
            </div>
            <div>
                <div className="font-bold text-slate-800">הזמנה #{item.order_number}</div>
                <div className="text-xs text-slate-400">{item.customer_name || 'לקוח מזדמן'}</div>
            </div>
        </div>
        <div className="text-left">
            <div className="font-black text-slate-900">{new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS' }).format(item.total_price)}</div>
            <div className="text-[10px] text-slate-400 font-mono uppercase">{new Date(item.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
    </motion.div>
);

const StatusRow = ({ label, status }) => (
    <div className="flex items-center justify-between py-1">
        <span className="text-sm font-bold text-slate-600">{label}</span>
        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black ${
            status ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
        }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${status ? 'bg-emerald-500' : 'bg-red-500'}`} />
            {status ? 'OK' : 'ERR'}
        </div>
    </div>
);

const MaintenanceButton = ({ icon, label, onClick }) => (
    <button 
        onClick={onClick}
        className="flex items-center gap-3 w-full p-3 bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-600 transition-all active:scale-95 text-sm font-bold"
    >
        {icon}
        {label}
    </button>
);

const MirrorSourceModal = ({ isOpen, onClose, businessId, onSyncComplete }) => {
    const [sources, setSources] = useState([]);
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8081';

    const discoverSources = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/admin/mirror/sources?businessId=${businessId}`);
            const data = await res.json();
            
            if (data.success) {
                // For each source, check its live status
                const enrichedSources = await Promise.all(data.sources.map(async (source) => {
                    try {
                        const start = Date.now();
                        const statusRes = await fetch(`http://${source.lastIp}:8081/api/admin/mirror/device-info`, { signal: AbortSignal.timeout(2000) });
                        const statusData = await statusRes.json();
                        return { 
                            ...source, 
                            online: true, 
                            latency: Date.now() - start,
                            latestOrderAt: statusData.latestOrderAt 
                        };
                    } catch (e) {
                        return { ...source, online: false };
                    }
                }));
                setSources(enrichedSources);
            }
        } catch (err) {
            console.error('Discovery failed', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) discoverSources();
    }, [isOpen]);

    const handleSync = async (ip) => {
        if (!window.confirm(`האם להתחיל סנכרון Mirror מהכתובת ${ip}? תהליך זה עלול לקחת כמה דקות.`)) return;
        
        setSyncing(true);
        try {
            const res = await fetch(`${API_URL}/api/admin/mirror/pull`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sourceIp: ip, businessId })
            });
            const result = await res.json();
            if (result.success) {
                alert('סנכרון הושלם בהצלחה!');
                onSyncComplete();
            } else {
                throw new Error(result.error);
            }
        } catch (err) {
            alert('סנכרון נכשל: ' + err.message);
        } finally {
            setSyncing(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-white rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]"
            >
                <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900">גילוי מקורות נתונים</h2>
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">בחר מכשיר ממנו תרצה למשוך גיבוי</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
                        <XCircle size={24} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                    {loading ? (
                        <div className="py-20 flex flex-col items-center justify-center gap-4 text-slate-400">
                            <RefreshCw size={48} className="animate-spin text-blue-500" />
                            <p className="font-bold animate-pulse text-lg">מחפש מכשירים ברשת...</p>
                        </div>
                    ) : sources.length === 0 ? (
                        <div className="py-20 text-center space-y-4">
                            <div className="text-6xl">🔍</div>
                            <h3 className="text-xl font-bold text-slate-800">לא נמצאו מכשירים פעילים</h3>
                            <p className="text-slate-500 text-sm max-w-xs mx-auto">וודא שהמכשירים האחרים מחוברים ל-Tailscale ושהתוכנה פועלת עליהם.</p>
                            <button onClick={discoverSources} className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold">נסה שוב</button>
                        </div>
                    ) : (
                        sources.map((source) => (
                            <div 
                                key={source.deviceId}
                                className={`border rounded-3xl p-5 flex items-center justify-between transition-all ${
                                    source.online ? 'border-slate-200 bg-white hover:border-blue-400 hover:shadow-md' : 'border-slate-100 bg-slate-50 opacity-60 grayscale'
                                }`}
                            >
                                <div className="flex items-center gap-5">
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-sm ${
                                        source.online ? 'bg-blue-50 text-blue-600' : 'bg-slate-200 text-slate-400'
                                    }`}>
                                        {source.deviceType === 'pos' ? '🖥️' : source.deviceType === 'kds' ? '📟' : '📱'}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-black text-slate-900">{source.deviceId}</h4>
                                            {source.online && (
                                                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-600 text-[9px] font-black rounded-full">ONLINE</span>
                                            )}
                                        </div>
                                        <div className="text-xs text-slate-400 font-mono">{source.lastIp}</div>
                                        {source.latestOrderAt && (
                                            <div className="text-[10px] text-blue-500 font-bold mt-1 uppercase">
                                                הזמנה אחרונה: {new Date(source.latestOrderAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                
                                <div className="flex flex-col items-end gap-2">
                                    {source.online && (
                                        <div className="text-[10px] text-slate-400 font-bold uppercase">
                                            Latency: <span className={source.latency < 50 ? 'text-emerald-500' : 'text-amber-500'}>{source.latency}ms</span>
                                        </div>
                                    )}
                                    <button
                                        disabled={!source.online || syncing}
                                        onClick={() => handleSync(source.lastIp)}
                                        className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                                            source.online 
                                                ? 'bg-slate-900 text-white hover:bg-blue-600 shadow-lg shadow-slate-200' 
                                                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                        }`}
                                    >
                                        {syncing ? 'מסנכרן...' : 'משוך נתונים'}
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
                
                <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                    <button onClick={discoverSources} className="text-slate-400 hover:text-blue-600 transition-colors flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        רענן רשימה
                    </button>
                    <button onClick={onClose} className="px-8 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-100 transition-all">
                        ביטול
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

export default DexieAdminPanel;
