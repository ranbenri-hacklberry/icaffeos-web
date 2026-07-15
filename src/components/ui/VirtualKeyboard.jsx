import React, { useState, useCallback } from 'react';
import { X, Delete, ArrowBigUp, CornerDownLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * VirtualKeyboard - iCaffe Branded On-Screen Keyboard
 * Designed for touch devices without physical keyboards (e.g., N150)
 * 
 * Props:
 * - isOpen: boolean - controls visibility
 * - onClose: () => void - called when user presses X
 * - onInput: (char: string) => void - called when a key is pressed
 * - onBackspace: () => void - called when backspace is pressed
 * - onEnter: () => void - called when Enter is pressed
 * - activeField: 'email' | 'password' | null - which field is active (for UI hints)
 */
const VirtualKeyboard = ({ isOpen, onClose, onInput, onBackspace, onEnter, activeField }) => {
    const [isShift, setIsShift] = useState(false);
    const [isSymbols, setIsSymbols] = useState(false);

    // Layout: Standard QWERTY + Numbers + Symbols
    const letterRows = [
        ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
        ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
        ['z', 'x', 'c', 'v', 'b', 'n', 'm']
    ];

    const numberRow = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

    const symbolRows = [
        ['!', '@', '#', '$', '%', '^', '&', '*', '(', ')'],
        ['-', '_', '=', '+', '[', ']', '{', '}', '\\', '|'],
        [';', ':', "'", '"', ',', '.', '<', '>', '/', '?']
    ];

    const handleKeyPress = useCallback((key) => {
        const char = isShift ? key.toUpperCase() : key;
        onInput(char);
        // Auto-disable shift after one character
        if (isShift && !isSymbols) {
            setIsShift(false);
        }
    }, [isShift, isSymbols, onInput]);

    const handleSpace = useCallback(() => {
        onInput(' ');
    }, [onInput]);

    const toggleShift = () => setIsShift(!isShift);
    const toggleSymbols = () => {
        setIsSymbols(!isSymbols);
        setIsShift(false);
    };

    const renderKey = (key, width = 'w-10') => {
        const displayChar = isShift && !isSymbols ? key.toUpperCase() : key;
        return (
            <button
                key={key}
                type="button"
                onClick={() => handleKeyPress(key)}
                className={`${width} h-12 sm:h-14 bg-slate-700 hover:bg-slate-600 active:bg-slate-500 
                    text-white text-lg sm:text-xl font-bold rounded-lg transition-all 
                    shadow-md active:scale-95 flex items-center justify-center`}
            >
                {displayChar}
            </button>
        );
    };

    const renderSpecialKey = (icon, action, label, bgColor = 'bg-slate-600', width = 'w-14') => (
        <button
            type="button"
            onClick={action}
            className={`${width} h-12 sm:h-14 ${bgColor} hover:opacity-90 active:opacity-75 
                text-white text-sm font-bold rounded-lg transition-all 
                shadow-md active:scale-95 flex items-center justify-center gap-1`}
        >
            {icon}
            {label && <span className="hidden sm:inline text-xs">{label}</span>}
        </button>
    );

    const rows = isSymbols ? symbolRows : letterRows;

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ y: '100%', opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: '100%', opacity: 0 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    className="fixed bottom-0 left-0 right-0 z-[9999] bg-slate-800 border-t-2 border-slate-600 
                        shadow-2xl rounded-t-3xl p-3 sm:p-4"
                    dir="ltr"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between mb-3 px-2">
                        <div className="flex items-center gap-2">
                            <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">
                                {activeField === 'email' ? '📧 Email' : activeField === 'password' ? '🔒 Password' : 'Virtual Keyboard'}
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-10 h-10 bg-red-500/80 hover:bg-red-500 text-white rounded-full 
                                flex items-center justify-center transition-colors"
                        >
                            <X size={20} strokeWidth={3} />
                        </button>
                    </div>

                    {/* Number Row */}
                    <div className="flex justify-center gap-1 sm:gap-1.5 mb-1.5">
                        {numberRow.map(key => renderKey(key, 'w-8 sm:w-10'))}
                    </div>

                    {/* Letter/Symbol Rows */}
                    {rows.map((row, rowIndex) => (
                        <div key={rowIndex} className="flex justify-center gap-1 sm:gap-1.5 mb-1.5">
                            {/* Shift on first row of letters */}
                            {rowIndex === 2 && !isSymbols && (
                                renderSpecialKey(
                                    <ArrowBigUp size={20} className={isShift ? 'fill-white' : ''} />,
                                    toggleShift,
                                    null,
                                    isShift ? 'bg-blue-600' : 'bg-slate-600',
                                    'w-12 sm:w-14'
                                )
                            )}
                            {row.map(key => renderKey(key, 'w-8 sm:w-10'))}
                            {/* Backspace on last row */}
                            {rowIndex === 2 && (
                                renderSpecialKey(
                                    <Delete size={20} />,
                                    onBackspace,
                                    null,
                                    'bg-slate-600',
                                    'w-12 sm:w-14'
                                )
                            )}
                        </div>
                    ))}

                    {/* Bottom Row: Symbols, Space, Special chars, Enter */}
                    <div className="flex justify-center gap-1 sm:gap-1.5 mt-1">
                        {/* Symbols Toggle */}
                        <button
                            type="button"
                            onClick={toggleSymbols}
                            className={`w-16 sm:w-20 h-12 sm:h-14 ${isSymbols ? 'bg-blue-600' : 'bg-slate-600'} 
                                hover:opacity-90 text-white text-sm font-bold rounded-lg transition-all 
                                shadow-md flex items-center justify-center`}
                        >
                            {isSymbols ? 'ABC' : '?123'}
                        </button>

                        {/* @ Symbol */}
                        <button
                            type="button"
                            onClick={() => onInput('@')}
                            className="w-10 sm:w-12 h-12 sm:h-14 bg-slate-700 hover:bg-slate-600 
                                text-white text-xl font-bold rounded-lg transition-all shadow-md 
                                flex items-center justify-center"
                        >
                            @
                        </button>

                        {/* Space Bar */}
                        <button
                            type="button"
                            onClick={handleSpace}
                            className="flex-1 max-w-[200px] sm:max-w-[280px] h-12 sm:h-14 bg-slate-700 hover:bg-slate-600 
                                text-white text-sm font-bold rounded-lg transition-all shadow-md 
                                flex items-center justify-center"
                        >
                            space
                        </button>

                        {/* . (dot) */}
                        <button
                            type="button"
                            onClick={() => onInput('.')}
                            className="w-10 sm:w-12 h-12 sm:h-14 bg-slate-700 hover:bg-slate-600 
                                text-white text-xl font-bold rounded-lg transition-all shadow-md 
                                flex items-center justify-center"
                        >
                            .
                        </button>

                        {/* Enter */}
                        <button
                            type="button"
                            onClick={onEnter}
                            className="w-16 sm:w-20 h-12 sm:h-14 bg-blue-600 hover:bg-blue-500 
                                text-white text-sm font-bold rounded-lg transition-all shadow-md 
                                flex items-center justify-center gap-1"
                        >
                            <CornerDownLeft size={18} />
                            <span className="hidden sm:inline">Go</span>
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default VirtualKeyboard;
