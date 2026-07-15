/**
 * KanbanBoard
 * Main Kanban board with Drag & Drop using @dnd-kit
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
    DndContext,
    DragOverlay,
    closestCorners,
    rectIntersection,
    KeyboardSensor,
    PointerSensor,
    TouchSensor,
    useSensor,
    useSensors,
    defaultDropAnimationSideEffects
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import KanbanColumn from '@/components/kanban/KanbanColumn';
import KanbanOrderCard from '@/components/kanban/KanbanOrderCard';

// Default column order - Unified with lifecycle: Incoming -> Prep -> Ready -> Shipped
const DEFAULT_COLUMNS = ['new', 'in_prep', 'ready', 'shipped'];

export function KanbanBoard({
    ordersByStatus = {},
    columns = DEFAULT_COLUMNS,
    businessType = 'cafe',
    onOrderStatusUpdate,
    onPaymentCollected,
    onEditOrder,
    onMarkSeen,
    onReadyItems, // 🆕 For packing toggle
    onSmsClick,
    onRefresh, // 🆕
    isDriverView = false, // 🆕 Driver Mode
    onPaymentProofAction // 🆕
}) {
    const [activeOrder, setActiveOrder] = useState(null);
    const [items, setItems] = useState(ordersByStatus);

    useEffect(() => {
        setItems(ordersByStatus);
    }, [ordersByStatus]);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(TouchSensor, {
            // Touch sensor with delay helps differatiate between scrolling and dragging
            // But since we disabled scrolling on the card, we want immediate response
            activationConstraint: {
                delay: 100, // Slight delay to prevent accidental drags
                tolerance: 5,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Find order by ID across all columns
    const findOrder = useCallback((id) => {
        for (const status of Object.keys(items)) {
            const order = items[status]?.find(o => o.id === id);
            if (order) return order;
        }
        return null;
    }, [items]);

    // Find order or column status
    const findStatus = useCallback((id) => {
        if (columns.includes(id)) return id;
        for (const status of columns) {
            if (items[status]?.some(o => o.id === id)) return status;
        }
        return null;
    }, [columns, items]);

    // Handle drag start
    const handleDragStart = (event) => {
        const { active } = event;
        const order = findOrder(active.id);
        setActiveOrder(order);
    };

    // Handle drag over (moving between columns)
    const handleDragOver = (event) => {
        const { active, over } = event;
        if (!over) return;

        const activeId = active.id;
        const overId = over.id;

        const activeStatus = findStatus(activeId);
        const overStatus = findStatus(overId);

        if (!activeStatus || !overStatus || activeStatus === overStatus) return;

        setItems(prev => {
            const activeItems = prev[activeStatus] || [];
            const overItems = prev[overStatus] || [];

            const activeIndex = activeItems.findIndex(i => i.id === activeId);
            if (activeIndex === -1) return prev;

            const item = activeItems[activeIndex];

            return {
                ...prev,
                [activeStatus]: activeItems.filter(i => i.id !== activeId),
                [overStatus]: [...overItems, item]
            };
        });
    };

    // Handle drag end - update order status
    const handleDragEnd = async (event) => {
        const { active, over } = event;
        setActiveOrder(null);

        if (!over) {
            setItems(ordersByStatus);
            return;
        }

        const orderId = active.id;
        const overId = over.id;
        const newStatus = findStatus(overId);
        const currentOrder = findOrder(orderId);
        const currentStatus = currentOrder?.order_status || currentOrder?.orderStatus;

        if (!newStatus || newStatus === currentStatus) {
            setItems(ordersByStatus);
            return;
        }

        if (onOrderStatusUpdate) {
            await onOrderStatusUpdate(orderId, newStatus);
        }
    };

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={rectIntersection}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
        >
            <div className="flex gap-4 h-full overflow-x-auto p-4 pb-6" dir="rtl">
                {columns.map(status => (
                    <KanbanColumn
                        key={status}
                        status={status}
                        orders={items[status] || []}
                        businessType={businessType}
                        onOrderStatusUpdate={onOrderStatusUpdate}
                        onPaymentCollected={onPaymentCollected}
                        onEditOrder={onEditOrder}
                        onMarkSeen={onMarkSeen}
                        onReadyItems={onReadyItems} // 🆕 Pass through
                        onSmsClick={onSmsClick}
                        onRefresh={onRefresh} // 🆕 Pass down
                        isDriverView={isDriverView} // 🆕
                        onPaymentProofAction={onPaymentProofAction} // 🆕
                    />
                ))}
            </div>

            {/* Drag Overlay - shows the card being dragged */}
            <DragOverlay
                dropAnimation={{
                    duration: 150,
                    easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
                    sideEffects: defaultDropAnimationSideEffects({
                        styles: {
                            active: {
                                opacity: '0.0',
                            },
                        },
                    }),
                }}
            >
                {activeOrder ? (
                    <div className="opacity-95 rotate-[2deg] scale-105 shadow-2xl ring-2 ring-blue-500/20 rounded-2xl overflow-hidden pointer-events-none transition-transform">
                        <KanbanOrderCard
                            order={activeOrder}
                            isReady={activeOrder.order_status === 'ready' || activeOrder.order_status === 'completed'}
                            isDriverView={isDriverView}
                            onReadyItems={onReadyItems}
                        />
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
}

export default KanbanBoard;
