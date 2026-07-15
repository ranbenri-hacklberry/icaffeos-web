import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Database, Building2, Shield, LogOut, LayoutDashboard, Search, ChevronRight, Activity, X, MessageSquare, Monitor, Terminal } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import SystemDiagnostics from '@/components/manager/SystemDiagnostics';
import SystemMap from '@/components/super-admin/SystemMap';
import BusinessNodeCard from '@/components/super-admin/BusinessNodeCard';
import CortexUserCard from '@/components/super-admin/CortexUserCard';

const SuperAdminPortal = () => {
    const navigate = useNavigate();
    const { switchBusinessContext, logout } = useAuth();
    const [view, setView] = useState('businesses'); // 'businesses' | 'users'
    const [businesses, setBusinesses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState([]);
    const [usersLoading, setUsersLoading] = useState(false);
    const [diagnosticsBusiness, setDiagnosticsBusiness] = useState(null);

    useEffect(() => {
        fetchBusinesses();
    }, []);

    useEffect(() => {
        if (view === 'users') {
            fetchUsers();
        }
    }, [view]);

    const fetchUsers = async () => {
        try {
            setUsersLoading(true);
            console.log('🔍 Fetching Cortex users with DNA...');

            // Fetch users with their business DNA
            const { data, error } = await supabase
                .from('employees')
                .select(`
                    *,
                    businesses (
                        name,
                        business_config (onboarding_dna)
                    )
                `)
                .order('name');

            if (error) throw error;

            const formattedUsers = data.map(u => ({
                ...u,
                business_name: u.businesses?.name,
                onboarding_dna: u.businesses?.business_config?.[0]?.onboarding_dna || 'V_GENERAL',
                // Simulated status for indicators
                llm_status: Math.random() > 0.1 ? 'online' : 'offline',
                persona_sync: Math.random() > 0.2 ? 'synced' : 'pending',
                context_size: '128k',
                api_key_tail: u.id.substring(0, 4)
            }));

            setUsers(formattedUsers);
        } catch (err) {
            console.error('❌ Error fetching users:', err);
        } finally {
            setUsersLoading(false);
        }
    };

    const fetchBusinesses = async () => {
        try {
            setLoading(true);
            console.log('🔍 Fetching businesses for Super Admin Portal...');

            // Use direct query - more reliable than RPC
            const { data: businessData, error: queryError } = await supabase
                .from('businesses')
                .select('id, name, created_at, settings')
                .order('created_at', { ascending: false });

            if (queryError) {
                console.error('❌ Business query error:', queryError);
                throw queryError;
            }

            console.log('✅ Fetched businesses:', businessData?.length || 0);

            if (businessData && businessData.length > 0) {
                setBusinesses(businessData.map(b => ({
                    ...b,
                    is_online: false,
                    active_orders_count: 0
                })));
            } else {
                console.warn('⚠️ No businesses found in database');
                setBusinesses([]);
            }
        } catch (err) {
            console.error('❌ Error fetching businesses:', err);
            setBusinesses([]);
        } finally {
            setLoading(false);
        }
    };

    const handleBusinessClick = (business) => {
        console.log('🚀 Impersonating business as Super Admin:', business.name);
        switchBusinessContext(business.id, business.name);
        // Navigate to Mode Selection of that business, NOT manager dashboard directly
        navigate('/mode-selection');
    };

    const mainOptions = [
        {
            title: 'דשבורד עסקים',
            subtitle: 'ניהול והוספת צמתים',
            icon: <Building2 size={32} className={view === 'businesses' ? "text-blue-400" : "text-slate-500"} />,
            onClick: () => setView('businesses'),
            active: view === 'businesses',
            color: view === 'businesses' ? 'from-blue-600/30 to-blue-900/50' : 'from-slate-800/20 to-slate-900/40',
            borderColor: view === 'businesses' ? 'border-blue-500/50' : 'border-slate-800'
        },
        {
            title: 'משתמשי Cortex',
            subtitle: 'ניטור סוכנים וזהויות',
            icon: <Monitor size={32} className={view === 'users' ? "text-indigo-400" : "text-slate-500"} />,
            onClick: () => setView('users'),
            active: view === 'users',
            color: view === 'users' ? 'from-indigo-600/30 to-indigo-900/50' : 'from-slate-800/20 to-slate-900/40',
            borderColor: view === 'users' ? 'border-indigo-500/50' : 'border-slate-800'
        },
        {
            title: 'סייר כלי פיתוח',
            subtitle: 'DB, SMS ו-Logs',
            icon: <Terminal size={32} className="text-emerald-400" />,
            onClick: () => navigate('/super-admin/db'),
            color: 'from-emerald-600/20 to-emerald-900/40',
            borderColor: 'border-emerald-500/30'
        }
    ];

    // Grouping users by DNA
    const groupedUsers = users.reduce((acc, user) => {
        const dna = user.onboarding_dna || 'V_GENERAL';
        if (!acc[dna]) acc[dna] = [];
        acc[dna].push(user);
        return acc;
    }, {});

    const dnaLabels = {
        'V_01': 'IT Labs & Support',
        'V_02': 'Law Firms & Legal',
        'V_03': 'Retail & Gastronomy',
        'V_GENERAL': 'General Enterprise'
    };

    return (
        <div className="min-h-screen bg-slate-950 text-white font-heebo p-6 flex flex-col items-center overflow-auto custom-scrollbar" dir="rtl">
            {/* Background Decorations */}
            <div className="fixed top-0 right-0 w-96 h-96 bg-blue-600/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none"></div>
            <div className="fixed bottom-0 left-0 w-96 h-96 bg-purple-600/5 rounded-full blur-3xl -ml-32 -mb-32 pointer-events-none"></div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative z-10 w-full max-w-6xl mb-8 flex flex-col md:flex-row items-center justify-between gap-6"
            >
                <div className="text-center md:text-right">
                    <div className="inline-flex items-center gap-3 mb-2">
                        <div className="p-2 bg-red-500/20 rounded-xl ring-1 ring-red-500/30 shadow-lg shadow-red-500/10">
                            <Shield className="text-red-500 w-6 h-6" strokeWidth={2.5} />
                        </div>
                        <h1 className="text-3xl md:text-4xl font-black tracking-tight">
                            Super <span className="text-blue-500">Admin</span> Portal
                        </h1>
                    </div>
                    <p className="text-slate-400 text-sm font-medium pr-1">ניהול מערכת Cortex | {view === 'businesses' ? 'תשתית צמתים' : 'ניטור משתמשים'}</p>
                </div>

                <button
                    onClick={logout}
                    className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all font-bold active:scale-95 text-sm"
                >
                    <LogOut size={16} />
                    <span>יציאה</span>
                </button>
            </motion.div>

            {/* Main Options Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-6xl relative z-10 mb-8">
                {mainOptions.map((item, idx) => (
                    <motion.button
                        key={idx}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.1 }}
                        onClick={item.onClick}
                        className={`group relative p-6 bg-gradient-to-br ${item.color} rounded-2xl border ${item.borderColor} backdrop-blur-sm hover:translate-y-[-2px] hover:shadow-xl transition-all duration-300 text-right overflow-hidden ${item.active ? 'ring-2 ring-white/10' : ''}`}
                    >
                        <div className="absolute top-0 left-0 w-24 h-24 bg-white/5 rounded-br-[3rem] -translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform duration-500 blur-xl opacity-30"></div>

                        <div className="relative z-10 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-slate-900/60 rounded-xl flex items-center justify-center shadow-inner ring-1 ring-white/10">
                                    {item.icon}
                                </div>
                                <div>
                                    <h2 className={`text-xl font-black transition-colors ${item.active ? 'text-white' : 'text-slate-300'}`}>
                                        {item.title}
                                    </h2>
                                    <p className="text-slate-400 text-sm font-medium opacity-80">
                                        {item.subtitle}
                                    </p>
                                </div>
                            </div>
                            <ChevronRight className={`w-5 h-5 transition-all ${item.active ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2'}`} />
                        </div>
                    </motion.button>
                ))}
            </div>

            {/* Content Section */}
            <div className="w-full max-w-6xl relative z-10 mb-12">
                {view === 'businesses' ? (
                    <>
                        <div className="flex items-center gap-3 mb-6">
                            <Activity className="text-blue-400" size={20} />
                            <h2 className="text-xl font-bold text-slate-200">צמתים פעילים וניהול עסקים ({businesses.length})</h2>
                            <div className="h-px bg-slate-800 flex-1 ml-4"></div>
                        </div>

                        {loading ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {[1, 2, 3, 4].map(i => (
                                    <div key={i} className="h-48 bg-slate-900/50 rounded-2xl animate-pulse border border-slate-800/50"></div>
                                ))}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {businesses.map((business) => (
                                    <BusinessNodeCard
                                        key={business.id}
                                        business={business}
                                        onClick={handleBusinessClick}
                                        onDiagnostics={setDiagnosticsBusiness}
                                    />
                                ))}
                            </div>
                        )}
                    </>
                ) : (
                    <div className="space-y-12">
                        {Object.entries(groupedUsers).map(([dna, dnaUsers]) => (
                            <div key={dna} className="space-y-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-indigo-500/20 rounded-lg border border-indigo-500/30">
                                        <Database size={18} className="text-indigo-400" />
                                    </div>
                                    <h2 className="text-xl font-black text-white">
                                        {dnaLabels[dna] || dna} <span className="text-indigo-500 text-sm font-bold mr-2 opacity-60">({dnaUsers.length} Users)</span>
                                    </h2>
                                    <div className="h-px bg-slate-800 flex-1 ml-4"></div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {dnaUsers.map((user) => (
                                        <CortexUserCard
                                            key={user.id}
                                            user={user}
                                            businessDna={dna}
                                            onClick={() => { }}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* SYSTEM DIRECTORY (NEW) */}
            <div className="w-full max-w-6xl relative z-0 mt-12 mb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <SystemMap />
            </div>

            {/* DIAGNOSTICS MODAL */}
            {diagnosticsBusiness && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-slate-900 border border-slate-700 w-full max-w-6xl h-[85vh] rounded-3xl overflow-hidden shadow-2xl relative"
                    >
                        <button
                            onClick={() => setDiagnosticsBusiness(null)}
                            className="absolute top-4 left-4 z-50 p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white hover:bg-slate-700 border border-slate-700"
                        >
                            <X size={24} />
                        </button>
                        <div className="h-full overflow-hidden">
                            <SystemDiagnostics businessId={diagnosticsBusiness.id} />
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
};

export default SuperAdminPortal;
