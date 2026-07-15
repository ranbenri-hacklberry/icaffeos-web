import React, { useMemo } from 'react';

import { Trash2, ShoppingBag, Edit, FileText, CreditCard } from 'lucide-react';



// --- סגנונות (CSS) ---

const kdsStyles = `

  @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;700;800;900&display=swap');



  .font-heebo {

    font-family: 'Heebo', sans-serif;

  }



  .cart-item-name {

    font-size: 1rem; 

    font-weight: 700;

    color: #111827;

    display: inline;

    margin-left: 6px;

    line-height: 1.3;

    vertical-align: middle;

  }



  /* תגית כמות - עיגול כתום בולט */

  .qty-badge {

    display: inline-flex;

    align-items: center;

    justify-content: center;

    background-color: #fb923c; /* orange-400 */

    color: #000;

    font-weight: 800; 

    font-size: 0.9rem;

    width: 24px;  

    height: 24px;

    border-radius: 50%; 

    margin-left: 6px;

    vertical-align: middle;

    border: 1.5px solid #f97316; 

    box-shadow: 0 1px 2px rgba(0,0,0,0.1);

    position: relative;

    top: -1px;

  }



  .mod-label {

    display: inline-flex;

    align-items: center;

    padding: 0px 5px;

    border-radius: 4px;

    font-size: 0.75rem;

    font-weight: 600;

    white-space: nowrap;

    margin-left: 3px;

    margin-bottom: 1px;

    vertical-align: middle;

    height: 20px;

  }



  /* צבעים */

  .mod-color-gray { background-color: #f3f4f6; color: #374151; border: 1px solid #e5e7eb; }

  .mod-color-red { background-color: #fecaca; color: #991b1b; border: 1px solid #fca5a5; }

  .mod-color-lightgreen { background-color: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }

  .mod-color-beige { background-color: #fffbeb; color: #92400e; border: 1px solid #fde68a; }

  .mod-color-lightyellow { background-color: #fef9c3; color: #854d0e; border: 1px solid #fef08a; }

  .mod-color-blue { background-color: #dbeafe; color: #1e40af; border: 1px solid #bfdbfe; }

  .mod-color-purple { background-color: #f3e8ff; color: #6b21a8; border: 1px solid #e9d5ff; }



  .mod-color-foam-up { background-color: #d1fae5; color: #065f46; }

  .mod-color-foam-up::before { content: '↑'; font-weight: 900; margin-left: 2px; }



  .mod-color-foam-down { background-color: #fee2e2; color: #991b1b; }

  .mod-color-foam-down::before { content: '↓'; font-weight: 900; margin-left: 2px; }



  .mod-color-foam-none { 

    background-color: transparent !important; 

    color: #ef4444 !important; 

    border: 1px dashed #ef4444; 

    text-decoration: line-through;

    padding: 0px 4px;

  }

  .mod-color-foam-none::before { content: 'Ø'; font-weight: 900; margin-left: 2px; }

`;



const formatPrice = (price = 0) => {

  return new Intl.NumberFormat('he-IL', { maximumFractionDigits: 0 }).format(price);

};



const getKdsMods = (item) => {

  let rawMods = [];

  if (Array.isArray(item.selectedOptions) && item.selectedOptions.length > 0) {

    // Handle selectedOptions - could be objects with valueId/valueName or just valueIds
    rawMods = item.selectedOptions.map(opt => {
      // If it's an object with valueName, use it
      if (typeof opt === 'object' && opt.valueName) {
        return opt.valueName;
      }
      // If it's an object with valueId only, we'll need to handle it differently
      if (typeof opt === 'object' && opt.valueId) {
        // For now, return null - we'll filter these out and handle separately if needed
        return null;
      }
      // If it's a string or number, use it directly
      return opt.valueName || opt.value || opt;
    }).filter(Boolean);

  } else if (item.mods) {

    let parsed = item.mods;

    if (typeof parsed === 'string') { try { parsed = JSON.parse(parsed); } catch (e) {} }

    if (parsed && typeof parsed === 'object') {

      // If it's an array of valueIds (numbers), we can't display them without valueName
      // For now, skip them - they'll need to be loaded from API
      if (Array.isArray(parsed)) {
        rawMods = parsed
          .map(p => {
            if (typeof p === 'object' && p.valueName) return p.valueName;
            if (typeof p === 'string') return p;
            return null;
          })
          .filter(Boolean);
      } else {
        // If it's an object, extract values
        rawMods = Object.values(parsed).filter(val => val && typeof val === 'string');
      }

    }

  }



  const flatMods = rawMods.filter(val => val && val !== 0 && typeof val === 'string');

  const processedMods = [];



  flatMods.forEach((textToShow) => {

    let lowerText = String(textToShow).toLowerCase().trim();

    let cleanText = textToShow;

    let colorClass = 'mod-color-gray';



    if (lowerText.includes('רגיל') || lowerText.includes('default') || lowerText.includes('kds_override') || lowerText.includes('kds_over')) return;



    if (lowerText.includes('סויה')) { cleanText = 'סויה'; colorClass = 'mod-color-lightgreen'; }

    else if (lowerText.includes('שיבולת')) { cleanText = 'שיבולת'; colorClass = 'mod-color-beige'; }

    else if (lowerText.includes('שקדים')) { cleanText = 'שקדים'; colorClass = 'mod-color-lightyellow'; }

    else if (lowerText.includes('נטול') || lowerText.includes('decaf')) { cleanText = 'נטול'; colorClass = 'mod-color-blue'; }

    else if (lowerText.includes('רותח') || lowerText.includes('extra hot')) { cleanText = 'רותח'; colorClass = 'mod-color-red'; }

    else if (lowerText.includes('מים') || lowerText.includes('water')) { cleanText = 'מים'; colorClass = 'mod-color-blue'; }

    else if (lowerText.includes('הרבה קצף') || lowerText.includes('extra foam')) { cleanText = 'קצף'; colorClass = 'mod-color-foam-up'; }

    else if (lowerText.includes('מעט קצף') || lowerText.includes('low foam')) { cleanText = 'קצף'; colorClass = 'mod-color-foam-down'; }

    else if (lowerText.includes('בלי קצף') || lowerText.includes('no foam')) { cleanText = 'קצף'; colorClass = 'mod-color-foam-none'; }

    else if (lowerText.includes('מפורק')) { cleanText = 'מפורק'; colorClass = 'mod-color-purple'; }



    if (cleanText.includes('חלב ')) cleanText = cleanText.replace('חלב ', '');



    processedMods.push({

      text: cleanText,

      colorClass: colorClass,

      priority: lowerText.includes('נטול') ? 1 : (lowerText.includes('סויה') || lowerText.includes('שיבולת') || lowerText.includes('שקדים')) ? 2 : 3

    });

  });



  return processedMods.sort((a, b) => a.priority - b.priority);

};



const CartItem = ({ item, onRemove, onEdit }) => {

  const cleanName = item.name ? item.name.replace(/<[^>]+>/g, '').trim() : '';

  const mods = getKdsMods(item);



  return (

    <div onClick={() => onEdit?.(item)} className="flex bg-white rounded-lg border border-gray-200 hover:border-blue-500 transition-all cursor-pointer shadow-sm group relative overflow-hidden font-heebo p-0">

      <div className="absolute right-0 top-0 bottom-0 w-1 bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>

      

      <div className="flex-1 flex items-center justify-between px-3 py-2 min-h-[50px]">

        

        {/* Right Side: Qty, Name, Mods */}

        <div className="flex-1 leading-tight ml-2 text-right">

            {item.quantity > 1 && (

                <span className="qty-badge">

                    {item.quantity}

                </span>

            )}



            <span className="cart-item-name">{cleanName}</span>

            

            {mods.map((mod, i) => (

              <span key={i} className={`mod-label ${mod.colorClass}`}>

                {mod.text}

                </span>

            ))}

              </div>



        {/* Left Side: Price + Actions */}

        <div className="flex items-center gap-2 shrink-0">

            <div className="font-bold text-lg text-blue-600 whitespace-nowrap">

                {formatPrice(item.price * item.quantity)}

            </div>



            {onRemove && (

                <button 

                    onClick={(e) => { e.stopPropagation(); onRemove(item.id, item.signature); }} 

                    className="w-8 h-8 flex items-center justify-center rounded-full bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-600 transition active:scale-90"

                >

                    <Trash2 size={18} />

                </button>

            )}

        </div>

      </div>

    </div>

  );

};



const ShoppingCart = ({ 
  cartItems = [], 
  onRemoveItem, 
  onClearCart, 
  onEditItem, 
  onInitiatePayment, 
  orderNumber, 
  className,
  isEditMode = false,
  editingOrderData = null,
  disabled = false
}) => {

  const total = cartItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

  const count = cartItems.reduce((sum, i) => sum + i.quantity, 0);

  // --- Logic for Edit Mode (Refund/Additional Charge/Update) ---
  const originalTotal = editingOrderData?.totalAmount || 0;
  const originalIsPaid = editingOrderData?.isPaid || false;
  const priceDifference = total - originalTotal;

  // 1. Is it a Refund? (Paid order, and new total is lower)
  const isRefund = isEditMode && originalIsPaid && priceDifference < 0;

  // 2. Is it an Additional Charge? (Paid order, and new total is higher)
  const isAdditionalCharge = isEditMode && originalIsPaid && priceDifference > 0;

  // 3. Is it a Finalization? (Unpaid order, just finishing payment)
  const isFinalizingOrder = isEditMode && !originalIsPaid;

  // 4. Is it an Update with No Payment Change? (Paid order, and total is the same)
  const isNoChangeUpdate = isEditMode && originalIsPaid && priceDifference === 0;

  const isDisabled = disabled || (cartItems.length === 0 && !isRefund);

  // Text displayed on the button
  const buttonText = useMemo(() => {
    if (isDisabled) return 'הוסף פריטים להזמנה';
    if (!isEditMode) return 'לתשלום';
    if (isRefund) return 'החזר כספי';
    if (isAdditionalCharge) return 'חיוב נוסף';
    if (isFinalizingOrder) return 'השלם תשלום';
    if (isNoChangeUpdate) return 'עדכן הזמנה';
    return 'עדכן הזמנה';
  }, [isDisabled, isEditMode, isRefund, isAdditionalCharge, isFinalizingOrder, isNoChangeUpdate]);

  // Amount displayed on the button
  const buttonAmount = useMemo(() => {
    if (isDisabled && !isEditMode && total <= 0) return '';
    if (isRefund) return formatPrice(Math.abs(priceDifference)); // Refund: Display the positive difference
    if (isAdditionalCharge) return formatPrice(priceDifference); // Additional Charge: Display the positive difference
    return formatPrice(total); // In other cases - Display the total cart amount
  }, [isDisabled, isEditMode, isRefund, isAdditionalCharge, total, priceDifference]);

  // Dynamic button color/style
  const buttonVariantClass = useMemo(() => {
    if (isDisabled) return 'bg-gray-300 text-gray-500 cursor-not-allowed';
    if (isEditMode && isRefund) return 'bg-red-500 hover:bg-red-600 text-white';
    if (isAdditionalCharge || isFinalizingOrder || !isEditMode) return 'bg-blue-600 hover:bg-blue-700 text-white';
    return 'bg-gray-500 hover:bg-gray-600 text-white';
  }, [isDisabled, isEditMode, isRefund, isAdditionalCharge, isFinalizingOrder]);

  // Handler for payment/update action
  const handlePaymentClick = () => {
    if (onInitiatePayment && cartItems.length > 0 && (total > 0 || isRefund)) {
      const orderData = {
        items: cartItems,
        total: total,
        originalTotal: editingOrderData?.totalAmount,
        timestamp: new Date().toISOString(),
        orderNumber: editingOrderData?.orderNumber || `ORD-${Date.now()}`,
        itemCount: cartItems.reduce((count, item) => count + item.quantity, 0),
        isEdit: isEditMode,
      };
      onInitiatePayment(orderData);
    }
  };



  return (

    <div className={`flex flex-col h-full overflow-hidden bg-gray-50 font-heebo border-l border-gray-200 shadow-xl ${className}`} dir="rtl">

      <style>{kdsStyles}</style>



      {/* Header */}

      <div className="p-5 border-b bg-white shadow-sm z-10 flex-shrink-0 flex justify-between items-center h-20">

          <div className="flex items-center gap-3">

            <div className="p-2 bg-blue-50 rounded-xl"><FileText className="w-6 h-6 text-blue-600" /></div>

            <div>

              <h2 className="text-xl font-black text-gray-900 leading-none">

                {orderNumber ? `הזמנה #${orderNumber}` : 'הזמנה חדשה'}

              </h2>

              <p className="text-sm text-gray-500 font-medium mt-1">{count} פריטים</p>

                    </div>

                      </div>

          

          {cartItems.length > 0 && onClearCart && (

            <button onClick={onClearCart} className="text-sm text-red-500 hover:text-red-700 font-bold px-3 py-2 hover:bg-red-50 rounded-xl transition">

                נקה הכל

            </button>

          )}

                  </div>



      {/* Items List */}

      <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar bg-gray-100/50">

        {cartItems.length === 0 ? (

          <div className="text-center py-20 flex flex-col items-center justify-center h-full">

            <div className="bg-gray-200 p-4 rounded-full mb-3">

                <ShoppingBag className="w-12 h-12 text-gray-400" />

                </div>

            <h3 className="text-lg font-semibold text-gray-700">ההזמנה ריקה</h3>

            <p className="text-sm text-gray-500 mt-1">מוזמן להוסיף פריטים</p>

          </div>

        ) : (

          cartItems.map((item, index) => (

            <CartItem

                key={item.tempId || item.id || `cart-item-${index}`}

                item={item} 

                onRemove={onRemoveItem} 

                onEdit={onEditItem} 

            />

          ))

        )}

      </div>



      {/* Checkout Footer */}

      <div className="p-4 bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] flex-shrink-0">

        <button

            onClick={handlePaymentClick}

            className={`w-full ${buttonVariantClass} py-4 rounded-2xl font-bold shadow-lg active:scale-[0.98] transition-all`}

            disabled={isDisabled && !isRefund}

        >

            <div className="flex items-center justify-between px-4 w-full">

                <div className="flex items-center gap-3">

                    <CreditCard size={28} />

                    <span className="text-2xl font-bold">{buttonText}</span>

                </div>

                {buttonAmount && (

                    <span className="font-mono font-black text-3xl tracking-wide">{buttonAmount}</span>

                )}

            </div>

        </button>

      </div>

    </div>

  );

};



export default ShoppingCart;