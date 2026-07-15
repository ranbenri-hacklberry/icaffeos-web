import { useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getBackendApiUrl } from '@/utils/apiUtils';

export const useCommunication = () => {
    const { currentUser } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const baseUrl = getBackendApiUrl();

    /**
     * Send SMS via Global SMS provider
     * @param {string} to - Phone number
     * @param {string} text - Message content
     */
    const sendSMS = useCallback(async (to, text) => {
        if (!currentUser?.business_id) throw new Error('No business context');
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`${baseUrl}/api/sms/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to,
                    text,
                    businessId: currentUser.business_id
                })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'SMS failed');
            return data;
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [currentUser?.business_id, baseUrl]);

    /**
     * Send WhatsApp Message via Local Baileys
     * @param {string} to - Phone number
     * @param {string} text - Message content
     * @param {string} [instanceName] - Optional instance name
     */
    const sendWhatsApp = useCallback(async (to, text, instanceName = undefined) => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`${baseUrl}/api/whatsapp/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to,
                    text,
                    instanceName: instanceName || `business_${currentUser?.business_id}`
                })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'WhatsApp failed');
            return data;
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [currentUser?.business_id, baseUrl]);

    return {
        sendSMS,
        sendWhatsApp,
        loading,
        error
    };
};
