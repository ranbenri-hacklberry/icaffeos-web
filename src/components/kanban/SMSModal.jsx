
import React, { useState, useEffect, useRef } from 'react';
import { X, MessageSquare, Send, Phone, Check, Loader2 } from 'lucide-react';
import { sendSms } from '@/services/smsService';

const SMSModal = ({ isOpen, onClose, order }) => {
    const [message, setMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [status, setStatus] = useState(null); // 'success' | 'error'
    const inputRef = useRef(null);

    const customerName = order?.customerName || order?.customer_name || 'אורח';
    const customerPhone = order?.customerPhone || order?.customer_phone || '';

    // Suggestions for quick messages
    const SUGGESTIONS = [
        "ההזמנה שלך בדרך! 🛵",
        "ההזמנה שלך מוכנה! מוזמנ/ת לאסוף 🥯",
        "היי, יש לנו שאלה לגבי ההזמנה שלך, אפשר לחזור אלינו?",
        "השליח מתחת לבית שלך! 🛵",
    ];

    useEffect(() => {
        if (isOpen) {
            setMessage('');
            setStatus(null);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSend = async () => {
        if (!message.trim() || !customerPhone) return;

        setIsSending(true);
        setStatus(null);

        try {
            const result = await sendSms(customerPhone, message);
            if (result.success) {
                setStatus('success');
                setTimeout(() => onClose(), 1500);
            } else {
                setStatus('error');
            }
        } catch (err) {
            setStatus('error');
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm font-heebo"
            dir="rtl"
            onClick={onClose}
        >
            <div
                className="relative w-[380px] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-blue-600 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <MessageSquare size={24} className="text-white" />
                        <div>
                            <h2 className="text-lg font-black text-white leading-tight">שלח הודעה</h2>
                            <p className="text-xs text-blue-100 font-bold">{customerName} • {customerPhone}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
                        <X size={20} className="text-white" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                    {/* Status Message */}
                    {status === 'success' && (
                        <div className="bg-green-50 text-green-700 p-3 rounded-xl flex items-center gap-3 border border-green-100 animate-in fade-in zoom-in-95 duration-300">
                            <Check size={20} className="shrink-0" />
                            <span className="font-bold">הודעה נשלחה בהצלחה!</span>
                        </div>
                    )}

                    {status === 'error' && (
                        <div className="bg-red-50 text-red-700 p-3 rounded-xl flex items-center gap-3 border border-red-100 font-bold text-sm">
                            שגיאה בשליחת ההודעה. נסה שוב.
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-500 px-1">תוכן ההודעה</label>
                        <textarea
                            ref={inputRef}
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="הקלד כאן את ההודעה..."
                            className="w-full h-32 p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-blue-500 focus:bg-white transition-all outline-none text-lg font-medium resize-none"
                        />
                    </div>

                    {/* Suggestions */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 px-1 uppercase tracking-wider">הודעות מהירות</label>
                        <div className="flex flex-col gap-2">
                            {SUGGESTIONS.map((s, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setMessage(s)}
                                    className="text-right p-3 bg-white border border-slate-100 rounded-xl text-sm font-bold text-slate-600 hover:border-blue-400 hover:bg-blue-50 transition-all active:scale-[0.98]"
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-50 border-t border-slate-100">
                    <button
                        onClick={handleSend}
                        disabled={isSending || !message.trim() || status === 'success'}
                        className={`w-full py-4 rounded-2xl font-black text-xl flex items-center justify-center gap-3 shadow-lg transition-all active:scale-95 ${isSending || !message.trim() || status === 'success'
                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200'
                            }`}
                    >
                        {isSending ? (
                            <Loader2 size={24} className="animate-spin" />
                        ) : (
                            <Send size={24} />
                        )}
                        <span>{isSending ? 'שולח...' : 'שלח עכשיו'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SMSModal;
