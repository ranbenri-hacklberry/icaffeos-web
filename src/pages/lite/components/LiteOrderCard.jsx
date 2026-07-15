
import React, { useState, useEffect, useMemo, memo } from 'react';
import { Clock, RotateCcw, Edit2 } from 'lucide-react';
import { getShortName, getModColorClass } from '@/config/modifierShortNames';

const LiteOrderCard = memo(({
    order,
    isReady = false,
    isHistory = false,
    isFocused = false, // Status focus mapping
    onOrderStatusUpdate,
    onEditOrder
}) => {
    const [isUpdating, setIsUpdating] = useState(false);

    // Aging logic
    const [agingMinutes, setAgingMinutes] = useState(0);
    useEffect(() => {
        if (isHistory || isReady) return;
        const calculateAging = () => {
            const start = new Date(order.created_at).getTime();
            const diff = Math.max(0, Date.now() - start);
            setAgingMinutes(Math.floor(diff / 60000));
        };
        calculateAging();
        const interval = setInterval(calculateAging, 30000);
        return () => clearInterval(interval);
    }, [order.created_at, isHistory, isReady]);

    const agingClass = useMemo(() => {
        if (isHistory || isReady) return '';
        if (agingMinutes >= 20) return 'bg-red-50';
        if (agingMinutes >= 10) return 'bg-orange-50';
        return '';
    }, [agingMinutes, isHistory, isReady]);

    const statusStyles = useMemo(() => {
        // Focus override styles or status borders
        const base = 'border-t-[6px] border-x border-b transition-all duration-200';

        // Status borders
        let borderColor = 'border-gray-300';
        if (order.order_status === 'new') borderColor = 'border-green-500';
        if (order.order_status === 'in_progress') borderColor = 'border-yellow-500';
        if (isReady) borderColor = 'border-slate-800';

        // Focus glow effect
        const focusRing = isFocused ? 'ring-4 ring-amber-500 shadow-xl scale-[1.02] z-10' : '';

        return `${base} ${borderColor} ${focusRing}`;
    }, [order.order_status, isReady, isFocused]);

    const items = order.items || [];
    const isWide = items.length > 5;

    // Split items for columns if wide
    const rightColItems = isWide ? items.slice(0, 5) : items;
    const leftColItems = isWide ? items.slice(5) : [];

    const renderItem = (item, idx) => {
        let modifiers = item.modifiers || [];
        if (!modifiers.length && item.mods) {
            try { modifiers = typeof item.mods === 'string' ? JSON.parse(item.mods) : item.mods; } catch (e) { }
        }
        if (!Array.isArray(modifiers) && modifiers && typeof modifiers === 'object') {
            modifiers = Object.values(modifiers).map(v => ({ text: v }));
        }
        const isServed = item.item_status === 'completed' || item.item_status === 'served';

        return (
            <div key={item.id || idx} className={`flex flex-col border-b border-dashed border-gray-100 pb-0.5 last:border-0 ${isServed ? 'opacity-50 grayscale' : ''}`}>
                <div className="flex items-start gap-[5px]">
                    <span className={`flex items-center justify-center rounded-lg font-black shrink-0 w-6 h-6 text-base ${isServed ? 'bg-gray-200 text-gray-500' : (item.quantity > 1 ? 'bg-orange-600 text-white' : 'bg-slate-900 text-white')}`}>
                        {item.quantity}
                    </span>
                    <div className="flex-1 min-w-0">
                        <div className="font-bold text-gray-900 text-base leading-snug truncate">
                            {item.name}
                            {isServed && <span className="mr-2 text-xs text-green-600 font-bold">(הוגש)</span>}
                        </div>
                        <div className="flex flex-wrap gap-1">
                            {modifiers.map((mod, i) => {
                                const short = getShortName(mod.text || mod.valueName || mod);
                                if (!short) return null;
                                return (
                                    <span key={i} className={`text-xs px-1 rounded-md border ${getModColorClass(mod.text || mod.valueName || mod, short)}`}>
                                        {short}
                                    </span>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div
            className={`flex-shrink-0 rounded-2xl px-[5px] pt-1.5 pb-2.5 mx-2 flex flex-col h-full font-heebo bg-white ${statusStyles} ${agingClass} border-gray-100 relative overflow-hidden transition-all duration-300`}
            style={{ width: isWide ? '420px' : '280px' }}
        >
            {/* Header */}
            <div className="flex justify-between items-start mb-0.5 border-b border-gray-50 pb-0.5">
                <div className="flex flex-col">
                    <div className="flex flex-col">
                        {order.customer_name && order.customer_name !== 'אורח אנונימי' ? (
                            <>
                                <div className="font-black text-amber-600 text-2xl leading-none tracking-tight truncate max-w-[200px]">
                                    {order.customer_name}
                                </div>
                                <div className="text-xs font-bold text-gray-400 mt-0.5">
                                    #{order.order_number}
                                </div>
                            </>
                        ) : (
                            <div className="font-black text-slate-900 text-2xl leading-none tracking-tight">
                                #{order.order_number}
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    {!isHistory && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onEditOrder(order); }}
                            className="p-1 rounded bg-slate-100 hover:bg-blue-100 text-slate-500 hover:text-blue-600 transition-colors"
                        >
                            <Edit2 size={16} />
                        </button>
                    )}
                    <div className="px-1.5 py-0.5 rounded-md border text-[10px] font-black bg-gray-50 border-gray-200 text-gray-500">
                        {new Date(order.created_at).toLocaleTimeString().slice(0, 5)}
                    </div>
                </div>
            </div>

            {/* Items Container - Grid if wide */}
            <div className="flex-1 overflow-hidden relative">
                <div className={`h-full ${isWide ? 'grid grid-cols-2 gap-2' : ''}`}>
                    {/* Right Column (Always present) */}
                    <div className="flex flex-col space-y-1">
                        {rightColItems.map((item, idx) => renderItem(item, idx))}
                    </div>

                    {/* Left Column (Only if wide) */}
                    {isWide && (
                        <div className="flex flex-col space-y-1 border-r border-gray-100 pr-1">
                            {leftColItems.map((item, idx) => renderItem(item, idx + 5))}
                        </div>
                    )}
                </div>
            </div>

            {/* Footer Actions */}
            {!isHistory && (
                <div className="mt-auto flex gap-2 h-12 w-full text-sm pt-2">
                    {/* Undo Button */}
                    {isReady && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onOrderStatusUpdate(order.id, 'undo_ready'); }}
                            className="w-12 h-full bg-gray-200 border-2 border-gray-300 rounded-xl flex items-center justify-center text-gray-700 active:scale-95 transition-all"
                        >
                            <RotateCcw size={20} />
                        </button>
                    )}

                    {/* Main Action */}
                    <button
                        disabled={isUpdating}
                        onClick={async (e) => {
                            e.stopPropagation();
                            setIsUpdating(true);
                            await onOrderStatusUpdate(order.id, isReady ? 'completed' : 'ready');
                            setIsUpdating(false);
                        }}
                        className={`flex-1 rounded-xl font-black text-xl shadow-md active:scale-[0.98] transition-all flex items-center justify-center 
                    ${isReady ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-yellow-500 text-white hover:bg-yellow-600'}`}
                    >
                        {isUpdating ? '...' : (isReady ? 'מסירה' : 'מוכן')}
                    </button>
                </div>
            )}
        </div>
    );
});

export default LiteOrderCard;
