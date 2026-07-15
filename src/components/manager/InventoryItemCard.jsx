import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Package, ChevronDown, Minus, Plus, ShoppingCart, Save, History,
    User, AlertCircle, RotateCcw, MapPin, Settings, X, AlertTriangle,
    Scale, Trash2, Info, FlaskConical
} from 'lucide-react';
import ManagerAuthModal from '@/components/ManagerAuthModal';

/**
 * ─────────────────────────────────────────────────────────────
 *  DUAL-VIEW INVENTORY HELPERS
 *
 *  Terminology:
 *    - current_stock  →  always stored in BASE units (grams / ml / pieces)
 *    - display_unit   →  what the staff member sees and counts in (e.g. "ארגז", "שק")
 *    - conversion_factor  →  how many base units are in 1 display_unit  (e.g. 1 Box = 1000g → cf = 1000)
 *
 *  Sources of truth (priority order):
 *    1. item.settings.display_unit / item.settings.conversion_factor   (new JSONB fields)
 *    2. item.weight_per_unit                                             (legacy column, used as cf fallback)
 *    3. item.unit                                                        (base unit label)
 *
 *  Recipe / food-cost logic reads current_stock directly (base units) — unchanged.
 * ─────────────────────────────────────────────────────────────
 */

/** Returns the effective conversion factor for a given item */
const getConversionFactor = (item) => {
    const fromSettings = parseFloat(item?.settings?.conversion_factor);
    if (!isNaN(fromSettings) && fromSettings > 0) return fromSettings;
    const fromWeight = parseFloat(item?.weight_per_unit);
    if (!isNaN(fromWeight) && fromWeight > 0) return fromWeight;
    return 1; // 1:1 — no conversion
};

/** Returns the display unit label */
const getDisplayUnit = (item) =>
    item?.display_unit || item?.settings?.display_unit || null; // null = no display unit configured

/** Convert base units → display units for showing to staff */
const toDisplayUnits = (baseValue, cf) =>
    cf > 0 ? baseValue / cf : baseValue;

/** Convert display units → base units for storing */
const toBaseUnits = (displayValue, cf) =>
    cf > 0 ? displayValue * cf : displayValue;

/** Pretty-print a number: no trailing .0 */
const fmt = (val) => {
    const n = Number(val);
    if (isNaN(n)) return '0';
    if (n % 1 === 0) return n.toString();
    return parseFloat(n.toFixed(2)).toString();
};

/**
 * ConversionTag — shows "1 ארגז = 1000 גרם" inline badge
 */
const ConversionTag = ({ displayUnit, conversionFactor, baseUnit }) => {
    if (!displayUnit || conversionFactor <= 1) return null;
    return (
        <span
            className="inline-flex items-center gap-0.5 text-[9px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-full"
            title="יחידת תצוגה — מקדם המרה"
        >
            <Info size={8} />
            1 {displayUnit} = {fmt(conversionFactor)} {baseUnit || 'גרם'}
        </span>
    );
};

// ─────────────────────────────────────────────────────────────

/**
 * InventoryItemCard — Dual-View version
 *
 * Staff see & interact in display_units (e.g. "2 Boxes").
 * current_stock is always persisted in base units (grams/ml/pieces).
 * Recipe cost calculations read current_stock directly — no change needed there.
 */
const InventoryItemCard = ({
    item,
    onStockChange = null,
    onOrderChange = null,
    onUpdate = null,
    onDelete = null,
    draftOrderQty = 0
}) => {
    // ── Dual-view config ──────────────────────────────────────
    const conversionFactor = useMemo(() => getConversionFactor(item), [item]);
    const displayUnit = useMemo(() => getDisplayUnit(item), [item]);
    const baseUnit = item.base_unit || 'יח׳';
    const hasDisplayUnit = !!displayUnit && conversionFactor > 1;

    // ── State ─────────────────────────────────────────────────
    // currentStockBase: always in base units (grams etc.)
    const [currentStockBase, setCurrentStockBase] = useState(() => {
        const v = Number(item.current_stock);
        return isNaN(v) ? 0 : v;
    });

    // What the staff member has typed into the count input (in DISPLAY units)
    const [countInputDisplay, setCountInputDisplay] = useState('');
    const [isEditingCount, setIsEditingCount] = useState(false);

    const [orderQty, setOrderQty] = useState(draftOrderQty || 0);
    const [hasStockChange, setHasStockChange] = useState(false);
    const [hasOrderChange, setHasOrderChange] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editData, setEditData] = useState(null);
    const [showDeleteAuth, setShowDeleteAuth] = useState(false);

    // Sync from parent prop (e.g. after RPC refresh)
    useEffect(() => {
        if (!hasStockChange) {
            const v = Number(item.current_stock) || 0;
            setCurrentStockBase(v);
        }
    }, [item.current_stock, hasStockChange]);

    useEffect(() => {
        if (!hasOrderChange) setOrderQty(draftOrderQty || 0);
    }, [draftOrderQty, hasOrderChange]);

    // ── Derived step values ───────────────────────────────────
    const countStep = useMemo(() => {
        const v = parseFloat(item.inventory_count_step);
        return isNaN(v) || v <= 0 ? 1 : v;
    }, [item.inventory_count_step]);

    const orderStep = useMemo(() => {
        let v = parseFloat(item.order_step);
        if (isNaN(v) || v <= 0) return 1;
        if (conversionFactor > 1 && v >= conversionFactor) return v / conversionFactor;
        return v;
    }, [item.order_step, conversionFactor]);

    const minOrder = useMemo(() => {
        let v = parseFloat(item.min_order);
        if (isNaN(v) || v <= 0) return 0;
        if (conversionFactor > 1 && v >= conversionFactor) return v / conversionFactor;
        return v;
    }, [item.min_order, conversionFactor]);

    const lowStockThresholdBase = useMemo(() =>
        Math.round((parseFloat(item.low_stock_threshold_units) || 0) * conversionFactor * 100) / 100,
        [item.low_stock_threshold_units, conversionFactor]
    );
    const isLowStock = lowStockThresholdBase > 0 && currentStockBase <= lowStockThresholdBase;

    // ── Display value (what staff SEES) ───────────────────────
    const displayStockValue = useMemo(() => {
        const raw = hasDisplayUnit ? toDisplayUnits(currentStockBase, conversionFactor) : currentStockBase;
        // Pessimistic rounding down: always show the amount of FULL steps available
        const floored = Math.floor((raw + 0.00001) / countStep) * countStep;
        return fmt(floored);
    }, [currentStockBase, hasDisplayUnit, conversionFactor, countStep]);
    const displayStockUnit = hasDisplayUnit ? displayUnit : baseUnit;

    // ── Metadata ──────────────────────────────────────────────
    const lastCountedByName = item.last_counted_by_name || null;
    const lastCountSource = item.last_count_source || 'manual';
    const lastCountDate = item.last_counted_at ? new Date(item.last_counted_at) : null;

    const sourceText = useMemo(() => {
        let type = 'ספירה ידנית';
        if (lastCountSource === 'order_receipt') type = 'קליטת סחורה';
        else if (lastCountSource === 'order_deduction') type = 'הזמנת לקוח (אוטומטי)';
        else if (lastCountSource === 'local_script_override') type = 'עדכון מערכת';
        return lastCountedByName ? `${type} (${lastCountedByName})` : type;
    }, [lastCountSource, lastCountedByName]);

    const isCountedToday = useMemo(() => {
        if (!lastCountDate) return false;
        return lastCountDate.toDateString() === new Date().toDateString();
    }, [lastCountDate]);

    // ── location / notes from settings JSONB ─────────────────
    const locationDisplay = item.settings?.location ?? item.location ?? null;
    const notesDisplay = item.settings?.notes ?? null;

    // ── Stock stepper (in display units, converts to base before storing) ──
    const handleStockClick = (direction) => {
        // Step is always in display-units. Convert to base when updating state.
        const stepInBase = toBaseUnits(countStep, conversionFactor);
        setCurrentStockBase(prev => Math.max(0, Math.round((prev + direction * stepInBase) * 100) / 100));
        setHasStockChange(true);
    };

    // ── Direct count input (staff types display units) ────────
    const handleCountInputChange = (e) => {
        setCountInputDisplay(e.target.value);
        setIsEditingCount(true);
    };

    const commitCountInput = () => {
        const parsed = parseFloat(countInputDisplay);
        if (!isNaN(parsed) && parsed >= 0) {
            const newBase = Math.round(toBaseUnits(parsed, conversionFactor) * 100) / 100;
            setCurrentStockBase(newBase);
            setHasStockChange(true);
        }
        setIsEditingCount(false);
        setCountInputDisplay('');
    };

    const handleCountKeyDown = (e) => {
        if (e.key === 'Enter') commitCountInput();
        if (e.key === 'Escape') { setIsEditingCount(false); setCountInputDisplay(''); }
    };

    // ── Order stepper ─────────────────────────────────────────
    const handleOrderClick = (direction) => {
        setOrderQty(prev => {
            const current = prev || 0;
            let next;
            if (direction > 0) {
                next = current === 0 && minOrder > 0 ? minOrder : current + orderStep;
            } else {
                next = current - orderStep;
                if (minOrder > 0 && next < minOrder) next = 0;
            }
            return Math.max(0, next);
        });
        setHasOrderChange(true);
    };

    // ── Save handlers ─────────────────────────────────────────
    const saveStock = useCallback(async (e) => {
        e?.stopPropagation();
        if (onStockChange) onStockChange(item.id, currentStockBase); // always saves BASE units
        setHasStockChange(false);
    }, [currentStockBase, item.id, onStockChange]);

    const saveOrder = useCallback(async (e) => {
        e?.stopPropagation();
        if (onOrderChange) onOrderChange(item.id, orderQty, item);
        setHasOrderChange(false);
    }, [orderQty, item, onOrderChange]);

    // ── Edit modal helpers ────────────────────────────────────
    const handleOpenEdit = (e) => {
        e.stopPropagation();
        setEditData({
            // Core columns
            name: item.name || '',
            catalog_item_name: item.catalog_item_name || '',
            base_unit: item.base_unit || 'יח׳',
            display_unit: item.display_unit || '',
            cost_per_unit: item.cost_per_unit || 0,
            inventory_count_step: item.inventory_count_step || 1,
            weight_per_unit: parseFloat(item.weight_per_unit) || 0,
            min_order: minOrder,
            order_step: orderStep,
            low_stock_threshold_units: item.low_stock_threshold_units || 0,
            yield_percentage: item.yield_percentage || 100,
            // settings JSONB (dual-view + misc)
            settings: {
                display_unit: item.display_unit || item.settings?.display_unit || '',
                conversion_factor: item.settings?.conversion_factor ?? (parseFloat(item.weight_per_unit) > 1 ? parseFloat(item.weight_per_unit) : ''),
                location: item.settings?.location ?? item.location ?? '',
                notes: item.settings?.notes ?? '',
            },
        });
        setShowEditModal(true);
    };

    const handleSaveEdit = async () => {
        if (!onUpdate) return;
        setSaving(true);
        try {
            // Merge settings JSONB into the update payload cleanly
            const payload = {
                name: editData.name,
                catalog_item_name: editData.catalog_item_name,
                base_unit: editData.base_unit,
                display_unit: editData.display_unit,
                cost_per_unit: editData.cost_per_unit,
                inventory_count_step: editData.inventory_count_step,
                weight_per_unit: editData.weight_per_unit,
                min_order: editData.min_order,
                order_step: editData.order_step,
                low_stock_threshold_units: editData.low_stock_threshold_units,
                yield_percentage: editData.yield_percentage,
                // location column stays for backwards compat (legacy hook usage)
                location: editData.settings.location,
                // Full settings JSONB
                settings: {
                    ...(item.settings || {}),
                    display_unit: editData.settings.display_unit || null,
                    conversion_factor: parseFloat(editData.settings.conversion_factor) || null,
                    location: editData.settings.location || null,
                    notes: editData.settings.notes || null,
                },
            };
            await onUpdate(item.id, payload);
            setShowEditModal(false);
        } catch (e) {
            console.error(e);
            alert('עדכון נכשל');
        } finally {
            setSaving(false);
        }
    };

    // ── Compact sub-components ────────────────────────────────
    const CompactStepper = ({ value, onChange, colorClass, label, unit, isEditable, onDirectInput }) => {
        const [localInput, setLocalInput] = useState('');
        const [editing, setEditing] = useState(false);
        return (
            <div className="flex flex-col items-center gap-0.5 min-w-[85px]">
                <span className={`text-[9px] font-bold uppercase ${colorClass}`}>{label}</span>
                <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200 shadow-sm">
                    <button
                        onClick={(e) => { e.stopPropagation(); onChange(-1); }}
                        className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-600 active:scale-90 transition-all font-bold"
                    >
                        <Minus size={14} strokeWidth={3} />
                    </button>

                    {/* Tap on value to type directly */}
                    <div
                        className="flex flex-col items-center justify-center min-w-[36px] leading-none cursor-text"
                        onDoubleClick={() => isEditable && setEditing(true)}
                    >
                        {editing && isEditable ? (
                            <input
                                autoFocus
                                type="number"
                                inputMode="decimal"
                                className={`w-10 text-center text-sm font-black bg-yellow-50 border border-yellow-300 rounded outline-none ${colorClass}`}
                                defaultValue={parseFloat(value) || 0}
                                onChange={e => setLocalInput(e.target.value)}
                                onBlur={() => {
                                    const v = parseFloat(localInput);
                                    if (!isNaN(v) && v >= 0 && onDirectInput) onDirectInput(v);
                                    setEditing(false);
                                }}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') e.target.blur();
                                    if (e.key === 'Escape') setEditing(false);
                                }}
                            />
                        ) : (
                            <span
                                className={`font-mono text-sm font-black ${colorClass} ${isEditable ? 'hover:underline hover:underline-offset-2' : ''}`}
                                title={isEditable ? 'לחץ פעמיים להזין ידנית' : undefined}
                            >
                                {value}
                            </span>
                        )}
                        <span className="text-[7px] font-bold opacity-50 uppercase mt-0.5">{unit}</span>
                    </div>

                    <button
                        onClick={(e) => { e.stopPropagation(); onChange(1); }}
                        className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-600 active:scale-90 transition-all font-bold"
                    >
                        <Plus size={14} strokeWidth={3} />
                    </button>
                </div>
            </div>
        );
    };

    const NumberStepper = ({ label, value, onChange, step = 1, min = 0 }) => (
        <div className="flex flex-col gap-1.5 w-full">
            <label className="text-xs font-bold text-slate-500 block truncate">{label}</label>
            <div className="flex items-center bg-slate-50 p-1 rounded-xl border border-slate-200 h-10">
                <button
                    type="button"
                    onClick={() => onChange(Math.max(min, (parseFloat(value) || 0) - step))}
                    className="w-8 h-8 flex-shrink-0 flex items-center justify-center bg-white rounded-lg shadow-sm text-slate-400 hover:text-red-500 transition-colors active:scale-90"
                >
                    <Minus size={16} strokeWidth={3} />
                </button>
                <input
                    type="number"
                    value={value}
                    onChange={e => onChange(parseFloat(e.target.value) || 0)}
                    className="flex-1 min-w-0 bg-transparent border-none text-center font-black text-slate-700 focus:outline-none focus:ring-0 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button
                    type="button"
                    onClick={() => onChange((parseFloat(value) || 0) + step)}
                    className="w-8 h-8 flex-shrink-0 flex items-center justify-center bg-white rounded-lg shadow-sm text-slate-400 hover:text-emerald-500 transition-colors active:scale-90"
                >
                    <Plus size={16} strokeWidth={3} />
                </button>
            </div>
        </div>
    );

    // ── Render ────────────────────────────────────────────────
    return (
        <>
            <div
                className={`p-2 rounded-2xl border transition-all ${hasStockChange || hasOrderChange
                    ? 'bg-blue-50 border-blue-200'
                    : isCountedToday
                        ? 'bg-emerald-50/20 border-emerald-100'
                        : 'bg-white border-slate-100 shadow-sm'
                    }`}
                dir="rtl"
            >
                <div className="flex items-center gap-3">

                    {/* ── Left: Name + meta ────────────────── */}
                    <div className="flex-1 min-w-0 pr-1">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                            <h4 className="font-black text-[14px] text-slate-800 leading-tight">{item.name}</h4>
                            {item.catalog_item_name && item.catalog_item_name !== item.name && (
                                <span className="text-[10px] text-slate-400 font-medium italic">({item.catalog_item_name})</span>
                            )}
                        </div>

                        {/* Conversion Info Tag */}
                        {hasDisplayUnit && (
                            <div className="mb-1">
                                <ConversionTag
                                    displayUnit={displayUnit}
                                    conversionFactor={conversionFactor}
                                    baseUnit={baseUnit}
                                />
                            </div>
                        )}

                        <div className="flex flex-col text-[10px] text-slate-400 font-medium leading-tight gap-0.5">
                            {locationDisplay && (
                                <span className="text-[9px] text-amber-600 bg-amber-50 px-1 rounded font-bold self-start">
                                    📍 {locationDisplay}
                                </span>
                            )}
                            {notesDisplay && (
                                <span className="text-[9px] text-slate-500 italic truncate max-w-[150px]" title={notesDisplay}>
                                    💬 {notesDisplay}
                                </span>
                            )}

                            <div className="flex items-center gap-1.5 mt-0.5">
                                {isCountedToday ? (
                                    <span className="text-emerald-600 font-bold bg-emerald-50 px-1 rounded">היום</span>
                                ) : lastCountDate ? (
                                    <span>
                                        {String(lastCountDate.getDate()).padStart(2, '0')}/
                                        {String(lastCountDate.getMonth() + 1).padStart(2, '0')}/
                                        {lastCountDate.getFullYear()} {lastCountDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                ) : (
                                    <span>טרם נספר</span>
                                )}
                                {isLowStock && <AlertTriangle size={10} className="text-red-500 animate-pulse" />}
                            </div>
                            {item.last_counted_by_name && (
                                <div className="flex items-center gap-0.5 font-bold text-slate-400">
                                    👤 {item.last_counted_by_name}
                                </div>
                            )}

                            {/* Base-unit sub-label — so staff can always see the raw value too */}
                            {hasDisplayUnit && (
                                <span className="text-[8px] text-slate-300 font-medium">
                                    ({fmt(currentStockBase)} {baseUnit} בסיס)
                                </span>
                            )}
                        </div>
                    </div>

                    {/* ── Right: Steppers ──────────────────── */}
                    <div className="flex items-center gap-4 shrink-0">
                        {/* Stock Stepper */}
                        <div className="flex items-center gap-2">
                            <CompactStepper
                                label="מלאי"
                                value={displayStockValue}
                                unit={displayStockUnit}
                                onChange={handleStockClick}
                                colorClass={isLowStock ? 'text-red-500' : hasStockChange ? 'text-blue-600' : 'text-slate-700'}
                                isEditable={true}
                                onDirectInput={(displayVal) => {
                                    const newBase = Math.round(toBaseUnits(displayVal, conversionFactor) * 100) / 100;
                                    setCurrentStockBase(newBase);
                                    setHasStockChange(true);
                                }}
                            />
                            <div className="w-9 h-9 flex-shrink-0 flex items-center justify-center">
                                {hasStockChange && (
                                    <button onClick={saveStock} className="w-9 h-9 bg-emerald-600 text-white rounded-xl shadow-lg shadow-emerald-100 flex items-center justify-center hover:bg-emerald-700 active:scale-90 transition-all">
                                        <Save size={16} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Order Stepper */}
                        <div className="flex items-center gap-2">
                            <CompactStepper
                                label="הזמנה"
                                value={fmt(orderQty)}
                                unit="יח׳"
                                onChange={handleOrderClick}
                                colorClass={orderQty > 0 ? 'text-indigo-600' : 'text-slate-400'}
                                isEditable={false}
                            />
                            <div className="w-9 h-9 flex-shrink-0 flex items-center justify-center">
                                {hasOrderChange && (
                                    <button onClick={saveOrder} className="w-9 h-9 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-100 flex items-center justify-center hover:bg-indigo-700 active:scale-90 transition-all">
                                        <ShoppingCart size={16} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Edit settings button */}
                        <button
                            onClick={handleOpenEdit}
                            className="w-9 h-9 flex-shrink-0 flex items-center justify-center bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all border border-slate-100 active:scale-90"
                        >
                            <Settings size={18} />
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Edit Modal ────────────────────────────────── */}
            {showEditModal && editData && (
                <div
                    className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                    onClick={() => setShowEditModal(false)}
                >
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center shrink-0">
                            <h3 className="text-xl font-black text-slate-800">ערוך פריט: {item.name}</h3>
                            <button onClick={() => setShowEditModal(false)} className="w-10 h-10 flex items-center justify-center bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Scrollable Body */}
                        <div className="overflow-y-auto flex-1 p-5 space-y-5">

                            {/* ── Section: Core Fields ──────── */}
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-3">פרטי פריט</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="col-span-2">
                                        <label className="text-xs font-bold text-slate-500 block mb-1">שם הפריט במערכת</label>
                                        <input type="text" value={editData.name} onChange={e => setEditData({ ...editData, name: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-400 text-sm" />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="text-xs font-bold text-slate-500 block mb-1">שם אצל הספק (קטלוג)</label>
                                        <input type="text" value={editData.catalog_item_name} onChange={e => setEditData({ ...editData, catalog_item_name: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-400 text-sm" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 block mb-1">יחידת בסיס</label>
                                        <select value={editData.base_unit} onChange={e => setEditData({ ...editData, base_unit: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm">
                                            <option value="יח׳">יח׳</option>
                                            <option value="גרם">גרם</option>
                                            <option value="ק״ג">ק״ג</option>
                                            <option value="ליטר">ליטר</option>
                                            <option value="מ״ל">מ״ל</option>
                                        </select>
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-xs font-bold text-slate-500 block">עלות ליחידת בסיס (₪)</label>
                                        <input
                                            type="number" inputMode="decimal"
                                            value={editData.cost_per_unit}
                                            onChange={e => setEditData({ ...editData, cost_per_unit: parseFloat(e.target.value) || 0 })}
                                            className="w-full h-10 px-4 bg-slate-50 border border-slate-200 rounded-xl font-black text-slate-700 focus:outline-none focus:border-blue-400 text-sm [appearance:textfield]"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* ── Section: Dual-View (Display Unit) ── */}
                            <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <FlaskConical size={14} className="text-indigo-600" />
                                    <p className="text-[10px] font-black text-indigo-600 uppercase tracking-wider">יחידת תצוגה לצוות (Dual-View)</p>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 block mb-1">שם יחידת תצוגה</label>
                                        <input
                                            type="text"
                                            placeholder="למשל: ארגז, שק, בקבוק"
                                            value={editData.settings.display_unit}
                                            onChange={e => setEditData({ ...editData, settings: { ...editData.settings, display_unit: e.target.value } })}
                                            className="w-full px-4 py-2 bg-white border border-indigo-200 rounded-xl focus:outline-none focus:border-indigo-400 text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 block mb-1">מקדם המרה (1 יחידה = ?)</label>
                                        <input
                                            type="number" inputMode="decimal"
                                            placeholder="למשל: 1000 לשק קמח"
                                            value={editData.settings.conversion_factor}
                                            onChange={e => setEditData({ ...editData, settings: { ...editData.settings, conversion_factor: e.target.value } })}
                                            className="w-full px-4 py-2 bg-white border border-indigo-200 rounded-xl focus:outline-none focus:border-indigo-400 text-sm [appearance:textfield]"
                                        />
                                    </div>
                                </div>
                                {/* Live preview */}
                                {editData.settings.display_unit && parseFloat(editData.settings.conversion_factor) > 1 && (
                                    <div className="mt-2 flex items-center gap-1.5 text-[10px] text-indigo-700 bg-white border border-indigo-100 rounded-xl px-3 py-2">
                                        <Info size={11} />
                                        <span>
                                            1 {editData.display_unit || editData.settings.display_unit} = {parseFloat(editData.settings.conversion_factor)} {editData.base_unit}
                                            &nbsp;·&nbsp; הצוות יזין יחידות, המערכת תחשב {editData.base_unit} אוטומטית
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* ── Section: Counting & Ordering ── */}
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-3">ספירה והזמנה</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <NumberStepper label="התראת מלאי נמוך (יח׳ תצוגה)" value={editData.low_stock_threshold_units} onChange={val => setEditData({ ...editData, low_stock_threshold_units: val })} />
                                    <NumberStepper label="אחוז ניצול (%)" value={editData.yield_percentage} onChange={val => setEditData({ ...editData, yield_percentage: val })} step={5} min={1} />
                                    <div className="col-span-2">
                                        <label className="text-xs font-bold text-slate-500 block mb-2">קפיצת ספירה (יח׳ תצוגה)</label>
                                        <div className="flex flex-wrap gap-1.5">
                                            {[0.1, 0.25, 0.5, 1, 5, 10].map(val => (
                                                <button key={val} type="button" onClick={() => setEditData({ ...editData, inventory_count_step: val })}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${editData.inventory_count_step === val ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:border-blue-400'}`}
                                                >
                                                    {val}
                                                </button>
                                            ))}
                                            <div className="flex-1 min-w-[60px]">
                                                <input type="number" inputMode="decimal" value={editData.inventory_count_step}
                                                    onChange={e => setEditData({ ...editData, inventory_count_step: parseFloat(e.target.value) || 1 })}
                                                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400 text-xs font-bold [appearance:textfield]" placeholder="אחר"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <NumberStepper label="קפיצת הזמנה" value={editData.order_step} onChange={val => setEditData({ ...editData, order_step: val, min_order: val })} min={1} />
                                    <NumberStepper label="מינימום הזמנה" value={editData.min_order} onChange={val => setEditData({ ...editData, min_order: val })} />
                                </div>
                            </div>

                            {/* ── Section: Settings JSONB (Location + Notes) ── */}
                            <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <MapPin size={14} className="text-amber-600" />
                                    <p className="text-[10px] font-black text-amber-600 uppercase tracking-wider">מידע לוגיסטי</p>
                                </div>
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 block mb-1">מיקום במחסן / תצוגה</label>
                                        <input
                                            type="text"
                                            placeholder="למשל: מחסן, מדף 3"
                                            value={editData.settings.location}
                                            onChange={e => setEditData({ ...editData, settings: { ...editData.settings, location: e.target.value } })}
                                            className="w-full px-4 py-2 bg-white border border-amber-200 rounded-xl focus:outline-none focus:border-amber-400 text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 block mb-1">הערות</label>
                                        <textarea
                                            rows={2}
                                            placeholder="הערות פנימיות על הפריט..."
                                            value={editData.settings.notes}
                                            onChange={e => setEditData({ ...editData, settings: { ...editData.settings, notes: e.target.value } })}
                                            className="w-full px-4 py-2 bg-white border border-amber-200 rounded-xl focus:outline-none focus:border-amber-400 text-sm resize-none"
                                        />
                                    </div>
                                </div>
                            </div>

                        </div>

                        {/* Footer */}
                        <div className="p-5 border-t border-slate-100 shrink-0 flex gap-3">
                            <button
                                onClick={() => { setShowDeleteAuth(true); setShowEditModal(false); }}
                                className="w-12 h-12 flex items-center justify-center bg-red-50 text-red-400 rounded-2xl hover:bg-red-100 transition-colors border border-red-100 active:scale-90"
                            >
                                <Trash2 size={18} />
                            </button>
                            <button
                                onClick={handleSaveEdit}
                                disabled={saving}
                                className="flex-1 py-3 bg-blue-600 text-white font-black rounded-2xl shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50"
                            >
                                {saving ? 'שומר...' : 'שמור שינויים'}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}

            {/* Delete Auth Modal */}
            {showDeleteAuth && (
                <ManagerAuthModal
                    isOpen
                    onClose={() => setShowDeleteAuth(false)}
                    onSuccess={() => { setShowDeleteAuth(false); onDelete && onDelete(item.id); }}
                    title="אישור מנהל למחיקת פריט"
                />
            )}
        </>
    );
};

InventoryItemCard.propTypes = {
    item: PropTypes.object.isRequired,
    onStockChange: PropTypes.func,
    onOrderChange: PropTypes.func,
    onUpdate: PropTypes.func,
    onDelete: PropTypes.func,
    draftOrderQty: PropTypes.number,
};

export default React.memo(InventoryItemCard);
