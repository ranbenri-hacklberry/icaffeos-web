import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useLocationCluster } from '../../hooks/useLocationCluster';
import RegionSelectorOverride from '../../components/RegionSelectorOverride';
import PushNotificationManager from '../../components/PushNotificationManager';

// Initialize local Supabase
const supabaseUrl = import.meta.env.VITE_LOCAL_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseKey = import.meta.env.VITE_LOCAL_SUPABASE_ANON_KEY || 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';
const supabase = createClient(supabaseUrl, supabaseKey);

export default function LoyaltyPortal() {
    const { selectedRegion, loading: locationLoading } = useLocationCluster();
    const currentRegion = selectedRegion?.name;
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [phone, setPhone] = useState('');
    const [otpCode, setOtpCode] = useState('');
    const [isOtpSent, setIsOtpSent] = useState(false);
    const [authLoading, setAuthLoading] = useState(false);
    const [authError, setAuthError] = useState('');
    
    // User Data
    const [userId, setUserId] = useState('');
    const [userName, setUserName] = useState('לקוח נאמנות');
    const [userPhone, setUserPhone] = useState('');
    const [stores, setStores] = useState([]);
    
    // Multi-Tenant Key-Value Maps
    const [coffeeCounts, setCoffeeCounts] = useState({});
    const [promosMap, setPromosMap] = useState({});
    const [subscriptionMap, setSubscriptionMap] = useState({});
    
    // Accordion State
    const [expandedCardId, setExpandedCardId] = useState(null);
    const [showRegionSelector, setShowRegionSelector] = useState(false);
    const [showBarcodeModal, setShowBarcodeModal] = useState(false);

    // Check Auth Status on mount
    useEffect(() => {
        const token = localStorage.getItem('loyalty_access_token');
        const savedPhone = localStorage.getItem('loyalty_phone');
        const savedId = localStorage.getItem('loyalty_user_id');

        if (token && savedPhone && savedId) {
            setUserId(savedId);
            setUserPhone(savedPhone);
            setIsAuthenticated(true);
            fetchProfileName(savedId);
        }
    }, []);

    // Trigger store/promotions loading when region changes or authenticated
    useEffect(() => {
        if (isAuthenticated) {
            fetchStoresAndSubscriptions();
        }
    }, [isAuthenticated, currentRegion, userPhone]);

    const fetchProfileName = async (idStr) => {
        try {
            const { data: profile } = await supabase
                .from('profiles')
                .select('name')
                .eq('id', idStr)
                .single();

            if (profile?.name) {
                setUserName(profile.name);
            }
        } catch (err) {
            console.error('Failed to fetch profile name:', err);
        }
    };

    const fetchStoresAndSubscriptions = async () => {
        try {
            if (!currentRegion) return;

            // Fetch stores in current region
            const { data: regionData } = await supabase
                .from('regions')
                .select('id')
                .eq('name', currentRegion)
                .single();

            if (!regionData) return;

            // Select multi-tenant config columns
            const { data: bizList } = await supabase
                .from('businesses')
                .select('id, name, has_stamps, brand_color, settings')
                .eq('region_id', regionData.id);

            if (bizList && bizList.length > 0) {
                setStores(bizList);
                setExpandedCardId(bizList[0].id); // Expand first card on load
                
                // Fetch data in parallel for each store
                bizList.forEach(biz => {
                    fetchUserDataForBiz(biz.id);
                    fetchPromotionsForBiz(biz.id);
                    fetchSubscriptionStatusForBiz(biz.id);
                });
            } else {
                setStores([]);
                setExpandedCardId(null);
            }
        } catch (err) {
            console.error('Failed to fetch stores:', err);
        }
    };

    const fetchUserDataForBiz = async (bizId) => {
        try {
            let formatted = userPhone;
            if (!formatted) return;
            if (formatted.startsWith('0')) {
                formatted = '+972' + formatted.substring(1);
            } else if (!formatted.startsWith('+')) {
                formatted = '+972' + formatted;
            }

            const { data: customer } = await supabase
                .from('customers')
                .select('loyalty_coffee_count, name')
                .in('phone_number', [formatted, userPhone, userPhone.replace(/\D/g, '')])
                .eq('business_id', bizId)
                .limit(1)
                .maybeSingle();

            if (customer) {
                setCoffeeCounts(prev => ({ ...prev, [bizId]: customer.loyalty_coffee_count || 0 }));
                if (customer.name && userName === 'לקוח נאמנות') {
                    setUserName(customer.name);
                }
            } else {
                setCoffeeCounts(prev => ({ ...prev, [bizId]: 0 }));
            }
        } catch (err) {
            console.error(`Failed to fetch user data for store ${bizId}:`, err);
        }
    };

    const fetchSubscriptionStatusForBiz = async (storeId) => {
        try {
            const { data } = await supabase
                .from('store_subscriptions')
                .select('is_marketing_allowed')
                .eq('customer_phone', userPhone)
                .eq('store_id', storeId)
                .single();

            if (data) {
                setSubscriptionMap(prev => ({ ...prev, [storeId]: data.is_marketing_allowed }));
            } else {
                setSubscriptionMap(prev => ({ ...prev, [storeId]: false }));
            }
        } catch (err) {
            console.error(`Failed to fetch subscription for store ${storeId}:`, err);
        }
    };

    const fetchPromotionsForBiz = async (storeId) => {
        try {
            const { data } = await supabase
                .from('marketplace_promotions')
                .select('*')
                .eq('business_id', storeId)
                .eq('is_active', true);

            if (data) {
                setPromosMap(prev => ({ ...prev, [storeId]: data }));
            }
        } catch (err) {
            console.error(`Failed to fetch promotions for store ${storeId}:`, err);
        }
    };

    const handleToggleSubscriptionForBiz = async (storeId, currentStatus) => {
        const newStatus = !currentStatus;
        setSubscriptionMap(prev => ({ ...prev, [storeId]: newStatus }));

        try {
            await supabase
                .from('store_subscriptions')
                .upsert({
                    customer_phone: userPhone,
                    store_id: storeId,
                    is_marketing_allowed: newStatus
                }, { onConflict: 'customer_phone,store_id' });
        } catch (err) {
            console.error(`Failed to update subscription for store ${storeId}:`, err);
            setSubscriptionMap(prev => ({ ...prev, [storeId]: currentStatus })); // revert
        }
    };

    // OTP Handlers
    const handleRequestOtp = async (e) => {
        e.preventDefault();
        if (!phone || phone.length < 9) {
            setAuthError('אנא הזן מספר טלפון תקין');
            return;
        }

        setAuthLoading(true);
        setAuthError('');

        try {
            const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8081';
            const response = await fetch(`${backendUrl}/api/auth/otp/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone })
            });

            const data = await response.json();

            if (response.ok) {
                setIsOtpSent(true);
                // If in devMode, show the code automatically
                if (data.devMode) {
                    setAuthError(`[DEV MODE] קוד האימות: ${data.message.split(': ')[1]}`);
                }
            } else {
                setAuthError(data.error || 'שגיאה בשליחת קוד אימות');
            }
        } catch (err) {
            setAuthError('לא ניתן להתחבר לשרת ה-API');
        } finally {
            setAuthLoading(false);
        }
    };

    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        if (!otpCode || otpCode.length !== 6) {
            setAuthError('אנא הזן קוד אימות בן 6 ספרות');
            return;
        }

        setAuthLoading(true);
        setAuthError('');

        try {
            const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8081';
            const response = await fetch(`${backendUrl}/api/auth/otp/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, code: otpCode })
            });

            const data = await response.json();

            if (response.ok && data.session) {
                const { access_token, user } = data.session;
                localStorage.setItem('loyalty_access_token', access_token);
                localStorage.setItem('loyalty_phone', user.phone);
                localStorage.setItem('loyalty_user_id', user.id);

                setUserId(user.id);
                setUserPhone(user.phone);
                setIsAuthenticated(true);
                fetchUserData(user.phone, user.id);
            } else {
                setAuthError(data.error || 'קוד אימות שגוי');
            }
        } catch (err) {
            setAuthError('שגיאה במהלך אימות הקוד');
        } finally {
            setAuthLoading(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('loyalty_access_token');
        localStorage.removeItem('loyalty_phone');
        localStorage.removeItem('loyalty_user_id');
        setIsAuthenticated(false);
        setPhone('');
        setOtpCode('');
        setIsOtpSent(false);
        setUserName('לקוח נאמנות');
        setCoffeeCount(0);
        setPromotions([]);
    };

    // Render Login Screen if not authenticated
    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-[#121110] text-white flex flex-col justify-center items-center px-6 py-12 font-inter" dir="rtl">
                <div className="w-full max-w-md bg-[#1c1a19]/90 backdrop-blur-md border border-stone-800 p-8 rounded-2xl shadow-2xl relative overflow-hidden">
                    {/* Background glow */}
                    <div className="absolute -top-24 -left-24 w-48 h-48 bg-amber-500/5 rounded-full blur-3xl"></div>
                    <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-amber-600/5 rounded-full blur-3xl"></div>

                    <div className="text-center mb-8 relative">
                        <div className="w-20 h-20 bg-gradient-to-tr from-amber-500 to-[#b45309] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-500/20">
                            <span className="text-3xl">☕</span>
                        </div>
                        <h2 className="text-2xl font-black bg-gradient-to-r from-amber-400 to-amber-200 bg-clip-text text-transparent">iCaffeOS Loyalty</h2>
                        <p className="text-sm text-stone-400 mt-2">מועדון הלקוחות וההטבות הדיגיטלי שלך</p>
                    </div>

                    {authError && (
                        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 text-center font-bold">
                            {authError}
                        </div>
                    )}

                    {!isOtpSent ? (
                        <form onSubmit={handleRequestOtp} className="space-y-6">
                            <div>
                                <label className="block text-xs font-bold text-stone-400 mb-2 mr-1">מספר טלפון נייד</label>
                                <input
                                    type="tel"
                                    placeholder="לדוגמה: 0501234567"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    className="w-full bg-[#121110] border border-stone-800 rounded-xl px-5 py-4 text-white text-lg placeholder-white/20 focus:border-amber-500 focus:outline-none transition-all duration-300"
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={authLoading}
                                className="w-full bg-gradient-to-r from-amber-500 to-[#d97706] hover:from-amber-400 hover:to-[#b45309] text-black font-black py-4 rounded-xl shadow-lg shadow-amber-500/10 hover:shadow-amber-500/20 transition-all duration-300 transform active:scale-95 disabled:opacity-50"
                            >
                                {authLoading ? 'שולח קוד...' : 'שלח קוד אימות ב-SMS'}
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleVerifyOtp} className="space-y-6">
                            <div>
                                <label className="block text-xs font-bold text-stone-400 mb-2 mr-1">קוד אימות (6 ספרות)</label>
                                <input
                                    type="text"
                                    maxLength={6}
                                    placeholder=" הזן את הקוד שקיבלת"
                                    value={otpCode}
                                    onChange={(e) => setOtpCode(e.target.value)}
                                    className="w-full bg-[#121110] border border-stone-800 rounded-xl px-5 py-4 text-white text-center text-2xl tracking-widest placeholder-white/20 focus:border-amber-500 focus:outline-none transition-all duration-300"
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={authLoading}
                                className="w-full bg-gradient-to-r from-amber-500 to-[#d97706] hover:from-amber-400 hover:to-[#b45309] text-black font-black py-4 rounded-xl shadow-lg shadow-amber-500/10 hover:shadow-amber-500/20 transition-all duration-300 transform active:scale-95 disabled:opacity-50"
                            >
                                {authLoading ? 'מאמת...' : 'אישור וכניסה'}
                            </button>

                            <button
                                type="button"
                                onClick={() => setIsOtpSent(false)}
                                className="w-full text-xs text-stone-400 hover:text-white transition-colors duration-200"
                            >
                                חזור להזנת טלפון
                            </button>
                        </form>
                    )}
                </div>
            </div>
        );
    }

    // Render Loyalty Dashboard
    const regionLocalization = {
        'Jordan Valley': 'בקעת הירדן 🌾',
        'Sharon': 'השרון 🌳',
        'Poleg': 'פולג 🌊'
    };
    const displayRegion = regionLocalization[currentRegion] || currentRegion || 'בחר סניף 📍';

    return (
        <div className="min-h-screen bg-[#121110] text-white font-inter pb-12" dir="rtl">
            {/* FCM Token Sync helper component */}
            <PushNotificationManager />

            {/* Top Navigation */}
            <header className="sticky top-0 bg-[#121110]/95 backdrop-blur-md border-b border-stone-900 z-50 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setShowRegionSelector(!showRegionSelector)}
                        className="text-xs font-black bg-[#1c1a19] border border-stone-800 text-amber-500 rounded-full px-4 py-2 hover:bg-stone-800 transition-all shadow-md active:scale-95 flex items-center gap-1.5"
                    >
                        <span>📍</span>
                        <span>{displayRegion}</span>
                    </button>
                </div>

                <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-stone-200">שלום, {userName.split(' ')[0]} ☕</span>
                    <button 
                        onClick={handleLogout}
                        className="text-stone-500 hover:text-stone-300 transition-colors p-1"
                        title="התנתק"
                    >
                        ⚙️
                    </button>
                </div>
            </header>

            <main className="max-w-md mx-auto px-6 mt-6 space-y-6">
                {/* 1. Toggleable Region Selector Modal/Card */}
                {showRegionSelector && (
                    <div className="bg-[#1c1a19]/95 border border-stone-850 rounded-2xl p-4 shadow-xl transition-all duration-300">
                        <div className="flex justify-between items-center mb-3">
                            <span className="text-xs font-bold text-stone-400">בחר אזור / סניף</span>
                            <button onClick={() => setShowRegionSelector(false)} className="text-xs text-stone-500 hover:text-white">✕ סגור</button>
                        </div>
                        <RegionSelectorOverride />
                    </div>
                )}

                {/* 2. Apple Wallet Card Stack */}
                <div className="space-y-4">
                    {stores.map((biz) => {
                        const isExpanded = expandedCardId === biz.id;
                        const bizCoffeeCount = coffeeCounts[biz.id] || 0;
                        const bizPromos = promosMap[biz.id] || [];
                        const bizIsSubscribed = subscriptionMap[biz.id] || false;
                        const brandBg = biz.brand_color || '#1c1a19';
                        
                        let bizLogo = '🏷️';
                        if (biz.has_stamps) {
                            bizLogo = '☕';
                        } else if (biz.name.includes('משתלה') || biz.name.includes('גן')) {
                            bizLogo = '🌿';
                        }

                        return (
                            <div 
                                key={biz.id}
                                onClick={() => {
                                    if (!isExpanded) {
                                        setExpandedCardId(biz.id);
                                    }
                                }}
                                className={`transition-all duration-500 ease-out border rounded-3xl overflow-hidden shadow-lg ${
                                    isExpanded 
                                        ? 'z-20 scale-[1.02] border-amber-500/30' 
                                        : 'z-10 -mt-10 first:mt-0 hover:-translate-y-2 cursor-pointer border-stone-850/80 opacity-80 hover:opacity-100'
                                }`}
                                style={{ 
                                    backgroundColor: brandBg,
                                    backgroundImage: isExpanded 
                                        ? `linear-gradient(135deg, ${brandBg} 0%, #121110 100%)` 
                                        : `linear-gradient(135deg, ${brandBg} 0%, rgba(18,17,16,0.85) 100%)`
                                }}
                            >
                                {/* Card Header (Visible in Collapsed State) */}
                                <div className="p-6 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-xl shadow-inner">
                                            {bizLogo}
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-black text-white">{biz.name}</h3>
                                            <p className="text-[9px] text-stone-400 font-bold uppercase tracking-wider">
                                                {biz.has_stamps ? 'מועדון קפה ומאפה' : 'מועדון הטבות והנחות'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Stack Badge */}
                                    <div className="flex items-center gap-2">
                                        {isExpanded ? (
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setExpandedCardId(null);
                                                }}
                                                className="text-stone-400 hover:text-white text-xs bg-[#121110]/80 border border-stone-800 rounded-full w-6 h-6 flex items-center justify-center"
                                            >
                                                ✕
                                            </button>
                                        ) : (
                                            <span className="text-[10px] font-black text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full">
                                                {biz.has_stamps ? `${bizCoffeeCount}/10 כוסות` : `${bizPromos.length} מבצעים`}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Expanded Card Body */}
                                {isExpanded && (
                                    <div className="px-6 pb-6 pt-2 space-y-6 border-t border-white/5 animate-fadeIn">
                                        {/* Card User Detail */}
                                        <div className="flex justify-between items-center text-stone-300">
                                            <div>
                                                <span className="text-[9px] font-bold text-amber-500/60 tracking-wider uppercase">Digital Member Card</span>
                                                <h4 className="text-lg font-black text-stone-100">{userName}</h4>
                                                <p className="text-[10px] text-stone-400">{userPhone}</p>
                                            </div>
                                            
                                            {/* Barcode scan trigger */}
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setShowBarcodeModal(true);
                                                }}
                                                className="bg-[#121110] hover:bg-stone-900 border border-stone-800 rounded-2xl px-4 py-3 flex items-center gap-2 transition-all duration-300 transform active:scale-95 shadow-md"
                                            >
                                                <span className="text-base">📱</span>
                                                <span className="text-[11px] font-bold text-amber-500">ברקוד</span>
                                            </button>
                                        </div>

                                        {/* TYPE A: Cafe Stamps Layout */}
                                        {biz.has_stamps && (
                                            <div className="bg-[#22201e] rounded-3xl p-5 border border-stone-800/40 shadow-inner space-y-4">
                                                <div className="text-center">
                                                    <p className="text-xs font-bold text-amber-400 mb-0.5" dir="rtl">
                                                        {bizCoffeeCount >= 10 
                                                            ? "הגעת ליעד! קפה מתנה מחכה לך בקופה! 🎁" 
                                                            : `עוד ${10 - bizCoffeeCount} כוסות והקפה הבא עלינו! 🎉`
                                                        }
                                                    </p>
                                                    <span className="text-[8px] text-stone-500 font-bold uppercase tracking-wider">כרטיסיית קפה (10 כוסות)</span>
                                                </div>

                                                {/* Stamps Grid */}
                                                <div className="grid grid-cols-5 gap-2.5">
                                                    {Array.from({ length: 10 }).map((_, idx) => {
                                                        const isStamped = idx < bizCoffeeCount;
                                                        const isLast = idx === 9;
                                                        
                                                        if (isLast) {
                                                            return (
                                                                <div 
                                                                    key={idx} 
                                                                    className={`aspect-square rounded-full border-2 flex flex-col items-center justify-center transition-all duration-500 relative ${
                                                                        isStamped 
                                                                            ? 'bg-gradient-to-tr from-amber-500/20 to-amber-600/30 border-amber-500 shadow-lg shadow-amber-500/20 scale-105' 
                                                                            : 'bg-amber-500/5 border-dashed border-amber-500/20 text-amber-500/40'
                                                                    }`}
                                                                >
                                                                    <span className={`text-xl ${isStamped ? 'opacity-100 filter drop-shadow-[0_0_8px_rgba(217,119,6,0.8)] text-[#f59e0b]' : 'opacity-40 text-amber-500/50'}`}>
                                                                        🎁
                                                                    </span>
                                                                    <span className="text-[7px] font-black absolute bottom-0.5 text-amber-500/60">10</span>
                                                                </div>
                                                            );
                                                        }

                                                        return (
                                                            <div 
                                                                key={idx} 
                                                                className={`aspect-square rounded-full border flex flex-col items-center justify-center transition-all duration-500 ${
                                                                    isStamped 
                                                                        ? 'bg-gradient-to-tr from-amber-700/20 to-amber-600/25 border-2 border-amber-500 shadow-md shadow-amber-500/10 scale-105' 
                                                                        : 'bg-transparent border-dashed border-stone-800 text-stone-700'
                                                                }`}
                                                            >
                                                                <span className={`text-lg ${isStamped ? 'opacity-100 filter drop-shadow-[0_0_8px_rgba(217,119,6,0.8)] text-[#f59e0b]' : 'opacity-25 text-stone-600'}`}>
                                                                    ☕
                                                                </span>
                                                                <span className={`text-[7px] font-bold mt-0.5 ${isStamped ? 'text-[#f59e0b]' : 'text-stone-600'}`}>{idx + 1}</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {/* TYPE B: Retail/Nursery Layout (Direct Discounts Info) */}
                                        {!biz.has_stamps && (
                                            <div className="bg-[#121110]/50 rounded-2xl p-4 border border-stone-850 text-stone-300">
                                                <div className="flex items-center gap-2 text-amber-500 font-bold mb-1">
                                                    <span className="text-base">💎</span>
                                                    <h5 className="text-xs">הנחת מועדון קבועה</h5>
                                                </div>
                                                <p className="text-[11px] text-stone-400">
                                                    הצג את הברקוד האישי לקופאי לקבלת הנחה אוטומטית של **10%** על כל קנייה של צמחים וכלי שתילה בסניף!
                                                </p>
                                            </div>
                                        )}

                                        {/* Push Toggle for this business */}
                                        <div className="bg-[#121110]/30 border border-stone-850 rounded-2xl p-4 flex items-center justify-between shadow-inner">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm">🔔</span>
                                                <div>
                                                    <h5 className="text-[11px] font-bold text-stone-300">התראות שיווקיות ומבצעים</h5>
                                                    <p className="text-[9px] text-stone-500">קבלת עדכונים חמים ישירות לנייד</p>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleToggleSubscriptionForBiz(biz.id, bizIsSubscribed);
                                                }}
                                                className={`w-10 h-5 rounded-full p-0.5 transition-colors duration-300 ${bizIsSubscribed ? 'bg-amber-500' : 'bg-stone-700'}`}
                                            >
                                                <div className={`bg-black w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${bizIsSubscribed ? '-translate-x-5' : 'translate-x-0'}`}></div>
                                            </button>
                                        </div>

                                        {/* Active promotions list */}
                                        <div className="space-y-3">
                                            <h5 className="text-xs font-black text-stone-300">מבצעים והטבות בסניף</h5>
                                            
                                            {bizPromos.length === 0 ? (
                                                <div className="bg-[#121110]/40 border border-stone-850 rounded-2xl p-6 text-center text-stone-500">
                                                    <span className="text-2xl block mb-2">🥐</span>
                                                    <p className="text-xs">המבצעים שלנו מתבשלים ברגע זה...</p>
                                                    <p className="text-[10px] text-stone-600 mt-0.5">בינתיים, שיהיה יום מעולה!</p>
                                                </div>
                                            ) : (
                                                <div className="space-y-3">
                                                    {bizPromos.map((promo) => (
                                                        <div 
                                                            key={promo.id}
                                                            className="bg-[#121110]/60 border border-stone-850 rounded-2xl p-4 flex gap-3 shadow-inner"
                                                        >
                                                            <div className="w-12 h-12 bg-[#1c1a19] border border-stone-800 rounded-xl flex-shrink-0 flex items-center justify-center text-2xl shadow-md">
                                                                🏷️
                                                            </div>
                                                            <div className="flex-1 flex flex-col justify-between">
                                                                <div>
                                                                    <h6 className="text-xs font-black text-white">{promo.title}</h6>
                                                                    <p className="text-[10px] text-stone-400 mt-0.5 line-clamp-2">{promo.description}</p>
                                                                </div>
                                                                {promo.valid_to && (
                                                                    <span className="text-[8px] font-bold text-amber-500/80 bg-amber-500/10 px-2 py-0.5 rounded self-start mt-2 border border-amber-500/10">
                                                                        בתוקף עד: {new Date(promo.valid_to).toLocaleDateString('he-IL')}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </main>

            {/* 6. Expandable Barcode Modal */}
            {showBarcodeModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md px-6">
                    <div className="bg-[#1c1a19] border border-stone-800 rounded-3xl p-8 max-w-sm w-full shadow-2xl relative text-center">
                        <h3 className="text-lg font-black mb-6">הברקוד שלך לסריקה</h3>
                        
                        <div className="bg-white p-6 rounded-2xl flex flex-col items-center justify-center mb-6 shadow-inner">
                            <div className="w-full h-16 flex justify-between gap-1 items-center px-2">
                                {[2, 4, 1, 3, 2, 4, 1, 2, 3, 1, 4, 2, 1, 3, 2, 1, 4, 2, 3, 1, 2, 4, 1].map((w, idx) => (
                                    <div key={idx} className="bg-black h-12" style={{ width: `${w * 2}px` }}></div>
                                ))}
                            </div>
                            <span className="text-xs font-mono text-black font-bold tracking-widest mt-3">{userPhone.replace('+', '')}</span>
                        </div>
                        
                        <p className="text-xs text-stone-400 mb-6">הצג את הברקוד לקופאי בעת התשלום לקבלת המדבקה</p>
                        
                        <button 
                            onClick={() => setShowBarcodeModal(false)}
                            className="w-full bg-gradient-to-r from-amber-500 to-[#d97706] hover:from-amber-400 hover:to-[#b45309] text-black font-black py-4 rounded-xl shadow-lg transition-all duration-300 transform active:scale-95"
                        >
                            סגור
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

