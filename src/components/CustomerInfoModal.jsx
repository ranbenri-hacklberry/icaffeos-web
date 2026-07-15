import React, { useState, useEffect, useRef } from 'react';
import { X, Phone, User, Check, Loader2, UserCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import NumericKeypad from '@/components/NumericKeypad';

/**
 * CustomerInfoModal - Unified modal for collecting/editing customer phone and name
 * Replaces full-page phone/name screens with a popup accessible from cart and KDS
 * 
 * @param {boolean} isOpen - Modal visibility
 * @param {function} onClose - Close callback
 * @param {'phone' | 'name' | 'phone-then-name'} mode - Initial entry mode
 * @param {object} currentCustomer - Existing customer data {phone, name, id}
 * @param {function} onCustomerUpdate - Callback with updated customer data
 * @param {string} orderId - Optional order ID for KDS flow (updates order directly)
 */
const CustomerInfoModal = ({
    isOpen,
    onClose,
    mode = 'phone',
    currentCustomer = null,
    onCustomerUpdate,
    orderId = null
}) => {
    const { isDarkMode } = useTheme();
    const { currentUser } = useAuth();
    const [step, setStep] = useState('phone'); // 'phone' | 'name' | 'lookup' | 'complete'
    const [phoneNumber, setPhoneNumber] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [lookupResult, setLookupResult] = useState(null);
    const nameInputRef = useRef(null);
    const [showSwitchConfirm, setShowSwitchConfirm] = useState(false);
    const [pendingCustomer, setPendingCustomer] = useState(null);

    // Initialize state when modal opens
    useEffect(() => {
        if (isOpen) {
            // Reset state
            setPhoneNumber(currentCustomer?.phone || '');

            // Clear name if it's generic/placeholder
            const currentName = currentCustomer?.name || '';
            const isPlaceholder = ['אורח', 'אורח אנונימי', 'הזמנה מהירה', 'אורח/ת'].includes(currentName);
            setCustomerName(isPlaceholder ? '' : currentName);

            setError('');
            setLookupResult(null);
            setIsLoading(false);

            // Set initial step based on mode
            if (mode === 'phone' || mode === 'phone-then-name') {
                setStep('phone');
            } else if (mode === 'name') {
                setStep('name');
                // Focus name input after a short delay
                setTimeout(() => nameInputRef.current?.focus(), 100);
            }
        }
    }, [isOpen, mode, currentCustomer]);

    if (!isOpen) return null;

    // Format phone number for display
    const formatPhoneDisplay = (phone) => {
        const digits = phone?.replace(/[^0-9]/g, '')?.split('') || [];
        if (digits.length > 3) digits.splice(3, 0, '-');
        if (digits.length > 7) digits.splice(7, 0, '-');
        return digits.join('');
    };

    // Handle phone keypad input
    const handleKeypadPress = (value) => {
        setError('');

        if (value === 'delete') {
            setPhoneNumber(prev => prev.slice(0, -1));
        } else if (value === '*') {
            return;
        } else if (phoneNumber.length < 10) {
            const newPhone = `${phoneNumber}${value}`;

            // Validation: Check if starts with 05
            if (newPhone.length >= 2 && !newPhone.startsWith('05')) {
                setError('מספר נייד חייב להתחיל ב-05');
            }

            setPhoneNumber(newPhone);
        }
    };

    // Lookup customer by phone
    const handlePhoneLookup = async () => {
        const cleanPhone = phoneNumber.replace(/\D/g, '');

        // Validation
        if (cleanPhone.length !== 10) {
            setError('אנא הכנס מספר נייד תקין בן 10 ספרות');
            return;
        }

        if (!cleanPhone.startsWith('05')) {
            setError('מספר נייד חייב להתחיל ב-05');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            let data = null;
            let lookupError = null;

            // OFFLINE FALLBACK: Check Dexie first if offline
            if (!navigator.onLine) {
                console.log('📴 Offline: Looking up customer in Dexie...');
                try {
                    const { db: dynamicDb } = await import('@/db/database');
                    const allCustomers = await dynamicDb.customers.toArray();
                    const search9 = cleanPhone.slice(-9);

                    console.log(`📴 Dexie Lookup: Searching for last 9 digits: ${search9}`);

                    const matchingCustomers = allCustomers.filter(c => {
                        const storedPhone = (c.phone_number || c.phone || '').toString().replace(/\D/g, '');
                        const stored9 = storedPhone.slice(-9);

                        const phoneMatch = stored9 === search9 && stored9.length >= 9;
                        const businessMatch = !currentUser?.business_id || c.business_id === currentUser.business_id;
                        return phoneMatch && businessMatch;
                    });

                    if (matchingCustomers.length > 0) {
                        const customer = matchingCustomers[0];
                        console.log(`✅ Found customer offline: ${customer.name} (ID: ${customer.id})`);
                        data = {
                            success: true,
                            isNewCustomer: false,
                            customer: {
                                id: customer.id,
                                name: customer.name,
                                loyalty_coffee_count: customer.loyalty_coffee_count || 0
                            }
                        };
                    } else {
                        console.log('❌ Customer not found in Dexie cache');
                        data = { success: true, isNewCustomer: true };
                    }
                } catch (e) {
                    console.warn('Dexie customer lookup failed:', e);
                    data = { success: true, isNewCustomer: true };
                }
            } else {
                // ONLINE: Use RPC
                const result = await supabase.rpc('lookup_customer', {
                    p_phone: cleanPhone,
                    p_business_id: currentUser?.business_id || null
                });

                data = result.data;
                lookupError = result.error;

                if (lookupError) {
                    console.error('❌ RPC Lookup Error:', lookupError);
                    throw lookupError;
                }
                console.log('📡 RPC Lookup result:', data);

                // FALLBACK: If RPC says "New Customer" (or returns nothing), check the `customers` table directly.
                // The RPC might rely on a JOIN with loyalty_cards which could be missing.
                if (!data || data.isNewCustomer) {
                    console.log('🔍 RPC indicated new customer, checking direct `customers` table fallback...');
                    const { data: directCustomer } = await supabase
                        .from('customers')
                        .select('id, name, phone, loyalty_coffee_count')
                        .eq('business_id', currentUser?.business_id)
                        .eq('phone', cleanPhone)
                        .maybeSingle();

                    if (directCustomer) {
                        console.log('✅ Found customer via direct lookup (RPC missed it):', directCustomer);
                        data = {
                            success: true,
                            isNewCustomer: false,
                            customer: {
                                id: directCustomer.id,
                                name: directCustomer.name,
                                loyalty_coffee_count: directCustomer.loyalty_coffee_count || 0
                            }
                        };
                    }
                }
            }

            setLookupResult(data);

            if (data?.success && !data?.isNewCustomer) {
                // Existing customer found
                const foundCustomer = {
                    id: data.customer.id,
                    phone: cleanPhone,
                    name: data.customer.name,
                    loyalty_coffee_count: data.customer.loyalty_coffee_count || 0
                };

                // ALWAYS show custom confirmation modal - "Existing customer found"
                setPendingCustomer(foundCustomer);
                setShowSwitchConfirm(true);
                setIsLoading(false);
                return;
            } else {
                // New customer - advance to name entry
                if (mode === 'phone-then-name' || mode === 'phone') {
                    setStep('name');
                    setTimeout(() => nameInputRef.current?.focus(), 100);
                } else {
                    const customer = {
                        id: currentCustomer?.id || null,
                        phone: cleanPhone,
                        name: currentCustomer?.name || 'אורח',
                        loyalty_coffee_count: 0
                    };
                    onCustomerUpdate?.(customer);
                    onClose();
                }
            }
        } catch (err) {
            console.error('⚠️ Phone lookup failure - falling back to new customer behavior:', err);

            // 🔥 FAIL-SAFE: If the database is busy, offline, or the RPC is broken, 
            // DO NOT block the user. Just proceed to name entry as a new customer.
            if (mode === 'phone-then-name' || mode === 'phone') {
                setStep('name');
                setTimeout(() => nameInputRef.current?.focus(), 100);
            } else {
                const fallbackCustomer = {
                    id: currentCustomer?.id || null,
                    phone: cleanPhone,
                    name: currentCustomer?.name || 'אורח',
                    loyalty_coffee_count: 0,
                    isNew: true
                };
                onCustomerUpdate?.(fallbackCustomer);
                onClose();
            }
        } finally {
            setIsLoading(false);
        }
    };

    // Handle customer switch confirmation
    const handleConfirmSwitch = async () => {
        if (!pendingCustomer) return;

        try {
            // If editing an order (KDS flow), update it
            if (orderId) {
                await updateOrderCustomer(orderId, pendingCustomer);
            }

            // Return customer data
            onCustomerUpdate?.(pendingCustomer);
            setShowSwitchConfirm(false);
            setPendingCustomer(null);
            onClose();
        } catch (err) {
            console.error('Error switching customer:', err);
            setError('שגיאה בהחלפת לקוח');
        }
    };

    const handleCancelSwitch = () => {
        setShowSwitchConfirm(false);
        setPendingCustomer(null);
        // Go to name entry for new customer with the entered phone
        if (mode === 'phone-then-name') {
            setStep('name');
            setTimeout(() => nameInputRef.current?.focus(), 100);
        }
    };

    // Handle name submission
    const handleNameSubmit = async () => {
        if (!customerName.trim()) {
            setError('אנא הכנס שם');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            const cleanPhone = phoneNumber.replace(/\D/g, '');
            let customerId = currentCustomer?.id;

            // FIX: If no phone and no ID, treat as transient guest (Name Only)
            // This allows adding a name to an order without creating a persistent customer record
            if (!cleanPhone && !customerId) {
                console.log('👤 Transient customer (Name only) - skipping DB creation');
                const transientCustomer = {
                    id: null,
                    phone: null,
                    name: customerName.trim(),
                    loyalty_coffee_count: 0
                };

                if (orderId) await updateOrderCustomer(orderId, transientCustomer);
                onCustomerUpdate?.(transientCustomer);
                onClose();
                setIsLoading(false);
                return;
            }

            // OFFLINE MODE: Save customer locally in Dexie
            if (!navigator.onLine) {
                console.log('📴 Offline: Creating/Updating customer locally in Dexie...');
                const { db: dynamicDb } = await import('@/db/database');

                // CRITICAL: Check if this phone ALREADY exists in Dexie to avoid duplicates
                if (cleanPhone && cleanPhone.length === 10) {
                    const allCustomers = await dynamicDb.customers.toArray();
                    const existing = allCustomers.find(c => {
                        const stored = (c.phone_number || c.phone || '').toString().replace(/\D/g, '');
                        return stored === cleanPhone && (!currentUser?.business_id || c.business_id === currentUser.business_id);
                    });

                    if (existing) {
                        console.log('♻️ Found existing customer in Dexie by phone, updating instead of creating duplicate');
                        customerId = existing.id;
                    }
                }

                // Generate a temporary local ID if not updating
                const finalId = customerId || `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

                const updatedCustomer = {
                    id: finalId,
                    name: customerName.trim(),
                    phone_number: cleanPhone || null,
                    phone: cleanPhone || null,
                    business_id: currentUser?.business_id,
                    updated_at: new Date().toISOString(),
                    pending_sync: true // Mark for sync
                };

                await dynamicDb.customers.put(updatedCustomer);
                console.log('✅ Customer saved locally:', updatedCustomer.name);

                // Queue for sync
                try {
                    const { queueAction } = await import('@/services/offlineQueue');
                    const cleanIdForQueue = orderId ? (orderId.toString().match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0] || orderId) : null;

                    await queueAction('UPDATE_CUSTOMER', {
                        orderId: cleanIdForQueue,
                        customerId: finalId,
                        customerName: updatedCustomer.name,
                        customerPhone: updatedCustomer.phone
                    });
                } catch (queueError) {
                    console.warn('Could not queue customer for sync:', queueError);
                }

                const resultCustomer = {
                    id: finalId,
                    phone: cleanPhone || null,
                    name: customerName.trim(),
                    loyalty_coffee_count: currentCustomer?.loyalty_coffee_count || 0
                };

                if (orderId) await updateOrderCustomer(orderId, resultCustomer);
                onCustomerUpdate?.(resultCustomer);
                onClose();
                return;
            }

            // ONLINE MODE: Use RPC (Passing p_id to ensure update instead of duplicate)
            const { data: customerData, error: rpcError } = await supabase.rpc('create_or_update_customer', {
                p_business_id: currentUser?.business_id,
                p_phone: cleanPhone || null,
                p_name: customerName.trim(),
                p_id: customerId || null
            });

            if (rpcError) throw rpcError;
            customerId = customerData;

            // OPTIMISTIC UPDATE: Close modal and update UI immediately
            const customer = {
                id: customerId,
                phone: cleanPhone || null,
                name: customerName.trim(),
                loyalty_coffee_count: 0
            };

            onCustomerUpdate?.(customer);
            onClose();

            // Background processing - Don't block the UI
            (async () => {
                try {
                    // Cache to Dexie for offline use
                    const { db } = await import('@/db/database');
                    await db.customers.put({
                        ...customer,
                        phone_number: cleanPhone || null,
                        business_id: currentUser?.business_id,
                        updated_at: new Date().toISOString()
                    });
                    console.log('💾 Customer cached to Dexie');

                    // If editing an order (KDS flow), update it
                    if (orderId) {
                        await updateOrderCustomer(orderId, customer);
                    }
                } catch (bgErr) {
                    console.warn('⚠️ Background customer update error (non-blocking):', bgErr);
                }
            })();
        } catch (err) {
            console.error('Name submission error - falling back to transient save:', err);

            // 🛡️ FAIL-SAFE: If the database is busy or the RPC is broken, 
            // DO NOT block the user. Just use the name locally so they can finish the order.
            const cleanPhone = phoneNumber.replace(/\D/g, '');
            const transientCustomer = {
                id: currentCustomer?.id || `temp-${Date.now()}`,
                phone: cleanPhone || null,
                name: customerName.trim(),
                loyalty_coffee_count: currentCustomer?.loyalty_coffee_count || 0,
                isTransient: true
            };

            // Attempt local cache update if possible
            try {
                const { db: dDb } = await import('@/db/database');
                await dDb.customers.put({
                    ...transientCustomer,
                    phone_number: cleanPhone || null,
                    business_id: currentUser?.business_id,
                    updated_at: new Date().toISOString()
                });
            } catch (e) { console.warn('Dexie transient cache failed:', e); }

            if (orderId) await updateOrderCustomer(orderId, transientCustomer);
            onCustomerUpdate?.(transientCustomer);
            onClose();
        } finally {
            setIsLoading(false);
        }
    };

    // Update order with customer info (KDS flow)
    const updateOrderCustomer = async (orderId, customer) => {
        if (!orderId) return;

        // CRITICAL: Clean the ID to be a valid UUID for the RPC
        const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
        const match = orderId.toString().match(uuidRegex);
        const cleanOrderId = match ? match[0] : orderId.toString();

        const updateData = {
            customer_id: customer.id,
            customer_phone: customer.phone,
            customer_name: customer.name
        };

        console.log('🔄 updateOrderCustomer starting...', { originalId: orderId, cleanId: cleanOrderId, updateData });

        try {
            // 1. Update local Dexie immediately regardless of online status
            // This ensures UI consistency across components even for staged orders
            try {
                const { db: dynamicDb } = await import('@/db/database');

                // Update ALL related orders (base + any stages)
                const count = await dynamicDb.orders
                    .where('id')
                    .startsWith(cleanOrderId)
                    .modify({
                        ...updateData,
                        updated_at: new Date().toISOString(),
                        pending_sync: true // CRITICAL: Mark as pending so KDS prefers this version
                    });

                console.log(`✅ Local Dexie updated: ${count} records modified`);
            } catch (e) {
                console.warn('Failed to update local cache:', e);
            }

            // 2. If OFFLINE: Queue for later sync
            if (!navigator.onLine) {
                console.log('📴 Offline: Queuing order update for sync...');
                try {
                    const { queueAction } = await import('@/services/offlineQueue');
                    await queueAction('UPDATE_CUSTOMER', {
                        orderId: cleanOrderId,
                        ...updateData
                    });
                } catch (queueErr) {
                    console.error('Failed to queue offline update:', queueErr);
                }
                return;
            }

            // 3. ONLINE: Update Supabase using RPC to bypass RLS
            // We use the cleaned UUID for the database update
            console.log('📡 Online: Updating order in Supabase via RPC...', cleanOrderId);

            // VALIDATE: customer_id must be a valid UUID, otherwise send null
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            const validCustomerId = (updateData.customer_id && uuidRegex.test(updateData.customer_id))
                ? updateData.customer_id
                : null;

            const { error: rpcError } = await supabase.from('orders').update({
                customer_id: validCustomerId,
                customer_phone: updateData.customer_phone,
                customer_name: updateData.customer_name
            }).eq('id', cleanOrderId);

            if (rpcError) {
                console.error('❌ RPC Order Update Error:', rpcError);
                // System will retry via offline queue if failed
                throw rpcError;
            }
            console.log('✅ Order updated in Supabase via RPC');

        } catch (err) {
            console.error('Failed to update order customer:', err);
        }
    };

    // Render phone entry step
    const renderPhoneStep = () => {
        const hasExistingPhone = currentCustomer?.phone && currentCustomer.phone.length >= 9;

        return (
            <>
                {/* Content - No header */}
                <div className="p-4 space-y-3">
                    {/* Existing Phone Display (if exists) */}
                    {hasExistingPhone && phoneNumber === currentCustomer.phone && (
                        <div className={`border rounded-xl p-3 flex items-center justify-between transition-colors ${isDarkMode ? 'bg-blue-900/20 border-blue-900/30' : 'bg-blue-50 border-blue-200'
                            }`}>
                            <div className="flex items-center gap-2">
                                <Phone size={18} className="text-blue-600" />
                                <span className={`font-bold ${isDarkMode ? 'text-blue-400' : 'text-blue-800'}`}>טלפון קיים:</span>
                                <span className={`font-mono font-black text-lg ${isDarkMode ? 'text-blue-300' : 'text-blue-900'}`} dir="ltr">
                                    {formatPhoneDisplay(currentCustomer.phone)}
                                </span>
                            </div>
                            <button
                                onClick={() => setPhoneNumber('')}
                                className={`p-1 rounded-lg transition-colors ${isDarkMode ? 'text-blue-400 hover:bg-blue-900/40' : 'text-blue-600 hover:bg-blue-100'
                                    }`}
                                title="ערוך טלפון"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>
                            </button>
                        </div>
                    )}

                    {/* Phone Input */}
                    {(!hasExistingPhone || phoneNumber !== currentCustomer.phone) && (
                        <>
                            <div
                                className={`w-full h-14 rounded-xl border-2 flex items-center justify-center transition-colors ${error
                                    ? (isDarkMode ? 'border-red-900 bg-red-900/20' : 'border-red-200 bg-red-50')
                                    : (isDarkMode ? 'border-slate-800 bg-slate-800/50' : 'border-gray-100 bg-gray-50')
                                    }`}
                            >
                                <div className={`text-2xl font-mono font-bold tracking-wider ${isDarkMode ? 'text-white' : 'text-gray-800'}`} dir="ltr">
                                    {formatPhoneDisplay(phoneNumber) || '___-___-____'}
                                </div>
                            </div>

                            {/* Error Message */}
                            {error && (
                                <div className="text-red-600 text-sm font-bold text-center flex items-center justify-center gap-1">
                                    <span>⚠️</span>
                                    {error}
                                </div>
                            )}

                            {/* Keypad */}
                            <div className={isDarkMode ? 'brightness-90 contrast-125' : ''}>
                                <NumericKeypad onKeyPress={handleKeypadPress} />
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className={`p-6 border-t flex gap-3 transition-colors duration-300 ${isDarkMode ? 'border-slate-800' : 'border-gray-200'}`}>
                    <button
                        onClick={onClose}
                        className={`flex-1 py-4 rounded-xl font-bold text-lg transition ${isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                            }`}
                    >
                        ביטול
                    </button>
                    <button
                        onClick={handlePhoneLookup}
                        disabled={phoneNumber.length !== 10 || isLoading}
                        className={`flex-1 py-4 rounded-xl font-bold text-lg transition flex items-center justify-center gap-2 ${phoneNumber.length === 10 && !isLoading
                            ? (isDarkMode ? 'bg-orange-600 text-white hover:bg-orange-500' : 'bg-orange-500 text-white hover:bg-orange-600')
                            : (isDarkMode ? 'bg-slate-800 text-slate-600' : 'bg-gray-100 text-gray-400') + ' cursor-not-allowed'
                            }`}
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                בודק...
                            </>
                        ) : (
                            'המשך'
                        )}
                    </button>
                </div>
            </>
        );
    };

    // Render name entry step
    const renderNameStep = () => {
        const hasExistingName = currentCustomer?.name && !['אורח', 'אורח אנונימי', 'הזמנה מהירה'].includes(currentCustomer.name);

        return (
            <>
                {/* Content - No header */}
                <div className="p-4 space-y-3">
                    {/* Existing Name Indicator */}
                    {hasExistingName && customerName === currentCustomer.name && (
                        <div className={`border rounded-xl p-3 flex items-center justify-between mb-2 transition-colors ${isDarkMode ? 'bg-purple-900/20 border-purple-900/30' : 'bg-purple-50 border-purple-200'
                            }`}>
                            <div className="flex items-center gap-2">
                                <User size={18} className="text-purple-600" />
                                <span className={`font-bold ${isDarkMode ? 'text-purple-400' : 'text-purple-800'}`}>שם קיים:</span>
                                <span className={`font-black text-lg ${isDarkMode ? 'text-purple-300' : 'text-purple-900'}`}>
                                    {currentCustomer.name}
                                </span>
                            </div>
                            <button
                                onClick={() => {
                                    setCustomerName('');
                                    setTimeout(() => nameInputRef.current?.focus(), 50);
                                }}
                                className={`p-1 rounded-lg transition-colors ${isDarkMode ? 'text-purple-400 hover:bg-purple-900/40' : 'text-purple-600 hover:bg-purple-100'
                                    }`}
                                title="ערוך שם"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>
                            </button>
                        </div>
                    )}

                    {/* Name Input */}
                    <input
                        ref={nameInputRef}
                        type="text"
                        value={customerName}
                        onChange={(e) => {
                            setCustomerName(e.target.value);
                            setError('');
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && customerName.trim()) {
                                handleNameSubmit();
                            }
                        }}
                        placeholder={hasExistingName ? 'לחץ לעריכת השם...' : 'הכנס שם...'}
                        className={`w-full h-14 rounded-xl border-2 px-4 text-xl font-bold text-center transition-colors outline-none ${error
                            ? (isDarkMode ? 'border-red-900 bg-red-900/20 text-red-400' : 'border-red-200 bg-red-50 text-red-900')
                            : (isDarkMode ? 'border-slate-800 bg-slate-800/50 text-white focus:border-purple-600' : 'border-gray-100 bg-gray-50 text-gray-800 focus:border-purple-400')
                            }`}
                        dir="rtl"
                    />

                    {/* Error Message */}
                    {error && (
                        <div className="text-red-600 text-sm font-bold text-center flex items-center justify-center gap-1">
                            <span>⚠️</span>
                            {error}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className={`p-6 border-t flex gap-3 transition-colors duration-300 ${isDarkMode ? 'border-slate-800' : 'border-gray-200'}`}>
                    <button
                        onClick={onClose}
                        className={`flex-1 py-4 rounded-xl font-bold text-lg transition ${isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                            }`}
                    >
                        ביטול
                    </button>
                    <button
                        onClick={handleNameSubmit}
                        disabled={!customerName.trim() || isLoading}
                        className={`flex-1 py-4 rounded-xl font-bold text-lg transition flex items-center justify-center gap-2 ${customerName.trim() && !isLoading
                            ? (isDarkMode ? 'bg-purple-600 text-white hover:bg-purple-500' : 'bg-purple-500 text-white hover:bg-purple-600')
                            : (isDarkMode ? 'bg-slate-800 text-slate-600' : 'bg-gray-100 text-gray-400') + ' cursor-not-allowed'
                            }`}
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                שומר...
                            </>
                        ) : (
                            <>
                                <Check className="w-5 h-5" />
                                אישור
                            </>
                        )}
                    </button>
                </div>
            </>
        );
    };

    return (
        <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-heebo"
            onClick={onClose}
            dir="rtl"
        >
            <div
                className={`rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200 transition-colors duration-300 ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'
                    }`}
                onClick={(e) => e.stopPropagation()}
            >
                {step === 'phone' && renderPhoneStep()}
                {step === 'name' && renderNameStep()}
            </div>

            {/* Customer Switch Confirmation Modal */}
            {showSwitchConfirm && pendingCustomer && (
                <div
                    className="absolute inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={handleCancelSwitch}
                >
                    <div
                        className={`rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200 transition-colors duration-300 ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'
                            }`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className={`p-6 border-b text-center transition-colors duration-300 ${isDarkMode ? 'border-slate-800' : 'border-gray-200'}`}>
                            <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-3">
                                <UserCheck size={32} className="text-blue-600" />
                            </div>
                            <h2 className={`text-2xl font-black ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>לקוח קיים נמצא</h2>
                            <p className={`font-medium mt-2 ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                                הטלפון {pendingCustomer.phone} שייך ל-{pendingCustomer.name}
                            </p>
                        </div>

                        {/* Content */}
                        <div className="p-6">
                            <p className="text-center text-gray-600 font-medium">
                                להשתמש בפרטי לקוח זה עבור ההזמנה?
                            </p>
                        </div>

                        {/* Footer */}
                        <div className={`p-6 border-t text-center transition-colors duration-300 ${isDarkMode ? 'border-slate-800' : 'border-gray-200'} flex gap-3`}>
                            <button
                                onClick={handleCancelSwitch}
                                className={`flex-1 py-4 rounded-xl font-bold text-lg transition ${isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                                    }`}
                            >
                                לקוח חדש
                            </button>
                            <button
                                onClick={handleConfirmSwitch}
                                className="flex-1 py-4 bg-blue-500 text-white rounded-xl font-bold text-lg hover:bg-blue-600 transition"
                            >
                                ✅ כן, זהו הלקוח
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomerInfoModal;
