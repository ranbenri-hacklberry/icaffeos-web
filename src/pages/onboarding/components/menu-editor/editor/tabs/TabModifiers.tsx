import React, { useState } from 'react';
import { Plus, Trash2, ChevronDown, Star, HelpCircle } from 'lucide-react';
import { OnboardingItem, ModifierGroup, ModifierRequirement, ModifierLogic } from '@/pages/onboarding/types/onboardingTypes';

interface TabModifiersProps {
    localItem: OnboardingItem;
    setLocalItem: React.Dispatch<React.SetStateAction<OnboardingItem>>;
}

const TabModifiers = ({ localItem, setLocalItem }: TabModifiersProps) => {
    // Accordion state: keep track of which groups are expanded
    const [expandedGroups, setExpandedGroups] = useState<Record<number, boolean>>(() => {
        // By default, if there's only one group, open it. Otherwise, close all.
        const initial: Record<number, boolean> = {};
        if (localItem.modifiers?.length === 1) initial[0] = true;
        return initial;
    });

    const toggleGroup = (idx: number) => {
        setExpandedGroups(prev => ({ ...prev, [idx]: !prev[idx] }));
    };

    const isMilkGroup = (name: string) => name?.includes('חלב');
    const isBottomGroup = (name: string) => name?.includes('נטול') || name?.includes('מפורק');

    const moveGroup = (idx: number, direction: 'up' | 'down') => {
        const updated = [...(localItem.modifiers || [])];
        const targetIdx = direction === 'up' ? idx - 1 : idx + 1;

        if (targetIdx < 0 || targetIdx >= updated.length) return;

        // Constraint: Milk stays at top, Bottom groups stay at bottom
        const currentGroup = updated[idx];
        const targetGroup = updated[targetIdx];

        if (isMilkGroup(currentGroup.name) || isMilkGroup(targetGroup.name)) return;
        if (isBottomGroup(currentGroup.name) || isBottomGroup(targetGroup.name)) return;

        [updated[idx], updated[targetIdx]] = [updated[targetIdx], updated[idx]];
        setLocalItem({ ...localItem, modifiers: updated });

        // Follow the expansion state
        setExpandedGroups(prev => {
            const next = { ...prev };
            next[targetIdx] = prev[idx];
            next[idx] = prev[targetIdx];
            return next;
        });
    };

    return (
        <div className="space-y-6" dir="rtl">
            {/* Header / Add Group */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-indigo-50/50 p-5 rounded-2xl border border-indigo-100 gap-4">
                <div>
                    <h4 className="font-black text-indigo-900 text-base md:text-lg flex items-center gap-2">
                        <Plus className="text-indigo-600" size={20} /> תוספות ומודיפיירים
                    </h4>
                    <p className="text-xs text-indigo-600/70 font-bold mt-0.5">ניהול סדר ההופעה בעמדת הקופה והשפעה על המלאי</p>
                </div>
                <button
                    onClick={() => {
                        const newGroup: ModifierGroup = {
                            name: '',
                            items: [],
                            requirement: ModifierRequirement.OPTIONAL,
                            logic: ModifierLogic.ADD,
                            minSelection: 0,
                            maxSelection: 10
                        };
                        const updatedModifiers = [...(localItem.modifiers || []), newGroup];
                        setLocalItem(p => ({ ...p, modifiers: updatedModifiers }));
                        setExpandedGroups(prev => ({ ...prev, [updatedModifiers.length - 1]: true }));
                    }}
                    className="w-full sm:w-auto px-6 py-3 bg-indigo-600 text-white text-xs font-black rounded-xl shadow-[0_4px_12px_rgba(79,70,229,0.3)] hover:bg-slate-900 transition-all uppercase flex items-center justify-center gap-2"
                >
                    <Plus size={18} /> הוסף קבוצת תוספות
                </button>
            </div>

            <div className="space-y-4">
                {(localItem.modifiers || []).map((group, gIdx) => {
                    const isExpanded = expandedGroups[gIdx];

                    return (
                        <div key={gIdx} className={`bg-white rounded-2xl border transition-all duration-300 ${isExpanded ? 'border-indigo-200 shadow-md ring-1 ring-indigo-50' : 'border-slate-100 shadow-sm hover:border-slate-200'}`}>
                            {/* Group Header (Accordion Toggle) */}
                            <div
                                onClick={() => toggleGroup(gIdx)}
                                className={`p-4 cursor-pointer flex items-center justify-between gap-4 select-none transition-colors ${isExpanded ? 'bg-indigo-50/30 border-b border-indigo-100' : 'bg-white'}`}
                            >
                                <div className="flex items-center gap-3 flex-1 overflow-hidden" onClick={e => e.stopPropagation()}>
                                    <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isExpanded ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                        <span className="text-[10px] font-black">{gIdx + 1}</span>
                                    </div>
                                    <input
                                        value={group.name}
                                        onChange={e => {
                                            const updated = [...(localItem.modifiers || [])];
                                            updated[gIdx].name = e.target.value;
                                            setLocalItem({ ...localItem, modifiers: updated });
                                        }}
                                        onClick={e => e.stopPropagation()}
                                        placeholder="שם הקבוצה (למשל: בחירת רוטב)"
                                        className="w-full bg-transparent font-black text-slate-800 text-sm md:text-base outline-none focus:text-indigo-600 transition-colors placeholder:text-slate-300 placeholder:font-normal"
                                    />
                                    {isMilkGroup(group.name) && <span className="text-[9px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-black mr-2 whitespace-nowrap">נעוץ למעלה</span>}
                                    {isBottomGroup(group.name) && <span className="text-[9px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-black mr-2 whitespace-nowrap">נעוץ למטה</span>}
                                </div>

                                <div className="flex items-center gap-1 md:gap-2" onClick={e => e.stopPropagation()}>
                                    {(!isMilkGroup(group.name) && !isBottomGroup(group.name)) && (
                                        <div className="flex items-center gap-1 border-l border-slate-100 pl-1 md:pl-2 ml-1 md:ml-2">
                                            <button
                                                onClick={() => moveGroup(gIdx, 'up')}
                                                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                                title="הזז למעלה"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6" /></svg>
                                            </button>
                                            <button
                                                onClick={() => moveGroup(gIdx, 'down')}
                                                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                                title="הזז למטה"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                                            </button>
                                        </div>
                                    )}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const updated = (localItem.modifiers || []).filter((_, i) => i !== gIdx);
                                            setLocalItem({ ...localItem, modifiers: updated });
                                        }}
                                        className="w-10 h-10 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                        title="מחק קבוצה"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                    <div
                                        onClick={() => toggleGroup(gIdx)}
                                        className={`w-10 h-10 flex items-center justify-center transition-transform duration-300 cursor-pointer ${isExpanded ? 'rotate-180 text-indigo-600' : 'text-slate-400'}`}
                                    >
                                        <ChevronDown size={20} />
                                    </div>
                                </div>
                            </div>

                            {/* Group Content (Expandable) */}
                            {isExpanded && (
                                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                    {/* Group Logic / Settings */}
                                    <div className="px-4 py-5 bg-slate-50/30 border-b border-slate-100 space-y-4">
                                        <div className="grid grid-cols-2 gap-3 md:gap-6">
                                            {/* Requirement Toggle */}
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap">
                                                    <Star size={10} className="text-amber-500" /> סוג בחירה
                                                </label>
                                                <div className="flex p-1 bg-white border border-slate-200 rounded-xl shadow-sm gap-1">
                                                    <button
                                                        onClick={() => {
                                                            const updated = [...(localItem.modifiers || [])];
                                                            updated[gIdx].requirement = ModifierRequirement.MANDATORY;
                                                            setLocalItem({ ...localItem, modifiers: updated });
                                                        }}
                                                        className={`flex-1 py-2 rounded-lg text-[10px] md:text-xs font-black transition-all ${group.requirement === ModifierRequirement.MANDATORY ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'text-slate-400 hover:text-slate-600'}`}
                                                    >
                                                        חובה
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            const updated = [...(localItem.modifiers || [])];
                                                            updated[gIdx].requirement = ModifierRequirement.OPTIONAL;
                                                            setLocalItem({ ...localItem, modifiers: updated });
                                                        }}
                                                        className={`flex-1 py-2 rounded-lg text-[10px] md:text-xs font-black transition-all ${group.requirement === ModifierRequirement.OPTIONAL ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'text-slate-400 hover:text-slate-600'}`}
                                                    >
                                                        רשות
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Logic Toggle */}
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap">
                                                    <HelpCircle size={10} className="text-indigo-400" /> לוגיקה
                                                </label>
                                                <div className="flex p-1 bg-white border border-slate-200 rounded-xl shadow-sm gap-1">
                                                    <button
                                                        onClick={() => {
                                                            const updated = [...(localItem.modifiers || [])];
                                                            updated[gIdx].logic = ModifierLogic.ADD;
                                                            setLocalItem({ ...localItem, modifiers: updated });
                                                        }}
                                                        className={`flex-1 py-2 rounded-lg text-[10px] md:text-xs font-black transition-all ${group.logic === ModifierLogic.ADD ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                                                    >
                                                        תוספת
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            const updated = [...(localItem.modifiers || [])];
                                                            updated[gIdx].logic = ModifierLogic.REPLACE;
                                                            setLocalItem({ ...localItem, modifiers: updated });
                                                        }}
                                                        className={`flex-1 py-2 rounded-lg text-[10px] md:text-xs font-black transition-all ${group.logic === ModifierLogic.REPLACE ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                                                    >
                                                        החלפה
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Dynamic Explanation Text */}
                                        <div className="bg-indigo-50/50 rounded-xl p-3 border border-indigo-100/50">
                                            <p className="text-[11px] leading-relaxed text-indigo-900/80 font-medium">
                                                <span className="font-black text-indigo-600">משמעות: </span>
                                                {group.requirement === ModifierRequirement.MANDATORY
                                                    ? 'הקופאי חייב לבחור אופציה כדי להמשיך. '
                                                    : 'הקופאי יכול לדלג על הבחירה הזו. '}
                                                {group.logic === ModifierLogic.ADD
                                                    ? 'האופציות יתווספו למנה ולמלאי כשורה נפרדת.'
                                                    : 'האופציה תחליף רכיב בסיס ותעדכן את מלאי הרכיב המקורי.'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Options List */}
                                    <div className="p-4 md:p-6 space-y-3">
                                        {(group.items || []).map((opt, oIdx) => (
                                            <div key={oIdx} className="flex items-center gap-2 md:gap-4 animate-in slide-in-from-right-2 duration-300">
                                                {/* Actions Column */}
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <button
                                                        onClick={() => {
                                                            const updated = [...(localItem.modifiers || [])];
                                                            updated[gIdx].items = updated[gIdx].items.filter((_, i) => i !== oIdx);
                                                            setLocalItem({ ...localItem, modifiers: updated });
                                                        }}
                                                        className="w-10 h-10 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>

                                                    <button
                                                        onClick={() => {
                                                            const updated = [...(localItem.modifiers || [])];
                                                            updated[gIdx].items[oIdx].isDefault = !updated[gIdx].items[oIdx].isDefault;
                                                            setLocalItem({ ...localItem, modifiers: updated });
                                                        }}
                                                        className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${opt.isDefault ? 'bg-amber-100 text-amber-500 shadow-sm' : 'text-slate-200 hover:text-amber-400 hover:bg-amber-50'}`}
                                                        title="הגדר כברירת מחדל"
                                                    >
                                                        <Star size={18} fill={opt.isDefault ? "currentColor" : "none"} />
                                                    </button>
                                                </div>

                                                <div className="flex-1 flex items-center gap-2 md:gap-4 shrink-0">
                                                    <input
                                                        value={opt.name}
                                                        onChange={e => {
                                                            const updated = [...(localItem.modifiers || [])];
                                                            updated[gIdx].items[oIdx].name = e.target.value;
                                                            setLocalItem({ ...localItem, modifiers: updated });
                                                        }}
                                                        placeholder="שם האופציה (לדוגמה: עם סוכר)"
                                                        className="flex-1 min-w-0 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-black text-slate-800 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100 placeholder:font-normal placeholder:text-slate-300 shadow-sm"
                                                    />

                                                    {/* Price Stepper - Integrated in row */}
                                                    <div className="flex items-center h-12 shrink-0 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm" dir="ltr">
                                                        <button
                                                            onClick={() => {
                                                                const updated = [...(localItem.modifiers || [])];
                                                                const currentPrice = updated[gIdx].items[oIdx].price || 0;
                                                                updated[gIdx].items[oIdx].price = Math.max(0, currentPrice - 1);
                                                                setLocalItem({ ...localItem, modifiers: updated });
                                                            }}
                                                            className="w-10 h-full bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition-colors font-black text-lg border-r border-slate-100"
                                                        >
                                                            -
                                                        </button>
                                                        <div className="px-3 min-w-[4rem] text-center font-black">
                                                            <span className="text-xs text-slate-300 mr-1 font-mono">₪</span>
                                                            <input
                                                                type="number"
                                                                value={opt.price}
                                                                onChange={e => {
                                                                    const updated = [...(localItem.modifiers || [])];
                                                                    updated[gIdx].items[oIdx].price = parseFloat(e.target.value) || 0;
                                                                    setLocalItem({ ...localItem, modifiers: updated });
                                                                }}
                                                                className="w-10 bg-transparent p-0 text-center text-sm font-black text-slate-800 outline-none"
                                                            />
                                                        </div>
                                                        <button
                                                            onClick={() => {
                                                                const updated = [...(localItem.modifiers || [])];
                                                                const currentPrice = updated[gIdx].items[oIdx].price || 0;
                                                                updated[gIdx].items[oIdx].price = currentPrice + 1;
                                                                setLocalItem({ ...localItem, modifiers: updated });
                                                            }}
                                                            className="w-10 h-full bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition-colors font-black text-lg border-l border-slate-100"
                                                        >
                                                            +
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}

                                        <button
                                            onClick={() => {
                                                const updated = [...(localItem.modifiers || [])];
                                                if (!updated[gIdx].items) updated[gIdx].items = [];
                                                updated[gIdx].items.push({ name: '', price: 0 });
                                                setLocalItem({ ...localItem, modifiers: updated });
                                            }}
                                            className="w-full py-4 mt-4 bg-indigo-50/50 border border-dashed border-indigo-200 rounded-2xl text-xs font-black text-indigo-600 hover:bg-indigo-50 transition-all uppercase flex items-center justify-center gap-2 group"
                                        >
                                            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                                                <Plus size={16} />
                                            </div>
                                            הוסף אופציה לרשימה
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}

                {localItem.modifiers?.length === 0 && (
                    <div className="py-20 text-center space-y-4 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm">
                            <Plus size={24} className="text-slate-300" />
                        </div>
                        <p className="font-black text-slate-400 tracking-tight text-lg">אין תוספות עדיין</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TabModifiers;
