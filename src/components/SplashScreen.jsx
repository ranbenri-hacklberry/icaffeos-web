import React, { useState, useEffect, useRef } from 'react';
import './SplashScreen.css';
import { supabase } from '../lib/supabase';
import { initialLoad } from '../services/syncService';
import { getBackendApiUrl } from '../utils/apiUtils';
const API_URL = getBackendApiUrl();

const SplashScreen = ({ onFinish }) => {
    const [minTimePassed, setMinTimePassed] = useState(false);
    const [authChecked, setAuthChecked] = useState(false);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [syncComplete, setSyncComplete] = useState(false);
    const [statusText, setStatusText] = useState('מתניע מערכת...');
    const [showSkipButton, setShowSkipButton] = useState(false);
    const [tapCount, setTapCount] = useState(0);
    const [containerStatus, setContainerStatus] = useState([]); // 🆕 Container visibility
    const [apiChecks, setApiChecks] = useState(null); // 🆕 API Status

    // --- ✨ NEW SMOOTH PROGRESS LOGIC ---
    const [progress, setProgress] = useState(0);
    const [targetProgress, setTargetProgress] = useState(5);
    const progressTimer = useRef(null);
    const lastUpdate = useRef(Date.now());

    // Track if we've already triggered finish to prevent double calls
    const finishTriggered = useRef(false);

    // 🕵️ SECRET RESET: Tap logo 5 times to clear EVERYTHING
    const handleLogoTap = () => {
        const newCount = tapCount + 1;
        setTapCount(newCount);
        if (newCount >= 5) {
            console.warn('🧹 EMERGENCY RESET TRIGGERED!');
            localStorage.clear();
            sessionStorage.clear();
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()));
            }
            window.location.reload(true);
        }
    };

    // 🏃 PROGRESS ANIMATOR: Moves 'progress' towards 'targetProgress' smoothly
    useEffect(() => {
        let frame;
        const animate = () => {
            setProgress(prev => {
                if (prev >= targetProgress) return prev;
                // Cubic easing for a premium feel
                const distance = targetProgress - prev;
                const step = (distance * 0.08) + 0.15;
                return Math.min(prev + step, targetProgress);
            });
            frame = requestAnimationFrame(animate);
        };
        frame = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(frame);
    }, [targetProgress]);

    // 🚀 INITIALIZATION ENGINE: Runs once on mount
    useEffect(() => {
        console.log('🎨 SplashScreen v6.0 - Intelligent Pre-Flight');

        // Global Safety Timeout - If NOTHING happens in 15 seconds, just go in.
        const globalRescueTimer = setTimeout(() => {
            console.error('🆘 GLOBAL SPLASH TIMEOUT - Forcing entry');
            setTargetProgress(100);
            setAuthChecked(true);
            setSyncComplete(true);
            setMinTimePassed(true);
        }, 15000);

        // Show skip button after 8 seconds
        const skipButtonTimer = setTimeout(() => setShowSkipButton(true), 8000);

        const validateIntegrations = async () => {
            // 🆕 INTELLIGENT PRE-FLIGHT CHECK
            setStatusText('בודק קישוריות API...');
            try {
                // Determine Business ID (Helper for backend context)
                let tempBizId = localStorage.getItem('business_id');
                if (!tempBizId) {
                    // Try to peek at user
                    const { data: { user } } = await supabase.auth.getUser();
                    tempBizId = user?.user_metadata?.business_id;
                }

                const url = tempBizId
                    ? `${API_URL}/api/system/validate-integrations?businessId=${tempBizId}`
                    : `${API_URL}/api/system/validate-integrations`;

                const res = await fetch(url);
                const data = await res.json();

                if (data.success && data.checks) {
                    setApiChecks(data.checks);

                    // Identify Failures
                    const failures = Object.entries(data.checks)
                        .filter(([key, val]) => val.status === 'error')
                        .map(([key, val]) => ({ service: key, ...val }));

                    if (failures.length > 0) {
                        console.warn('❌ Integration Failures Detected:', failures);
                        localStorage.setItem('failed_integrations', JSON.stringify(failures));
                    } else {
                        localStorage.removeItem('failed_integrations');
                    }
                }
            } catch (e) {
                console.warn('⚠️ API Validation Packet Loss:', e);
            }
        };

        const initialize = async () => {
            try {
                // Phase 1: Environment & Auth (0-30%)
                setTargetProgress(15);

                // Run checks in parallel (non-blocking visually)
                validateIntegrations();

                const { APP_VERSION } = await import('../version');
                localStorage.setItem('app_version', APP_VERSION);

                // 🤖 ELECTRON AUTO-LOGIN (Hardware ID)
                let isImpersonating = false;
                try {
                    const storedUser = localStorage.getItem('kiosk_user');
                    if (storedUser) {
                        const parsedUser = JSON.parse(storedUser);
                        if (parsedUser.is_impersonating || localStorage.getItem('original_super_admin')) {
                            isImpersonating = true;
                            console.log('👑 Super Admin Impersonation detected. Skipping Hardware ID Login.');
                        }
                    }
                } catch (e) { }

                if (window.electron?.auth && !isImpersonating) {
                    setStatusText('מאמת חומרה...');
                    try {
                        const machineId = await window.electron.auth.getMachineId();
                        if (machineId) {
                            console.log('🔑 Hardware ID:', machineId);
                            const { data, error } = await supabase.rpc('verify_kiosk_device', {
                                p_machine_id_hash: machineId
                            });

                            if (data?.success) {
                                console.log('✅ Hardware ID Verified (Local):', data.user.name);
                                // Store in localStorage for AuthContext to pick up immediately
                                localStorage.setItem('kiosk_user', JSON.stringify({ ...data.user, is_device: true }));
                                localStorage.setItem('kiosk_auth_time', Date.now().toString());
                                setTargetProgress(60);
                                setStatusText('התחברות אוטומטית...');
                            } else {
                                console.warn('⚠️ Hardware ID Unregistered:', data?.reason);
                            }
                        }
                    } catch (e) {
                        console.error('❌ Hardware Auth Failed:', e);
                    }
                }

                // 🚀 FAST PATH: use getSession() to check local auth cache instead of hitting auth server
                const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
                const user = session?.user;
                setTargetProgress(40);

                if (user) {
                    setStatusText('מחבר פרופיל...');
                    let businessId = user.user_metadata?.business_id;

                    if (!businessId) {
                        try {
                            // FAST 3 second timeout for secondary business_id lookup
                            const empAbort = new AbortController();
                            const empTimer = setTimeout(() => empAbort.abort(), 3000);
                            const { data: emp } = await supabase
                                .from('employees')
                                .select('business_id')
                                .eq('auth_user_id', user.id)
                                .abortSignal(empAbort.signal)
                                .maybeSingle();

                            clearTimeout(empTimer);
                            if (emp) businessId = emp.business_id;
                        } catch (e) {
                            console.warn('⚠️ Network slow during employee business_id fetch, skipping');
                        }
                    }

                    if (businessId) {
                        setTargetProgress(45);
                        const { db } = await import('../db/database');

                        try {
                            const localItemCount = await db.menu_items.count();

                            if (localItemCount > 20) {
                                setStatusText('טוען נתונים...');
                                setTargetProgress(90);
                                setTimeout(() => {
                                    setSyncComplete(true);
                                    setAuthChecked(true);
                                    setTargetProgress(100);
                                }, 500); // reduced from 1000
                            } else {
                                setStatusText('מכין סביבת עבודה...');
                                setTargetProgress(100);
                                setSyncComplete(true);
                                setAuthChecked(true);
                            }
                        } catch (dexieErr) {
                            console.error('Dexie Error:', dexieErr);
                            setTargetProgress(100);
                            setSyncComplete(true);
                            setAuthChecked(true);
                        }
                    } else {
                        // User exists but NO Business ID
                        setTargetProgress(100);
                        setSyncComplete(true);
                        setAuthChecked(true);
                    }
                } else {
                    setStatusText('מעבר למסך כניסה...');
                    setTargetProgress(100);
                    // 🛡️ CRITICAL BUG FIX: Ensure splash can finish if no user found
                    setSyncComplete(true);
                    setAuthChecked(true);
                }
                setTargetProgress(100);
            } catch (err) {
                console.error('Initialization error:', err);
                setTargetProgress(100);
                setSyncComplete(true);
                setAuthChecked(true);
            }
        };

        const checkContainers = async () => {
            try {
                const res = await fetch(`${API_URL}/api/system/containers`);
                const data = await res.json();
                if (data && data.success) {
                    setContainerStatus(data.containers || []);
                }
            } catch (err) {
                console.warn('Failed to fetch container status');
            }
        };

        const minTimer = setTimeout(() => setMinTimePassed(true), 2500); // Increased slightly for user to see checks
        initialize();

        // 🚀 Polling containers during splash
        checkContainers();
        const pollId = setInterval(checkContainers, 3000);

        return () => {
            clearTimeout(minTimer);
            clearTimeout(globalRescueTimer);
            clearTimeout(skipButtonTimer);
            clearInterval(pollId);
        };
    }, []); // Run ONCE on mount!

    // Coordinate Finish
    useEffect(() => {
        if (progress >= 100 && minTimePassed && !finishTriggered.current) {
            finishTriggered.current = true;
            // Delay slightly to show 100% state
            setTimeout(onFinish, 400);
        }
    }, [progress, minTimePassed, onFinish]);

    return (
        <div className="splash-container">
            <div className="logo-wrapper">
                <img
                    src="rainbow_cup.png"
                    alt="Logo"
                    className="brand-logo-img"
                    onClick={handleLogoTap}
                    onLoad={() => setImageLoaded(true)}
                    style={{
                        opacity: imageLoaded ? 1 : 0,
                        cursor: 'pointer',
                        width: '200px',
                        height: 'auto',
                        marginBottom: '10px'
                    }}
                />

                <h1 className="brand-name">icaffeos</h1>
                <p className="tagline">icaffeos</p>

                <div className="mt-12 flex flex-col items-center gap-4 w-full min-h-[100px] transition-opacity duration-500"
                    style={{ opacity: imageLoaded ? 1 : 0 }}
                >
                    <div className="loading-bar">
                        <div className="progress" style={{ width: `${progress}%`, transition: 'none', animation: 'none' }}></div>
                    </div>
                    {statusText && (
                        <p className="text-white/60 text-[10px] font-mono animate-pulse uppercase tracking-widest">{statusText}</p>
                    )}

                    {showSkipButton && (
                        <button
                            onClick={() => {
                                localStorage.setItem('lite_mode', 'true');
                                onFinish();
                            }}
                            className="mt-4 px-6 py-2 bg-white/10 hover:bg-white/20 text-white text-xs rounded-full border border-white/20 transition-all animate-bounce"
                        >
                            דלג על סנכרון והכנס ➔ (Lite Mode)
                        </button>
                    )}

                    {/* 🆕 Container Observability Widget combined with API Checks */}
                    {(containerStatus.length > 0 || apiChecks) && (
                        <div className="mt-8 grid grid-cols-2 gap-2 w-full max-w-[400px]">
                            {/* Docker Containers */}
                            {containerStatus.map(c => (
                                <div key={c.name} className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded border border-white/10 overflow-hidden">
                                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${c.status.toLowerCase().includes('up') ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500 animate-pulse'}`} />
                                    <span className="text-[9px] text-white/50 font-mono truncate">{c.name.replace('supabase_', '').replace('_scarlet-zodiac', '')}</span>
                                </div>
                            ))}

                            {/* API Checks */}
                            {apiChecks && Object.entries(apiChecks).map(([key, check]) => {
                                if (check.status === 'skipped') return null;
                                return (
                                    <div key={key} className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded border border-white/10 overflow-hidden">
                                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${check.status === 'ok' ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]' : 'bg-rose-500 animate-ping'
                                            }`} />
                                        <span className="text-[9px] text-white/50 font-mono uppercase truncate">{key} API</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {tapCount > 0 && tapCount < 5 && (
                    <p className="text-white/20 text-[8px] mt-2">Reset in {5 - tapCount} taps...</p>
                )}
            </div>
        </div>
    );
};

export default SplashScreen;
