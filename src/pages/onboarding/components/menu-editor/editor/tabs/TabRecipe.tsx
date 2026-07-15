import React, { useState, useEffect } from 'react';
import { Package, Search, PlusCircle, RefreshCw, X, Check } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { OnboardingItem } from '@/pages/onboarding/types/onboardingTypes';
import { supabase } from '@/lib/supabase';
import { useOnboardingStore } from '@/pages/onboarding/store/useOnboardingStore';

interface InventoryItem {
    id: number | string;
    original_uuid?: string; // For catalog items
    name: string;
    display_unit: string;
    base_unit: string;
    cost_per_unit?: number;
    recipe_step?: number;
    isCatalogOnly?: boolean;
    category?: string;
    weight_per_unit?: number;
}

interface TabRecipeProps {
    localItem: OnboardingItem;
    setLocalItem: React.Dispatch<React.SetStateAction<OnboardingItem>>;
}

const TabRecipe = ({ localItem, setLocalItem }: TabRecipeProps) => {
    const businessId = useOnboardingStore(state => state.businessId);

    // Inventory State
    const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
    const [isLoadingInventory, setIsLoadingInventory] = useState(false);
    const [isAddingIngredient, setIsAddingIngredient] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    
    // Custom Confirmation Modal State
    const [confirmItem, setConfirmItem] = useState<InventoryItem | null>(null);
    const [isCheckingOut, setIsCheckingOut] = useState(false);

    useEffect(() => {
        const fetchInventory = async () => {
            setIsLoadingInventory(true);
            try {
                // 1. Fetch Local Inventory (ID is Integer)
                let localQuery = supabase
                    .from('inventory_items')
                    .select('id, name, base_unit, display_unit, cost_per_unit, recipe_step, category')
                    .order('name');

                if (businessId) {
                    localQuery = localQuery.eq('business_id', businessId);
                }
                
                // 2. Fetch Global Catalog (ID is UUID)
                const catalogQuery = supabase
                    .from('catalog_items')
                    .select('id, name, unit, category, recipe_step, weight_per_unit, default_cost_per_unit')
                    .eq('is_active', true)
                    .order('name');

                const [localRes, catalogRes] = await Promise.all([localQuery, catalogQuery]);
                
                const localData = (localRes.data || []).map((i: any) => ({ ...i, isCatalogOnly: false }));
                const catalogData = catalogRes.data || [];
                
                // Merge and prioritize local
                const localNames = new Set(localData.map((i: any) => i.name));
                const catalogOnly = catalogData
                    .filter((c: any) => !localNames.has(c.name))
                    .map((c: any) => ({
                        id: `cat_${c.id}`,
                        original_uuid: c.id,
                        name: c.name,
                        display_unit: c.unit || 'g',
                        base_unit: c.unit || 'g',
                        category: c.category,
                        recipe_step: c.recipe_step || 10,
                        weight_per_unit: c.weight_per_unit || 1000,
                        cost_per_unit: c.default_cost_per_unit || 0,
                        isCatalogOnly: true
                    }));

                setInventoryItems([...localData, ...catalogOnly]);
            } catch (err) {
                console.error('Failed to fetch inventory:', err);
            } finally {
                setIsLoadingInventory(false);
            }
        };
        fetchInventory();
    }, [businessId]);

    const filteredInventory = inventoryItems.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()));

    const handleAddIngredient = async (invItem: InventoryItem) => {
        if (invItem.isCatalogOnly) {
            setConfirmItem(invItem);
            return;
        }
        performAddIngredient(invItem);
    };

    const performAddIngredient = (invItem: InventoryItem) => {
        const newRecipe = [...(localItem.recipe || [])];
        newRecipe.push({
            ingredient: invItem.name,
            quantity: String(invItem.recipe_step || 10),
            unit: invItem.display_unit || invItem.base_unit,
            cost: invItem.cost_per_unit || 0
        });
        setLocalItem({ 
            ...localItem, 
            recipe: newRecipe,
            // Automatically update total cost
            cost: newRecipe.reduce((sum, r) => sum + (r.cost || 0) * (parseFloat(r.quantity) || 0), 0)
        });
        setIsAddingIngredient(false);
        setSearchQuery('');
        setConfirmItem(null);
    };

    const handleConfirmAddToInventory = async () => {
        if (!confirmItem || !confirmItem.original_uuid) return;
        setIsCheckingOut(true);
        try {
            const dbItem = {
                business_id: businessId,
                name: confirmItem.name,
                display_unit: confirmItem.display_unit || 'g',
                base_unit: confirmItem.base_unit || 'g',
                category: confirmItem.category || 'כללי',
                cost_per_unit: confirmItem.cost_per_unit || 0,
                current_stock: 0,
                recipe_step: confirmItem.recipe_step || 10,
                catalog_item_id: confirmItem.original_uuid, // UUID link
                yield_percentage: 100
            };
            
            const { data, error } = await supabase.from('inventory_items').insert([dbItem]).select();
            
            if (error) throw error;

            // Update local state to show it's now local
            const newLocalItem = { 
                ...confirmItem, 
                id: data[0].id, // Now it has an integer ID
                isCatalogOnly: false 
            };
            
            setInventoryItems(prev => prev.map(i => i.id === confirmItem.id ? newLocalItem : i));
            performAddIngredient(newLocalItem);
        } catch (e) {
            console.error('Failed to insert catalog item to local inventory:', e);
            alert('שגיאה בהוספת המוצר למלאי המקומי');
        } finally {
            setIsCheckingOut(false);
        }
    };

    return (
        <div className="space-y-4 h-full flex flex-col" dir="rtl">
            {/* 1. Food Cost & Profitability (Compact) */}
            <div className="bg-emerald-50/30 p-4 rounded-2xl border border-emerald-100 flex-none">
                <div className="flex items-center gap-4 bg-white rounded-xl border border-emerald-100 p-3 shadow-sm">
                    <div className="flex-1">
                        <p className="text-[10px] font-black text-emerald-600 uppercase mb-0.5">עלות מנה (Food Cost)</p>
                        <div className="flex items-center gap-1" dir="ltr">
                            <span className="text-emerald-400 font-bold text-sm">₪</span>
                            <input
                                type="number"
                                value={localItem.cost || 0}
                                onChange={e => setLocalItem({ ...localItem, cost: parseFloat(e.target.value) || 0 })}
                                className="w-20 bg-transparent font-black text-lg text-emerald-700 outline-none"
                            />
                        </div>
                    </div>
                    <div className="h-8 w-px bg-emerald-100" />
                    <div className="flex-1 text-right">
                        <p className="text-[10px] font-black text-emerald-600 uppercase mb-0.5">רווח גולמי</p>
                        <p className="font-black text-lg text-emerald-700">₪{Math.max(0, (localItem.price || 0) - (localItem.cost || 0)).toFixed(1)}</p>
                    </div>
                </div>
            </div>

            {/* 2. Recipe & Ingredients (Scrollable) */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col flex-1 overflow-hidden min-h-0">
                <div className="p-3 border-b border-slate-50 bg-slate-50/30 flex items-center justify-between flex-none">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                        <Package size={12} /> מתכון ורכיבים
                    </label>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-400">סה"כ רכיבים:</span>
                        <span className="text-sm font-black text-slate-700 bg-white px-2 py-0.5 rounded-lg border border-slate-100 shadow-sm">
                            ₪{(localItem.recipe || []).reduce((sum, item) => sum + (item.cost || 0) * (parseFloat(item.quantity) || 0), 0).toFixed(2)}
                        </span>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2 relative">
                    {(localItem.recipe || []).map((step, idx) => (
                        <div key={idx} className="flex items-center gap-3 bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm transition-all" dir="ltr">
                            <button
                                onClick={() => {
                                    const updated = (localItem.recipe || []).filter((_, i) => i !== idx);
                                    setLocalItem(prev => {
                                        const newCost = updated.reduce((sum, start) => sum + (start.cost || 0) * (parseFloat(start.quantity) || 0), 0);
                                        return { ...prev, recipe: updated, cost: newCost };
                                    });
                                }}
                                className="w-6 h-6 flex items-center justify-center rounded-full bg-slate-50 text-slate-300 hover:bg-red-50 hover:text-red-500 transition-colors flex-none"
                            >
                                <X size={12} />
                            </button>

                            <div className="flex-1 min-w-0">
                                <div className="text-xs font-bold text-slate-700 leading-tight truncate">{step.ingredient}</div>
                                <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                                    <span className="bg-slate-50 px-1.5 py-px rounded">₪{step.cost?.toFixed(2)} / {step.unit}</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-1 flex-none" dir="ltr">
                                <button
                                    onClick={() => {
                                        const current = parseFloat(step.quantity) || 0;
                                        const invItem = inventoryItems.find(i => i.name === step.ingredient);
                                        const stepSize = invItem?.recipe_step || 10;
                                        const newVal = Math.max(0, current - stepSize);
                                        const updated = [...(localItem.recipe || [])];
                                        updated[idx].quantity = String(Math.round(newVal * 100) / 100);
                                        const newTotalCost = updated.reduce((sum, item) => sum + (item.cost || 0) * (parseFloat(item.quantity) || 0), 0);
                                        setLocalItem({ ...localItem, recipe: updated, cost: newTotalCost });
                                    }}
                                    className="w-8 h-8 flex items-center justify-center bg-slate-50 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-100 font-bold"
                                >
                                    -
                                </button>
                                <div className="w-14 h-8 bg-white rounded-lg border border-slate-200 flex items-center justify-center overflow-hidden">
                                    <input
                                        type="number"
                                        value={step.quantity}
                                        onChange={e => {
                                            const updated = [...(localItem.recipe || [])];
                                            updated[idx].quantity = e.target.value;
                                            const newTotalCost = updated.reduce((sum, item) => sum + (item.cost || 0) * (parseFloat(item.quantity) || 0), 0);
                                            setLocalItem({ ...localItem, recipe: updated, cost: newTotalCost });
                                        }}
                                        className="w-full text-center text-xs font-black text-indigo-700 outline-none bg-transparent px-1"
                                    />
                                </div>
                                <button
                                    onClick={() => {
                                        const current = parseFloat(step.quantity) || 0;
                                        const invItem = inventoryItems.find(i => i.name === step.ingredient);
                                        const stepSize = invItem?.recipe_step || 10;
                                        const newVal = current + stepSize;
                                        const updated = [...(localItem.recipe || [])];
                                        updated[idx].quantity = String(Math.round(newVal * 100) / 100);
                                        const newTotalCost = updated.reduce((sum, item) => sum + (item.cost || 0) * (parseFloat(item.quantity) || 0), 0);
                                        setLocalItem({ ...localItem, recipe: updated, cost: newTotalCost });
                                    }}
                                    className="w-8 h-8 flex items-center justify-center bg-slate-50 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-100 font-bold"
                                >
                                    +
                                </button>
                            </div>
                        </div>
                    ))}

                    {(!localItem.recipe || localItem.recipe.length === 0) && !isAddingIngredient && (
                        <div className="flex flex-col items-center justify-center py-8 text-slate-300 border-2 border-dashed border-slate-50 rounded-xl m-2">
                            <Package size={32} className="mb-2 opacity-20" />
                            <p className="text-[10px]">הרשימה ריקה</p>
                        </div>
                    )}
                </div>

                {/* Footer / Search */}
                <div className="p-3 bg-white border-t border-slate-100 flex-none relative">
                    {isAddingIngredient ? (
                        <div className="animate-in slide-in-from-bottom-2 fade-in duration-200">
                            <div className="relative flex items-center mb-2">
                                <Search size={16} className="absolute right-3 text-slate-400 pointer-events-none" />
                                <input
                                    autoFocus
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="חפש מוצר ממלאי..."
                                    className="w-full h-10 pr-10 pl-10 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none"
                                />
                                <button onClick={() => setIsAddingIngredient(false)} className="absolute left-3 p-1 rounded-full text-slate-400">
                                    <X size={14} />
                                </button>
                            </div>
                            <div className="absolute inset-x-3 bottom-full mb-2 max-h-48 overflow-y-auto custom-scrollbar rounded-xl border border-slate-100 shadow-lg bg-white z-50">
                                {isLoadingInventory ? (
                                    <div className="p-4 text-center text-xs text-slate-400">טוען...</div>
                                ) : filteredInventory.length > 0 ? (
                                    filteredInventory.slice(0, 50).map(item => (
                                        <button
                                            key={item.id}
                                            onClick={() => handleAddIngredient(item)}
                                            className="w-full flex items-center justify-between p-3 border-b border-slate-50 last:border-0 hover:bg-indigo-50 text-right group"
                                        >
                                            <div className="flex flex-col items-start min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold text-slate-700">{item.name}</span>
                                                    {item.isCatalogOnly ? (
                                                        <span className="flex items-center gap-1 text-[9px] font-bold text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded-full border border-blue-100">
                                                            <Package size={10} /> קטלוג גלובלי
                                                        </span>
                                                    ) : (
                                                        <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-500 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-100">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> המלאי שלי
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="w-5 h-5 rounded-full border border-slate-200 flex items-center justify-center">
                                                <PlusCircle size={12} />
                                            </div>
                                        </button>
                                    ))
                                ) : (
                                    <div className="p-4 text-center text-xs text-slate-400">לא נמצא</div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={() => setIsAddingIngredient(true)}
                            className="w-full py-3 bg-slate-900 text-white rounded-xl shadow-md hover:bg-slate-800 transition-all flex items-center justify-center gap-2 text-xs font-bold"
                        >
                            <PlusCircle size={16} /> הוסף מרכיב
                        </button>
                    )}
                </div>
            </div>

            {/* Premium Confirmation Modal */}
            <AnimatePresence>
                {confirmItem && (
                    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setConfirmItem(null)}
                            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="bg-white rounded-[2.5rem] w-full max-w-sm overflow-hidden shadow-2xl relative z-10 border border-slate-100"
                        >
                            <div className="p-8 text-center flex flex-col items-center">
                                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-6">
                                    <Package size={32} className="text-blue-500" />
                                </div>
                                <h3 className="text-xl font-black text-slate-900 mb-2">מוצר מהקטלוג הגלובלי</h3>
                                <p className="text-sm text-slate-500 font-medium leading-relaxed">
                                    האם להוסיף את <span className="font-black text-slate-900">"{confirmItem.name}"</span> גם לרשימת המלאי של הסניף?
                                </p>
                                <p className="text-[10px] text-slate-400 mt-2 italic font-medium">
                                    זה יאפשר לך לנהל ספקים ולעקוב אחר עלויות הקנייה של המוצר בסניף זה.
                                </p>
                            </div>

                            <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex flex-col gap-3">
                                <button
                                    onClick={handleConfirmAddToInventory}
                                    disabled={isCheckingOut}
                                    className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-[13px] uppercase tracking-wide shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                    {isCheckingOut ? <RefreshCw size={18} className="animate-spin" /> : <><Check size={18} /> הוסף למלאי ולמתכון</>}
                                </button>
                                <button
                                    onClick={() => performAddIngredient(confirmItem)}
                                    disabled={isCheckingOut}
                                    className="w-full py-4 bg-white text-slate-500 rounded-2xl font-black text-[13px] uppercase tracking-wide border border-slate-200 hover:bg-slate-50 active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                    <PlusCircle size={18} /> הוסף למתכון בלבד
                                </button>
                                <button
                                    onClick={() => setConfirmItem(null)}
                                    disabled={isCheckingOut}
                                    className="w-full py-2 text-slate-400 font-bold text-[11px] uppercase tracking-widest hover:text-slate-600"
                                >
                                    ביטול
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default TabRecipe;
