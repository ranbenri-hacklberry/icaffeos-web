import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Tractor,
    CheckCircle,
    Clock,
    AlertCircle,
    User,
    Globe,
    LayoutDashboard,
    ClipboardList,
    Wrench
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { useHotelOrders } from '@/hooks/useHotelOrders';

/**
 * 🌍 TRILINGUAL DICTIONARY - The "Senior-Level" Logic
 * One dictionary to rule them all. No duplicated components.
 */
const DICTIONARY = {
    he: {
        title: "לוח בקרה לצוות",
        shift_status: "סטטוס משמרת",
        active: "פעילה",
        room: "חדר",
        clean: "מוכן",
        dirty: "מלוכלך",
        occupied: "תפוס",
        maintenance: "תחזוקה",
        start_cleaning: "התחל ניקיון",
        report_issue: "דווח תקלה",
        guest: "אורח",
        tasks: "משימות",
        search: "חיפוש חדר...",
        no_rooms: "אין חדרים בסטטוס זה",
        shift_progress: "התקדמות המשמרת",
        rooms_ready: "חדרים מוכנים",
        issues_reported: "תקלות דווחו",
        stock_warning: "התראת מלאי",
        milk: "חלב",
        water: "מים",
        finalize_shift: "סיום משמרת",
        share_owner: "שתף לבעלים",
        low: "נמוך",
        out_of_stock: "אזל",
        total_rooms: "סה״כ"
    },
    ar: {
        title: "لوحة التحكم للموظفين",
        shift_status: "حالة المناوبة",
        active: "نشطة",
        room: "غرفة",
        clean: "جاهز",
        dirty: "متسخ",
        occupied: "مشغول",
        maintenance: "صيانة",
        start_cleaning: "ابدأ التنظيف",
        report_issue: "إبلاغ عن خلل",
        guest: "ضيف",
        tasks: "مهام",
        search: "البحث عن غرفة...",
        no_rooms: "لا توجد غرف بهذه الحالة",
        shift_progress: "تقدم المناوبة",
        rooms_ready: "الغرف الجاهزة",
        issues_reported: "البلاغات",
        stock_warning: "تنبيه المخزون",
        milk: "حليب",
        water: "ماء",
        finalize_shift: "إنهاء المناوبة",
        share_owner: "مشاركة مع المالك",
        low: "منخفض",
        out_of_stock: "نفذ",
        total_rooms: "إجمالي"
    },
    en: {
        title: "Staff Dashboard",
        shift_status: "Shift Status",
        active: "Active",
        room: "Room",
        clean: "Ready",
        dirty: "Dirty",
        occupied: "Occupied",
        maintenance: "Maint.",
        start_cleaning: "Start Clean",
        report_issue: "Report Issue",
        guest: "Guest",
        tasks: "Tasks",
        search: "Search room...",
        no_rooms: "No rooms in this status",
        shift_progress: "Shift Progress",
        rooms_ready: "Rooms Ready",
        issues_reported: "Issues Reported",
        stock_warning: "Stock Warning",
        milk: "Milk",
        water: "Water",
        finalize_shift: "Finalize Shift",
        share_owner: "Share to Owner",
        low: "Low",
        out_of_stock: "Out of Stock",
        total_rooms: "Total"
    }
};

const LANGUAGES = [
    { code: 'he', label: 'עברית', dir: 'rtl' },
    { code: 'ar', label: 'العربية', dir: 'rtl' },
    { code: 'en', label: 'English', dir: 'ltr' }
];

const StaffDashboard = () => {
    const { hotelOrders, isLoading, updateRoomStatus, toggleMaintenance } = useHotelOrders();
    const [lang, setLang] = useState('he');
    const [searchQuery, setSearchQuery] = useState('');
    const [showConfetti, setShowConfetti] = useState(false);

    const t = DICTIONARY[lang];
    const currentDir = LANGUAGES.find(l => l.code === lang).dir;

    // Filter and sort orders
    const filteredOrders = useMemo(() => {
        return hotelOrders.filter(o =>
            o.metadata?.room_number.toString().includes(searchQuery) ||
            o.metadata?.guest_name?.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [hotelOrders, searchQuery]);

    const stats = useMemo(() => {
        const total = hotelOrders.length;
        const ready = hotelOrders.filter(o => o.order_status === 'ready').length;
        const maintenance = hotelOrders.filter(o => o.metadata?.needs_maintenance).map(o => o.metadata?.room_number);
        return { total, ready, maintenance, percentage: total > 0 ? (ready / total) * 100 : 0 };
    }, [hotelOrders]);

    const triggerCelebration = () => {
        if (stats.ready === stats.total && stats.total > 0) {
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 5000);
        } else {
            alert(lang === 'he' ? "יש לסיים את כל החדרים לפני סגירת משמרת" : lang === 'ar' ? "يجب إنهاء جميع الغرف לפני إغلاق المناوبة" : "Complete all rooms before finalizing shift");
        }
    };

    if (isLoading) return <div className="p-12 text-center font-bold">Loading...</div>;

    return (
        <div
            className="min-h-screen bg-slate-50 text-slate-900 transition-all duration-500 pb-32"
            dir={currentDir}
        >
            <AnimatePresence>
                {showConfetti && <SimpleConfetti />}
            </AnimatePresence>

            {/* --- HEADER --- */}
            <header className="sticky top-0 z-50 bg-white border-b border-slate-200 px-6 py-4 shadow-sm backdrop-blur-md bg-white/90">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-200">
                            <LayoutDashboard size={24} />
                        </div>
                        <div>
                            <h1 className="text-xl font-black">{t.title}</h1>
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                {t.shift_status}: {t.active}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <input
                                type="text"
                                placeholder={t.search}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="ps-10 bg-slate-100 border-none rounded-2xl py-2 text-sm font-bold w-48 md:w-64 focus:ring-2 focus:ring-indigo-500/20"
                            />
                        </div>

                        {/* LANGUAGE SWITCHER */}
                        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
                            {LANGUAGES.map(l => (
                                <button
                                    key={l.code}
                                    onClick={() => setLang(l.code)}
                                    className={cn(
                                        "px-3 py-1 rounded-xl text-xs font-black transition-all",
                                        lang === l.code ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                                    )}
                                >
                                    {l.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </header>

            {/* --- MAIN GRID --- */}
            <main className="max-w-7xl mx-auto p-6 md:p-8">
                <motion.div
                    layout
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                >
                    <AnimatePresence mode="popLayout">
                        {filteredOrders.map((order) => (
                            <StaffRoomCard
                                key={order.id}
                                order={order}
                                t={t}
                                onReportIssue={() => toggleMaintenance(order.id)}
                                onStartCleaning={(taskId) => updateRoomStatus(order.id, taskId, 'in_progress')}
                            />
                        ))}
                    </AnimatePresence>
                </motion.div>

                {filteredOrders.length === 0 && (
                    <div className="text-center py-24 opacity-40">
                        <ClipboardList size={64} className="mx-auto mb-4" />
                        <p className="text-xl font-bold">{t.no_rooms}</p>
                    </div>
                )}
            </main>

            {/* --- SHIFT SUMMARY BOTTOM SHEET --- */}
            <ShiftSummarySheet
                stats={stats}
                t={t}
                lang={lang}
                onFinalize={triggerCelebration}
            />
        </div>
    );
};

const SimpleConfetti = () => {
    return (
        <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
            {[...Array(50)].map((_, i) => (
                <motion.div
                    key={i}
                    initial={{
                        top: -20,
                        left: `${Math.random() * 100}%`,
                        rotate: 0,
                        backgroundColor: ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6'][Math.floor(Math.random() * 5)]
                    }}
                    animate={{
                        top: '120%',
                        rotate: 720,
                        x: [0, Math.random() * 200 - 100, 0]
                    }}
                    transition={{
                        duration: 2 + Math.random() * 3,
                        ease: "easeOut",
                        repeat: Infinity,
                        repeatDelay: Math.random() * 2
                    }}
                    className="absolute w-3 h-3 rounded-sm opacity-80"
                />
            ))}
        </div>
    );
};

const ShiftSummarySheet = ({ stats, t, lang, onFinalize }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const shareToOwner = () => {
        const summary = `Shift Summary - ${new Date().toLocaleDateString()}\nRoom Progress: ${stats.ready}/${stats.total}\nIssues: ${stats.maintenance.join(', ') || 'None'}`;
        const encoded = encodeURIComponent(summary);
        window.open(`whatsapp://send?text=${encoded}`, '_blank');
    };

    return (
        <motion.div
            initial={false}
            animate={{ height: isExpanded ? 'auto' : '80px' }}
            className="fixed bottom-0 left-0 right-0 bg-white/70 backdrop-blur-2xl border-t border-white/30 z-[60] shadow-[0_-10px_40px_rgba(0,0,0,0.1)] overflow-hidden transition-all duration-500 rounded-t-[2.5rem]"
        >
            <div className="max-w-7xl mx-auto px-8 py-4">
                {/* HEADER / HANDLE */}
                <div
                    className="flex items-center justify-between cursor-pointer group"
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    <div className="flex items-center gap-6">
                        <div className="relative w-12 h-12 flex items-center justify-center">
                            <svg className="w-12 h-12 -rotate-90">
                                <circle cx="24" cy="24" r="20" className="stroke-slate-100 fill-none" strokeWidth="4" />
                                <motion.circle
                                    cx="24" cy="24" r="20"
                                    className="stroke-indigo-600 fill-none"
                                    strokeWidth="4"
                                    strokeDasharray="125.6"
                                    animate={{ strokeDashoffset: 125.6 - (125.6 * stats.percentage) / 100 }}
                                />
                            </svg>
                            <span className="absolute text-[10px] font-black">{Math.round(stats.percentage)}%</span>
                        </div>
                        <div>
                            <h3 className="font-black text-slate-800 tracking-tight">{t.shift_progress}</h3>
                            <p className="text-xs font-bold text-slate-400 italic">
                                {stats.ready} / {stats.total} {t.rooms_ready}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={(e) => { e.stopPropagation(); onFinalize(); }}
                            className="bg-indigo-600 text-white px-6 py-2.5 rounded-2xl font-black text-xs shadow-lg shadow-indigo-200"
                        >
                            {t.finalize_shift}
                        </motion.button>
                        <div className={cn("p-2 rounded-full bg-slate-100 transition-transform duration-500", isExpanded && "rotate-180")}>
                            <Clock size={16} className="text-slate-400" />
                        </div>
                    </div>
                </div>

                {/* EXPANDED CONTENT */}
                <AnimatePresence>
                    {isExpanded && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 20 }}
                            className="pt-8 pb-4 grid grid-cols-1 md:grid-cols-3 gap-8"
                        >
                            {/* MAINTENANCE SECTION */}
                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                    <Tractor size={14} className="text-amber-500" />
                                    {t.issues_reported}
                                </h4>
                                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                    {stats.maintenance.length > 0 ? stats.maintenance.map(room => (
                                        <div key={room} className="flex-shrink-0 bg-amber-50 text-amber-700 px-4 py-2 rounded-2xl border border-amber-100 font-bold text-sm">
                                            #{room}
                                        </div>
                                    )) : (
                                        <p className="text-xs font-bold text-slate-300 italic">None reported</p>
                                    )}
                                </div>
                            </div>

                            {/* INVENTORY SECTION */}
                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                    <AlertCircle size={14} className="text-rose-500" />
                                    {t.stock_warning}
                                </h4>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between p-3 bg-rose-50 rounded-2xl border border-rose-100">
                                        <span className="text-xs font-bold text-slate-700">{t.milk}</span>
                                        <span className="text-[10px] font-black text-rose-600 bg-white px-2 py-0.5 rounded-full">{t.low}</span>
                                    </div>
                                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100 opacity-60">
                                        <span className="text-xs font-bold text-slate-700">{t.water}</span>
                                        <span className="text-[10px] font-black text-slate-400 bg-white px-2 py-0.5 rounded-full uppercase">{t.out_of_stock}</span>
                                    </div>
                                </div>
                            </div>

                            {/* EXPORT SECTION */}
                            <div className="flex flex-col justify-end">
                                <button
                                    onClick={shareToOwner}
                                    className="flex items-center justify-center gap-2 w-full p-4 rounded-3xl border-2 border-indigo-600 text-indigo-600 font-black text-sm hover:bg-indigo-50 transition-colors"
                                >
                                    <Globe size={18} />
                                    {t.share_owner}
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
};


/**
 * StaffRoomCard - Specialized for staff view.
 * Uses Tailwind Logical Properties (ps, pe, text-start).
 */
const StaffRoomCard = ({ order, t, onReportIssue, onStartCleaning }) => {
    const { metadata, order_status, items } = order;
    const isMaintenance = metadata?.needs_maintenance;

    // Status Logic
    const statusType = useMemo(() => {
        if (isMaintenance) return 'maintenance';
        if (order_status === 'ready') return 'clean';
        if (order_status === 'in_progress') return 'occupied'; // Using occupied as a middle state for staff POC
        return 'dirty';
    }, [order_status, isMaintenance]);

    const statusConfig = {
        clean: { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: t.clean, icon: CheckCircle },
        dirty: { color: 'bg-rose-100 text-rose-700 border-rose-200', label: t.dirty, icon: Clock },
        occupied: { color: 'bg-indigo-100 text-indigo-700 border-indigo-200', label: t.occupied, icon: User },
        maintenance: { color: 'bg-amber-100 text-amber-700 border-amber-200', label: t.maintenance, icon: Tractor }
    };

    const config = statusConfig[statusType];

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            className={cn(
                "group relative flex flex-col bg-white rounded-[2.5rem] border-2 border-transparent p-6 transition-all duration-300 hover:shadow-2xl hover:border-slate-200",
                isMaintenance && "border-amber-400 bg-amber-50/30"
            )}
        >
            {/* ROOM HEADER */}
            <div className="flex items-start justify-between mb-6">
                <div>
                    <h2 className="text-4xl font-black tracking-tighter text-slate-900 group-hover:text-indigo-600 transition-colors">
                        {metadata?.room_number}
                    </h2>
                    <div className={cn(
                        "mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                        config.color
                    )}>
                        <config.icon size={12} />
                        {config.label}
                    </div>
                </div>

                <div className="text-end">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{t.guest}</p>
                    <p className="text-sm font-black text-slate-700 max-w-[120px] truncate">{metadata?.guest_name || '---'}</p>
                </div>
            </div>

            {/* COMPACT TASK STATUS (Visual dots) */}
            <div className="flex gap-1 mb-8">
                {items?.map((task, i) => (
                    <div
                        key={task.id || i}
                        className={cn(
                            "h-1 flex-1 rounded-full transition-all duration-500",
                            task.status === 'completed' ? "bg-emerald-400" : "bg-slate-100"
                        )}
                    />
                ))}
            </div>

            {/* ACTION BUTTONS - Touch Optimized */}
            <div className="mt-auto grid grid-cols-2 gap-3">
                <button
                    onClick={() => onStartCleaning(items?.[0]?.id)}
                    className="flex flex-col items-center justify-center gap-2 p-4 rounded-3xl bg-slate-900 text-white font-bold text-xs shadow-lg shadow-slate-200 hover:bg-slate-800 active:scale-95 transition-all text-center"
                >
                    <ClipboardList size={20} />
                    <span className="leading-tight">{t.start_cleaning}</span>
                </button>

                <button
                    onClick={onReportIssue}
                    className={cn(
                        "flex flex-col items-center justify-center gap-2 p-4 rounded-3xl font-bold text-xs active:scale-95 transition-all text-center",
                        isMaintenance
                            ? "bg-rose-100 text-rose-600 border-2 border-rose-200 animate-pulse"
                            : "bg-white text-slate-600 border-2 border-slate-100 hover:border-slate-300"
                    )}
                >
                    {isMaintenance ? <Wrench size={20} /> : <Tractor size={20} />}
                    <span className="leading-tight">{t.report_issue}</span>
                </button>
            </div>

            {/* STATUS BADGE FOR MAINTENANCE */}
            {isMaintenance && (
                <div className="absolute top-2 -end-2 rotate-12 bg-amber-400 text-white px-3 py-1 rounded-lg text-[10px] font-black shadow-lg">
                    {t.maintenance.toUpperCase()} 🚨
                </div>
            )}
        </motion.div>
    );
};

export default StaffDashboard;
