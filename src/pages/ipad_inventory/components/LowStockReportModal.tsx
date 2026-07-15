import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, AlertTriangle, Check, Plus, Minus, MessageSquare } from 'lucide-react';
import { sendSms } from '@/services/smsService';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { InventoryItem } from '@/pages/ipad_inventory/types';

interface LowStockReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    items: InventoryItem[];
    currentStocks: Record<string, number>;
    onUpdateStock: (itemId: string, delta: number) => void;
}

const LowStockReportModal: React.FC<LowStockReportModalProps> = ({ isOpen, onClose, items, currentStocks, onUpdateStock }) => {
    const { currentUser } = useAuth();
    const businessId = currentUser?.business_id;
    // We update the PARENT directly via onUpdateStock when user adjusts?
    // Or we keep local state and save all at once?
    // User said "Update inventory of each item... then send".
    // Better to update 'live' (or with save button per row) so the system is updated.
    // We'll use the existing `onUpdateStock` logic which probably saves to DB.

    const [sending, setSending] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [targetPhone, setTargetPhone] = useState('0548317887'); // Default fallback
    const [ownerName, setOwnerName] = useState('...'); // Loading state

    // Fetch Target SMS Number & Owner Name specific to this business
    React.useEffect(() => {
        const fetchSettings = async () => {
            if (!businessId) {
                console.log('LowStockReport: No business ID available yet');
                return;
            }

            console.log('LowStockReport: Fetching settings for business ID:', businessId);
            const { data, error } = await supabase
                .from('businesses')
                .select('sms_number, owner_name')
                .eq('id', businessId)
                .single()
                .setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

            if (error) {
                console.error('LowStockReport: Fetch error', error);
                // If it's the demo business and fetch fails, we can at least set a better name if it's missing in DB
                if (businessId.startsWith('22222')) setOwnerName('רן');
                return;
            }

            console.log('LowStockReport: Got settings from DB:', data);

            if (data?.sms_number) setTargetPhone(data.sms_number);

            if (data?.owner_name && data.owner_name.trim() !== '') {
                setOwnerName(data.owner_name);
            } else {
                console.log('LowStockReport: owner_name is empty in database, using fallback');
                setOwnerName(businessId.startsWith('22222') ? 'רן' : 'הבעלים');
            }
        };

        if (isOpen) {
            fetchSettings();
        }
    }, [businessId, isOpen]);

    // Filter items that are low stock based on current (or edited) values
    const lowStockItems = useMemo(() => {
        const filtered = items.filter(item => {
            const thresholdUnits = parseFloat(item.low_stock_threshold_units) || 0;
            if (thresholdUnits === 0) return false;

            const wpu = parseFloat(item.weight_per_unit) || 0;
            const thresholdGrams = thresholdUnits * (wpu || 1);

            // Use the most up-to-date stock value passed from parent
            const stock = currentStocks[item.id] !== undefined ? currentStocks[item.id] : (item.current_stock || 0);
            return stock <= thresholdGrams;
        }).sort((a, b) => {
            // Sort by Supplier? Or Category? Or Name? Name is easiest.
            return a.name.localeCompare(b.name);
        });

        if (isOpen) {
            console.log('LowStockReport: Initializing modal with', filtered.length, 'low stock items:', filtered);
        }
        return filtered;
    }, [items, currentStocks, isOpen]);

    const handleSmsSend = async () => {
        setSending(true);
        // Use dynamically fetched phone or fallback
        const PHONE = targetPhone;
        const NAME = ownerName;

        let message = `דוח חוסרים (${new Date().toLocaleDateString('he-IL')}) 📉\n`;
        message += `היי ${NAME}, צריך להביא לבוקר:\n\n`;

        lowStockItems.forEach(item => {
            const stock = currentStocks[item.id] !== undefined ? currentStocks[item.id] : (item.current_stock || 0);

            const conversionFactor = (() => {
                const fromSettings = parseFloat(item?.settings?.conversion_factor);
                if (!isNaN(fromSettings) && fromSettings > 0) return fromSettings;
                const fromWeight = parseFloat(item?.weight_per_unit as any);
                if (!isNaN(fromWeight) && fromWeight > 0) return fromWeight;
                // Fallback for base units of grams and ml:
                const unit = (item?.base_unit || item?.unit || '').toLowerCase();
                if (unit.includes('גרם') || unit.includes('מ"ל') || unit === 'g' || unit === 'ml') {
                    return 1000;
                }
                return 1;
            })();
            const displayUnit = item?.display_unit || item?.settings?.display_unit || 
                (((item?.base_unit || item?.unit || '').includes('גרם') || (item?.base_unit || item?.unit || '').includes('מ"ל')) ? 'יח\'' : null);
            const baseUnit = item?.base_unit || item?.unit || 'יח\'';
            const hasDisplayUnit = !!displayUnit && conversionFactor > 1;

            let quantityDisplay = '';
            if (hasDisplayUnit) {
                const displayVal = stock / conversionFactor;
                quantityDisplay = `${displayVal % 1 === 0 ? displayVal : displayVal.toFixed(2)} ${displayUnit}`;
            } else if (baseUnit === 'גרם' && stock >= 1000) {
                quantityDisplay = `${(stock / 1000).toFixed(2)} ק״ג`;
            } else if (baseUnit === 'מ"ל' && stock >= 1000) {
                quantityDisplay = `${(stock / 1000).toFixed(2)} ליטר`;
            } else {
                quantityDisplay = `${stock} ${baseUnit}`;
            }

            message += `- ${item.name}: ${quantityDisplay} (מינ׳ ${item.low_stock_threshold_units} ${hasDisplayUnit ? displayUnit : baseUnit})\n`;
        });

        message += `\nתודה!`;

        console.log(`LowStockReport: Sending SMS to ${PHONE} (${NAME}):\n`, message);

        try {
            const res = await sendSms(PHONE, message);
            if (res.success) {
                setShowSuccess(true);
                // We'll auto-close after 3 seconds, or let user click 'Done'
            } else {
                alert('שגיאה בשליחת SMS: ' + (res.error || 'Unknown error'));
            }
        } catch (e) {
            console.error('SMS Failed:', e);
            alert('שגיאה בשליחה');
        } finally {
            setSending(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.5 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black z-[150]"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed inset-0 md:inset-10 bg-white z-[151] rounded-2xl shadow-2xl flex flex-col max-w-4xl mx-auto overflow-hidden"
                    >
                        {/* Header */}
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between shrink-0 bg-slate-900 text-white rounded-t-3xl relative overflow-hidden">
                            <div className="relative z-10">
                                <h2 className="text-3xl font-black tracking-tight">דוח חוסרים (סוף יום)</h2>
                                <p className="text-slate-400 text-sm font-bold mt-1">אנא ודא שהכמויות תואמות למציאות לפני השליחה</p>
                            </div>
                            <button
                                onClick={onClose}
                                title="סגור"
                                className="z-10 w-12 h-12 flex items-center justify-center rounded-2xl bg-white/10 hover:bg-white/20 transition-colors"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-4 bg-gray-50 flex flex-col">
                            {showSuccess ? (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="flex-1 flex flex-col items-center justify-center text-center p-8"
                                >
                                    <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6 shadow-inner">
                                        <motion.div
                                            initial={{ scale: 0 }}
                                            animate={{ scale: [0, 1.2, 1] }}
                                            transition={{ duration: 0.5, times: [0, 0.7, 1] }}
                                        >
                                            <Check size={48} strokeWidth={4} />
                                        </motion.div>
                                    </div>
                                    <h3 className="text-3xl font-black text-slate-800 mb-2">נשלח בהצלחה!</h3>
                                    <p className="text-gray-500 text-lg max-w-sm">
                                        דוח החוסרים נשלח ל<b>{ownerName}</b>.
                                        <br />
                                        הוא קיבל את הרשימה המעודכנת וידאג לכל מה שצריך.
                                    </p>

                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={onClose}
                                        className="mt-10 bg-slate-900 text-white px-10 py-3 rounded-xl font-bold text-lg shadow-xl"
                                    >
                                        מעולה, תודה!
                                    </motion.button>
                                </motion.div>
                            ) : lowStockItems.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-gray-400 py-20">
                                    <Check size={64} className="text-green-500 mb-4" />
                                    <h3 className="text-xl font-bold text-gray-600">הכל נראה מצוין!</h3>
                                    <p>אין פריטים מתחת למינימום כרגע.</p>
                                </div>
                            ) : (
                                <div className="grid gap-3">
                                    {lowStockItems.map(item => {
                                        const stock = currentStocks[item.id] !== undefined ? currentStocks[item.id] : (item.current_stock || 0);

                                        const conversionFactor = (() => {
                                            const fromSettings = parseFloat(item?.settings?.conversion_factor);
                                            if (!isNaN(fromSettings) && fromSettings > 0) return fromSettings;
                                            const fromWeight = parseFloat(item?.weight_per_unit as any);
                                            if (!isNaN(fromWeight) && fromWeight > 0) return fromWeight;
                                            // Fallback for base units of grams and ml:
                                            const unit = (item?.base_unit || item?.unit || '').toLowerCase();
                                            if (unit.includes('גרם') || unit.includes('מ"ל') || unit === 'g' || unit === 'ml') {
                                                return 1000;
                                            }
                                            return 1;
                                        })();
                                        const displayUnit = item?.display_unit || item?.settings?.display_unit || 
                                            (((item?.base_unit || item?.unit || '').includes('גרם') || (item?.base_unit || item?.unit || '').includes('מ"ל')) ? 'יח\'' : null);
                                        const baseUnit = item?.base_unit || item?.unit || 'יח\'';
                                        const hasDisplayUnit = !!displayUnit && conversionFactor > 1;

                                        const unitStep = Number(item.inventory_count_step) || 1;

                                        // Calculate display units
                                        const rawDisplayUnits = hasDisplayUnit ? stock / conversionFactor : stock;
                                        const displayVal = Number(rawDisplayUnits.toFixed(4));

                                        const handleIncrementClick = () => {
                                            const nextDisplay = Math.ceil((rawDisplayUnits + 0.00001) / unitStep) * unitStep;
                                            const finalDisplay = (nextDisplay - rawDisplayUnits < 0.001) 
                                                ? nextDisplay + unitStep 
                                                : nextDisplay;
                                            const nextBase = hasDisplayUnit ? finalDisplay * conversionFactor : finalDisplay;
                                            onUpdateStock(item.id, nextBase);
                                        };

                                        const handleDecrementClick = () => {
                                            const prevDisplay = Math.floor((rawDisplayUnits - 0.00001) / unitStep) * unitStep;
                                            const finalDisplay = (rawDisplayUnits - prevDisplay < 0.001) 
                                                ? prevDisplay - unitStep 
                                                : prevDisplay;
                                            const finalDisplayClamped = Math.max(0, finalDisplay);
                                            const nextBase = hasDisplayUnit ? finalDisplayClamped * conversionFactor : finalDisplayClamped;
                                            onUpdateStock(item.id, nextBase);
                                        };

                                        return (
                                            <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                                                <div className="flex-1">
                                                    <h4 className="font-bold text-lg text-slate-800">{item.name}</h4>
                                                    <div className="flex items-center gap-4 mt-1 text-sm">
                                                        <span className="text-red-500 font-bold bg-red-50 px-2 py-0.5 rounded-md">
                                                            מינימום: {item.low_stock_threshold_units} {hasDisplayUnit ? displayUnit : baseUnit}
                                                        </span>
                                                        <span className="text-gray-400">
                                                            ספק: {item.supplier_name || 'כללי'}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Stock Adjuster */}
                                                <div className="flex items-center gap-3 bg-gray-50 p-2 rounded-xl border border-gray-200">
                                                    <span className="text-xs font-bold text-gray-400 ml-1">בפועל:</span>

                                                    <button
                                                        onClick={handleDecrementClick}
                                                        aria-label={`הפחת מלאי עבור ${item.name}`}
                                                        className="w-10 h-10 bg-white border border-gray-200 rounded-lg flex items-center justify-center hover:bg-red-50 hover:border-red-200 hover:text-red-500 active:scale-95 transition-all"
                                                    >
                                                        <Minus size={18} strokeWidth={3} />
                                                    </button>

                                                    <div className="w-24 text-center">
                                                        <span className="block text-2xl font-black text-slate-800 leading-none">
                                                            {displayVal % 1 === 0 ? displayVal : displayVal.toFixed(2)}
                                                        </span>
                                                        <span className="text-xs font-bold text-gray-400">
                                                            {hasDisplayUnit ? displayUnit : baseUnit}
                                                        </span>
                                                    </div>

                                                    <button
                                                        onClick={handleIncrementClick}
                                                        aria-label={`הוסף מלאי עבור ${item.name}`}
                                                        className="w-10 h-10 bg-white border border-gray-200 rounded-lg flex items-center justify-center hover:bg-green-50 hover:border-green-200 hover:text-green-600 active:scale-95 transition-all"
                                                    >
                                                        <Plus size={18} strokeWidth={3} />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Footer (Hide on success) */}
                        {!showSuccess && (
                            <div className="p-6 bg-white border-t border-gray-100 flex items-center justify-between shrink-0">
                                <div className="text-sm text-gray-500 font-medium">
                                    סה״כ {lowStockItems.length} פריטים בחוסר
                                </div>
                                <button
                                    onClick={handleSmsSend}
                                    disabled={lowStockItems.length === 0 || sending}
                                    className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-8 py-3 rounded-xl font-black text-lg shadow-lg shadow-slate-200 disabled:opacity-50 disabled:shadow-none transition-all active:scale-[0.98]"
                                >
                                    <MessageSquare size={20} />
                                    {sending ? 'שולח...' : `אשר ושלח ל${ownerName} (SMS)`}
                                </button>
                            </div>
                        )}
                    </motion.div>
                </>
            )
            }
        </AnimatePresence >
    );
};

export default LowStockReportModal;
