import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';

/**
 * MTOQuickNotesModal Component
 * For MADE_TO_ORDER items (like sandwiches) - quick notes only
 * 
 * @param {Object} selectedItem - The menu item being added
 * @param {Function} onSubmitNotes - Callback with (notes)
 * @param {Function} onClose - Close modal callback
 */
const MTOQuickNotesModal = ({ selectedItem, onSubmitNotes, onClose }) => {
    const { isDarkMode } = useTheme();
    const [notes, setNotes] = useState('');
    const textareaRef = useRef(null);

    // Auto-focus on mount
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.focus();
        }
    }, []);

    const handleNotesChange = (e) => {
        const text = e.target.value;
        const words = text.trim().split(/\s+/).filter(w => w.length > 0);

        // Limit to 7 words
        if (words.length <= 7) {
            setNotes(text);
        }
    };

    const handleSubmit = () => {
        // Send as modifier
        const mods = notes.trim() ? { custom_note: notes.trim() } : {};
        onSubmitNotes(mods);
    };

    const handleKeyDown = (e) => {
        // Submit on Ctrl+Enter or Cmd+Enter
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            handleSubmit();
        }
    };

    const wordCount = notes.trim().split(/\s+/).filter(w => w.length > 0).length;

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
                        <div className="absolute -right-10 -top-10 w-40 h-40 bg-blue-500 rounded-full blur-3xl" />
                        <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-indigo-500 rounded-full blur-3xl" />
                    </div>

                    <div className="relative z-10 w-full">
                        <div className="flex items-center justify-between mb-1">
                            <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-white/80 text-xs font-medium backdrop-blur-md border border-white/10">
                                כריכים
                            </span>
                            <button
                                onClick={onClose}
                                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/80 hover:bg-white/20 transition-colors"
                            >
                                <MessageSquare size={16} className="rotate-0" />
                            </button>
                        </div>
                        <h2 className="text-2xl font-black text-white tracking-tight">{selectedItem?.name}</h2>
                        <p className="text-white/60 text-sm font-medium">הערות להכנה</p>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    <div>
                        <label className={`block text-sm font-bold mb-2 px-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                            הערה מותאמת (עד 7 מילים)
                        </label>
                        <div className={`relative rounded-xl border transition-all duration-200
              ${notes.trim().length > 0
                                ? 'border-blue-500 ring-1 ring-blue-500'
                                : (isDarkMode ? 'bg-slate-800 border-slate-700 hover:border-slate-600' : 'bg-white border-slate-200 hover:border-slate-300')
                            }`}>
                            <textarea
                                ref={textareaRef}
                                value={notes}
                                onChange={handleNotesChange}
                                onKeyDown={handleKeyDown}
                                placeholder="לדוגמה: בלי חסה תוספת עגבניות ללא בצל"
                                rows={4}
                                className={`w-full px-4 py-3 bg-transparent rounded-xl focus:outline-none resize-none text-base placeholder:text-slate-400 ${isDarkMode ? 'text-white' : 'text-slate-900'
                                    }`}
                            />
                            <div className="absolute bottom-2 left-2 text-[10px] font-medium text-slate-400">
                                {wordCount}/7 מילים
                            </div>
                        </div>
                        <div className="flex justify-between items-center mt-2 px-1">
                            <div className="flex gap-2 items-center">
                                {notes.trim() && (
                                    <div className="text-xs text-blue-600 font-medium">
                                        * יוצג כמוד
                                    </div>
                                )}
                            </div>
                            <div className="text-xs text-slate-400 font-medium">
                                Ctrl+Enter לאישור
                            </div>
                        </div>
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
                            className={`flex-1 h-12 rounded-2xl flex items-center justify-center px-6 text-base font-bold transition-colors active:scale-98 shadow-xl ${isDarkMode ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-900/20' : 'bg-slate-900 hover:bg-black text-white shadow-slate-300/50'
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

export default MTOQuickNotesModal;
