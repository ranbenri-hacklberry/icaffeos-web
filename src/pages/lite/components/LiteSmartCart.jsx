
import React, { useState, useEffect } from 'react';
import { ShoppingBag, ArrowRight, Trash2, Clock } from 'lucide-react';
import { getShortName, getModColorClass } from '@/config/modifierShortNames';

const LiteSmartCart = ({
    cart = [],
    onRemoveFromCart,
    onInitiatePayment,
    className = ''
}) => {
    // We assume the containing component passes plain 'cart' array
    // Item structure: { id, name, price, quantity, active: bool, ... }

    // Sort items? Usually just list them in order added.
    const activeItems = cart.filter(i => !i.isDelayed);
    const delayedItems = cart.filter(i => i.isDelayed);

    const total = cart.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);

    const renderItem = (item) => {
        // Modifiers Logic: same as KDS/Menu
        let modifiers = item.modifiers || [];
        if (!modifiers.length && item.selectedOptions) modifiers = item.selectedOptions;
        if (!modifiers.length && item.mods) {
            try { modifiers = typeof item.mods === 'string' ? JSON.parse(item.mods) : item.mods; } catch (e) { }
        }
        if (!Array.isArray(modifiers) && modifiers && typeof modifiers === 'object') {
            modifiers = Object.values(modifiers).map(v => ({ text: v }));
        }

        return (
            <div key={item.internalId || item.id} className="group flex items-center justify-between px-2 py-3 border-b border-slate-800 bg-slate-900 transition-colors gap-2 hover:bg-slate-800/50">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        {item.quantity > 1 && (
                            <span className="bg-orange-900/40 text-orange-400 text-xs font-bold px-1.5 py-0.5 rounded border border-orange-800/50">
                                x{item.quantity}
                            </span>
                        )}
                        <span className="font-bold text-slate-200 truncate text-base leading-tight">
                            {item.name}
                        </span>
                        <span className="font-mono font-bold text-white mr-auto">
                            ₪{item.price * (item.quantity || 1)}
                        </span>
                    </div>
                    {/* Modifiers */}
                    {modifiers.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5 pr-0.5">
                            {modifiers.map((mod, i) => {
                                const modName = mod.text || mod.valueName || mod;
                                const shortName = getShortName(modName);
                                if (!shortName) return null;
                                return (
                                    <span key={i} className={`mod-label ${getModColorClass(modName, shortName)} px-1.5 py-0.5 rounded text-[10px]`}>
                                        {shortName}
                                    </span>
                                );
                            })}
                        </div>
                    )}
                </div>

                <button
                    onClick={() => onRemoveFromCart(item.internalId || item.id)}
                    className="p-2 text-slate-600 hover:text-red-400 rounded-lg hover:bg-red-900/10 transition-colors"
                >
                    <Trash2 size={18} />
                </button>
            </div>
        );
    };

    return (
        <div className={`flex flex-col h-full bg-slate-900 border-r border-slate-800 shadow-xl z-10 ${className}`} dir="rtl">
            {/* Header */}
            <div className="p-4 bg-slate-900 border-b border-slate-800 shadow-sm flex items-center gap-2">
                <ShoppingBag className="text-amber-500" />
                <h2 className="text-xl font-black text-white">ההזמנה שלך</h2>
                <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full text-xs font-bold mr-auto border border-slate-700">
                    {cart.reduce((s, i) => s + (i.quantity || 1), 0)} פריטים
                </span>
            </div>

            {/* Items List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {cart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center opacity-40 p-6">
                        <ShoppingBag size={48} className="text-slate-600 mb-4" />
                        <p className="text-slate-500 font-bold mb-1">העגלה ריקה</p>
                        <p className="text-slate-600 text-sm">הוסף פריטים מהתפריט בצד שמאל</p>
                    </div>
                ) : (
                    <div className="flex flex-col">
                        {activeItems.map(renderItem)}

                        {delayedItems.length > 0 && activeItems.length > 0 && (
                            <div className="relative py-4 text-center">
                                <div className="absolute inset-0 flex items-center px-4">
                                    <div className="w-full border-t border-dashed border-amber-800/50"></div>
                                </div>
                                <span className="relative px-3 text-[10px] font-bold flex items-center justify-center gap-1 mx-auto w-fit rounded-full bg-slate-900 text-amber-500 border border-amber-900/50 z-10">
                                    <Clock size={10} />
                                    המשך הארוחה
                                </span>
                            </div>
                        )}

                        {delayedItems.map(renderItem)}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-900 border-t border-slate-800 shadow-[0_-4px_20px_rgba(0,0,0,0.2)]">
                <div className="flex justify-between items-end mb-4 px-1">
                    <span className="text-slate-400 font-bold text-sm">סה"כ לתשלום:</span>
                    <span className="text-3xl font-black text-white tracking-tight leading-none">
                        ₪{total}
                    </span>
                </div>

                <button
                    onClick={onInitiatePayment}
                    disabled={cart.length === 0}
                    className="w-full py-4 rounded-xl font-black text-lg shadow-lg shadow-amber-900/20 active:scale-[0.98] transition-all flex items-center justify-between px-6 bg-amber-500 hover:bg-amber-600 text-white disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed disabled:shadow-none bg-gradient-to-r from-amber-500 to-orange-600"
                >
                    <span>לתשלום</span>
                    <ArrowRight size={20} className={cart.length > 0 ? "animate-pulse" : ""} />
                </button>
            </div>
        </div>
    );
};

export default LiteSmartCart;
