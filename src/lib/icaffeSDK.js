import { resolveUrl } from '../utils/apiUtils';

const getBase = async () => `${await resolveUrl()}/api`;

/**
 * Auth utilities
 */
export const auth = {
    /**
     * Identify user via PIN or other means
     */
    async identify(employeeId) {
        // In a real scenario, this might fetch user details or resolve current session
        return { id: employeeId || 'rani-01', name: 'רני', role: 'Software Architect' };
    },

    /**
     * Logout and clock out employee
     */
    async logout(employeeId, location = 'Web Interface') {
        if (!employeeId) {
            throw new Error('employeeId required for logout');
        }

        try {
            const base = await getBase();
            const res = await fetch(`${base}/maya/clock-out`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ employeeId, location })
            });

            const data = await res.json();

            localStorage.removeItem('maya_session');
            localStorage.removeItem('maya_employee');
            sessionStorage.clear();

            return {
                success: true,
                durationMinutes: data.durationMinutes || 0
            };
        } catch (err) {
            console.error('Logout error:', err);
            throw err;
        }
    }
};

/**
 * Biometric utilities (Face Recognition)
 */
export const face = {
    /**
     * Verify face embedding against database
     */
    async verify(embedding, threshold = 0.55, businessId = '22222222-2222-2222-2222-222222222222') {
        const base = await getBase();
        const res = await fetch(`${base}/maya/verify-face`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ embedding, threshold, businessId })
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || 'Face verification failed');
        }

        return await res.json();
    },

    /**
     * Enroll face embedding for an employee
     */
    async enroll(employeeId, embedding, businessId = '22222222-2222-2222-2222-222222222222') {
        const base = await getBase();
        const res = await fetch(`${base}/maya/enroll-face`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeId, embedding, businessId })
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || 'Face enrollment failed');
        }

        return await res.json();
    }
};

/**
 * Chat & AI utilities
 */
export const ai = {
    async chat(messages, businessId, employeeId = null, provider = 'local') {
        const base = await getBase();
        const res = await fetch(`${base}/maya/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages, businessId, employeeId, provider })
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || 'Chat request failed');
        }

        return await res.json();
    },

    async consult(businessId) {
        // High-level AI consultation for the dashboard
        const base = await getBase();
        const res = await fetch(`${base}/maya/ask`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                question: "Give me a business status insight and one optimization tip based on current load.",
                businessId
            })
        });

        if (!res.ok) throw new Error('AI consultation failed');
        return await res.json();
    }
};

/**
 * Time clock utilities
 */
export const timeClock = {
    async clockIn(employeeId, assignedRole, location = 'Web Interface') {
        const base = await getBase();
        const res = await fetch(`${base}/maya/clock-in`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeId, assignedRole, location })
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || 'Clock-in failed');
        }

        return await res.json();
    },

    async clockOut(employeeId, location = 'Web Interface') {
        const base = await getBase();
        const res = await fetch(`${base}/maya/clock-out`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeId, location })
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || 'Clock-out failed');
        }

        return await res.json();
    },

    async checkStatus(employeeId) {
        const base = await getBase();
        const res = await fetch(`${base}/maya/check-clocked-in`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeId })
        });

        return await res.json();
    }
};

/**
 * DB utilities for raw data access
 */
export const db = {
    async query(table, params = {}) {
        // Map table names to API endpoints if needed, or generic proxy
        const base = await getBase();
        let endpoint = `${base}/data/${table}`;

        // Special case for orders (common in dashboard)
        if (table === 'orders') {
            endpoint = `${base}/maya/orders`; // Assuming we have such an endpoint
        }

        try {
            const res = await fetch(endpoint, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!res.ok) return { data: [], error: 'Failed to fetch' };

            const data = await res.json();
            return { data, error: null };
        } catch (err) {
            console.error(`DB Query Error (${table}):`, err);
            return { data: [], error: err.message };
        }
    }
};

/**
 * System & Device utilities
 */
export const system = {
    /**
     * Send hardware health snapshot to Supabase
     */
    async sendTelemetry(data) {
        const base = await getBase();
        const res = await fetch(`${base}/maya/telemetry`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || 'Telemetry sync failed');
        }

        return await res.json();
    }
};

// Default export as a unified SDK object
export const icaffe = {
    auth,
    face,
    ai,
    timeClock,
    db,
    system
};

export default icaffe;
