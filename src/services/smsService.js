import { resolveUrl } from '@/utils/apiUtils';
import { supabase } from '@/lib/supabase';

// 📝 Internal helper: log SMS attempt to local DB (fire-and-forget)
const _logSms = (phone, message, status, error = null) => {
    supabase.from('sms_queue').insert({
        phone,
        message,
        status,
        error: error ? String(error).slice(0, 255) : null,
        created_at: new Date().toISOString(),
        sent_at: status === 'success' ? new Date().toISOString() : null,
    }).then(({ error: dbErr }) => {
        if (dbErr) console.warn('⚠️ SMS log write failed:', dbErr.message);
    });
};

// SMS Service - Cloud Function Proxy (Production)
// Production endpoint for sending SMS via Google Cloud Function
// Production endpoint for sending SMS via Google Cloud Function
export const CLOUD_FUNCTION_URL = 'https://us-central1-repos-477613.cloudfunctions.net/sendSms';

// Use Cloud Function for all SMS sending (set to true for production)
export const USE_CLOUD_FUNCTION = true;

/**
 * Send SMS to a recipient with retry logic.
 * @param {string} phone - Phone number (e.g., "0501234567")
 * @param {string} message - Message content
 * @returns {Promise<{success: boolean, error?: string, data?: any}>}
 */
export const sendSms = async (phone, message) => {
    // 1. Validation
    const cleanPhone = phone?.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length !== 10 || !cleanPhone.startsWith('05')) {
        console.log('🚫 SMS skipped: Invalid or missing phone number', { phone, cleanPhone });
        return { success: true, skipped: true };
    }

    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
        attempt++;
        try {
            console.log(`📨 [SMS Attempt ${attempt}/${maxRetries}] Posting to Vite Proxy for ${phone}...`);
            
            // Use RELATIVE URL so it goes through the Vite proxy
            // /api/sms → proxied to https://api.globalsms.co.il/sms/
            let targetUrl = '/api/sms/sendSmsToRecipients';

            const response = await fetch(targetUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json; charset=utf-8'
                },
                signal: AbortSignal.timeout(5000), // 5s timeout
                body: JSON.stringify({
                    ApiKey: '5v$YW#4k2Dn@w96306$H#S7cMp@8t$6R',
                    txtOriginator: '0548317887',
                    destinations: cleanPhone,
                    txtSMSmessage: message,
                    dteToDeliver: '',
                    txtAddInf: ''
                })
            });

            if (!response.ok) {
                // If it's a server error (5xx), we might want to retry. 
                // If it's a client error (4xx), it's probably a permanent failure.
                if (response.status >= 500) {
                    throw new Error(`Gateway Server Error: ${response.status}`);
                } else {
                    const errorData = await response.json();
                    return { success: false, error: errorData.error || `Client Error: ${response.status}` };
                }
            }

            const data = await response.json();
            console.log(`✅ SMS Dispatched (Attempt ${attempt}):`, data);
            _logSms(cleanPhone, message, 'success');
            return { success: true, data };
            
        } catch (err) {
            console.error(`❌ SMS attempt ${attempt} failed:`, err.message);
            
            if (attempt < maxRetries) {
                const delay = attempt * 2000; // 2s, 4s... backoff
                console.log(`⏳ Waiting ${delay}ms before next retry...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                _logSms(cleanPhone, message, 'failed', err.message);
                return { success: false, error: `Failed after ${maxRetries} attempts: ${err.message}` };
            }
        }
    }
};


/**
 * Check the remaining SMS balance.
 * Uses local backend proxy if available.
 * @returns {Promise<number|null>} Balance amount or null if failed
 */
export const getSmsBalance = async () => {
    try {
        const baseUrl = await resolveUrl();
        const response = await fetch(`${baseUrl}/api/sms/balance`);

        if (response.ok) {
            const data = await response.json();
            if (data.success && typeof data.balance === 'number') {
                console.log('💳 SMS Balance:', data.balance);

                // Dispatch event for UI updates
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('sms-balance-updated', { detail: data.balance }));
                }

                return data.balance;
            }
        }
    } catch (err) {
        console.warn('⚠️ Failed to check SMS balance:', err);
    }
    return null;
};

// Deprecated internal helper - kept for reference if needed, but sendSms now handles logic directly
const sendSmsViaCloudFunction = async (phone, message) => {
    return sendSms(phone, message);
};

// ---------------------------------------------------------------------
// NOTE: The older direct‑API implementation (sendSmsDirectly) and related
// constants (API_KEY, API_URL, SENDER_NUMBER) have been removed to avoid
// exposing secrets in client‑side code. All SMS traffic should now go
// through the secure Cloud Function.
// ---------------------------------------------------------------------
