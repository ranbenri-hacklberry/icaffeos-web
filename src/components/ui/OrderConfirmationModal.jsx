import React, { useEffect } from 'react';
import { PartyPopper, Sparkles, Coffee } from 'lucide-react';

const OrderConfirmationModal = ({ isOpen, orderDetails, onStartNewOrder }) => {
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      onStartNewOrder?.();
    }, 1000); // 🆕 Reduced to 1s as requested

    return () => {
      clearTimeout(timer);
    };
  }, [isOpen, onStartNewOrder]);

  if (!isOpen || !orderDetails) return null;

  const {
    customerName = 'אורח',
    orderNumber,
    total = 0,
    subtotal,
    soldierDiscountAmount = 0,
    loyaltyDiscount = 0,
    loyaltyCoffeeCount,
    loyaltyRewardEarned,
    isPaid,
    isRefund,
    refundAmount,
    isEdit,
    paymentMethod, // 🆕
    businessId // 🆕
  } = orderDetails;

  const NURSERY_BIZ_ID = '8e4e05da-2d99-4bd9-aedf-8e54cbde930a';
  const isNursery = businessId === NURSERY_BIZ_ID;

  const isOTH = paymentMethod === 'oth'; // 🆕 Force 0 for OTH
  const finalDisplayTotal = isOTH ? 0 : total;

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

  const hasDiscounts = soldierDiscountAmount > 0 || loyaltyDiscount > 0;
  const formattedTotal = formatPrice(finalDisplayTotal);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" dir="rtl">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col animate-in fade-in zoom-in duration-300">

        {/* Header Section - Happy & Celebratory */}
        <div className={`p-8 pb-4 flex flex-col items-center text-center space-y-4 ${isRefund ? 'bg-gradient-to-b from-red-50 to-white' : 'bg-gradient-to-b from-green-50 to-white'
          }`}>
          <div className={`w-24 h-24 rounded-full flex items-center justify-center relative ${isRefund ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
            }`}>
            {isRefund ? (
              <Coffee className="w-12 h-12" strokeWidth={2.5} />
            ) : (
              <>
                <PartyPopper className="w-12 h-12" strokeWidth={2.5} />
                <Sparkles className="w-6 h-6 absolute -top-1 -right-1 text-yellow-500 animate-pulse" />
                <Sparkles className="w-5 h-5 absolute -bottom-1 -left-1 text-yellow-400 animate-pulse" />
              </>
            )}
          </div>

          <div className="space-y-2">
            <h2 className="text-3xl font-black text-slate-800">
              {isRefund ? 'זיכוי בוצע! 💰' : isEdit ? 'עודכן בהצלחה! ✨' : 'מעולה! 🎉'}
            </h2>
            <p className="text-lg text-slate-500 font-medium">
              {isRefund
                ? 'הזיכוי בוצע בהצלחה'
                : isEdit
                  ? 'ההזמנה עודכנה והועברה למטבח'
                  : 'ההזמנה התקבלה ומועברת למסך השירות'}
            </p>
          </div>
        </div>

        {/* Main Content */}
        <div className="p-6 space-y-4">

          {/* Order Number & Total Card */}
          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 space-y-3">
            {orderNumber && (
              <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                <span className="text-slate-500 font-bold">מספר הזמנה</span>
                <span className="text-2xl font-black text-slate-800">#{orderNumber}</span>
              </div>
            )}

            {/* Show discounts breakdown if any */}
            {hasDiscounts && subtotal && (
              <div className="space-y-1 text-sm border-b border-slate-200 pb-3">
                <div className="flex justify-between items-center text-slate-500">
                  <span>סה"כ לפני הנחות</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
                {soldierDiscountAmount > 0 && (
                  <div className="flex justify-between items-center text-blue-600">
                    <span>🎖️ הנחת חייל (10%)</span>
                    <span>-{formatPrice(soldierDiscountAmount)}</span>
                  </div>
                )}
                {loyaltyDiscount > 0 && (
                  <div className="flex justify-between items-center text-green-600">
                    <span>🎁 הנחת נאמנות</span>
                    <span>-{formatPrice(loyaltyDiscount)}</span>
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-col items-center pt-1">
              {!isPaid && !isRefund && (
                <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1.5 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">יתרה לתשלום</span>
              )}
              <div className="flex justify-between items-center w-full">
                <span className="text-slate-500 font-bold">
                  {isRefund ? 'סכום לזיכוי' : (isPaid ? 'סה"כ שולם' : 'סה"כ')}
                </span>
                <span className={`text-3xl font-black ${isRefund ? 'text-red-600' : (isPaid ? 'text-green-600' : 'text-blue-600')}`}>
                  {isRefund ? `${formatPrice(refundAmount)}-` : formattedTotal}
                </span>
              </div>
            </div>
          </div>

          {/* Unpaid Warning Note */}
          {!isPaid && !isRefund && (
            <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4 flex items-start gap-3 animate-pulse">
              <span className="text-2xl">📢</span>
              <div className="flex-1">
                <p className="text-blue-800 font-black text-sm mb-1">הזמנה לא שולמה!</p>
                <p className="text-blue-700 text-xs font-bold leading-relaxed">
                  ניתן לחזור להזמנה בכל זמן כדי לסיים את התשלום דרך <span className="underline decoration-2 underline-offset-2">מסך השירות</span>.
                </p>
              </div>
            </div>
          )}

          {/* Nursery Payment Instructions */}
          {isNursery && !isRefund && (
            <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-5 flex flex-col items-center gap-2 text-center shadow-sm">
              <span className="text-3xl">📱</span>
              <div className="space-y-1">
                <p className="text-emerald-900 font-black text-lg">פרטי תשלום</p>
                <p className="text-emerald-800 font-bold text-sm">נא להעביר תשלום בביט או פייבוקס</p>
                <div className="bg-white px-4 py-2 rounded-xl border border-emerald-100 mt-2">
                  <p className="text-emerald-900 font-black text-xl tracking-wider">055-6822072</p>
                  <p className="text-emerald-600 text-xs font-bold uppercase tracking-widest mt-0.5">נתנאל - שפת המדבר</p>
                </div>
              </div>
            </div>
          )}

          {/* Loyalty Status Card */}
          {typeof loyaltyCoffeeCount === 'number' && (
            <div className={`rounded-2xl p-5 border-2 text-center ${loyaltyRewardEarned
              ? 'bg-green-50 border-green-200 shadow-[0_0_15px_-3px_rgba(34,197,94,0.2)]'
              : 'bg-amber-50 border-amber-200'
              }`}>
              <p className={`text-base font-bold mb-2 ${loyaltyRewardEarned ? 'text-green-700' : 'text-amber-700'
                }`}>
                {loyaltyRewardEarned
                  ? '🎉 איזה כיף! הקפה הבא עלינו!'
                  : 'הכרטיסייה מתקדמת!'}
              </p>

              <div className="flex justify-center items-end gap-2">
                <span className={`text-4xl font-black ${loyaltyRewardEarned ? 'text-green-600' : 'text-amber-600'
                  }`}>
                  {Math.min(loyaltyCoffeeCount, 10)}
                </span>
                <span className={`text-lg font-bold mb-1 ${loyaltyRewardEarned ? 'text-green-400' : 'text-amber-400'
                  }`}>/10</span>
              </div>

              {!loyaltyRewardEarned && (
                <p className="text-xs font-medium text-amber-600/80 mt-1">
                  עוד {Math.max(0, 10 - Math.min(loyaltyCoffeeCount, 10))} לקפה מתנה ☕
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 bg-gradient-to-t from-slate-100 to-slate-50 border-t border-slate-100 flex flex-col items-center gap-4">
          <button
            onClick={() => onStartNewOrder?.()}
            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold text-xl hover:bg-slate-800 transition shadow-lg active:scale-[0.98]"
          >
            הזמנה חדשה
          </button>
          <p className="text-sm font-bold text-slate-400 flex items-center justify-center gap-2">
            <span className="animate-spin inline-block">⏳</span>
            חוזרים למסך הראשי...
          </p>
        </div>
      </div>
    </div>
  );
};

export default OrderConfirmationModal;
