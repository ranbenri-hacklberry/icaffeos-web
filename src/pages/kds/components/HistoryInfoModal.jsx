import React, { useState, useEffect } from 'react';
import { History, CreditCard, CheckCircle, Info } from 'lucide-react';

const DONT_SHOW_KEY = 'kds_history_info_dismissed';

/**
 * HistoryInfoModal - Simplified version
 */
const HistoryInfoModal = ({ isOpen, onClose, orderNumber }) => {
    const [dontShowAgain, setDontShowAgain] = useState(false);

    useEffect(() => {
        if (isOpen) {
            const dismissed = localStorage.getItem(DONT_SHOW_KEY);
            if (dismissed === 'true') {
                onClose();
            }
        }
    }, [isOpen, onClose]);

    const handleClose = () => {
        if (dontShowAgain) {
            localStorage.setItem(DONT_SHOW_KEY, 'true');
        }
        onClose();
    };

    if (!isOpen) return null;
    if (localStorage.getItem(DONT_SHOW_KEY) === 'true') return null;

    return (
        <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-heebo"
            dir="rtl"
            onClick={handleClose}
        >
            <div
                className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-blue-600 p-6 text-white text-center">
                    <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Info size={32} />
                    </div>
                    <h2 className="text-2xl font-black mb-1">הועבר להיסטוריה</h2>
                    {orderNumber && <p className="text-blue-100 font-bold">הזמנה מספר: #{orderNumber}</p>}
                </div>

                {/* Content */}
                <div className="p-6">
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-4 items-center">
                        <CreditCard className="text-amber-600 shrink-0" size={24} />
                        <div>
                            <p className="font-bold text-amber-900 text-lg">חסר תשלום!</p>
                            <p className="text-amber-800">ההזמנה תמתין בטאב ההיסטוריה לגביית תשלום.</p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 pt-0 space-y-4">
                    <label className="flex items-center gap-3 cursor-pointer select-none justify-center group">
                        <div className="relative">
                            <input
                                type="checkbox"
                                checked={dontShowAgain}
                                onChange={(e) => setDontShowAgain(e.target.checked)}
                                className="peer sr-only"
                            />
                            <div className="w-5 h-5 border-2 border-slate-300 rounded-md peer-checked:bg-blue-600 peer-checked:border-blue-600 transition-all"></div>
                            <CheckCircle className="absolute inset-0 text-white opacity-0 peer-checked:opacity-100 transition-opacity" size={16} style={{ margin: 'auto' }} />
                        </div>
                        <span className="text-slate-500 font-medium group-hover:text-slate-700">אל תציג שוב</span>
                    </label>

                    <button
                        onClick={handleClose}
                        className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-xl transition-all active:scale-[0.98] shadow-lg"
                    >
                        הבנתי
                    </button>
                </div>
            </div>
        </div>
    );
};

export default HistoryInfoModal;
