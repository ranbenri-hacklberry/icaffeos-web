import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    MessageCircle,
    Smartphone,
    Monitor,
    CheckCircle,
    XCircle,
    RefreshCw,
    Loader2,
    QrCode,
    Hash,
    Unplug,
    Wifi,
    WifiOff
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

// ============================================
// CONFIGURATION - Using Backend Proxy
// ============================================
// Instead of direct env var, we point to our local proxy
const API_BASE_URL = '/api/whatsapp';

// ============================================
// DEVICE DETECTION
// ============================================
const useDeviceType = () => {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkDevice = () => {
            const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            const smallScreen = window.innerWidth < 768;
            setIsMobile(mobile || smallScreen);
        };

        checkDevice();
        window.addEventListener('resize', checkDevice);
        return () => window.removeEventListener('resize', checkDevice);
    }, []);

    return isMobile;
};

// ============================================
// MAIN COMPONENT
// ============================================
const WhatsAppConnect = () => {
    const { currentUser } = useAuth();
    const isMobile = useDeviceType();

    // State
    const [status, setStatus] = useState('loading'); // loading, disconnected, connecting, connected
    const [qrCode, setQrCode] = useState(null);
    const [pairingCode, setPairingCode] = useState(null);
    const [phoneNumber, setPhoneNumber] = useState('');
    const [instanceName, setInstanceName] = useState(null);
    const [error, setError] = useState(null);
    const [connectedNumber, setConnectedNumber] = useState(null);

    // Generate unique instance name for this business
    const getInstanceName = useCallback(() => {
        return 'default';
    }, []);

    // ============================================
    // API CALLS (Via Proxy)
    // ============================================

    const apiCall = async (endpoint, method = 'GET', body = null) => {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json'
                // No API key needed here, handled by proxy
            }
        };
        if (body) options.body = JSON.stringify(body);

        const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `API Error: ${response.status}`);
        }
        return response.json();
    };

    // Check connection status
    const checkStatus = useCallback(async () => {
        const name = getInstanceName();
        if (!name) return;

        try {
            const result = await apiCall(`/status?instanceName=${name}`);

            if (result.status === 'connected') {
                setStatus('connected');
                setQrCode(null);
            } else if (result.status === 'qr_ready') {
                setStatus('connecting');
                if (result.qr) setQrCode(result.qr);
            } else {
                setStatus('disconnected');
            }
        } catch (err) {
            console.error('Status check failed:', err);
            setStatus('disconnected');
        }
    }, [getInstanceName]);

    // Create instance and get QR/Pairing Code
    const connect = async () => {
        const name = getInstanceName();
        if (!name) {
            setError('לא נמצא מזהה עסק');
            return;
        }

        setStatus('connecting');
        setError(null);

        // Create new connection request
        const createBody = {
            instanceName: name
        };

        await apiCall('/connect', 'POST', createBody);
        try {
            await apiCall('/connect', 'POST', createBody);
            setInstanceName(name);

            // Wait for QR via socket or polling...
            // For now, we rely on polling since backend handles socket emission separately
            startPolling();

        } catch (err) {
            console.error('Connection failed:', err);
            setError(err.message || 'שגיאה בהתחברות');
            setStatus('disconnected');
        }
    };

    // Disconnect
    const disconnect = async () => {
        if (!instanceName) return;

        try {
            await apiCall(`/instance/logout/${instanceName}`, 'DELETE');
            setStatus('disconnected');
            setQrCode(null);
            setPairingCode(null);
            setConnectedNumber(null);
        } catch (err) {
            console.error('Disconnect failed:', err);
            setError('שגיאה בהתנתקות');
        }
    };

    // Refresh QR Code
    const refreshQR = async () => {
        if (!instanceName) return;

        try {
            const result = await apiCall(`/instance/connect/${instanceName}`, 'GET');
            if (result.base64) {
                setQrCode(result.base64);
            }
            if (result.pairingCode) {
                setPairingCode(result.pairingCode);
            }
        } catch (err) {
            console.error('QR refresh failed:', err);
        }
    };

    // Polling for connection status
    const startPolling = () => {
        const interval = setInterval(async () => {
            await checkStatus();
        }, 3000);

        // Stop after 2 minutes
        setTimeout(() => clearInterval(interval), 120000);

        return () => clearInterval(interval);
    };

    // ============================================
    // EFFECTS
    // ============================================

    useEffect(() => {
        if (currentUser?.business_id) {
            checkStatus();
        }
    }, [currentUser?.business_id, checkStatus]);

    // Save connection to Supabase when connected
    useEffect(() => {
        if (status === 'connected' && currentUser?.business_id && connectedNumber) {
            supabase
                .from('businesses')
                .update({
                    whatsapp_connected: true,
                    whatsapp_number: connectedNumber,
                    whatsapp_instance: instanceName
                })
                .eq('id', currentUser.business_id)
                .then(({ error }) => {
                    if (error) console.error('Failed to save WhatsApp status:', error);
                });
        }
    }, [status, currentUser?.business_id, connectedNumber, instanceName]);

    // ============================================
    // RENDER HELPERS
    // ============================================

    const renderStatusBadge = () => {
        const statusConfig = {
            loading: { color: 'bg-slate-600', text: 'בודק...', icon: Loader2, spin: true },
            disconnected: { color: 'bg-red-500/20 text-red-400 border-red-500/30', text: 'לא מחובר', icon: WifiOff },
            connecting: { color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', text: 'מתחבר...', icon: Loader2, spin: true },
            connected: { color: 'bg-green-500/20 text-green-400 border-green-500/30', text: 'מחובר', icon: Wifi }
        };

        const config = statusConfig[status];
        const Icon = config.icon;

        return (
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${config.color}`}>
                <Icon size={14} className={config.spin ? 'animate-spin' : ''} />
                <span className="text-xs font-medium">{config.text}</span>
            </div>
        );
    };

    const renderMobileInstructions = () => (
        <div className="space-y-3 text-sm text-slate-400">
            <p className="font-medium text-slate-300">הוראות חיבור בנייד:</p>
            <ol className="space-y-2 pr-4">
                <li className="flex items-start gap-2">
                    <span className="bg-green-500/20 text-green-400 rounded-full w-5 h-5 flex items-center justify-center text-xs flex-shrink-0">1</span>
                    <span>פתח את WhatsApp בטלפון</span>
                </li>
                <li className="flex items-start gap-2">
                    <span className="bg-green-500/20 text-green-400 rounded-full w-5 h-5 flex items-center justify-center text-xs flex-shrink-0">2</span>
                    <span>לך ל: הגדרות ← מכשירים מקושרים</span>
                </li>
                <li className="flex items-start gap-2">
                    <span className="bg-green-500/20 text-green-400 rounded-full w-5 h-5 flex items-center justify-center text-xs flex-shrink-0">3</span>
                    <span>לחץ "קשר מכשיר" ← "קשר עם מספר טלפון"</span>
                </li>
                <li className="flex items-start gap-2">
                    <span className="bg-green-500/20 text-green-400 rounded-full w-5 h-5 flex items-center justify-center text-xs flex-shrink-0">4</span>
                    <span>הקלד את הקוד שמופיע למעלה</span>
                </li>
            </ol>
        </div>
    );

    const renderDesktopInstructions = () => (
        <div className="space-y-3 text-sm text-slate-400">
            <p className="font-medium text-slate-300">הוראות חיבור:</p>
            <ol className="space-y-2 pr-4">
                <li className="flex items-start gap-2">
                    <span className="bg-green-500/20 text-green-400 rounded-full w-5 h-5 flex items-center justify-center text-xs flex-shrink-0">1</span>
                    <span>פתח את WhatsApp בטלפון</span>
                </li>
                <li className="flex items-start gap-2">
                    <span className="bg-green-500/20 text-green-400 rounded-full w-5 h-5 flex items-center justify-center text-xs flex-shrink-0">2</span>
                    <span>לך ל: הגדרות ← מכשירים מקושרים</span>
                </li>
                <li className="flex items-start gap-2">
                    <span className="bg-green-500/20 text-green-400 rounded-full w-5 h-5 flex items-center justify-center text-xs flex-shrink-0">3</span>
                    <span>לחץ "קשר מכשיר" וסרוק את הקוד</span>
                </li>
            </ol>
        </div>
    );

    // ============================================
    // MAIN RENDER
    // ============================================

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-slate-800 rounded-2xl shadow-xl border border-green-500/20 p-8"
        >
            <div className="flex flex-col gap-6">
                {/* Header */}
                <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-green-500/10 rounded-xl border border-green-500/20 text-green-400">
                            <MessageCircle className="w-8 h-8" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-white mb-2">WhatsApp Business</h2>
                            <p className="text-slate-400 text-base leading-relaxed">
                                חבר את העסק לוואטסאפ לקבלת הזמנות, עדכונים ללקוחות ותקשורת אוטומטית.
                            </p>
                        </div>
                    </div>
                    {renderStatusBadge()}
                </div>

                {/* Error Message */}
                <AnimatePresence>
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-3"
                        >
                            <XCircle className="text-red-400" size={20} />
                            <span className="text-red-400 text-sm">{error}</span>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Connected State */}
                {status === 'connected' && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-green-500/10 border border-green-500/30 rounded-xl p-6"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center">
                                    <CheckCircle className="text-green-400" size={24} />
                                </div>
                                <div>
                                    <p className="text-green-400 font-bold text-lg">מחובר בהצלחה!</p>
                                    {connectedNumber && (
                                        <p className="text-slate-400 text-sm">{connectedNumber}</p>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={disconnect}
                                className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-xl text-sm font-medium flex items-center gap-2 transition-all"
                            >
                                <Unplug size={16} />
                                התנתק
                            </button>
                        </div>
                    </motion.div>
                )}

                {/* Disconnected State - Show Connect UI */}
                {status === 'disconnected' && (
                    <div className="space-y-6">
                        {/* Device Mode Indicator */}
                        <div className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-xl border border-slate-700/50">
                            {isMobile ? (
                                <>
                                    <Smartphone className="text-blue-400" size={20} />
                                    <span className="text-slate-300 text-sm">מצב נייד - חיבור עם קוד</span>
                                </>
                            ) : (
                                <>
                                    <Monitor className="text-blue-400" size={20} />
                                    <span className="text-slate-300 text-sm">מצב דסקטופ - חיבור עם QR</span>
                                </>
                            )}
                        </div>

                        {/* Phone Number Input (for mobile pairing) */}
                        {isMobile && (
                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-500 mb-2 block tracking-widest">
                                    מספר הטלפון שלך (לקוד זיווג)
                                </label>
                                <input
                                    type="tel"
                                    value={phoneNumber}
                                    onChange={e => setPhoneNumber(e.target.value)}
                                    placeholder="972501234567"
                                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-white font-mono text-lg text-center focus:border-green-500 outline-none transition-all"
                                    dir="ltr"
                                />
                                <p className="text-[11px] text-slate-500 mt-2">הכנס מספר עם קידומת מדינה (ללא +)</p>
                            </div>
                        )}

                        {/* Connect Button */}
                        <button
                            onClick={connect}
                            disabled={isMobile && !phoneNumber}
                            className="w-full py-4 bg-green-600 hover:bg-green-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-black rounded-xl text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-3"
                        >
                            <MessageCircle size={20} />
                            התחבר לוואטסאפ
                        </button>
                    </div>
                )}

                {/* Connecting State - Show QR/Pairing Code */}
                {status === 'connecting' && (
                    <div className="space-y-6">
                        {/* QR Code or Pairing Code Display */}
                        <div className="flex flex-col items-center gap-6">
                            {/* Pairing Code (Mobile) */}
                            {pairingCode && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="text-center"
                                >
                                    <div className="flex items-center justify-center gap-2 mb-4">
                                        <Hash className="text-green-400" size={24} />
                                        <span className="text-slate-300 font-medium">קוד זיווג</span>
                                    </div>
                                    <div className="bg-slate-900 border-2 border-green-500/50 rounded-2xl p-6">
                                        <p className="text-4xl font-mono font-bold text-green-400 tracking-[0.3em]">
                                            {pairingCode}
                                        </p>
                                    </div>
                                    <p className="text-slate-500 text-sm mt-3">הקוד תקף ל-60 שניות</p>
                                </motion.div>
                            )}

                            {/* QR Code (Desktop or fallback) */}
                            {qrCode && (!isMobile || !pairingCode) && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="text-center"
                                >
                                    <div className="flex items-center justify-center gap-2 mb-4">
                                        <QrCode className="text-green-400" size={24} />
                                        <span className="text-slate-300 font-medium">סרוק את הקוד</span>
                                    </div>
                                    <div className="bg-white p-4 rounded-2xl inline-block">
                                        <img
                                            src={`https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(qrCode)}`}
                                            alt="WhatsApp QR Code"
                                            className="w-64 h-64"
                                        />
                                    </div>
                                </motion.div>
                            )}

                            {/* Loading State */}
                            {!qrCode && !pairingCode && (
                                <div className="flex flex-col items-center gap-4 py-8">
                                    <Loader2 className="w-12 h-12 text-green-400 animate-spin" />
                                    <p className="text-slate-400">מכין קוד חיבור...</p>
                                </div>
                            )}

                            {/* Refresh Button */}
                            {(qrCode || pairingCode) && (
                                <button
                                    onClick={refreshQR}
                                    className="flex items-center gap-2 px-4 py-2 text-slate-400 hover:text-white transition-colors"
                                >
                                    <RefreshCw size={16} />
                                    <span className="text-sm">רענן קוד</span>
                                </button>
                            )}
                        </div>

                        {/* Instructions */}
                        <div className="border-t border-slate-700 pt-6">
                            {isMobile ? renderMobileInstructions() : renderDesktopInstructions()}
                        </div>

                        {/* Cancel Button */}
                        <button
                            onClick={() => {
                                setStatus('disconnected');
                                setQrCode(null);
                                setPairingCode(null);
                            }}
                            className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl text-sm transition-all"
                        >
                            ביטול
                        </button>
                    </div>
                )}

                {/* Features List */}
                {status !== 'connecting' && (
                    <div className="border-t border-slate-700 pt-6">
                        <p className="text-[10px] font-black uppercase text-slate-500 mb-4 tracking-widest">
                            מה תקבל עם חיבור וואטסאפ
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {[
                                'קבלת הזמנות ישירות לוואטסאפ',
                                'עדכוני סטטוס אוטומטיים ללקוחות',
                                'תזכורות והתראות',
                                'תקשורת דו-כיוונית עם לקוחות'
                            ].map((feature, i) => (
                                <div key={i} className="flex items-center gap-2 text-sm text-slate-400">
                                    <CheckCircle size={14} className="text-green-500/70" />
                                    <span>{feature}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </motion.div>
    );
};

export default WhatsAppConnect;
