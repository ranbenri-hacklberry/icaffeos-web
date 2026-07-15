
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useStore } from '@/core/store';
import LiteOrderCard from '@/pages/lite/components/LiteOrderCard';
import LiteHeader from '@/pages/lite/components/LiteHeader';
import LiteOrderEditModal from '@/pages/lite/components/LiteOrderEditModal';

const LiteKDS = () => {
    const {
        activeOrders = [], // default to empty
        fetchKDSOrders,
        markOrderReady,
        markOrderCompleted,
        undoReady,
        focusedKDSIndex,
        setFocusedKDSIndex
    } = useStore();

    const [editingOrder, setEditingOrder] = useState(null);

    useEffect(() => {
        fetchKDSOrders();
        const interval = setInterval(fetchKDSOrders, 5000);
        return () => clearInterval(interval);
    }, []);

    // Split orders logic
    const { allCards, inProgress, ready } = useMemo(() => {
        const inP = [];
        const r = [];
        // Ensure activeOrders is an array
        const list = Array.isArray(activeOrders) ? activeOrders : [];
        const sorted = [...list].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

        sorted.forEach(order => {
            const s = (order.order_status || order.status || '').toLowerCase();
            if (s === 'ready') {
                r.push(order);
            } else if (s !== 'completed' && s !== 'cancelled') {
                inP.push(order);
            }
        });

        // Ready sorted by stable timestamp (FIFO)
        r.sort((a, b) => new Date(a.ready_at || a.created_at) - new Date(b.ready_at || b.created_at));

        // Combined list for linear navigation
        const all = [...inP, ...r];

        return { inProgress: inP, ready: r, allCards: all };
    }, [activeOrders]);

    // Keyboard Navigation Listener
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'ArrowRight') {
                setFocusedKDSIndex(Math.max(0, focusedKDSIndex - 1));
            } else if (e.key === 'ArrowLeft') {
                setFocusedKDSIndex(Math.min(allCards.length - 1, focusedKDSIndex + 1));
            } else if (e.key === 'Enter') {
                if (allCards[focusedKDSIndex]) {
                    const order = allCards[focusedKDSIndex];
                    const status = order.order_status || order.status;
                    if (status === 'ready') {
                        handleStatusUpdate(order.id, 'completed');
                    } else {
                        handleStatusUpdate(order.id, 'ready');
                    }
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [allCards, focusedKDSIndex]);

    const handleStatusUpdate = async (orderId, newStatus) => {
        if (newStatus === 'undo_ready') {
            await undoReady(orderId);
        } else if (newStatus === 'completed') {
            await markOrderCompleted(orderId);
        } else if (newStatus === 'ready') {
            await markOrderReady(orderId);
        }
    };

    // Safe render for orders
    return (
        <div className="flex flex-col h-screen bg-slate-900 overflow-hidden font-sans" dir="rtl">
            <LiteHeader title="KDS Kitchen - ⌨️ Use Arrows & Enter" />

            <div className="flex-1 flex flex-col min-h-0">
                {/* Active Row */}
                <div className="flex-1 border-b border-slate-800 flex flex-col min-h-0">
                    <div className="bg-slate-800/50 px-4 py-2 flex justify-between items-center shadow-sm">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)] animate-pulse"></div>
                            <h2 className="text-amber-100 font-black text-lg tracking-wide">זמנות בהכנה ({inProgress.length})</h2>
                        </div>
                    </div>

                    <div className="flex-1 overflow-x-auto overflow-y-hidden p-4 whitespace-nowrap scroll-smooth">
                        <div className="flex h-full gap-4">
                            {inProgress.length === 0 ? (
                                <div className="w-full flex items-center justify-center text-slate-700 font-bold text-2xl animate-pulse">
                                    אין הזמנות בהכנה...
                                </div>
                            ) : (
                                inProgress.map((order, idx) => {
                                    const globalIndex = idx;
                                    const isFocused = globalIndex === focusedKDSIndex;

                                    return (
                                        <div key={order.id} className="transition-transform duration-200">
                                            <LiteOrderCard
                                                order={order}
                                                onOrderStatusUpdate={handleStatusUpdate}
                                                isFocused={isFocused}
                                                onEditOrder={setEditingOrder}
                                            />
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>

                {/* Ready Row */}
                <div className="flex-1 bg-slate-900/50 flex flex-col min-h-0">
                    <div className="bg-slate-800/80 px-4 py-1.5 flex justify-between items-center border-t border-slate-700 shadow-inner">
                        <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                            <h2 className="text-green-100 font-bold text-base tracking-wide">מוכנים לאיסוף ({ready.length})</h2>
                        </div>
                    </div>

                    <div className="flex-1 overflow-x-auto overflow-y-hidden p-3 whitespace-nowrap scroll-smooth">
                        <div className="flex h-full gap-3">
                            {ready.map((order, idx) => {
                                const globalIndex = inProgress.length + idx;
                                const isFocused = globalIndex === focusedKDSIndex;

                                return (
                                    <div key={order.id} className="transition-transform duration-200">
                                        <LiteOrderCard
                                            order={order}
                                            isReady={true}
                                            onOrderStatusUpdate={handleStatusUpdate}
                                            isFocused={isFocused}
                                            onEditOrder={setEditingOrder}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {editingOrder && (
                <LiteOrderEditModal
                    order={editingOrder}
                    onClose={() => setEditingOrder(null)}
                />
            )}
        </div>
    );
};

export default LiteKDS;
