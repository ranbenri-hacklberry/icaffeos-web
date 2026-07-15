import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, Send, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

const AccountantAccess = () => {
    const { currentUser } = useAuth();
    const [email, setEmail] = useState('');
    const [status, setStatus] = useState('idle'); // idle, loading, success, error
    const [errorMessage, setErrorMessage] = useState('');

    const handleInvite = async (e) => {
        e.preventDefault();

        if (!email || !email.includes('@')) {
            setErrorMessage('נא להזין כתובת אימייל תקינה');
            return;
        }

        setStatus('loading');
        setErrorMessage('');

        try {
            const { data, error } = await supabase.functions.invoke('google-auth', {
                body: {
                    action: 'share_folder',
                    business_id: currentUser.business_id,
                    target_email: email.trim(),
                    role: 'reader' // Default to reader for safety
                }
            });

            if (error) throw error;

            setStatus('success');
            setTimeout(() => {
                setStatus('idle');
                setEmail('');
            }, 5000);

        } catch (err) {
            console.error('Share failed:', err);
            setStatus('error');

            // Try to parse detailed error from server response
            let msg = err.message;
            try {
                // FunctionsHttpError has a context property with the Response
                if (err.context && typeof err.context.json === 'function') {
                    const body = await err.context.json();
                    console.error('🔴 Detailed server error:', body);
                    msg = body.error || body.message || msg;
                }
            } catch (parseErr) {
                console.error('Failed to parse error body:', parseErr);
            }

            setErrorMessage(msg || 'שגיאה בשליחת ההזמנה. אנא נסה שנית.');
        }
    };

    return (
        <div className="bg-slate-800 rounded-2xl shadow-xl border border-slate-700 p-8 mt-8">
            <div className="flex items-start gap-4 mb-6">
                <div className="p-3 bg-purple-500/10 rounded-xl border border-purple-500/20">
                    <UserPlus className="w-8 h-8 text-purple-400" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-white mb-2">גישת רואה חשבון / שותף</h2>
                    <p className="text-slate-400 text-base leading-relaxed">
                        שתף את תיקיית הגיבוי ("icaffeOS Data") עם רואה החשבון שלך או שותף עסקי.
                        הם יקבלו הזמנה למייל ויכולו לצפות בכל הקבצים והדוחות בזמן אמת.
                    </p>
                </div>
            </div>

            <div className="max-w-xl pr-16 space-y-4">
                <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="הכנס כתובת אימייל (למשל: accountant@example.com)"
                            disabled={status === 'loading' || status === 'success'}
                            className="w-full bg-slate-900 border border-slate-600 text-white px-4 py-3 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all disabled:opacity-50 text-left placeholder:text-right"
                            dir="ltr"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={status === 'loading' || status === 'success' || !email}
                        className={`px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all min-w-[140px]
                            ${status === 'success'
                                ? 'bg-green-500 text-white'
                                : status === 'error'
                                    ? 'bg-red-500 text-white'
                                    : 'bg-purple-600 hover:bg-purple-700 text-white'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                        {status === 'loading' ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span>שולח...</span>
                            </>
                        ) : status === 'success' ? (
                            <>
                                <CheckCircle className="w-5 h-5" />
                                <span>נשלח!</span>
                            </>
                        ) : (
                            <>
                                <span>שלח הזמנה</span>
                                <Send className="w-4 h-4 rotate-180" />
                            </>
                        )}
                    </button>
                </form>

                <AnimatePresence>
                    {status === 'success' && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="text-green-400 text-sm flex items-center gap-2"
                        >
                            <CheckCircle className="w-4 h-4" />
                            <span>ההזמנה נשלחה בהצלחה! האימייל יקבל גישה תוך מספר שניות.</span>
                        </motion.div>
                    )}

                    {status === 'error' && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="text-red-400 text-sm flex items-center gap-2"
                        >
                            <AlertCircle className="w-4 h-4" />
                            <span>{errorMessage}</span>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Future: List existing permissions here */}
                {/* <div className="mt-4 pt-4 border-t border-slate-700/50">
                    <h4 className="text-sm font-medium text-slate-500 mb-2">מורשים קיימים:</h4>
                    ...
                </div> */}
            </div>
        </div>
    );
};

export default AccountantAccess;
