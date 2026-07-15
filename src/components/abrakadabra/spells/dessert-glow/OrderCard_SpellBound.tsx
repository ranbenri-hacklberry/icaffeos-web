/**
 * 🎩 ABRAKADABRA SPELLBOUND COMPONENT
 * Spell: dessert-priority-glow
 * 
 * Target: src/pages/kds/components/OrderCard.jsx
 * Modification: Blue pulse for stale desserts.
 */

import React, { useState, useEffect, useCallback, memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Clock, Flame, CheckCircle } from 'lucide-react';

interface OrderItem {
    id: string;
    name: string;
    category?: string;
    item_status: string;
    quantity: number;
}

interface Order {
    id: string;
    orderNumber: string;
    orderStatus: string;
    created_at: string;
    ready_at?: string;
    updated_at?: string;
    items: OrderItem[];
}

interface OrderCardProps {
    order: Order;
    isReady?: boolean;
    isHistory?: boolean;
}

const PrepTimer: React.FC<{ order: Order, isHistory: boolean, isReady: boolean }> = memo(({ order, isHistory, isReady }) => {
    const [duration, setDuration] = useState('-');

    useEffect(() => {
        const calculate = () => {
            const startStr = order.created_at;
            const endStr = order.ready_at;
            const start = new Date(startStr).getTime();
            let end: number | null;

            if (endStr) {
                end = new Date(endStr).getTime();
            } else if (isReady || isHistory) {
                end = order.updated_at ? new Date(order.updated_at).getTime() : null;
            } else {
                end = Date.now();
            }

            if (isNaN(start) || !end) {
                setDuration('-');
                return;
            }

            const diff = Math.max(0, end - start);
            const mins = Math.floor(diff / 60000);
            setDuration(`${mins}`);
        };

        calculate();
        let interval: any;
        if (!isReady && !isHistory) {
            interval = setInterval(calculate, 60000);
        }
        return () => clearInterval(interval);
    }, [order, isHistory, isReady]);

    return (
        <div className="flex items-center justify-center min-w-[36px] px-2 py-0.5 rounded-md border text-base font-bold h-7 shadow-sm transition-colors bg-white border-gray-200 text-gray-700">
            <span className="font-mono dir-ltr flex-1 text-center">{duration}</span>
        </div>
    );
});

const OrderCard_SpellBound: React.FC<OrderCardProps> = memo(({
    order,
    isReady = false,
    isHistory = false,
}) => {
    const [agingMinutes, setAgingMinutes] = useState(0);

    useEffect(() => {
        if (isHistory || isReady) return;
        const calculateAging = () => {
            const start = new Date(order.created_at).getTime();
            const now = Date.now();
            const diff = Math.max(0, now - start);
            setAgingMinutes(Math.floor(diff / 60000));
        };
        calculateAging();
        const interval = setInterval(calculateAging, 30000);
        return () => clearInterval(interval);
    }, [order.created_at, isHistory, isReady]);

    const renderItemRow = useCallback((item: OrderItem, idx: number) => {
        const isDessert = item.category?.toLowerCase() === 'dessert' ||
            item.name.toLowerCase().includes('souffl') ||
            item.name.toLowerCase().includes('creme');
        const isStaleDessert = isDessert && item.item_status === 'new' && agingMinutes >= 5;

        return (
            <div key={idx} className={`relative flex flex-col p-2 rounded-xl mb-2 transition-all ${isStaleDessert ? 'ring-2 ring-blue-400' : 'bg-gray-50'}`}>
                {isStaleDessert && (
                    <motion.div
                        className="absolute inset-0 bg-blue-500 rounded-xl"
                        animate={{
                            opacity: [0.05, 0.2, 0.05],
                        }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                    />
                )}

                <div className="flex items-start gap-3 relative z-10">
                    <span className={`w-8 h-8 flex items-center justify-center rounded-lg font-black text-white ${isStaleDessert ? 'bg-blue-600 shadow-lg shadow-blue-200' : 'bg-slate-900'}`}>
                        {item.quantity}
                    </span>
                    <div className="flex-1 min-w-0">
                        <div className="font-bold text-gray-900 flex items-center gap-2">
                            {item.name}
                            {isStaleDessert && <Flame size={14} className="text-blue-500 animate-bounce" />}
                        </div>
                        {isStaleDessert && <div className="text-[10px] font-black text-blue-600 uppercase tracking-wider">Priority Dessert</div>}
                    </div>
                </div>
            </div>
        );
    }, [agingMinutes]);

    return (
        <div className={`kds-card w-[280px] flex-shrink-0 rounded-3xl p-4 bg-white border-2 flex flex-col h-full shadow-xl ${agingMinutes >= 5 ? 'border-blue-100 shadow-blue-50' : 'border-gray-100'}`}>
            <div className="flex justify-between items-start mb-4 border-b pb-3">
                <div>
                    <div className="text-2xl font-black text-slate-900 leading-none">#{order.orderNumber}</div>
                    <div className="text-[10px] text-gray-400 font-mono mt-1">ID: {order.id.substring(0, 6)}</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                    <PrepTimer order={order} isHistory={isHistory} isReady={isReady} />
                    {agingMinutes >= 5 && <span className="text-[9px] font-bold text-blue-500 bg-blue-50 px-1.5 rounded-full">STALE DESSERT WARNING</span>}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                {order.items.map((item, idx) => renderItemRow(item, idx))}
            </div>

            <div className="mt-4 pt-3 border-t flex gap-2">
                {order.orderStatus === 'pending' ? (
                    <button className="flex-1 py-3 bg-amber-500 text-white rounded-2xl font-black shadow-lg shadow-amber-100 transform active:scale-95 transition-all">
                        ACKNOWLEDGE
                    </button>
                ) : (
                    <button className="flex-1 py-3 bg-green-500 text-white rounded-2xl font-black shadow-lg shadow-green-100 flex items-center justify-center gap-2 transform active:scale-95 transition-all">
                        <CheckCircle size={18} />
                        PREPARE
                    </button>
                )}
            </div>
        </div>
    );
}, () => false);

export default OrderCard_SpellBound;
