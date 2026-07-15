/**
 * DeliveryAddressModal
 * Compact modal for delivery address with toggle notes
 * 
 * MAYA REWRITE V1.0
 * - Fixed Customer Lookup Logic (uses maybeSingle to prevent 406 errors)
 * - Strict State Clearing (ensures new customers start with empty fields)
 * - Cleaned up nested try-catch blocks
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { X, Truck, MapPin, Phone, User, Check, Home, Dog, Users, Building2, Loader2 } from 'lucide-react';
import { getAddressSuggestions, DEFAULT_CITY } from '@/data/israelAddresses';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/context/ThemeContext';

// Delivery note options (like payment method buttons)
const DELIVERY_NOTES_OPTIONS = [
    { id: 'door', label: 'להניח ליד הדלת', icon: Home },
    { id: 'dog', label: 'כלב נובח לא נושך', icon: Dog },
    { id: 'neighbor', label: 'להשאיר אצל השכן', icon: Users },
    { id: 'elevator', label: 'יש מעלית', icon: Building2 }
];

const DeliveryAddressModal = ({
    isOpen,
    onClose,
    onConfirm,
    initialData = {},
    deliveryFee = 20 // Default, will be overridden from Supabase
}) => {
    const { isDarkMode } = useTheme();
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [deliveryAddress, setDeliveryAddress] = useState('');
    const [selectedNotes, setSelectedNotes] = useState([]); // Array of selected note IDs
    const [step, setStep] = useState('address');
    const [isLookingUp, setIsLookingUp] = useState(false);
    const [foundCustomer, setFoundCustomer] = useState(null);
    const [suggestions, setSuggestions] = useState([]);
    const [actualDeliveryFee, setActualDeliveryFee] = useState(deliveryFee);

    const inputRef = useRef(null);
    const addressInputRef = useRef(null);

    // Customer lookup by phone
    // FIXED: Uses maybeSingle() for safe existence check
    // Customer lookup by phone
    // FIXED: Uses maybeSingle() for safe existence check
    const lookupCustomer = useCallback(async (phone) => {
        if (!phone || phone.length < 9) return;

        setIsLookingUp(true);
        console.log('🔍 Looking up customer by phone:', phone);

        try {
            // 🛡️ SECURITY FIX: Use specialized RPC to bypass RLS and avoid 406/403 errors
            // This ensures we can find existing customers even if the current user has restricted view
            const { data, error } = await supabase.rpc('lookup_delivery_customer', {
                p_phone: phone,
                p_business_id: initialData.businessId
            });

            if (error) {
                // If the RPC fails, fall back to "not found" behavior instead of crashing
                console.warn('❌ RPC Lookup failed:', error);
                setFoundCustomer(null);
                setCustomerName('');
                setDeliveryAddress('');
                return;
            }

            // RPC returns TABLE, so data is an array. We take the first match.
            const customer = (data && data.length > 0) ? data[0] : null;

            if (customer) {
                console.log('✅ Customer found:', customer.name);
                // Ensure consistent phone field naming
                if (customer && !customer.phone) customer.phone = customer.phone_number;
                setFoundCustomer(customer);
                // Pre-fill fields
                setCustomerName(customer.name || '');
                setDeliveryAddress(customer.delivery_address || '');
            } else {
                console.log('🆕 New Customer (Phone not in DB)');
                setFoundCustomer(null);
                // CRITICAL: Explicitly clear fields for new customers
                setCustomerName('');
                setDeliveryAddress('');
            }
        } catch (err) {
            console.error('⚠️ Lookup unexpected error:', err);
            setFoundCustomer(null);
            setCustomerName('');
            setDeliveryAddress('');
        } finally {
            setIsLookingUp(false);
        }
    }, []);

    // Fetch delivery settings
    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const bid = initialData.businessId;
                if (!bid) return;

                const { data, error } = await supabase
                    .from('delivery_settings')
                    .select('fixed_fee')
                    .eq('business_id', bid)
                    .maybeSingle();

                if (error) {
                    console.warn('⚠️ No delivery settings found (or RLS blocked), using defaults.');
                }

                if (data?.fixed_fee) {
                    setActualDeliveryFee(data.fixed_fee);
                }
            } catch (err) {
                console.error('Failed to fetch delivery settings:', err);
            }
        };

        if (isOpen) fetchSettings();
    }, [isOpen, initialData.businessId]);

    // Initialize Modal State - ONLY ONCE when opened
    const hasInitialized = useRef(false);

    useEffect(() => {
        if (isOpen && !hasInitialized.current) {
            console.log('🎬 Initializing Modal Data:', initialData);
            setCustomerName(initialData.name || '');
            setCustomerPhone(initialData.phone || '');
            setDeliveryAddress(initialData.address || '');
            setSelectedNotes([]);
            setFoundCustomer(initialData.customerId ? { id: initialData.customerId, name: initialData.name } : null);

            // Determine starting step
            if (!initialData.phone) {
                setStep('phone');
            } else if (!initialData.name) {
                if (initialData.phone.length >= 9) lookupCustomer(initialData.phone);
                setStep('name');
            } else {
                setStep('address');
            }
            hasInitialized.current = true;
        } else if (!isOpen) {
            hasInitialized.current = false;
        }
    }, [isOpen, initialData, lookupCustomer]);

    // Proactive auto-lookup as user types
    useEffect(() => {
        if (step === 'phone' && customerPhone.length >= 10 && !isLookingUp && !foundCustomer) {
            lookupCustomer(customerPhone);
        }
    }, [customerPhone, step, isLookingUp, foundCustomer, lookupCustomer]);

    // Auto-Focus Input Fields
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => {
                if (step === 'address' && addressInputRef.current) {
                    addressInputRef.current.focus();
                } else if (inputRef.current) {
                    inputRef.current.focus();
                }
            }, 100);
        }
    }, [isOpen, step]);

    const toggleNote = (noteId) => {
        setSelectedNotes(prev =>
            prev.includes(noteId)
                ? prev.filter(id => id !== noteId)
                : [...prev, noteId]
        );
    };

    const handleNext = async () => {
        if (step === 'phone') {
            if (customerPhone.length >= 9) {
                await lookupCustomer(customerPhone);
                // If found, it will auto-fill name. If not, name is cleared.
                // Move to name step regardless (to confirm or enter)
                // Exception: If found and name exists, maybe skip to address? 
                // Let's stick to flow: Phone -> Name (verify/enter) -> Address

                // If name was found by lookup, we can potentially skip name step?
                // User requirement implies smooth flow. Let's go to name step so they can verify/edit.
                // But wait, if name is pre-filled, maybe jump to address?
                // Let's follow standard logic:

                // If lookup found a name, proceed to address directly (Common UX)? 
                // OR let user confirm name? 
                // Code Logic: 
                // If name is empty (new customer), go to Name step.
                // If name is filled (existing), go to Address step.

                setStep((prevName) => {
                    // We need to check the CURRENT state of customerName here, but state update from lookup might act async.
                    // However, lookupCustomer calls await, so state updates "should" be queued. 
                    // Safest is to check the result inside lookupCustomer or just go to Name step if name is empty.

                    // Better approach: Since we await lookupCustomer, check state after? 
                    // React state updates might not apply immediately in this closure. 
                    // Simple logic: Go to name. If name is there, they can click next instantly.
                    return 'name';
                });

                // Check if name is populated? Hard due to closure.
                // Let's just go to 'name'. If pre-filled, user hits Enter.
                setStep('name');
            }
        } else if (step === 'name') {
            if (customerName.trim()) {
                setStep('address');
            }
        } else if (step === 'address') {
            if (deliveryAddress.trim()) {
                handleConfirm();
            }
        }
    };

    const handleConfirm = () => {
        const notesText = selectedNotes
            .map(id => DELIVERY_NOTES_OPTIONS.find(n => n.id === id)?.label)
            .filter(Boolean)
            .join(', ');

        onConfirm({
            customerName: customerName || initialData.name,
            customerPhone: customerPhone || initialData.phone,
            customerId: foundCustomer?.id || initialData.customerId,
            deliveryAddress,
            deliveryNotes: notesText,
            selectedNotes,
            orderType: 'delivery',
            deliveryFee: actualDeliveryFee
        });
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();

            // Special handling to skip validation/steps if needed
            if (step === 'phone' && customerPhone.length >= 9) {
                handleNext();
            } else if (step === 'name' && customerName.trim()) {
                handleNext();
            } else if (step === 'address' && deliveryAddress.trim()) {
                handleNext();
            }
        }
    };

    const canProceed = useMemo(() => {
        if (step === 'phone') return customerPhone.length >= 9;
        if (step === 'name') return customerName.trim().length > 0;
        if (step === 'address') return deliveryAddress.trim().length > 0;
        return false;
    }, [step, customerPhone, customerName, deliveryAddress]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            dir="rtl"
            onClick={onClose}
        >
            {/* Modal - Fixed width */}
            <div
                className={`relative w-[380px] flex flex-col rounded-2xl shadow-2xl overflow-hidden transition-colors duration-300 ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-[#FAFAFA]'}`}
                onClick={e => e.stopPropagation()}
            >
                {/* Header - Compact */}
                <div className={`${isDarkMode ? 'bg-purple-800' : 'bg-purple-600'} px-4 py-3 flex items-center justify-between transition-colors`}>
                    <div className="flex items-center gap-3">
                        <Truck size={20} className="text-white" />
                        <div>
                            <h2 className="text-base font-bold text-white">משלוח</h2>
                            <p className="text-xs text-purple-200">
                                {step === 'phone' ? 'טלפון' : step === 'name' ? 'שם' : 'כתובת'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-lg">
                        <X size={18} className="text-white" />
                    </button>
                </div>

                {/* Content - Compact */}
                <div className="p-4 space-y-3">

                    {/* Phone Step */}
                    {step === 'phone' && (
                        <div className="space-y-2">
                            <label className={`text-sm font-bold flex items-center gap-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                                <Phone size={14} className="text-purple-500" />
                                מספר טלפון
                                {isLookingUp && <Loader2 size={14} className="animate-spin text-purple-500" />}
                            </label>
                            <input
                                ref={inputRef}
                                type="tel"
                                value={customerPhone}
                                onChange={(e) => setCustomerPhone(e.target.value.replace(/[^0-9]/g, ''))}
                                onKeyDown={handleKeyDown}
                                placeholder="050-0000000"
                                className={`w-full px-3 py-3 text-lg font-bold text-center border-2 rounded-xl focus:border-purple-500 outline-none transition-colors ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-600' : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'
                                    }`}
                                dir="ltr"
                                autoFocus
                            />
                            {foundCustomer && (
                                <div className={`border rounded-lg p-2 flex items-center gap-2 ${isDarkMode ? 'bg-green-900/20 border-green-900/30' : 'bg-green-50 border-green-200'}`}>
                                    <Check size={16} className="text-green-600" />
                                    <span className={`text-sm font-bold ${isDarkMode ? 'text-green-400' : 'text-green-700'}`}>לקוח קיים: {foundCustomer.name}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Name Step */}
                    {step === 'name' && (
                        <div className="space-y-2">
                            <label className={`text-sm font-bold flex items-center gap-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                                <User size={14} className="text-purple-500" />
                                שם הלקוח
                            </label>
                            <input
                                ref={inputRef}
                                type="text"
                                value={customerName}
                                onChange={(e) => setCustomerName(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="שם מלא"
                                className={`w-full px-3 py-3 text-lg font-bold border-2 rounded-xl focus:border-purple-500 outline-none transition-colors ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-600' : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'
                                    }`}
                                autoFocus
                            />
                        </div>
                    )}

                    {/* Address Step */}
                    {step === 'address' && (
                        <>
                            {/* Customer summary */}
                            {(customerName || customerPhone) && (
                                <div className={`px-3 py-2 rounded-lg flex items-center gap-2 text-sm ${isDarkMode ? 'bg-purple-900/30' : 'bg-purple-50'}`}>
                                    <User size={14} className="text-purple-600" />
                                    <span className={`font-bold ${isDarkMode ? 'text-purple-400' : 'text-purple-900'}`}>{customerName || initialData.name}</span>
                                    <span className="text-purple-500 font-mono text-xs" dir="ltr">{customerPhone || initialData.phone}</span>
                                </div>
                            )}

                            {/* Address Input */}
                            <div className="space-y-2">
                                <label className={`text-sm font-bold flex items-center gap-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                                    <MapPin size={14} className="text-purple-500" />
                                    כתובת
                                </label>
                                <input
                                    ref={addressInputRef}
                                    type="text"
                                    value={deliveryAddress}
                                    onChange={(e) => {
                                        setDeliveryAddress(e.target.value);
                                        // Get suggestions
                                        const suggestions = getAddressSuggestions(e.target.value);
                                        setSuggestions(suggestions.slice(0, 4));
                                    }}
                                    onKeyDown={handleKeyDown}
                                    placeholder={`רחוב ומספר, ${DEFAULT_CITY}`}
                                    className={`w-full px-3 py-3 text-base font-bold border-2 rounded-xl focus:border-purple-500 outline-none transition-colors ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-600' : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'
                                        }`}
                                    autoFocus
                                />
                                {/* Quick Street Suggestions - Compact */}
                                {suggestions.length > 0 && deliveryAddress.length < 15 && (
                                    <div className="flex flex-wrap gap-1">
                                        {suggestions.map((s, i) => (
                                            <button
                                                key={i}
                                                type="button"
                                                onClick={() => {
                                                    setDeliveryAddress(s);
                                                    setSuggestions([]);
                                                }}
                                                className={`px-2 py-1 text-xs rounded-lg transition-colors ${isDarkMode ? 'bg-slate-800 hover:bg-purple-900 text-slate-400 hover:text-white' : 'bg-slate-100 hover:bg-purple-100 text-slate-600'
                                                    }`}
                                            >
                                                {s.replace(`, ${DEFAULT_CITY}`, '')}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Delivery Notes - Toggle Buttons (like payment methods) */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500">הערות למשלוח</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {DELIVERY_NOTES_OPTIONS.map(note => {
                                        const Icon = note.icon;
                                        const isSelected = selectedNotes.includes(note.id);
                                        return (
                                            <button
                                                key={note.id}
                                                onClick={() => toggleNote(note.id)}
                                                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${isSelected
                                                    ? 'bg-purple-600 text-white shadow-md'
                                                    : (isDarkMode ? 'bg-slate-800 border border-slate-700 text-slate-400 hover:bg-slate-700' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50')
                                                    }`}
                                            >
                                                <Icon size={16} />
                                                <span className="text-xs leading-tight">{note.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Delivery Fee Display */}
                            <div className={`px-3 py-2 rounded-lg flex items-center justify-between transition-colors ${isDarkMode ? 'bg-purple-900/20' : 'bg-purple-50'}`}>
                                <span className={`text-sm font-bold ${isDarkMode ? 'text-purple-400' : 'text-purple-700'}`}>דמי משלוח</span>
                                <span className={`text-lg font-black ${isDarkMode ? 'text-purple-300' : 'text-purple-900'}`}>₪{actualDeliveryFee}</span>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer - Compact */}
                <div className={`p-3 border-t flex gap-2 transition-colors ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                    {step !== 'phone' && step !== 'address' && (
                        <button
                            onClick={() => setStep(step === 'name' ? 'phone' : 'name')}
                            className={`px-4 py-3 font-bold rounded-xl transition-colors ${isDarkMode ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-600'
                                }`}
                        >
                            חזרה
                        </button>
                    )}

                    <button
                        onClick={handleNext}
                        disabled={!canProceed}
                        className={`flex-1 py-3 font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 ${canProceed
                            ? 'bg-purple-600 hover:bg-purple-700 text-white'
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            }`}
                    >
                        {step === 'address' ? (
                            <>
                                <Truck size={18} />
                                <span>אישור משלוח • ₪{actualDeliveryFee}</span>
                            </>
                        ) : (
                            <span>המשך</span>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DeliveryAddressModal;
