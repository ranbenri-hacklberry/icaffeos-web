import { isUsingRemoteEndpoint, getActiveConfig } from '../services/networkResolver';
import { getBackendApiUrl } from './apiUtils';

export function setupApiInterceptor() {
    if (typeof window === 'undefined') return;

    // Prevent double registration
    if (window.__api_interceptor_installed) return;
    window.__api_interceptor_installed = true;

    const originalFetch = window.fetch;

    window.fetch = async function (resource, options = {}) {
        let url = '';
        if (typeof resource === 'string') {
            url = resource;
        } else if (resource && resource.url) {
            url = resource.url;
        }

        const isLocalhostRequest = url.startsWith('http://localhost:8081');
        const isRelativeRequest = url.startsWith('/') && (
            url.startsWith('/api/') || 
            url.startsWith('/edge-node/') || 
            url.startsWith('/maya/') || 
            url.startsWith('/item/') || 
            url.startsWith('/health/') || 
            url.startsWith('/music/')
        );

        if (isLocalhostRequest || isRelativeRequest) {
            const baseUrl = getBackendApiUrl();
            let cleanPath = url;
            if (isLocalhostRequest) {
                cleanPath = url.replace('http://localhost:8081', '');
            }
            const newUrl = `${baseUrl}${cleanPath}`;
            
            if (typeof resource === 'string') {
                resource = newUrl;
            } else if (resource && resource.url) {
                resource = new Request(newUrl, resource);
            }
            url = newUrl;
        }

        // Only intercept requests to our backend (exclude external domains)
        const isBackendRequest = url.includes('/api/') || url.includes('/edge-node/') || url.includes('/maya/');

        if (isBackendRequest) {
            const isRemote = isUsingRemoteEndpoint();
            if (isRemote) {
                const config = getActiveConfig();
                const token = config?.device_trusted_token || localStorage.getItem('device_trusted_token');

                if (!token) {
                    console.warn('🔒 Remote connection requires device_trusted_token, but it is missing!');
                    
                    // Dispatch custom event to let React UI prompt for 2FA/Authentication
                    window.dispatchEvent(new CustomEvent('REQUIRE_DEVICE_AUTH', {
                        detail: { url }
                    }));
                    
                    // Return a mock HTTP 401 response so the app handles it gracefully
                    return new Response(JSON.stringify({ error: 'Device authentication required' }), {
                        status: 401,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }

                // Inject token header robustly
                if (!options.headers) {
                    options.headers = {};
                }

                if (options.headers instanceof Headers) {
                    options.headers.set('X-Device-Trusted-Token', token);
                } else if (Array.isArray(options.headers)) {
                    options.headers.push(['X-Device-Trusted-Token', token]);
                } else {
                    options.headers = {
                        ...options.headers,
                        'X-Device-Trusted-Token': token
                    };
                }
            }
        }

        return originalFetch(resource, options);
    };

    console.log('🛡️ Global API Fetch Interceptor installed successfully');
}
