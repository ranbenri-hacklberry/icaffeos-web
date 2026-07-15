import React, { useState, useMemo, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Package, AlertTriangle, Sparkles, Minus, Plus, ChevronDown, Check, Search } from 'lucide-react';

/**
 * TripleCheckCard - Compact 3-column verification card for goods receiving
 * Optimized for mobile with side-by-side pickers.
 */
const TripleCheckCard = ({
    item,
    orderedQty = null,
    invoicedQty = 0,
    actualQty = 0,
    onActualChange,
    onInvoicedChange = null,
    unitPrice = 0,
    catalogPrice = 0,
    catalogItemName = null,
    catalogItemId = null,
    isNew = false,
    countStep = 1,
    orderStep = 1,
    catalogItems = [],
    onCatalogItemSelect = null,
}) => {
    const hasActualVariance = Math.abs((parseFloat(actualQty) || 0) - (parseFloat(orderedQty) || 0)) > 0.01;

    const formatValue = (val) => {
        if (val === null || val === undefined) return '-';
        const num = parseFloat(val);
        if (isNaN(num)) return '0';
        return num % 1 === 0 ? num.toString() : num.toFixed(1);
    };

    // Compact Stepper Component
    const CompactStepper = ({ value, onChange, colorClass, label, step = 1 }) => (
        <div className="flex flex-col items-center gap-0.5 min-w-[75px]">
            <span className={`text-[9px] font-bold uppercase ${colorClass}`}>{label}</span>
            <div className={`flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200 shadow-sm`}>
                <button
                    onClick={(e) => { e.stopPropagation(); onChange(Math.max(0, value - (step || 1))); }}
                    className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-600 active:scale-90 transition-all font-bold"
                >
                    <Minus size={14} strokeWidth={3} />
                </button>
                <span className={`w-8 text-center font-mono text-sm font-black ${colorClass}`}>{formatValue(value)}</span>
                <button
                    onClick={(e) => { e.stopPropagation(); onChange(value + (step || 1)); }}
                    className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-600 active:scale-90 transition-all font-bold"
                >
                    <Plus size={14} strokeWidth={3} />
                </button>
            </div>
        </div>
    );

    return (
        <div className={`p-2 rounded-2xl border transition-all ${hasActualVariance ? 'bg-orange-50 border-orange-200' : 'bg-white border-slate-100 shadow-sm'}`} dir="rtl">
            <div className="flex items-center gap-3">

                {/* Information Column */}
                <div className="flex-1 min-w-0 pr-1">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        <h4 className="font-black text-[14px] text-slate-800 leading-tight">{item.name}</h4>
                        {isNew && <span className="text-[9px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-md font-bold">פריט חדש</span>}
                    </div>

                    <div className="flex flex-col text-[10px] text-slate-400 font-medium leading-tight">
                        <div className="flex items-center gap-2">
                            <span className="bg-slate-50 px-1.5 py-0.5 rounded font-bold border border-slate-100">
                                הוזמן: {formatValue(orderedQty)} {item.unit}
                            </span>
                            {hasActualVariance && <div className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-pulse" />}
                        </div>
                        {catalogItemName && catalogItemName !== item.name && (
                            <span className="text-[9px] text-slate-400 font-medium mt-1 italic">
                                ({catalogItemName})
                            </span>
                        )}
                    </div>
                </div>

                {/* Steppers Column */}
                <div className="shrink-0 flex items-center gap-3">
                    {/* Invoiced Stepper (Using Order Step) */}
                    <CompactStepper
                        value={invoicedQty}
                        onChange={onInvoicedChange}
                        colorClass="text-blue-600"
                        label="בחשבונית"
                        step={orderStep}
                    />

                    {/* Actual Stepper (Using Count Step) */}
                    <CompactStepper
                        value={actualQty}
                        onChange={onActualChange}
                        colorClass={hasActualVariance ? "text-orange-600" : "text-green-600"}
                        label="התקבל בפועל"
                        step={countStep}
                    />

                    {/* Quick check/match icon */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${!hasActualVariance ? 'bg-green-100 text-green-600' : 'bg-slate-50 text-slate-300'}`}>
                        <Check size={18} strokeWidth={3} />
                    </div>
                </div>
            </div>
        </div>
    );
};

TripleCheckCard.propTypes = {
    item: PropTypes.shape({
        id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        name: PropTypes.string.isRequired,
        unit: PropTypes.string,
        category: PropTypes.string,
    }).isRequired,
    orderedQty: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    invoicedQty: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    actualQty: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    onActualChange: PropTypes.func.isRequired,
    onInvoicedChange: PropTypes.func,
    unitPrice: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    catalogPrice: PropTypes.number,
    catalogItemName: PropTypes.string,
    catalogItemId: PropTypes.string,
    isNew: PropTypes.bool,
    countStep: PropTypes.number,
    orderStep: PropTypes.number,
    catalogItems: PropTypes.array,
    onCatalogItemSelect: PropTypes.func,
};

export default React.memo(TripleCheckCard);
