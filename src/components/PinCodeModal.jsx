/**
 * PinCodeModal - Sudo Mode PIN verification for admin access
 * Allows one-time navigation to admin features without full logout
 * Built-in numeric keypad for iPad/tablet compatibility
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, X, AlertCircle, Shield, Delete } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const PinCodeModal = ({ isOpen, onClose, onSuccess, featureName }) => {
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setPin('');
            setError('');
        }
    }, [isOpen]);

    const handleDigitPress = (digit) => {
        if (isVerifying) return;
        setError('');
        const newPin = pin + digit;
        if (newPin.length <= 4) {
            setPin(newPin);
            // Auto-verify when 4 digits entered
            if (newPin.length === 4) {
                verifyPin(newPin);
            }
        }
    };

    const handleBackspace = () => {
        if (isVerifying) return;
        setPin(prev => prev.slice(0, -1));
        setError('');
    };

    const handleClear = () => {
        if (isVerifying) return;
        setPin('');
        setError('');
    };

    const verifyPin = async (pinCode) => {
        setIsVerifying(true);
        setError('');

        try {
            // Query for manager/admin users with this PIN
            const { data: managers, error: queryError } = await supabase
                .from('employees')
                .select('id, name, access_level')
                .eq('pin_code', pinCode)
                .in('access_level', ['admin', 'manager', 'owner']);

            if (queryError) throw queryError;

            if (managers && managers.length > 0) {
                // Valid admin PIN - grant access
                onSuccess(managers[0]);
                onClose();
            } else {
                setError('PIN שגוי או אין הרשאת מנהל');
                setPin('');
            }
        } catch (err) {
            console.error('PIN verification error:', err);
            setError('שגיאה באימות PIN');
            setPin('');
        } finally {
            setIsVerifying(false);
        }
    };

    // Numpad layout: 1-9 in grid, bottom row: clear, 0, backspace
    const numpadRows = [
        ['1', '2', '3'],
        ['4', '5', '6'],
        ['7', '8', '9'],
    ];

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-white rounded-3xl shadow-2xl p-6 max-w-sm w-full mx-4"
                        dir="rtl"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                                    <Shield size={20} className="text-indigo-600" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-slate-900">אימות מנהל</h3>
                                    <p className="text-xs text-slate-500 font-medium">Sudo Mode</p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-100 transition-colors"
                            >
                                <X size={20} className="text-slate-400" />
                            </button>
                        </div>

                        {/* Feature Info */}
                        <div className="mb-4 p-3 bg-blue-50 rounded-xl border border-blue-100">
                            <p className="text-sm font-bold text-blue-900">
                                <Lock size={14} className="inline ml-1" />
                                גישה ל: <span className="text-blue-600">{featureName}</span>
                            </p>
                        </div>

                        {/* PIN Dots Display */}
                        <div className="mb-5">
                            <label className="block text-sm font-bold text-slate-700 mb-3 text-center">
                                הכנס PIN (4 ספרות)
                            </label>
                            <div className="flex justify-center gap-4" dir="ltr">
                                {[0, 1, 2, 3].map((index) => (
                                    <div
                                        key={index}
                                        className={`w-14 h-14 rounded-xl border-2 flex items-center justify-center transition-all duration-200 ${
                                            pin.length > index
                                                ? 'bg-indigo-500 border-indigo-500 scale-105'
                                                : pin.length === index
                                                    ? 'border-indigo-400 bg-indigo-50 shadow-md shadow-indigo-100'
                                                    : 'border-slate-200 bg-slate-50'
                                        }`}
                                    >
                                        {pin.length > index ? (
                                            <div className="w-3.5 h-3.5 bg-white rounded-full" />
                                        ) : null}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Error Message */}
                        <AnimatePresence>
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="mb-3 p-2.5 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2"
                                >
                                    <AlertCircle size={16} className="text-red-600 shrink-0" />
                                    <p className="text-sm font-bold text-red-700">{error}</p>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Loading State */}
                        {isVerifying && (
                            <div className="text-center mb-3">
                                <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 rounded-xl">
                                    <div className="w-4 h-4 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                                    <span className="text-sm font-bold text-indigo-600">מאמת...</span>
                                </div>
                            </div>
                        )}

                        {/* Built-in Numeric Keypad */}
                        <div className="space-y-2" dir="ltr">
                            {numpadRows.map((row, rowIdx) => (
                                <div key={rowIdx} className="flex justify-center gap-2">
                                    {row.map((digit) => (
                                        <button
                                            key={digit}
                                            onClick={() => handleDigitPress(digit)}
                                            disabled={isVerifying}
                                            className="w-20 h-14 bg-slate-100 hover:bg-slate-200 active:bg-indigo-100 active:scale-95 rounded-xl text-2xl font-black text-slate-800 transition-all duration-100 disabled:opacity-40 select-none touch-manipulation"
                                        >
                                            {digit}
                                        </button>
                                    ))}
                                </div>
                            ))}
                            {/* Bottom row: Clear, 0, Backspace */}
                            <div className="flex justify-center gap-2">
                                <button
                                    onClick={handleClear}
                                    disabled={isVerifying || pin.length === 0}
                                    className="w-20 h-14 bg-red-50 hover:bg-red-100 active:bg-red-200 active:scale-95 rounded-xl text-sm font-bold text-red-600 transition-all duration-100 disabled:opacity-30 select-none touch-manipulation"
                                >
                                    נקה
                                </button>
                                <button
                                    onClick={() => handleDigitPress('0')}
                                    disabled={isVerifying}
                                    className="w-20 h-14 bg-slate-100 hover:bg-slate-200 active:bg-indigo-100 active:scale-95 rounded-xl text-2xl font-black text-slate-800 transition-all duration-100 disabled:opacity-40 select-none touch-manipulation"
                                >
                                    0
                                </button>
                                <button
                                    onClick={handleBackspace}
                                    disabled={isVerifying || pin.length === 0}
                                    className="w-20 h-14 bg-amber-50 hover:bg-amber-100 active:bg-amber-200 active:scale-95 rounded-xl flex items-center justify-center transition-all duration-100 disabled:opacity-30 select-none touch-manipulation"
                                >
                                    <Delete size={22} className="text-amber-700" />
                                </button>
                            </div>
                        </div>

                        {/* Helper Text */}
                        <p className="text-xs text-center text-slate-400 mt-3">
                            PIN נכון יאפשר גישה חד-פעמית ללא התנתקות
                        </p>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default PinCodeModal;
