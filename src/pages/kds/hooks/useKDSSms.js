import { supabase } from '@/lib/supabase';
import { useState, useRef, useCallback } from 'react';
import { sendSms } from '@/services/smsService';

/**
 * 📱 useKDSSms Hook
 * Handles the logic for sending SMS notifications to customers from the KDS.
 * 
 * ADDED: fireAndForgetSms + getSmsStatus for non-blocking UI with visual feedback.
 */
export const useKDSSms = () => {
    // 📱 Helper: Check if phone number is valid for SMS
    const isValidPhone = (phone) => {
        const clean = String(phone || '').trim();
        if (!clean) return false;
        if (clean === '0500000000') return false;
        if (clean === 'null' || clean === 'undefined') return false;
        if (clean.startsWith('GUEST') || clean.startsWith('guest')) return false;
        if (clean.startsWith('00')) return false;
        // Must have at least 9 digits
        const digits = clean.replace(/\D/g, '');
        if (digits.length < 9) return false;
        return true;
    };

    const [smsToast, setSmsToast] = useState(null);
    const [isSendingSms, setIsSendingSms] = useState(false);

    // Track recently sent sms status with timestamps (orderId-phone -> timestamp)
    const sentLogRef = useRef(new Map());

    // 🎯 NEW: Per-order SMS status tracking (ref to avoid cascading re-renders)
    // Map<orderId, 'pending' | 'sent' | 'failed'>
    const smsPendingRef = useRef(new Map());
    const [smsUpdateTick, setSmsUpdateTick] = useState(0);

    // ===== ORIGINAL handleSendSms (kept for backward compat) =====
    const handleSendSms = async (phoneOrOrderId, customerName = null, customerPhone = null) => {
        // 🔀 AUTO-DETECT call pattern
        let cleanPhone;
        let displayName = customerName;
        let orderId = null;

        if (customerPhone !== null && customerPhone !== undefined) {
            orderId = phoneOrOrderId;
            cleanPhone = String(customerPhone).trim();
        } else {
            cleanPhone = String(phoneOrOrderId || '').trim();
        }

        // 🛡️ IDEMPOTENCY: Short-term lockout (2 minutes) per unique key
        const idempotencyKey = orderId ? `${orderId}-${cleanPhone}` : cleanPhone;
        const lastSent = sentLogRef.current.get(idempotencyKey);
        const now = Date.now();
        const LOCKOUT_MS = 30 * 1000; // 30 seconds

        if (lastSent && (now - lastSent) < LOCKOUT_MS) {
            const remaining = Math.ceil((LOCKOUT_MS - (now - lastSent)) / 1000);
            console.log(`🛡️ SMS recently sent to ${idempotencyKey}, locking for safety (${remaining}s remaining)`);
            return;
        }

        if (!isValidPhone(cleanPhone)) {
            console.log('🚫 Skipping SMS: No valid phone number provided:', cleanPhone);
            return;
        }

        if (cleanPhone.startsWith('00')) {
            console.log('🧪 Test phone detected, skipping SMS:', cleanPhone);
            setSmsToast({
                show: true,
                message: `שליחה ל${displayName || 'לקוח'} לא הצליחה - מספר בדיקה`,
                isError: true
            });
            setTimeout(() => setSmsToast(null), 3000);
            return;
        }

        if (!navigator.onLine) {
            console.log('📴 Offline: Skipping SMS and showing notification');
            setSmsToast({
                show: true,
                message: 'הודעת ה-SMS לא נשלחה (אין חיבור לאינטרנט)',
                isWarning: true
            });
            setTimeout(() => setSmsToast(null), 3000);
            return;
        }

        sentLogRef.current.set(idempotencyKey, Date.now());
        setIsSendingSms(true);

        const message = `היי ${displayName || 'אורח'}, ההזמנה שלכם מוכנה! 🎉, מוזמנים לעגלה לאסוף אותה`;

        try {
            const result = await sendSms(cleanPhone, message);

            try {
                await supabase.from('sms_queue').insert({
                    phone: cleanPhone,
                    message: message,
                    status: result.success ? 'success' : 'failed',
                    error: result.error || null,
                    sent_at: result.success ? new Date().toISOString() : null,
                    order_id: orderId || null
                });
            } catch (logErr) {
                console.error('❌ Failed to log SMS to DB:', logErr);
            }

            setIsSendingSms(false);

            if (result.success) {
                sentLogRef.current.set(idempotencyKey, Date.now());
                setSmsToast({
                    show: true,
                    message: `הודעה נשלחה ל-${displayName || 'לקוח'} בהצלחה! 🎉`,
                    isError: false
                });
                setTimeout(() => setSmsToast(null), 3000);
            } else {
                sentLogRef.current.delete(idempotencyKey);
                const errorMessage = result.isBlocked
                    ? result.error
                    : `שליחה ל${displayName || 'לקוח'} לא הצליחה - ${result.error || 'מספר שגוי'}`;

                setSmsToast({
                    show: true,
                    message: errorMessage,
                    isError: true
                });
                setTimeout(() => setSmsToast(null), 4000);
            }
        } catch (err) {
            console.error('❌ SMS error:', err);
            sentLogRef.current.delete(idempotencyKey);
            setIsSendingSms(false);
            setSmsToast({
                show: true,
                message: 'תקלת רשת בשליחת SMS',
                isError: true
            });
            setTimeout(() => setSmsToast(null), 3000);
        }
    };

    // ===== NEW: Fire-and-forget SMS with status tracking =====
    const fireAndForgetSms = useCallback((orderId, phone, customerName = null) => {
        if (!isValidPhone(phone)) {
            console.log('🚫 [fireAndForget] Skipping SMS: No valid phone number for order', orderId);
            return;
        }
        const cleanPhone = String(phone).trim();
        if (!navigator.onLine) {
            console.log('📴 Offline: Skipping SMS');
            setSmsToast({ show: true, message: 'SMS לא נשלח (אין חיבור)', isWarning: true });
            setTimeout(() => setSmsToast(null), 3000);
            return;
        }

        // Idempotency check
        const idempotencyKey = `${orderId}-${cleanPhone}`;
        const lastSent = sentLogRef.current.get(idempotencyKey);
        if (lastSent && (Date.now() - lastSent) < 30000) {
            console.log(`🛡️ SMS recently sent for ${idempotencyKey}, skipping`);
            return;
        }

        // Mark as PENDING immediately
        smsPendingRef.current.set(orderId, 'pending');
        setSmsUpdateTick(t => t + 1);
        sentLogRef.current.set(idempotencyKey, Date.now());

        const message = `היי ${customerName || 'אורח'}, ההזמנה שלכם מוכנה! 🎉, מוזמנים לעגלה לאסוף אותה`;

        // Fire-and-forget
        sendSms(cleanPhone, message)
            .then(result => {
                // Log to DB silently
                supabase.from('sms_queue').insert({
                    phone: cleanPhone, message, order_id: orderId || null,
                    status: result.success ? 'success' : 'failed',
                    error: result.error || null,
                    sent_at: result.success ? new Date().toISOString() : null
                }).catch(e => console.error('DB log fail:', e));

                // OPTIMISTIC UI: The user says messages are arriving fast. 
                // So if we got ANY result/response, we mark as sent.
                smsPendingRef.current.set(orderId, 'sent'); 
                setSmsUpdateTick(t => t + 1);
                
                setSmsToast({ show: true, message: `📱 הודעה נשלחה ל${customerName || 'לקוח'} ✓` });
                setTimeout(() => setSmsToast(null), 2000);
                
                // Clear the 'sent' tag after 30s so it doesn't stay forever
                setTimeout(() => { 
                    if (smsPendingRef.current.get(orderId) === 'sent') {
                        smsPendingRef.current.delete(orderId); 
                        setSmsUpdateTick(t => t + 1);
                    }
                }, 30000);
            })
            .catch(err => {
                console.error('❌ SMS network error:', err);
                smsPendingRef.current.delete(orderId);
                setSmsUpdateTick(t => t + 1);
            });
    }, []);

    const getSmsStatus = useCallback((orderId) => {
        return smsPendingRef.current.get(orderId) || null;
    }, [smsUpdateTick]);

    return {
        smsToast,
        setSmsToast,
        isSendingSms,
        handleSendSms,
        fireAndForgetSms,
        getSmsStatus
    };
};
