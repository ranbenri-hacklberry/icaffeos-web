import React, { useState, useEffect } from 'react';
import { X, Check, CreditCard, Clock, Gift, Banknote, Star } from 'lucide-react';
import Button from '@/components/ui/Button'; // Assuming Button component exists in this path, based on previous file
import { cn } from '@/utils/cn'; // Assuming cn exists
import { useDiscounts } from '@/pages/menu-ordering-interface/hooks/useDiscounts';
import { useTheme } from '@/context/ThemeContext';

const PaymentSelectionModal = ({
  isOpen,
  onClose,
  onPaymentSelect,
  cartTotal = 0,
  subtotal = 0,
  loyaltyDiscount = 0,
  soldierDiscountAmount = 0,
  cartItems = [],
  isRefund = false,
  refundAmount = 0,
  originalPaymentMethod = null,
  businessId = null,
  customerName = '', // 🆕 Added prop
  customerPhone = '' // 🆕 Added prop
}) => {
  const { isDarkMode } = useTheme();
  const [step, setStep] = useState('selection'); // 'selection' or 'pos_instruction'
  const [isProcessing, setIsProcessing] = useState(false);

  // Custom Hooks
  // We pass businessId to the hook
  // const { discounts, calculateDiscount } = useDiscounts(businessId);
  const discounts = [];
  const calculateDiscount = () => ({ amount: 0, details: '' });

  // State
  const [selectedDiscount, setSelectedDiscount] = useState(null); // The full discount object
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountDetails, setDiscountDetails] = useState('');

  // Payment Method State
  // We'll use a temporary state for the "intended" payment method if it requires a second step (like POS)
  const [pendingPaymentMethod, setPendingPaymentMethod] = useState(null);

  // Computed
  const finalPrice = Math.max(0, cartTotal - discountAmount);

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('selection');
      setIsProcessing(false);
      setSelectedDiscount(null);
      setDiscountAmount(0);
      setDiscountDetails('');
      setPendingPaymentMethod(null);
    }
  }, [isOpen]);

  // Recalculate discount when selection or cart changes
  useEffect(() => {
    if (selectedDiscount) {
      const { amount, details } = calculateDiscount(selectedDiscount, cartItems, cartTotal);
      setDiscountAmount(amount);
      setDiscountDetails(details);
    } else {
      setDiscountAmount(0);
      setDiscountDetails('');
    }
  }, [selectedDiscount, cartItems, cartTotal, calculateDiscount]);

  if (!isOpen) return null;

  const formatPrice = (price) => {
    const num = Number(price);
    const hasDecimals = num % 1 !== 0;
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: 'ILS',
      minimumFractionDigits: hasDecimals ? 2 : 0,
      maximumFractionDigits: 2
    })?.format(num);
  };

  const buildModsString = (item) => {
    if (!item?.selectedOptions) return null;
    try {
      if (Array.isArray(item.selectedOptions)) {
        const modsObject = {};
        item.selectedOptions.forEach((opt) => {
          if (opt?.groupId && opt?.valueName) {
            modsObject[opt.groupId] = opt.valueName;
          }
        });
        return Object.keys(modsObject).length > 0 ? JSON.stringify(modsObject) : null;
      }

      const normalizedOptions = {};
      Object.keys(item.selectedOptions).forEach((key) => {
        const value = item.selectedOptions[key];
        if (value && typeof value === 'object' && value.valueName) {
          normalizedOptions[key] = value.valueName;
        } else {
          normalizedOptions[key] = value;
        }
      });

      return Object.keys(normalizedOptions).length > 0 ? JSON.stringify(normalizedOptions) : null;
    } catch (e) {
      console.error('Error building mods string:', e);
      return null;
    }
  };

  const buildOrderPayload = (paymentMethod, isPaid) => {
    // Priority: Props (Transient/Manual Input) > LocalStorage (Persisted Customer)
    const customerDataString = localStorage.getItem('currentCustomer');
    const localCustomer = customerDataString ? JSON.parse(customerDataString) : {};

    const finalName = customerName || localCustomer.name || '';
    const finalPhone = customerPhone || localCustomer.phone || '';

    return {
      customer_phone: finalPhone,
      customer_name: finalName,
      payment_method: paymentMethod,
      is_paid: isPaid,
      total_amount: finalPrice, // Use final price with discount
      discount_id: selectedDiscount?.id || null,
      discount_amount: discountAmount,
      items: cartItems?.map((item) => ({
        menu_item_id: item?.id,
        quantity: item?.quantity ?? 1,
        mods: buildModsString(item),
      }))
    };
  };

  const handleDiscountToggle = (discount) => {
    if (selectedDiscount?.id === discount.id) {
      setSelectedDiscount(null);
    } else {
      setSelectedDiscount(discount);
    }
  };

  const handlePaymentMethodSelect = (method) => {
    // All payment methods now show an instruction screen first
    setPendingPaymentMethod(method);
    setStep('instruction');
  };

  const handleConfirmPayment = () => {
    setIsProcessing(true);
    const orderData = buildOrderPayload(pendingPaymentMethod, true);

    setTimeout(() => {
      setIsProcessing(false);
      onPaymentSelect?.(orderData);
    }, 300);
  };

  const handleCancelInstruction = () => {
    setStep('selection');
    setPendingPaymentMethod(null);
  };

  const handlePayLater = () => {
    setIsProcessing(true);
    // CRITICAL: Do NOT set payment_method to 'cash' if it's not paid!
    // This was causing orders to appear as "Paid" or "Cash" in history erroneously.
    const orderData = buildOrderPayload(null, false);

    setTimeout(() => {
      setIsProcessing(false);
      onPaymentSelect?.(orderData);
    }, 300);
  };

  const handleConfirmPOS = () => {
    setIsProcessing(true);
    // Confirm pending method (credit card)
    const orderData = buildOrderPayload(pendingPaymentMethod || 'credit_card', true);

    setTimeout(() => {
      setIsProcessing(false);
      onPaymentSelect?.(orderData);
    }, 300);
  };

  const handleCancelPOS = () => {
    setStep('selection');
    setPendingPaymentMethod(null);
  };

  // Payment Method Config with Instructions
  const PAYMENT_INSTRUCTIONS = {
    credit_card: {
      title: 'אישור תשלום באשראי',
      subtitle: 'הזן במכשיר סליקה',
      icon: CreditCard,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
      amountBg: 'bg-blue-50 border-blue-200',
      amountColor: 'text-blue-600',
      instructions: [
        'הקש את הסכום במכשיר הסליקה',
        'העבר את כרטיס הלקוח',
        'קבל אישור מהמכשיר'
      ],
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
      instructions: [
        'פתח עסקה בקופה הרושמת',
        'בחר אמצעי תשלום: מזומן',
        'סגור את העסקה בקופה'
      ],
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
      instructions: [
        'רשום על השובר את סכום הקנייה הנוכחית',
        'הפנה את הלקוח למשתלה',
        'במשתלה ישלימו את ההפרש ליתרת השובר'
      ],
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
      instructions: [
        'ההזמנה תירשם כ"על חשבון הבית"'
      ],
      confirmText: 'אישור'
    },
    bit: {
      title: 'Bit - להעברה ל 055-6822072',
      subtitle: 'העברה באפליקציה',
      icon: CreditCard,
      iconBg: 'bg-cyan-50',
      iconColor: 'text-cyan-600',
      amountBg: 'bg-cyan-50 border-cyan-200',
      amountColor: 'text-cyan-600',
      instructions: [
        '⚠️ חשוב! בקש מהלקוח להשאיר את שדה הסיבה ריק',
        'ודא שהלקוח שולח למספר: 055-6822072',
        'המתן לקבלת אישור העברה על המסך',
        'אשר רק לאחר שראית את האישור'
      ],
      confirmText: 'קיבלתי אישור'
    },
    paybox: {
      title: 'Paybox - להעברה ל 055-6822072',
      subtitle: 'העברה באפליקציה',
      icon: CreditCard,
      iconBg: 'bg-pink-50',
      iconColor: 'text-pink-600',
      amountBg: 'bg-pink-50 border-pink-200',
      amountColor: 'text-pink-600',
      instructions: [
        'ודא שהלקוח שולח למספר: 055-6822072',
        'המתן לקבלת אישור העברה',
        'אשר רק לאחר שראית את האישור'
      ],
      confirmText: 'קיבלתי אישור'
    }
  };

  // Instruction Screen (for all payment methods)
  if (step === 'instruction' && pendingPaymentMethod) {
    const config = PAYMENT_INSTRUCTIONS[pendingPaymentMethod];
    const IconComponent = config?.icon || CreditCard;

    return (
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
        dir="rtl"
      >
        <div
          className={`rounded-3xl shadow-2xl max-w-md w-full mx-4 overflow-hidden flex flex-col transition-colors duration-300 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white'
            }`}
          onClick={e => e.stopPropagation()}
        >
          {/* Header - More spacious like GitHub version */}
          <div className={`p-6 border-b transition-colors ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 ${isDarkMode ? 'bg-slate-800 border-slate-700' : config?.iconBg} rounded-full flex items-center justify-center ${isDarkMode ? 'text-white' : config?.iconColor} border border-slate-100`}>
                <IconComponent size={24} />
              </div>
              <div>
                <h2 className={`text-xl font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{config?.title}</h2>
                <p className={`text-sm ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{config?.subtitle}</p>
              </div>
            </div>
          </div>

          <div className="flex-1 p-8 flex flex-col items-center justify-center space-y-8">
            {/* Amount Display - BOLD & LARGE (7xl) like GitHub version */}
            <div className={`w-full ${isDarkMode ? 'bg-slate-800 border-slate-700' : config?.amountBg} border-2 rounded-3xl p-8 text-center`}>
              {/* Show discounts breakdown if any */}
              {(soldierDiscountAmount > 0 || loyaltyDiscount > 0) && (
                <div className={`text-sm mb-4 space-y-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  <p>סהכ לפני הנחות: {formatPrice(subtotal)}</p>
                  {soldierDiscountAmount > 0 && (
                    <p className="text-blue-400">🎖️ הנחת חייל (10%): -{formatPrice(soldierDiscountAmount)}</p>
                  )}
                  {loyaltyDiscount > 0 && (
                    <p className="text-green-400">🎁 הנחת נאמנות: -{formatPrice(loyaltyDiscount)}</p>
                  )}
                </div>
              )}
              <p className={`text-sm font-bold mb-3 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                {isRefund ? 'סכום לזיכוי:' : 'סכום לתשלום:'}
              </p>
              <p className={`text-5xl font-black ${isDarkMode ? 'text-white' : config?.amountColor}`}>
                {pendingPaymentMethod === 'oth' ? formatPrice(0) : formatPrice(isRefund ? refundAmount : finalPrice)}{isRefund && pendingPaymentMethod !== 'oth' ? '-' : ''}
              </p>
            </div>

            {/* Instructions */}
            <div className="w-full space-y-2 text-center">
              {config?.instructions.map((instruction, idx) => (
                <p key={idx} className={`text-base font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  {instruction}
                </p>
              ))}
            </div>
          </div>

          {/* Footer Buttons - Larger (h-14) like GitHub version */}
          <div className={`p-6 border-t transition-colors ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
            <div className="flex gap-3">
              <button
                onClick={handleCancelInstruction}
                disabled={isProcessing}
                className={`flex-1 h-14 rounded-2xl font-bold text-xl transition disabled:opacity-50 ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
              >
                חזור
              </button>

              <button
                onClick={handleConfirmPayment}
                disabled={isProcessing}
                className={`flex-[2] h-14 ${isRefund ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'} text-white rounded-2xl font-bold text-xl transition shadow-lg disabled:opacity-50 flex items-center justify-center gap-2`}
              >
                {isProcessing ? (
                  <span>מעבד...</span>
                ) : (
                  <>
                    <Check size={24} strokeWidth={3} />
                    <span>{isDarkMode && isRefund ? 'אישור זיכוי' : config?.confirmText}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Payment Methods for Selection Grid
  const PAYMENT_METHODS = [
    { id: 'cash', label: 'מזומן', icon: Banknote, color: 'bg-green-100 text-green-700 hover:bg-green-200' },
    { id: 'credit_card', label: 'אשראי', icon: CreditCard, color: 'bg-blue-100 text-blue-700 hover:bg-blue-200' },
    { id: 'bit', label: 'ביט', icon: CreditCard, color: 'bg-cyan-100 text-cyan-700 hover:bg-cyan-200' },
    { id: 'paybox', label: 'פייבוקס', icon: CreditCard, color: 'bg-pink-100 text-pink-700 hover:bg-pink-200' },
    { id: 'gift_card', label: 'שובר', icon: Gift, color: 'bg-purple-100 text-purple-700 hover:bg-purple-200' },
    { id: 'oth', label: 'OTH', icon: Star, color: 'bg-orange-100 text-orange-700 hover:bg-orange-200' },
  ];

  // Selection Screen - Compact Design (reduced 20%)
  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 transition-all"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className={`rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden flex flex-col transition-colors duration-300 ${isDarkMode ? 'bg-slate-900' : 'bg-white'
          }`}
        style={{ maxHeight: '88vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header - Compact */}
        <div className={`p-4 border-b flex-shrink-0 transition-colors ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center border transition-colors ${isDarkMode ? 'bg-slate-800 text-blue-400 border-slate-700' : 'bg-blue-50 text-blue-600 border-blue-100'
                }`}>
                <CreditCard size={20} />
              </div>
              <div>
                <h2 className={`text-xl font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                  {isRefund ? 'אישור זיכוי' : 'תשלום'}
                </h2>
                <div className={`flex items-center gap-1.5 text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  <span>{cartItems?.reduce((count, item) => count + item?.quantity, 0)} פריטים</span>
                  <span>•</span>
                  <span>סה״כ: {formatPrice(cartTotal)}</span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className={`p-1.5 rounded-full transition-colors ${isDarkMode ? 'hover:bg-slate-800 text-slate-500 hover:text-white' : 'hover:bg-slate-100 text-slate-400 hover:text-slate-600'
                }`}
              disabled={isProcessing}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Main Content - Compact, Scrollable */}
        <div className="flex-1 p-4 space-y-4 overflow-y-auto">

          {/* Totals Summary - Compact */}
          <div className={`border-2 rounded-2xl p-4 transition-colors ${isRefund
              ? (isDarkMode ? 'bg-red-900/20 border-red-900/30' : 'bg-red-50 border-red-200')
              : (isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200')
            }`}>
            <div className="flex justify-between items-center">
              <span className={`text-lg font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>סה״כ לתשלום</span>
              <span className={`text-3xl font-black ${isRefund ? 'text-red-500' : (isDarkMode ? 'text-white' : 'text-slate-800')}`}>
                {formatPrice(finalPrice)}
              </span>
            </div>
          </div>

          {/* Payment Methods Grid - Compact */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className={`text-base font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-800'}`}>אמצעי {isRefund ? 'החזר' : 'תשלום'}</h3>
              {isRefund && originalPaymentMethod && (
                <div className="bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 rounded-full font-black border border-amber-200 animate-pulse">
                  תשלום מקורי: {PAYMENT_METHODS.find(m => m.id === originalPaymentMethod)?.label || originalPaymentMethod}
                </div>
              )}
            </div>

            <div className="grid grid-cols-4 gap-2">
              {PAYMENT_METHODS.map(method => {
                const isOriginal = isRefund && method.id === originalPaymentMethod;

                return (
                  <button
                    key={method.id}
                    onClick={() => handlePaymentMethodSelect(method.id)}
                    disabled={isProcessing}
                    className={cn(
                      "flex flex-col items-center justify-center gap-1.5 rounded-xl transition-all border-2",
                      isDarkMode
                        ? "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white"
                        : method.color,
                      isOriginal ? "border-amber-500 ring-4 ring-amber-200 shadow-lg scale-[1.05] z-10" : "border-transparent",
                      "hover:scale-[1.02] active:scale-[0.98] shadow-sm hover:shadow-md",
                      ['cash', 'credit_card'].includes(method.id) ? 'col-span-2 h-32 p-4' : 'col-span-1 h-20 p-2'
                    )}
                  >
                    <method.icon size={24} />
                    <span className="font-bold text-sm truncate w-full text-center">
                      {isRefund ? `זיכוי ${method.label}` : method.label}
                    </span>
                    {isOriginal && (
                      <span className="text-[10px] font-black opacity-80 mt-1">מומלץ</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        {/* Footer - Compact */}
        <div className={`p-4 border-t transition-colors ${isDarkMode ? 'bg-slate-800/50 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
          <button
            onClick={handlePayLater}
            disabled={isProcessing}
            className={`w-full py-3 border-2 rounded-xl font-bold text-lg transition shadow-sm flex flex-col items-center justify-center gap-0.5 ${isDarkMode
                ? 'bg-slate-800 border-amber-600 text-amber-500 hover:bg-slate-700'
                : 'bg-white border-amber-400 text-amber-700 hover:bg-amber-50'
              }`}
          >
            <div className="flex items-center gap-2">
              <Clock size={20} />
              <span>שלח למטבח (תשלום אחר כך)</span>
            </div>
            <span className={`text-xs font-medium opacity-70 ${isDarkMode ? 'text-amber-500/80' : 'text-amber-700/80'}`}>ההזמנה תופיע ב-KDS כטרם שולמה</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentSelectionModal;