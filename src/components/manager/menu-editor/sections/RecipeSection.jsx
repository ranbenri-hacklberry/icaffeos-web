import React, { useState, useMemo } from 'react';
import { Package, ChevronDown, Plus, Trash2, Search, Box } from 'lucide-react';
import AnimatedSection from '@/components/manager/menu-editor/AnimatedSection';

const RecipeSection = ({
    components,
    setComponents,
    onDelete,
    inventoryOptions,
    calculateIngredient,
    isOpen,
    onToggle
}) => {
    const [isAdding, setIsAdding] = useState(false);
    const [newIngredient, setNewIngredient] = useState({ inventory_item_id: '', quantity: '', unit: '' });
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedIds, setExpandedIds] = useState(new Set());

    // Derived: Total Cost
    const totalCost = useMemo(() => {
        return components.reduce((sum, c) => sum + (Number(c.subtotal) || 0), 0);
    }, [components]);

    // Derived: Filtered Inventory Options
    const filteredOptions = useMemo(() => {
        if (!searchTerm) return inventoryOptions;
        return inventoryOptions.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [inventoryOptions, searchTerm]);

    const handleAdd = () => {
        if (!newIngredient.inventory_item_id || !newIngredient.quantity) return;

        const newItem = calculateIngredient(
            newIngredient.inventory_item_id,
            newIngredient.quantity,
            newIngredient.unit
        );

        if (newItem) {
            setComponents(prev => [...prev, newItem]);
            setNewIngredient({ inventory_item_id: '', quantity: '', unit: '' });
            setIsAdding(false);
            setSearchTerm('');
        }
    };

    const toggleExpand = (id) => {
        setExpandedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    return (
        <div className={`bg-white rounded-2xl border transition-all duration-300 ${isOpen ? 'border-blue-300 shadow-md ring-1 ring-blue-100' : 'border-gray-200 shadow-sm'} overflow-hidden relative mt-2`}>
            {/* Header */}
            <div
                onClick={onToggle}
                className={`p-4 flex items-center justify-between cursor-pointer select-none transition-colors ${isOpen ? 'bg-blue-50/30' : 'bg-white hover:bg-gray-50'}`}
            >
                <div className="flex items-center gap-4 overflow-hidden flex-1">
                    <div className="w-12 h-12 flex items-center justify-center rounded-2xl shrink-0 bg-purple-100 text-purple-600">
                        <Package size={24} strokeWidth={1.5} />
                    </div>
                    <div className="flex flex-col min-w-0">
                        <h3 className="font-black text-gray-800 text-base truncate leading-tight">מרכיבים ועלות</h3>
                        {!isOpen && (
                            <span className="text-xs font-bold text-gray-400 mt-0.5">
                                {components.length} מרכיבים • עלות: ₪{totalCost.toFixed(2)}
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-3 pl-1">
                    {!isOpen && (
                        <div className="flex flex-col items-center justify-center px-3 py-1.5 rounded-xl border min-w-[3.5rem] bg-gray-50 border-gray-100 text-gray-700">
                            <span className="text-[9px] font-bold text-gray-400 leading-none mb-0.5 uppercase tracking-wide">עלות</span>
                            <span className="font-black text-lg leading-none">₪{totalCost.toFixed(1)}</span>
                        </div>
                    )}
                    <div className={`p-1 rounded-full text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180 bg-gray-100' : ''}`}>
                        <ChevronDown size={20} />
                    </div>
                </div>
            </div>

            {/* Content */}
            <AnimatedSection show={isOpen}>
                <div className="border-t border-gray-100 p-4 bg-white">

                    {/* Components List */}
                    <div className="space-y-2 mb-4">
                        {components.length === 0 ? (
                            <div className="text-center py-8 bg-gray-50 rounded-xl border-2 border-dashed border-gray-100 text-gray-300">
                                <Box size={32} className="mx-auto mb-2 opacity-50" />
                                <span className="text-sm font-bold">אין מרכיבים</span>
                            </div>
                        ) : (
                            components.map((comp, index) => (
                                <div key={comp.id || index} className="group relative">
                                    <div className="flex items-center p-3 bg-white border border-gray-100 rounded-xl hover:border-blue-200 transition-all shadow-sm">
                                        <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center text-gray-400 text-xs font-bold shrink-0 ml-3">
                                            {index + 1}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold text-gray-800 text-sm truncate">{comp.name}</div>
                                            <div className="text-xs text-gray-400 flex gap-2">
                                                <span>{comp.quantity} {comp.unit}</span>
                                                <span>•</span>
                                                <span>₪{Number(comp.price || 0).toFixed(2)} ליח'</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="text-left">
                                                <div className="font-bold text-gray-800 text-sm">₪{Number(comp.subtotal || 0).toFixed(2)}</div>
                                            </div>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onDelete(comp.id); }}
                                                className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Add Button / Form */}
                    {!isAdding ? (
                        <button
                            onClick={() => setIsAdding(true)}
                            className="w-full py-3 flex items-center justify-center gap-2 bg-gray-50 text-gray-500 font-bold rounded-xl hover:bg-gray-100 border border-transparent hover:border-gray-200 transition-all text-sm"
                        >
                            <Plus size={18} />
                            הוסף רכיב למתכון
                        </button>
                    ) : (
                        <div className="bg-gray-50 rounded-xl p-4 border border-blue-100 animate-in fade-in slide-in-from-top-2">
                            <div className="text-xs font-bold text-blue-500 mb-3">הוספת רכיב חדש</div>

                            <div className="space-y-3">
                                {/* Item Select */}
                                <div>
                                    <div className="relative">
                                        <select
                                            value={newIngredient.inventory_item_id}
                                            onChange={e => {
                                                const id = e.target.value;
                                                const item = inventoryOptions.find(i => String(i.id) === String(id));
                                                setNewIngredient(p => ({ ...p, inventory_item_id: id, unit: item?.unit || 'kg' }));
                                            }}
                                            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-bold outline-none focus:border-blue-500 appearance-none"
                                        >
                                            <option value="">בחר פריט מלאי...</option>
                                            {inventoryOptions.map(opt => (
                                                <option key={opt.id} value={opt.id}>{opt.name} ({opt.unit}) - ₪{opt.cost}</option>
                                            ))}
                                        </select>
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                            <ChevronDown size={16} />
                                        </div>
                                    </div>
                                </div>

                                {/* Qty & Unit */}
                                <div className="grid grid-cols-2 gap-3">
                                    <input
                                        type="number"
                                        value={newIngredient.quantity}
                                        onChange={e => setNewIngredient(p => ({ ...p, quantity: e.target.value }))}
                                        placeholder="כמות"
                                        className="px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-bold outline-none focus:border-blue-500"
                                    />
                                    <input
                                        type="text"
                                        value={newIngredient.unit}
                                        onChange={e => setNewIngredient(p => ({ ...p, unit: e.target.value }))}
                                        placeholder="יחידה (ק״ג/ליטר)"
                                        className="px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-bold outline-none focus:border-blue-500"
                                    />
                                </div>

                                <div className="flex gap-2 mt-2">
                                    <button
                                        onClick={handleAdd}
                                        disabled={!newIngredient.inventory_item_id || !newIngredient.quantity}
                                        className="flex-1 bg-blue-600 text-white font-bold py-2.5 rounded-xl text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        הוסף
                                    </button>
                                    <button
                                        onClick={() => setIsAdding(false)}
                                        className="px-4 bg-white border border-gray-200 text-gray-600 font-bold py-2.5 rounded-xl text-sm hover:bg-gray-50"
                                    >
                                        ביטול
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </AnimatedSection>
        </div>
    );
};

export default RecipeSection;
