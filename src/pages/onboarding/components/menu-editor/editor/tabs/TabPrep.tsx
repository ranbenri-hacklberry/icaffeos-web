import React, { useEffect } from 'react';
import { Settings, ClipboardCheck, ChefHat, Wine, Sunrise, Utensils, Sunset, Plus, Minus } from 'lucide-react';
import { OnboardingItem } from '@/pages/onboarding/types/onboardingTypes';

interface TabPrepProps {
    localItem: OnboardingItem;
    setLocalItem: React.Dispatch<React.SetStateAction<OnboardingItem>>;
}

const TabPrep = ({ localItem, setLocalItem }: TabPrepProps) => {

    // Auto-assign KDS based on Category (Legacy logic migrated)
    useEffect(() => {
        const currentKDS = localItem.displayKDS || ['Checker'];
        const isDefaultState = currentKDS.length <= 1 && (currentKDS.length === 0 || currentKDS[0] === 'Checker');

        if (isDefaultState && localItem.category) {
            const cat = localItem.category.toLowerCase();
            const isDrink = ['drink', 'beverage', 'alcohol', 'beer', 'wine', 'cocktail', 'שתיה', 'אלכוהול', 'בירה', 'יין', 'בר', 'קלה', 'חמה'].some(k => cat.includes(k));
            const isKitchenFood = ['food', 'kitchen', 'eat', 'dish', 'אוכל', 'מטבח', 'ראשונות', 'עיקריות', 'קינוחים', 'סלטים', 'מאפים', 'כריכים'].some(k => cat.includes(k));

            let newKDS = [...currentKDS];
            if (newKDS.length === 0) newKDS.push('Checker');

            let changed = false;

            if (isKitchenFood && !newKDS.includes('Kitchen')) {
                newKDS.push('Kitchen');
                changed = true;
            } else if (isDrink && !newKDS.includes('Bar')) {
                newKDS.push('Bar');
                changed = true;
            }

            if (changed) {
                setLocalItem(prev => ({
                    ...prev,
                    displayKDS: newKDS,
                    productionArea: newKDS.find(k => k !== 'Checker') || 'Checker'
                }));
            }
        }
    }, [localItem.category]);

    return (
        <div className="space-y-4 h-full flex flex-col overflow-y-auto custom-scrollbar p-1" dir="rtl">

            {/* 1. Production Settings (KDS & Mode) */}
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-4 flex-none">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Settings size={12} /> הגדרות ייצור
                </label>

                <div className="space-y-4">
                    {/* KDS Selection */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] font-bold text-slate-400">אזור הכנה (KDS)</label>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { id: 'Checker', label: 'צ\'קר', icon: <ClipboardCheck size={14} /> },
                                { id: 'Kitchen', label: 'מטבח', icon: <ChefHat size={14} /> },
                                { id: 'Bar', label: 'בר', icon: <Wine size={14} /> }
                            ].map(area => {
                                // Fallback parsing if backend returned csv string but local hasn't parsed it yet
                                const storedKds = Array.isArray(localItem.displayKDS) 
                                    ? localItem.displayKDS 
                                    : (localItem.productionArea ? localItem.productionArea.split(',').map(s => s.trim()) : ['Checker']);
                                
                                const isSelected = storedKds.includes(area.id) || area.id === 'Checker';
                                return (
                                    <button
                                        key={area.id}
                                        onClick={() => {
                                            if (area.id === 'Checker') return; // Cannot toggle off Checker
                                            
                                            const current = localItem.displayKDS || [localItem.productionArea || 'Checker'];
                                            let updated;
                                            if (current.includes(area.id)) {
                                                updated = current.filter(id => id !== area.id);
                                            } else {
                                                updated = [...current, area.id];
                                            }
                                            
                                            // Enforce Checker is always present
                                            updated = Array.from(new Set([...updated, 'Checker']));
                                            
                                            setLocalItem({
                                                ...localItem,
                                                displayKDS: updated,
                                                productionArea: updated.join(',')
                                            });
                                        }}
                                        className={`flex flex-col items-center justify-center gap-1 p-3 rounded-xl border transition-all ${isSelected
                                            ? 'bg-indigo-50 border-indigo-200 text-indigo-600 shadow-sm'
                                            : 'bg-slate-50 border-slate-100 text-slate-400'
                                            }`}
                                    >
                                        {area.icon}
                                        <span className="text-[10px] font-black">{area.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Prep Mode & Auto-mask Toggle */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 mr-1">מצב הכנה</label>
                            <select
                                value={localItem.preparationMode || 'ready'}
                                onChange={e => setLocalItem({ ...localItem, preparationMode: e.target.value as any })}
                                className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-black text-indigo-600 outline-none"
                            >
                                <option value="ready">מוכן להגשה (Ready)</option>
                                <option value="requires_prep">דורש הכנה (Requires Prep)</option>
                                <option value="cashier_choice">בחירת קופאי</option>
                            </select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 mr-1 whitespace-nowrap">מלאי 0 = הסתרה מהקופה</label>
                            <div className="flex items-center justify-between p-2 h-10 bg-slate-50 border border-slate-100 rounded-xl px-3">
                                <span className={`text-[10px] font-black ${(localItem.inventorySettings?.hideOnZeroStock ?? true) ? 'text-indigo-600' : 'text-slate-400'}`}>
                                    {(localItem.inventorySettings?.hideOnZeroStock ?? true) ? 'פעיל' : 'כבוי'}
                                </span>
                                <label className="relative inline-flex items-center cursor-pointer scale-90 origin-right">
                                    <input
                                        type="checkbox"
                                        checked={localItem.inventorySettings?.hideOnZeroStock ?? true}
                                        onChange={e => {
                                            const checked = e.target.checked;
                                            setLocalItem(prev => ({
                                                ...prev,
                                                inventorySettings: {
                                                    isPreparedItem: prev.inventorySettings?.isPreparedItem || false,
                                                    prepType: prev.inventorySettings?.prepType || 'production',
                                                    dailyPars: prev.inventorySettings?.dailyPars || { sunday: 0, monday: 0, tuesday: 0, wednesday: 0, thursday: 0, friday: 0, saturday: 0 },
                                                    ...prev.inventorySettings,
                                                    hideOnZeroStock: checked
                                                }
                                            }));
                                        }}
                                        className="sr-only peer"
                                    />
                                    <div className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:bg-indigo-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. Inventory Logic (Pars) */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex-none">
                <div className="p-5 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                    <div className="space-y-0.5">
                        <h3 className="font-black text-slate-800 text-sm">הכנות ומלאי</h3>
                        <p className="text-[10px] text-slate-400 font-bold">הגדרת מוצרים להכנה מראש (Grab & Go)</p>
                    </div>

                    <div className="bg-white border border-slate-200 p-2 rounded-2xl shadow-sm flex items-center gap-3 pr-4">
                        <span className={`text-[10px] font-black ${(localItem.inventorySettings?.isPreparedItem) ? 'text-indigo-600' : 'text-slate-400'}`}>
                            {localItem.inventorySettings?.isPreparedItem ? 'פעיל' : 'כבוי'}
                        </span>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={localItem.inventorySettings?.isPreparedItem || false}
                                onChange={e => {
                                    const isPrepared = e.target.checked;
                                    setLocalItem(prev => ({
                                        ...prev,
                                        inventorySettings: {
                                            ...(prev.inventorySettings || {}),
                                            isPreparedItem: isPrepared,
                                            prepType: prev.inventorySettings?.prepType || 'production',
                                            dailyPars: prev.inventorySettings?.dailyPars || { sunday: 0, monday: 0, tuesday: 0, wednesday: 0, thursday: 0, friday: 0, saturday: 0 },
                                            parShifts: prev.inventorySettings?.parShifts || {},
                                            // Handle the linked toggle logic:
                                            // 'When turning OFF prep, also stock 0 hide should turn OFF'
                                            hideOnZeroStock: isPrepared ? (prev.inventorySettings?.hideOnZeroStock ?? false) : false
                                        }
                                    }));
                                }}
                                className="sr-only peer"
                            />
                            <div className="w-10 h-6 bg-slate-200 rounded-full peer peer-checked:bg-indigo-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all border border-transparent peer-focus:ring-2 peer-focus:ring-indigo-200"></div>
                        </label>
                    </div>
                </div>

                <div className="p-5">
                    {localItem.inventorySettings?.isPreparedItem ? (
                        <div className="space-y-5">
                            {/* Prep Type */}
                            <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1.5 rounded-[1.25rem]">
                                {(['production', 'completion', 'defrost'] as const).map(type => (
                                    <button
                                        key={type}
                                        onClick={() => setLocalItem(prev => ({ ...prev, inventorySettings: { ...prev.inventorySettings!, prepType: type } }))}
                                        className={`py-2 text-xs font-black rounded-2xl transition-all ${localItem.inventorySettings?.prepType === type ? 'bg-white text-indigo-600 shadow-md scale-[1.02]' : 'text-slate-400 hover:text-slate-600'}`}
                                    >
                                        {type === 'production' ? 'ייצור' : type === 'completion' ? 'השלמה' : 'הפשרה'}
                                    </button>
                                ))}
                            </div>

                            <div className="space-y-3">
                                {/* Shift Header */}
                                <div className="flex justify-between items-center text-[10px] text-slate-400 font-black uppercase tracking-widest px-2 pb-1">
                                    <span className="w-8">יום</span>
                                    <span className="flex-1 text-center mr-8">משמרת משימה</span>
                                    <span className="w-24 text-left pr-4">יעד מלאי</span>
                                </div>

                                {/* Daily Rows */}
                                <div className="space-y-2.5">
                                    {[
                                        { key: 'sunday', label: 'א' }, { key: 'monday', label: 'ב' }, { key: 'tuesday', label: 'ג' },
                                        { key: 'wednesday', label: 'ד' }, { key: 'thursday', label: 'ה' }, { key: 'friday', label: 'ו' }, { key: 'saturday', label: 'ש' }
                                    ].map(day => {
                                        const dayKey = day.key as 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday';
                                        const currentShift = localItem.inventorySettings?.parShifts?.[dayKey] || 'prep';
                                        const val = localItem.inventorySettings?.dailyPars?.[dayKey] || 0;

                                        return (
                                            <div key={day.key} className="flex items-center gap-4 bg-white border border-slate-100 p-2 rounded-2xl shadow-sm hover:border-indigo-100 transition-colors">
                                                <div className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-50 font-black text-slate-500 text-sm shadow-inner uppercase">{day.label}</div>

                                                {/* Shift Toggles */}
                                                <div className="flex flex-1 bg-slate-50 rounded-[1.15rem] p-1 gap-1 justify-center max-w-[220px]">
                                                    {[
                                                        { id: 'opening', icon: <Sunrise size={14} />, label: 'פתיחה' },
                                                        { id: 'prep', icon: <Utensils size={14} />, label: 'הכנות' },
                                                        { id: 'closing', icon: <Sunset size={14} />, label: 'סגירה' }
                                                    ].map(s => (
                                                        <button
                                                            key={s.id}
                                                            onClick={() => setLocalItem(prev => ({
                                                                ...prev,
                                                                inventorySettings: {
                                                                    ...prev.inventorySettings!,
                                                                    parShifts: { ...prev.inventorySettings?.parShifts, [dayKey]: s.id as any }
                                                                }
                                                            }))}
                                                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl transition-all ${currentShift === s.id
                                                                ? 'bg-white text-indigo-600 font-black shadow-sm ring-1 ring-slate-200/50'
                                                                : 'text-slate-400 hover:text-slate-600'
                                                                }`}
                                                            title={s.label}
                                                        >
                                                            {s.icon}
                                                            <span className="text-[10px] font-black">{s.label}</span>
                                                        </button>
                                                    ))}
                                                </div>

                                                {/* Quantity Counter */}
                                                <div className="flex items-center gap-2">
                                                    <button onClick={() => setLocalItem(prev => {
                                                        const pars = prev.inventorySettings?.dailyPars || { sunday: 0, monday: 0, tuesday: 0, wednesday: 0, thursday: 0, friday: 0, saturday: 0 } as any;
                                                        return {
                                                            ...prev,
                                                            inventorySettings: {
                                                                ...(prev.inventorySettings || {}),
                                                                dailyPars: { ...pars, [dayKey]: (val || 0) + 1 },
                                                                parShifts: prev.inventorySettings?.parShifts
                                                            }
                                                        } as any;
                                                    })} className="w-8 h-8 flex items-center justify-center bg-white rounded-lg border border-slate-200 text-slate-400 hover:text-indigo-600 transition-all active:scale-95 shadow-sm">
                                                        <Plus size={14} />
                                                    </button>

                                                    <div className="w-8 text-center font-black text-slate-800 text-sm">{val}</div>

                                                    <button onClick={() => setLocalItem(prev => {
                                                        const pars = prev.inventorySettings?.dailyPars || { sunday: 0, monday: 0, tuesday: 0, wednesday: 0, thursday: 0, friday: 0, saturday: 0 } as any;
                                                        return {
                                                            ...prev,
                                                            inventorySettings: {
                                                                ...(prev.inventorySettings || {}),
                                                                dailyPars: { ...pars, [dayKey]: Math.max(0, val - 1) },
                                                                parShifts: prev.inventorySettings?.parShifts
                                                            }
                                                        } as any;
                                                    })} className="w-8 h-8 flex items-center justify-center bg-white rounded-lg border border-slate-200 text-slate-400 hover:text-indigo-600 transition-all active:scale-95 shadow-sm">
                                                        <Minus size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-10 opacity-40">
                            <Settings size={32} className="text-slate-300 mb-2" />
                            <p className="text-xs font-bold text-slate-400">הפעל הכנות ומלאי כדי להגדיר יעדים יומיים</p>
                        </div>
                    )}
                </div>
            </div>

        </div>
    );
};

export default TabPrep;
