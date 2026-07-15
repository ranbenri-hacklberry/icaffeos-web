import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { BadgeCheck, HardDrive, ArrowRight, CheckCircle, Loader2, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
// Temporarily removed react-i18next due to UI freezing issues
import GoogleConnectButton from '@/components/GoogleConnectButton';
import AccountantAccess from '@/components/settings/AccountantAccess';
import WhatsAppConnect from '@/components/settings/WhatsAppConnect';
import ApiValidationSettings from '@/components/settings/ApiValidationSettings';
import SecuritySettings from '@/components/settings/SecuritySettings';

const OwnerSettings = () => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    // Removed: const { t, i18n } = useTranslation();

    const t = (key) => {
        const translations = {
            'title': 'הגדרות בעלים (Owner)',
            'subtitle': 'ניהול חיבורים ושירותים רגישים',
            'geminiSaveSuccess': '✅ מפתח Gemini נשמר בהצלחה!',
            'grokSaveSuccess': '✅ מפתח Grok נשמר בהצלחה!',
            'saveError': '❌ שגיאה בשמירת המפתח',
            'comingSoon': 'בקרוב',
            'language': 'שפה'
        };
        return translations[key] || key;
    };

    const [googleStatus, setGoogleStatus] = useState('loading'); // loading, connected, disconnected
    const [geminiKey, setGeminiKey] = useState(''); // For new input only
    const [grokKey, setGrokKey] = useState(''); // For new input only
    const [hasGeminiKey, setHasGeminiKey] = useState(false); // Indicates if key exists (secure)
    const [hasGrokKey, setHasGrokKey] = useState(false); // Indicates if key exists (secure)
    const [isSavingGemini, setIsSavingGemini] = useState(false);
    const [isSavingGrok, setIsSavingGrok] = useState(false);
    const [folderId, setFolderId] = useState(null);
    const [currentLanguage, setCurrentLanguage] = useState('he');

    useEffect(() => {
        const fetchData = async () => {
            if (!currentUser?.business_id) return;

            // Fetch Google connection status
            // Note: We only check IF keys exist, not the actual values (security!)
            try {
                // 🔒 REFACTORED: Check Google status from businesses + key existence from business_secrets
                const { data: bizData, error: bizError } = await supabase
                    .from('businesses')
                    .select('is_google_connected, language')
                    .eq('id', currentUser.business_id)
                    .single();

                if (bizError) throw bizError;
                setGoogleStatus(bizData?.is_google_connected ? 'connected' : 'disconnected');

                // Set current language from business config
                if (bizData?.language) {
                    setCurrentLanguage(bizData.language);
                }

                // Check key existence from business_secrets (RLS-protected)
                const { data: secretsData } = await supabase
                    .from('business_secrets')
                    .select('gemini_api_key, grok_api_key')
                    .eq('business_id', currentUser.business_id)
                    .single();

                // Only set boolean flags - don't expose actual keys to browser!
                setHasGeminiKey(!!secretsData?.gemini_api_key);
                setHasGrokKey(!!secretsData?.grok_api_key);
            } catch (err) {
                console.error('Error fetching settings:', err);
                setGoogleStatus('disconnected');
            }
        };

        fetchData();
    }, [currentUser?.business_id]);

    const handleSaveGemini = async () => {
        if (!currentUser?.business_id || !geminiKey) return;
        setIsSavingGemini(true);
        try {
            // 🔒 REFACTORED: Save to business_secrets via RPC
            const { error } = await supabase.rpc('upsert_business_secret', {
                p_business_id: currentUser.business_id,
                p_field: 'gemini_api_key',
                p_value: geminiKey
            });

            if (error) throw error;
            alert(t('geminiSaveSuccess'));
            setHasGeminiKey(true);
            setGeminiKey(''); // Clear input - don't keep key in browser memory!
        } catch (err) {
            console.error('Error saving Gemini key:', err);
            alert(t('saveError'));
        } finally {
            setIsSavingGemini(false);
        }
    };

    const handleSaveGrok = async () => {
        if (!currentUser?.business_id || !grokKey) return;
        setIsSavingGrok(true);
        try {
            // 🔒 REFACTORED: Save to business_secrets via RPC
            const { error } = await supabase.rpc('upsert_business_secret', {
                p_business_id: currentUser.business_id,
                p_field: 'grok_api_key',
                p_value: grokKey
            });

            if (error) throw error;
            alert(t('grokSaveSuccess'));
            setHasGrokKey(true);
            setGrokKey(''); // Clear input - don't keep key in browser memory!
        } catch (err) {
            console.error('Error saving Grok key:', err);
            alert(t('saveError'));
        } finally {
            setIsSavingGrok(false);
        }
    };

    const handleLanguageChange = async (language) => {
        try {
            // Save language preference to business_config table
            const { error } = await supabase
                .from('businesses')
                .update({ language })
                .eq('id', currentUser.business_id);

            if (error) throw error;

            setCurrentLanguage(language);
        } catch (err) {
            console.error('Error saving language preference:', err);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 p-6 font-heebo" dir="rtl">
            <div className="max-w-4xl mx-auto space-y-8">

                {/* Header with Back Button */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/mode-selection')}
                            className="p-2 hover:bg-white/10 rounded-full text-white transition-colors"
                        >
                            <ArrowRight size={24} />
                        </button>
                        <div>
                            <h1 className="text-3xl font-black text-white mb-1">{t('title')}</h1>
                            <p className="text-slate-400 text-lg">{t('subtitle')}</p>
                        </div>
                    </div>

                    {/* Language Selection Dropdown */}
                    <div className="flex items-center gap-2">
                        <label className="text-white text-sm">{t('language')}:</label>
                        <select
                            value={currentLanguage}
                            onChange={(e) => handleLanguageChange(e.target.value)}
                            className="bg-slate-800 border border-slate-600 text-white px-3 py-1 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="he">עברית</option>
                            <option value="en">English</option>
                        </select>
                    </div>
                </div>

                {/* Unified API Key Management */}
                <ApiValidationSettings />

                {/* Security and Face Recognition Settings */}
                <SecuritySettings businessId={currentUser?.business_id} />

                {/* WhatsApp Integration Card */}
                <WhatsAppConnect />

                {/* Google Integration Card */}
                <motion.div>
                    {/* ... existing card content ... */}
                </motion.div>

                {/* Accountant Access - Only show if connected */}
                {googleStatus === 'connected' && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                    >
                        <AccountantAccess />
                    </motion.div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Onboarding Wizard Entry */}
                    <div
                        onClick={() => navigate('/onboarding')}
                        className="bg-gradient-to-br from-indigo-900/50 to-purple-900/50 rounded-xl border border-indigo-500/50 p-6 flex items-center justify-between cursor-pointer hover:scale-[1.02] transition-transform group"
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-indigo-500/20 text-indigo-400 rounded-lg group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                                <Sparkles size={24} />
                            </div>
                            <div>
                                <h3 className="text-white font-bold text-lg">Magic Menu Wizard</h3>
                                <p className="text-indigo-200/60 text-sm">Launch AI Onboarding</p>
                            </div>
                        </div>
                        <ArrowRight className="text-indigo-400 group-hover:translate-x-1 transition-transform" />
                    </div>

                    <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 flex items-center justify-between opacity-40 grayscale pointer-events-none">
                        <span className="text-white font-medium">Wolt Integration</span>
                        <span className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded">{t('comingSoon')}</span>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default OwnerSettings;
