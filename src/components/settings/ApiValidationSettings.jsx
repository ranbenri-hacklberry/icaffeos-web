import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Eye, EyeOff, Copy, Check, Lock, Loader2, Key, Edit2, ExternalLink, AlertTriangle, DollarSign, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

const maskKey = (key) => {
    if (!key || key.length < 8) return key;
    const firstPart = key.substring(0, 6);
    const lastPart = key.substring(key.length - 4);
    const middle = '•'.repeat(Math.min(key.length - 10, 20));
    return `${firstPart}${middle}${lastPart}`;
};

const ApiKeyField = ({
    label,
    fieldKey,
    value,
    onChange,
    onSave,
    placeholder,
    description,
    linkText,
    linkUrl,
    pricingUrl,
    costInfo,
    availability,
    optional = false
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [isCopied, setIsCopied] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const saveTimeoutRef = useRef(null);

    const handleCopy = () => {
        if (!value) return;
        navigator.clipboard.writeText(value);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    const handleFinishEditing = async () => {
        setIsEditing(false);
        if (onSave && value) {
            setIsSaving(true);
            await onSave(fieldKey, value);
            setIsSaving(false);
        }
    };

    const displayValue = !isEditing && value ? maskKey(value) : value;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-slate-900/50 p-6 rounded-2xl border border-slate-700/50 hover:border-blue-500/30 transition-all space-y-4"
        >
            {/* Header */}
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                        <Key size={18} className="text-blue-400" />
                        <h3 className="text-lg font-bold text-white">
                            {label}
                            {optional && <span className="text-sm text-slate-500 mr-2">(אופציונלי)</span>}
                        </h3>
                    </div>
                    <p className="text-slate-400 text-sm leading-relaxed mb-3">{description}</p>
                </div>
            </div>

            {/* Links */}
            <div className="flex flex-wrap gap-4">
                {linkUrl && (
                    <a
                        href={linkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors group"
                    >
                        <ExternalLink size={14} className="group-hover:translate-x-0.5 transition-transform" />
                        {linkText}
                    </a>
                )}
                {pricingUrl && (
                    <a
                        href={pricingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 text-sm font-medium transition-colors group"
                    >
                        <DollarSign size={14} className="group-hover:translate-x-0.5 transition-transform" />
                        מחירון מלא
                    </a>
                )}
            </div>

            {/* Cost Info */}
            {costInfo && (
                <div className="flex items-start gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
                    <DollarSign size={16} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                    <p className="text-emerald-300 text-sm">{costInfo}</p>
                </div>
            )}

            {/* Availability Warning */}
            {availability && (
                <div className="flex items-start gap-2 bg-orange-500/10 border border-orange-500/20 rounded-lg p-3">
                    <AlertTriangle size={16} className="text-orange-400 mt-0.5 flex-shrink-0" />
                    <p className="text-orange-300 text-sm">{availability}</p>
                </div>
            )}

            {/* Key Input */}
            <div className="flex gap-3 items-center">
                <div className="relative flex-1">
                    <input
                        type={isEditing ? "text" : "password"}
                        value={displayValue || ''}
                        onChange={(e) => onChange(fieldKey, e.target.value)}
                        placeholder={placeholder || "הזן מפתח API..."}
                        disabled={!isEditing}
                        className={`w-full bg-slate-950/80 text-white px-4 py-3.5 rounded-xl border transition-all font-mono text-sm tracking-wide ${isEditing
                            ? 'border-blue-500/50 ring-2 ring-blue-500/20'
                            : 'border-slate-800 cursor-default'
                            } ${!isEditing && value ? 'text-slate-300' : ''} outline-none`}
                        dir="ltr"
                        autoComplete="off"
                    />
                </div>

                {/* Edit/Save Button */}
                <button
                    type="button"
                    onClick={() => isEditing ? handleFinishEditing() : setIsEditing(true)}
                    disabled={isSaving}
                    className={`p-3.5 rounded-xl border transition-all active:scale-95 w-14 flex items-center justify-center ${isEditing
                        ? 'bg-green-500/20 border-green-500/50 text-green-400 hover:bg-green-500/30'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border-slate-700 hover:border-slate-600'
                        } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
                    title={isEditing ? "שמור שינויים" : "ערוך מפתח"}
                >
                    {isSaving ? (
                        <Loader2 size={20} className="animate-spin" />
                    ) : isEditing ? (
                        <CheckCircle2 size={20} />
                    ) : (
                        <Edit2 size={20} />
                    )}
                </button>

                {/* Copy Button */}
                <button
                    type="button"
                    onClick={handleCopy}
                    disabled={!value}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white p-3.5 rounded-xl border border-slate-700 hover:border-slate-600 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed w-14 flex items-center justify-center"
                    title="העתק מפתח"
                >
                    <AnimatePresence mode='wait'>
                        {isCopied ? (
                            <motion.div
                                key="check"
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                exit={{ scale: 0 }}
                            >
                                <Check size={20} className="text-green-400" />
                            </motion.div>
                        ) : (
                            <motion.div
                                key="copy"
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                exit={{ scale: 0 }}
                            >
                                <Copy size={20} />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </button>
            </div>
        </motion.div>
    );
};

export default function ApiValidationSettings() {
    const { currentUser } = useAuth();
    const [keys, setKeys] = useState({
        gemini_api_key: '',
        grok_api_key: '',
        claude_api_key: '',
        kling_access_key: '',
        kling_secret_key: '',
        global_sms_api_key: '',
        whatsapp_api_key: '',
        youtube_api_key: ''
    });
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState(null);
    const [isTestingYouTube, setIsTestingYouTube] = useState(false);

    useEffect(() => {
        if (currentUser?.business_id) {
            fetchKeys();
        }
    }, [currentUser?.business_id]);

    const fetchKeys = async () => {
        try {
            // 🔒 REFACTORED: Fetch from business_secrets table (governed by RLS)
            const { data, error } = await supabase
                .from('business_secrets')
                .select('gemini_api_key, grok_api_key, claude_api_key, kling_access_key, kling_secret_key, global_sms_api_key, whatsapp_api_key, youtube_api_key')
                .eq('business_id', currentUser.business_id)
                .single();

            if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows (OK for new business)
            if (data) setKeys(prev => ({ ...prev, ...data }));
        } catch (err) {
            console.error('Error fetching keys:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (field, value) => {
        // Special handling for Kling keys - detect if both keys are pasted together
        if (field === 'kling_access_key' || field === 'kling_secret_key') {
            // Check if the pasted value contains both Access Key and Secret Key
            const accessKeyMatch = value.match(/Access Key:\s*([A-Za-z0-9._-]+)/i);
            const secretKeyMatch = value.match(/Secret Key:\s*([A-Za-z0-9._-]+)/i);

            if (accessKeyMatch && secretKeyMatch) {
                // Both keys found in the pasted text - split them!
                console.log('🎯 Detected both Kling keys in paste, splitting automatically...');
                setKeys(prev => ({
                    ...prev,
                    kling_access_key: accessKeyMatch[1].trim(),
                    kling_secret_key: secretKeyMatch[1].trim()
                }));
                setMessage({ type: 'success', text: 'שני מפתחות Kling זוהו והופרדו אוטומטית! ✨' });
                setTimeout(() => setMessage(null), 3000);
                return;
            }
        }

        // Normal handling for all other cases
        setKeys(prev => ({ ...prev, [field]: value }));
    };

    const handleFieldSave = async (field, value) => {
        try {
            // 🔒 REFACTORED: Save to business_secrets via upsert_business_secret RPC
            const { error } = await supabase.rpc('upsert_business_secret', {
                p_business_id: currentUser.business_id,
                p_field: field,
                p_value: value
            });

            if (error) throw error;

            setMessage({ type: 'success', text: `${field} נשמר בהצלחה` });
            setTimeout(() => setMessage(null), 2000);
        } catch (err) {
            console.error('Error saving field:', err);
            setMessage({ type: 'error', text: 'שגיאה בשמירת המפתח' });
        }
    };

    const handleTestYouTube = async () => {
        if (!keys.youtube_api_key) return;

        setIsTestingYouTube(true);
        setMessage(null);

        try {
            if (!window.electron?.youtube?.testApiKey) {
                throw new Error('Electron API not available');
            }

            const result = await window.electron.youtube.testApiKey(keys.youtube_api_key);

            if (result.success) {
                setMessage({ type: 'success', text: 'חיבור ל-YouTube עבר בהצלחה! ✅' });
            } else {
                // Distinguish errors
                let msg = 'שגיאה בחיבור ל-YouTube';
                if (result.errorType === 'QUOTA') msg = 'המכסה היומית נגמרה (Quota Exceeded) ⚠️';
                else if (result.errorType === 'AUTH') msg = 'מפתח API שגוי או לא פעיל ❌';
                else if (result.errorType === 'NETWORK') msg = 'שגיאת רשת - בדוק חיבור אינטרנט 🌐';
                else msg = `שגיאה: ${result.message}`;

                setMessage({ type: 'error', text: msg });
            }
        } catch (err) {
            console.error('Test failed:', err);
            setMessage({ type: 'error', text: 'שגיאה בבדיקת החיבור' });
        } finally {
            setIsTestingYouTube(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12 min-h-[400px]">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-5xl mx-auto"
        >
            <div className="bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-800 p-8 md:p-10">
                <div className="flex items-center justify-between mb-10 pb-6 border-b border-slate-800">
                    <div className="flex items-center gap-5">
                        <div className="p-4 bg-blue-500/10 rounded-2xl border border-blue-500/20 text-blue-400 shadow-lg shadow-blue-500/5">
                            <Lock className="w-8 h-8" />
                        </div>
                        <div>
                            <h2 className="text-3xl font-bold text-white mb-2">מפתחות API ומערכת</h2>
                            <p className="text-slate-400 text-base">נהל את הגישה לשירותים חיצוניים (AI, SMS, WhatsApp) בצורה מאובטחת</p>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <ApiKeyField
                        label="Gemini API Key (Google)"
                        fieldKey="gemini_api_key"
                        value={keys.gemini_api_key}
                        onChange={handleChange}
                        onSave={handleFieldSave}
                        placeholder="AIza..."
                        description="מפתח Google Gemini משמש להפעלת Maya - העוזרת הדיגיטלית המבוססת בינה מלאכותית. Maya יכולה לנהל צ'אטים עם לקוחות, לבנות אפליקציות פשוטות, ליצור תמונות ווידאו, ולתת תובנות עסקיות חכמות."
                        linkText="קבל מפתח API חינם מ-Google AI Studio"
                        linkUrl="https://aistudio.google.com/app/apikey"
                        pricingUrl="https://ai.google.dev/pricing"
                        costInfo="מכסה חינמית: 60 בקשות לדקה (1,500 ליום). טקסט: $0.075/$0.30 למיליון tokens. תמונות: $0.00025 לתמונה. וידאו: $0.0002 לשנייה."
                    />

                    <ApiKeyField
                        label="Claude API Key (Anthropic)"
                        fieldKey="claude_api_key"
                        value={keys.claude_api_key}
                        onChange={handleChange}
                        onSave={handleFieldSave}
                        placeholder="sk-ant-..."
                        description="מפתח Claude API מ-Anthropic - מודל ה-AI המתקדם ביותר לשיחות מורכבות, כתיבה יצירתית, ניתוח מסמכים, וקידוד. Claude מצטיין בהבנת הקשר ובמשימות שדורשות חשיבה מעמיקה."
                        linkText="קבל מפתח API מ-Anthropic Console"
                        linkUrl="https://console.anthropic.com/"
                        pricingUrl="https://www.anthropic.com/api"
                        costInfo="Claude Haiku: $0.25/$1.25 למיליון tokens. Claude Sonnet: $3/$15 למיליון tokens. Claude Opus: $15/$75 למיליון tokens. תמיכה בתמונות, מסמכים, וניתוח קוד."
                    />

                    <ApiKeyField
                        label="Grok API Key (xAI)"
                        fieldKey="grok_api_key"
                        value={keys.grok_api_key}
                        onChange={handleChange}
                        onSave={handleFieldSave}
                        placeholder="xai-..."
                        description="מפתח xAI Grok משמש כגיבוי חכם למודלי AI אחרים. Grok מצטיין בניתוח נתונים בזמן אמת, הבנת טרנדים עסקיים, ומתן תובנות מבוססות מידע עדכני מהאינטרנט."
                        linkText="קבל מפתח API מ-xAI Console"
                        linkUrl="https://console.x.ai/"
                        pricingUrl="https://docs.x.ai/docs/overview#pricing"
                        costInfo="Grok Beta: $5 למיליון tokens קלט, $15 למיליון tokens פלט. גישה לנתונים בזמן אמת מ-X/Twitter."
                        availability="שים לב: שירות xAI עדיין בשלבי Beta ולא תמיד זמין לכולם. ייתכנו רשימות המתנה."
                    />

                    <ApiKeyField
                        label="Kling Access Key"
                        fieldKey="kling_access_key"
                        value={keys.kling_access_key}
                        onChange={handleChange}
                        onSave={handleFieldSave}
                        placeholder="AQE...BgMY"
                        description="Access Key של Kling AI - נדרש יחד עם Secret Key ליצירת סרטונים מתקדמים מטקסט."
                        linkText="הירשם ל-Kling AI"
                        linkUrl="https://klingai.com/"
                        pricingUrl="https://klingai.com/pricing"
                        costInfo="תוכנית חינמית: 66 קרדיטים ליום. Standard: $8/חודש (660 קרדיטים). Pro: $28/חודש (3,300 קרדיטים). וידאו 5 שניות = 10 קרדיטים."
                        optional={true}
                    />

                    <ApiKeyField
                        label="Kling Secret Key"
                        fieldKey="kling_secret_key"
                        value={keys.kling_secret_key}
                        onChange={handleChange}
                        onSave={handleFieldSave}
                        placeholder="GN...NP"
                        description="Secret Key של Kling AI - נדרש יחד עם Access Key. מושלם ליצירת תוכן שיווקי, הדמיות מוצר, וסרטוני פרסום מקצועיים."
                        linkText="הירשם ל-Kling AI"
                        linkUrl="https://klingai.com/"
                        optional={true}
                    />

                    <ApiKeyField
                        label="Global SMS API Key"
                        fieldKey="global_sms_api_key"
                        value={keys.global_sms_api_key}
                        onChange={handleChange}
                        onSave={handleFieldSave}
                        placeholder="מפתח ספק SMS..."
                        description="מפתח SMS משמש לשליחת התראות והודעות ללקוחות - אישורי הזמנה, קודי אימות, עדכוני סטטוס. חיוני לתקשורת אוטומטית עם לקוחות."
                        linkText="הירשם ל-Global SMS (או ספק SMS ישראלי אחר)"
                        linkUrl="https://www.globalsms.co.il/"
                        pricingUrl="https://www.globalsms.co.il/pricing"
                        costInfo="עלות משתנה לפי ספק - בדרך כלל 0.15-0.40 ₪ להודעה. בדוק חבילות מנוי לחיסכון."
                    />

                    <ApiKeyField
                        label="WhatsApp Cloud API Key"
                        fieldKey="whatsapp_api_key"
                        value={keys.whatsapp_api_key}
                        onChange={handleChange}
                        onSave={handleFieldSave}
                        placeholder="לשימוש ב-Cloud API בלבד"
                        description="מפתח WhatsApp Cloud API מאפשר שליחת הודעות ישירות ב-WhatsApp ללקוחות. אופציונלי - רק אם בחרת בגישת Cloud API במקום WhatsApp Web סטנדרטי."
                        linkText="הגדר WhatsApp Business API דרך Meta"
                        linkUrl="https://business.facebook.com/latest/whatsapp_manager"
                        pricingUrl="https://developers.facebook.com/docs/whatsapp/pricing"
                        costInfo="1,000 השיחות הראשונות בחודש חינם, אחר כך ~$0.005-0.09 להודעה (משתנה לפי מדינה)."
                        optional={true}
                    />
                </div>

                {/* Media Services Section */}
                <div className="mt-12 mb-6 pb-4 border-b border-slate-800">
                    <h3 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-red-500/20 text-red-500 flex items-center justify-center">
                            <span className="text-xs font-black">YT</span>
                        </div>
                        שירותי מדיה (מוזיקה ווידאו)
                    </h3>
                    <p className="text-slate-400 text-sm">הגדרות עבור נגן המוזיקה החכם והורדת תכנים</p>
                </div>

                <div className="space-y-6">
                    <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-700/50 hover:border-red-500/30 transition-all space-y-4">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="text-lg font-bold text-white mb-1">YouTube Data API Key</h3>
                                <p className="text-slate-400 text-sm leading-relaxed mb-3">
                                    נדרש עבור החיפוש החכם בנגן המוזיקה ("Smart Search") וניהול מכסות.
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <a
                                    href="https://console.cloud.google.com/apis/credentials"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg border border-slate-700 transition-colors"
                                >
                                    השג מפתח
                                </a>
                            </div>
                        </div>

                        <div className="flex gap-3 items-center">
                            <div className="relative flex-1">
                                <input
                                    type="text"
                                    value={keys.youtube_api_key || ''}
                                    onChange={(e) => handleChange('youtube_api_key', e.target.value)}
                                    placeholder="AIza..."
                                    className="w-full bg-slate-950/80 text-white px-4 py-3.5 rounded-xl border border-slate-800 focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20 transition-all font-mono text-sm tracking-wide outline-none"
                                    dir="ltr"
                                />
                            </div>
                            <button
                                onClick={() => handleFieldSave('youtube_api_key', keys.youtube_api_key)}
                                className="bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white p-3.5 rounded-xl border border-slate-700 transition-all active:scale-95"
                                title="שמור מפתח"
                            >
                                <Check size={20} />
                            </button>
                            <button
                                onClick={handleTestYouTube}
                                disabled={!keys.youtube_api_key || isTestingYouTube}
                                className="bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-3.5 rounded-xl font-medium transition-all active:scale-95 flex items-center gap-2"
                            >
                                {isTestingYouTube ? <Loader2 size={18} className="animate-spin" /> : 'בדוק חיבור'}
                            </button>
                        </div>

                        <div className="flex items-start gap-2 bg-slate-800/50 border border-slate-700 rounded-lg p-3">
                            <AlertTriangle size={16} className="text-yellow-500 mt-0.5 flex-shrink-0" />
                            <p className="text-slate-400 text-xs">
                                המערכת מוגבלת ל-9,000 יחידות ליום. במידה והמכסה תגמר, החיפוש יעבור למצב "Offline" באופן אוטומטי עד לחצות.
                            </p>
                        </div>
                    </div>
                </div>

                <AnimatePresence>
                    {message && (
                        <motion.div
                            initial={{ opacity: 0, height: 0, marginTop: 0 }}
                            animate={{ opacity: 1, height: 'auto', marginTop: 32 }}
                            exit={{ opacity: 0, height: 0, marginTop: 0 }}
                            className={`p-4 rounded-xl flex items-center justify-center gap-3 overflow-hidden ${message.type === 'success'
                                ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                                : 'bg-red-500/10 text-red-400 border border-red-500/20'
                                }`}
                        >
                            {message.type === 'success' ? <Check size={20} /> : <EyeOff size={20} />}
                            <span className="font-medium text-lg">{message.text}</span>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
}
