import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, Plus, Minus, AlertTriangle, Check, Package, Pencil, ChevronLeft, ShoppingBag } from 'lucide-react';
import { InventoryItem, Supplier } from '@/pages/ipad_inventory/types';
import { convertToBase, convertFromBase, getPackagingLevels } from '@/pages/ipad_inventory/utils/packagingUtils';

const MotionDiv = motion.div as any;

interface InventoryItemsGridProps {
    items: InventoryItem[];
    onUpdateStock: (itemId: string, newStock: number) => void;
    isLoading: boolean;
    emptyMode?: boolean;
    onEditItem?: (item: InventoryItem) => void;
    suppliers?: Supplier[];
    supplierCounts?: Record<string, number>;
    onSelectSupplier?: (id: string) => void;
}

const InventoryItemsGrid: React.FC<InventoryItemsGridProps> = ({
    items,
    onUpdateStock,
    isLoading,
    emptyMode = false,
    onEditItem,
    suppliers,
    supplierCounts,
    onSelectSupplier
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string | null>('הכל');

    const categories = useMemo(() => {
        const allCats = new Set<string>();
        items.forEach(item => {
            if (item.category) {
                item.category.split(',').forEach(c => {
                    let trimmed = c.trim();
                    if (!trimmed) return;
                    
                    // Normalize categories
                    const lower = trimmed.toLowerCase();
                    if (lower === 'dairy' || lower === 'חלב' || lower === 'מוצרי חלב') {
                        trimmed = 'מוצרי חלב';
                    } else if (trimmed === 'שימורים' || trimmed === 'רטבים' || trimmed === 'יבשים') {
                        trimmed = 'יבשים';
                    }
                    
                    allCats.add(trimmed);
                });
            }
        });
        return ['הכל', ...Array.from(allCats).sort()];
    }, [items]);

    const filteredItems = items.filter(item => {
        if (selectedCategory && selectedCategory !== 'הכל') {
            const itemCats = item.category?.split(',').map(c => {
                const trimmed = c.trim();
                const lower = trimmed.toLowerCase();
                if (lower === 'dairy' || lower === 'חלב' || lower === 'מוצרי חלב') return 'מוצרי חלב';
                if (trimmed === 'שימורים' || trimmed === 'רטבים' || trimmed === 'יבשים') return 'יבשים';
                return trimmed;
            }) || [];
            if (!itemCats.includes(selectedCategory)) return false;
        }

        if (searchQuery && !item.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
    });

    return (
        <div className="flex-1 h-full bg-slate-50 overflow-hidden flex flex-col">
            {/* Header: Categories & Local Search */}
            <div className="px-4 md:px-6 py-3 md:py-4 flex flex-col md:flex-row gap-3 md:gap-4 items-center justify-between border-b border-slate-100 bg-white shadow-sm shrink-0 z-10">
                {/* Mobile: Back to suppliers button */}
                {!emptyMode && onSelectSupplier && (
                    <button
                        onClick={() => onSelectSupplier(null as any)}
                        className="md:hidden w-full flex items-center gap-2 text-indigo-600 font-bold text-sm active:opacity-70"
                    >
                        <ChevronLeft size={18} className="rotate-180" />
                        <span>חזרה לרשימת ספקים</span>
                    </button>
                )}
                {/* Categories - hidden in emptyMode */}
                {!emptyMode && (
                <div className="flex-1 w-full overflow-hidden">
                    {/* Category Tabs (shown on all screen sizes as scrollable row) */}
                    <div className="flex bg-slate-100/80 p-1 rounded-2xl gap-1 border border-slate-200 shadow-inner overflow-x-auto no-scrollbar max-w-full">
                        {categories.length === 0 && (
                            <div className="px-4 py-2 text-sm font-bold text-slate-400 italic">ללא קטגוריות</div>
                        )}
                        {categories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shrink-0 ${selectedCategory === cat
                                    ? 'bg-white shadow-sm text-indigo-600 ring-1 ring-slate-900/5'
                                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                                    }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>
                )}

                {/* Local Search */}
                <div className={`relative shrink-0 ${emptyMode ? 'w-full md:w-96' : 'w-full md:w-64'}`}>
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder={emptyMode ? 'חיפוש פריט בכל המלאי...' : 'חיפוש מהיר...'}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className={`w-full border border-slate-200 rounded-xl py-2 pr-10 pl-4 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm transition-all ${emptyMode ? 'bg-white py-3 text-base' : 'bg-slate-50'}`}
                    />
                </div>
            </div>

            {/* Grid Area */}
            <div className="flex-1 overflow-y-auto px-4 md:px-10 py-6 pb-24 no-scrollbar">
                {isLoading ? (
                    <div className="h-full flex items-center justify-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                    </div>
                ) : !selectedCategory ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-4">
                        <div className="p-6 bg-slate-100 rounded-full">
                            <Package size={48} />
                        </div>
                        <span className="text-xl font-bold">יש לבחור קטגוריה למעלה</span>
                        <span className="text-sm font-bold text-slate-400">הסחורה מסודרת לפי קטגוריות לייעול הספירה</span>
                    </div>
                ) : (emptyMode && !searchQuery) ? (
                    <div className="h-full flex flex-col items-center pt-4 md:pt-0 md:justify-center gap-4 md:gap-6 px-4">
                        {/* Icon + Title — desktop only */}
                        <div className="hidden md:flex w-32 h-32 bg-slate-100 rounded-full items-center justify-center border-4 border-white shadow-inner">
                            <Package size={56} className="text-slate-300" />
                        </div>
                        <div className="text-center">
                            <span className="text-lg md:text-2xl font-black text-slate-400 block mb-0.5 md:mb-1">בחר ספק</span>
                            <span className="text-slate-300 font-medium text-xs md:text-sm block">או חפש פריט ספציפי בשורת החיפוש למעלה</span>
                        </div>

                        {/* Inline Supplier Picker */}
                        {suppliers && onSelectSupplier && (
                            <div className="w-full max-w-lg space-y-2 mt-0 md:mt-2">
                                {suppliers
                                    .filter(s => (supplierCounts?.[String(s.id)] || 0) > 0)
                                    .map(supplier => {
                                        const count = supplierCounts?.[String(supplier.id)] || 0;
                                        return (
                                            <button
                                                key={supplier.id}
                                                onClick={() => onSelectSupplier(String(supplier.id))}
                                                className="w-full flex items-center justify-between p-3.5 md:p-4 bg-white hover:bg-indigo-50 rounded-2xl border border-slate-100 hover:border-indigo-200 transition-all shadow-sm active:scale-[0.98]"
                                            >
                                                <div className="flex flex-col items-start gap-0.5">
                                                    <span className="font-bold text-slate-800">{supplier.name}</span>
                                                    <span className="text-xs text-slate-400 font-medium">{count} פריטים</span>
                                                </div>
                                                <ChevronLeft size={18} className="text-slate-300" />
                                            </button>
                                        );
                                    })}
                                {(supplierCounts?.['uncategorized'] || 0) > 0 && (
                                    <button
                                        onClick={() => onSelectSupplier('uncategorized')}
                                        className="w-full flex items-center justify-between p-3.5 md:p-4 bg-white hover:bg-indigo-50 rounded-2xl border border-slate-100 hover:border-indigo-200 transition-all shadow-sm active:scale-[0.98]"
                                    >
                                        <div className="flex flex-col items-start gap-0.5">
                                            <span className="font-bold text-slate-800">כללי / ללא ספק</span>
                                            <span className="text-xs text-slate-400 font-medium">{supplierCounts?.['uncategorized'] || 0} פריטים</span>
                                        </div>
                                        <ChevronLeft size={18} className="text-slate-300" />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                ) : filteredItems.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-4">
                        <div className="p-6 bg-slate-100 rounded-full">
                            <Search size={48} />
                        </div>
                        <span className="text-xl font-bold">לא נמצאו פריטים תואמים</span>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {filteredItems.map((item) => (
                            <InventoryItemCard
                                key={item.id}
                                item={item}
                                onUpdateStock={onUpdateStock}
                                onEditItem={onEditItem}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

const InventoryItemCard: React.FC<{
    item: InventoryItem;
    onUpdateStock: (itemId: string, newStock: number) => void;
    onEditItem?: (item: InventoryItem) => void;
}> = ({ item, onUpdateStock, onEditItem }) => {
    // Get packaging levels (with fallback for legacy items)
    const { levels, countLevel: defaultCountLevel } = useMemo(() => getPackagingLevels(item), [item]);
    const hasMultipleLevels = levels.length > 1;

    // State
    const [localStock, setLocalStock] = useState(item.current_stock); // always in base units
    const [activeLevel, setActiveLevel] = useState(hasMultipleLevels ? Math.max(1, defaultCountLevel) : defaultCountLevel);
    const [isDirty, setIsDirty] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [lastCountedDate, setLastCountedDate] = useState(item.last_counted_at);

    // Derived values using pure functions
    const displayQty = convertFromBase(localStock, activeLevel, levels);
    const displayQtyFormatted = displayQty % 1 === 0 ? displayQty : Number(displayQty.toFixed(2));
    const baseQtyFormatted = localStock % 1 === 0 ? localStock : Number(localStock.toFixed(0));

    // Low stock check — threshold is stored in count-level units, convert to base for comparison
    const thresholdBase = (parseFloat(item.low_stock_threshold_units as any) || 0) * (levels[defaultCountLevel]?.qty || 1);
    const isLowStock = thresholdBase > 0 && localStock <= thresholdBase;

    // Count step (how many base units per +/- click at current level)
    const countStep = Number(levels[activeLevel]?.count_step) || Number(item.inventory_count_step) || 1;
    const stepInBase = convertToBase(countStep, activeLevel, levels);

    const handleIncrement = () => {
        setLocalStock(prev => prev + stepInBase);
        setIsDirty(true);
    };

    const handleDecrement = () => {
        setLocalStock(prev => Math.max(0, prev - stepInBase));
        setIsDirty(true);
    };

    const handleLevelChange = (newLevel: number) => {
        setActiveLevel(newLevel);
        // No stock change — just visual conversion
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
            className={`group relative grid grid-cols-[1fr_auto] items-center gap-3 md:gap-4 py-3 px-3 md:px-4 rounded-2xl border transition-all duration-200 bg-white shadow-sm min-h-[82px] ${isLowStock ? 'ring-1 ring-amber-200 border-amber-200' : 'border-slate-100 hover:border-slate-200'}`}
        >
            {/* RIGHT SIDE: Name & Info */}
            <div className="flex flex-col justify-center text-right overflow-hidden min-w-0 flex-1">
                <div className="flex items-center gap-2 justify-start">
                    {isDirty && <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse shrink-0" />}
                    <h4
                        onClick={() => onEditItem && onEditItem(item)}
                        className="font-extrabold text-slate-800 text-[15.5px] leading-tight text-right w-full line-clamp-2 hover:text-indigo-600 hover:underline cursor-pointer transition"
                        title={item.name}
                    >
                        {item.name}
                    </h4>
                    {isLowStock && <AlertTriangle size={16} className="text-amber-500 shrink-0" />}
                </div>
                {/* Base unit helper line — show when viewing at a higher level */}
                {hasMultipleLevels && activeLevel > 0 && isDirty && (
                    <div className="text-[10px] text-slate-400 font-bold mt-0.5">
                        = {baseQtyFormatted.toLocaleString()} {levels[0].name}
                    </div>
                )}
                {lastCountedDate && !isDirty && (
                    <div className="text-[10px] text-slate-400 font-bold mt-1">
                        נספר: {new Date(lastCountedDate).toLocaleDateString('he-IL')}
                    </div>
                )}
            </div>

            {/* LEFT SIDE: Counter + Actions */}
            <div className="flex items-center gap-2 md:gap-2.5 shrink-0">
                {/* Counter Group */}
                <div className="flex items-center bg-slate-50/80 p-0.5 rounded-xl border border-slate-100 h-11 shrink-0">
                    <button
                        onClick={handleDecrement}
                        className="w-9 h-9 md:w-8 md:h-8 flex items-center justify-center bg-white rounded-lg shadow-sm text-slate-400 hover:text-rose-500 active:scale-90 transition"
                    >
                        <Minus size={14} />
                    </button>
                    <div className="w-16 md:w-14 text-center flex flex-col justify-center leading-none">
                        <span className={`text-[15px] font-black ${isDirty ? 'text-indigo-600' : 'text-slate-800'} tabular-nums`}>
                            {displayQtyFormatted}
                        </span>
                        {/* Dynamic level-switching select or static label */}
                        {hasMultipleLevels ? (
                            <select
                                value={activeLevel}
                                onChange={(e) => handleLevelChange(Number(e.target.value))}
                                className="text-[9px] text-slate-400 font-bold bg-transparent border-none outline-none cursor-pointer text-center appearance-none px-0 py-0 w-full"
                                style={{ WebkitAppearance: 'none', textAlignLast: 'center' }}
                            >
                                {levels.map((level, idx) => (
                                    idx > 0 ? <option key={idx} value={idx}>{level.name}</option> : null
                                ))}
                            </select>
                        ) : (
                            <span className="text-[9px] text-slate-400 font-bold uppercase">{levels[0]?.name || item?.unit || 'יח\''}</span>
                        )}
                    </div>
                    <button
                        onClick={handleIncrement}
                        className="w-9 h-9 md:w-8 md:h-8 flex items-center justify-center bg-white rounded-lg shadow-sm text-slate-400 hover:text-emerald-500 active:scale-90 transition"
                    >
                        <Plus size={14} />
                    </button>
                </div>

                {/* Save Button */}
                <button
                    onClick={handleSave}
                    disabled={!isDirty || isSaving}
                    className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all shadow-sm active:scale-95 shrink-0
                        ${isDirty ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-500 hover:text-white' : 'bg-slate-50 text-slate-200 cursor-not-allowed'}`}
                >
                    {isSaving ? (
                        <div className="w-5 h-5 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                    ) : (
                        <Check size={22} strokeWidth={2.5} />
                    )}
                </button>
            </div>
        </MotionDiv>
    );
};

export default InventoryItemsGrid;
