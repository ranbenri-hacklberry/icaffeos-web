import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { LogIn, UserPlus, Mail, Lock, Loader2, Music, CheckCircle2, AlertCircle } from 'lucide-react';

const Login = () => {
    const navigate = useNavigate();
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    // Redirect to home if session already exists
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                navigate('/');
            }
        });
    }, [navigate]);

    const handleAuth = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage({ type: '', text: '' });

        try {
            if (isLogin) {
                // Log In
                const { error } = await supabase.auth.signInWithPassword({
                    email: email.trim(),
                    password: password
                });
                if (error) throw error;
                navigate('/');
            } else {
                // Register
                const { error, data } = await supabase.auth.signUp({
                    email: email.trim(),
                    password: password
                });
                if (error) throw error;
                
                if (data?.user?.identities?.length === 0) {
                    setMessage({ type: 'error', text: 'אימייל זה כבר רשום במערכת' });
                } else {
                    setMessage({ type: 'success', text: 'הרשמה בוצעה בהצלחה! שלחנו אימייל לאימות החשבון.' });
                }
            }
        } catch (err) {
            console.error('Auth error:', err);
            let errMsg = 'אירעה שגיאה בתהליך האימות';
            if (err.message.includes('Invalid login credentials')) {
                errMsg = 'אימייל או סיסמה שגויים';
            } else if (err.message.includes('Signup requires a valid email')) {
                errMsg = 'נא להזין כתובת אימייל תקינה';
            } else if (err.message.includes('Password should be at least 6 characters')) {
                errMsg = 'הסיסמה חייבת להכיל לפחות 6 תווים';
            } else {
                errMsg = err.message;
            }
            setMessage({ type: 'error', text: errMsg });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-black bg-radial-gradient text-white font-sans overflow-hidden relative">
            {/* Ambient Background Glows */}
            <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-purple-900/10 blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-indigo-900/10 blur-[120px] pointer-events-none" />

            <div className="w-full max-w-md p-8 rounded-3xl bg-zinc-950/60 border border-zinc-900/80 backdrop-blur-2xl shadow-2xl z-10 mx-4 transition-all duration-300">
                {/* Logo & Header */}
                <div className="flex flex-col items-center mb-8 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-900/30 mb-4 animate-pulse">
                        <Music className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-white via-zinc-100 to-zinc-400 bg-clip-text text-transparent">
                        RanTunes Standalone
                    </h1>
                    <p className="text-sm text-zinc-500 mt-2">
                        {isLogin ? 'התחבר לחשבון המוזיקה שלך' : 'צור חשבון חדש בשרת המוזיקה'}
                    </p>
                </div>

                {/* Tabs */}
                <div className="flex bg-zinc-900/40 p-1 rounded-xl mb-6 border border-zinc-900/50">
                    <button
                        type="button"
                        onClick={() => { setIsLogin(true); setMessage({ type: '', text: '' }); }}
                        className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
                            isLogin ? 'bg-zinc-800 text-white shadow' : 'text-zinc-400 hover:text-white'
                        }`}
                    >
                        <LogIn className="w-4 h-4" />
                        התחברות
                    </button>
                    <button
                        type="button"
                        onClick={() => { setIsLogin(false); setMessage({ type: '', text: '' }); }}
                        className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
                            !isLogin ? 'bg-zinc-800 text-white shadow' : 'text-zinc-400 hover:text-white'
                        }`}
                    >
                        <UserPlus className="w-4 h-4" />
                        הרשמה
                    </button>
                </div>

                {/* Messages */}
                {message.text && (
                    <div className={`p-4 rounded-xl mb-6 flex items-start gap-3 border text-sm ${
                        message.type === 'success' 
                            ? 'bg-emerald-950/20 border-emerald-900/50 text-emerald-400' 
                            : 'bg-rose-950/20 border-rose-900/50 text-rose-400'
                    }`}>
                        {message.type === 'success' ? (
                            <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        ) : (
                            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        )}
                        <span>{message.text}</span>
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleAuth} className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5 mr-1" dir="rtl">
                            אימייל
                        </label>
                        <div className="relative">
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="name@example.com"
                                className="w-full bg-zinc-900/50 border border-zinc-900 focus:border-purple-600/50 focus:ring-1 focus:ring-purple-600/30 rounded-xl py-3 pl-4 pr-11 text-zinc-100 placeholder-zinc-600 outline-none transition-all duration-200"
                            />
                            <Mail className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5 mr-1" dir="rtl">
                            סיסמה
                        </label>
                        <div className="relative">
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full bg-zinc-900/50 border border-zinc-900 focus:border-purple-600/50 focus:ring-1 focus:ring-purple-600/30 rounded-xl py-3 pl-4 pr-11 text-zinc-100 placeholder-zinc-600 outline-none transition-all duration-200"
                            />
                            <Lock className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600" />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full mt-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-3.5 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-purple-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                {isLogin ? 'מתחבר...' : 'נרשם...'}
                            </>
                        ) : (
                            <>
                                {isLogin ? 'התחבר לחשבון' : 'צור חשבון חדש'}
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Login;
