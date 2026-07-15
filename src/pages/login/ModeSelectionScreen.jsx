import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useMayaAuth } from '@/context/MayaAuthContext';
import { Monitor, ChefHat, LogOut, BarChart3, Coffee, Users, Music, ShieldAlert, Package, List, LayoutGrid, Truck, ShoppingCart, Settings, MessageSquare, ExternalLink, Film, Palette, UserCircle, Database } from 'lucide-react';
import WhatsNewModal from '@/components/WhatsNewModal';
import SmsBalanceWidget from '@/components/SmsBalanceWidget';

const ModeSelectionScreen = () => {
    const navigate = useNavigate();
    const { currentUser, setMode, logout, appVersion } = useAuth();
    const mayaAuth = useMayaAuth();
    const [showWhatsNew, setShowWhatsNew] = useState(true);
    const [integrationErrors, setIntegrationErrors] = useState(null);

    // 🚀 Auto-redirect Super Admin to Super Admin portal (UNLESS Impersonating)
    React.useEffect(() => {
        const isSuper = currentUser?.is_super_admin || currentUser?.user_metadata?.is_super_admin || localStorage.getItem('is_super_admin') === 'true';
        const isImpersonating = currentUser?.is_impersonating === true || localStorage.getItem('original_super_admin');

        if (isSuper && !isImpersonating && window.location.pathname !== '/super-admin') {
            console.log('👑 Super Admin detected on ModeSelection - Redirecting to Portal...');
            navigate('/super-admin', { replace: true });
        }
    }, [currentUser, navigate]);

    // 🆕 Check for integration failures on mount
    React.useEffect(() => {
        const failures = localStorage.getItem('failed_integrations');
        if (failures) {
            try {
                setIntegrationErrors(JSON.parse(failures));
            } catch (e) {
                console.error('Failed to parse integration errors', e);
            }
        }
    }, []);

    // Enhanced User Logic for Display
    const isDeviceUser = currentUser?.is_device || currentUser?.name === 'Main Terminal';

    // Try to get the "Real Name" from metadata if the display name is generic
    const realName = currentUser?.user_metadata?.full_name || currentUser?.user_metadata?.name;

    const displayUser = mayaAuth.employee
        ? { ...mayaAuth.employee, name: mayaAuth.employee.name }
        : {
            ...currentUser,
            name: realName && realName !== 'Main Terminal' ? realName : (isDeviceUser ? (currentUser?.business_name || 'עמדת שירות') : currentUser?.name)
        };

    const user = displayUser || currentUser;


    const isAppVisible = (app) => true;

    const handleModeSelect = (mode) => {
        setMode(mode);
        const routes = {
            manager: '/data-manager-interface',
            kiosk: '/menu-ordering-interface/pos',
            kds: '/kds',
            prep: '/prep',
            inventory: '/inventory',
            music: '/music',
            kanban: '/kanban',
            driver: '/driver',
            'owner-settings': '/owner-settings',
            'menu-editor': '/menu-editor'
        };
        const target = routes[mode] || '/';
        console.log('ð Navigating to:', target);
        navigate(target);
    };


    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 pt-16 font-heebo" dir="rtl">
            <div className="max-w-5xl w-full">
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-black text-white mb-2">
                        שלום, {user?.name || 'עובד'} 👋
                    </h1>

                    <SmsBalanceWidget />
                    {/* Business Name Badge */}
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-500/30 rounded-full">
                        <span className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse" />
                        <span className="text-sm font-bold text-green-400">
                            {currentUser?.business_name || 'iCaffe'}
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 max-w-5xl mx-auto">
                    {/* 1. Dashboard (Cockpit) - FIRST ON MOBILE & DESKTOP */}
                    {isAppVisible('manager') && (
                        <button
                            onClick={() => handleModeSelect('manager')}
                            className="group relative bg-white rounded-2xl p-5 hover:bg-purple-50 transition-all duration-300 hover:-translate-y-1 active:scale-95 hover:shadow-xl text-right overflow-hidden border-2 border-transparent hover:border-purple-100 cursor-pointer z-30"
                        >
                            <div className="absolute top-0 left-0 w-20 h-20 bg-purple-100 rounded-br-full -translate-x-5 -translate-y-5 group-hover:scale-110 transition-transform pointer-events-none" />
                            <div className="relative z-10 pointer-events-none">
                                <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center text-white mb-3 shadow-lg group-hover:rotate-6 transition-transform">
                                    <BarChart3 size={20} strokeWidth={2.5} />
                                </div>
                                <h2 className="text-xl font-black text-slate-900 mb-1">הקוקפיט (Dashboard)</h2>
                                <p className="text-slate-500 text-sm leading-relaxed font-medium">
                                    מכירות, תפריט, מלאי ומשימות
                                </p>
                            </div>
                        </button>
                    )}

                    {/* 1b. iMusic - UNDER COCKPIT */}
                    <button
                        onClick={() => handleModeSelect('music')}
                        className="group relative bg-indigo-900/40 rounded-2xl p-5 hover:bg-indigo-900/60 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl text-right overflow-hidden border-2 border-indigo-500/30 hover:border-indigo-400"
                    >
                        <div className="absolute top-0 left-0 w-20 h-20 bg-indigo-500/20 rounded-br-full -translate-x-5 -translate-y-5 group-hover:scale-110 transition-transform" />
                        <div className="relative z-10">
                            <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center text-white mb-3 shadow-lg group-hover:rotate-12 transition-transform">
                                <Music size={20} strokeWidth={2.5} />
                            </div>
                            <h2 className="text-xl font-black text-white mb-1">iMusic (נגן)</h2>
                            <p className="text-indigo-200 text-sm leading-relaxed font-medium">
                                ניהול מוזיקה ואווירה
                            </p>
                        </div>
                    </button>



                    {/* Profile Settings - Visible to ALL users */}
                    <button
                        onClick={() => navigate('/profile-settings')}
                        className="group relative bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-5 hover:from-indigo-600 hover:to-purple-700 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl text-right overflow-hidden border-2 border-white/20 hover:border-white/40"
                    >
                        <div className="absolute top-0 left-0 w-20 h-20 bg-white/10 rounded-br-full -translate-x-5 -translate-y-5 group-hover:scale-110 transition-transform" />
                        <div className="relative z-10">
                            <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center text-white mb-3 shadow-lg group-hover:rotate-6 transition-transform border border-white/30">
                                <UserCircle size={20} strokeWidth={2.5} />
                            </div>
                            <h2 className="text-xl font-black text-white mb-1">הגדרות פרופיל</h2>
                            <p className="text-white/80 text-sm leading-relaxed font-medium">
                                סיסמה, PIN, טלפון וזיהוי פנים
                            </p>
                        </div>
                    </button>

                    {/* 2. Cash Register - Hidden on Mobile */}
                    {isAppVisible('kiosk') && (
                        <button
                            onClick={() => handleModeSelect('kiosk')}
                            className="hidden md:block group relative bg-white rounded-2xl p-5 hover:bg-orange-50 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl text-right overflow-hidden border-2 border-transparent hover:border-orange-100"
                        >
                            <div className="absolute top-0 left-0 w-20 h-20 bg-orange-100 rounded-br-full -translate-x-5 -translate-y-5 group-hover:scale-110 transition-transform" />
                            <div className="relative z-10">
                                <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center text-white mb-3 shadow-lg group-hover:rotate-6 transition-transform">
                                    <Coffee size={20} strokeWidth={2.5} />
                                </div>
                                <h2 className="text-xl font-black text-slate-900 mb-1">עמדת קופה</h2>
                                <p className="text-slate-500 text-sm leading-relaxed font-medium">
                                    הקלדת הזמנות ומכירות
                                </p>
                            </div>
                        </button>
                    )}

                    {/* 3. Service (KDS) - Tablet/Desktop ONLY */}
                    {isAppVisible('kds') && (
                        <button
                            onClick={() => handleModeSelect('kds')}
                            className="hidden md:block group relative bg-white rounded-2xl p-5 hover:bg-emerald-50 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl text-right overflow-hidden border-2 border-transparent hover:border-emerald-100"
                        >
                            <div className="absolute top-0 left-0 w-20 h-20 bg-emerald-100 rounded-br-full -translate-x-5 -translate-y-5 group-hover:scale-110 transition-transform" />
                            <div className="relative z-10">
                                <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white mb-3 shadow-lg group-hover:rotate-6 transition-transform">
                                    <Monitor size={20} strokeWidth={2.5} />
                                </div>
                                <h2 className="text-xl font-black text-slate-900 mb-1">סרוויס (KDS)</h2>
                                <p className="text-slate-500 text-sm leading-relaxed font-medium">
                                    ניהול הזמנות ומשימות
                                </p>
                            </div>
                        </button>
                    )}

                    {/* 3. Prep Tasks - Reordered to be before Inventory */}
                    {isAppVisible('prep') && (
                        <button
                            onClick={() => handleModeSelect('prep')}
                            className="group relative bg-white rounded-2xl p-5 hover:bg-indigo-50 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl text-right overflow-hidden border-2 border-transparent hover:border-indigo-100"
                        >
                            <div className="absolute top-3 left-3 bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                                חדש
                            </div>
                            <div className="absolute top-0 left-0 w-20 h-20 bg-indigo-100 rounded-br-full -translate-x-5 -translate-y-5 group-hover:scale-110 transition-transform" />
                            <div className="relative z-10">
                                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white mb-3 shadow-lg group-hover:rotate-6 transition-transform">
                                    <List size={20} strokeWidth={2.5} />
                                </div>
                                <h2 className="text-xl font-black text-slate-900 mb-1">הכנות ומשימות</h2>
                                <p className="text-slate-500 text-sm leading-relaxed font-medium">
                                    פתיחה, סגירה ומשימות יום
                                </p>
                            </div>
                        </button>
                    )}

                    {/* 4. Inventory - Reordered after Prep Tasks */}
                    {isAppVisible('inventory') && (
                        <button
                            onClick={() => handleModeSelect('inventory')}
                            className="group relative bg-white rounded-2xl p-5 hover:bg-blue-50 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl text-right overflow-hidden border-2 border-transparent hover:border-blue-100"
                        >
                            <div className="absolute top-3 left-3 bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                                חדש
                            </div>
                            <div className="absolute top-0 left-0 w-20 h-20 bg-blue-100 rounded-br-full -translate-x-5 -translate-y-5 group-hover:scale-110 transition-transform" />
                            <div className="relative z-10">
                                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white mb-3 shadow-lg group-hover:rotate-6 transition-transform">
                                    <Package size={20} strokeWidth={2.5} />
                                </div>
                                <h2 className="text-xl font-black text-slate-900 mb-1">ניהול מלאי</h2>
                                <p className="text-slate-500 text-sm leading-relaxed font-medium">
                                    ספירות מלאי והזמנות רכש
                                </p>
                            </div>
                        </button>
                    )}

                    {/* 5. Menu Editor */}
                    {isAppVisible('menu-editor') && (
                        <button
                            onClick={() => handleModeSelect('menu-editor')}
                            className="group relative bg-white rounded-2xl p-5 hover:bg-rose-50 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl text-right overflow-hidden border-2 border-transparent hover:border-rose-100"
                        >
                            <div className="absolute top-0 left-0 w-20 h-20 bg-rose-100 rounded-br-full -translate-x-5 -translate-y-5 group-hover:scale-110 transition-transform" />
                            <div className="relative z-10">
                                <div className="w-10 h-10 bg-rose-600 rounded-xl flex items-center justify-center text-white mb-3 shadow-lg group-hover:rotate-6 transition-transform">
                                    <Palette size={20} strokeWidth={2.5} />
                                </div>
                                <h2 className="text-xl font-black text-slate-900 mb-1">עריכת תפריט</h2>
                                <p className="text-slate-500 text-sm leading-relaxed font-medium">
                                    עדכון פריטים, מחירים ותמונות
                                </p>
                            </div>
                        </button>
                    )}

                    {/* 3b. Mobile KDS - HIDDEN REQUESTED */}
                    {/* <button
                        onClick={() => handleModeSelect('mobile-kds')}
                        className="md:hidden group relative bg-white rounded-2xl p-5 hover:bg-emerald-50 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl text-right overflow-hidden border-2 border-transparent hover:border-emerald-100"
                    >
                        <div className="absolute top-0 left-0 w-20 h-20 bg-emerald-100 rounded-br-full -translate-x-5 -translate-y-5 group-hover:scale-110 transition-transform" />
                        <div className="relative z-10">
                            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white mb-3 shadow-lg group-hover:rotate-6 transition-transform">
                                <ChefHat size={20} strokeWidth={2.5} />
                            </div>
                            <h2 className="text-xl font-black text-slate-900 mb-1">צפייה בהזמנות</h2>
                            <p className="text-slate-500 text-sm leading-relaxed font-medium">
                                מעקב הזמנות מהטלפון
                            </p>
                        </div>
                    </button> */}

                    {/* 4. Kanban - Order Management Board */}
                    {isAppVisible('kanban') && (
                        <button
                            onClick={() => handleModeSelect('kanban')}
                            className="hidden md:block group relative bg-white rounded-2xl p-5 hover:bg-teal-50 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl text-right overflow-hidden border-2 border-transparent hover:border-teal-100"
                        >
                            <div className="absolute top-3 left-3 bg-teal-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                                חדש
                            </div>
                            <div className="absolute top-0 left-0 w-20 h-20 bg-teal-100 rounded-br-full -translate-x-5 -translate-y-5 group-hover:scale-110 transition-transform" />
                            <div className="relative z-10">
                                <div className="w-10 h-10 bg-teal-600 rounded-xl flex items-center justify-center text-white mb-3 shadow-lg group-hover:rotate-6 transition-transform">
                                    <LayoutGrid size={20} strokeWidth={2.5} />
                                </div>
                                <h2 className="text-xl font-black text-slate-900 mb-1">קנבן הזמנות</h2>
                                <p className="text-slate-500 text-sm leading-relaxed font-medium">
                                    ניהול הזמנות ומשלוחים
                                </p>
                            </div>
                        </button>
                    )}

                    {/* 7. Owner Settings - Owner Only */}
                    {isOwner && isAppVisible('owner-settings') && (
                        <button
                            onClick={() => handleModeSelect('owner-settings')}
                            className="group relative bg-slate-800 rounded-2xl p-5 hover:bg-slate-700 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl text-right overflow-hidden border-2 border-transparent hover:border-yellow-500"
                        >
                            <div className="absolute top-3 left-3 bg-yellow-500 text-slate-900 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                                Owner
                            </div>
                            <div className="absolute top-0 left-0 w-20 h-20 bg-yellow-900/50 rounded-br-full -translate-x-5 -translate-y-5 group-hover:scale-110 transition-transform" />
                            <div className="relative z-10">
                                <div className="w-10 h-10 bg-yellow-500 rounded-xl flex items-center justify-center text-slate-900 mb-3 shadow-lg group-hover:rotate-6 transition-transform">
                                    <Settings size={20} strokeWidth={2.5} />
                                </div>
                                <h2 className="text-xl font-black text-white mb-1">הגדרות עסק</h2>
                                <p className="text-slate-400 text-sm leading-relaxed font-medium">
                                    ניהול חיבורים והגדרות ראשיות
                                </p>
                            </div>
                        </button>
                    )}

                    {/* 8. Menu Editor - Manager/Owner Only */}
                    {isManager && (
                        <button
                            onClick={() => {
                                setMode('manager');
                                navigate('/menu-editor');
                            }}
                            className="group relative bg-white rounded-2xl p-5 hover:bg-violet-50 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl text-right overflow-hidden border-2 border-transparent hover:border-violet-100"
                        >
                            {/* Decorative Background */}
                            <div className="absolute top-0 left-0 w-24 h-24 bg-violet-100 rounded-br-full -translate-x-6 -translate-y-6 group-hover:scale-110 transition-transform" />

                            <div className="relative z-10 flex flex-col items-end">
                                {/* Icon Container with Badge */}
                                <div className="relative mb-3 group-hover:rotate-6 transition-transform">
                                    <div className="w-12 h-12 bg-gradient-to-br from-violet-600 to-fuchsia-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                                        <Coffee size={24} strokeWidth={2.5} />
                                    </div>
                                    {/* Suspended Badge on Icon */}
                                    <div className="absolute -top-2 -right-2 bg-yellow-400 text-slate-900 text-[9px] font-black px-1.5 py-0.5 rounded shadow-sm z-20 border border-white/50">
                                        BETA
                                    </div>
                                </div>

                                <h2 className="text-xl font-black text-slate-900 mb-1">עריכת תפריט</h2>
                                <p className="text-slate-500 text-sm leading-relaxed font-medium">
                                    עריכת מנות ויצירת תמונות AI
                                </p>
                            </div>
                        </button>
                    )}

                    {/* 9. Video Creator - Super Admin Only */}
                    {user?.is_super_admin && (
                        <button
                            onClick={() => {
                                navigate('/video-creator');
                            }}
                            className="group relative bg-gradient-to-br from-purple-900 to-pink-900 rounded-2xl p-5 hover:from-purple-800 hover:to-pink-800 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl text-right overflow-hidden border-2 border-white/10 hover:border-white/30"
                        >
                            {/* Decorative Background */}
                            <div className="absolute top-0 left-0 w-24 h-24 bg-white/10 rounded-br-full -translate-x-6 -translate-y-6 group-hover:scale-110 transition-transform" />

                            {/* NEW Badge */}
                            <div className="absolute top-3 left-3 bg-pink-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                                חדש
                            </div>

                            <div className="relative z-10 flex flex-col items-end">
                                {/* Icon Container */}
                                <div className="relative mb-3 group-hover:rotate-6 transition-transform">
                                    <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-purple-500 rounded-xl flex items-center justify-center text-white shadow-lg">
                                        <Film size={24} strokeWidth={2.5} />
                                    </div>
                                </div>

                                <h2 className="text-xl font-black text-white mb-1">יצירת סרטון AI</h2>
                                <p className="text-white/80 text-sm leading-relaxed font-medium">
                                    צור סרטונים מדהימים עם Kling AI
                                </p>
                            </div>
                        </button>
                    )}

                    {/* 10. Ad Generator - Super Admin Only */}
                    {user?.is_super_admin && (
                        <button
                            onClick={() => {
                                navigate('/ad-generator');
                            }}
                            className="group relative bg-gradient-to-br from-indigo-900 to-purple-900 rounded-2xl p-5 hover:from-indigo-800 hover:to-purple-800 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl text-right overflow-hidden border-2 border-white/10 hover:border-white/30"
                        >
                            {/* Decorative Background */}
                            <div className="absolute top-0 left-0 w-24 h-24 bg-white/10 rounded-br-full -translate-x-6 -translate-y-6 group-hover:scale-110 transition-transform" />

                            {/* NEW Badge */}
                            <div className="absolute top-3 left-3 bg-indigo-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                                חדש
                            </div>

                            <div className="relative z-10 flex flex-col items-end">
                                {/* Icon Container */}
                                <div className="relative mb-3 group-hover:rotate-6 transition-transform">
                                    <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center text-white shadow-lg">
                                        <Palette size={24} strokeWidth={2.5} />
                                    </div>
                                </div>

                                <h2 className="text-xl font-black text-white mb-1">סטודיו פרסום</h2>
                                <p className="text-white/80 text-sm leading-relaxed font-medium">
                                    צור מודעות מקצועיות ברמת מוזיאון
                                </p>
                            </div>
                        </button>
                    )}

                    {/* 4b. Driver Screen - Only for drivers */}
                    {isDriver && isAppVisible('driver') && (
                        <button
                            onClick={() => handleModeSelect('driver')}
                            className="group relative bg-gray-800 rounded-2xl p-5 hover:bg-gray-700 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl text-right overflow-hidden border-2 border-transparent hover:border-purple-500"
                        >
                            <div className="absolute top-0 left-0 w-20 h-20 bg-purple-900/50 rounded-br-full -translate-x-5 -translate-y-5 group-hover:scale-110 transition-transform" />
                            <div className="relative z-10">
                                <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center text-white mb-3 shadow-lg group-hover:rotate-6 transition-transform">
                                    <Truck size={20} strokeWidth={2.5} />
                                </div>
                                <h2 className="text-xl font-black text-white mb-1">מסך נהג</h2>
                                <p className="text-slate-400 text-sm leading-relaxed font-medium">
                                    משלוחים מוכנים לאיסוף
                                </p>
                            </div>
                        </button>
                    )}

                    {/* 5. Advanced Data - Manager/Owner/Staff Only */}
                    {(isManager || isStaff) && (
                        <button
                            onClick={() => handleModeSelect('manager')}
                            className="hidden md:block group relative bg-white rounded-2xl p-5 hover:bg-cyan-50 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl text-right overflow-hidden border-2 border-transparent hover:border-cyan-100"
                        >
                            <div className="absolute top-0 left-0 w-20 h-20 bg-cyan-100 rounded-br-full -translate-x-5 -translate-y-5 group-hover:scale-110 transition-transform" />
                            <div className="relative z-10">
                                <div className="w-10 h-10 bg-cyan-500 rounded-xl flex items-center justify-center text-white mb-3 shadow-lg group-hover:rotate-6 transition-transform">
                                    <BarChart3 size={20} strokeWidth={2.5} />
                                </div>
                                <h2 className="text-xl font-black text-slate-900 mb-1">מידע מתקדם (קוקפיט)</h2>
                                <p className="text-slate-500 text-sm leading-relaxed font-medium">
                                    דוחות מכירות, רשימת הזמנות והגדרות
                                </p>
                            </div>
                        </button>
                    )}

                    {/* 6. Database Explorer - Admin/Owner Only */}
                    {(currentUser?.is_super_admin || currentUser?.role === 'admin' || isOwner) && (
                        <button
                            onClick={() => handleModeSelect('db-explorer')}
                            className="group relative bg-slate-800 rounded-2xl p-5 hover:bg-slate-700 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl text-right overflow-hidden border-2 border-transparent hover:border-purple-500"
                        >
                            <div className="absolute top-3 left-3 bg-purple-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                                Admin / Owner
                            </div>
                            <div className="absolute top-0 left-0 w-20 h-20 bg-purple-900/50 rounded-br-full -translate-x-5 -translate-y-5 group-hover:scale-110 transition-transform" />
                            <div className="relative z-10">
                                <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center text-white mb-3 shadow-lg group-hover:rotate-6 transition-transform">
                                    <BarChart3 size={20} strokeWidth={2.5} />
                                </div>
                                <h2 className="text-xl font-black text-white mb-1">בסיס נתונים</h2>
                                <p className="text-slate-400 text-sm leading-relaxed font-medium">
                                    צפייה בטבלאות ו-SQL
                                </p>
                            </div>
                        </button>
                    )}

                </div>

                <div className="mt-6 text-center flex flex-col items-center gap-2">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => {
                                if (currentUser?.is_impersonating) {
                                    // Impersonating - return to Super Admin Portal
                                    logout();
                                } else if (currentUser?.is_super_admin) {
                                    // Super Admin not impersonating - go to Super Admin Portal
                                    navigate('/super-admin');
                                } else {
                                    // Regular user - full logout
                                    logout();
                                }
                            }}
                            className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors px-4 py-2 rounded-lg hover:bg-white/10 text-sm"
                        >
                            <LogOut size={16} />
                            <span>{currentUser?.is_impersonating ? 'חזרה לפורטל הראשי' : 'יציאה'}</span>
                        </button>

                        {/* Super Admin Access Button (Bottom) */}
                        {(user?.is_super_admin || mayaAuth.employee?.isSuperAdmin || currentUser?.is_super_admin || currentUser?.user_metadata?.is_super_admin || localStorage.getItem('is_super_admin') === 'true') && (
                            <button
                                onClick={() => navigate('/super-admin')}
                                className="inline-flex items-center gap-2 text-pink-400 hover:text-pink-300 transition-colors px-4 py-2 rounded-lg hover:bg-pink-500/10 text-sm border border-pink-500/30"
                            >
                                <ShieldAlert size={16} />
                                <span>פורטל Super Admin</span>
                            </button>
                        )}

                        {/* 🗄️ Database Sync Shortcut - Super Admin only */}
                        {isSuperAdmin && (
                            <button
                                onClick={() => navigate('/super-admin/db')}
                                className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition-colors px-4 py-2 rounded-lg hover:bg-cyan-500/10 text-sm border border-cyan-500/30 font-bold"
                            >
                                <Database size={16} />
                                <span>סנכרון מסד נתונים</span>
                            </button>
                        )}

                        {/* Force Re-Login Button */}
                        <button
                            onClick={() => {
                                // Clear ALL cached auth data
                                localStorage.removeItem('kiosk_user');
                                localStorage.removeItem('kiosk_auth_time');
                                localStorage.removeItem('kiosk_mode');
                                localStorage.removeItem('business_id');
                                localStorage.removeItem('businessId');
                                localStorage.removeItem('business_name');
                                localStorage.removeItem('original_super_admin');
                                localStorage.removeItem('return_to_super_portal');
                                localStorage.removeItem('manager_auth_key');
                                localStorage.removeItem('manager_auth_time');
                                sessionStorage.clear();
                                // Redirect to login
                                window.location.href = '/login';
                            }}
                            className="inline-flex items-center gap-2 text-amber-400 hover:text-amber-300 transition-colors px-4 py-2 rounded-lg hover:bg-amber-500/10 text-sm border border-amber-500/30"
                        >
                            <Users size={16} />
                            <span>כניסה מחדש</span>
                        </button>
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono opacity-50">
                        v{appVersion}
                    </div>
                </div>
            </div>

            {/* What's New Modal - shows once per version after login (for all managers) */}
            {showWhatsNew && isManager && <WhatsNewModal onClose={() => setShowWhatsNew(false)} />}

            {/* 🚨 CRITICAL INTEGRATION FAILURE MODAL */}
            {integrationErrors && integrationErrors.length > 0 && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-sm p-4 animate-in fade-in duration-300">
                    <div className="bg-slate-800 border border-slate-700 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden">
                        <div className="p-6 bg-gradient-to-r from-red-900/40 to-slate-800 border-b border-white/5 flex items-center gap-4">
                            <div className="p-3 bg-red-500/20 rounded-2xl border border-red-500/30">
                                <ShieldAlert size={32} className="text-red-500 animate-pulse" />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-white">נדרשת פעולה: שגיאות מערכת</h3>
                                <p className="text-red-200 text-sm">נמצאו בעיות בחיבור לשירותים חיצוניים</p>
                            </div>
                        </div>

                        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                            {integrationErrors.map((err, idx) => (
                                <div key={idx} className="bg-slate-900/50 rounded-xl p-4 border border-white/5 flex items-start justify-between gap-4 group hover:border-red-500/30 transition-colors">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                                                {err.service}
                                            </span>
                                            <span className="text-white font-bold">שגיאת חיבור</span>
                                        </div>
                                        <p className="text-slate-400 text-sm font-mono break-all">{err.message}</p>
                                    </div>

                                    {err.dashboard && (
                                        <a
                                            href={err.dashboard}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-white hover:text-blue-400 transition-colors border border-white/5"
                                            title="פתח לוח בקרה"
                                        >
                                            <ExternalLink size={18} />
                                        </a>
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="p-6 bg-slate-900/30 border-t border-white/5 flex justify-between items-center">
                            <button
                                onClick={() => {
                                    localStorage.removeItem('failed_integrations');
                                    setIntegrationErrors(null);
                                    window.location.reload();
                                }}
                                className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white text-sm font-bold rounded-xl transition-all"
                            >
                                בדוק שוב (Reload)
                            </button>

                            <button
                                onClick={() => setIntegrationErrors(null)}
                                className="text-slate-500 hover:text-white text-sm underline underline-offset-4"
                            >
                                התעלם והמשך
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ModeSelectionScreen;
