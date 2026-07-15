import React, { useState } from 'react';
import {
    ChevronDown, PlusCircle, Trash2, Edit2, Package, Save, CheckCircle,
    Minus, Plus, GripHorizontal
} from 'lucide-react';
import AnimatedSection from '@/components/manager/menu-editor/AnimatedSection';

const ModifiersSection = ({
    allGroups,
    showModifiersSection,
    toggleSection,
    selectedGroupIds,
    handleUpdateGroup,
    handleDeleteGroup,
    openPickerForGroup,
    openPickerForNewGroup,
    handleUpdateOption,
    handleDeleteOption,
    inventoryOptions,
    expandedOptionId,
    setExpandedOptionId
}) => {
    // Sort groups for display
    const sortedGroups = [...allGroups].sort((a, b) => (a.display_order || 0) - (b.display_order || 0));

    return (
        <div
            className={`bg-white rounded-2xl border transition-all duration-300 ${showModifiersSection ? 'border-blue-300 shadow-lg ring-1 ring-blue-100 mb-8' : 'border-gray-200 shadow-sm'} overflow-hidden`}
            id="modifiers-section"
        >
            {/* Header - Always Visible */}
            <div
                onClick={() => toggleSection('modifiers')}
                className={`p-4 flex items-center justify-between cursor-pointer select-none transition-colors ${showModifiersSection ? 'bg-blue-50/30' : 'bg-white hover:bg-gray-50'}`}
            >
                <div className="flex items-center gap-4 overflow-hidden flex-1">
                    <div className="w-12 h-12 flex items-center justify-center rounded-2xl shrink-0 bg-blue-100 text-blue-600">
                        <GripHorizontal size={24} strokeWidth={1.5} />
                    </div>
                    <div className="flex flex-col min-w-0">
                        <h3 className="font-black text-gray-800 text-base truncate leading-tight">תוספות ושדרוגים</h3>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs font-bold text-gray-500">ניהול אפשרויות ללקוח</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 pl-1">
                    {!showModifiersSection && selectedGroupIds.size > 0 && (
                        <div className="flex flex-col items-center justify-center px-3 py-1.5 rounded-xl border min-w-[3.5rem] bg-blue-50 border-blue-100 text-blue-600">
                            <span className="text-[9px] font-bold text-blue-400 leading-none mb-0.5">קבוצות</span>
                            <span className="font-black text-lg leading-none">{selectedGroupIds.size}</span>
                        </div>
                    )}
                    <div className={`p-1 rounded-full text-gray-400 transition-transform duration-300 ${showModifiersSection ? 'rotate-180 bg-gray-100' : ''}`}>
                        <ChevronDown size={20} />
                    </div>
                </div>
            </div>

            {/* Expanded Content */}
            <AnimatedSection show={showModifiersSection}>
                <div className="border-t border-gray-100 p-4 bg-white space-y-4">
                    {/* Groups List */}
                    {sortedGroups.map((group) => (
                        <div key={group.id} className="bg-white border-2 border-gray-100 rounded-3xl overflow-hidden shadow-sm">
                            <div className="flex items-center justify-between p-4 bg-gray-50/50">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
                                        <Package size={20} />
                                    </div>
                                    <h4 className="font-black text-gray-800">{group.name}</h4>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => handleDeleteGroup(group)}
                                        className="p-2 text-red-400 hover:bg-red-50 rounded-xl transition-colors"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>

                            {/* Group Settings */}
                            <div className="flex items-center gap-4 px-4 py-2 bg-gray-50/50 border-b border-gray-100">
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={group.is_required || false}
                                        onChange={(e) => handleUpdateGroup(group.id, { is_required: e.target.checked })}
                                        className="w-4 h-4 accent-blue-600 rounded"
                                    />
                                    <span className="text-xs font-bold text-gray-600">חובה לבחור</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={group.is_multiple_select || false}
                                        onChange={(e) => handleUpdateGroup(group.id, { is_multiple_select: e.target.checked })}
                                        className="w-4 h-4 accent-blue-600 rounded"
                                    />
                                    <span className="text-xs font-bold text-gray-600">אפשר כמה בחירות</span>
                                </label>
                            </div>

                            <div className="space-y-2 p-3">
                                {group.optionvalues?.map(ov => {
                                    const isExpanded = expandedOptionId === ov.id;
                                    return (
                                        <div key={ov.id} className={`bg-gray-50 border rounded-2xl overflow-hidden transition-all ${isExpanded ? 'border-teal-200 shadow-md bg-white' : 'border-gray-100 hover:border-teal-100'}`}>
                                            <div
                                                onClick={() => setExpandedOptionId(isExpanded ? null : ov.id)}
                                                className="p-3 flex items-center justify-between cursor-pointer select-none"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="font-bold text-gray-800">{ov.value_name}</div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className="text-sm font-bold text-teal-700">
                                                        {ov.price_adjustment ? `+₪${Number(ov.price_adjustment).toFixed(2)}` : '--'}
                                                    </div>
                                                    <ChevronDown size={18} className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                                </div>
                                            </div>

                                            {isExpanded && (
                                                <div className="border-t border-gray-100 p-4 bg-white animate-in slide-in-from-top-2">
                                                    <div className="flex flex-col sm:flex-row items-start gap-6">
                                                        <div className="flex flex-col gap-4 flex-1">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <span className="text-sm font-bold text-gray-500 w-20 shrink-0">תוספת מחיר</span>
                                                                <div className="flex items-center gap-1">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleUpdateOption(ov.id, { price_adjustment: Math.max(0, (Number(ov.price_adjustment) || 0) - 1) })}
                                                                        className="w-10 h-10 bg-gray-50 hover:bg-gray-100 text-gray-500 font-bold border border-gray-200 rounded-xl active:bg-gray-200 flex items-center justify-center transition-colors"
                                                                    >
                                                                        <Minus size={16} strokeWidth={2.5} />
                                                                    </button>
                                                                    <div className="w-14 h-10 flex items-center justify-center font-black text-gray-800 bg-gray-50 border border-gray-200 rounded-xl">
                                                                        <input
                                                                            type="number"
                                                                            value={ov.price_adjustment || ''}
                                                                            onChange={(e) => handleUpdateOption(ov.id, { price_adjustment: e.target.value })}
                                                                            className="w-full h-full text-center outline-none bg-transparent text-base font-black [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                            placeholder="0"
                                                                        />
                                                                    </div>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleUpdateOption(ov.id, { price_adjustment: (Number(ov.price_adjustment) || 0) + 1 })}
                                                                        className="w-10 h-10 bg-gray-50 hover:bg-gray-100 text-gray-500 font-bold border border-gray-200 rounded-xl active:bg-gray-200 flex items-center justify-center transition-colors"
                                                                    >
                                                                        <Plus size={16} strokeWidth={2.5} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            {/* Logic for weight, cost etc can be passed via props if needed */}
                                                        </div>
                                                        <div className="flex flex-col gap-3 shrink-0 items-end">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteOption(ov.id)}
                                                                className="flex items-center justify-center gap-2 text-red-500 bg-red-50 hover:bg-red-100 border border-red-100 py-3 rounded-xl text-sm font-bold transition-colors w-full px-4"
                                                            >
                                                                <Trash2 size={16} /> מחק תוספת
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                                <button
                                    type="button"
                                    onClick={() => openPickerForGroup(group.id)}
                                    className="w-full py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl text-xs font-bold border border-blue-100 border-dashed flex items-center justify-center gap-1 transition-colors mt-2"
                                >
                                    <Plus size={14} /> הוסף תוספת
                                </button>
                            </div>
                        </div>
                    ))}

                    <div className="pt-2">
                        <button
                            type="button"
                            onClick={openPickerForNewGroup}
                            className="w-full py-4 bg-blue-600 text-white rounded-2xl text-sm font-black hover:bg-blue-700 transition-all shadow-lg flex items-center justify-center gap-2"
                        >
                            <PlusCircle size={20} /> צור רשימת תוספות חדשה
                        </button>
                    </div>
                </div>
            </AnimatedSection>
        </div>
    );
};

export default ModifiersSection;
