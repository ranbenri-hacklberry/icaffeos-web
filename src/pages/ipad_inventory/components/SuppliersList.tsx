import React from 'react';
import { motion } from 'framer-motion';
import { ShoppingBag, ChevronLeft } from 'lucide-react';
import { Supplier } from '@/pages/ipad_inventory/types';

const MotionButton = motion.button as any;

interface SuppliersListProps {
    suppliers: Supplier[];
    selectedSupplierId: string | null;
    onSelectSupplier: (id: string) => void;
    supplierCounts: Record<string, number>;
}

const SuppliersList: React.FC<SuppliersListProps> = ({
    suppliers,
    selectedSupplierId,
    onSelectSupplier,
    supplierCounts
}) => {
    // Today/Tomorrow logic
    const today = new Date().getDay(); // 0=Sunday=ראשון
    const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

    // Calculate days until a target day (wrapping around week)
    const daysUntil = (targetDay: number) => {
        const diff = targetDay - today;
        return diff >= 0 ? diff : diff + 7;
    };

    const getDeliveryInfo = (supplier: any) => {
        const schedule: { day: number, lead_days: number, cutoff: string | null }[] = supplier.schedule || [];
        if (schedule.length === 0) return null;

        // Find the most urgent action for today
        // 1. Is there a delivery TODAY? → count on arrival
        const todayDelivery = schedule.find(s => s.day === today);
        if (todayDelivery) {
            return { status: 'delivery_today' as const, cutoff: todayDelivery.cutoff, deliveryDay: DAY_NAMES[today], orderDay: null };
        }

        // 2. Is today an ORDER DAY for any upcoming delivery?
        //    (delivery_day - lead_days = today)
        const orderDueToday = schedule.find(s => {
            const orderDay = (s.day - (s.lead_days || 1) + 7) % 7;
            return orderDay === today;
        });
        if (orderDueToday) {
            return {
                status: 'order_today' as const,
                cutoff: orderDueToday.cutoff,
                deliveryDay: DAY_NAMES[orderDueToday.day],
                orderDay: DAY_NAMES[today],
                daysUntilDelivery: daysUntil(orderDueToday.day)
            };
        }

        // 3. Find next upcoming event (delivery or order deadline)
        let nearest = null as any;
        let nearestDays = 999;
        for (const entry of schedule) {
            const orderDay = (entry.day - (entry.lead_days || 1) + 7) % 7;
            const daysToOrder = daysUntil(orderDay);
            const daysToDelivery = daysUntil(entry.day);
            const nextEvent = Math.min(daysToOrder, daysToDelivery);
            if (nextEvent < nearestDays && nextEvent > 0) {
                nearestDays = nextEvent;
                nearest = {
                    status: 'upcoming' as const,
                    cutoff: entry.cutoff,
                    deliveryDay: DAY_NAMES[entry.day],
                    orderDay: DAY_NAMES[orderDay],
                    daysToOrder: daysToOrder,
                    daysToDelivery: daysToDelivery
                };
            }
        }
        return nearest;
    };

    // Filter out suppliers with 0 items
    const suppliersWithItems = suppliers.filter(s => (supplierCounts[String(s.id)] || 0) > 0);

    // Add uncategorized only if it has items
    const regularSuppliers = [
        ...suppliersWithItems,
        ...(supplierCounts['uncategorized'] > 0 ? [{ id: 'uncategorized', name: 'כללי / ללא ספק', delivery_days_arr: [], schedule: [] }] : [])
    ];

    // Sort: delivery_today → order_today → upcoming → no schedule
    const sortedSuppliers = [...regularSuppliers].sort((a, b) => {
        const infoA = getDeliveryInfo(a);
        const infoB = getDeliveryInfo(b);
        const priority = (s: string | undefined) => s === 'delivery_today' ? 0 : s === 'order_today' ? 1 : s === 'upcoming' ? 2 : 3;
        return priority(infoA?.status) - priority(infoB?.status);
    });

    return (
        <div className="w-80 h-full bg-slate-50 border-l border-slate-200 overflow-y-auto no-scrollbar pb-20">
            <div className="p-6">
                <h2 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
                    <ShoppingBag size={22} className="text-indigo-600" />
                    <span>ספקים</span>
                </h2>

                {/* Regular Suppliers */}
                <div className="space-y-3 mb-6">
                    {sortedSuppliers.map((supplier: any) => {
                        const count = supplierCounts[String(supplier.id)] || 0;
                        const isActive = String(selectedSupplierId) === String(supplier.id);
                        const info = getDeliveryInfo(supplier);

                        return (
                            <MotionButton
                                key={supplier.id}
                                onClick={() => onSelectSupplier(supplier.id)}
                                whileHover={{ x: -2 }}
                                whileTap={{ scale: 0.98 }}
                                className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all ${isActive
                                        ? 'bg-white shadow-md border-indigo-100 border'
                                        : 'hover:bg-slate-100 text-slate-600'
                                    } ${info?.status === 'order_today' ? 'ring-2 ring-amber-300' : ''}`}
                            >
                                <div className="flex flex-col items-start gap-0.5">
                                    <span className={`font-bold transition-colors ${isActive ? 'text-indigo-600' : 'text-slate-800'}`}>
                                        {supplier.name}
                                    </span>
                                    <span className="text-xs text-slate-500 font-medium">
                                        {count} פריטים
                                    </span>
                                    {info?.status === 'order_today' && (
                                        <span className="text-xs font-bold text-amber-600 mt-0.5">
                                            🚛 אספקה יום {info.deliveryDay} · הזמנה עד {info.cutoff || '—'}
                                        </span>
                                    )}
                                    {info?.status === 'upcoming' && (
                                        <span className="text-xs text-slate-400 mt-0.5">
                                            אספקה {info.deliveryDay} · הזמנה {info.orderDay}{info.cutoff ? ` עד ${info.cutoff}` : ''}
                                        </span>
                                    )}
                                </div>
                                <ChevronLeft
                                    size={18}
                                    className={`transition-all ${isActive ? 'text-indigo-400 translate-x-0' : 'text-slate-300 translate-x-1 opacity-0'}`}
                                />
                            </MotionButton>
                        );
                    })}
                </div>

                {/* Separator - More Space */}
                <div className="my-10 border-t-2 border-slate-300"></div>

                {/* Preparations & Defrosting - Special Section - More Prominent */}
                <div className="space-y-3">
                    <h3 className="text-xs font-black text-teal-600 uppercase tracking-wider mb-3 px-2">
                        מעקב הכנות
                    </h3>
                    <MotionButton
                        onClick={() => onSelectSupplier('prepared')}
                        whileHover={{ x: -3, scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                        className={`w-full flex items-center justify-between p-5 rounded-2xl transition-all shadow-lg ${selectedSupplierId === 'prepared'
                                ? 'bg-gradient-to-br from-teal-500 to-cyan-600 border-2 border-teal-400'
                                : 'bg-gradient-to-br from-teal-400 to-cyan-500 hover:from-teal-500 hover:to-cyan-600 border-2 border-teal-300'
                            }`}
                    >
                        <div className="flex flex-col items-start">
                            <span className={`font-black text-lg transition-colors ${selectedSupplierId === 'prepared' ? 'text-white' : 'text-white'}`}>
                                הכנות והפשרות
                            </span>
                            <span className="text-sm text-white/90 font-bold">
                                {supplierCounts['prepared'] || 0} פריטים
                            </span>
                        </div>
                        <ChevronLeft
                            size={22}
                            className={`transition-all text-white ${selectedSupplierId === 'prepared' ? 'translate-x-0' : 'translate-x-1'}`}
                        />
                    </MotionButton>
                </div>
            </div>
        </div>
    );
};

export default SuppliersList;
