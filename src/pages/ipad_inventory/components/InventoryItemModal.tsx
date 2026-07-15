import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Minus, Trash2, Save, Pencil, Check, ChevronDown } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { InventoryItem, Supplier, PackagingLevel } from '@/pages/ipad_inventory/types';
import { sanitizeNumeric } from '@/pages/ipad_inventory/utils/packagingUtils';

const MotionDiv = motion.div as any;

const SelectWrapper: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
    <div className={`relative ${className || ''}`}>
        {children}
        <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
            <ChevronDown size={16} />
        </div>
    </div>
);

// ─── Types ───────────────────────────────────────────────────────────────────

interface InventoryItemModalProps {
    isOpen: boolean;
    item: InventoryItem | null;
    initialData?: {
        invoiceName?: string;
        supplierId?: string;
        unit?: string;
        price?: number;
    };
    suppliers: Supplier[];
    categories: string[];
    businessId: string;
    onClose: () => void;
    onSaved: () => void;
}

interface FormData {
    name: string;
    supplier_product_name: string[];
    manufacturer_name: string;
    supplier_id: string;
    category: string;
    unit: string;
    weight_per_unit: number | '';
    packaging_levels: PackagingLevel[];
    packaging_countLevel: number;
    count_step: number;
    recipe_step: number;
    cost_per_unit: number | '';
    low_stock_threshold_units: number | '';
    yield_percentage: number | '';
    location: string;
    min_order: number | '';
    order_step: number | '';
}

const UNITS = ['יח׳', 'גרם', 'ק"ג', 'מ"ל', 'מארז', 'שקית', 'חבילה', 'L'];
const PACKAGING_TYPES = ['קרטון', 'שרוול', 'שקית', 'קופסה', 'חבילה', 'מארז', 'מגש', 'דלי', 'צנצנת', 'פאלט'];
const CATEGORIES = ['ירקות', 'פירות', 'מוצרי חלב', 'יבשים', 'תבלינים', 'שימורים', 'חד פעמי', 'ממרחים', 'כללי', 'coffee'];
const PRODUCE_CATEGORIES = ['ירקות', 'פירות'];
const COUNT_STEPS = [{ label: '1', value: 1 }, { label: '½', value: 0.5 }, { label: '¼', value: 0.25 }];

// ─── Price helpers ───────────────────────────────────────────────────────────
// cost_per_unit in DB = cost per ONE of the stated unit (per kg, per unit, etc.)
// Package price = cost_per_unit × base_qty

const isWeightUnit = (u: string) => ['גרם', 'ק"ג', 'מ"ל', 'L', 'grams'].includes(u);
const isLiquidUnit = (u: string) => ['מ"ל', 'L'].includes(u);

const getUnitInputLabel = (u: string) => {
    if (u === 'ק"ג') return 'ק"ג';
    if (u === 'גרם' || u === 'grams') return 'גרם';
    if (u === 'L') return 'ליטר';
    if (u === 'מ"ל') return 'מ"ל';
    return 'יח׳';
};

// ─── Component ───────────────────────────────────────────────────────────────

const InventoryItemModal: React.FC<InventoryItemModalProps> = ({
    isOpen, item, initialData, suppliers, categories: existingCategories, businessId, onClose, onSaved
}) => {
    const isEditMode = !!item;
    const allCategories = useMemo(() => {
        const set = new Set([...CATEGORIES, ...existingCategories]);
        return Array.from(set).sort();
    }, [existingCategories]);

    // ─── Form State ──────────────────────────────────────────────────────────
    const buildInitialFormData = (): FormData => {
        if (item) {
            const levels: PackagingLevel[] = item.packaging?.levels?.length
                ? item.packaging.levels
                : [{ name: item.unit || item.base_unit || 'יח׳', qty: 1 }];
            const currentUnit = item.unit || item.base_unit || 'יח׳';
            const defaultRecipeStep = isWeightUnit(currentUnit) ? 10 : 1;
            return {
                name: item.name || '',
                supplier_product_name: item.supplier_product_name || [],
                manufacturer_name: item.manufacturer_name || '',
                supplier_id: item.supplier_id ? String(item.supplier_id) : '',
                category: item.category || '',
                unit: currentUnit,
                weight_per_unit: item.weight_per_unit || '',
                packaging_levels: levels,
                packaging_countLevel: item.packaging?.countLevel ?? 0,
                count_step: item.count_step ?? 1,
                recipe_step: item.recipe_step ?? defaultRecipeStep,
                cost_per_unit: item.cost_per_unit || '',
                low_stock_threshold_units: item.low_stock_threshold_units || '',
                yield_percentage: item.yield_percentage ?? 100,
                location: item.location || '',
                min_order: item.min_order || '',
                order_step: item.order_step || '',
            };
        }
        const initialUnit = initialData?.unit || 'יח׳';
        const defaultRecipeStep = isWeightUnit(initialUnit) ? 10 : 1;
        return {
            name: '',
            supplier_product_name: initialData?.invoiceName ? [initialData.invoiceName] : [],
            manufacturer_name: '',
            supplier_id: initialData?.supplierId || '',
            category: '',
            unit: initialUnit,
            weight_per_unit: '',
            packaging_levels: [{ name: initialUnit, qty: 1 }],
            packaging_countLevel: 0,
            count_step: 1,
            recipe_step: defaultRecipeStep,
            cost_per_unit: initialData?.price || '',
            low_stock_threshold_units: '',
            yield_percentage: 100,
            location: '',
            min_order: '',
            order_step: '',
        };
    };

    const [formData, setFormData] = useState<FormData>(buildInitialFormData);
    const [isCreatingSupplier, setIsCreatingSupplier] = useState(false);
    const [newSupplierName, setNewSupplierName] = useState('');
    const [newTagInput, setNewTagInput] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [customCategory, setCustomCategory] = useState('');
    const [showCustomCategory, setShowCustomCategory] = useState(false);

    // ─── Tab state (separate from formData to avoid re-renders during price editing) ──
    const [activeTab, setActiveTab] = useState<'details' | 'advanced'>('details');

    // ─── Price editing state ─────────────────────────────────────────────────
    const [isPriceEditing, setIsPriceEditing] = useState(false);
    const [editPkgPrice, setEditPkgPrice] = useState<number | ''>('');
    const [editPkgQty, setEditPkgQty] = useState<number | ''>('');
    const [priceViewMode, setPriceViewMode] = useState<'kg' | 'package' | 'gram' | 'unit'>('kg');
    const [advPillLevel, setAdvPillLevel] = useState<number>(0);

    useEffect(() => {
        if (isOpen) {
            const initialForm = buildInitialFormData();
            setFormData(initialForm);
            setIsCreatingSupplier(false);
            setNewSupplierName('');
            setNewTagInput('');
            setIsSaving(false);
            setCustomCategory('');
            setShowCustomCategory(false);
            setActiveTab('details');
            setIsPriceEditing(false);
            // Default advanced order level
            const levels = initialForm.packaging_levels;
            setAdvPillLevel(levels.length > 1 ? levels.length - 1 : 0);
            // Default view mode
            const unit = initialForm.unit;
            setPriceViewMode(isWeightUnit(unit) ? 'kg' : 'unit');
        }
    }, [isOpen, item?.id]);

    const updateField = (field: keyof FormData, value: any) =>
        setFormData(prev => ({ ...prev, [field]: value }));

    // ─── Produce detection ───────────────────────────────────────────────────
    const resolvedCategory = showCustomCategory ? customCategory.trim() : formData.category;
    const isProduceItem = PRODUCE_CATEGORIES.includes(resolvedCategory);

    // When category changes to produce, enforce: unit=kg, reset packaging
    const handleCategoryChange = (cat: string) => {
        if (cat === '__custom__') {
            setShowCustomCategory(true);
            return;
        }
        const isProduce = PRODUCE_CATEGORIES.includes(cat);
        if (isProduce) {
            setFormData(prev => ({
                ...prev,
                category: cat,
                unit: 'ק"ג',
                packaging_levels: [{ name: 'ק"ג', qty: 1 }],
                packaging_countLevel: 0,
                weight_per_unit: prev.weight_per_unit || '',
            }));
            setPriceViewMode('kg');
        } else {
            updateField('category', cat);
        }
    };

    // ─── Price editing ───────────────────────────────────────────────────────

    const openPriceEdit = () => {
        const cpu = Number(formData.cost_per_unit) || 0;
        const levels = formData.packaging_levels;
        // Main package = highest level (last), or base if only one level
        const mainLevel = levels[levels.length - 1];
        const mainQty = mainLevel?.qty || 1;
        const pkgTotal = cpu * mainQty;
        setEditPkgPrice(pkgTotal > 0 ? pkgTotal : '');
        setEditPkgQty(cpu > 0 ? mainQty : '');
        setIsPriceEditing(true);
    };

    const confirmPriceEdit = () => {
        const price = Number(editPkgPrice) || 0;
        const qty = Number(editPkgQty) || 1;
        if (qty <= 0) return;
        const newCostPerUnit = price / qty;
        const roundedQty = Math.max(1, Math.round(qty));

        // Update cost_per_unit + the highest packaging level's qty
        setFormData(prev => {
            const lastIdx = prev.packaging_levels.length - 1;
            const newLevels = prev.packaging_levels.map((lvl, i) =>
                i === lastIdx ? { ...lvl, qty: roundedQty } : lvl
            );
            return {
                ...prev,
                cost_per_unit: newCostPerUnit,
                packaging_levels: newLevels,
            };
        });
        setIsPriceEditing(false);
    };

    // Packaging summary for closed state
    const packagingSummary = (() => {
        const levels = formData.packaging_levels;
        if (levels.length <= 1 && levels[0]?.qty <= 1) return '';
        const cpu = Number(formData.cost_per_unit) || 0;
        return levels.slice(1).map(l => {
            const price = cpu * l.qty;
            return `${l.name} (${l.qty}) ₪${price.toFixed(2)}`;
        }).join(' • ');
    })();

    // ─── Price display computation ───────────────────────────────────────────

    const computePriceDisplay = () => {
        const cpu = Number(formData.cost_per_unit) || 0;
        const baseQty = formData.packaging_levels[0]?.qty || 1;
        const wpu = Number(formData.weight_per_unit) || 0;
        const unit = formData.unit;
        const isWeight = isWeightUnit(unit);
        const isLiquid = isLiquidUnit(unit);
        const pkgPrice = cpu * baseQty;

        switch (priceViewMode) {
            case 'kg':
                if (isWeight) {
                    // cpu is per stated unit (per kg / per gram / per L / per ml)
                    if (unit === 'ק"ג' || unit === 'grams') return { price: unit === 'ק"ג' ? cpu : cpu * 1000, label: 'לק"ג' };
                    if (unit === 'גרם') return { price: cpu * 1000, label: 'לק"ג' };
                    if (unit === 'L') return { price: cpu, label: 'לליטר' };
                    if (unit === 'מ"ל') return { price: cpu * 1000, label: 'לליטר' };
                }
                // Unit item with weight_per_unit → calculate per kg
                if (wpu > 0 && cpu > 0) return { price: (cpu / wpu) * 1000, label: 'לק"ג' };
                return { price: cpu, label: `ל${unit}` };

            case 'package': {
                const pkgLabel = (() => {
                    if (baseQty <= 1) return `ל${unit}`;
                    if ((unit === 'גרם' || unit === 'grams') && baseQty >= 1000)
                        return `לאריזה (${(baseQty / 1000).toFixed(2)} ק"ג)`;
                    if (unit === 'מ"ל' && baseQty >= 1000)
                        return `לאריזה (${(baseQty / 1000).toFixed(2)} ליטר)`;
                    return `לאריזה (${baseQty} ${unit})`;
                })();
                return { price: pkgPrice, label: pkgLabel };
            }

            case 'gram':
                if (unit === 'ק"ג') return { price: cpu / 1000, label: 'לגרם' };
                if (unit === 'גרם' || unit === 'grams') return { price: cpu, label: 'לגרם' };
                if (unit === 'L') return { price: cpu / 1000, label: 'למ"ל' };
                if (unit === 'מ"ל') return { price: cpu, label: 'למ"ל' };
                return { price: cpu, label: 'לגרם' };

            case 'unit':
                return { price: cpu, label: `ל${unit}` };

            default:
                return { price: cpu, label: `ל${unit}` };
        }
    };

    const getAvailableViewModes = () => {
        const unit = formData.unit;
        const isWeight = isWeightUnit(unit);
        const isLiquid = isLiquidUnit(unit);
        const cat = (formData.category || '').trim();
        const isProduceCategory = ['ירקות', 'פירות'].includes(cat);
        const wpu = Number(formData.weight_per_unit) || 0;
        const cpuLocal = Number(formData.cost_per_unit) || 0;

        const modes: { key: string; label: string; price: number; subLabel?: string }[] = [];
        const levels = formData.packaging_levels;

        if (isWeight) {
            modes.push({ key: 'kg', label: isLiquid ? 'ליטר' : 'ק"ג', price: unit === 'ק"ג' ? cpuLocal : cpuLocal * 1000 });
            // Add all packaging level pills (largest first)
            for (let i = levels.length - 1; i >= 1; i--) {
                const l = levels[i];
                if (l.name) modes.push({ key: `pkg_${i}`, label: l.name, price: cpuLocal * l.qty, subLabel: `${l.qty} ${levels[0].name}` });
            }
            modes.push({ key: 'gram', label: isLiquid ? 'מ"ל' : 'גרם', price: unit === 'ק"ג' ? cpuLocal / 1000 : cpuLocal });
        } else if (isProduceCategory && wpu > 0) {
            modes.push({ key: 'kg', label: 'ק"ג', price: cpuLocal });
            modes.push({ key: 'unit', label: `${unit}`, price: cpuLocal * (wpu / 1000) });
        } else {
            // Dry goods / unit items — show all packaging levels as pills (largest first → unit)
            for (let i = levels.length - 1; i >= 1; i--) {
                const l = levels[i];
                if (l.name) modes.push({ key: `pkg_${i}`, label: l.name, price: cpuLocal * l.qty, subLabel: `${l.qty} ${levels[0].name}` });
            }
            modes.push({ key: 'unit', label: `${unit}`, price: cpuLocal });
        }

        return modes;
    };

    // ─── Packaging ───────────────────────────────────────────────────────────

    const addPackagingLevel = () => {
        if (formData.packaging_levels.length >= 3) return;
        const newLevels = [...formData.packaging_levels, { name: '', qty: 0 }];
        setFormData(prev => ({ ...prev, packaging_levels: newLevels, packaging_countLevel: newLevels.length - 1 }));
    };

    const removePackagingLevel = (index: number) => {
        if (index === 0) return;
        const newLevels = formData.packaging_levels.filter((_, i) => i !== index);
        setFormData(prev => ({ ...prev, packaging_levels: newLevels, packaging_countLevel: Math.min(prev.packaging_countLevel, newLevels.length - 1) }));
    };

    const updatePackagingLevel = (index: number, field: 'name' | 'qty', value: any) => {
        const newLevels = [...formData.packaging_levels];
        newLevels[index] = { ...newLevels[index], [field]: field === 'qty' ? (parseInt(value) || 0) : value };
        updateField('packaging_levels', newLevels);
    };

    const handleUnitChange = (newUnit: string) => {
        const isWeight = isWeightUnit(newUnit);
        const defaultRecipeStep = isWeight ? 10 : 1;
        const newLevels = [...formData.packaging_levels];
        newLevels[0] = { ...newLevels[0], name: newUnit };
        setFormData(prev => ({
            ...prev,
            unit: newUnit,
            packaging_levels: newLevels,
            recipe_step: defaultRecipeStep
        }));
        // Reset view mode on unit change
        setPriceViewMode(isWeight ? 'kg' : 'unit');
    };

    // ─── Tags ────────────────────────────────────────────────────────────────

    const addTag = () => {
        const tag = newTagInput.trim();
        if (!tag || formData.supplier_product_name.includes(tag)) return;
        updateField('supplier_product_name', [...formData.supplier_product_name, tag]);
        setNewTagInput('');
    };

    const removeTag = (index: number) => {
        updateField('supplier_product_name', formData.supplier_product_name.filter((_, i) => i !== index));
    };

    // ─── Create Supplier ─────────────────────────────────────────────────────

    const handleCreateSupplier = async () => {
        if (!newSupplierName.trim()) return;
        const { data, error } = await supabase
            .from('suppliers')
            .insert({ name: newSupplierName.trim(), business_id: businessId })
            .select('id')
            .single();
        if (error) { alert('שגיאה ביצירת ספק: ' + error.message); return; }
        if (data) {
            updateField('supplier_id', String(data.id));
            setIsCreatingSupplier(false);
            setNewSupplierName('');
        }
    };

    // ─── Validation ──────────────────────────────────────────────────────────

    const validatePackaging = (): string | null => {
        const levels = formData.packaging_levels;
        if (!Number.isInteger(levels[0].qty) || levels[0].qty <= 0) return 'רמת בסיס: הכמות חייבת להיות מספר שלם וחיובי';
        for (let i = 1; i < levels.length; i++) {
            if (!levels[i].name.trim()) return `רמה ${i + 1}: יש להזין שם`;
            if (!Number.isInteger(levels[i].qty) || levels[i].qty <= 0) return `רמה ${i + 1}: הכמות חייבת להיות מספר שלם וחיובי`;
        }
        return null;
    };

    // ─── Save ────────────────────────────────────────────────────────────────

    const handleSave = async () => {
        if (!formData.name.trim()) { alert('יש להזין שם פריט'); return; }

        // Produce validation: weight_per_unit must be >= 1
        if (isProduceItem) {
            const wpu = Number(formData.weight_per_unit) || 0;
            if (wpu < 1) {
                alert('ירקות/פירות: יש להזין משקל ממוצע ליחידה (לפחות 1 גרם)');
                return;
            }
        }

        if (!isProduceItem) {
            const packagingError = validatePackaging();
            if (packagingError) { alert(packagingError); return; }
        }

        console.log('💾 [InventoryModal] Starting save...');

        setIsSaving(true);
        try {
            const levels = isProduceItem
                ? [{ name: 'ק"ג', qty: 1 }]
                : formData.packaging_levels;
            const packaging = isProduceItem
                ? null
                : (levels.length > 1
                    ? { levels, countLevel: formData.packaging_countLevel }
                    : (levels[0].qty !== 1 ? { levels, countLevel: 0 } : null));

            const case_quantity = levels.length >= 2 ? levels[1].qty : levels[0].qty;
            const category = showCustomCategory ? customCategory.trim() : formData.category;

            // For produce: unit is always kg, weight_per_unit stored as grams (user input)
            const payload: any = {
                name: formData.name.trim(),
                supplier_id: sanitizeNumeric(formData.supplier_id, null),
                category: category || 'כללי',
                unit: isProduceItem ? 'ק"ג' : formData.unit,
                weight_per_unit: sanitizeNumeric(formData.weight_per_unit),
                case_quantity,
                packaging,
                count_step: sanitizeNumeric(formData.count_step, 1),
                recipe_step: sanitizeNumeric(formData.recipe_step, 10),
                cost_per_unit: sanitizeNumeric(formData.cost_per_unit),
                low_stock_threshold_units: sanitizeNumeric(formData.low_stock_threshold_units),
                yield_percentage: sanitizeNumeric(formData.yield_percentage, 100),
                location: formData.location || null,
                min_order: sanitizeNumeric(formData.min_order, 1),
                order_step: sanitizeNumeric(formData.order_step, 1),
                manufacturer_name: formData.manufacturer_name || null,
                supplier_product_name: formData.supplier_product_name.filter(Boolean),
                business_id: businessId,
            };

            if (isEditMode && item) {
                const { error } = await supabase.from('inventory_items').update(payload).eq('id', item.id);
                if (error) throw error;
            } else {
                payload.current_stock = 0;
                const { error } = await supabase.from('inventory_items').insert(payload);
                if (error) throw error;
            }

            console.log('✅ [InventoryModal] Save successful');
            onSaved();
            onClose();
        } catch (err: any) {
            console.error('❌ [InventoryModal] Save error:', err);
            alert('שגיאה בשמירה: ' + (err?.message || 'שגיאה לא ידועה'));
        } finally {
            setIsSaving(false);
        }
    };

    // ─── Delete ──────────────────────────────────────────────────────────────

    const handleDelete = async () => {
        if (!item) return;
        if (!window.confirm(`האם למחוק את "${item.name}" מהמלאי? פעולה זו בלתי הפיכה.`)) return;
        try {
            const { error } = await supabase.from('inventory_items').delete().eq('id', item.id);
            if (error) throw error;
            onSaved();
            onClose();
        } catch (err: any) {
            alert('שגיאה במחיקה: ' + err.message);
        }
    };

    if (!isOpen) return null;

    // ─── Computed helpers ────────────────────────────────────────────────────

    // weight_per_unit only relevant for produce (handled by dedicated field above)
    const unitNeedsWeight = false;
    const { price: displayPrice, label: displayLabel } = computePriceDisplay();
    const viewModes = getAvailableViewModes();

    // Helper hints
    const yieldNum = Number(formData.yield_percentage) || 100;
    const yieldHint = yieldNum < 100
        ? `${100 - yieldNum}% פחת — מ-1 ק"ג תשתמש ב-${yieldNum * 10} גרם`
        : 'ללא פחת — 100% מהמוצר בשימוש';
    const isWeight = isWeightUnit(formData.unit);
    const recipeSteps = isWeight
        ? [{ label: '1 גרם', value: 1 }, { label: '5 גרם', value: 5 }, { label: '10 גרם', value: 10 }]
        : [{ label: `1 ${formData.unit}`, value: 1 }, { label: `0.5 ${formData.unit}`, value: 0.5 }, { label: `0.25 ${formData.unit}`, value: 0.25 }];
    const countStepHint = `ספירה תעלה/תרד ב-${formData.count_step === 0.5 ? 'חצי' : formData.count_step === 0.25 ? 'רבע' : '1'} יחידה`;
    const recipeStepHint = isWeight
        ? `מתכונים יחשבו בקפיצות של ${formData.recipe_step} גרם`
        : `מתכונים יחשבו בקפיצות של ${formData.recipe_step} ${formData.unit}`;
    const thresholdNum = Number(formData.low_stock_threshold_units) || 0;
    const thresholdHint = thresholdNum > 0 ? `תקבל התראה כשהמלאי יורד מתחת ל-${thresholdNum}` : 'לא תוגדר התראת מלאי נמוך';

    // Produce weight hint
    const wpuNum = Number(formData.weight_per_unit) || 0;
    const wpuHint = (() => {
        if (!isProduceItem) return '';
        if (wpuNum <= 0) return 'חובה — ללא משקל לא ניתן לחשב מחיר ליחידה';
        const cpu = Number(formData.cost_per_unit) || 0;
        const pricePerUnit = cpu * (wpuNum / 1000);
        if (cpu > 0) return `כ-${(1000 / wpuNum).toFixed(1)} יחידות בק"ג • ₪${pricePerUnit.toFixed(2)} ליחידה`;
        return `כ-${(1000 / wpuNum).toFixed(1)} יחידות בק"ג`;
    })();

    // Package price hint (always shown under price display)
    const mainPkgLevel = formData.packaging_levels[formData.packaging_levels.length - 1];
    const mainPkgQty = mainPkgLevel?.qty || 1;
    const cpu = Number(formData.cost_per_unit) || 0;
    const pkgPrice = cpu * mainPkgQty;
    const mainPkgName = mainPkgLevel?.name || '';
    const formatQtyLabel = (qty: number, unit: string) => {
        if ((unit === 'גרם' || unit === 'grams') && qty >= 1000)
            return `${(qty / 1000).toFixed(2)} ק"ג`;
        if (unit === 'מ"ל' && qty >= 1000)
            return `${(qty / 1000).toFixed(2)} ליטר`;
        return `${qty} ${unit}`;
    };
    const priceHint = (() => {
        if (!cpu) return '';
        if (mainPkgQty > 1 && mainPkgName) return `₪${pkgPrice.toFixed(2)} ל${mainPkgName} (${formatQtyLabel(mainPkgQty, formData.unit)})`;
        if (mainPkgQty > 1) return `₪${pkgPrice.toFixed(2)} לאריזה של ${formatQtyLabel(mainPkgQty, formData.unit)}`;
        return '';
    })();
    // ─── Render helpers ──────────────────────────────────────────────────────

    const renderPricePills = () => {
        if (cpu <= 0) return null;
        return (
            <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                {viewModes.length > 0 && viewModes.map(m => (
                    <button
                        key={m.key}
                        onClick={() => setPriceViewMode(m.key as any)}
                        className={`flex flex-col items-center px-3 py-1 rounded-xl transition min-w-0 ${priceViewMode === m.key ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                        <span className="text-xs font-bold leading-tight">{m.label}</span>
                        {priceViewMode === m.key && m.subLabel && (
                            <span className="text-[9px] font-medium opacity-90 leading-tight">{m.subLabel}</span>
                        )}
                    </button>
                ))}
                <span className="text-lg md:text-xl font-black text-emerald-700 leading-none mr-2">
                    ₪{(viewModes.find(m => m.key === priceViewMode)?.price ?? cpu).toFixed(2)}
                </span>
                <button onClick={openPriceEdit} className="w-8 h-8 rounded-xl flex items-center justify-center bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition border border-emerald-200 shrink-0">
                    <Pencil size={13} />
                </button>
            </div>
        );
    };

    // ─── Advanced tab calculations ───────────────────────────────────────────
    const levels = formData.packaging_levels;
    const currentLvl = levels[advPillLevel] || levels[0] || { name: 'יח׳', qty: 1 };
    const maxLvl = levels[levels.length - 1] || levels[0] || { name: 'יח׳', qty: 1 };
    
    // 1. Low stock threshold
    const countLvlIdx = formData.packaging_countLevel || 0;
    const countLvlQty = levels[countLvlIdx]?.qty || 1;
    const rawThreshold = Number(formData.low_stock_threshold_units) || 0;
    const thresholdInBase = rawThreshold * countLvlQty;
    const displayedThreshold = thresholdInBase / currentLvl.qty;
    const handleThresholdChange = (val: number) => {
        const baseVal = val * currentLvl.qty;
        updateField('low_stock_threshold_units', baseVal / countLvlQty);
    };

    // 2. Min Order
    const rawMinOrder = Number(formData.min_order) || 0;
    const displayedMinOrder = rawMinOrder / maxLvl.qty;
    const handleMinOrderChange = (val: number) => {
        updateField('min_order', val * maxLvl.qty);
    };

    // 3. Order Step
    const rawOrderStep = Number(formData.order_step) || 0;
    const displayedOrderStep = rawOrderStep / maxLvl.qty;
    const handleOrderStepChange = (val: number) => {
        updateField('order_step', val * maxLvl.qty);
    };

    // ─── Render ──────────────────────────────────────────────────────────────

    return (
        <AnimatePresence>
            {isOpen && (
                <MotionDiv
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[200] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center"
                    onClick={onClose}
                >
                    <MotionDiv
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}
                        className="w-full h-full md:w-full md:max-w-2xl md:h-auto md:max-h-[90vh] bg-slate-50 md:rounded-3xl md:shadow-2xl flex flex-col overflow-hidden"
                        dir="rtl"
                    >
                        {/* ─── Sticky Header ───────────────────────────── */}
                        <div className="sticky top-0 z-10 bg-white border-b border-slate-100 shadow-sm shrink-0 px-4 md:px-5 pt-3 md:pt-4 pb-3">
                            {/* Row 1: Name + Price/Pills (desktop) + Close */}
                            <div className="flex items-center gap-2 mb-1">
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={e => updateField('name', e.target.value)}
                                    placeholder={isEditMode ? 'שם הפריט' : 'שם הפריט החדש *'}
                                    className="flex-1 text-lg md:text-xl font-black text-slate-900 bg-transparent border-none outline-none placeholder:text-slate-300 min-w-0"
                                    autoFocus={!isEditMode}
                                />
                                {/* Price pills on desktop (md and up) */}
                                <div className="hidden md:block">
                                    {renderPricePills()}
                                </div>
                                <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 transition text-slate-400 shrink-0">
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Row 2: Price pills on mobile (below md) */}
                            {!isPriceEditing && cpu > 0 && (
                                <div className="block md:hidden mb-3.5 mt-0">
                                    {renderPricePills()}
                                </div>
                            )}

                            {/* Inline price + packaging editor (slides in below name row) */}
                            {isPriceEditing && (
                                <div className="mb-2 bg-emerald-50 border border-emerald-200 rounded-xl p-3 space-y-3">
                                    {/* Primary Package */}
                                    <div>
                                        <span className="text-xs font-black text-emerald-700 block mb-2">אריזה ראשית</span>
                                        <div className="grid grid-cols-3 gap-2">
                                            <div>
                                                <label className="block text-[10px] font-bold text-emerald-600 mb-1">סוג</label>
                                                <SelectWrapper>
                                                    <select
                                                        value={formData.packaging_levels.length > 1 ? (formData.packaging_levels[formData.packaging_levels.length - 1]?.name || '') : ''}
                                                        onChange={e => {
                                                            const val = e.target.value;
                                                            if (formData.packaging_levels.length <= 1) {
                                                                // Add a new level at the end
                                                                const newLevels = [...formData.packaging_levels, { name: val, qty: Number(editPkgQty) || 0 }];
                                                                updateField('packaging_levels', newLevels);
                                                            } else {
                                                                updatePackagingLevel(formData.packaging_levels.length - 1, 'name', val);
                                                            }
                                                        }}
                                                        className="w-full h-10 bg-white border border-emerald-200 rounded-lg pr-2 pl-8 text-sm font-bold text-slate-700 focus:outline-none focus:border-emerald-400 appearance-none"
                                                    >
                                                        <option value="">בחר...</option>
                                                        {PACKAGING_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                                    </select>
                                                </SelectWrapper>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-emerald-600 mb-1">מחיר ₪</label>
                                                <div className="relative">
                                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-emerald-500 font-black text-sm">₪</span>
                                                    <input
                                                        type="number" inputMode="decimal"
                                                        value={editPkgPrice}
                                                        onChange={e => setEditPkgPrice(e.target.value === '' ? '' : Number(e.target.value))}
                                                        placeholder="0" autoFocus
                                                        className="w-full h-10 bg-white border border-emerald-200 rounded-lg pr-7 pl-2 text-base font-black text-emerald-700 [appearance:textfield] focus:outline-none focus:border-emerald-400"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-emerald-600 mb-1">כמות ({getUnitInputLabel(formData.unit)})</label>
                                                <input
                                                    type="number" inputMode="numeric"
                                                    value={editPkgQty}
                                                    onChange={e => setEditPkgQty(e.target.value === '' ? '' : Number(e.target.value))}
                                                    placeholder=""
                                                    className="w-full h-10 bg-white border border-emerald-200 rounded-lg px-2 text-base font-black text-slate-700 [appearance:textfield] focus:outline-none focus:border-emerald-400"
                                                />
                                            </div>
                                        </div>
                                        {Number(editPkgPrice) > 0 && Number(editPkgQty) > 0 && (
                                            <p className="text-xs text-emerald-600 font-medium mt-1">
                                                = ₪{(Number(editPkgPrice) / Number(editPkgQty)).toFixed(2)} ל{getUnitInputLabel(formData.unit)}
                                                {isWeightUnit(formData.unit) && formData.unit === 'ק"ג' && ` (${((Number(editPkgPrice) / Number(editPkgQty)) / 1000 * 100).toFixed(1)} אג׳ לגרם)`}
                                            </p>
                                        )}
                                    </div>

                                    {/* Sub-packages section */}
                                    {!isProduceItem && (
                                        <div className="border-t border-emerald-200 pt-3">
                                            <span className="text-xs font-black text-teal-700 block mb-2">תת-אריזות</span>
                                            {formData.packaging_levels.slice(1, -1).map((level, idx) => {
                                                const realIdx = idx + 1;
                                                const cpu = Number(formData.cost_per_unit) || (Number(editPkgPrice) / (Number(editPkgQty) || 1));
                                                const subPrice = cpu * level.qty;
                                                return (
                                                    <div key={realIdx} className="grid grid-cols-3 gap-2 mb-2 items-center">
                                                        <SelectWrapper>
                                                            <select value={level.name} onChange={e => updatePackagingLevel(realIdx, 'name', e.target.value)} className="w-full h-10 bg-white border border-teal-200 rounded-lg pr-2 pl-8 text-sm font-bold text-slate-700 focus:outline-none focus:border-teal-400 appearance-none">
                                                                <option value="">בחר...</option>
                                                                {PACKAGING_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                                            </select>
                                                        </SelectWrapper>
                                                        <div className="flex items-center gap-1">
                                                            <input type="number" inputMode="numeric" value={level.qty || ''} onChange={e => updatePackagingLevel(realIdx, 'qty', e.target.value)} placeholder="כמות" className="w-full h-10 bg-white border border-teal-200 rounded-lg px-2 text-sm font-bold text-slate-700 [appearance:textfield] focus:outline-none focus:border-teal-400" />
                                                            <span className="text-[10px] text-slate-400 shrink-0">{formData.packaging_levels[0]?.name}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            {level.qty > 0 && cpu > 0 && <span className="text-xs font-bold text-emerald-600">₪{subPrice.toFixed(2)}</span>}
                                                            <button onClick={() => removePackagingLevel(realIdx)} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 mr-auto shrink-0"><X size={14} /></button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            {formData.packaging_levels.length < 4 && (
                                                <button onClick={() => {
                                                    // Insert before the last level (primary package)
                                                    const newLevels = [...formData.packaging_levels];
                                                    const insertIdx = Math.max(1, newLevels.length - 1);
                                                    newLevels.splice(insertIdx, 0, { name: '', qty: 0 });
                                                    updateField('packaging_levels', newLevels);
                                                }} className="w-full h-8 flex items-center justify-center gap-1.5 text-teal-600 font-bold text-xs bg-teal-50 hover:bg-teal-100 rounded-lg border border-dashed border-teal-200 transition">
                                                    <Plus size={14} /> הוסף תת-אריזה
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    <div className="flex gap-2 pt-1">
                                        <button onClick={confirmPriceEdit} className="h-9 px-4 bg-emerald-600 text-white rounded-lg font-black text-sm flex items-center gap-1.5 hover:bg-emerald-700 transition">
                                            <Check size={14} /> אישור
                                        </button>
                                        <button onClick={() => setIsPriceEditing(false)} className="h-9 px-3 text-slate-500 rounded-lg font-bold text-sm hover:bg-white transition">ביטול</button>
                                    </div>
                                </div>
                            )}

                            {/* Segmented Tab Control */}
                            <div className="bg-slate-100 p-1 rounded-xl flex gap-1">
                                <button
                                    onClick={() => setActiveTab('details')}
                                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'details' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                                >
                                    פרטים
                                </button>
                                <button
                                    onClick={() => setActiveTab('advanced')}
                                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'advanced' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                                >
                                    מתקדם
                                </button>
                            </div>
                        </div>

                        {/* ─── Content ──────────────────────────────────── */}
                        <div className="flex-1 overflow-y-auto px-3 md:px-5 py-3 md:py-4 space-y-3 md:space-y-4 pb-24">

                            {activeTab === 'details' ? (
                                /* ═══ DETAILS TAB ═══ */
                                <>
                                    {/* Supplier product names */}
                                    <FieldLabel label="שמות בתעודות ספק" helper="כדי לזהות את הפריט אוטומטית מתעודות משלוח">
                                        <div className="flex flex-wrap gap-1.5 mb-1.5">
                                            {formData.supplier_product_name.map((tag, i) => (
                                                <span key={i} className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full text-xs font-bold border border-indigo-100">
                                                    {tag}
                                                    <button onClick={() => removeTag(i)} className="hover:text-rose-500 transition"><X size={12} /></button>
                                                </span>
                                            ))}
                                        </div>
                                        <div className="flex gap-1.5">
                                            <input type="text" value={newTagInput} onChange={e => setNewTagInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())} placeholder="הוסף שם..." className="modal-input flex-1 !h-10 text-xs" />
                                            <button onClick={addTag} className="h-10 px-3 bg-indigo-50 text-indigo-600 rounded-xl font-bold text-sm hover:bg-indigo-100 transition shrink-0"><Plus size={14} /></button>
                                        </div>
                                    </FieldLabel>

                                    {/* Row: Supplier + Category */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <FieldLabel label="ספק">
                                            {!isCreatingSupplier ? (
                                                <SelectWrapper>
                                                    <select value={formData.supplier_id} onChange={e => { if (e.target.value === '__new__') { setIsCreatingSupplier(true); return; } updateField('supplier_id', e.target.value); }} className="modal-input appearance-none pr-4 pl-10">
                                                        <option value="">ללא ספק</option>
                                                        {suppliers.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
                                                        <option value="__new__">+ הוסף ספק חדש</option>
                                                    </select>
                                                </SelectWrapper>
                                            ) : (
                                                <div className="flex gap-1.5">
                                                    <input type="text" value={newSupplierName} onChange={e => setNewSupplierName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreateSupplier()} placeholder="שם הספק..." className="modal-input flex-1" autoFocus />
                                                    <button onClick={handleCreateSupplier} className="h-12 px-4 bg-amber-500 text-white rounded-xl font-black text-sm shrink-0">צור</button>
                                                    <button onClick={() => setIsCreatingSupplier(false)} className="h-12 px-2 text-slate-400 rounded-xl text-sm shrink-0">✕</button>
                                                </div>
                                            )}
                                        </FieldLabel>
                                        <FieldLabel label="קטגוריה">
                                            {!showCustomCategory ? (
                                                <SelectWrapper>
                                                    <select value={formData.category} onChange={e => handleCategoryChange(e.target.value)} className="modal-input appearance-none pr-4 pl-10">
                                                        <option value="">בחר קטגוריה...</option>
                                                        {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
                                                        <option value="__custom__">+ חדשה</option>
                                                    </select>
                                                </SelectWrapper>
                                            ) : (
                                                <div className="flex gap-1.5">
                                                    <input type="text" value={customCategory} onChange={e => setCustomCategory(e.target.value)} placeholder="שם הקטגוריה..." className="modal-input flex-1" autoFocus />
                                                    <button onClick={() => setShowCustomCategory(false)} className="h-12 px-2 text-slate-400 rounded-xl text-sm shrink-0">✕</button>
                                                </div>
                                            )}
                                        </FieldLabel>
                                    </div>

                                    {/* Unit selector — hidden for produce */}
                                    {!isProduceItem ? (
                                        <FieldLabel label="יחידת בסיס">
                                            <SelectWrapper className="w-full md:w-48">
                                                <select value={formData.unit} onChange={e => handleUnitChange(e.target.value)} className="modal-input appearance-none pr-4 pl-10">
                                                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                                </select>
                                            </SelectWrapper>
                                        </FieldLabel>
                                    ) : (
                                        /* ─── Produce: locked unit + weight per piece ─── */
                                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                                            <div className="flex items-center gap-2 mb-3">
                                                <span className="text-sm">🥬</span>
                                                <span className="text-sm font-black text-amber-700">ירק/פרי — יחידת בסיס: ק"ג</span>
                                            </div>
                                            <FieldLabel label="משקל ממוצע ליחידה בודדת (גרם)" helper={wpuHint}>
                                                <input
                                                    type="number"
                                                    inputMode="numeric"
                                                    value={formData.weight_per_unit}
                                                    onChange={e => updateField('weight_per_unit', e.target.value === '' ? '' : Number(e.target.value))}
                                                    placeholder="למשל: 150 לעגבניה"
                                                    className="modal-input [appearance:textfield] w-full text-lg font-black text-amber-800 bg-white border-amber-200 focus:border-amber-400"
                                                />
                                            </FieldLabel>
                                        </div>
                                    )}



                                    {/* Counting Steps */}
                                    <div className="bg-white rounded-2xl p-1">
                                        {formData.packaging_levels.length > 1 ? (
                                            <div className="space-y-3">
                                                {formData.packaging_levels.slice(1).map((level, idx) => {
                                                    const realIdx = idx + 1;
                                                    if (!level.name) return null;
                                                    const currentLvlStep = level.count_step || 1;
                                                    return (
                                                        <div key={realIdx}>
                                                            <label className="block text-xs font-bold text-slate-500 mb-1">קפיצת ספירה ל{level.name}</label>
                                                            <div className="flex gap-1.5">
                                                                {COUNT_STEPS.map(s => (
                                                                    <button
                                                                        key={s.value}
                                                                        type="button"
                                                                        onClick={() => {
                                                                            const newLevels = [...formData.packaging_levels];
                                                                            newLevels[realIdx] = { ...newLevels[realIdx], count_step: s.value };
                                                                            updateField('packaging_levels', newLevels);
                                                                        }}
                                                                        className={`flex-1 h-10 rounded-xl text-sm font-black transition ${currentLvlStep === s.value ? 'bg-violet-500 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                                                    >
                                                                        {s.label}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <FieldLabel label="קפיצת ספירה" helper={countStepHint}>
                                                <div className="flex gap-1.5">
                                                    {COUNT_STEPS.map(s => (
                                                        <button key={s.value} type="button" onClick={() => updateField('count_step', s.value)} className={`flex-1 h-10 rounded-xl text-base font-black transition ${formData.count_step === s.value ? 'bg-violet-500 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                                                            {s.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </FieldLabel>
                                        )}
                                    </div>
                                </>
                            ) : (
                                /* ═══ ADVANCED TAB ═══ */
                                <>
                                    <div className="grid grid-cols-2 gap-3">
                                        <FieldLabel label="קפיצת מתכון" helper={recipeStepHint}>
                                            <div className="flex gap-1 flex-wrap">
                                                {recipeSteps.map(s => (
                                                    <button key={s.value} type="button" onClick={() => updateField('recipe_step', s.value)} className={`flex-1 min-w-[40px] h-10 rounded-xl text-xs font-black transition ${formData.recipe_step === s.value ? 'bg-violet-500 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                                                        {s.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </FieldLabel>
                                        <FieldLabel label="אחוז ניצולת %" helper={yieldHint}>
                                            <input type="number" inputMode="decimal" value={formData.yield_percentage} onChange={e => updateField('yield_percentage', e.target.value)} placeholder="100" className="modal-input [appearance:textfield]" />
                                        </FieldLabel>
                                    </div>

                                    <FieldLabel label="מיקום במחסן">
                                        <input type="text" value={formData.location} onChange={e => updateField('location', e.target.value)} placeholder="מקרר 1, מדף יבשים, מקפיא..." className="modal-input" />
                                    </FieldLabel>

                                        {/* Row 1: Low stock threshold stepper + inline unit selector */}
                                        <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
                                            <div className="grid grid-cols-2 gap-3 items-end">
                                                <div className="w-full">
                                                    <StepperInput
                                                        label="מלאי מינימום (להתראת מלאי נמוך)"
                                                        value={displayedThreshold}
                                                        onChange={handleThresholdChange}
                                                        step={1}
                                                        min={0}
                                                        suffix={currentLvl.name}
                                                    />
                                                </div>
                                                {formData.packaging_levels.length > 1 ? (
                                                    <div className="flex flex-col gap-1.5 w-full">
                                                        <span className="text-xs font-bold text-slate-500">יחידת מידה</span>
                                                        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl h-12 items-center w-full justify-between">
                                                            {formData.packaging_levels.map((level, idx) => (
                                                                <button
                                                                    key={idx}
                                                                    type="button"
                                                                    onClick={() => setAdvPillLevel(idx)}
                                                                    className={`flex-1 h-10 rounded-lg text-xs font-bold transition-all ${advPillLevel === idx ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200'}`}
                                                                >
                                                                    {level.name || `רמה ${idx + 1}`}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="w-full" />
                                                )}
                                            </div>
                                        </div>

                                        {/* Row 2: Min order and Order step steppers */}
                                        <div className="grid grid-cols-2 gap-3 bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
                                            <StepperInput
                                                label="מינימום הזמנה מספק"
                                                value={displayedMinOrder}
                                                onChange={handleMinOrderChange}
                                                step={1}
                                                min={0}
                                                suffix={maxLvl.name}
                                            />
                                            <StepperInput
                                                label="קפיצת הזמנה (מכפיל)"
                                                value={displayedOrderStep}
                                                onChange={handleOrderStepChange}
                                                step={1}
                                                min={1}
                                                suffix={maxLvl.name}
                                            />
                                        </div>
                                </>
                            )}
                        </div>

                        {/* ─── Sticky Footer ────────────────────────────── */}
                        <div className="sticky bottom-0 z-10 bg-white border-t border-slate-100 px-4 md:px-5 py-3 flex items-center gap-3 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] shrink-0">
                            {isEditMode && (
                                <button onClick={handleDelete} className="h-10 px-3 bg-rose-50 text-rose-600 rounded-xl font-bold text-sm hover:bg-rose-100 transition flex items-center gap-2">
                                    <Trash2 size={16} />
                                    <span className="hidden md:inline">מחק</span>
                                </button>
                            )}
                            <div className="flex-1" />
                            <button onClick={onClose} className="h-10 px-4 text-slate-500 rounded-xl font-bold text-sm hover:bg-slate-100 transition">ביטול</button>
                            <button onClick={handleSave} disabled={isSaving} className="h-10 px-6 bg-indigo-600 text-white rounded-xl font-black text-sm hover:bg-indigo-700 transition flex items-center gap-2 shadow-sm active:scale-95 disabled:opacity-50">
                                {isSaving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={16} />}
                                {isEditMode ? 'שמור' : 'צור פריט'}
                            </button>
                        </div>
                    </MotionDiv>
                </MotionDiv>
            )}
        </AnimatePresence>
    );
};

// ─── Helper Components ───────────────────────────────────────────────────────

const FieldLabel: React.FC<{ label: string; helper?: string; children: React.ReactNode }> = ({ label, helper, children }) => (
    <div>
        <label className="block text-sm font-bold text-slate-700 mb-1.5">{label}</label>
        {children}
        {helper && <p className="text-xs text-slate-400 font-medium mt-1">{helper}</p>}
    </div>
);

const StepperInput: React.FC<{
    label: string;
    value: number;
    onChange: (val: number) => void;
    step?: number;
    min?: number;
    suffix?: string;
}> = ({ label, value, onChange, step = 1, min = 0, suffix = '' }) => {
    const formatValue = (val: number) => {
        if (val === 0) return '0';
        return val % 1 === 0 ? val.toString() : parseFloat(val.toFixed(2)).toString();
    };

    return (
        <div className="flex flex-col gap-1.5 w-full">
            <label className="text-xs font-bold text-slate-500 block truncate">{label}</label>
            <div className="flex items-center bg-slate-50 p-1 rounded-xl border border-slate-200 h-12">
                <button
                    type="button"
                    onClick={() => onChange(Math.max(min, value - step))}
                    className="w-10 h-10 flex items-center justify-center bg-white rounded-lg shadow-sm text-slate-400 hover:text-red-500 transition active:scale-95 shrink-0"
                >
                    <Minus size={16} strokeWidth={3} />
                </button>
                <div className="flex-1 flex flex-col justify-center items-center leading-none min-w-0">
                    <input
                        type="number"
                        inputMode="decimal"
                        value={value === 0 ? '' : formatValue(value)}
                        onChange={e => {
                            const parsed = parseFloat(e.target.value);
                            onChange(isNaN(parsed) ? 0 : Math.max(min, parsed));
                        }}
                        className="w-full bg-transparent border-none text-center font-black text-slate-800 focus:outline-none focus:ring-0 text-[15.5px] p-0 h-6 leading-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        placeholder="0"
                    />
                    {suffix && (
                        <span className="text-[9px] text-slate-400 font-bold uppercase select-none mt-0.5 leading-none">
                            {suffix}
                        </span>
                    )}
                </div>
                <button
                    type="button"
                    onClick={() => onChange(value + step)}
                    className="w-10 h-10 flex items-center justify-center bg-white rounded-lg shadow-sm text-slate-400 hover:text-emerald-500 transition active:scale-95 shrink-0"
                >
                    <Plus size={16} strokeWidth={3} />
                </button>
            </div>
        </div>
    );
};

export default InventoryItemModal;
