import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { loginEmployee, clockEvent } from '../../lib/employees/employeeService';
import { Loader2, User, KeyRound, ArrowRight, CheckCircle, AlertTriangle, Eye, EyeOff, Building2, Keyboard } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import VirtualKeyboard from '../../components/ui/VirtualKeyboard';

// Remove BrandLogo import since we're not using it anymore

const LoginScreen = () => {
    const navigate = useNavigate();
    const { login, currentUser } = useAuth();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    // Multi-Business Selection State
    const [matchedEmployees, setMatchedEmployees] = useState([]);
    const [showSelector, setShowSelector] = useState(false);

    // Virtual Keyboard State
    const [showKeyboard, setShowKeyboard] = useState(false);
    const [activeField, setActiveField] = useState(null); // 'email' | 'password'
    const emailRef = useRef(null);
    const passwordRef = useRef(null);

    // Auto-redirect if already logged in
    React.useEffect(() => {
        if (currentUser) {
            if (currentUser.is_super_admin) {
                navigate('/super-admin');
            } else {
                navigate('/mode-selection');
            }
        }
    }, [currentUser, navigate]);

    // Auto-fill email from URL parameter
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const emailParam = params.get('email');
        if (emailParam) {
            setEmail(emailParam);
        }
    }, []);

    const handleLogin = async (e) => {
        if (e) e.preventDefault();
        setIsLoading(true);
        setError('');

        // Timeout protection - 15 seconds max
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('TIMEOUT')), 60000); // Increased to 60s
        });

        try {
            // Use secure RPC function for authentication (server-side password hashing)
            const { data: employees, error: authError } = await Promise.race([
                supabase.rpc('authenticate_employee', {
                    p_email: email.trim().toLowerCase(),
                    p_password: password
                }),
                timeoutPromise
            ]);

            if (authError) {
                console.error('Authentication error:', authError);
                throw authError;
            }

            if (!employees || employees.length === 0) {
                setError('אימייל או סיסמה שגויים');
                setIsLoading(false);
                return;
            }

            // Check if user has multiple businesses (e.g., Owner of multiple branches)
            if (employees.length > 1) {
                console.log('Multiple businesses found:', employees);
                setMatchedEmployees(employees);
                setShowSelector(true);
                setIsLoading(false);
                return;
            }

            // Single match - enrich with is_super_admin if missing (fallback for old RPC)
            let employee = employees[0];
            if (employee.is_super_admin === undefined) {
                try {
                    const { data: fullEmployee } = await supabase
                        .from('employees')
                        .select('is_super_admin, access_level')
                        .eq('id', employee.id)
                        .single();
                    if (fullEmployee) {
                        employee = { ...employee, is_super_admin: fullEmployee.is_super_admin, access_level: fullEmployee.access_level };
                        console.log('🔑 Enriched employee with is_super_admin:', employee.is_super_admin);
                    }
                } catch (e) {
                    console.warn('Could not enrich is_super_admin:', e);
                }
            }
            await finalizeLogin(employee);

        } catch (err) {
            console.error('Login error:', err);
            if (err.message === 'TIMEOUT') {
                setError('הזמן הקצוב עבר - בדוק את החיבור לאינטרנט');
            } else if (err.message?.includes('Load failed') || err.message?.includes('fetch')) {
                setError('בעיית חיבור - בדוק את הרשת');
            } else {
                setError('שגיאה בהתחברות לשירות');
            }
            setIsLoading(false);
        }
    };

    const finalizeLogin = async (employee) => {
        try {
            setIsLoading(true);
            // Success - login and navigate
            console.log('✅ Login successful for:', employee.name);
            await login(employee); // CRITICAL: Await enriched data (business name etc)

            // Clock In (optional, don't block on failure)
            clockEvent(employee.id, 'clock_in').catch(e =>
                console.log('Auto clock-in optional:', e)
            );

            // SPECIAL ROUTING FOR SUPER ADMIN
            if (employee.is_super_admin) {
                // CRITICAL: Clear any leftover mode to ensure Super Admin goes to portal first
                localStorage.removeItem('kiosk_mode');
                navigate('/super-admin');
            } else {
                navigate('/mode-selection');
            }
        } catch (err) {
            console.error('Finalize login error:', err);
            setError('שגיאה בכניסה הסופית למערכת');
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 font-heebo overflow-auto pt-6 pb-4 px-4" dir="rtl">
            <div className="max-w-md mx-auto">
                <div className="bg-white rounded-2xl shadow-2xl w-full overflow-hidden">
                    <div className="bg-slate-800 py-3 px-4 text-center text-white">
                        <h1 className="text-xl font-black leading-tight">כניסה למערכת</h1>
                        <p className="text-slate-300 text-xs">הזן פרטי התחברות</p>
                    </div>

                    <div className="p-4">
                        {error && (
                            <div className="mb-3 bg-red-50 border border-red-100 text-red-600 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2">
                                <AlertTriangle size={14} />
                                {error}
                            </div>
                        )}

                        <AnimatePresence mode="wait">
                            {showSelector ? (
                                <motion.div
                                    key="selector"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="space-y-3"
                                >
                                    <div className="text-center mb-4">
                                        <h2 className="text-lg font-bold text-slate-800">בחר עסק להתחברות</h2>
                                        <p className="text-sm text-slate-500">נמצאו מספר חשבונות משויכים</p>
                                    </div>

                                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                        {matchedEmployees.map((emp) => (
                                            <button
                                                key={emp.id}
                                                onClick={() => finalizeLogin(emp)}
                                                disabled={isLoading}
                                                className="w-full text-right p-3 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50 transition-all flex items-center gap-3 group"
                                            >
                                                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                                                    <Building2 size={20} />
                                                </div>
                                                <div>
                                                    <div className="font-bold text-slate-800">{emp.business_name || 'עסק לא מזוהה'}</div>
                                                    <div className="text-xs text-slate-500">{emp.role} • {emp.name}</div>
                                                </div>
                                                <div className="mr-auto opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <ArrowRight size={16} className="text-blue-500" />
                                                </div>
                                            </button>
                                        ))}
                                    </div>

                                    <button
                                        onClick={() => {
                                            setShowSelector(false);
                                            setMatchedEmployees([]);
                                        }}
                                        className="w-full text-slate-400 text-sm mt-2 hover:text-slate-600"
                                    >
                                        חזרה
                                    </button>
                                </motion.div>
                            ) : (
                                <motion.form
                                    key="form"
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    onSubmit={handleLogin}
                                    className="space-y-3"
                                >
                                    <div>
                                        <label className="block text-slate-700 font-bold mb-0.5 text-xs">אימייל</label>
                                        <div className="relative">
                                            <User className="absolute top-1/2 -translate-y-1/2 right-3 text-slate-400 w-4 h-4" />
                                            <input
                                                ref={emailRef}
                                                type="email"
                                                value={email}
                                                onChange={e => setEmail(e.target.value)}
                                                onFocus={() => setActiveField('email')}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 pr-10 pl-3 text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder:text-slate-400 text-sm"
                                                placeholder="your@email.com"
                                                required
                                                autoFocus
                                                dir="ltr"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-slate-700 font-bold mb-0.5 text-xs">סיסמה</label>
                                        <div className="relative">
                                            <KeyRound className="absolute top-1/2 -translate-y-1/2 right-3 text-slate-400 w-4 h-4" />
                                            <input
                                                ref={passwordRef}
                                                type={showPassword ? "text" : "password"}
                                                value={password}
                                                onChange={e => setPassword(e.target.value)}
                                                onFocus={() => setActiveField('password')}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 pr-10 pl-10 text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-sans text-sm"
                                                placeholder=""
                                                required
                                                dir="ltr"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute top-1/2 -translate-y-1/2 left-3 text-slate-400 hover:text-blue-600 transition-colors"
                                            >
                                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={isLoading}
                                        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-2.5 rounded-lg text-base shadow-lg shadow-slate-900/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                                    >
                                        {isLoading ? (
                                            <Loader2 className="animate-spin w-6 h-6" />
                                        ) : (
                                            <>
                                                <span>התחבר</span>
                                                <ArrowRight className="w-5 h-5" />
                                            </>
                                        )}
                                    </button>

                                    {/* On-Screen Keyboard Toggle */}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowKeyboard(true);
                                            if (!activeField) {
                                                setActiveField('email');
                                                emailRef.current?.focus();
                                            }
                                        }}
                                        className="w-full mt-2 text-slate-400 text-xs flex items-center justify-center gap-1 hover:text-blue-500 transition-colors py-2"
                                    >
                                        <Keyboard size={14} />
                                        <span>פתח מקלדת</span>
                                    </button>
                                </motion.form>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            {/* Virtual Keyboard Overlay */}
            <VirtualKeyboard
                isOpen={showKeyboard}
                onClose={() => setShowKeyboard(false)}
                activeField={activeField}
                onInput={(char) => {
                    if (activeField === 'email') {
                        setEmail(prev => prev + char);
                    } else if (activeField === 'password') {
                        setPassword(prev => prev + char);
                    }
                }}
                onBackspace={() => {
                    if (activeField === 'email') {
                        setEmail(prev => prev.slice(0, -1));
                    } else if (activeField === 'password') {
                        setPassword(prev => prev.slice(0, -1));
                    }
                }}
                onEnter={() => {
                    if (activeField === 'email') {
                        setActiveField('password');
                        passwordRef.current?.focus();
                    } else {
                        setShowKeyboard(false);
                        handleLogin();
                    }
                }}
            />
        </div>
    );
};

export default LoginScreen;
