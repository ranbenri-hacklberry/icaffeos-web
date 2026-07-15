import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

/**
 * @typedef {'online' | 'offline' | 'local-only' | 'cloud-only' | 'checking'} ConnectionStatus
 * @typedef {{ status: ConnectionStatus, localAvailable: boolean, cloudAvailable: boolean, lastSync: Date|null, lastLocalAvailable: Date|null }} ConnectionState
 */

const ConnectionContext = createContext(null);

// Local Supabase URL (Docker)
const LOCAL_SUPABASE_URL = import.meta.env.VITE_LOCAL_SUPABASE_URL || 'http://127.0.0.1:54321';

export const ConnectionProvider = ({ children }) => {
    const [state, setState] = useState({
        status: 'checking',
        localAvailable: false,
        cloudAvailable: false,
        lastSync: null,
        lastLocalAvailable: null,
        lastCloudAvailable: null
    });
    const [showOfflinePopup, setShowOfflinePopup] = useState(false);
    const [showOnlinePopup, setShowOnlinePopup] = useState(false);
    const [lostType, setLostType] = useState(null); // 'local', 'cloud', or 'all'
    const failureCount = useRef(0);

    const checkConnectivity = useCallback(async () => {
        let localOk = false;
        let cloudOk = false;

        // FAST PATH: If browser says offline, don't even try network calls
        if (!navigator.onLine) {
            failureCount.current++;
            if (failureCount.current >= 3) {
                if (state.status !== 'offline') {
                    setLostType('all');
                    setShowOfflinePopup(true);
                }
                setState(prev => ({
                    ...prev,
                    status: 'offline',
                    cloudAvailable: false,
                    localAvailable: false
                }));
            }
            return;
        }

        // Check Cloud (Remote)
        try {
            const abortController = new AbortController();
            const timeoutId = setTimeout(() => abortController.abort(), 3000);

            const { error } = await supabase
                .from('businesses')
                .select('id')
                .limit(1);

            clearTimeout(timeoutId);
            cloudOk = !error;
        } catch (err) {
            cloudOk = false;
        }

        // Check Local (Docker)
        const isLocalHost = window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1' ||
            window.location.hostname.startsWith('192.168.') ||
            window.location.hostname.startsWith('10.') ||
            window.location.hostname.startsWith('172.') ||
            window.location.hostname.startsWith('100.') ||
            !window.location.hostname.includes('.');

        if (isLocalHost) {
            try {
                const localController = new AbortController();
                const localTimeoutId = setTimeout(() => localController.abort(), 2000);

                const localResp = await fetch(`${LOCAL_SUPABASE_URL}/rest/v1/`, {
                    method: 'GET',
                    headers: { 'apikey': import.meta.env.VITE_LOCAL_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY },
                    signal: localController.signal
                }).catch(() => null);

                clearTimeout(localTimeoutId);
                localOk = !!(localResp && localResp.ok);
            } catch (err) {
                localOk = false;
            }
        }

        // Determine transition and lost type
        const prevStatus = state.status;
        let nextStatus = 'offline';
        if (localOk && cloudOk) nextStatus = 'online';
        else if (localOk) nextStatus = 'local-only';
        else if (cloudOk) nextStatus = 'cloud-only';

        // 🛡️ FAILURE THRESHOLD LOGIC
        if (nextStatus === 'online') {
            failureCount.current = 0;
            if (showOfflinePopup) setShowOfflinePopup(false);
            if (prevStatus !== 'online' && prevStatus !== 'checking') {
                setShowOnlinePopup(true);
                setTimeout(() => setShowOnlinePopup(false), 3000);
            }
        } else {
            failureCount.current++;
            if (failureCount.current >= 3) {
                if (nextStatus !== prevStatus && prevStatus !== 'checking') {
                    if (nextStatus === 'offline') {
                        setLostType('all');
                        setShowOfflinePopup(true);
                    } else if (nextStatus === 'local-only' && prevStatus === 'online') {
                        setLostType('cloud');
                        setShowOfflinePopup(true);
                    } else if (nextStatus === 'cloud-only' && prevStatus === 'online' && isLocalHost) {
                        setLostType('local');
                        setShowOfflinePopup(true);
                    }
                }
            } else {
                nextStatus = prevStatus; // Keep previous status until threshold reached
            }
        }

        setState(prev => ({
            status: nextStatus,
            localAvailable: localOk,
            cloudAvailable: cloudOk,
            lastSync: (localOk && cloudOk) ? new Date() : prev.lastSync,
            lastLocalAvailable: localOk ? new Date() : prev.lastLocalAvailable,
            lastCloudAvailable: cloudOk ? new Date() : prev.lastCloudAvailable
        }));

    }, [state.status, showOfflinePopup]);

    // Check on mount and periodically
    useEffect(() => {
        checkConnectivity();
        const interval = setInterval(checkConnectivity, 8000);
        return () => clearInterval(interval);
    }, [checkConnectivity]);

    // Listen for browser events
    useEffect(() => {
        const handleOnline = () => {
            console.log('🌐 Browser Online');
            checkConnectivity();
        };
        const handleOffline = () => {
            console.log('📴 Browser Offline');
            setLostType('all');
            setShowOfflinePopup(true);
            setState(prev => ({ ...prev, status: 'offline', cloudAvailable: false, localAvailable: false }));
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [checkConnectivity]);

    // Get Popup Content based on lostType
    const getPopupContent = () => {
        switch (lostType) {
            case 'local':
                return {
                    icon: '🖥️',
                    title: 'החיבור לשרת המקומי אבד',
                    message: 'למרות זאת, אתה עדיין מחובר לענן! המערכת תמשיך לעבוד כרגיל מול השרת המרוחק.',
                    color: 'from-blue-500 to-indigo-600',
                    tips: ['✅ הטאבלט עבר לעבוד מול הענן', '✅ הכל נשמר כרגיל', '⚠️ הקיוסק עשוי להגיב לאט יותר']
                };
            case 'cloud':
                return {
                    icon: '☁️',
                    title: 'החיבור לאינטרנט אבד',
                    message: 'אל דאגה, המחשב המקומי (N150) פעיל! המערכת תמשיך לעבוד במצב מקומי.',
                    color: 'from-amber-500 to-orange-600',
                    tips: ['✅ המערכת עובדת מול השרת המקומי', '✅ הזמנות נשמרות ב-N150', '🔄 הסנכרון לענן יחזור כשיחזור האינטרנט']
                };
            default:
                return {
                    icon: '📴',
                    title: 'אין חיבור לרשת',
                    message: 'נראה שכרגע אין גישה לאינטרנט וגם לא לשרת המקומי. המערכת עוברת למצב חירום.',
                    color: 'from-red-500 to-rose-600',
                    tips: ['⚠️ נתונים נשמרים רק על הטאבלט כרגע', '💳 סליקה ידנית בלבד', '🔄 הכל יסתנכרן אוטומטית כשהקשר יחזור']
                };
        }
    };

    const content = getPopupContent();

    return (
        <ConnectionContext.Provider value={{ ...state, refresh: checkConnectivity }}>
            {/* Offline Popup */}
            {showOfflinePopup && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-md">
                    <div className={`bg-gradient-to-br ${content.color} text-white rounded-[40px] shadow-2xl p-10 mx-4 max-w-md text-center border-4 border-white/20`}>
                        <div className="w-24 h-24 mx-auto mb-6 bg-white/20 rounded-full flex items-center justify-center shadow-inner">
                            <span className="text-5xl animate-pulse">{content.icon}</span>
                        </div>
                        <h2 className="text-3xl font-black mb-4 tracking-tight">{content.title}</h2>
                        <p className="text-white/90 font-medium mb-6 text-lg leading-relaxed">{content.message}</p>

                        <div className="bg-black/20 rounded-3xl p-5 text-right space-y-3 mb-8 border border-white/10">
                            {content.tips.map((tip, i) => (
                                <p key={i} className="flex items-center gap-2 text-sm">
                                    <span className="w-1.5 h-1.5 bg-white rounded-full flex-shrink-0" />
                                    {tip}
                                </p>
                            ))}
                        </div>

                        <button
                            onClick={() => setShowOfflinePopup(false)}
                            className="w-full py-4 bg-white text-gray-900 hover:bg-gray-100 rounded-2xl font-black text-xl shadow-xl transition-all transform active:scale-95"
                        >
                            הבנתי, תודה!
                        </button>
                    </div>
                </div>
            )}

            {/* Online Popup */}
            {showOnlinePopup && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm pointer-events-none">
                    <div className="bg-gradient-to-br from-emerald-500 to-green-600 text-white rounded-3xl shadow-2xl p-8 mx-4 max-w-sm text-center animate-bounce-short">
                        <div className="w-16 h-16 mx-auto mb-4 bg-white/20 rounded-full flex items-center justify-center">
                            <span className="text-3xl">🌐</span>
                        </div>
                        <h2 className="text-2xl font-black mb-1">חזרנו אונליין!</h2>
                        <p className="text-white/90 font-medium">המערכת חזרה לעבוד במצב מלא.</p>
                    </div>
                </div>
            )}

            {children}
        </ConnectionContext.Provider>
    );
};

export const useConnection = () => {
    const context = useContext(ConnectionContext);
    if (!context) {
        throw new Error('useConnection must be used within ConnectionProvider');
    }
    return context;
};

export default ConnectionContext;
