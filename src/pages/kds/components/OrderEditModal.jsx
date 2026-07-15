import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Check, Phone, User, Edit3 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import CustomerInfoModal from '@/components/CustomerInfoModal';
import { getShortName, getModColorClass } from '@/config/modifierShortNames';

/**
 * OrderEditModal - Simple modal for viewing order items and marking early delivery
 * Uses is_early_delivered field for display only - doesn't affect other status logic
 */

const OrderEditModal = ({
    isOpen,
    order,
    onClose,
    onRefresh,
    onToggleEarlyDelivered,
    isHistoryMode = false
}) => {
    const navigate = useNavigate();
    const [items, setItems] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [orderData, setOrderData] = useState(null);
    const [processingItemId, setProcessingItemId] = useState(null);
    const [showCustomerInfoModal, setShowCustomerInfoModal] = useState(false);
    const [customerInfoModalMode, setCustomerInfoModalMode] = useState('phone');

    const currentCustomerData = React.useMemo(() => {
        const phone = orderData?.customer_phone || '';
        const phoneStr = phone.toString();
        const sanitizedPhone = (phoneStr.includes('GUEST') || phoneStr.includes('_') || phoneStr.length > 15) ? '' : phoneStr;

        const name = orderData?.customer_name || '';
        const nameStr = typeof name === 'string' ? name : '';
        const sanitizedName = (nameStr.includes('GUEST') || ['אורח', 'אורח אנונימי'].includes(nameStr)) ? '' : nameStr;

        return {
            phone: sanitizedPhone,
            name: sanitizedName,
            id: orderData?.customer_id
        };
    }, [orderData?.customer_phone, orderData?.customer_name, orderData?.customer_id]);

    const loadItemsFromOrder = () => {
        if (!order || !order.items) return;

        const realOrderId = (order.originalOrderId || order.id || '')
            .toString()
            .replace(/-stage-\d+/, '')
            .replace('-ready', '');

        setOrderData({
            id: realOrderId,
            customer_name: order.customerName,
            customer_phone: order.customerPhone,
            customer_id: order.customerId,
            order_number: order.orderNumber,
            is_paid: order.isPaid,
            payment_method: order.paymentMethod || order.payment_method
        });

        const flattened = [];
        
        // Handle all items from the order object
        (order.items || []).forEach(item => {
            // Determine if it's a grouped item (composite IDs)
            const itemIds = item.ids && item.ids.length > 0 ? item.ids : [item.id];
            
            itemIds.forEach((id, subIdx) => {
                const status = item.item_status || item.status;
                const routingLogic = item.kds_routing_logic;
                
                // 🚀 HERO: Unified delivery logic
                const isDelivered = 
                    routingLogic === 'prep_override' || // Backwards compatibility for old data
                    routingLogic === 'GRAB_AND_GO' || 
                    item.is_early_delivered === true || // Backwards compatibility
                    !!item.early_delivered_at ||
                    status === 'ready' || 
                    status === 'shipped' ||
                    status === 'completed';

                flattened.push({
                    id: id || `item-${Date.now()}-${subIdx}`,
                    ids: item.ids || [item.id], // 🚀 Crucial: Keep original DB IDs
                    uniqueKey: `${id || item.name}-${subIdx}-${item.timestamp}`,
                    name: item.name,
                    quantity: 1,
                    price: item.price || 0,
                    status: status,
                    early_delivered_at: item.early_delivered_at || null,
                    is_delivered: isDelivered,
                    kds_routing_logic: routingLogic,
                    was_conditional: item.was_conditional || false,
                    modifiers: item.modifiers || []
                });
            });
        });

        setItems(flattened.filter(i => i.status !== 'cancelled'));
        setIsLoading(false);
    };

    useEffect(() => {
        if (isOpen && order) {
            loadItemsFromOrder();
        }
    }, [isOpen, order]);

    if (!isOpen || !order) return null;

    const handleToggleEarlyDeliveredLocal = async (item) => {
        if (processingItemId || isHistoryMode) return;
        
        // Items in the modal can represent multiple DB records (itemIds)
        const itemIds = item.ids && item.ids.length > 0 ? item.ids : [item.id];
        
        setProcessingItemId(item.uniqueKey);

        try {
            // Determine target state
            const isCurrentlyDelivered = item.status === 'ready' || item.status === 'completed' || !!item.early_delivered_at || item.is_delivered;
            const targetStatus = isCurrentlyDelivered ? 'in_progress' : 'ready';
            const targetTimestamp = isCurrentlyDelivered ? null : new Date().toISOString();
            
            // ═══════════════════════════════════════════════════════════════
            // 🏗️ SUPABASE-FIRST: Write to server BEFORE touching Dexie
            // ═══════════════════════════════════════════════════════════════

            // 1. Update items on Supabase
            const { error: itemError } = await supabase
                .from('order_items')
                .update({ 
                    item_status: targetStatus,
                    early_delivered_at: targetTimestamp
                })
                .in('id', itemIds);

            if (itemError) {
                console.error('❌ Supabase item toggle FAILED:', itemError);
                return; // ❌ DO NOT touch Dexie or UI
            }

            // 2. If unchecking → update parent order status on Supabase
            if (targetStatus === 'in_progress') {
                const { error: orderError } = await supabase
                    .from('orders')
                    .update({ order_status: 'in_progress' })
                    .eq('id', orderData.id);
                if (orderError) {
                    console.error('❌ Supabase order status rollback FAILED:', orderError);
                    // Items already updated on server, but order status failed.
                    // Still proceed to mirror what succeeded.
                }
            }

            console.log(`📤 Supabase toggle confirmed for ${itemIds.length} items -> ${targetStatus}`);

            // ✅ CONFIRMED WRITE: Now update local UI state
            setItems(prevItems =>
                prevItems.map(i => i.uniqueKey === item.uniqueKey 
                    ? { 
                        ...i, 
                        status: targetStatus,
                        early_delivered_at: targetTimestamp,
                        is_delivered: !isCurrentlyDelivered 
                      } 
                    : i
                )
            );

            // ✅ CONFIRMED WRITE: Now mirror to Dexie
            try {
                const db = (await import('@/db/database')).default;
                
                await Promise.all(itemIds.map(id => 
                    db.order_items.update(id, { 
                        item_status: targetStatus,
                        early_delivered_at: targetTimestamp,
                        updated_at: new Date().toISOString()
                    })
                ));

                if (targetStatus === 'in_progress') {
                    await db.orders.update(orderData.id, {
                        order_status: 'in_progress',
                        updated_at: new Date().toISOString()
                    });
                }

                console.log(`✅ [Dexie] Mirrored ${itemIds.length} items to ${targetStatus}`);
            } catch (dexieErr) {
                console.warn('⚠️ [Dexie] mirror failed (non-critical, server is authoritative):', dexieErr);
            }

            // Trigger refresh in parent
            onRefresh?.();
        } catch (err) {
            console.error('🔥 [OrderEditModal] Toggle FAILED:', err);
        } finally {
            setProcessingItemId(null);
        }
    };

    const handleCloseAndRefresh = () => {
        onClose();
    };

    const formatPrice = (price) => {
        const num = Number(price);
        return `₪${num.toFixed(0)}`;
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={handleCloseAndRefresh}>
            <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()} dir="rtl">
                <div className="bg-white p-4 flex items-center justify-between border-b">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 leading-tight">פרטי הזמנה #{orderData?.order_number}</h2>
                        {!isHistoryMode && (
                            <button
                                onClick={() => {
                                    const editId = orderData.id;
                                    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(editId);
                                    if (!isUUID) {
                                        console.error('❌ Invalid order ID for edit (not a UUID):', editId);
                                        alert(`שגיאה: מזהה הזמנה לא תקין (${editId}). נסה לרענן את הדף.`);
                                        return;
                                    }
                                    navigate(`/?editOrderId=${editId}&from=kds`);
                                }}
                                className="text-blue-600 font-bold text-xs flex items-center gap-1 mt-0.5 hover:text-blue-700 transition-colors"
                            >
                                <Edit3 size={12} />
                                <span>עריכה מלאה (שינוי פריטים)</span>
                            </button>
                        )}
                    </div>
                    <button onClick={handleCloseAndRefresh} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"><X size={24} /></button>
                </div>

                <div className="px-4 py-4 space-y-2 max-h-[50vh] overflow-y-auto">
                    {items.length === 0 ? (
                        <div className="py-10 text-center text-slate-400 font-medium">אין פריטים להצגה</div>
                    ) : items.map((item) => {
                        // Get visible modifiers with short names
                        const visibleMods = (item.modifiers || [])
                            .map(mod => {
                                const resolvedName = typeof mod === 'string' ? mod : (mod.text || mod.valueName || mod.value_name || mod.name || mod.label || '');
                                return { ...mod, shortName: getShortName(resolvedName), resolvedName };
                            })
                            .filter(mod => mod.shortName !== null);

                        const isDelivered = 
                            item.early_delivered_at || // NEW Single Source of Truth
                            item.kds_routing_logic === 'prep_override' || // Legacy
                            item.kds_routing_logic === 'GRAB_AND_GO' || 
                            item.status === 'ready' ||
                            item.status === 'completed';

                        return (
                            <div key={item.uniqueKey} onClick={() => handleToggleEarlyDeliveredLocal(item)} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl cursor-pointer hover:bg-gray-100 transition-all active:scale-[0.99]">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all shrink-0 me-3 ${isDelivered ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'}`}>
                                    <Check size={20} strokeWidth={3} />
                                </div>
                                <div className="flex-1 flex flex-col gap-1">
                                    <div className="flex items-center justify-between gap-3">
                                        <span className={`text-lg font-bold ${isDelivered ? 'text-gray-400 line-through' : 'text-slate-800'}`}>{item.name}</span>
                                        <div className={`text-base font-bold ${isDelivered ? 'text-gray-400' : 'text-gray-600'}`}>{formatPrice(item.price)}</div>
                                    </div>
                                    {/* 🔑 Show modifiers so barista knows what to prepare */}
                                    {visibleMods.length > 0 && (
                                        <div className="flex flex-wrap gap-1">
                                            {visibleMods.map((mod, i) => (
                                                <span key={i} className={`mod-label text-xs ${getModColorClass(mod.resolvedName, mod.shortName)} ${item.is_early_delivered ? 'opacity-50' : ''}`}>
                                                    {mod.shortName}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {!isLoading && orderData && (
                    <div className="px-4 pb-4 flex items-center justify-center gap-3">
                        <button onClick={() => { setCustomerInfoModalMode('phone-then-name'); setShowCustomerInfoModal(true); }} className={`flex-1 px-4 py-3 rounded-full font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm ${currentCustomerData.phone ? 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100' : 'bg-orange-500 text-white hover:bg-orange-600'}`}>
                            <Phone size={16} />
                            {currentCustomerData.phone ? (
                                <>
                                    <span className="font-mono" dir="ltr">{currentCustomerData.phone.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3')}</span>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>
                                </>
                            ) : (
                                <span>הוסף טלפון</span>
                            )}
                        </button>
                        <button onClick={() => { setCustomerInfoModalMode('name'); setShowCustomerInfoModal(true); }} className={`flex-1 px-4 py-3 rounded-full font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm ${currentCustomerData.name ? 'bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'}`}>
                            <User size={16} />
                            {currentCustomerData.name ? (
                                <>
                                    <span className="truncate max-w-[100px]">{currentCustomerData.name}</span>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>
                                </>
                            ) : (
                                <span>הוסף שם</span>
                            )}
                        </button>
                    </div>
                )}

                <div className="p-4 border-t">
                    <button 
                        onClick={handleCloseAndRefresh} 
                        className="w-full py-4 bg-slate-900 text-white font-bold text-lg rounded-2xl shadow-lg active:scale-[0.98] transition-all"
                    >
                        סגור
                    </button>
                </div>
            </div>

            <CustomerInfoModal
                isOpen={showCustomerInfoModal}
                onClose={() => setShowCustomerInfoModal(false)}
                mode={customerInfoModalMode}
                currentCustomer={currentCustomerData}
                onCustomerUpdate={async (updatedCustomer) => {
                    setOrderData({ ...orderData, customer_id: updatedCustomer.id, customer_phone: updatedCustomer.phone, customer_name: updatedCustomer.name });
                    setShowCustomerInfoModal(false);
                    setTimeout(() => { onRefresh?.(); onClose(); }, 1000);
                }}
                orderId={orderData?.id}
            />
        </div>
    );
};

export default OrderEditModal;
