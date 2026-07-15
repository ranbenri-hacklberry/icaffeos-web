/**
 * KanbanColumn
 * A single column in the Kanban board (droppable zone)
 */

import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import DraggableOrderCard from '@/components/kanban/DraggableOrderCard';
import { motion } from 'framer-motion';
import { RefreshCw } from 'lucide-react';

// Column styling by status
const COLUMN_STYLES = {
    new: {
        bg: 'bg-gradient-to-b from-emerald-50 to-white',
        border: 'border-emerald-100',
        badge: 'bg-emerald-500 text-white shadow-sm shadow-emerald-200',
        title: 'חדש'
    },
    pending: {
        bg: 'bg-gradient-to-b from-blue-50 to-white',
        border: 'border-blue-100',
        badge: 'bg-blue-500 text-white shadow-sm shadow-blue-200',
        title: 'בטיפול'
    },
    in_prep: {
        bg: 'bg-gradient-to-b from-amber-50 to-white',
        border: 'border-amber-100',
        badge: 'bg-amber-500 text-white shadow-sm shadow-amber-200',
        title: 'בהכנה'
    },
    ready: {
        bg: 'bg-gradient-to-b from-orange-50 to-white',
        border: 'border-orange-100',
        badge: 'bg-orange-500 text-white shadow-sm shadow-orange-200',
        title: 'מוכן'
    },
    shipped: {
        bg: 'bg-gradient-to-b from-purple-50 to-white',
        border: 'border-purple-100',
        badge: 'bg-purple-500 text-white shadow-sm shadow-purple-200',
        title: 'נשלח'
    },
    delivered: {
        bg: 'bg-gradient-to-b from-slate-50 to-white',
        border: 'border-slate-200',
        badge: 'bg-slate-600 text-white shadow-sm shadow-slate-200',
        title: 'נמסר'
    }
};

export function KanbanColumn({
    status,
    orders = [],
    businessType,
    onOrderStatusUpdate,
    onPaymentCollected,
    onEditOrder,
    onMarkSeen,
    onReadyItems, // 🆕 For packing toggle
    onSmsClick,
    onRefresh, // 🆕
    isDriverView = false, // 🆕
    onPaymentProofAction // 🆕
}) {
    const { setNodeRef, isOver } = useDroppable({ id: status });

    const styles = COLUMN_STYLES[status] || COLUMN_STYLES.new;
    const orderIds = orders.map(o => o.id);

    return (
        <div
            ref={setNodeRef}
            className={`flex flex-col flex-1 min-w-[260px] h-full rounded-2xl border-2 ${styles.border} ${styles.bg} ${isOver ? 'ring-2 ring-blue-400 ring-offset-2 shadow-xl' : 'shadow-sm'} transition-all`}
        >
            {/* Header */}
            <div className="p-4 border-b border-gray-200/50 flex items-center justify-between sticky top-0 z-10 bg-inherit rounded-t-2xl backdrop-blur-sm">
                <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-sm font-black ${styles.badge}`}>
                        {styles.title}
                    </span>
                    <span className="text-gray-500 text-sm font-bold">
                        ({orders.length})
                    </span>
                </div>
                {status === 'new' && (
                    <div className="text-[10px] text-gray-400 font-mono">
                        {orders.map(o => `${o.id.slice(0, 4)}:${o.orderStatus}`).join(' ')}
                    </div>
                )}
            </div>

            {/* Cards Container - Removed pull-to-refresh to reduce event conflict */}
            <div className="flex-1 overflow-hidden relative">
                {/* 
                // Disabled Pull to Refresh visual to isolate Drag/Click event issues
                <div className="absolute top-4 left-0 right-0 flex justify-center opacity-50 z-0">
                    <RefreshCw className="animate-spin text-blue-400" size={24} />
                </div>
                */}

                <div
                    className="h-full overflow-y-auto p-3 space-y-4 flex flex-col items-center bg-inherit relative z-10 custom-scrollbar"
                >
                    <SortableContext items={orderIds} strategy={verticalListSortingStrategy}>
                        {orders.length === 0 ? (
                            <div className="flex items-center justify-center h-32 text-gray-400 text-sm italic w-full">
                                אין הזמנות
                            </div>
                        ) : (
                            orders.map(order => (
                                <DraggableOrderCard
                                    key={order.id}
                                    order={order}
                                    businessType={businessType}
                                    onOrderStatusUpdate={onOrderStatusUpdate}
                                    onPaymentCollected={onPaymentCollected}
                                    onEditOrder={onEditOrder}
                                    onMarkSeen={onMarkSeen}
                                    onReadyItems={onReadyItems} // 🆕 Pass through
                                    onSmsClick={onSmsClick}
                                    isDriverView={isDriverView} // 🆕
                                    onPaymentProofAction={onPaymentProofAction} // 🆕
                                />
                            ))
                        )}
                    </SortableContext>
                </div>
            </div>
        </div>
    );
}

export default KanbanColumn;
