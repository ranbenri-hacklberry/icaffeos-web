import { createClient } from '@supabase/supabase-js';
import { getActiveEndpoint } from '../services/networkResolver';

// Configuration: Detect environment
const isElectron = typeof window !== 'undefined' && window.navigator.userAgent.toLowerCase().includes('electron');
const isLocalIp = typeof window !== 'undefined' && (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.startsWith('192.168.') ||
    window.location.hostname.startsWith('10.') ||
    window.location.hostname.startsWith('100.') ||
    window.location.hostname.startsWith('172.')
);

const isStrictlyLocal = isElectron || isLocalIp || import.meta.env?.VITE_FORCE_LOCAL === 'true';

// URLs
const getLocalUrl = () => {
    if (typeof window !== 'undefined') {
        const isCapacitor = window.location.hostname === 'localhost' && /android|iphone|ipad/i.test(navigator.userAgent);
        if (isCapacitor) {
            const activeEndpoint = getActiveEndpoint();
            const host = activeEndpoint.replace(/https?:\/\//, '').split(':')[0];
            return `http://${host}:54321`;
        }
        return `${window.location.protocol}//${window.location.hostname}:54321`;
    }
    if (import.meta.env?.VITE_LOCAL_SUPABASE_URL) {
        return import.meta.env.VITE_LOCAL_SUPABASE_URL;
    }
    return 'http://127.0.0.1:54321';
};

const localKey = import.meta.env?.VITE_LOCAL_SUPABASE_ANON_KEY || 'no-key';

let cachedClient = null;

const getClient = () => {
    if (!cachedClient) {
        const url = getLocalUrl();
        cachedClient = createClient(url, localKey, {
            auth: {
                persistSession: true,
                storageKey: 'supabase.auth.token',
                storage: typeof window !== 'undefined' ? window.localStorage : undefined,
                autoRefreshToken: true,
                detectSessionInUrl: true
            }
        });
    }
    return cachedClient;
};

// 🛡️ [STRICT LOCAL LOCK]
// We use a Proxy to ensure 'supabase' and 'cloudSupabase' are always available and resolve dynamically
export const cloudSupabase = new Proxy({}, {
    get: (target, prop) => {
        return getClient()[prop];
    }
});

export const supabase = new Proxy({}, {
    get: (target, prop) => {
        return getClient()[prop];
    }
});

export const isLocalInstance = () => isStrictlyLocal;
export const resolveSupabaseUrl = (url) => url;
export const initSupabase = async () => ({ isLocal: true, url: getLocalUrl() });

/**
 * Legacy support for components expecting getSupabase
 */
export const getSupabase = (user) => supabase;

export default supabase;