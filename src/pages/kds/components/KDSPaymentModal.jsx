import React, { useState, useEffect } from 'react';
import { X, Check, CreditCard, Banknote, Gift, Star, Clock, History, Trophy, PartyPopper } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import db from '@/db/database';

/**
 * KDS Payment Modal - Used to collect payment for orders from KDS
 * Shows payment method selection and instructions for each method
 */
const KDSPaymentModal = ({
    isOpen,
    onClose,
    order,
    onConfirmPayment,
    onMoveToHistory,
    onRejectPayment, // 🆕
    isFromHistory = false
}) => {
    const [step, setStep] = useState('selection'); // 'selection' | 'instruction' | 'verification' | 'success'
    const [selectedMethod, setSelectedMethod] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);

    // 🏆 LOYALTY INTEGRATION: Get customer points
    const customerId = order?.customer_id || order?.customerId;
    const customerPhone = order?.customer_phone || order?.customerPhone || order?.phone;

    const loyaltyInfo = useLiveQuery(async () => {
        if (!customerId && !customerPhone) return null;

        // Try lookup by ID first, then phone
        let card = null;
        if (customerId) {
            card = await db.loyalty_cards.where('customer_id').equals(customerId).first();
        }

        if (!card && customerPhone) {
            card = await db.loyalty_cards.where('customer_phone').equals(customerPhone).first();
        }

        return card;
    }, [customerId, customerPhone]);

    useEffect(() => {
        if (isOpen) {
            // Check if we need verification
            if (order?.payment_screenshot_url && !order.is_paid) {
                setStep('verification');
            } else {
                setStep('selection');
            }
            setSelectedMethod(null);
            setIsProcessing(false);
        }
    }, [isOpen, order]);

    // 🕒 AUTO-CLOSE SUCCESS SCREEN
    useEffect(() => {
        if (step === 'success') {
            const timer = setTimeout(() => {
                onClose();
            }, 1500); // Wait 1.5 seconds so employee can read (updated per user request)
            return () => clearTimeout(timer);
        }
    }, [step, onClose]);

    if (!isOpen || !order) return null;

    const orderAmount = order.totalAmount || order.total_amount || 0;
    const customerName = order.customerName || order.customer_name || 'לקוח';

    // Verification Handlers
    const handleVerifyApprove = async () => {
        if (!onConfirmPayment) return;
        setIsProcessing(true);
        try {
            await onConfirmPayment(order.id, order.payment_method || 'transfer');
        } catch (err) {
            alert('שגיאה: ' + err.message);
        } finally { setIsProcessing(false); }
    };

    const handleVerifyReject = async () => {
        if (!onRejectPayment) return;
        if (!confirm('האם אתה בטוח שברצונך לדחות את אישור התשלום? הלקוח יצטרך להעלות מחדש.')) return;
        setIsProcessing(true);
        try {
            await onRejectPayment(order.id);
        } catch (err) {
            alert('שגיאה: ' + err.message);
        } finally { setIsProcessing(false); }
    };

    const formatPrice = (price) => {
        const num = Number(price);
        const hasDecimals = num % 1 !== 0;
        return new Intl.NumberFormat('he-IL', {
            style: 'currency',
            currency: 'ILS',
            minimumFractionDigits: hasDecimals ? 2 : 0,
            maximumFractionDigits: 2
        }).format(num);
    };

    const PAYMENT_METHODS = [
        { id: 'cash', label: 'מזומן', icon: Banknote, color: 'bg-green-100 text-green-700 hover:bg-green-200' },
        { id: 'credit_card', label: 'אשראי', icon: CreditCard, color: 'bg-blue-100 text-blue-700 hover:bg-blue-200' },
        { id: 'bit', label: 'ביט', icon: CreditCard, color: 'bg-cyan-100 text-cyan-700 hover:bg-cyan-200' },
        { id: 'paybox', label: 'פייבוקס', icon: CreditCard, color: 'bg-pink-100 text-pink-700 hover:bg-pink-200' },
        { id: 'gift_card', label: 'שובר', icon: Gift, color: 'bg-purple-100 text-purple-700 hover:bg-purple-200' },
        { id: 'oth', label: 'OTH', icon: Star, color: 'bg-orange-100 text-orange-700 hover:bg-orange-200' },
    ];

    const PAYMENT_INSTRUCTIONS = {
        credit_card: {
            title: 'אישור תשלום באשראי',
            subtitle: 'הזן במכשיר סליקה',
            icon: CreditCard,
            iconBg: 'bg-blue-50',
            iconColor: 'text-blue-600',
            amountBg: 'bg-blue-50 border-blue-200',
            amountColor: 'text-blue-600',
            instructions: ['הקש את הסכום במכשיר הסליקה', 'העבר את כרטיס הלקוח', 'קבל אישור מהמכשיר'],
            confirmText: 'התשלום התקבל'
        },
        cash: {
            title: 'תשלום במזומן',
            subtitle: 'רישום בקופה',
            icon: Banknote,
            iconBg: 'bg-green-50',
            iconColor: 'text-green-600',
            amountBg: 'bg-green-50 border-green-200',
            amountColor: 'text-green-600',
            instructions: ['פתח עסקה בקופה הרושמת', 'בחר אמצעי תשלום: מזומן', 'סגור את העסקה בקופה'],
            confirmText: 'העסקה נרשמה'
        },
        gift_card: {
            title: 'תשלום בשובר/גיפט קארד',
            subtitle: 'רישום על השובר',
            icon: Gift,
            iconBg: 'bg-purple-50',
            iconColor: 'text-purple-600',
            amountBg: 'bg-purple-50 border-purple-200',
            amountColor: 'text-purple-600',
            instructions: ['רשום על השובר את סכום הקנייה', 'הפנה את הלקוח למשתלה', 'במשתלה ישלימו את ההפרש'],
            confirmText: 'השובר עודכן'
        },
        oth: {
            title: 'על חשבון הבית',
            subtitle: 'אישור הנהלה',
            icon: Star,
            iconBg: 'bg-orange-50',
            iconColor: 'text-orange-600',
            amountBg: 'bg-orange-50 border-orange-200',
            amountColor: 'text-orange-600',
            instructions: ['ההזמנה תירשם כ"על חשבון הבית"'],
            confirmText: 'אישור'
        },
        bit: {
            title: 'Bit - 055-6822072',
            subtitle: 'העברה באפליקציה',
            icon: CreditCard,
            iconBg: 'bg-cyan-50',
            iconColor: 'text-cyan-600',
            amountBg: 'bg-cyan-50 border-cyan-200',
            amountColor: 'text-cyan-600',
            instructions: ['בקש להשאיר שדה סיבה ריק', 'ודא מספר: 055-6822072', 'המתן לקבלת אישור'],
            confirmText: 'קיבלתי אישור'
        },
        paybox: {
            title: 'Paybox - 055-6822072',
            subtitle: 'העברה באפליקציה',
            icon: CreditCard,
            iconBg: 'bg-pink-50',
            iconColor: 'text-pink-600',
            amountBg: 'bg-pink-50 border-pink-200',
            amountColor: 'text-pink-600',
            instructions: ['ודא מספר: 055-6822072', 'המתן לקבלת אישור'],
            confirmText: 'קיבלתי אישור'
        }
    };

    const handleMethodSelect = (methodId) => { setSelectedMethod(methodId); setStep('instruction'); };

    const handleConfirm = async () => {
        if (!onConfirmPayment || !selectedMethod) return;
        setIsProcessing(true);
        try {
            // Log for debugging
            console.log('💳 [Modal] Confirming payment for ID:', order.originalId || order.id);
            await onConfirmPayment(order.originalId || order.id, selectedMethod);
            // 🎯 ALWAYS show success screen now for consistent premium feel
            setStep('success');
        } catch (err) {
            alert('שגיאה באישור התשלום: ' + (err?.message || err));
        } finally { setIsProcessing(false); }
    };

    const handleMoveToHistory = async () => {
        if (!onMoveToHistory) { onClose(); return; }
        setIsProcessing(true);
        try {
            const targetId = order.originalOrderId || order.originalId || order.id;
            await onMoveToHistory(targetId);
            onClose({ showHistoryInfo: !order.isPaid, orderNumber: order.orderNumber });
        } catch (err) {
            alert('שגיאה בהעברה להיסטוריה: ' + (err?.message || err));
        } finally { setIsProcessing(false); }
    };

    const handleBack = () => { setStep('selection'); setSelectedMethod(null); };

    // New Verification UI
    if (step === 'verification') {
        const methodLabel = order.payment_method === 'bit' ? 'Bit' : order.payment_method === 'paybox' ? 'PayBox' : 'העברה'
        return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10001] flex items-center justify-center p-4" dir="rtl" onClick={onClose}>
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                    <div className="p-4 border-b bg-orange-50 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center hover:scale-110 cursor-pointer transition-transform"
                                onClick={() => window.open(order.payment_screenshot_url, '_blank')}
                            >
                                <Star size={20} />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-slate-800">אימות תשלום ({methodLabel})</h2>
                                <p className="text-xs text-slate-500 font-bold">יש לאמת את האסמכתא לפני אישור</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-1.5 rounded-full hover:bg-orange-100 text-orange-400 hover:text-orange-600 transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                    <div className="p-4 overflow-y-auto bg-slate-50/50">
                        <div className="bg-white rounded-xl overflow-hidden mb-4 border border-slate-200 shadow-sm flex items-center justify-center p-1">
                            <a href={order.payment_screenshot_url} target="_blank" rel="noreferrer" className="block relative group w-full">
                                <img src={order.payment_screenshot_url} alt="Proof" className="w-full h-auto object-contain max-h-[40vh] rounded-lg" />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center rounded-lg">
                                    <span className="opacity-0 group-hover:opacity-100 bg-black/70 text-white px-3 py-1 rounded-full text-xs font-bold pointer-events-none">לחץ להגדלה</span>
                                </div>
                            </a>
                        </div>
                        <div className="text-center mb-2">
                            <p className="font-bold text-lg text-slate-800">סכום לאימות: {formatPrice(orderAmount)}</p>
                        </div>
                    </div>
                    <div className="p-4 border-t flex gap-3 bg-white">
                        <button onClick={handleVerifyReject} disabled={isProcessing} className="flex-1 py-3 bg-red-50 text-red-600 border border-red-100 rounded-xl font-bold hover:bg-red-100 transition-colors">
                            {isProcessing ? 'מעבד...' : 'דחה תשלום'}
                        </button>
                        <button onClick={handleVerifyApprove} disabled={isProcessing} className="flex-[2] py-3 bg-green-600 text-white rounded-xl font-bold shadow-lg shadow-green-100 hover:bg-green-700 transition-colors">
                            {isProcessing ? 'מאשר...' : '👍 אשר תשלום'}
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    if (step === 'instruction' && selectedMethod) {
        const config = PAYMENT_INSTRUCTIONS[selectedMethod];
        const IconComponent = config?.icon || CreditCard;
        return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10001] flex items-center justify-center p-4" dir="rtl" onClick={onClose}>
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                    <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 ${config?.iconBg} rounded-full flex items-center justify-center ${config?.iconColor}`}><IconComponent size={20} /></div>
                            <div>
                                <h2 className="text-xl font-black text-slate-800">{config?.title}</h2>
                                <p className="text-xs font-bold text-slate-400">{config?.subtitle}</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                    <div className="p-6 flex flex-col items-center space-y-4">
                        <div className={`w-full ${config?.amountBg} border-2 rounded-2xl p-4 text-center`}>
                            <p className="text-sm font-bold mb-1 text-slate-600">סכום לגבייה:</p>
                            <p className={`text-4xl font-black ${config?.amountColor}`}>{selectedMethod === 'oth' ? formatPrice(0) : formatPrice(orderAmount)}</p>
                        </div>
                        <div className="w-full bg-slate-50 rounded-2xl p-4 space-y-2">
                            {config?.instructions.map((ins, idx) => (
                                <div key={idx} className="flex items-start gap-3">
                                    <div className="w-6 h-6 bg-slate-200 rounded-full flex items-center justify-center text-sm font-bold text-slate-600 shrink-0">{idx + 1}</div>
                                    <p className="text-sm text-slate-700 font-medium">{ins}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="p-4 border-t flex gap-3">
                        <button onClick={handleBack} disabled={isProcessing} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold">חזור</button>
                        <button onClick={handleConfirm} disabled={isProcessing} className="flex-[2] py-3 bg-green-600 text-white rounded-xl font-bold">{isProcessing ? 'מעבד...' : config?.confirmText}</button>
                    </div>
                </div>
            </div>
        );
    }

    // SUCCESS SCREEN (Redesigned to match POS exactly)
    if (step === 'success') {
        const isOTH = selectedMethod === 'oth';
        return (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[10001] flex items-center justify-center p-4 shadow-2xl" dir="rtl">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
                    <div className="p-8 pb-4 flex flex-col items-center text-center space-y-4 bg-gradient-to-b from-green-50 to-white">
                        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center relative shadow-sm">
                            <PartyPopper size={40} strokeWidth={2.5} className="mt-[-2px]" />
                        </div>
                        <div className="space-y-1">
                            <h2 className="text-2xl font-black text-slate-800 flex items-center justify-center gap-2">מעולה! <span className="text-xl">🎉</span></h2>
                            <p className="text-sm text-slate-500 font-bold">ההזמנה שולמה בהצלחה</p>
                        </div>
                    </div>

                    <div className="px-6 pb-8 space-y-6">
                        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-bold text-slate-500">מספר הזמנה</span>
                                <span className="text-xl font-black text-slate-800">#{order.orderNumber}</span>
                            </div>
                            <div className="flex justify-between items-center border-t border-slate-200 pt-3">
                                <span className="text-sm font-bold text-slate-500">סה"כ שולם</span>
                                <span className="text-xl font-black text-green-600">
                                    {isOTH ? '₪ 0' : formatPrice(orderAmount)}
                                </span>
                            </div>

                            {/* Loyalty Points Section */}
                            {loyaltyInfo && (
                                <div className="flex items-center justify-between pt-3 border-t border-slate-200 animate-in slide-in-from-bottom-2">
                                    <div className="flex items-center gap-2">
                                        <div className="bg-orange-100 p-1.5 rounded-lg text-orange-600">
                                            <Trophy size={16} />
                                        </div>
                                        <span className="text-xs font-black text-slate-800">יתרת נקודות חבר</span>
                                    </div>
                                    <span className="text-xl font-black text-orange-600">{loyaltyInfo.points_balance || 0}</span>
                                </div>
                            )}
                        </div>

                        {/* 📱 🟩 Green SMS Message (Only if phone exists) */}
                        {customerPhone && customerPhone.trim() !== '' && (
                            <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center justify-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-green-600 shrink-0">
                                    <Check size={16} strokeWidth={3} />
                                </div>
                                <span className="text-sm font-black text-green-700">הודעת SMS נשלחה בהצלחה ללקוח!</span>
                            </div>
                        )}

                        <button
                            onClick={onClose}
                            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-lg hover:bg-slate-800 transition shadow-lg active:scale-[0.98]"
                        >
                            חזרה למסך שירות
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10001] flex items-center justify-center p-4" dir="rtl" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col transition-colors duration-300" style={{ maxHeight: '88vh' }} onClick={e => e.stopPropagation()}>
                {/* Header - Matches POS perfectly */}
                <div className="p-4 border-b flex-shrink-0 border-slate-100">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center border bg-blue-50 text-blue-600 border-blue-100">
                                <CreditCard size={20} />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-slate-800">גביית תשלום</h2>
                                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                    <span>#{order.orderNumber}</span>
                                    <span>•</span>
                                    <span>{customerName}</span>
                                </div>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                    {/* Totals Summary - White/Gray style from POS */}
                    <div className="border-2 rounded-2xl p-4 bg-slate-50 border-slate-200">
                        <div className="flex justify-between items-center">
                            <span className="text-lg font-bold text-slate-800">סה״כ לתשלום</span>
                            <span className="text-3xl font-black text-slate-800">
                                {formatPrice(orderAmount)}
                            </span>
                        </div>
                    </div>

                    {/* Payment Methods Grid */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-base font-bold text-slate-800">אמצעי תשלום</h3>
                        </div>

                        <div className="grid grid-cols-4 gap-2">
                            {PAYMENT_METHODS.map((m) => (
                                <button
                                    key={m.id}
                                    onClick={() => handleMethodSelect(m.id)}
                                    className={`flex flex-col items-center justify-center gap-1.5 rounded-xl transition-all border-2 border-transparent hover:scale-[1.02] active:scale-[0.98] shadow-sm hover:shadow-md ${['cash', 'credit_card'].includes(m.id) ? 'col-span-2 h-32 p-4' : 'col-span-1 h-20 p-2'} ${m.color}`}
                                >
                                    <m.icon size={24} />
                                    <span className="font-bold text-sm truncate w-full text-center">{m.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer - Optimized for KDS actions but POS style */}
                <div className="p-4 border-t bg-slate-50 border-slate-100">
                    <div className="flex flex-col gap-2">
                        {!isFromHistory && (
                            <button
                                onClick={handleMoveToHistory}
                                disabled={isProcessing}
                                className="w-full py-3 border-2 rounded-xl font-bold text-lg transition shadow-sm flex flex-col items-center justify-center gap-0.5 bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
                            >
                                <div className="flex items-center gap-2">
                                    <History size={20} />
                                    <span>העבר להיסטוריה ללא תשלום</span>
                                </div>
                                <span className="text-[10px] font-medium opacity-60">ההזמנה תישמר כלא שולמה</span>
                            </button>
                        )}
                        <button onClick={onClose} className="w-full py-2 text-slate-400 font-bold text-sm hover:text-slate-600 transition-colors">סגור</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default KDSPaymentModal;
