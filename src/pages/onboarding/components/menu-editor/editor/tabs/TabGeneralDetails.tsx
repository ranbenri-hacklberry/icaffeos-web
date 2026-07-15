import React, { useMemo } from 'react';
import { Wand2 } from 'lucide-react';
import { OnboardingItem } from '@/pages/onboarding/types/onboardingTypes';

interface TabGeneralDetailsProps {
    localItem: OnboardingItem;
    setLocalItem: React.Dispatch<React.SetStateAction<OnboardingItem>>;
    allItems: OnboardingItem[];
    showSaleDates: boolean;
    setShowSaleDates: (val: boolean) => void;
}

const TabGeneralDetails = ({
    localItem,
    setLocalItem,
    allItems,
    showSaleDates,
    setShowSaleDates
}: TabGeneralDetailsProps) => {
    const categorySuggestions = useMemo(() => Array.from(new Set(allItems.map(i => i.category))), [allItems]);

    return (
        <div className="max-w-3xl mx-auto space-y-6" dir="rtl">
            {/* Row 1: Item Names */}
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 relative group">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">שם המנה (עברית)</label>
                    <input
                        value={localItem.name}
                        onChange={e => setLocalItem({ ...localItem, name: e.target.value })}
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 transition-all outline-none"
                    />
                </div>
                <div className="space-y-1.5 relative group">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">שם המנה (English)</label>
                    <input
                        value={localItem.englishName || ''}
                        onChange={e => setLocalItem({ ...localItem, englishName: e.target.value })}
                        dir="ltr"
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 transition-all outline-none text-left"
                        placeholder="Auto-filled by AI..."
                    />
                </div>
            </div>

            {/* Row 2: Category + Description */}
            <div className="flex gap-4 items-start">
                <div className="w-1/3 space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">קטגוריה</label>
                    <select
                        value={localItem.category}
                        onChange={e => setLocalItem({ ...localItem, category: e.target.value })}
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-indigo-600 outline-none focus:border-indigo-500 transition-all appearance-none"
                    >
                        {categorySuggestions.map((c: string) => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <div className="flex-1 space-y-1.5 relative group">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">תיאור המנה</label>
                    <textarea
                        value={localItem.description}
                        onChange={e => setLocalItem({ ...localItem, description: e.target.value })}
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-medium text-slate-600 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 transition-all outline-none resize-y min-h-[42px] h-[42px]"
                    />
                </div>
            </div>

            {/* Row 3: Prices */}
            <div className="grid grid-cols-2 gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">מחיר מכירה</label>
                    <div className="flex items-center h-10 bg-slate-50 rounded-lg border border-slate-200 overflow-hidden" dir="ltr">
                        <button onClick={() => setLocalItem((p: OnboardingItem) => ({ ...p, price: Math.max(0, (p.price || 0) + 1) }))} className="w-10 h-full bg-white text-slate-600 hover:bg-slate-100 transition-all font-black text-lg">+</button>
                        <div className="flex-1 flex items-center justify-center gap-1">
                            <span className="text-slate-400 font-bold text-xs">₪</span>
                            <input type="number" value={localItem.price} onChange={e => setLocalItem({ ...localItem, price: parseFloat(e.target.value) || 0 })} className="w-16 text-center bg-transparent border-none outline-none font-black text-lg text-slate-800" />
                        </div>
                        <button onClick={() => setLocalItem((p: OnboardingItem) => ({ ...p, price: Math.max(0, (p.price || 0) - 1) }))} className="w-10 h-full bg-white text-slate-600 hover:bg-slate-100 transition-all font-black text-lg border-l border-slate-200">-</button>
                    </div>
                </div>

                <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black text-amber-600 uppercase tracking-wider flex items-center gap-1"><Wand2 size={10} /> מחיר מבצע</label>
                        <button onClick={() => setShowSaleDates(!showSaleDates)} className="text-[9px] font-bold text-indigo-500 hover:underline">
                            {showSaleDates ? 'הסתר תוקף' : 'הגדר תוקף'}
                        </button>
                    </div>
                    <div className="flex items-center h-10 bg-amber-50/30 rounded-lg border border-amber-100 overflow-hidden" dir="ltr">
                        <button onClick={() => setLocalItem((p: OnboardingItem) => ({ ...p, salePrice: (p.salePrice || 0) + 1 }))} className="w-10 h-full bg-white/50 text-amber-600 hover:bg-amber-100 transition-all font-black text-lg">+</button>
                        <div className="flex-1 flex items-center justify-center gap-1">
                            <span className="text-amber-400 font-bold text-xs">₪</span>
                            <input type="number" value={localItem.salePrice || 0} onChange={e => setLocalItem({ ...localItem, salePrice: parseFloat(e.target.value) || 0 })} className="w-16 text-center bg-transparent border-none outline-none font-black text-lg text-amber-600" />
                        </div>
                        <button onClick={() => setLocalItem((p: OnboardingItem) => ({ ...p, salePrice: Math.max(0, (p.salePrice || 0) - 1) }))} className="w-10 h-full bg-white/50 text-amber-600 hover:bg-amber-100 transition-all font-black text-lg border-l border-amber-100">-</button>
                    </div>
                </div>

                {showSaleDates && (
                    <div className="col-span-full grid grid-cols-2 gap-4 animate-in slide-in-from-top-2">
                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mr-1">מתאריך</label>
                            <input type="date" value={localItem.saleStartDate || new Date().toISOString().split('T')[0]} onChange={e => setLocalItem({ ...localItem, saleStartDate: e.target.value })} className="w-full p-2 bg-slate-50 border border-slate-100 rounded-lg text-xs font-bold text-slate-600 outline-none" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mr-1">עד תאריך</label>
                            <input type="date" value={localItem.saleEndDate} onChange={e => setLocalItem({ ...localItem, saleEndDate: e.target.value })} className="w-full p-2 bg-slate-50 border border-slate-100 rounded-lg text-xs font-bold text-slate-600 outline-none" />
                        </div>
                    </div>
                )}
            </div>

            {/* Row 4: Visibility & Distribution */}
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                    זמינות והפצה
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
                        <div className="space-y-0.5">
                            <h4 className="font-bold text-slate-700 text-xs">קופה (POS)</h4>
                            <p className="text-[9px] text-slate-400">הצג במסך קופאי</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={localItem.isVisiblePos !== false}
                                onChange={e => setLocalItem({ ...localItem, isVisiblePos: e.target.checked })}
                            />
                            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
                        <div className="space-y-0.5">
                            <h4 className="font-bold text-slate-700 text-xs">אונליין / תפריט</h4>
                            <p className="text-[9px] text-slate-400">הצג באפליקציה/אתר</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={localItem.isVisibleOnline !== false}
                                onChange={e => setLocalItem({ ...localItem, isVisibleOnline: e.target.checked })}
                            />
                            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TabGeneralDetails;
