import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import {
    PlusCircle,
    Search,
    UserPlus,
    Phone,
    Mail,
    ShieldCheck,
    MoreVertical,
    X,
    Check,
    AlertCircle,
    Trash2,
    User,
    Key,
    IdCard,
    Car,
    Smartphone,
    Share2,
    Copy,
    MessageSquare
} from 'lucide-react';
import { sendSms } from '@/services/smsService';

const EmployeeManager = () => {
    const { currentUser } = useAuth();
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [toast, setToast] = useState(null);

    const [form, setForm] = useState({
        name: '',
        phone: '',
        access_level: 'staff',
        is_admin: false,
        is_driver: false
    });

    const fetchEmployees = useCallback(async () => {
        if (!currentUser?.business_id) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('employees')
                .select('*')
                .eq('business_id', currentUser.business_id)
                .order('name');

            if (error) throw error;
            setEmployees(data || []);
        } catch (err) {
            console.error('Error fetching employees:', err);
        } finally {
            setLoading(false);
        }
    }, [currentUser?.business_id]);

    useEffect(() => {
        fetchEmployees();
    }, [fetchEmployees]);

    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const handleAddEmployee = async (e) => {
        e.preventDefault();
        if (!form.name || !form.phone) return;

        setIsSaving(true);
        try {
            // 1. Create staff via NEW v4 RPC
            const { data, error } = await supabase.rpc('invite_staff_v4', {
                p_name: form.name,
                p_phone: form.phone,
                p_access_level: form.access_level,
                p_is_admin: form.is_admin,
                p_is_driver: form.is_driver,
                p_business_id: currentUser.business_id
            });

            if (error) {
                console.error('❌ Supabase RPC Error:', error);
                throw new Error(error.message || 'שגיאה בשרת');
            }

            // data: { id, status }
            const empId = data.id;
            const empName = form.name; // Use from form directly to be safe

            // 3. Generate invite link (Handle localhost vs production)
            const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const prodUrl = 'https://icaffe.vercel.com';
            const baseUrl = isLocal ? prodUrl : window.location.origin;

            const inviteLink = `${baseUrl}/complete-profile?id=${empId}`;
            const message = `שלום ${empName}, הוזמנת להצטרף לצוות של ${currentUser.business_name || 'העסק'}. להשלמת הגדרת החשבון שלך לחץ כאן: ${inviteLink}`;

            // 4. Send SMS
            const smsResult = await sendSms(form.phone, message);

            if (smsResult.success) {
                showToast(`העובד נוסף בהצלחה והזמנה נשלחה ל-${form.phone}`);
            } else {
                showToast(`העובד נוסף, אך חלה שגיאה בשליחת הסמס: ${smsResult.error}`, 'error');
            }

            setShowAddModal(false);
            setForm({ name: '', phone: '', access_level: 'staff', is_admin: false, is_driver: false });
            fetchEmployees();
        } catch (err) {
            console.error('❌ Error adding employee:', err);
            showToast(err.message || 'שגיאה בהוספת עובד', 'error');
        } finally {
            setIsSaving(false);
        }
    };
    const handleDeleteEmployee = async (id, name) => {
        if (!window.confirm(`האם אתה בטוח שברצונך למחוק את העסקת ${name}?`)) return;

        try {
            const { error } = await supabase
                .from('employees')
                .delete()
                .eq('id', id);

            if (error) throw error;
            showToast('העובד נמחק בהצלחה');
            fetchEmployees();
        } catch (err) {
            console.error('Error deleting employee:', err);
            showToast('שגיאה במחיקת עובד', 'error');
        }
    };

    const filteredEmployees = employees.filter(emp =>
        emp.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.phone?.includes(searchTerm) ||
        emp.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getAccessLevelBadge = (level, isAdmin) => {
        if (isAdmin) return <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-[10px] font-black uppercase">אדמין</span>;

        const config = {
            'admin': { label: 'מנהל', color: 'bg-purple-100 text-purple-700' },
            'manager': { label: 'אחמ"ש', color: 'bg-indigo-100 text-indigo-700' },
            'staff': { label: 'צוות', color: 'bg-blue-100 text-blue-700' },
            'driver': { label: 'נהג', color: 'bg-amber-100 text-amber-700' }
        };

        const item = config[level?.toLowerCase()] || config.staff;
        return <span className={`${item.color} px-2 py-0.5 rounded-full text-[10px] font-black uppercase`}>{item.label}</span>;
    };

    return (
        <div className="h-full flex flex-col bg-slate-50 font-heebo overflow-hidden">
            {/* Header Area */}
            <div className="bg-white border-b border-slate-200 px-4 py-4 shrink-0 shadow-sm z-10">
                <div className="max-w-7xl mx-auto flex flex-col sm:flex-row gap-4 items-center justify-between">
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg shadow-indigo-100">
                            <UserPlus size={24} />
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-slate-800 leading-none">ניהול עובדים</h1>
                            <p className="text-sm text-slate-500 font-medium mt-1">נהל את צוות העובדים והרשאות מערכת</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <div className="relative flex-1 sm:w-64">
                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                placeholder="חיפוש לפי שם, טלפון..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pr-10 pl-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-bold text-slate-700"
                            />
                        </div>
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-black transition-all shadow-lg shadow-indigo-100 active:scale-95"
                        >
                            <PlusCircle size={20} />
                            <span className="hidden sm:inline">הוסף עובד</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Employee List Grid */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50">
                <div className="max-w-7xl mx-auto">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                            <p className="font-bold text-slate-500">טוען רשימת עובדים...</p>
                        </div>
                    ) : filteredEmployees.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200 text-center">
                            <div className="bg-slate-50 p-6 rounded-full mb-4">
                                <User className="text-slate-300" size={48} />
                            </div>
                            <h3 className="text-xl font-black text-slate-800 mb-2">לא נמצאו עובדים</h3>
                            <p className="text-slate-500 max-w-xs mx-auto mb-6">לא מצאנו עובדים התואמים לחיפוש שלך או שעדיין לא הוספת עובדים לעסק.</p>
                            <button
                                onClick={() => setShowAddModal(true)}
                                className="text-indigo-600 font-black hover:underline flex items-center gap-2"
                            >
                                <PlusCircle size={18} /> הוסף עובד ראשון
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredEmployees.map((emp) => (
                                <motion.div
                                    key={emp.id}
                                    layout
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="bg-white rounded-[24px] border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all relative group overflow-hidden"
                                >
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full -mr-16 -mt-16 opacity-0 group-hover:opacity-100 transition-opacity" />

                                    <div className="relative flex items-start justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-300">
                                                {emp.is_driver ? <Car size={24} /> : <User size={24} />}
                                            </div>
                                            <div>
                                                <h3 className="font-black text-slate-800 text-lg leading-none">{emp.name}</h3>
                                                <div className="flex items-center gap-2 mt-1.5">
                                                    {getAccessLevelBadge(emp.access_level, emp.is_admin)}
                                                    {emp.is_driver && <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full text-[10px] font-black uppercase">נהג</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => handleDeleteEmployee(emp.id, emp.name)}
                                                className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-colors active:scale-95"
                                                title="מחק עובד"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                            <button className="p-2 text-slate-400 hover:bg-slate-50 rounded-lg transition-colors">
                                                <MoreVertical size={18} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-3 relative">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 text-slate-700">
                                                <Phone size={14} className="text-indigo-500" />
                                                <span className="text-base font-black tracking-wider">{emp.phone || emp.whatsapp_phone || 'חסר טלפון'}</span>
                                            </div>

                                            {/* Quick Actions for Mobile */}
                                            <div className="flex items-center gap-2">
                                                <a
                                                    href={`tel:${emp.phone || emp.whatsapp_phone}`}
                                                    className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center hover:bg-blue-100 transition-colors active:scale-90"
                                                    title="התקשר לעובד"
                                                >
                                                    <Phone size={18} />
                                                </a>
                                                <a
                                                    href={`https://wa.me/${(emp.whatsapp_phone || emp.phone || '').replace(/\D/g, '')}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="w-10 h-10 bg-green-50 text-green-600 rounded-xl flex items-center justify-center hover:bg-green-100 transition-colors active:scale-90"
                                                    title="שלח וואטסאפ"
                                                >
                                                    <MessageSquare size={18} />
                                                </a>
                                            </div>
                                        </div>

                                        {emp.email && (
                                            <div className="flex items-center gap-2 text-slate-500">
                                                <Mail size={14} className="opacity-60" />
                                                <span className="text-sm font-medium">{emp.email}</span>
                                            </div>
                                        )}
                                        {emp.pin_code && (
                                            <div className="flex items-center gap-2 text-slate-500">
                                                <Key size={14} className="opacity-40" />
                                                <span className="text-xs font-bold text-slate-400">קוד פין מוגדר ✓</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between relative">
                                        {!emp.auth_user_id ? (
                                            <div className="flex items-center gap-1.5 text-amber-600 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-100 w-full animate-pulse-slow">
                                                <AlertCircle size={14} />
                                                <span className="text-xs font-black">ממתין להשלמת פרטים</span>
                                                <button
                                                    onClick={async () => {
                                                        const inviteLink = `${window.location.origin}/complete-profile?id=${emp.id}`;
                                                        const message = `תזכורת: השלם את פרטי החשבון שלך ב-${currentUser.business_name}: ${inviteLink}`;
                                                        const res = await sendSms(emp.phone, message);
                                                        if (res.success) showToast('תזכורת נשלחה בסמס');
                                                    }}
                                                    className="mr-auto text-[10px] bg-amber-600 text-white px-2 py-0.5 rounded-lg hover:bg-amber-700 transition-colors"
                                                >
                                                    שלח שוב
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1.5 text-green-600 bg-green-50 px-3 py-1.5 rounded-xl border border-green-100 w-full">
                                                <ShieldCheck size={14} />
                                                <span className="text-xs font-black">פעיל ומחובר</span>
                                                <span className="mr-auto text-[10px] opacity-60">
                                                    נוסף ב-{new Date(emp.created_at).toLocaleDateString('he-IL')}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Add Employee Modal */}
            <AnimatePresence>
                {showAddModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowAddModal(false)}
                            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="bg-white w-full max-w-md rounded-[32px] overflow-hidden shadow-2xl relative flex flex-col pt-8 pb-6 px-6 sm:px-10"
                        >
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="absolute top-6 right-6 p-2 bg-slate-50 text-slate-400 hover:text-slate-800 rounded-full transition-colors"
                            >
                                <X size={20} />
                            </button>

                            <div className="text-center mb-8">
                                <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                    <UserPlus size={32} />
                                </div>
                                <h3 className="text-2xl font-black text-slate-900">הוספת עובד חדש</h3>
                                <p className="text-slate-500 font-medium">הזן פרטים ראשוניים והזמן את העובד למערכת</p>
                            </div>

                            <form onSubmit={handleAddEmployee} className="space-y-5">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-black text-slate-700 mr-1">שם מלא</label>
                                    <div className="relative">
                                        <User className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                        <input
                                            required
                                            type="text"
                                            value={form.name}
                                            onChange={e => setForm({ ...form, name: e.target.value })}
                                            className="w-full pr-12 pl-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-bold"
                                            placeholder="לדוגמה: ישראל ישראלי"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-sm font-black text-slate-700 mr-1">מספר טלפון (WhatsApp)</label>
                                    <div className="relative">
                                        <Smartphone className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                        <input
                                            required
                                            type="tel"
                                            value={form.phone}
                                            onChange={e => setForm({ ...form, phone: e.target.value })}
                                            className="w-full pr-12 pl-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-bold tracking-widest text-left rtl:text-right"
                                            placeholder="05X-XXXXXXX"
                                        />
                                    </div>
                                    <p className="text-[10px] text-slate-400 font-bold px-1 italic">העובד יקבל סמס עם קישור להגדרת החשבון שלו</p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-black text-slate-700 mr-1">תפקיד</label>
                                        <select
                                            value={form.access_level}
                                            onChange={e => setForm({ ...form, access_level: e.target.value })}
                                            className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-bold"
                                        >
                                            <option value="staff">צוות</option>
                                            <option value="manager">אחמ"ש</option>
                                            <option value="admin">מנהל</option>
                                        </select>
                                    </div>
                                    <div className="flex flex-col justify-end gap-2 pb-1.5">
                                        <label className="flex items-center gap-2 cursor-pointer group">
                                            <div
                                                onClick={() => setForm({ ...form, is_driver: !form.is_driver })}
                                                className={`w-10 h-6 rounded-full transition-all relative ${form.is_driver ? 'bg-indigo-600' : 'bg-slate-200'}`}
                                            >
                                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${form.is_driver ? 'right-1' : 'left-1'}`} />
                                            </div>
                                            <span className="text-sm font-bold text-slate-600 group-hover:text-indigo-600">נהג שליחויות?</span>
                                        </label>
                                    </div>
                                </div>

                                <button
                                    disabled={isSaving}
                                    type="submit"
                                    className="w-full py-4 mt-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white rounded-2xl font-black text-lg transition-all shadow-xl shadow-indigo-100 flex items-center justify-center gap-2"
                                >
                                    {isSaving ? (
                                        <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            <Share2 size={20} />
                                            שלח הזמנה והוסף עובד
                                        </>
                                    )}
                                </button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Toast Notification */}
            <AnimatePresence>
                {toast && (
                    <motion.div
                        initial={{ y: 50, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 50, opacity: 0 }}
                        className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 ${toast.type === 'error' ? 'bg-red-600' : 'bg-slate-900'} text-white font-bold`}
                    >
                        {toast.type === 'error' ? <AlertCircle size={20} /> : <Check size={20} />}
                        {toast.message}
                    </motion.div>
                )}
            </AnimatePresence>

            <style>{`
                @keyframes pulse-slow {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.8; transform: scale(0.98); }
                }
                .animate-pulse-slow {
                    animation: pulse-slow 3s infinite ease-in-out;
                }
            `}</style>
        </div>
    );
};

export default EmployeeManager;
