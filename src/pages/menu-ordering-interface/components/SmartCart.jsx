import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
    X, Trash2, ShoppingBasket, ShoppingCart, ShoppingBag, Truck,
    ArrowLeft, ArrowRight, User, Phone,
    Plus, Minus, Clock, Check, AlertCircle,
    RotateCcw, Edit2, RefreshCw, CreditCard
} from 'lucide-react';
import Button from '../../../components/ui/Button';
import Icon from '../../../components/AppIcon';
import { useTheme } from '../../../context/ThemeContext';
import { getShortName, getModColorClass } from '../../../config/modifierShortNames';

/**
 * ⚠️⚠️⚠️ WARNING - DO NOT EDIT ⚠️⚠️⚠️
 * 🚨🚨🚨 אין לערוך קובץ זה ללא אישור מפורש של המשתמש! 🚨🚨🚨
 * 🔒 LOCKED FILE - Changes require explicit user approval
 * 📆 Last approved edit: 2025-12-30
 */
const PAYMENT_LABELS = {
    cash: 'מזומן',
    credit_card: 'אשראי',
    bit: 'ביט',
    paybox: 'פייבוקס',
    gift_card: 'שובר',
    oth: 'ע״ח הבית',
};

const formatPrice = (price = 0) => {
    // מחזיר מספר עם אגורות אם יש (לדוגמה: 8.10)
    const num = Number(price);
    if (isNaN(num)) return '0';
    // If it has decimals, show 2 decimal places. Otherwise show as integer.
    const hasDecimals = num % 1 !== 0;
    return new Intl.NumberFormat('he-IL', {
        minimumFractionDigits: hasDecimals ? 2 : 0,
        maximumFractionDigits: 2
    }).format(num);
};

// Memoized CartItem to prevent unnecessary re-renders
const CartItem = React.memo(({ item, onRemove, onEdit, onToggleDelay, isRestrictedMode }) => {
    const { isDarkMode } = useTheme();
    const cleanName = item.name ? item.name.replace(/<[^>]+>/g, '').trim() : '';

    // Parse modifiers for display - remove duplicates
    const mods = useMemo(() => {
        let rawMods = [];
        if (Array.isArray(item.selectedOptions)) {
            rawMods = item.selectedOptions;
        } else if (item.mods) {
            try {
                const parsed = typeof item.mods === 'string' ? JSON.parse(item.mods) : item.mods;
                if (Array.isArray(parsed)) rawMods = parsed;
                else if (typeof parsed === 'object') rawMods = Object.values(parsed);
            } catch (e) {
                console.error('SmartCart: Failed to parse item.mods', { itemId: item.id || item.tempId, modsString: item.mods, error: e });
                rawMods = []; // fallback בטוח
            }
        }

        const modNames = rawMods
            .map(m => {
                if (typeof m === 'object') return m.valueName || m.name;
                return m;
            })
            .filter(Boolean)
            .filter(modName => {
                const lower = String(modName).toLowerCase();
                return !lower.includes('רגיל') &&
                    !lower.includes('default') &&
                    !lower.includes('standard') &&
                    !lower.includes('kds_override') &&
                    !lower.includes('kds_over') &&
                    lower.trim() !== '';
            });

        return [...new Set(modNames)];
    }, [item]);

    return (
        <div
            onClick={() => !isRestrictedMode && onEdit?.(item)}
            className={`group flex items-center justify-between px-[5px] py-3 border-b transition-colors gap-[5px] 
                ${isDarkMode
                    ? `border-slate-800 ${item.isDelayed ? 'bg-amber-900/20' : 'bg-slate-900'} ${!isRestrictedMode ? 'hover:bg-slate-800' : ''}`
                    : `border-gray-100 ${item.isDelayed ? 'bg-amber-50/50' : 'bg-white'} ${!isRestrictedMode ? 'hover:bg-gray-50' : ''}`
                } 
                ${!isRestrictedMode ? 'cursor-pointer' : ''}`}
        >
            {/* Right Side: Quantity + Name + Mods */}
            <div className="flex-1 flex flex-col items-start min-w-0">
                <div className="flex items-center gap-[5px] w-full">
                    {item.quantity > 1 && (
                        <span className="bg-orange-100 text-orange-700 text-xs font-bold px-1 rounded border border-orange-200 shrink-0">
                            x{item.quantity}
                        </span>
                    )}
                    <span className={`font-bold text-base truncate leading-tight ${item.isDelayed
                        ? (isDarkMode ? 'text-amber-400' : 'text-amber-800')
                        : (isDarkMode ? 'text-slate-200' : 'text-gray-800')
                        }`}>
                        {cleanName}
                    </span>
                    {onEdit && !isRestrictedMode && (
                        <Edit2 size={14} className="text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    )}
                    <span className={`font-mono font-bold text-base shrink-0 mr-auto ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        {formatPrice(item.price * item.quantity)}
                    </span>
                </div>

                {/* Mods in a single line if possible */}
                {mods.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1 pr-0.5">
                        {mods.map((mod, i) => {
                            const shortName = getShortName(mod);
                            if (!shortName) return null; // Hide default mods
                            return (
                                <span key={i} className={`mod-label ${getModColorClass(mod, shortName)}`} title={mod}>
                                    {shortName}
                                </span>
                            );
                        })}
                    </div>
                )}

                {item.notes && (
                    <p className="text-[11px] text-amber-600 mt-0.5 flex items-center gap-1">
                        <Edit2 size={10} />
                        {item.notes}
                    </p>
                )}
            </div>

            {/* Left Side: Actions */}
            <div className="flex items-center gap-2 pl-1">
                {/* Delay Toggle Button */}
                {onToggleDelay && !isRestrictedMode && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onToggleDelay(item.id, item.signature); }}
                        className={`p-3 rounded-xl transition-all shrink-0 shadow-sm border active:scale-95 ${item.isDelayed
                            ? 'text-white bg-amber-500 border-amber-600 hover:bg-amber-600 shadow-amber-200'
                            : (isDarkMode
                                ? 'text-slate-400 bg-slate-800 border-slate-700 hover:text-amber-400 hover:bg-slate-700'
                                : 'text-gray-400 bg-white border-gray-200 hover:text-amber-500 hover:bg-amber-50 hover:border-amber-200')
                            }`}
                        title={item.isDelayed ? "הכן עכשיו" : "הגש אחר כך (מנה שניה)"}
                    >
                        <Clock size={24} strokeWidth={2.5} className={item.isDelayed ? "fill-white/20" : ""} />
                    </button>
                )}

                {onRemove && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onRemove(item.id, item.signature); }}
                        className={`p-3 rounded-xl border border-transparent transition-colors shrink-0 ${isDarkMode
                            ? 'text-slate-500 hover:text-red-400 hover:bg-red-900/20 hover:border-red-900/30'
                            : 'text-gray-400 hover:text-red-500 hover:bg-red-50 hover:border-red-100'
                            }`}
                    >
                        <Trash2 size={24} strokeWidth={2} />
                    </button>
                )}
            </div>
        </div>
    );
});

const SmartCart = ({
    cartItems = [],
    onRemoveItem,
    onUndoCart,
    onEditItem,
    onInitiatePayment,
    onToggleDelay,
    onAddCustomerDetails,
    onSetDelivery, // NEW: Handler for delivery address
    className = '',
    isEditMode = false,
    editingOrderData,
    disabled = false,
    customerName,
    customerPhone, // Added
    loyaltyDiscount = 0,
    finalTotal,
    loyaltyPoints = 0,
    loyaltyFreeCoffees = 0,
    cartHistory = [],
    orderNumber,
    isRestrictedMode = false, // New prop
    // Soldier discount props
    soldierDiscountEnabled = false,
    onToggleSoldierDiscount,
    soldierDiscountAmount = 0
}) => {
    const { isDarkMode } = useTheme();

    // --- Calculations ---
    const currentTotal = cartItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    const itemCount = cartItems.reduce((sum, i) => sum + i.quantity, 0);

    // Split items into active and delayed
    const activeItems = useMemo(() => cartItems.filter(i => !i.isDelayed), [cartItems]);
    const delayedItems = useMemo(() => cartItems.filter(i => i.isDelayed), [cartItems]);

    // Use passed finalTotal if available, otherwise calculate
    const effectiveTotal = finalTotal !== undefined ? finalTotal : currentTotal;

    // [CLEANED] console.log('🔍 SmartCart finalTotal check:', {
    // [CLEANED]     finalTotal,
    // [CLEANED]     currentTotal,
    // [CLEANED]     effectiveTotal,
    // [CLEANED]     loyaltyDiscount
    // [CLEANED] });

    const originalTotal = editingOrderData?.originalTotal || 0;
    const originalIsPaid = editingOrderData?.isPaid || false;

    // For edit mode, compare against the amount actually paid (after all discounts including loyalty)
    // originalTotal already contains the post-discount amount from the DB
    const originalPaidAmount = editingOrderData?.originalPaidAmount ?? originalTotal;
    const priceDifference = effectiveTotal - originalPaidAmount;

    // --- Status Logic ---
    // --- Status Logic ---
    const isRefund = isEditMode && originalIsPaid && priceDifference < 0;
    const isAdditionalCharge = isEditMode && originalIsPaid && priceDifference > 0;
    const isNoChange = isEditMode && originalIsPaid && priceDifference === 0;
    // New: Cancel Order if Unpaid + Empty
    const isCancelOrder = isEditMode && !originalIsPaid && cartItems.length === 0;

    // [CLEANED] console.log('🛒 SmartCart Debug:', {
    // [CLEANED]     isEditMode,
    // [CLEANED]     originalIsPaid,
    // [CLEANED]     originalTotal,
    // [CLEANED]     effectiveTotal,
    // [CLEANED]     priceDifference,
    // [CLEANED]     isRefund,
    // [CLEANED]     isCancelOrder,
    // [CLEANED]     cartItemsCount: cartItems.length
    // [CLEANED] });

    // האם בוצע שינוי כלשהו מאז פתיחת העריכה?
    const hasChanges = cartHistory.length > 0;

    // מצב שבו אין שינוי במחיר בעריכה
    const isNoPriceChange = isEditMode && priceDifference === 0;

    // אפשר לחיצה אם זה זיכוי, אם זה ביטול, או אם יש שינוי כלשהו
    // עבור הזמנה שלא שולמה (PAYMENT PENDING), תמיד נאפשר לחיצה כדי להגיע לתשלום (אלא אם ריקה)
    const isDisabled = disabled ||
        (cartItems.length === 0 && !isRefund && !isCancelOrder) ||
        (isEditMode && originalIsPaid && isNoPriceChange && !hasChanges);

    // DEBUG: Log status decision values
    // [CLEANED] console.log('🎯 SmartCart Status Decision:', {
    // [CLEANED] isDisabled,
    // [CLEANED]     isRefund,
    // [CLEANED]     isAdditionalCharge,
    // [CLEANED]     isNoChange,
    // [CLEANED]     isCancelOrder,
    // [CLEANED]     isEditMode,
    // [CLEANED]     originalIsPaid,
    // [CLEANED]     priceDifference
    // [CLEANED] });

    // --- UI Config ---
    const statusConfig = useMemo(() => {
        // עגלה ריקה באמת (לא בעריכה של הזמנה קיימת)
        if (cartItems.length === 0 && !isEditMode) return {
            text: 'העגלה ריקה',
            subtext: 'הוסף פריטים כדי להמשיך',
            color: isDarkMode ? 'bg-slate-800/50 text-slate-500' : 'bg-gray-100 text-gray-400',
            buttonColor: isDarkMode
                ? 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed',
            icon: ShoppingBag,
            amount: null
        };

        if (isCancelOrder) return {
            text: 'בטל הזמנה',
            subtext: 'העגלה ריקה - ביטול ימחק את ההזמנה',
            color: 'bg-red-50 border-red-100',
            buttonColor: 'bg-red-500 hover:bg-red-600 text-white shadow-red-200',
            amount: null,
            icon: Trash2
        };

        if (isRefund) return {
            text: 'החזר ללקוח',
            subtext: `החזר כספי על סך ${formatPrice(Math.abs(priceDifference))}`,
            color: 'bg-red-50 border-red-100',
            buttonColor: 'bg-red-500 hover:bg-red-600 text-white shadow-red-200',
            amount: Math.abs(priceDifference),
            icon: RefreshCw
        };

        if (isAdditionalCharge) return {
            text: 'חיוב נוסף',
            subtext: `תוספת לתשלום: ${formatPrice(priceDifference)}`,
            color: 'bg-blue-50 border-blue-100',
            buttonColor: 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200',
            amount: priceDifference,
            icon: CreditCard
        };

        // New: Unpaid Order Edit - ALWAYS allow payment
        if (isEditMode && !originalIsPaid) return {
            text: 'לתשלום',
            subtext: 'השלמת הזמנה',
            color: 'bg-white',
            buttonColor: 'bg-orange-500 hover:bg-orange-600 text-white shadow-orange-200',
            amount: effectiveTotal,
            icon: CreditCard
        };

        if (isNoPriceChange && isEditMode) return {
            text: originalIsPaid ? 'שולם' : 'עדכון הזמנה',
            paymentLabel: originalIsPaid ? (PAYMENT_LABELS[editingOrderData?.paymentMethod] || editingOrderData?.paymentMethod) : null,
            subtext: hasChanges ? 'לחץ לשמירת שינויים' : 'ללא שינוי במחיר',
            color: 'bg-white',
            buttonColor: hasChanges
                ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-orange-200'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed',
            amount: effectiveTotal,
            icon: originalIsPaid ? Check : Edit2
        };

        return {
            text: 'לתשלום',
            subtext: `${itemCount} פריטים`,
            color: 'bg-white',
            buttonColor: 'bg-orange-500 hover:bg-orange-600 text-white shadow-orange-200',
            amount: effectiveTotal,
            icon: ArrowRight
        };
    }, [isDisabled, isRefund, isAdditionalCharge, isNoPriceChange, isEditMode, priceDifference, effectiveTotal, itemCount, editingOrderData, originalIsPaid, originalTotal, cartItems.length, hasChanges]);

    const handleAction = () => {
        if (!isDisabled && onInitiatePayment) {
            onInitiatePayment();
        }
    };

    // Calculate dynamic loyalty count
    const points = loyaltyPoints ?? 0;
    const credits = loyaltyFreeCoffees ?? 0;

    const showCredits = credits > 0;
    const progressToNext = points % 10;

    // Helper to determine if we have a REAL customer (ignoring "Quick Order" or anonymous placeholders)
    const hasRealCustomer = useMemo(() => {
        if (!customerName) return false;
        const name = String(customerName).trim();
        if (name === 'הזמנה מהירה') return false;
        if (name === 'אורח' || name.includes('אורח אנונימי') || name === 'אורח/ת') return false;
        return true;
    }, [customerName]);

    // DEBUG: Check why button isn't showing
    // [CLEANED] console.log('🛒 SmartCart Debug:', {
    // [CLEANED] hasCustomerName: !!customerName,
    // [CLEANED]     customer_name: customerName,
    // [CLEANED]     hasRealCustomer,
    // [CLEANED]     hasAddHandler: !!onAddCustomerDetails
    // [CLEANED]     });

    return (
        <div className={`flex flex-col h-full ${isDarkMode ? 'bg-slate-900' : 'bg-white'} ${className}`}>
            {/* Header */}
            <div className={`p-4 border-b ${isDarkMode ? 'border-slate-800 bg-slate-900 shadow-black/20' : 'border-gray-100 bg-white shadow-sm'} z-10 shadow-sm transition-colors duration-300`}>
                {/* Single row header with wrap support for small screens */}
                <div className="flex items-center gap-2 flex-wrap">

                    {/* Logic: If name is 'Anonymous Guest', treat as no customer */}
                    {(() => {
                        const isAnonymous = !customerName || customerName.includes('אורח אנונימי') || customerName === 'אורח';
                        const isValidPhone = customerPhone && /^[0-9+\-\s]+$/.test(customerPhone) && customerPhone.length < 15;
                        const showAddButtons = !isValidPhone;

                        return (
                            <>
                                {/* Case: No valid customer (or anonymous) - Show buttons */}
                                {showAddButtons ? (
                                    <>
                                        {/* If we have a valid name but no phone, show name - RIGHTMOST */}
                                        {!isAnonymous && (
                                            <h2 className={`text-xl font-black tracking-tight flex-shrink-0 ml-1 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                                                {customerName}
                                            </h2>
                                        )}

                                        {/* Phone Button */}
                                        {onAddCustomerDetails && (
                                            <button
                                                onClick={() => onAddCustomerDetails('phone-then-name')}
                                                className="px-3 py-2 rounded-lg bg-orange-500 text-white shadow-sm hover:bg-orange-600 transition-all font-bold text-sm flex items-center gap-1.5 flex-grow justify-center sm:flex-grow-0"
                                            >
                                                <Phone size={16} />
                                                <span>טלפון</span>
                                            </button>
                                        )}

                                        {/* Name Button - only if name is missing/anonymous */}
                                        {isAnonymous && onAddCustomerDetails && (
                                            <button
                                                onClick={() => onAddCustomerDetails('name')}
                                                className={`px-3 py-2 rounded-lg border transition-all font-bold text-sm flex items-center gap-1.5 flex-grow justify-center sm:flex-grow-0 ${isDarkMode
                                                    ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                                                    : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
                                                    }`}
                                            >
                                                <User size={16} />
                                                <span>שם</span>
                                            </button>
                                        )}

                                        {/* Delivery Button - NEW (HIDDEN TEMPORARILY) */}
                                        {/* {onSetDelivery && (
                                            <button
                                                onClick={() => onSetDelivery()}
                                                className={`px-3 py-2 rounded-lg border transition-all font-bold text-sm flex items-center gap-1.5 flex-grow justify-center sm:flex-grow-0 ${isDarkMode
                                                    ? 'bg-purple-900/30 text-purple-300 border-purple-800/50 hover:bg-purple-900/50'
                                                    : 'bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-200'
                                                    }`}
                                            >
                                                <Truck size={16} />
                                                <span>משלוח</span>
                                            </button>
                                        )} */}
                                    </>
                                ) : (
                                    /* Case: Valid Customer with Phone */
                                    <div className="flex items-center gap-3 w-full sm:w-auto">
                                        <div className="flex flex-col">
                                            <h2 className={`text-xl font-black tracking-tight leading-none ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                                                {customerName}
                                            </h2>
                                            <div className="flex items-center gap-2 text-gray-500 text-sm font-mono mt-0.5">
                                                <Phone size={12} />
                                                <span>{customerPhone}</span>
                                            </div>
                                        </div>

                                        {onAddCustomerDetails && (
                                            <button
                                                onClick={() => onAddCustomerDetails('phone-then-name')}
                                                className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'bg-slate-800 text-blue-400 hover:bg-slate-700' : 'bg-gray-50 text-blue-600 hover:bg-blue-50'
                                                    }`}
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                )}

                                {/* Soldier Discount Button - Far Left in RTL */}
                                <div className="mr-auto">
                                    {onToggleSoldierDiscount && !isRestrictedMode && (
                                        <button
                                            onClick={onToggleSoldierDiscount}
                                            className={`px-3 py-2 rounded-lg font-bold text-sm flex items-center gap-1.5 transition-all text-nowrap ${soldierDiscountEnabled
                                                ? 'bg-blue-600 text-white shadow-sm'
                                                : isDarkMode
                                                    ? 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'
                                                    : 'bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100'
                                                }`}
                                        >
                                            <span>🎖️</span>
                                            <span>{soldierDiscountEnabled ? 'חייל✓' : 'חייל'}</span>
                                        </button>
                                    )}
                                </div>

                            </>
                        );
                    })()}
                </div>

                {/* Loyalty Badge - Below main row */}
                {hasRealCustomer && (() => {
                    // Calculate projected points
                    let cartCoffeeCount = cartItems.reduce((sum, item) =>
                        item.is_hot_drink ? sum + (item.quantity || 1) : sum, 0);

                    // In edit mode where original had discount, only count NEW items
                    const originalHadDiscount = isEditMode && editingOrderData?.originalRedeemedCount > 0;
                    if (originalHadDiscount) {
                        const originalCoffeeCount = editingOrderData?.originalItems
                            ?.filter(i => i.is_hot_drink)
                            ?.reduce((sum, i) => sum + i.quantity, 0) || 0;
                        // Only count items BEYOND the original
                        cartCoffeeCount = Math.max(0, cartCoffeeCount - originalCoffeeCount);
                    }

                    // Current state - ONLY USE POINTS
                    const currentPoints = loyaltyPoints ?? 0;
                    const totalPoints = currentPoints + cartCoffeeCount;

                    let displayContent;
                    let badgeStyle;

                    if (totalPoints >= 10) {
                        displayContent = (
                            <>
                                <span>🎉</span>
                                <span>10/10 מגיע לך קפה חינם!</span>
                            </>
                        );
                        badgeStyle = 'bg-green-50 text-green-700 border-green-100 animate-pulse';
                    } else if (totalPoints === 9) {
                        displayContent = (
                            <>
                                <span>☕</span>
                                <span>9/10 הקפה הבא חינם!</span>
                            </>
                        );
                        badgeStyle = 'bg-orange-50 text-orange-700 border-orange-100';
                    } else {
                        displayContent = (
                            <>
                                <span>☕</span>
                                <span>{totalPoints}/10 לקפה חינם</span>
                            </>
                        );
                        badgeStyle = 'bg-orange-50 text-orange-700 border-orange-100';
                    }

                    return (
                        <div className="mt-2">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 w-fit ${badgeStyle}`}>
                                {displayContent}
                            </span>
                        </div>
                    );
                })()}
            </div>


            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {cartItems.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center opacity-60">
                        <ShoppingBag size={48} className={isDarkMode ? 'text-slate-700 mb-4' : 'text-gray-300 mb-4'} />
                        <p className={isDarkMode ? 'text-slate-400 font-medium' : 'text-gray-500 font-medium'}>העגלה ריקה</p>
                        <p className={isDarkMode ? 'text-slate-500 text-sm' : 'text-gray-400 text-sm'}>התחל להוסיף פריטים מהתפריט</p>
                    </div>
                ) : (
                    <div className="space-y-1">
                        {/* Active Items */}
                        {activeItems.map(item => {
                            const itemId = item.tempId || item.signature || uuidv4(); // fallback אחרון
                            return (
                                <CartItem
                                    key={itemId}
                                    item={item}
                                    onRemove={() => onRemoveItem(item.id, item.signature, item.tempId || itemId)}
                                    onEdit={onEditItem}
                                    onToggleDelay={() => onToggleDelay?.(item.id, item.signature, item.tempId || itemId)}
                                />
                            );
                        })}

                        {/* Divider if both lists have items */}
                        {activeItems.length > 0 && delayedItems.length > 0 && (
                            <div className="relative py-4 text-center">
                                <div className="absolute inset-0 flex items-center">
                                    <div className={`w-full border-t border-dashed ${isDarkMode ? 'border-amber-700' : 'border-amber-300'}`}></div>
                                </div>
                                <span className={`relative px-3 text-xs font-bold flex items-center justify-center gap-1 mx-auto w-fit rounded-full border shadow-sm transition-colors duration-300 ${isDarkMode
                                    ? 'bg-slate-900 text-amber-500 border-amber-800'
                                    : 'bg-gray-50 text-amber-600 border-amber-200'}`}>
                                    <Clock size={12} />
                                    להמשך הארוחה
                                </span>
                            </div>
                        )}

                        {/* Delayed Items */}
                        {delayedItems.map(item => {
                            const itemId = item.tempId || item.signature || uuidv4(); // fallback אחרון
                            return (
                                <CartItem
                                    key={itemId}
                                    item={item}
                                    onRemove={() => onRemoveItem(item.id, item.signature, item.tempId || itemId)}
                                    onEdit={onEditItem}
                                    onToggleDelay={() => onToggleDelay?.(item.id, item.signature, item.tempId || itemId)}
                                />
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Footer / Action Area */}
            <div className={`p-4 border-t shadow-[0_-4px_20px_rgba(0,0,0,0.05)] transition-colors duration-300 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-200'
                }`}>

                {/* Refund Note - only show if there are items */}
                {isRefund && cartItems.length > 0 && (
                    <div className="flex justify-between items-center mb-3 px-1 bg-red-50 p-2 rounded-lg border border-red-100">
                        <span className="text-red-700 font-bold flex items-center gap-2 text-sm">
                            <span>↩️</span> החזר ללקוח
                        </span>
                        <span className="text-red-700 font-bold dir-ltr">
                            {formatPrice(Math.abs(priceDifference))}
                        </span>
                    </div>
                )}

                {/* Loyalty Discount Row - Only show if real customer AND has discount */}
                {loyaltyDiscount > 0 && hasRealCustomer && !(isEditMode && originalIsPaid && editingOrderData?.originalRedeemedCount > 0) && (
                    <div className="flex justify-between items-center mb-3 px-1 bg-green-50 p-2 rounded-lg border border-green-100">
                        <span className="text-green-700 font-bold flex items-center gap-2 text-sm">
                            <span>🎁</span> הנחת נאמנות (קפה חינם)
                        </span>
                        <span className="text-green-700 font-bold dir-ltr">
                            -{formatPrice(loyaltyDiscount)}
                        </span>
                    </div>
                )}

                {/* Soldier Discount Display - only show amount if enabled */}
                {soldierDiscountEnabled && soldierDiscountAmount > 0 && (
                    <div className="flex justify-between items-center mb-3 px-1 bg-blue-50 p-2 rounded-lg border border-blue-100">
                        <span className="text-blue-700 font-bold flex items-center gap-2 text-sm">
                            <span>🎖️</span> הנחת חייל (10%)
                        </span>
                        <span className="text-blue-700 font-bold dir-ltr">
                            -{formatPrice(soldierDiscountAmount)}
                        </span>
                    </div>
                )}

                {/* Main Action Button */}
                <button
                    onClick={handleAction}
                    disabled={isDisabled}
                    className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all active:scale-[0.98] flex items-center justify-between px-6 ${statusConfig.buttonColor}`}
                >
                    <div className="flex items-center gap-2">
                        <span>{statusConfig.text}</span>
                        {statusConfig.paymentLabel && (
                            <span className="text-xs bg-white text-orange-600 px-2 py-0.5 rounded-lg border border-orange-100 shadow-sm">
                                {statusConfig.paymentLabel}
                            </span>
                        )}
                    </div>
                    {statusConfig.amount !== null && (
                        <span className="bg-white/20 px-2 py-0.5 rounded text-base">
                            {formatPrice(statusConfig.amount)}
                        </span>
                    )}
                </button>
            </div>
        </div >
    );
};

export default React.memo(SmartCart);
