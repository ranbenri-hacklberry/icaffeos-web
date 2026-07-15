import React, { useMemo } from 'react';
import Button from '@/components/ui/Button';
import Icon from '@/components/AppIcon';
import { useTheme } from '@/context/ThemeContext';

const CheckoutButton = ({
  cartTotal = 0,
  originalTotal, // Subtotal before discount
  loyaltyDiscount = 0,
  cartItems = [],
  onInitiatePayment,
  disabled = false,
  className = "",
  isEditMode = false,
  editingOrderData = null,
  businessId = null
}) => {
  const NURSERY_BIZ_ID = '8e4e05da-2d99-4bd9-aedf-8e54cbde930a';
  const MIN_ORDER_TOTAL = 190;
  const { isDarkMode } = useTheme();
  // Format price to Israeli Shekel (ILS) - show agorot if present
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

  // Handler for payment/update action
  const handlePaymentClick = () => {
    // A refund scenario is allowed even if cartTotal is 0 (total difference is negative)
    if (onInitiatePayment && cartItems.length > 0 && (cartTotal > 0 || isRefund || loyaltyDiscount > 0)) {
      const orderData = {
        items: cartItems,
        total: cartTotal,
        // Using correct data fields for editingOrderData structure, if available
        originalTotal: editingOrderData?.totalAmount,
        timestamp: new Date().toISOString(),
        orderNumber: editingOrderData?.orderNumber || `ORD-${Date.now()}`,
        itemCount: cartItems.reduce((count, item) => count + item.quantity, 0),
        isEdit: isEditMode,
      };
      onInitiatePayment(orderData);
    }
  };

  // --- Updated Logic for Edit Mode ---
  const originalTotalAmount = editingOrderData?.totalAmount || 0;
  const originalIsPaid = editingOrderData?.isPaid || false;

  // The difference: Positive means additional charge, Negative means refund
  const priceDifference = cartTotal - originalTotalAmount;

  // 1. Is it a Refund? (Paid order, and new total is lower)
  const isRefund = isEditMode && originalIsPaid && priceDifference < 0;

  // 🛒 Nursery Validation: Minimum Order
  const isNursery = businessId === NURSERY_BIZ_ID;
  const isMinOrderValid = !isNursery || cartTotal >= MIN_ORDER_TOTAL || isEditMode;

  const isDisabled = disabled || (cartItems.length === 0 && !isRefund) || !isMinOrderValid;

  // 2. Is it an Additional Charge? (Paid order, and new total is higher)
  const isAdditionalCharge = isEditMode && originalIsPaid && priceDifference > 0;

  // 3. Is it a Finalization? (Unpaid order, just finishing payment)
  const isFinalizingOrder = isEditMode && !originalIsPaid;

  // 4. Is it an Update with No Payment Change? (Paid order, and total is the same)
  const isNoChangeUpdate = isEditMode && originalIsPaid && priceDifference === 0;

  // Text displayed on the button
  const buttonText = useMemo(() => {
    if (isNursery && cartTotal > 0 && cartTotal < MIN_ORDER_TOTAL && !isEditMode) {
      return 'מינימום להזמנה ומשלוח: 190 ₪';
    }

    if (isDisabled) return 'הוסף פריטים להזמנה';

    if (!isEditMode) return 'המשך לתשלום';

    // --- Edit Mode States ---
    if (isRefund) return 'החזר כספי';
    if (isAdditionalCharge) return 'חיוב נוסף';
    if (isFinalizingOrder) return 'לתשלום';
    if (isNoChangeUpdate) return 'עדכן הזמנה';

    return 'עדכן הזמנה'; // Default for edit mode if cartTotal > 0
  }, [isDisabled, isEditMode, isRefund, isAdditionalCharge, isFinalizingOrder, isNoChangeUpdate]);

  // Amount displayed on the button
  const buttonAmount = useMemo(() => {
    // Only display an amount if we are not disabled and not in regular checkout with 0 total
    if (isDisabled && !isEditMode && cartTotal <= 0 && loyaltyDiscount === 0) return '';

    if (isRefund) return formatPrice(Math.abs(priceDifference)); // Refund: Display the positive difference
    if (isAdditionalCharge) return formatPrice(priceDifference); // Additional Charge: Display the positive difference

    // In other cases (Finalizing, No Change Update, Regular Checkout) - Display the total cart amount
    return formatPrice(cartTotal);
  }, [isDisabled, isEditMode, isRefund, isAdditionalCharge, cartTotal, priceDifference, loyaltyDiscount]);

  // Dynamic Tailwind Classes for button color/style
  const buttonVariantClass = useMemo(() => {
    if (isDisabled) return 'bg-gray-300 text-gray-500 cursor-not-allowed border-gray-300';
    // Refund: Red background
    if (isEditMode && isRefund) return 'bg-red-500 hover:bg-red-600 text-white animate-scale-touch shadow-kiosk hover:shadow-kiosk-lg';

    // Nursery Min Order violation: Red background
    if (isNursery && cartTotal > 0 && cartTotal < MIN_ORDER_TOTAL && !isEditMode) {
      return 'bg-red-600 text-white shadow-kiosk opacity-100 cursor-not-allowed';
    }

    // Charge/Finalize/Regular: Orange (Primary Action)
    if (isAdditionalCharge || isFinalizingOrder || !isEditMode) return 'bg-orange-500 hover:bg-orange-600 text-white animate-scale-touch shadow-kiosk hover:shadow-kiosk-lg';
    // No change update: Gray/default
    return 'bg-gray-500 hover:bg-gray-600 text-white animate-scale-touch shadow-kiosk hover:shadow-kiosk-lg';
  }, [isDisabled, isEditMode, isRefund, isAdditionalCharge, isFinalizingOrder]);

  return (
    <div className={`fixed bottom-0 left-0 right-0 p-4 z-40 lg:static lg:z-auto transition-colors duration-300 ${isDarkMode ? 'bg-slate-900 border-t border-slate-800' : 'bg-white border-t border-gray-200'
      } ${className}`} dir="rtl">

      {/* Payment Information for Paid Orders */}
      {isEditMode && originalIsPaid && (
        <div className={`flex flex-col gap-2 mb-3 border rounded-xl p-3 shadow-sm transition-colors ${isDarkMode ? 'bg-blue-900/20 border-blue-900/30' : 'bg-blue-50 border-blue-100'
          }`}>
          <div className="flex justify-between items-center">
            <span className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>סטטוס תשלום</span>
            <span className="flex items-center gap-1.5 px-2 py-0.5 bg-green-500 text-white text-[10px] font-black rounded-full">
              <Icon name="CheckCircle" size={10} /> שולם
            </span>
          </div>
          <div className="flex justify-between items-end">
            <div>
              <p className={`text-xs font-medium opacity-70 ${isDarkMode ? 'text-blue-300' : 'text-blue-700'}`}>אמצעי תשלום</p>
              <p className={`text-sm font-black ${isDarkMode ? 'text-blue-100' : 'text-blue-900'}`}>
                {editingOrderData?.paymentMethod === 'cash' ? '💵 מזומן' :
                  editingOrderData?.paymentMethod === 'credit_card' ? '💳 כרטיס אשראי' :
                    '📱 תשלום דיגיטלי'}
              </p>
            </div>
            <div className="text-right">
              <p className={`text-xs font-medium opacity-70 ${isDarkMode ? 'text-blue-300' : 'text-blue-700'}`}>סכום ששולם</p>
              <p className={`text-xl font-mono font-black ${isDarkMode ? 'text-white' : 'text-blue-900'}`}>{formatPrice(originalTotalAmount)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Refund Note */}
      {isRefund && (
        <div className={`flex justify-between items-center mb-3 px-3 py-2 text-sm font-bold border rounded-xl shadow-sm animate-pulse transition-colors ${isDarkMode ? 'bg-red-900/20 border-red-900/30 text-red-400' : 'bg-red-50 border-red-100 text-red-700'
          }`}>
          <span className="flex items-center gap-2">↩️ החזר ללקוח</span>
          <span className={`px-2 py-0.5 rounded dir-ltr ${isDarkMode ? 'bg-slate-800 text-red-400' : 'bg-white text-red-800'}`}>{formatPrice(Math.abs(priceDifference))}</span>
        </div>
      )}

      {/* Additional Charge Note */}
      {isAdditionalCharge && (
        <div className={`flex justify-between items-center mb-3 px-3 py-2 text-sm font-bold border rounded-xl shadow-sm transition-colors ${isDarkMode ? 'bg-orange-900/20 border-orange-900/30 text-orange-400' : 'bg-orange-50 border-orange-100 text-orange-700'
          }`}>
          <span className="flex items-center gap-2">💳 הפרש לתשלום נוסף</span>
          <span className={`px-2 py-0.5 rounded dir-ltr ${isDarkMode ? 'bg-slate-800 text-orange-400' : 'bg-white text-orange-800'}`}>+{formatPrice(priceDifference)}</span>
        </div>
      )}

      {/* Loyalty Discount Badge */}
      {loyaltyDiscount > 0 && (
        <div className={`flex justify-between items-center mb-3 px-3 py-2 text-sm font-bold border rounded-xl shadow-sm transition-colors ${isDarkMode ? 'bg-green-900/20 border-green-900/30 text-green-400' : 'bg-green-50 border-green-100 text-green-700'
          }`}>
          <span className="flex items-center gap-2">🎁 הנחת נאמנות</span>
          <span className={`px-2 py-0.5 rounded dir-ltr ${isDarkMode ? 'bg-slate-800 text-green-400' : 'bg-white text-green-800'}`}>-{formatPrice(loyaltyDiscount)}</span>
        </div>
      )}

      {/* Payment Button */}
      <Button
        variant="default"
        size="xl"
        fullWidth
        disabled={isDisabled && !isRefund}
        className={`
          ${buttonVariantClass}
          touch-target transition-all duration-200 font-extrabold text-xl min-h-[64px] rounded-xl
        `}
        iconName={isNoChangeUpdate ? "ArrowLeft" : (isDisabled && !isRefund ? "ShoppingCart" : "CreditCard")}
        iconPosition="right"
        iconSize={24}
        onClick={handlePaymentClick}
      >
        <div className="flex items-center justify-between w-full">
          <span>{buttonText}</span>
          {/* The amount only shows if we are in edit mode (excluding no-change) OR if it's a regular checkout */}
          <span className={`font-mono text-2xl ${(isDisabled && !isEditMode) || isNoChangeUpdate ? 'hidden' : ''
            }`}>
            {buttonAmount}
          </span>
        </div>
      </Button>

      {/* Payment Methods Info */}
      {/* Show payment methods only in regular checkout mode */}
      {!isDisabled && !isEditMode && (
        <div className={`flex items-center justify-center space-x-6 text-xs rounded-lg p-3 mt-3 transition-colors ${isDarkMode ? 'bg-slate-800 text-slate-500' : 'bg-gray-50 text-gray-400'
          }`}>
          <div className="flex items-center space-x-1">
            <Icon name="CreditCard" size={14} />
            <span>כרטיס אשראי</span>
          </div>
          <div className="flex items-center space-x-1">
            <Icon name="Smartphone" size={14} />
            <span>Apple Pay</span>
          </div>
          <div className="flex items-center space-x-1">
            <Icon name="Banknote" size={14} />
            <span>מזומן</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default CheckoutButton;