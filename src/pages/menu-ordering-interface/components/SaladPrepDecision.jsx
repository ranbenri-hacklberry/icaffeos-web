import React, { useState } from 'react';
import { Check, ChefHat, ShoppingBag } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';

/**
 * SaladPrepDecision Component
 * For CONDITIONAL items (like salads) - allows cashier to decide if prep is needed
 * 
 * @param {Object} selectedItem - The menu item being added
 * @param {Function} onSubmitSelection - Callback with (mods, notes)
 * @param {Function} onClose - Close modal callback
 */
const SaladPrepDecision = ({ selectedItem, onSubmitSelection, onClose }) => {
    const { isDarkMode } = useTheme();
    const [prepMode, setPrepMode] = useState('ready'); // 'ready' or 'prep'
    const [customNotes, setCustomNotes] = useState('');

    const handleNotesChange = (e) => {
        const text = e.target.value;
        const words = text.trim().split(/\s+/).filter(w => w.length > 0);

        // Limit to 7 words
        if (words.length <= 7) {
            setCustomNotes(text);
        }
    };

    const handleSubmit = () => {
        const mods = prepMode === 'prep' ? { kds_override: true } : {};

        // Add custom note as a modifier if provided
        if (customNotes.trim()) {
            mods.custom_note = customNotes.trim();
        }

        onSubmitSelection(mods);
    };

    const wordCount = customNotes.trim().split(/\s+/).filter(w => w.length > 0).length;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
            <div
                className={`w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200 transition-colors duration-300 ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-[#FAFAFA]'
                    }`}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className={`relative h-32 flex items-end p-6 overflow-hidden shrink-0 transition-colors duration-300 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-900'}`}>
                    <div className="absolute inset-0 opacity-20">
                        <div className="absolute -right-10 -top-10 w-40 h-40 bg-green-500 rounded-full blur-3xl" />
                        <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-blue-500 rounded-full blur-3xl" />
                    </div>

                    <div className="relative z-10 w-full">
                        <div className="flex items-center justify-between mb-1">
                            <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-white/80 text-xs font-medium backdrop-blur-md border border-white/10">
                                סלטים
                            </span>
                            <button
                                onClick={onClose}
                                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/80 hover:bg-white/20 transition-colors"
                            >
                                <Check size={16} className="rotate-45" />
                            </button>
                        </div>
                        <h2 className="text-2xl font-black text-white tracking-tight">{selectedItem?.name}</h2>
                        {selectedItem.current_stock !== undefined && selectedItem.current_stock !== null && (
                            <p className="text-emerald-400 text-sm font-black mt-0.5">
                                במלאי: {selectedItem.current_stock}
                            </p>
                        )}
                        <p className="text-white/60 text-sm font-medium">איך להגיש?</p>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {/* Prep Mode Selection */}
                    <div className="grid grid-cols-2 gap-3">
                        {/* Ready (Default) */}
                        <button
                            onClick={() => setPrepMode('ready')}
                            className={`
                relative flex flex-col items-center justify-center gap-3 py-6 px-4 rounded-2xl
                font-bold transition-all duration-200 border touch-manipulation active:scale-95
                ${prepMode === 'ready'
                                    ? (isDarkMode ? 'bg-green-900/30 border-green-500 ring-1 ring-green-500 shadow-lg shadow-green-900/20' : 'bg-green-50 border-green-500 ring-1 ring-green-500 shadow-lg shadow-green-100')
                                    : (isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700' : 'bg-white border-slate-100 shadow-sm hover:shadow-md hover:bg-slate-50')
                                }
              `}
                        >
                            <ShoppingBag size={32} className={prepMode === 'ready' ? 'text-green-600' : 'text-slate-400'} />
                            <div className="text-center">
                                <div className={`text-base ${prepMode === 'ready' ? (isDarkMode ? 'text-green-400' : 'text-green-700') : (isDarkMode ? 'text-slate-400' : 'text-slate-600')}`}>
                                    קיבל מוכן
                                </div>
                                <div className="text-xs text-slate-400 mt-1">מהמדף</div>
                                {selectedItem.current_stock !== undefined && selectedItem.current_stock !== null && (
                                    <div className={`text-xs font-black mt-1 ${selectedItem.current_stock > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                        {selectedItem.current_stock > 0 ? `במלאי: ${selectedItem.current_stock}` : 'חסר במלאי'}
                                    </div>
                                )}
                            </div>
                            {prepMode === 'ready' && (
                                <div className="absolute top-3 right-3 bg-green-500 rounded-full p-1">
                                    <Check size={14} className="text-white" />
                                </div>
                            )}
                        </button>

                        {/* Prep Required */}
                        <button
                            onClick={() => setPrepMode('prep')}
                            className={`
                relative flex flex-col items-center justify-center gap-3 py-6 px-4 rounded-2xl
                font-bold transition-all duration-200 border touch-manipulation active:scale-95
                ${prepMode === 'prep'
                                    ? (isDarkMode ? 'bg-orange-900/30 border-orange-500 ring-1 ring-orange-500 shadow-lg shadow-orange-900/20' : 'bg-orange-50 border-orange-500 ring-1 ring-orange-500 shadow-lg shadow-orange-100')
                                    : (isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700' : 'bg-white border-slate-100 shadow-sm hover:shadow-md hover:bg-slate-50')
                                }
              `}
                        >
                            <ChefHat size={32} className={prepMode === 'prep' ? 'text-orange-600' : 'text-slate-400'} />
                            <div className="text-center">
                                <div className={`text-base ${prepMode === 'prep' ? (isDarkMode ? 'text-orange-400' : 'text-orange-700') : (isDarkMode ? 'text-slate-400' : 'text-slate-600')}`}>
                                    דורש הכנה
                                </div>
                                <div className="text-xs text-slate-400 mt-1">הכן עכשיו</div>
                            </div>
                            {prepMode === 'prep' && (
                                <div className="absolute top-3 right-3 bg-orange-500 rounded-full p-1">
                                    <Check size={14} className="text-white" />
                                </div>
                            )}
                        </button>
                    </div>

                    {/* Custom Notes as Modifier */}
                    <div>
                        <label className={`block text-sm font-bold mb-2 px-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                            הערה מותאמת (עד 7 מילים)
                        </label>
                        <div className={`relative rounded-xl border transition-all duration-200
              ${customNotes.trim().length > 0
                                ? 'border-orange-500 ring-1 ring-orange-500'
                                : (isDarkMode ? 'bg-slate-800 border-slate-700 hover:border-slate-600' : 'bg-white border-slate-200 hover:border-slate-300')
                            }`}>
                            <textarea
                                value={customNotes}
                                onChange={handleNotesChange}
                                placeholder="לדוגמה: בלי עגבניות תוספת זיתים"
                                rows={2}
                                className={`w-full px-4 py-3 bg-transparent rounded-xl focus:outline-none resize-none text-sm placeholder:text-slate-400 ${isDarkMode ? 'text-white' : 'text-slate-900'
                                    }`}
                            />
                            <div className="absolute bottom-2 left-2 text-[10px] font-medium text-slate-400">
                                {wordCount}/7 מילים
                            </div>
                        </div>
                        {customNotes.trim() && (
                            <div className="text-xs text-blue-600 mt-2 px-1 font-medium">
                                * יוצג כמוד בקופה ובKDS
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className={`p-3 border-t transition-colors duration-300 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-[0_-10px_30px_rgba(0,0,0,0.03)]'}`}>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className={`w-1/3 h-12 rounded-2xl font-bold transition-colors active:scale-95 ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                                }`}
                        >
                            ביטול
                        </button>
                        <button
                            onClick={handleSubmit}
                            className={`flex-1 h-12 rounded-2xl flex items-center justify-center px-6 text-base font-bold transition-colors active:scale-98 shadow-xl ${isDarkMode ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-orange-900/20' : 'bg-slate-900 hover:bg-black text-white shadow-slate-300/50'
                                }`}
                        >
                            <span>אישור והוספה</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
export default SaladPrepDecision;
