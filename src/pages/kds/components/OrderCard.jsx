/**
 * ⚠️ CRITICAL FILE - DO NOT MODIFY DESIGN! ⚠️
 * @abra-table orders, order_items
 * @abra-dexie orders, order_items
 */


import React, { useState, useEffect, useCallback, memo, useMemo } from 'react';
import { Clock, Edit, RotateCcw, Flame, Truck, Phone, MapPin, Package, Check, CheckCircle, Box, CreditCard, MessageCircle } from 'lucide-react';
import { sortItems } from '@/utils/kdsUtils';
import { getShortName, getModColorClass } from '@/config/modifierShortNames';

// Fallback for item icons to prevent crash
const getIcon = (name) => null;

const PAYMENT_STYLES = {
  cash: 'bg-green-100 text-green-700 border-green-200',
  credit_card: 'bg-blue-100 text-blue-700 border-blue-200',
  bit: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  paybox: 'bg-pink-100 text-pink-700 border-pink-200',
  gift_card: 'bg-purple-100 text-purple-700 border-purple-200',
  oth: 'bg-orange-100 text-orange-700 border-orange-200',
};

const PAYMENT_LABELS = {
  cash: 'מזומן',
  credit_card: 'אשראי',
  bit: 'ביט',
  paybox: 'פייבוקס',
  gift_card: 'שובר',
  oth: 'על חשבון הבית',
};

const PrepTimer = memo(({ order, isHistory, isReady }) => {
  const [duration, setDuration] = useState('-');

  useEffect(() => {
    const calculate = () => {
      const startStr = order.created_at;
      const endStr = order.ready_at;
      const start = new Date(startStr).getTime();
      let end;

      if (endStr) {
        end = new Date(endStr).getTime();
      } else if (isReady || isHistory) {
        end = order.updated_at ? new Date(order.updated_at).getTime() : null;
      } else {
        end = Date.now();
      }

      if (isNaN(start) || !end) {
        setDuration('-');
        return;
      }

      const diff = Math.max(0, end - start);
      const mins = Math.floor(diff / 60000);
      setDuration(`${mins}`);
    };

    calculate();
    let interval;
    if (!isReady && !isHistory) {
      interval = setInterval(calculate, 60000);
    }
    return () => clearInterval(interval);
  }, [order, isHistory, isReady]);

  return (
    <div className="flex items-center justify-center min-w-[36px] px-2 py-0.5 rounded-md border text-base font-bold h-7 shadow-sm transition-colors bg-white border-gray-200 text-gray-700">
      <span className="font-mono dir-ltr flex-1 text-center">{duration}</span>
    </div>
  );
});

PrepTimer.displayName = 'PrepTimer';

const OrderCard = memo(({
  order,
  isReady = false,
  isHistory = false,
  isDriverView = false,
  isKanban = false,
  glowClass = '',
  onOrderStatusUpdate,
  onPaymentCollected,
  onFireItems,
  onReadyItems,
  onDeliverItems,
  onToggleEarlyDelivered,
  onStationDeliver,
  onRefireItem,
  onEditOrder,
  onCancelOrder,
  onRefresh,
  getSmsStatus,
  isStationView = false,
  isSentLane = false,
  hasUrgent = false
}) => {
  const [isUpdating, setIsUpdating] = useState(false);

  // 📱 SMS Status for this order
  const orderId = order.originalOrderId || order.id;
  const smsStatus = getSmsStatus ? getSmsStatus(orderId) : null;

  // --- 🔋 LITE MODE SUPPORT ---
  // Force Lite Mode optimizations if we are on a tablet-sized screen (width <= 1280px) OR if explicitly set
  const isLiteMode = useMemo(() => {
    const stored = localStorage.getItem('lite_mode') === 'true';
    const isTablet = window.innerWidth <= 1280;
    return stored || isTablet;
  }, []);

  // 🕵️ DEBUG: Log order 3757 to see why name is missing
  useEffect(() => {
    if (String(order.orderNumber).includes('3757')) {
      console.log('🕵️ OrderCard 3757 Debug:', {
        customerName: order.customerName,
        customer_name: order.customer_name,
        orderNumber: order.orderNumber,
        customerId: order.customerId
      });
    }
  }, [order]);

  // --- 🕒 AGING LOGIC ---
  const [agingMinutes, setAgingMinutes] = useState(0);

  useEffect(() => {
    if (isHistory || isReady) return;

    const calculateAging = () => {
      const start = new Date(order.created_at).getTime();
      const now = Date.now();
      const diff = Math.max(0, now - start);
      setAgingMinutes(Math.floor(diff / 60000));
    };

    calculateAging();
    const interval = setInterval(calculateAging, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, [order.created_at, isHistory, isReady]);

  const agingClass = useMemo(() => {
    if (isHistory || isReady) return '';
    // Original production classes that trigger kdsStyles.css overrides
    if (agingMinutes >= 30) {
      // In LiteMode we might want less intense animations, but user specifically asked for them.
      // The kdsStyles.css handles the colors and gentle pulse.
      return `aging-critical ${isLiteMode ? '' : ''}`; // Keep consistent
    }
    if (agingMinutes >= 15) {
      return 'aging-warn';
    }
    return '';
  }, [agingMinutes, isHistory, isReady, isLiteMode]);

  // Memoize status styles to avoid recalculating classes
  const statusStyles = useMemo(() => {
    const statusLower = (order.orderStatus || '').toLowerCase();
    const isUnpaid = order.isPaid === false;
    const isDelayedCard = order.type === 'delayed';
    const isUnpaidDelivered = order.type === 'unpaid_delivered';

    // Simplified high-contrast black border design as requested by user
    return 'border-2 border-black shadow-sm';
  }, [order.type, order.orderStatus, isHistory, order.isPaid, isLiteMode]);

  const { isLargeOrder, rightColItems, leftColItems, unifiedItems } = useMemo(() => {
    const allItems = order.items || [];

    // 🥤 SORT: Drinks (משקאות) first, then food — easier for checker to read
    const sortedItems = [...allItems].sort((a, b) => {
      const aIsDrink = (a.category || '').includes('משקאות');
      const bIsDrink = (b.category || '').includes('משקאות');
      if (aIsDrink && !bIsDrink) return -1;
      if (!aIsDrink && bIsDrink) return 1;
      return 0;
    });

    // 📐 SPLIT: More than 5 items → double-width card
    const splitNeeded = sortedItems.length > 5 && !isHistory;

    const rCol = [];
    const lCol = [];

    if (splitNeeded) {
      // Fill right column: up to 5 items, rest go to left
      const maxItems = 5;
      sortedItems.forEach((item, i) => {
        if (i < maxItems) {
          rCol.push(item);
        } else {
          lCol.push(item);
        }
      });
    }

    return {
      unifiedItems: sortedItems,
      isLargeOrder: splitNeeded,
      rightColItems: rCol,
      leftColItems: lCol
    };
  }, [order.items, isHistory]);


  // Calculate packing progress for Kanban
  const packedCount = useMemo(() => {
    if (!order.items) return 0;
    // For Kanban, we count items that ARE 'ready' (packed) or 'shipped' as packed.
    return order.items.filter(i => i.item_status === 'ready' || i.item_status === 'shipped').length;
  }, [order.items]);

  const totalItems = order.items?.length || 0;
  const isPartiallyPacked = !isHistory && !isReady && totalItems > 0 && packedCount > 0;
  const orderStatusLower = (order.orderStatus || '').toLowerCase();
  const isPending = orderStatusLower === 'pending';
  const isHeld = orderStatusLower === 'held';
  const isReadyStatus = ['ready', 'completed', 'shipped'].includes(orderStatusLower);
  const isNew = orderStatusLower === 'new';

  const nextStatusLabel = isReady 
    ? 'נמסר' 
    : (isHeld 
        ? (order.isFired ? 'מוכן להגשה' : 'הכן עכשיו!') 
        : 'מוכן להגשה');

  const actionBtnColor = isReadyStatus
    ? 'bg-slate-900 text-white hover:bg-slate-800'
    : (isHeld
      ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-orange-200'
      : (isNew 
        ? 'bg-green-500 text-white hover:bg-green-600 shadow-green-200'
        : 'bg-green-600 text-white hover:bg-green-700 shadow-green-200'));

  const cardWidthClass = isHistory
    ? (isLargeOrder ? 'w-[294px]' : 'w-[200px]')
    // 🎨 DESIGN: widths are 400px (double) and 260px (single) - Updated 2026-02-16
    : (isDriverView ? 'w-full' : (isLargeOrder ? 'w-[400px]' : 'w-[260px]'));

  const deliveryInfo = useMemo(() => {
    if (!order.delivery_info) return {};
    return typeof order.delivery_info === 'string' ? JSON.parse(order.delivery_info) : order.delivery_info;
  }, [order.delivery_info]);

  const renderItemRow = useCallback((item, idx, isLarge) => {
    // KDS: Early Delivery (Visual Strikethrough/Dimming)
    const isEarlyDelivered = !isReady && !isHistory && (item.is_early_delivered === true);
    const isUrgentItem = !!item.urgent_at;

    // Readiness Status (Green Badge/Checkmark)
    // Applied when item is 'ready' or 'shipped'
    const isReadyItem = (item.item_status === 'ready' || item.item_status === 'shipped');
    const isPackedItem = isReadyItem; // Maintain compatibility with existing variable usage

    const nameSizeClass = isHistory ? 'text-sm' : 'text-base';
    const badgeSizeClass = isHistory ? 'w-5 h-5 text-xs' : 'w-6 h-6 text-base';
    const modSizeClass = isHistory ? 'text-[10px]' : 'text-xs';

    const isPrepStarted = item.item_status === 'prep_started';

    // Dim items that don't need prep in the bottom list (ready/history)
    const isDimmed = (isReady || isHistory) && item.isPrepRequired === false;

    return (
      <div key={`${item.menuItemId}-${item.modsKey || item.id || idx}`} className={`flex flex-col ${!isLiteMode ? 'transition-colors duration-300' : ''} ${isLarge ? 'border-b border-gray-50 pb-0.5' : 'border-b border-dashed border-gray-100 pb-0.5 last:border-0'} ${isEarlyDelivered ? '-mx-1 px-1 rounded-md mb-0.5 bg-green-100/70' : ''} ${(isPrepStarted || isPackedItem) ? 'bg-green-100/40 rounded-md -mx-1 px-1' : ''} ${isDimmed ? 'opacity-40 grayscale-[0.5]' : ''} ${isUrgentItem && isStationView ? 'bg-red-50 -mx-1 px-1 rounded-md border border-red-200' : ''}`}>
        <div className="flex items-start gap-[5px] relative">



          <div
            className={`flex items-start gap-[5px] flex-1 min-w-0 tracking-tight p-1 -m-1 rounded-lg`}
          >
            {/* Quantity Badge */}
            <span className={`flex items-center justify-center rounded-lg font-black shrink-0 mt-0.5 ${badgeSizeClass} ${!isLiteMode ? 'shadow-sm' : ''} ${
              item.quantity > 1 ? 'bg-orange-600 text-white ring-2 ring-orange-200' : (order.type === 'delayed' ? 'bg-gray-300 text-gray-600' : 'bg-slate-900 text-white')
              }`}>
              {item.quantity}
            </span>

            {/* 🔥 Urgent Badge */}
            {isUrgentItem && isStationView && (
              <span className="bg-red-500 text-white px-1.5 py-0.5 rounded text-[10px] font-bold shadow animate-pulse shrink-0 mt-0.5">
                🔥 דחוף
              </span>
            )}

            <div className="flex-1 pt-0.5 min-w-0 pr-0">
              {(() => {
                if (!item.modifiers || item.modifiers.length === 0) {
                  return (
                    <div className="flex flex-col">
                      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-right leading-normal whitespace-normal break-words">
                        <span className={`font-bold ${isEarlyDelivered ? 'text-gray-900' : (item.quantity > 1 ? 'text-orange-700' : 'text-gray-900')} ${nameSizeClass}`}>
                          {getIcon(item.name)} {item.name}
                        </span>

                      </div>
                    </div>
                  );
                }

                const visibleMods = item.modifiers
                  .map(mod => {
                    const resolvedName = typeof mod === 'string' ? mod : (mod.text || mod.valueName || mod.value_name || mod.name || mod.label || '');
                    return {
                      ...mod,
                      fullName: resolvedName,
                      shortName: getShortName(resolvedName)
                    };
                  })
                  .filter(mod => {
                    const nameLower = (typeof mod.fullName === 'string' ? mod.fullName.toLowerCase() : '');
                    // Filter out hidden functional modifiers
                    if (nameLower.includes('kds_override') || nameLower.includes('kds overide') || nameLower.includes('__kds_over')) {
                      return false;
                    }
                    return mod.fullName;
                  });

                return (
                  <div className="flex flex-col">
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-right leading-normal whitespace-normal break-words">
                      <span className={`font-bold ${isEarlyDelivered ? 'text-gray-900' : (item.quantity > 1 ? 'text-orange-700' : 'text-gray-900')} ${nameSizeClass}`}>
                        {getIcon(item.name)} {item.name}
                      </span>


                      {visibleMods.map((mod, i) => (
                        <span key={i} className={`mod-label inline-block ${getModColorClass(mod.fullName, mod.shortName)} ${modSizeClass} px-1.5 py-px rounded leading-snug min-h-[auto] max-w-full text-right whitespace-pre-wrap break-words`}>
                          {mod.shortName}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
    );
  }, [isHistory, isReady, order.type, onReadyItems, order.id, isKanban]);

  // Detect item addition (merge) for flash effect
  const prevItemsLength = React.useRef(order.items?.length || 0);
  const [shouldFlash, setShouldFlash] = useState(false);

  useEffect(() => {
    if (order.items?.length > prevItemsLength.current) {
      // Items added -> Merge detected
      setShouldFlash(true);
      const timer = setTimeout(() => setShouldFlash(false), 1500); // Flash for 1.5s
      return () => clearTimeout(timer);
    }
    prevItemsLength.current = order.items?.length;
  }, [order.items?.length]);

  return (
    <div className={`kds-card ${cardWidthClass} flex-shrink-0 rounded-2xl px-[2px] pt-1.5 pb-2.5 ${isHistory ? 'mx-[2px]' : 'mx-2'} flex flex-col h-full font-heebo ${isHeld ? 'bg-amber-50/50 border-2 border-dashed border-amber-300' : (orderStatusLower === 'new' ? 'bg-gray-100' : 'bg-white')} ${statusStyles} ${agingClass} ${glowClass} ${shouldFlash && !isLiteMode ? 'animate-pulse ring-4 ring-black z-20' : ''} relative overflow-hidden`}>

      {/* Header */}
      <div className="z-0 flex justify-between items-start mb-0.5 border-b border-gray-50 pb-0.5">
        <div className="flex flex-col flex-1">
          <div className="flex flex-col w-full">
            <div className="flex items-center gap-2 w-full">
              {/* 🛑 CRITICAL: NEVER TRUNCATE NAMES OR NUMBERS. MUST WRAP. */}
              <div className={`${isHistory ? 'text-lg' : 'text-2xl'} font-black text-slate-900 leading-tight tracking-tight whitespace-normal break-words`}>
                {(() => {
                  const name = order.customerName || order.customer_name;
                  if (name && !['אורח', 'אורח אנונימי', 'Guest', ''].includes(name)) return name;
                  return `#${order.orderNumber}`;
                })()}
              </div>
            </div>

            {isDriverView && (
              <div className="flex flex-col gap-1 mt-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                {order.customerPhone && (
                  <div className="flex items-center gap-2 text-slate-700">
                    <Phone size={14} className="text-slate-400" />
                    <span className="font-mono font-bold text-sm" dir="ltr">{order.customerPhone}</span>
                  </div>
                )}
                {(order.deliveryAddress || deliveryInfo.address) && (
                  <div className="flex items-start gap-2 text-slate-800">
                    <MapPin size={14} className="mt-1 shrink-0 text-purple-500" />
                    <span className="font-bold text-sm leading-tight">{order.deliveryAddress || deliveryInfo.address}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="text-left flex flex-col items-end shrink-0 ml-2 gap-1.5">
          <div className="flex items-center gap-2">
            {!isHistory && onEditOrder && (
              <button
                onClick={(e) => { 
                    e.stopPropagation(); 
                    onEditOrder(order); 
                }}
                className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="עריכת הזמנה"
              >
                <Edit size={14} />
              </button>
            )}
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] font-black transition-colors bg-gray-50 border-gray-200 text-gray-500">
              <span className="font-mono dir-ltr">{order.timestamp}</span>
            </div>
            {/* 📱 SMS Status Badge */}
            {smsStatus && (
              <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] font-bold transition-all ${
                smsStatus === 'pending' ? 'bg-orange-50 border-orange-300 text-orange-600 animate-pulse' :
                smsStatus === 'sent' ? 'bg-green-50 border-green-300 text-green-600' :
                'bg-red-50 border-red-300 text-red-600'
              }`}>
                <MessageCircle size={10} />
                <span>{smsStatus === 'pending' ? 'שולח...' : smsStatus === 'sent' ? 'נשלח ✓' : 'נכשל ✗'}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Items Area */}
      <div className="z-0 flex-1 overflow-x-hidden overflow-y-auto custom-scrollbar pr-1 mr-1 mb-2">
        {isLargeOrder ? (
          <div className="flex h-full gap-2">
            <div className="flex-1 flex flex-col space-y-0.5 border-l border-gray-100 pl-2">
              {rightColItems.map((item, idx) => renderItemRow(item, idx, true))}
            </div>
            <div className="flex-1 flex flex-col space-y-0.5">
              {leftColItems.map((item, idx) => renderItemRow(item, idx, true))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col space-y-0.5">
            {unifiedItems.map((item, idx) => renderItemRow(item, idx, false))}
          </div>
        )}
      </div>

      <div className={`mt-auto flex flex-col gap-2 relative z-50`}>
        {isHeld ? (
          <button
            disabled={isUpdating}
            onClick={async (e) => {
              e.stopPropagation(); setIsUpdating(true);
              try {
                const flatIds = order.items.flatMap(i => i.ids || [i.id]);
                if (onFireItems) await onFireItems(order.originalOrderId || order.id, flatIds);
              } finally { setIsUpdating(false); }
            }}
            onTouchEnd={async (e) => {
                // Prevent ghost clicks but handle touch immediately
                e.preventDefault();
                e.stopPropagation();
                if (isUpdating) return;
                setIsUpdating(true);
                try {
                  const flatIds = order.items.flatMap(i => i.ids || [i.id]);
                  if (onFireItems) await onFireItems(order.originalOrderId || order.id, flatIds);
                } finally { setIsUpdating(false); }
            }}
            className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl font-black text-lg shadow-lg active:translate-y-1 transition-all flex items-center justify-center gap-2"
          >
            <Flame size={18} className="fill-white animate-pulse" />
            <span>{isUpdating ? 'שולח...' : 'הכן עכשיו!'}</span>
          </button>
        ) : (
          <>
            {isHistory && (
              <div className="mt-1 mb-2 pt-2 border-t border-gray-100 flex flex-col gap-1.5 px-2">
                <div className="flex items-start gap-1.5 text-slate-500 font-bold">
                  <Clock size={16} className="mt-0.5 shrink-0" />
                  <div className="flex flex-col gap-0.5">
                     <div className="flex items-center gap-2">
                        <span className="text-xs">משך הכנה:</span>
                        <span className="text-xs font-black text-slate-700">{order.duration || '-'}</span>
                     </div>
                     {order.duration2 && (
                       <div className="flex items-center gap-2 text-[11px] opacity-80">
                          <span className="text-slate-500">#2</span>
                          <span className="font-black text-slate-600">{order.duration2}</span>
                       </div>
                     )}
                  </div>
                </div>
              </div>
            )}

            {isHistory && (
              <div className="mt-auto pt-2 border-t border-gray-100/50">
                <div className="flex flex-col gap-1.5">
                  {/* 🎯 STATION MODE: Clean read-only tracking status */}
                  {isStationView ? (
                    <div className={`flex items-center justify-center gap-2 p-2.5 rounded-xl text-sm font-black transition-colors ${
                      (order.orderStatus || '').toLowerCase() === 'completed' || (order.orderStatus || '').toLowerCase() === 'shipped'
                        ? 'bg-green-50 border border-green-200 text-green-700'
                        : 'bg-amber-50 border border-amber-200 text-amber-700'
                    }`}>
                      {(order.orderStatus || '').toLowerCase() === 'completed' || (order.orderStatus || '').toLowerCase() === 'shipped'
                        ? <><CheckCircle size={16} className="text-green-500" /> <span>נמסר ללקוח ✅</span></>
                        : <><span>ממתין בצ׳קר 🧑‍💼</span></>
                      }
                    </div>
                  ) : (
                    <>
                      {/* 🧑‍💼 CHECKER MODE: Full admin payment & edit UI */}
                      <div className={`flex items-center gap-2 p-1 border rounded-xl transition-colors ${order.isPaid ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                        <div className={`flex-1 flex items-center justify-between text-xs ${order.isPaid ? 'text-gray-500 bg-gray-50/80 border-gray-100' : 'text-orange-600 bg-white border-orange-600 shadow-sm -translate-y-0.5 cursor-pointer hover:bg-orange-50 transition-colors'} p-1.5 rounded-lg border`}>

                          {!order.isPaid ? (
                            <div className="flex items-center justify-between w-full" onClick={(e) => { e.stopPropagation(); if (onPaymentCollected) onPaymentCollected(order); }}>
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="w-6 h-6 flex items-center justify-center bg-orange-100 rounded-lg">
                                  <CreditCard className="w-4 h-4 text-orange-600" />
                                </div>
                                <span className="font-bold">לתשלום</span>
                              </div>
                              <div className="flex items-center gap-1 shrink-0 px-1">
                                <span className="text-sm font-black text-amber-800 tracking-tight">
                                  ₪{(order.totalOriginalAmount || order.fullTotalAmount || order.totalAmount)?.toLocaleString()}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between w-full">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <CheckCircle size={14} className="text-green-500 shrink-0" />
                                <div className="flex flex-col">
                                  <span className="font-bold text-xs whitespace-normal break-words">
                                    {PAYMENT_LABELS[order.payment_method] || order.payment_method || 'שולם'}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0 px-1">
                                <span className="text-sm font-black text-slate-800 tracking-tight">
                                  ₪{(order.totalOriginalAmount || order.fullTotalAmount || order.totalAmount)?.toLocaleString()}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {onEditOrder && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditOrder(order);
                          }}
                          className="w-full py-1.5 bg-slate-100/80 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border border-slate-200"
                        >
                          <Edit size={12} />
                          עריכת הזמנה
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}


            {!isHistory && (
              <div className="flex items-stretch gap-2 mt-auto h-11 w-full text-sm relative">

                {/* --- 💰 UNPAID & COMPLETED (DELIVERED) MODE --- */}
                {(!order.isPaid && (orderStatusLower === 'completed' || orderStatusLower === 'shipped')) ? (
                  <button
                    disabled={isUpdating}
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (onPaymentCollected) {
                        setIsUpdating(true);
                        await onPaymentCollected(order);
                        setIsUpdating(false);
                      }
                    }}
                    onTouchEnd={async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (isUpdating || !onPaymentCollected) return;
                        setIsUpdating(true);
                        await onPaymentCollected(order);
                        setIsUpdating(false);
                    }}
                    className="flex-1 bg-white border-2 border-orange-600 hover:bg-orange-50 text-orange-600 rounded-xl font-black text-lg shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2 outline-none"
                  >
                    <img
                      src={`http://${window.location.hostname}:54321/storage/v1/object/public/Photos/cashregister.jpg`}
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'block';
                      }}
                      alt="קופה"
                      className="w-8 h-8 object-contain"
                    />
                    <div style={{ display: 'none' }} className="text-white">
                      <CreditCard size={20} />
                    </div>
                    <span>גביית תשלום: ₪{order.totalAmount?.toLocaleString()}</span>
                  </button>
                ) : (
                  <>
                    {/* Kanban Packing Status */}
                    {isKanban && isPartiallyPacked && (
                      <div className="absolute left-0 bottom-0 top-0 flex items-center justify-center bg-green-100 text-green-800 text-xs font-bold px-3 rounded-xl border border-green-200 shadow-sm z-10 transition-all">
                        <Box size={14} className="ml-1 text-green-600" />
                        <span>{packedCount}/{totalItems} ארוז</span>
                      </div>
                    )}

                    {isReady && !isKanban && (
                      <button
                        disabled={isUpdating}
                        onClick={async (e) => {
                          e.stopPropagation(); setIsUpdating(true);
                          try { await onOrderStatusUpdate(order.originalOrderId || order.id, 'undo_ready'); }
                          finally { setIsUpdating(false); }
                        }}
                        onTouchEnd={async (e) => {
                             e.preventDefault();
                             e.stopPropagation();
                             if (isUpdating) return;
                             setIsUpdating(true);
                             try { await onOrderStatusUpdate(order.originalOrderId || order.id, 'undo_ready'); }
                             finally { setIsUpdating(false); }
                        }}
                        className="w-11 h-11 bg-gray-200 border-2 border-gray-300 rounded-xl shadow-sm flex items-center justify-center text-gray-700 shrink-0 active:scale-95 transition-all outline-none"
                      >
                        <RotateCcw size={20} />
                      </button>
                    )}

                    <button
                      disabled={isUpdating}
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (isUpdating) return;
                        setIsUpdating(true);
                        try {
                          const orderId = order.originalOrderId || order.id;
                          const flatIds = order.items.flatMap(i => i.ids || [i.id]);

                          if (isStationView) {
                               const { supabase } = await import('@/lib/supabase');
                               const now = new Date().toISOString();
                               const { error } = await supabase.from('order_items').update({ early_delivered_at: now }).in('id', flatIds);
                               if (error) {
                                  console.error('❌ Supabase Write Failed:', error);
                               } else {
                                  // ✅ CONFIRMED WRITE: Mirror to Dexie so useLiveQuery triggers re-render
                                  const db = (await import('@/db/database')).default;
                                  for (const itemId of flatIds) {
                                    db.order_items.update(itemId, {
                                      early_delivered_at: now,
                                      is_early_delivered: true,
                                      updated_at: now
                                    }).catch(e => console.warn('Dexie mirror failed:', e));
                                  }
                               }
                          }
                          else if (isHeld) {
                             if (onFireItems) await onFireItems(orderId, flatIds);
                          } else if (orderStatusLower === 'in_progress' && onReadyItems) {
                             await onReadyItems(orderId, flatIds);
                          } else if (isReadyStatus && onDeliverItems) {
                             await onDeliverItems(orderId, flatIds);
                          } else {
                             await onOrderStatusUpdate(orderId, order.orderStatus);
                          }
                        } catch (err) {
                             console.error('🔥 OrderCard Action Failed (onClick):', err);
                        } finally { setIsUpdating(false); }
                      }}
                      onTouchEnd={async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (isUpdating) return;
                        setIsUpdating(true);
                        try {
                          const orderId = order.originalOrderId || order.id;
                          const flatIds = order.items.flatMap(i => i.ids || [i.id]);

                          if (isStationView) {
                               const { supabase } = await import('@/lib/supabase');
                               const now = new Date().toISOString();
                               const { error } = await supabase.from('order_items').update({ early_delivered_at: now }).in('id', flatIds);
                               if (error) {
                                  console.error('❌ Supabase Write Failed:', error);
                               } else {
                                  // ✅ CONFIRMED WRITE: Mirror to Dexie so useLiveQuery triggers re-render
                                  const db = (await import('@/db/database')).default;
                                  for (const itemId of flatIds) {
                                    db.order_items.update(itemId, {
                                      early_delivered_at: now,
                                      is_early_delivered: true,
                                      updated_at: now
                                    }).catch(e => console.warn('Dexie mirror failed:', e));
                                  }
                               }
                          }
                          else if (isHeld) {
                             if (onFireItems) await onFireItems(orderId, flatIds);
                          } else if (orderStatusLower === 'in_progress' && onReadyItems) {
                             await onReadyItems(orderId, flatIds);
                          } else if (isReadyStatus && onDeliverItems) {
                             await onDeliverItems(orderId, flatIds);
                          } else {
                             await onOrderStatusUpdate(orderId, order.orderStatus);
                          }
                        } catch (err) {
                             console.error('🔥 OrderCard Action Failed (onTouchEnd):', err);
                        } finally { setIsUpdating(false); }
                      }}
                      className={`flex-1 rounded-xl font-black text-lg shadow-sm active:scale-[0.98] transition-all flex items-center justify-center ${actionBtnColor} ${isUpdating ? 'opacity-50 cursor-not-allowed' : ''} outline-none`}
                    >
                      {isUpdating ? 'מעדכן...' : (isStationView ? ((order.items || []).every(i => i.early_delivered_at) ? 'נשלח ✓' : 'מוכן!') : nextStatusLabel)}
                    </button>

                    {!order.isPaid && (
                      <button
                        disabled={isUpdating}
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (onPaymentCollected) {
                            setIsUpdating(true); await onPaymentCollected(order); setIsUpdating(false);
                          }
                        }}
                        onTouchEnd={async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (isUpdating || !onPaymentCollected) return;
                            setIsUpdating(true); await onPaymentCollected(order); setIsUpdating(false);
                        }}
                        className="w-11 h-11 bg-white border-2 border-orange-600 rounded-xl shadow-sm flex items-center justify-center hover:bg-orange-50 shrink-0 relative active:scale-95 transition-all outline-none"
                      >
                        <img
                          src={`http://${window.location.hostname}:54321/storage/v1/object/public/Photos/cashregister.jpg`}
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'block';
                          }}
                          alt="קופה"
                          className="w-9 h-9 object-contain"
                        />
                        <div style={{ display: 'none' }} className="text-orange-600">
                          <CreditCard size={24} />
                        </div>
                        <span className="absolute -top-1.5 -right-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md ring-1 ring-white">
                          ₪{order.totalAmount?.toFixed(0)}
                        </span>
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}
        {/* Station View: "Sent to Checker" button */}
        {isStationView && !isSentLane && !isHistory && !isReady && onStationDeliver && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              const orderId = order.originalOrderId || order.id;
              onStationDeliver(orderId, order.items || []);
            }}
            className="w-full mt-1 py-2.5 bg-emerald-500 text-white text-sm font-bold rounded-xl active:scale-[0.98] transition-all shadow-sm"
          >
            ✅ יצא לצ׳קר
          </button>
        )}



      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.isReady === nextProps.isReady &&
    prevProps.isHistory === nextProps.isHistory &&
    prevProps.order.orderStatus === nextProps.order.orderStatus &&
    prevProps.order.isPaid === nextProps.order.isPaid &&
    prevProps.order.customerName === nextProps.order.customerName &&
    prevProps.order.customerPhone === nextProps.order.customerPhone &&
    prevProps.order.updated_at === nextProps.order.updated_at &&
    prevProps.order.type === nextProps.order.type &&
    prevProps.order.items?.length === nextProps.order.items?.length &&
    prevProps.order.items?.every((item, idx) => {
      const nextItem = nextProps.order.items[idx];
      return item.id === nextItem?.id &&
        item.item_status === nextItem?.item_status &&
        item.is_early_delivered === nextItem?.is_early_delivered &&
        item.early_delivered_at === nextItem?.early_delivered_at &&
        item.urgent_at === nextItem?.urgent_at;
    }) &&
    prevProps.isStationView === nextProps.isStationView &&
    prevProps.isSentLane === nextProps.isSentLane &&
    prevProps.hasUrgent === nextProps.hasUrgent &&
    // SMS status comparison
    (prevProps.getSmsStatus ? prevProps.getSmsStatus(prevProps.order.originalOrderId || prevProps.order.id) : null) ===
    (nextProps.getSmsStatus ? nextProps.getSmsStatus(nextProps.order.originalOrderId || nextProps.order.id) : null)
  );
});

OrderCard.displayName = 'OrderCard';
export default OrderCard;