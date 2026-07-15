import React, { useState, useEffect } from 'react';
import { X, Truck, Package, Phone, Check, Loader2, User } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const ShipmentModal = ({
    isOpen,
    onClose,
    order,
    onUpdateStatus, // Function to update order status
    onUpdateOrder, // 🆕 Function to update generic fields (e.g. driver)
    onToggleItemPacked, // Function to toggle item packing
    onShipmentConfirmed, // 🆕 Explicit handler for shipment confirmation
    onPaymentClick // 🆕 Handler for payment
}) => {
    const [step, setStep] = useState('packing'); // 'packing' | 'driver'
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [packedItems, setPackedItems] = useState(new Set());
    const [drivers, setDrivers] = useState([]);
    const [isLoadingDrivers, setIsLoadingDrivers] = useState(false);

    // Driver Details
    const [selectedDriver, setSelectedDriver] = useState(null);
    const [driverName, setDriverName] = useState('');
    const [driverPhone, setDriverPhone] = useState('');

    // Locking / PIN
    const [isLocked, setIsLocked] = useState(false);
    const [showPinInput, setShowPinInput] = useState(false);
    const [pin, setPin] = useState('');
    const [pinError, setPinError] = useState('');

    // Fetch drivers on mount
    useEffect(() => {
        if (isOpen) {
            const fetchDrivers = async () => {
                setIsLoadingDrivers(true);
                try {
                    // Fetch employees who are drivers
                    const { data, error } = await supabase
                        .from('employees')
                        .select('id, name, phone, whatsapp_phone')
                        .eq('is_driver', true);

                    if (error) throw error;
                    setDrivers(data || []);
                } catch (err) {
                    console.error('Error fetching drivers:', err);
                } finally {
                    setIsLoadingDrivers(false);
                }
            };

            fetchDrivers();
        }
    }, [isOpen]);

    // Initialize state from order
    useEffect(() => {
        if (isOpen && order) {
            setStep('packing');
            setDriverName(order.driver_name || '');
            setDriverPhone(order.driver_phone || '');
            setSelectedDriver(null);

            // Initialize packed items
            const initialPacked = new Set();
            order.items?.forEach(item => {
                if (item.is_packed || item.item_status === 'ready') {
                    initialPacked.add(item.id);
                }
            });
            setPackedItems(initialPacked);

            // Try to match existing driver info to an employee
            if (order.driver_name && drivers.length > 0) {
                const match = drivers.find(d => d.name === order.driver_name);
                if (match) setSelectedDriver(match);
            }

            // Lock if driver is already assigned
            if (order.driver_id) {
                setIsLocked(true);
                setShowPinInput(false);
                setPin('');
            } else {
                setIsLocked(false);
            }
        }
    }, [isOpen, order, drivers]);

    const handleUnlock = async () => {
        if (pin.length < 4) {
            setPinError('אנא הזן קוד בן 4 ספרות');
            return;
        }

        setIsSubmitting(true);
        try {
            // Check if PIN belongs to a manager
            // Note: In a real app, do this via RPC to avoid exposing PINs.
            // Here assuming we can select. If RLS fails, we need another way.
            // Using a simple check for now based on previous context.
            const { data, error } = await supabase
                .from('employees')
                .select('id')
                .eq('pin_code', pin)
                .eq('role', 'manager') // Ensure it is a manager
                .limit(1);

            if (error) throw error;

            if (data && data.length > 0) {
                setIsLocked(false);
                setShowPinInput(false);
            } else {
                setPinError('קוד שגוי או אין הרשאות מנהל');
            }
        } catch (err) {
            console.error('Error verifying PIN:', err);
            setPinError('שגיאה באימות קוד');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleToggleItem = async (itemId) => {
        // 1. Calculate new state locally
        const nextPacked = new Set(packedItems);
        const isPacking = !nextPacked.has(itemId);

        if (isPacking) {
            nextPacked.add(itemId);
        } else {
            nextPacked.delete(itemId);
        }
        setPackedItems(nextPacked);

        // 2. Call parent to update DB/UI for the item
        if (onToggleItemPacked) {
            // Pass simple obj with id
            await onToggleItemPacked(order.id, [{ id: itemId, is_packed: !isPacking /* current state to flip */ }]);
        }

        // 3. Handle Order Status Transitions
        const totalItems = order.items?.length || 0;
        const packedCount = nextPacked.size;

        let newStatus = null;
        const currentStatus = order.order_status;

        if (packedCount === 0) {
            if (currentStatus === 'in_prep' || currentStatus === 'ready') {
                newStatus = 'new';
            }
        } else if (packedCount < totalItems) {
            if (currentStatus === 'new' || currentStatus === 'pending' || currentStatus === 'ready') {
                newStatus = 'in_prep';
            }
        } else if (packedCount === totalItems) {
            // All packed -> 'shipped' (Changed from 'ready' per user request)
            if (currentStatus !== 'shipped' && currentStatus !== 'delivered') {
                newStatus = 'shipped';
            }
        }

        if (newStatus && newStatus !== currentStatus && onUpdateStatus) {
            console.log(`📦 Packing Logic: Moving order ${order.id} from ${currentStatus} to ${newStatus}`);
            await onUpdateStatus(order.id, newStatus);
        }
    };

    const handleDriverSelect = (driver) => {
        setSelectedDriver(driver);
        setDriverName(driver.name);
        setDriverPhone(driver.phone || driver.whatsapp_phone || '');
    };

    const handleSaveDriver = async (shouldShip = false) => {
        setIsSubmitting(true);
        try {
            // 1. Save driver details first
            const updateData = {
                driver_id: selectedDriver?.id || null, // Ensure ID is saved
                driver_name: driverName,
                driver_phone: driverPhone,
                courier_name: 'שליח פנימי', // Internal courier
                // Only set status if shipping
                ...(shouldShip ? { order_status: 'shipped' } : {})
            };

            // Use hook update function if available (Optimistic UI for driver fields)
            if (onUpdateOrder) {
                const success = await onUpdateOrder(order.id, updateData);
                if (!success) throw new Error('Update failed');
            } else {
                // Fallback to direct supabase update
                const { error } = await supabase
                    .from('orders')
                    .update(updateData)
                    .eq('id', order.id);

                if (error) throw error;
            }

            // 2. Refresh / Confirm
            if (shouldShip && onShipmentConfirmed) {
                // This triggers the parent's logic to set status='shipped' and refresh
                await onShipmentConfirmed(order.id);
            } else {
                // Just close
                onClose();
                // If we have a refresh function passed, we might want to call it, but usually onClose is enough if parent updates optimistic
            }
        } catch (err) {
            console.error('Error saving driver:', err);
            alert('שגיאה בשמירת פרטי שליח');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen || !order) return null;

    const allItemsPacked = order.items?.every(i => packedItems.has(i.id));
    const isPaid = order.is_paid !== undefined ? order.is_paid : order.isPaid;

    return (
        <div
            className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm font-heebo"
            dir="rtl"
            onClick={onClose}
        >
            <div
                className="relative w-[500px] bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh] ring-1 ring-black/5"
                onClick={e => e.stopPropagation()}
            >
                {/* Header & Tabs */}
                <div className="bg-white px-6 pt-5 pb-0 flex flex-col border-b border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${step === 'packing' ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'}`}>
                                {step === 'packing' ? <Package size={24} strokeWidth={1.5} /> : <Truck size={24} strokeWidth={1.5} />}
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 leading-tight">
                                    ניהול אריזה ושילוח
                                </h2>
                                <p className="text-sm text-gray-400 font-medium">הזמנה #{order.orderNumber}</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-gray-50 rounded-full transition-colors text-gray-400 hover:text-gray-600">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-6 relative">
                        <button
                            onClick={() => setStep('packing')}
                            className={`pb-3 text-sm font-bold transition-colors relative ${step === 'packing' ? 'text-orange-600' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            אריזת פריטים
                            {step === 'packing' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-600 rounded-t-full" />}
                        </button>
                        <button
                            onClick={() => setStep('driver')}
                            className={`pb-3 text-sm font-bold transition-colors relative ${step === 'driver' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            פרטי שליח
                            {step === 'driver' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full" />}
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-white scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
                    {step === 'packing' ? (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-200">
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wide">רשימת פריטים</h3>
                                    <span className="text-xs font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                                        {packedItems.size} / {order.items?.length}
                                    </span>
                                </div>
                                <div className="space-y-2">
                                    {order.items?.map(item => (
                                        <div
                                            key={item.id}
                                            onClick={() => handleToggleItem(item.id)}
                                            className={`group flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer select-none active:scale-[0.99] ${packedItems.has(item.id)
                                                ? 'bg-gray-50 border-gray-200'
                                                : 'bg-white border-gray-100 hover:border-orange-200 hover:shadow-sm'}`}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all border ${packedItems.has(item.id) ? 'bg-green-500 border-green-500 text-white' : 'bg-white border-gray-300 text-transparent group-hover:border-orange-300'}`}>
                                                    <Check size={14} strokeWidth={3} />
                                                </div>
                                                <div>
                                                    <div className={`font-bold text-base ${packedItems.has(item.id) ? 'text-gray-400 line-through decoration-2 decoration-gray-300' : 'text-gray-800'}`}>{item.name}</div>
                                                    {item.modifiers && item.modifiers.length > 0 && (
                                                        <div className={`text-xs ${packedItems.has(item.id) ? 'text-gray-300' : 'text-gray-400'}`}>{item.modifiers.map(m => m.name || m.text).join(', ')}</div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className={`font-mono font-medium text-sm px-2 py-0.5 rounded-md ${packedItems.has(item.id) ? 'bg-gray-100 text-gray-400' : 'bg-gray-50 text-gray-600'}`}>x{item.quantity}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Progress Bar */}
                            <div className="bg-gray-100 h-1.5 w-full rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-green-500 transition-all duration-500 ease-out"
                                    style={{ width: `${(packedItems.size / (order.items?.length || 1)) * 100}%` }}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6 animate-in slide-in-from-left-4 duration-200">
                            {isLocked ? (
                                <div className="flex flex-col items-center justify-center py-8 space-y-4 text-center">
                                    <div className="bg-blue-50 p-4 rounded-full text-blue-500 mb-2">
                                        <Truck size={32} />
                                    </div>
                                    <h3 className="font-bold text-lg text-gray-800">הזמנה זו כבר משויכת לשליח</h3>
                                    <p className="text-gray-500 text-sm max-w-[250px]">
                                        השליח <strong>{order.driver_name}</strong> כבר קיבל את הפרטים.
                                        שינוי שליח דורש אישור מנהל.
                                    </p>

                                    {!showPinInput ? (
                                        <button
                                            onClick={() => setShowPinInput(true)}
                                            className="mt-4 px-6 py-2.5 bg-slate-900 text-white rounded-xl font-bold shadow-lg hover:bg-slate-800 active:scale-95 transition-all"
                                        >
                                            שנה שליח (מנהל בלבד)
                                        </button>
                                    ) : (
                                        <div className="flex flex-col items-center gap-3 w-full max-w-[200px] mt-4">
                                            <input
                                                type="password"
                                                value={pin}
                                                onChange={e => { setPin(e.target.value); setPinError(''); }}
                                                className="w-full text-center text-xl tracking-widest px-4 py-3 border rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none font-mono"
                                                placeholder="קוד מנהל"
                                                maxLength={6}
                                                autoFocus
                                            />
                                            {pinError && <span className="text-red-500 text-xs font-bold">{pinError}</span>}
                                            <div className="flex gap-2 w-full">
                                                <button
                                                    onClick={() => setShowPinInput(false)}
                                                    className="flex-1 py-2 bg-gray-100 text-gray-600 rounded-lg font-bold text-sm"
                                                >
                                                    ביטול
                                                </button>
                                                <button
                                                    onClick={handleUnlock}
                                                    disabled={isSubmitting}
                                                    className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm"
                                                >
                                                    {isSubmitting ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'אשר'}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <>
                                    {/* Drivers List */}
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center">
                                            <label className="text-sm font-bold text-gray-400 uppercase tracking-wide">בחר שליח</label>
                                            <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">צוות פנימי</span>
                                        </div>

                                        {isLoadingDrivers ? (
                                            <div className="flex justify-center p-8"><Loader2 className="animate-spin text-gray-300" /></div>
                                        ) : drivers.length === 0 ? (
                                            <div className="text-center p-8 bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-gray-400 text-sm">
                                                לא נמצאו שליחים במערכת
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-2 gap-3">
                                                {drivers.map(driver => (
                                                    <button
                                                        key={driver.id}
                                                        onClick={() => handleDriverSelect(driver)}
                                                        className={`p-3 rounded-xl border text-right transition-all flex items-center gap-3 ${selectedDriver?.id === driver.id
                                                            ? 'bg-blue-50 border-blue-200 shadow-sm ring-1 ring-blue-200'
                                                            : 'bg-white border-gray-100 text-gray-600 hover:border-gray-300 hover:bg-gray-50'}`}
                                                    >
                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${selectedDriver?.id === driver.id ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                                                            <User size={16} />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className={`font-bold text-sm truncate ${selectedDriver?.id === driver.id ? 'text-blue-900' : 'text-gray-700'}`}>{driver.name}</div>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Manual Override - Clean Inputs */}
                                    <div className="pt-6 border-t border-gray-50 space-y-4">
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-gray-400">שם השליח (עריכה ידנית)</label>
                                            <input
                                                type="text"
                                                value={driverName}
                                                onChange={e => setDriverName(e.target.value)}
                                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-medium text-gray-800 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-50 outline-none transition-all"
                                                placeholder="שם השליח"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-gray-400">טלפון ליצירת קשר</label>
                                            <input
                                                type="tel"
                                                value={driverPhone}
                                                onChange={e => setDriverPhone(e.target.value)}
                                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-medium text-gray-800 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-50 outline-none transition-all"
                                                placeholder="050-0000000"
                                                dir="ltr"
                                                style={{ textAlign: 'right' }}
                                            />
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer - Sticky Bottom */}
                <div className="p-4 bg-white border-t border-gray-100 flex gap-3">
                    {step === 'driver' ? (
                        <>
                            {!isLocked && (
                                <div className="flex gap-2 w-full">
                                    <button
                                        onClick={() => handleSaveDriver(false)}
                                        disabled={isSubmitting || !driverName}
                                        className="flex-1 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-base hover:bg-slate-50 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <Check size={20} />}
                                        <span>שמור (ללא שליחה)</span>
                                    </button>

                                    <button
                                        onClick={() => handleSaveDriver(true)}
                                        disabled={isSubmitting || !driverName}
                                        className="flex-[1.5] py-3 bg-blue-600 text-white rounded-xl font-bold text-base shadow-lg shadow-blue-100 hover:bg-blue-700 hover:shadow-blue-200 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Truck size={20} />
                                        <span>שמור והוצא למשלוח</span>
                                    </button>
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            {onPaymentClick && !isPaid && (
                                <button
                                    onClick={() => onPaymentClick(order)}
                                    className="flex-1 py-4 bg-amber-500 text-white rounded-xl font-bold text-base shadow-lg shadow-amber-100 hover:bg-amber-600 active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                    <span>₪{(order.totalAmount || order.total_amount || 0).toFixed(0)} לתשלום</span>
                                </button>
                            )}
                            <button
                                onClick={() => setStep('driver')}
                                disabled={!allItemsPacked}
                                className={`flex-[2] py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2 transition-all active:scale-95 ${!allItemsPacked
                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                    : 'bg-slate-900 text-white shadow-lg shadow-slate-200 hover:bg-slate-800'
                                    }`}
                            >
                                <span>המשך לבחירת שליח</span>
                                <Truck size={20} />
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ShipmentModal;
