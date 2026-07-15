/**
 * Utility to get the Backend API URL (N150 Local Server or Cloud Proxy).
 */

import { getActiveEndpoint } from '../services/networkResolver';

export const CORTEX_CLOUD_URL = 'https://aimanageragentrani-625352399481.europe-west1.run.app';
export const BACKEND_CLOUD_URL = 'https://api.icaffeos.com'; // Fallback for general backend if needed

export const isElectron = () => window.navigator.userAgent.toLowerCase().includes('electron');

/**
 * Identifies if the current environment is local (Localhost/LAN).
 */
const checkIsLocalOrLan = () => {
    const { hostname } = window.location;
    return (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('100.') ||
        hostname.startsWith('172.') || window.location.hostname.endsWith('.ts.net')   ||
        import.meta.env.VITE_FORCE_LOCAL === 'true'
    );
};

/**
 * Resolves the Backend API URL (for Nodes/Data).
 */
export const resolveUrl = async () => {
    // 1. Environment Override
    const envUrl = import.meta.env.VITE_DATA_MANAGER_API_URL || import.meta.env.VITE_MANAGER_API_URL;
    if (envUrl) return envUrl.replace(/\/$/, '');

    if (isElectron()) {
        return 'http://' + window.location.hostname + ':8081';
    }

    return getActiveEndpoint();
};

/**
 * Legacy support for sync calls - used by Splash and other services
 */
export const getBackendApiUrl = () => {
    // Priority 1: Direct backend override
    const backendEnv = import.meta.env.VITE_DATA_MANAGER_API_URL || import.meta.env.VITE_MANAGER_API_URL;
    if (backendEnv) return backendEnv.replace(/\/$/, '');

    if (isElectron()) return 'http://' + window.location.hostname + ':8081';

    return getActiveEndpoint();
};

/**
 * Specifically resolves the Cortex (AI) API URL.
 */
export const getCortexApiUrl = () => {
    const cortexEnv = import.meta.env.VITE_CORTEX_API_URL;
    if (cortexEnv) return cortexEnv.replace(/\/$/, '');
    
    // If local, try port 8000 (Cortex default)
    if (checkIsLocalOrLan()) {
        return `http://${window.location.hostname}:8000`;
    }

    return CORTEX_CLOUD_URL;
};

/**
 * Format and return the full API URL for a cover image.
 */
export const getCoverUrl = (localPath, id) => {
    if (!localPath && !id) return null;
    if (localPath?.startsWith('http') || localPath?.startsWith('blob:')) return localPath;

    const MUSIC_API_URL = getBackendApiUrl();

    if (localPath?.startsWith('/api/music/cover') || localPath?.startsWith('/music/cover')) {
        // Normalize to ensure /api/music prefix
        const cleanPath = localPath.startsWith('/music') ? `/api${localPath}` : localPath;
        return `${MUSIC_API_URL}${cleanPath}`;
    }

    let url = `${MUSIC_API_URL}/api/music/cover?`;
    if (localPath) url += `path=${encodeURIComponent(localPath)}`;
    if (id) url += `${localPath ? '&' : ''}id=${id}`;
    return url;
};

