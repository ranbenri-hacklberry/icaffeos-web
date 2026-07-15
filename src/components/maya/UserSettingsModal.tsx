import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
    X, User, Lock, Key,
    Scan, CheckCircle, Shield, AlertTriangle,
    Loader2, Save
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
// @ts-ignore
import { sendSms } from '../../services/smsService';
import FaceScannerReusable from './FaceScannerReusable';

// Interface
interface UserSettingsModalProps {
    employee: any;
    onClose: () => void;
    onUpdate?: (updatedEmployee: any) => void;
}

const UserSettingsModal: React.FC<UserSettingsModalProps> = ({
    employee,
    onClose,
    onUpdate
}) => {
    const [activeTab, setActiveTab] = useState<'details' | 'security' | 'biometric'>('details');
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        name: employee.name || '',
        phone: employee.phone || '',
        email: employee.email || '',
        pin: '', // Empty by default
        password: '',
        confirmPassword: ''
    });

    // OTP State
    const [otpSent, setOtpSent] = useState(false);
    const [otpCode, setOtpCode] = useState('');
    const [userOtpInput, setUserOtpInput] = useState('');
    const [isPhoneVerified, setIsPhoneVerified] = useState(true); // Assumed verified initially if unchanged
    const [phoneEditMode, setPhoneEditMode] = useState(false);

    // Face Scan State
    const [faceEmbedding, setFaceEmbedding] = useState<number[] | null>(null);

    // Handlers
    const handleSendOtp = async () => {
        if (!formData.phone || formData.phone.length < 10) {
            setMessage({ type: 'error', text: 'מספר טלפון לא תקין' });
            return;
        }

        setIsLoading(true);
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        setOtpCode(code);

        try {
            const res = await sendSms(formData.phone, `קוד האימות שלך הוא: ${code}`);
            if (res.success) {
                setOtpSent(true);
                setMessage({ type: 'success', text: 'קוד אימות נשלח ל-' + formData.phone });
            } else {
                setMessage({ type: 'error', text: 'שגיאה בשליחת SMS: ' + res.error });
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'שגיאה בשליחה' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifyOtp = () => {
        if (userOtpInput === otpCode) {
            setIsPhoneVerified(true);
            setOtpSent(false);
            setPhoneEditMode(false);
            setMessage({ type: 'success', text: 'הטלפון אומת בהצלחה!' });
        } else {
            setMessage({ type: 'error', text: 'קוד שגוי' });
        }
    };

    const handleSaveDetails = async () => {
        if (phoneEditMode && !isPhoneVerified) {
            setMessage({ type: 'error', text: 'יש לאמת את מספר הטלפון החדש' });
            return;
        }

        setIsLoading(true);
        try {
            const updates: any = {
                email: formData.email,
                name: formData.name
            };

            // Only update phone if changed and verified
            if (formData.phone !== employee.phone && isPhoneVerified) {
                updates.phone = formData.phone;
            }

            const { error } = await supabase
                .from('employees')
                .update(updates)
                .eq('id', employee.id);

            if (error) throw error;

            setMessage({ type: 'success', text: 'הפרטים נשמרו בהצלחה' });
            if (onUpdate) onUpdate({ ...employee, ...updates });

        } catch (err: any) {
            setMessage({ type: 'error', text: 'שגיאה בשמירה: ' + err.message });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveSecurity = async () => {
        setIsLoading(true);
        try {
            // Update Password if provided
            if (formData.password) {
                if (formData.password !== formData.confirmPassword) {
                    throw new Error('הסיסמאות לא תואמות');
                }
                const { error: pwError } = await supabase.auth.updateUser({
                    password: formData.password
                });
                if (pwError) throw pwError;
            }

            // Update PIN if provided
            if (formData.pin) {
                if (formData.pin.length < 4) throw new Error('קוד פין חייב להכיל 4 ספרות לפחות');

                // We need to use RPC or backend API to hash PIN properly
                // Since this is a client-side update, we might rely on an RPC `update_employee_pin`
                // OR we accept that we might need to send it to our backend proxy if we can't hash here.
                // Assuming `update_employee_pin` RPC exists or we use the `complete_employee_setup` logic which uses `crypt` extension.
                // Let's try calling a backend endpoint which is safer for PIN hashing logic if possible, 
                // OR use Supabase if `pgcrypto` is available.
                // Reusing `complete_employee_setup` might wipe other fields or fail if user active.

                // Let's use a simple backend call to ensure consistency with hashing
                const res = await fetch('http://localhost:8081/api/maya/update-pin', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        employeeId: employee.id,
                        pinCode: formData.pin
                    })
                });

                if (!res.ok) {
                    // Fallback: Try RPC if endpoint fails (dev environment compatibility)
                    const { error: rpcError } = await supabase.rpc('update_employee_pin', {
                        p_employee_id: employee.id,
                        p_pin_code: formData.pin
                    });
                    if (rpcError) throw new Error('Failed to update PIN via RPC: ' + rpcError.message);
                }
            }

            setMessage({ type: 'success', text: 'הגדרות האבטחה עודכנו' });
            setFormData(prev => ({ ...prev, password: '', confirmPassword: '', pin: '' }));

        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'שגיאה בעדכון אבטחה' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleFaceScanComplete = async (embedding: Float32Array, confidence: number) => {
        setFaceEmbedding(Array.from(embedding));

        setIsLoading(true);
        try {
            const response = await fetch('http://localhost:8081/api/maya/enroll-face', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    employeeId: employee.id,
                    embedding: Array.from(embedding)
                })
            });

            if (!response.ok) throw new Error('Failed to save face data');

            setMessage({ type: 'success', text: `זיהוי פנים עודכן בהצלחה! (${(confidence * 100).toFixed(0)}%)` });

        } catch (err: any) {
            setMessage({ type: 'error', text: 'שגיאה בשמירת פנים: ' + err.message });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" dir="rtl">
            {/* @ts-ignore */}
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-slate-900 w-full max-w-4xl rounded-3xl overflow-hidden shadow-2xl border border-white/10 flex flex-col md:flex-row h-[600px]"
            >
                {/* Sidebar Navigation */}
                <div className="w-full md:w-64 bg-slate-800/50 p-6 flex flex-col gap-2 border-l border-white/5">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-xl">
                            {employee?.name?.[0] || <User />}
                        </div>
                        <div>
                            <h3 className="text-white font-bold text-lg leading-tight">{employee?.name}</h3>
                            <p className="text-white/50 text-xs">{employee?.accessLevel || 'User'}</p>
                        </div>
                    </div>

                    <button
                        onClick={() => setActiveTab('details')}
                        className={`p-3 rounded-xl flex items-center gap-3 transition-all ${activeTab === 'details' ? 'bg-purple-600 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'
                            }`}
                    >
                        <User size={18} /> הפרטים שלי
                    </button>
                    <button
                        onClick={() => setActiveTab('security')}
                        className={`p-3 rounded-xl flex items-center gap-3 transition-all ${activeTab === 'security' ? 'bg-purple-600 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'
                            }`}
                    >
                        <Shield size={18} /> אבטחה וכניסה
                    </button>
                    <button
                        onClick={() => setActiveTab('biometric')}
                        className={`p-3 rounded-xl flex items-center gap-3 transition-all ${activeTab === 'biometric' ? 'bg-purple-600 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'
                            }`}
                    >
                        <Scan size={18} /> זיהוי פנים
                    </button>
                </div>

                {/* Main Content */}
                <div className="flex-1 flex flex-col text-slate-200">
                    <div className="h-16 border-b border-white/10 flex items-center justify-between px-6 bg-slate-800/30">
                        <h2 className="text-xl font-bold text-white">
                            {activeTab === 'details' && 'עריכת פרטים אישיים'}
                            {activeTab === 'security' && 'אבטחת חשבון'}
                            {activeTab === 'biometric' && 'ניהול כניסה ביומטרית'}
                        </h2>
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 relative">
                        {message && (
                            // @ts-ignore
                            <motion.div
                                initial={{ opacity: 0, y: -20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${message.type === 'success' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
                                    }`}
                            >
                                {message.type === 'success' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
                                {message.text}
                            </motion.div>
                        )}

                        {/* Details Tab */}
                        {activeTab === 'details' && (
                            <div className="space-y-6 max-w-lg">
                                <div className="space-y-2">
                                    <label className="text-sm text-white/60 font-medium">שם מלא</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full bg-slate-900 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm text-white/60 font-medium">אימייל</label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                                        className="w-full bg-slate-900 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500"
                                        dir="ltr"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm text-white/60 font-medium flex justify-between">
                                        <span>טלפון נייד</span>
                                        {!phoneEditMode && (
                                            <button
                                                onClick={() => { setPhoneEditMode(true); setIsPhoneVerified(false); }}
                                                className="text-purple-400 text-xs hover:underline"
                                            >
                                                שנה מספר
                                            </button>
                                        )}
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="tel"
                                            value={formData.phone}
                                            disabled={!phoneEditMode}
                                            onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                            className={`flex-1 bg-slate-900 border rounded-xl px-4 py-3 text-white focus:outline-none 
                                                ${phoneEditMode ? 'border-purple-500 border-2' : 'border-white/20 opacity-60'}`}
                                            dir="ltr"
                                        />
                                        {phoneEditMode && !otpSent && (
                                            <button
                                                onClick={handleSendOtp}
                                                disabled={isLoading}
                                                className="bg-purple-600 hover:bg-purple-500 px-4 rounded-xl text-white text-sm font-bold whitespace-nowrap"
                                            >
                                                {isLoading ? 'שולח...' : 'שלח קוד'}
                                            </button>
                                        )}
                                    </div>
                                    {otpSent && phoneEditMode && (
                                        <div className="flex gap-2 mt-2 animate-in fade-in slide-in-from-top-2">
                                            <input
                                                type="text"
                                                placeholder="קוד אימות"
                                                value={userOtpInput}
                                                onChange={e => setUserOtpInput(e.target.value)}
                                                className="w-32 bg-slate-800 border border-white/20 rounded-xl px-4 py-2 text-center tracking-widest text-white"
                                            />
                                            <button
                                                onClick={handleVerifyOtp}
                                                className="bg-green-600 hover:bg-green-500 px-4 rounded-xl text-white text-sm font-bold"
                                            >
                                                אמת
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="pt-6">
                                    <button
                                        onClick={handleSaveDetails}
                                        disabled={isLoading}
                                        className="w-full py-4 bg-white text-slate-900 rounded-xl font-bold hover:bg-slate-200 transition flex items-center justify-center gap-2"
                                    >
                                        {isLoading && <Loader2 className="animate-spin" />}
                                        <Save size={18} /> שמור שינויים
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Security Tab */}
                        {activeTab === 'security' && (
                            <div className="space-y-6 max-w-lg">
                                <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-2xl mb-6">
                                    <h4 className="flex items-center gap-2 text-purple-400 font-bold mb-2">
                                        <Lock size={16} /> שינוי סיסמה
                                    </h4>
                                    <div className="space-y-3">
                                        <input
                                            type="password"
                                            placeholder="סיסמה חדשה"
                                            value={formData.password}
                                            onChange={e => setFormData({ ...formData, password: e.target.value })}
                                            className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500"
                                            dir="ltr"
                                        />
                                        <input
                                            type="password"
                                            placeholder="אימות סיסמה חדשה"
                                            value={formData.confirmPassword}
                                            onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
                                            className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500"
                                            dir="ltr"
                                        />
                                    </div>
                                </div>

                                <div className="p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-2xl">
                                    <h4 className="flex items-center gap-2 text-cyan-400 font-bold mb-2">
                                        <Key size={16} /> שינוי קוד PIN
                                    </h4>
                                    <div className="space-y-3">
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            maxLength={6}
                                            placeholder="קוד PIN חדש (4-6 ספרות)"
                                            value={formData.pin}
                                            onChange={e => setFormData({ ...formData, pin: e.target.value.replace(/\D/g, '') })}
                                            className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white tracking-[0.5em] text-center text-xl focus:outline-none focus:border-cyan-500"
                                        />
                                        <p className="text-xs text-white/40">הקוד משמש לכניסה מהירה ואישור פעולות בקופה</p>
                                    </div>
                                </div>

                                <div className="pt-4">
                                    <button
                                        onClick={handleSaveSecurity}
                                        disabled={isLoading || (!formData.password && !formData.pin)}
                                        className="w-full py-4 bg-white text-slate-900 rounded-xl font-bold hover:bg-slate-200 transition flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        {isLoading && <Loader2 className="animate-spin" />}
                                        <Save size={18} /> עדכן הגדרות אבטחה
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Biometric Tab */}
                        {activeTab === 'biometric' && (
                            <div className="space-y-6">
                                <div className="bg-slate-900/50 p-6 rounded-2xl border border-white/10 flex flex-col items-center">
                                    <h3 className="text-xl font-bold text-white mb-4">עדכון זיהוי פנים</h3>
                                    <p className="text-white/60 text-center max-w-md mb-8">
                                        אם המערכת מתקשה לזהות אותך, מומלץ לסרוק את הפנים מחדש בתאורה טובה.
                                    </p>

                                    <div className="w-full max-w-md bg-black/40 p-4 rounded-3xl border border-white/10">
                                        <FaceScannerReusable
                                            onScanComplete={handleFaceScanComplete}
                                            onError={(err) => setMessage({ type: 'error', text: err })}
                                            compact={true}
                                            autoStart={false}
                                            showInstructions={true}
                                        />
                                    </div>

                                    {faceEmbedding && (
                                        <div className="mt-6 flex items-center justify-center gap-2 text-green-400 bg-green-500/10 px-6 py-3 rounded-xl border border-green-500/20">
                                            <CheckCircle size={20} />
                                            <span>נתוני הפנים עודכנו בהצלחה!</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default UserSettingsModal;
