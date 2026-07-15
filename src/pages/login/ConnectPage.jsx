import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Wifi, ShieldCheck, Server, Sparkles, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

const ConnectPage = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState('processing'); // 'processing' | 'success' | 'error'
    const [errorMsg, setErrorMsg] = useState('');
    const [configData, setConfigData] = useState(null);

    useEffect(() => {
        const tenantId = searchParams.get('tenant_id');
        const localUrl = searchParams.get('local_url');
        const remoteUrl = searchParams.get('remote_url');

        if (!tenantId || !localUrl || !remoteUrl) {
            setStatus('error');
            setErrorMsg('נתוני הגדרות רשת חסרים או לא תקינים בקישור שנסרק.');
            return;
        }

        try {
            const config = {
                tenant_id: tenantId,
                local_url: localUrl,
                remote_url: remoteUrl
            };

            // Save to localStorage for networkResolver
            localStorage.setItem('icaffe_server_config', JSON.stringify(config));
            
            // Save business credentials
            localStorage.setItem('business_id', tenantId);
            localStorage.setItem('businessId', tenantId);

            setConfigData(config);
            setStatus('success');
        } catch (err) {
            console.error('Failed to save settings:', err);
            setStatus('error');
            setErrorMsg('שגיאה בשמירת נתוני ההגדרות במכשיר.');
        }
    }, [searchParams]);

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 font-heebo" dir="rtl">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.1),transparent_70%)] pointer-events-none" />
            
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-[460px] bg-slate-900/40 border border-slate-800 backdrop-blur-xl rounded-3xl p-8 shadow-2xl relative overflow-hidden"
            >
                <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
                
                {status === 'processing' && (
                    <div className="text-center py-12">
                        <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-6" />
                        <h2 className="text-2xl font-bold text-white mb-2">מתחבר ומגדיר רשת...</h2>
                        <p className="text-slate-400 text-sm">אנא המתן בזמן שמירת הגדרות המכשיר.</p>
                    </div>
                )}

                {status === 'success' && (
                    <div className="text-right">
                        <div className="flex justify-center mb-6">
                            <div className="w-16 h-16 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl flex items-center justify-center text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.15)] animate-pulse">
                                <Wifi size={32} />
                            </div>
                        </div>

                        <h2 className="text-2xl font-black text-white text-center mb-2">החיבור הוגדר בהצלחה! ⚡</h2>
                        <p className="text-slate-400 text-sm text-center mb-8">המכשיר שלך מסונכרן כעת ומוכן לעבודה עם העסק.</p>

                        <div className="space-y-4 mb-8 bg-slate-950/60 border border-slate-900 rounded-2xl p-5">
                            <div className="flex items-start gap-3">
                                <ShieldCheck className="text-cyan-400 mt-0.5 shrink-0" size={18} />
                                <div>
                                    <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">מזהה עסק רשום</span>
                                    <span className="text-xs text-slate-300 font-mono block break-all">{configData?.tenant_id}</span>
                                </div>
                            </div>

                            <div className="h-px bg-slate-900" />

                            <div className="flex items-start gap-3">
                                <Server className="text-cyan-400 mt-0.5 shrink-0" size={18} />
                                <div>
                                    <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">כתובת רשת מקומית</span>
                                    <span className="text-xs text-slate-300 font-mono block">{configData?.local_url}</span>
                                </div>
                            </div>

                            <div className="h-px bg-slate-900" />

                            <div className="flex items-start gap-3">
                                <Sparkles className="text-cyan-400 mt-0.5 shrink-0" size={18} />
                                <div>
                                    <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">כתובת ענן גיבוי</span>
                                    <span className="text-xs text-slate-300 font-mono block">{configData?.remote_url}</span>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={() => navigate('/login')}
                            className="w-full py-3.5 bg-gradient-to-l from-cyan-400 to-cyan-500 hover:from-cyan-500 hover:to-cyan-600 text-slate-950 font-bold rounded-2xl transition-all shadow-[0_4px_20px_rgba(6,182,212,0.25)] flex items-center justify-center gap-2 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                        >
                            <span>המשך למסך התחברות</span>
                            <ArrowRight size={18} className="rotate-180" />
                        </button>
                    </div>
                )}

                {status === 'error' && (
                    <div className="text-center py-6">
                        <div className="w-16 h-16 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center justify-center text-red-400 mx-auto mb-6">
                            <AlertTriangle size={32} />
                        </div>

                        <h2 className="text-2xl font-black text-white mb-2">הגדרת החיבור נכשלה</h2>
                        <p className="text-red-400/80 text-sm mb-8 leading-relaxed">{errorMsg}</p>

                        <button
                            onClick={() => navigate('/login')}
                            className="w-full py-3.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-2xl transition-colors cursor-pointer"
                        >
                            חזור למסך הבית
                        </button>
                    </div>
                )}
            </motion.div>
        </div>
    );
};

export default ConnectPage;
