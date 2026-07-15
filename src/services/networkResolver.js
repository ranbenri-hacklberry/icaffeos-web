import axios from 'axios';

let activeConfig = null;
let activeEndpoint = null;

export async function initActiveEndpoint() {
    const cachedConfig = localStorage.getItem('icaffe_server_config');
    if (!cachedConfig) {
        // Fallback for development / unprovisioned devices
        activeEndpoint = import.meta.env.PROD ? 'https://api.icaffeos.com' : 'http://localhost:8081';
        return activeEndpoint;
    }

    try {
        const config = JSON.parse(cachedConfig);
        activeConfig = config;
        
        // Trust the local_url exactly as provided in the JSON payload
        await axios.get(`${config.local_url}/api/system/health`, { timeout: 250 });
        console.log("⚡ Connected directly to store Wi-Fi network");
        activeEndpoint = config.local_url;
    } catch (error) {
        console.log("🌐 Local network unreachable, routing via Tailscale/Remote Tunnel");
        if (activeConfig && activeConfig.remote_url) {
            activeEndpoint = activeConfig.remote_url;
        } else {
            activeEndpoint = import.meta.env.PROD ? 'https://api.icaffeos.com' : 'http://localhost:8081';
        }
    }
    return activeEndpoint;
}

export function getActiveEndpoint() {
    return activeEndpoint || (import.meta.env.PROD ? 'https://api.icaffeos.com' : 'http://localhost:8081');
}

export function isUsingRemoteEndpoint() {
    if (!activeConfig || !activeEndpoint) return false;
    const localHost = activeConfig.local_url.replace(/https?:\/\//, '').split(':')[0];
    return !activeEndpoint.includes(localHost);
}

export function getActiveConfig() {
    return activeConfig;
}
