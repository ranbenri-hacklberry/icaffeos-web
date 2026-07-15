import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChefHat, Snowflake, Package, Plus, Minus, AlertTriangle, Check } from 'lucide-react';
import { InventoryItem } from '@/pages/ipad_inventory/types';

const MotionDiv = motion.div as any;

interface PreparedItemsViewProps {
    items: InventoryItem[];
    onUpdateStock: (itemId: string, newStock: number) => void;
    isLoading: boolean;
}

const PreparedItemsView: React.FC<PreparedItemsViewProps> = ({ items, onUpdateStock, isLoading }) => {
    // Split items by prep type (assuming defrost items have specific keywords or future prep_type field)
    const { prepItems, defrostItems } = useMemo(() => {
        const prep: InventoryItem[] = [];
        const defrost: InventoryItem[] = [];

        items.forEach(item => {
            // Check if item name or category indicates defrost
            const isDefrost = item.name.includes('הפשרה') || item.name.includes('קפוא') || item.category?.includes('defrost');
            if (isDefrost) {
                defrost.push(item);
            } else {
                prep.push(item);
            }
        });

        return { prepItems: prep, defrostItems: defrost };
    }, [items]);

    if (isLoading) {
        return (
            <div className="flex-1 h-full flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="flex-1 h-full overflow-y-auto p-6 bg-slate-50 no-scrollbar">
            {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center p-10 bg-white rounded-2xl border-2 border-dashed border-slate-100">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-4">
                        <Package size={32} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-400">אין פריטים למעקב</h3>
                    <p className="text-slate-400 max-w-xs mx-auto mt-2 text-sm">
                        רק פריטים שהוגדרו עם ניהול מלאי הקשור להכנות והפשרות מופיעים כאן.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Preparations - 2 columns */}
                    <div className="md:col-span-2 flex flex-col gap-4">
                        <div className="flex items-center justify-between px-2">
                            <h4 className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                <ChefHat size={14} />
                                הכנות וייצור
                            </h4>
                            <span className="text-[10px] font-black bg-slate-100/80 text-slate-400 px-2 py-0.5 rounded-full">
                                {prepItems.length}
                            </span>
                        </div>
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 min-h-[100px]">
                            {prepItems.length === 0 ? (
                                <div className="xl:col-span-2 flex flex-col items-center justify-center py-12 bg-white/50 rounded-3xl border border-dashed border-slate-200">
                                    <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-200 mb-2">
                                        <ChefHat size={24} />
                                    </div>
                                    <p className="font-black text-[10px] text-slate-300 uppercase tracking-widest">אין הכנות</p>
                                </div>
                            ) : (
                                prepItems.map(item => (
                                    <PreparedItemCard
                                        key={item.id}
                                        item={item}
                                        onUpdateStock={onUpdateStock}
                                    />
                                ))
                            )}
                        </div>
                    </div>

                    {/* Defrosting - 1 column */}
                    <div className="md:col-span-1 flex flex-col gap-4">
                        <div className="flex items-center justify-between px-2">
                            <h4 className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                <Snowflake size={14} />
                                הפשרה
                            </h4>
                            <span className="text-[10px] font-black bg-slate-100/80 text-slate-400 px-2 py-0.5 rounded-full">
                                {defrostItems.length}
                            </span>
                        </div>
                        <div className="flex flex-col gap-3 min-h-[100px]">
                            {defrostItems.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 bg-white/50 rounded-3xl border border-dashed border-slate-200">
                                    <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-200 mb-2">
                                        <Snowflake size={24} />
                                    </div>
                                    <p className="font-black text-[10px] text-slate-300 uppercase tracking-widest">אין הפשרות</p>
                                </div>
                            ) : (
                                defrostItems.map(item => (
                                    <PreparedItemCard
                                        key={item.id}
                                        item={item}
                                        onUpdateStock={onUpdateStock}
                                    />
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const PreparedItemCard: React.FC<{ item: InventoryItem, onUpdateStock: (itemId: string, newStock: number) => void }> = ({ item, onUpdateStock }) => {
    const wpu = parseFloat(item.weight_per_unit as any) || 0;
    const thresholdGrams = (parseFloat(item.low_stock_threshold_units as any) || 0) * (wpu || 1);
    const isLowStock = thresholdGrams > 0 && item.current_stock <= thresholdGrams;

    const [localStock, setLocalStock] = useState(item.current_stock);
    const [isDirty, setIsDirty] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [lastCountedDate, setLastCountedDate] = useState(item.last_counted_at);

    const step = Number(item.inventory_count_step) || 1;
    const displayStock = Number(localStock.toFixed(4));

    const handleIncrement = () => {
        const currentDisplay = localStock;
        // Round UP to the next multiple of step
        const nextDisplay = Math.ceil((currentDisplay + 0.00001) / step) * step;
        const finalDisplay = (nextDisplay - currentDisplay < 0.001) 
            ? nextDisplay + step 
            : nextDisplay;

        setLocalStock(finalDisplay);
        setIsDirty(true);
    };

    const handleDecrement = () => {
        const currentDisplay = localStock;
        // Round DOWN to the previous multiple of step
        const prevDisplay = Math.floor((currentDisplay - 0.00001) / step) * step;
        const finalDisplay = (currentDisplay - prevDisplay < 0.001) 
            ? prevDisplay - step 
            : prevDisplay;

        const finalDisplayClamped = Math.max(0, finalDisplay);
        setLocalStock(finalDisplayClamped);
        setIsDirty(true);
    };

    const handleSave = async () => {
        setIsSaving(true);
        await onUpdateStock(item.id, localStock);
        setLastCountedDate(new Date().toISOString());
        setIsSaving(false);
        setIsDirty(false);
    };

    return (
        <MotionDiv
            layout
            className={`group flex items-center gap-4 p-2.5 rounded-2xl border transition-all duration-200 bg-white shadow-sm ${isLowStock ? 'ring-1 ring-amber-200 border-amber-200' : 'border-slate-100 hover:border-slate-200'}`}
        >
            {/* Complete/Save Button */}
            <button
                onClick={handleSave}
                disabled={!isDirty || isSaving}
                className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center transition-all shadow-sm active:scale-90
                    ${isDirty ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-500 hover:text-white' : 'bg-slate-50 text-slate-200 cursor-not-allowed'}`}
            >
                {isSaving ? (
                    <div className="w-5 h-5 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                ) : (
                    <Check size={20} strokeWidth={2.5} />
                )}
            </button>

            {/* Middle Info */}
            <div className="flex-1 min-w-0 flex flex-col justify-center text-right">
                <div className="flex items-center gap-2 justify-start">
                    {isLowStock && <AlertTriangle size={14} className="text-amber-500 shrink-0" />}
                    <h4 className="font-black text-slate-800 text-sm leading-tight truncate">{item.name}</h4>
                    {isDirty && <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shrink-0" />}
                </div>
                {lastCountedDate && !isDirty && (
                    <div className="text-[9px] text-slate-400 font-bold mt-1">
                        נספר: {new Date(lastCountedDate).toLocaleDateString('he-IL')}
                    </div>
                )}
            </div>

            {/* Counter */}
            <div className="flex items-center bg-slate-50 p-1 rounded-xl border border-slate-100 h-10 shrink-0">
                <button
                    onClick={handleIncrement}
                    className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm text-slate-400 hover:text-emerald-500 transition active:scale-90"
                >
                    <Plus size={14} />
                </button>
                <div className="w-12 text-center flex flex-col justify-center leading-none">
                    <span className={`text-sm font-black ${isDirty ? 'text-indigo-600' : 'text-slate-600'} tabular-nums`}>
                        {displayStock % 1 === 0 ? displayStock : displayStock.toFixed(2)}
                    </span>
                    <span className="text-[9px] text-slate-400 font-bold">{item.base_unit || 'יח\''}</span>
                </div>
                <button
                    onClick={handleDecrement}
                    className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm text-slate-400 hover:text-rose-500 transition active:scale-90"
                >
                    <Minus size={14} />
                </button>
            </div>
        </MotionDiv>
    );
};

export default PreparedItemsView;
