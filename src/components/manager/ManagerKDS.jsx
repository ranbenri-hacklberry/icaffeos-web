import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { Clock, CheckCircle, RotateCcw, AlertTriangle, LayoutGrid, Check, Plus, Edit, Flame, CreditCard, X, Image, ChevronRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import KDSPaymentModal from '@/pages/kds/components/KDSPaymentModal';

// --- Shared Helpers ---
const isDrink = (item) => {
    const cat = (item.category || '').toLowerCase();
    return cat.includes('שתיה') || cat.includes('drink') || cat.includes('coffee') || cat.includes('קפה');
};

const isHotDrink = (item) => {
    // robust check using DB column if available
    if (item.is_hot_drink === true || item.is_hot_drink === false) return item.is_hot_drink;

    // Fallback to string matching
    const cat = (item.category || '').toLowerCase();
    return isDrink(item) && (cat.includes('חמה') || cat.includes('hot'));
};

const sortItems = (items) => {
    return [...items].sort((a, b) => {
        const aHot = isHotDrink(a);
        const bHot = isHotDrink(b);
        // ... rest of sort logic is same
        const aDrink = isDrink(a);
        const bDrink = isDrink(b);

        if (aHot && !bHot) return -1;
        if (!aHot && bHot) return 1;
        if (aDrink && !bDrink) return -1;
        if (!aDrink && bDrink) return 1;
        return 0;
    });
};



const groupItems = (items) => {
    const grouped = [];
    const map = new Map();

    items.forEach(item => {
        const modsKey = JSON.stringify(item.modifiers || []);
        const key = `${item.name}|${modsKey}|${item.status}`;

        if (map.has(key)) {
            const existing = map.get(key);
            existing.quantity += item.quantity;
        } else {
            const newItem = { ...item };
            map.set(key, newItem);
            grouped.push(newItem);
        }
    });

    return grouped;
};

const getModColor = (text) => {
    if (!text) return 'mod-color-gray';
    const t = String(text).toLowerCase().trim();

    if (t.includes('בלי קצף') || t.includes('ללא קצף')) return 'bg-gray-100 text-gray-500 line-through decoration-gray-400';
    if (t.includes('פחות קצף') || t.includes('מעט קצף')) return 'bg-blue-50 text-blue-600 border-blue-100';
    if (t.includes('הרבה קצף') || t.includes('אקסטרה קצף')) return 'bg-blue-50 text-blue-800 border-blue-200 font-bold';

    if (t.includes('בלי') || t.includes('ללא') || t.includes('הורד'))
        return 'bg-red-50 text-red-600 border-red-100 line-through decoration-red-600/50';

    if (t.includes('תוספת') || t.includes('אקסטרה') || t.includes('בצד') || t.includes('קצף'))
        return 'bg-green-50 text-green-700 border-green-100';

    if (t.includes('סויה') || t.includes('שיבולת שועל') || t.includes('שיבולת'))
        return 'bg-amber-50 text-amber-800 border-amber-100';
    if (t.includes('שקדים'))
        return 'bg-amber-50 text-amber-900 border-amber-200';
    if (t.includes('נטול') || t.includes('דקף') || t.includes('ללא לקטוז'))
        return 'bg-blue-50 text-blue-700 border-blue-100';

    if (t.includes('רותח') || t.includes('חם מאוד')) return 'bg-red-50 text-red-700 font-bold border-red-100';
    if (t.includes('חזק') || t.includes('כפול')) return 'bg-gray-800 text-white font-bold';
    if (t.includes('חלש') || t.includes('קל')) return 'bg-gray-100 text-gray-500';

    return 'bg-gray-50 text-gray-600 border-gray-200';
};

// --- ManagerOrderCard Component ---
const ManagerOrderCard = ({ order, isReady = false, onOrderStatusUpdate, onPaymentCollected, onEditOrder, readOnly = false }) => {
    const [isUpdating, setIsUpdating] = useState(false);

    // Status Styles
    const isDelayedCard = order.type === 'delayed';
    const isUnpaidDelivered = order.type === 'unpaid_delivered';

    const getStatusStyles = (status) => {
        if (isDelayedCard) return 'bg-gray-50 border border-gray-200 opacity-95';
        if (isUnpaidDelivered) return 'border-2 border-blue-500 shadow-md bg-blue-50/30';
        return 'bg-white border border-gray-200 shadow-sm hover:border-gray-300';
    };

    const orderStatusLower = (order.orderStatus || '').toLowerCase();
    const nextStatusLabel =
        orderStatusLower === 'new' || orderStatusLower === 'pending'
            ? 'התחל הכנה'
            : (orderStatusLower === 'in_progress'
                ? 'מוכן להגשה'
                : (isReady ? 'נמסר' : 'מוכן להגשה'));

    const actionBtnColor = isReady
        ? 'bg-slate-900 text-white hover:bg-slate-800'
        : (orderStatusLower === 'new' || orderStatusLower === 'pending'
            ? 'bg-slate-800 text-white hover:bg-slate-700'
            : 'bg-green-600 text-white hover:bg-green-700');

    // Split Logic: Right = Drinks, Left = Food
    const items = order.items || [];

    // 🛡️ VIEW FILTERING:
    // In Prep Tab (!isReady): Hide Grab & Go items to focus kitchen attention.
    // In Ready Tab (isReady): Show EVERYTHING so expeditor packs the full order.
    const visibleItems = isReady
        ? items
        : items.filter(item => !item.isHiddenInPrep);

    const drinkItems = sortItems(visibleItems.filter(item => isDrink(item)));
    const foodItems = sortItems(visibleItems.filter(item => !isDrink(item)));

    const hasDrinks = drinkItems.length > 0;
    const hasFood = foodItems.length > 0;

    const renderItemRow = (item, idx) => (
        <div key={idx} className="flex items-start gap-2 py-1 border-b border-dashed border-gray-100 last:border-0 w-full">
            <span className={`flex items-center justify-center w-7 h-7 rounded-lg font-black text-base shrink-0 mt-0 ${item.quantity > 1 ? 'bg-orange-600 text-white ring-2 ring-orange-200' : (isDelayedCard ? 'bg-gray-300 text-gray-600' : 'bg-slate-900 text-white')}`}>
                {item.quantity}
            </span>
            <div className="flex-1 min-w-0 pr-1 text-right">
                <div className="leading-snug break-words">
                    <span className={`font-bold text-base ${item.quantity > 1 ? 'text-orange-700' : 'text-gray-900'}`}>
                        {item.name}
                    </span>
                    {item.modifiers && item.modifiers.length > 0 && (
                        <span className="inline-flex flex-wrap gap-1 mr-1">
                            {item.modifiers.map((mod, i) => {
                                const modText = typeof mod === 'object' ? mod.text : String(mod);
                                const isNote = typeof mod === 'object' && mod.isNote;
                                return (
                                    <span key={i} className={`text-xs px-1.5 rounded border leading-tight ${isNote ? 'bg-purple-50 text-purple-700 border-purple-100 italic' : getModColor(modText)}`}>
                                        {modText}
                                    </span>
                                );
                            })}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );

    const handleStatusClick = async (e) => {
        e.stopPropagation(); // Stop propagation just in case
        if (isUpdating) return;
        setIsUpdating(true);
        try {
            await onOrderStatusUpdate(order.id, order.orderStatus);
        } catch (error) {
            console.error('Status update failed', error);
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <div dir="rtl" className={`flex-shrink-0 rounded-2xl p-3 flex flex-col h-full font-heebo ${isDelayedCard ? 'bg-gray-50' : 'bg-white'} ${getStatusStyles(order.orderStatus)} border-x border-b border-gray-100`}>
            {/* Header */}
            <div className="flex justify-between items-start mb-2 border-b border-gray-50 pb-2">
                <div className="flex flex-col overflow-hidden w-full">
                    <div className="flex items-center gap-2 w-full">
                        <div className="flex-1 min-w-0 text-2xl font-black text-slate-900 leading-none tracking-tight truncate">
                            {order.customerName}
                        </div>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-sm font-bold text-gray-400">#{order.orderNumber}</span>
                        {isDelayedCard && (
                            <span className="bg-gray-200 text-gray-600 text-xs px-2 py-0.5 rounded-full font-bold border border-gray-300">
                                בהמתנה
                            </span>
                        )}
                    </div>
                </div>
                <div className="text-left flex flex-col items-end shrink-0 ml-2 gap-1.5">
                    <div className="flex items-center gap-1.5 text-gray-500 bg-gray-50 px-2 py-1 rounded-md border border-gray-100">
                        <Clock size={14} />
                        <span className="text-sm font-mono font-bold">{order.timestamp}</span>
                    </div>
                    {!order.isPaid ? (
                        <span className="text-xs font-black bg-red-100 text-red-600 px-2.5 py-1 rounded">לא שולם</span>
                    ) : (
                        <span className="flex items-center gap-1 text-xs font-bold bg-green-100 text-green-700 px-2.5 py-1 rounded">
                            <span>שולם</span>
                            {order.paymentMethod && (
                                <span className="font-extrabold opacity-80">
                                    ({order.paymentMethod === 'oth' ? 'הבית' :
                                        order.paymentMethod === 'credit_card' ? 'אשראי' :
                                            order.paymentMethod === 'bit' ? 'ביט' :
                                                order.paymentMethod === 'paybox' ? 'פייבוקס' :
                                                    order.paymentMethod === 'gift_card' ? 'שובר' :
                                                        order.paymentMethod === 'cash' ? 'מזומן' :
                                                            order.paymentMethod})
                                </span>
                            )}
                        </span>
                    )}
                    {order.soldierDiscount > 0 && (
                        <span className="text-[11px] font-bold text-blue-600 mt-0.5 px-1.5 bg-blue-50 rounded border border-blue-100">
                            הנחת חייל (-₪{order.soldierDiscount})
                        </span>
                    )}
                </div>
            </div>

            {/* Content - Strict 2 Columns: Right=Drinks, Left=Food */}
            <div className="flex-1 overflow-y-auto mb-2 pr-1">
                <div className="grid grid-cols-2 gap-3 items-start w-full relative">
                    {/* Right Column: Drinks */}
                    <div className="flex flex-col w-full min-h-[20px]">
                        {drinkItems.length > 0 ? (
                            drinkItems.map((item, idx) => renderItemRow(item, idx))
                        ) : (
                            <div className="text-sm text-gray-300 text-center italic py-2">-- אין שתיה --</div>
                        )}
                    </div>

                    {/* Left Column: Food */}
                    <div className="flex flex-col w-full min-h-[20px] border-r border-gray-100 pr-2">
                        {foodItems.length > 0 ? (
                            foodItems.map((item, idx) => renderItemRow(item, idx))
                        ) : (
                            <div className="text-sm text-gray-300 text-center italic py-2">-- אין אוכל --</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Actions */}
            {!readOnly && (
                <div className="mt-auto pt-2">
                    {isUnpaidDelivered ? (
                        <button
                            disabled={isUpdating}
                            onClick={async () => {
                                if (onPaymentCollected) { setIsUpdating(true); await onPaymentCollected(order); setIsUpdating(false); }
                            }}
                            className={`w-full py-2.5 bg-white border-2 border-amber-500 text-amber-700 rounded-xl font-black text-lg active:scale-[0.98] transition-all flex items-center justify-center gap-3 hover:bg-amber-50 ${isUpdating ? 'opacity-50' : ''}`}
                        >
                            <span>{isUpdating ? '...' : `לתשלום (₪${order.totalAmount?.toFixed(0)})`}</span>
                        </button>
                    ) : (
                        <div className="flex flex-row-reverse items-stretch gap-2 h-12 w-full">
                            <button
                                disabled={isUpdating}
                                onClick={handleStatusClick}
                                className={`flex-1 rounded-xl font-black text-lg shadow active:scale-[0.98] transition-all flex items-center justify-center ${actionBtnColor} ${isUpdating ? 'opacity-50' : ''}`}
                            >
                                {isUpdating ? '...' : nextStatusLabel}
                            </button>

                            {isReady && (
                                <button
                                    disabled={isUpdating}
                                    onClick={async (e) => {
                                        e.stopPropagation();
                                        setIsUpdating(true);
                                        await onOrderStatusUpdate(order.id, 'undo_ready');
                                        setIsUpdating(false);
                                    }}
                                    className="w-12 bg-gray-200 rounded-xl shadow-sm flex items-center justify-center text-gray-700 hover:bg-gray-300 shrink-0 border border-gray-300"
                                >
                                    <RotateCcw size={20} />
                                </button>
                            )}

                            {!order.isPaid && (
                                <button
                                    onClick={async () => { if (onPaymentCollected) { setIsUpdating(true); await onPaymentCollected(order); setIsUpdating(false); } }}
                                    className="w-12 bg-white border-2 border-amber-400 rounded-xl shadow-sm flex flex-col items-center justify-center hover:bg-amber-50 shrink-0 relative overflow-hidden"
                                >
                                    <span className="text-amber-600 font-bold text-xs absolute top-1">₪</span>
                                    <span className="text-[10px] font-bold text-red-600 absolute bottom-1">
                                        {order.totalAmount?.toFixed(0)}
                                    </span>
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// --- Main ManagerKDS Component ---
const ManagerKDS = () => {
    const navigate = useNavigate();
    const { currentUser, appVersion } = useAuth();
    const [orders, setOrders] = useState([]);
    const [statusTab, setStatusTab] = useState('prep');
    const [loading, setLoading] = useState(false);
    const [paymentModalData, setPaymentModalData] = useState({ isOpen: false, order: null });
    const [pendingPayments, setPendingPayments] = useState([]);
    const [verifyingPayment, setVerifyingPayment] = useState(null);

    // Get business name
    const businessName = currentUser?.impersonating_business_name || currentUser?.business_name || null;

    // Reuse RPC update logic from original KDS for consistency
    const handleStatusUpdate = async (orderId, currentStatus) => {
        let nextStatus = 'in_progress';

        // Logic for next status
        if (currentStatus === 'undo_ready') {
            nextStatus = 'in_progress';
        } else if (currentStatus === 'in_progress' || currentStatus === 'new' || currentStatus === 'pending') {
            nextStatus = 'ready';
        } else if (currentStatus === 'ready') {
            nextStatus = 'completed';
        }

        // Use the new consolidated RPC V3 for robustness (handles item status sync)
        const { error } = await supabase.rpc('update_order_status_v3', {
            p_order_id: orderId,
            p_new_status: nextStatus,
            p_business_id: currentUser?.business_id
        });

        if (error) {
            console.error("Error updating status via RPC:", error);
            alert("שגיאה בעדכון סטטוס: " + error.message);
        } else {
            fetchKDS(); // Refresh immediately
        }
    };

    const fetchKDS = async () => {
        setLoading(true);
        try {
            // Calculate start of today (00:00) to show only today's orders
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            // Removed: today.setDate(today.getDate() - 2); 

            const { data: ordersData, error } = await supabase.rpc('get_kds_orders', {
                p_business_id: currentUser?.business_id || null,
                p_date: today.toISOString()
            });

            if (error) throw error;

            const processed = (ordersData || []).map(order => {
                const rawItems = (order.items_detail || []).filter(item => {
                    // 1. Basic filter (not cancelled)
                    if (item.item_status === 'cancelled' || !item.menu_items) return false;

                    // 2. KDS Routing Logic (1:1 with useKDSData.js)
                    // If it's GRAB_AND_GO or CONDITIONAL (without manual override), we skip it in KDS view
                    const kdsLogic = item.menu_items?.kds_routing_logic;
                    let hasOverride = false;
                    const mods = item.mods;
                    if (typeof mods === 'string' && mods.includes('__KDS_OVER_RIDE__')) hasOverride = true; // Match common spelling
                    else if (typeof mods === 'string' && mods.includes('__KDS_OVERRIDE__')) hasOverride = true;
                    else if (Array.isArray(mods) && (mods.includes('__KDS_OVERRIDE__') || mods.includes('__KDS_OVER_RIDE__'))) hasOverride = true;

                    // INSTEAD OF FILTERING EXECUTION:
                    // We mark items as "hiddenInPrep" so they don't show up in the prep list,
                    // but they DO show up in the ready list.
                    if ((kdsLogic === 'GRAB_AND_GO' || kdsLogic === 'CONDITIONAL') && !hasOverride) {
                        item.isHiddenInPrep = true;
                        // We do NOT return false here anymore. We keep the item.
                    }

                    return true;
                });

                if (rawItems.length === 0) return null;

                const allReady = rawItems.every(i => i.item_status === 'ready' || i.item_status === 'completed');
                const isCompleted = order.order_status === 'completed';

                let groupStatus = 'prep';
                if (allReady && !isCompleted) groupStatus = 'ready';
                if (isCompleted && !order.is_paid) groupStatus = 'ready';
                else if (isCompleted && order.is_paid) return null;

                const formattedItems = groupItems(rawItems.map(formatItem));

                return formatOrder(
                    {
                        ...order,
                        created_at: order.created_at,
                        order_number: order.order_number,
                        order_status: order.order_status
                    },
                    formattedItems,
                    groupStatus,
                    order.is_paid,
                    (isCompleted && !order.is_paid) ? 'unpaid_delivered' : 'normal'
                );
            }).filter(Boolean);

            setOrders(processed);
        } catch (err) {
            console.error('Manager KDS Fetch Error:', err);
        } finally {
            setLoading(false);
        }
    };

    const formatItem = (item) => {
        let modsArray = [];
        if (item.mods) {
            try {
                const parsed = typeof item.mods === 'string' ? JSON.parse(item.mods) : item.mods;
                if (Array.isArray(parsed)) modsArray = parsed.map(m => typeof m === 'object' ? m.value_name : m);
            } catch (e) { }
        }
        if (item.notes) modsArray.push({ text: item.notes, isNote: true });

        return {
            category: item.menu_items?.category,
            name: item.menu_items?.name,
            quantity: item.quantity,
            modifiers: modsArray.map(m => typeof m === 'object' ? m : { text: String(m) }),
            status: item.item_status,
            is_hot_drink: item.menu_items?.is_hot_drink,
            price: item.price
        };
    };

    const formatOrder = (order, items, statusGroup, isPaid, type = 'normal') => {
        // items is already processed and includes quantity and menu_items data
        const totalAmount = items.reduce((sum, i) => sum + (i.price || 0) * (i.quantity || 1), 0);
        return {
            id: order.id,
            orderNumber: order.order_number || order.id.slice(0, 4),
            customerName: order.customer_name || 'אורח',
            timestamp: new Date(order.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }),
            items: items,
            statusGroup: statusGroup,
            orderStatus: order.order_status,
            isPaid: isPaid,
            paymentMethod: order.payment_method,
            soldierDiscount: order.discount_amount || order.soldier_discount || 0,
            type: type,
            totalAmount
        };
    };

    const handlePayment = (order) => {
        setPaymentModalData({ isOpen: true, order });
    };

    const handleConfirmPayment = async (orderId, paymentMethod) => {
        try {
            const { error } = await supabase.rpc('confirm_order_payment', {
                p_order_id: orderId,
                p_payment_method: paymentMethod
            });
            if (error) throw error;
            setPaymentModalData({ isOpen: false, order: null });
            fetchKDS();
        } catch (err) {
            console.error('Error confirming payment:', err);
            alert('שגיאה באישור תשלום: ' + err.message);
        }
    };

    const fetchPendingPayments = async () => {
        try {
            const { data, error } = await supabase
                .from('orders')
                .select('id, order_number, customer_name, customer_phone, total_amount, payment_method, created_at')
                .eq('order_status', 'awaiting_payment_verification')
                .eq('business_id', currentUser?.business_id)
                .order('created_at', { ascending: true });

            if (error) throw error;
            setPendingPayments(data || []);
        } catch (err) {
            console.error('Error fetching pending payments:', err);
        }
    };

    useEffect(() => {
        if (!currentUser?.business_id) return;

        fetchKDS();
        fetchPendingPayments();

        console.log('📡 [ManagerKDS] Initializing real-time subscription for business:', currentUser.business_id);

        // 🟢 Real-time Subscription 
        const channel = supabase
            .channel(`kds-manager-${currentUser.business_id}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'orders',
                filter: `business_id=eq.${currentUser.business_id}`
            }, (payload) => {
                console.log('🔔 [Realtime] Order change detected:', payload.eventType, payload.new?.id);
                fetchKDS();
                fetchPendingPayments();
            })
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'order_items'
            }, () => {
                // Since order_items doesn't have business_id, we refresh on any change.
                // This is safe because fetchKDS uses the business-filtered RPC.
                fetchKDS();
            })
            .subscribe((status) => {
                console.log('📡 [Realtime] Subscription status:', status);
            });

        // 🕒 Polling Fallback (Fast 3s)
        const interval = setInterval(() => {
            fetchKDS();
            fetchPendingPayments();
        }, 3000);

        return () => {
            console.log('🚫 [ManagerKDS] Cleaning up subscription and interval');
            supabase.removeChannel(channel);
            clearInterval(interval);
        };
    }, [currentUser?.business_id]);

    useEffect(() => {
        if (statusTab === 'payments') {
            fetchPendingPayments();
        }
    }, [statusTab]);

    const handleApprovePayment = async (orderId) => {
        setVerifyingPayment(orderId);
        try {
            const { error } = await supabase
                .from('orders')
                .update({
                    order_status: 'pending',
                    payment_verified: true,
                    is_paid: true
                })
                .eq('id', orderId);

            if (error) throw error;
            fetchPendingPayments();
            fetchKDS();
        } catch (err) {
            alert('שגיאה באישור התשלום: ' + err.message);
        } finally {
            setVerifyingPayment(null);
        }
    };

    const handleRejectPayment = async (orderId) => {
        if (!confirm('האם לדחות את התשלום ולבטל את ההזמנה?')) return;
        setVerifyingPayment(orderId);
        try {
            const { error } = await supabase
                .from('orders')
                .update({ order_status: 'cancelled', payment_verified: false })
                .eq('id', orderId);

            if (error) throw error;
            fetchPendingPayments();
        } catch (err) {
            alert('שגיאה בדחיית התשלום: ' + err.message);
        } finally {
            setVerifyingPayment(null);
        }
    };

    const displayedOrders = orders.filter(o => {
        if (statusTab === 'prep') return o.statusGroup === 'prep';
        if (statusTab === 'ready') return o.statusGroup === 'ready' || (o.orderStatus === 'completed' && !o.isPaid);
        return false;
    });

    return (
        <div className="h-full flex flex-col bg-gray-100" dir="rtl">
            {/* Header with Back Button */}
            <div className="bg-slate-900 px-4 py-3 flex items-center justify-between shrink-0">
                <button
                    onClick={() => navigate('/mode-selection')}
                    className="flex items-center gap-1 text-white/80 hover:text-white transition-colors"
                >
                    <ChevronRight size={20} />
                    <span className="text-sm font-bold">חזרה</span>
                </button>
                <h1 className="text-white font-black text-lg">צפייה בהזמנות</h1>
                <div className="w-16" /> {/* Spacer for centering */}
            </div>

            {/* Business Info Bar */}
            <div className="bg-slate-800 px-4 py-1.5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_4px_rgba(34,197,94,0.6)]" />
                    <span className="text-[10px] font-bold text-green-400">{businessName || 'לא מחובר'}</span>
                </div>
                <span className="text-[10px] text-slate-500 font-mono">{appVersion || 'v1.0'}</span>
            </div>

            {/* Tab Switcher - Modern Mobile Design */}
            <div className="p-3 sticky top-0 z-20 bg-gray-100/90 backdrop-blur-sm">
                <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-gray-200">
                    <button
                        onClick={() => setStatusTab('prep')}
                        className={`flex-1 py-3.5 text-sm font-black rounded-xl transition-all flex items-center justify-center gap-1.5 ${statusTab === 'prep' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:bg-gray-50'}`}
                    >
                        <LayoutGrid size={18} strokeWidth={2.5} />
                        <span>הכנה ({orders.filter(o => o.statusGroup === 'prep').length})</span>
                    </button>
                    <button
                        onClick={() => setStatusTab('ready')}
                        className={`flex-1 py-3.5 text-sm font-black rounded-xl transition-all flex items-center justify-center gap-1.5 ${statusTab === 'ready' ? 'bg-green-600 text-white shadow-md' : 'text-gray-400 hover:bg-gray-50'}`}
                    >
                        <CheckCircle size={18} strokeWidth={2.5} />
                        <span>מוכן ({orders.filter(o => o.statusGroup === 'ready' || (o.orderStatus === 'completed' && !o.isPaid)).length})</span>
                    </button>
                    <button
                        onClick={() => { setStatusTab('payments'); fetchPendingPayments(); }}
                        className={`flex-1 py-3.5 text-sm font-black rounded-xl transition-all flex items-center justify-center gap-1.5 ${statusTab === 'payments' ? 'bg-amber-500 text-white shadow-md' : 'text-gray-400 hover:bg-gray-50'}`}
                    >
                        <CreditCard size={18} strokeWidth={2.5} />
                        <span>תשלום ({pendingPayments.length})</span>
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {statusTab === 'payments' ? (
                    // Payment Verification Tab
                    pendingPayments.length === 0 ? (
                        <div className="text-center py-10 text-gray-400 flex flex-col items-center gap-2">
                            <CreditCard size={40} className="opacity-20" />
                            <span>אין העברות ממתינות לאישור</span>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-3 pb-20">
                            {pendingPayments.map(payment => (
                                <motion.div
                                    key={payment.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-white rounded-2xl p-4 border-2 border-amber-400 shadow-md"
                                >
                                    {/* Header */}
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <div className="text-lg font-black text-slate-900">{payment.customer_name}</div>
                                            <div className="text-xs text-gray-400">#{payment.order_number} • {payment.customer_phone}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xl font-black text-amber-600">₪{payment.total_amount}</div>
                                            <div className="text-xs font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full mt-1">
                                                {payment.payment_method === 'bit' ? 'ביט' : 'פייבוקס'}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Items Summary */}
                                    {payment.items && (
                                        <div className="text-xs text-gray-500 mb-3 border-t pt-2">
                                            {Array.isArray(payment.items)
                                                ? payment.items.map(i => `${i.quantity}x ${i.name}`).join(', ')
                                                : 'פריטים לא זמינים'}
                                        </div>
                                    )}

                                    {/* Payment Screenshot */}
                                    {payment.payment_screenshot_url && (
                                        <div className="mb-3">
                                            <a
                                                href={payment.payment_screenshot_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                                            >
                                                <Image size={16} />
                                                צפייה בצילום מסך
                                            </a>
                                        </div>
                                    )}

                                    {/* Actions Hidden for View-Only Mode */}
                                    <div className="mt-2 text-center text-xs text-slate-400 font-bold bg-slate-50 py-2 rounded-lg border border-slate-100 italic">
                                        מצב צפייה בלבד - לא ניתן לאשר כאן
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )
                ) : loading && orders.length === 0 ? (
                    <div className="text-center py-10 text-gray-400">טוען...</div>
                ) : displayedOrders.length === 0 ? (
                    <div className="text-center py-10 text-gray-400 flex flex-col items-center gap-2">
                        <Check size={40} className="opacity-20" />
                        <span>אין הזמנות בסטטוס זה</span>
                    </div>
                ) : (
                    <motion.div layout className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-20 items-stretch">
                        <AnimatePresence mode="popLayout">
                            {displayedOrders.map(order => (
                                <motion.div
                                    layout
                                    key={order.id}
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                                >
                                    <ManagerOrderCard
                                        order={order}
                                        isReady={statusTab === 'ready'}
                                        onOrderStatusUpdate={handleStatusUpdate}
                                        onPaymentCollected={handlePayment}
                                        readOnly={true}
                                    />
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </motion.div>
                )}
            </div>

            {/* Refresh Button */}
            <button
                onClick={fetchKDS}
                className="fixed bottom-6 left-6 p-4 bg-blue-600 text-white rounded-full shadow-lg shadow-blue-600/30 hover:bg-blue-700 active:scale-90 transition-all z-20"
            >
                <RotateCcw size={20} className={loading ? 'animate-spin' : ''} />
            </button>

            <KDSPaymentModal
                isOpen={paymentModalData.isOpen}
                onClose={() => setPaymentModalData({ ...paymentModalData, isOpen: false })}
                order={paymentModalData.order}
                onConfirmPayment={handleConfirmPayment}
                isFromHistory={true}
            />
        </div>
    );
};

export default ManagerKDS;
