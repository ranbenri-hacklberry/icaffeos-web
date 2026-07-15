/**
 * Network Detection Utilities
 * זיהוי אם הגישה היא מרשת מקומית או מרחוק
 */

/**
 * בדיקה אם הגישה היא מרשת מקומית
 * מזהה IP addresses ברשת פרטית: 192.168.x.x, 10.x.x.x, 172.16-31.x.x, localhost
 */
export const isLocalNetworkAccess = (): boolean => {
  // אם אנחנו ב-Electron או ב-file protocol - תמיד נחשב כרשת מקומית
  const isElectron = window.navigator.userAgent.toLowerCase().includes('electron') ||
    !!((window as any).process && (window as any).process.type);
  const isFileProtocol = window.location.protocol === 'file:';

  if (isElectron || isFileProtocol) {
    return true;
  }

  // אם אנחנו ב-development mode - תמיד נחשב כרשת מקומית
  if (import.meta.env.DEV) {
    return true;
  }

  const hostname = window.location.hostname;

  // Localhost variations
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
    return true;
  }

  // Private IP ranges (RFC 1918)
  if (
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.') ||
    hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./)
  ) {
    return true;
  }

  // .local domains (mDNS)
  if (hostname.endsWith('.local')) {
    return true;
  }

  return false;
};

/**
 * קבלת סוג הגישה כטקסט (למטרות debug)
 */
export const getAccessType = (): 'local' | 'remote' => {
  return isLocalNetworkAccess() ? 'local' : 'remote';
};

/**
 * קבלת הודעת debug על סוג הגישה
 */
export const getAccessDebugInfo = (): string => {
  const hostname = window.location.hostname;
  const accessType = getAccessType();
  const isDev = import.meta.env.DEV;

  return `Access: ${accessType} | Hostname: ${hostname} | Dev Mode: ${isDev}`;
};
