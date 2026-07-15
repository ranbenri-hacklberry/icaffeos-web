
import React, { useState, useEffect } from 'react';
import { X, CheckCircle, Circle } from 'lucide-react';
import { useStore } from '@/core/store';
import { db } from '@/db/database';

const LiteOrderEditModal = ({ order, onClose }) => {
    const { updateItemServedStatus } = useStore();
    const [items, setItems] = useState(order.items || []);

    // Keep local items in sync if order updates (optional, but good for persistence)
    useEffect(() => {
        setItems(order.items || []);
    }, [order]);

    const toggleItem = async (itemId, currentStatus) => {
        const isNowServed = currentStatus !== 'completed';
        const newStatus = isNowServed ? 'completed' : 'in_progress';

        // Optimistic UI update
        setItems(prev => prev.map(i => i.id === itemId ? { ...i, item_status: newStatus } : i));

        // Store Update
        await updateItemServedStatus(itemId, isNowServed);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in zoom-in duration-200" dir="rtl">
            <div className="bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-slate-700 flex flex-col max-h-[85vh]">

                <div className="p-4 bg-slate-800 border-b border-slate-700 flex justify-between items-center">
                    <h2 className="text-xl font-black text-white">הגשה חלקית - הזמנה #{order.order_number}</h2>
                    <button onClick={onClose} className="p-2 bg-slate-700 rounded-full text-slate-300 hover:text-white">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-2 overflow-y-auto flex-1 custom-scrollbar">
                    {items.map((item, idx) => {
                        const isServed = item.item_status === 'completed' || item.item_status === 'served';

                        // Parse mods for display
                        let modifiers = item.modifiers || [];
                        if (!modifiers.length && item.mods) {
                            try { modifiers = typeof item.mods === 'string' ? JSON.parse(item.mods) : item.mods; } catch (e) { }
                        }
                        if (!Array.isArray(modifiers) && modifiers && typeof modifiers === 'object') {
                            modifiers = Object.values(modifiers).map(v => ({ text: v }));
                        }

                        return (
                            <div
                                key={item.id || idx}
                                onClick={() => toggleItem(item.id, item.item_status)}
                                className={`p-3 mb-2 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${isServed
                                        ? 'bg-green-900/20 border-green-800/50 opacity-70'
                                        : 'bg-slate-800 border-slate-700 hover:bg-slate-750'
                                    }`}
                            >
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${isServed ? 'bg-green-500 text-white' : 'bg-slate-700 text-slate-400'
                                    }`}>
                                    {isServed ? <CheckCircle size={18} /> : <Circle size={18} />}
                                </div>

                                <div className="flex-1">
                                    <div className={`font-bold text-lg ${isServed ? 'text-green-400 line-through' : 'text-white'}`}>
                                        {item.name}
                                    </div>
                                    {modifiers.length > 0 && (
                                        <div className="text-xs text-slate-400 mt-0.5">
                                            {modifiers.map(m => m.text || m.valueName || m).join(', ')}
                                        </div>
                                    )}
                                </div>

                                <div className="font-bold text-slate-500 bg-slate-900 px-2 py-1 rounded text-sm">
                                    x{item.quantity}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="p-4 bg-slate-800 border-t border-slate-700">
                    <button
                        onClick={onClose}
                        className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl transition-colors"
                    >
                        סגור
                    </button>
                </div>

            </div>
        </div>
    );
};

export default LiteOrderEditModal;
