
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, CheckSquare, Square, Search, Users, Shield, User, Loader2, MessageCircle, MessageSquare } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCommunication } from '@/hooks/useCommunication';

const TeamMessageModal = ({ businessId, onClose, activeEmployee }) => {
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedEmployees, setSelectedEmployees] = useState([]);
    const [message, setMessage] = useState('');
    const [filter, setFilter] = useState('all'); // 'all', 'manager', 'staff'
    const [sending, setSending] = useState(false);
    const [results, setResults] = useState(null);

    const { sendWhatsApp, sendSMS } = useCommunication();

    // Fetch employees on mount
    useEffect(() => {
        const fetchEmployees = async () => {
            if (!businessId) return;
            try {
                const { data, error } = await supabase
                    .from('employees')
                    .select('id, name, phone, access_level')
                    .eq('business_id', businessId)
                    .neq('id', activeEmployee?.id); // Don't send to self

                if (error) throw error;

                // Filter out invalid phones if needed
                const validEmployees = data.filter(e => e.phone && e.phone.length > 8);
                setEmployees(validEmployees);
                setSelectedEmployees(validEmployees.map(e => e.id)); // Select all by default
            } catch (err) {
                console.error('Failed to fetch employees:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchEmployees();
    }, [businessId, activeEmployee?.id]);

    // Update selection when filter changes
    useEffect(() => {
        if (loading) return;

        let filteredCodes = [];
        if (filter === 'all') {
            filteredCodes = employees.map(e => e.id);
        } else if (filter === 'manager') {
            filteredCodes = employees
                .filter(e => ['owner', 'admin', 'manager'].includes(e.access_level))
                .map(e => e.id);
        } else if (filter === 'staff') {
            filteredCodes = employees
                .filter(e => !['owner', 'admin'].includes(e.access_level)) // Staff + Managers who aren't owners
                .map(e => e.id);
        }
        setSelectedEmployees(filteredCodes);
    }, [filter, employees, loading]);

    const toggleSelection = (id) => {
        setSelectedEmployees(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const handleSend = async () => {
        if (!message.trim() || selectedEmployees.length === 0) return;

        setSending(true);
        const targets = employees.filter(e => selectedEmployees.includes(e.id));

        let successCount = 0;
        let failCount = 0;

        // Process sequentially to avoid rate limits (or parallel if needed)
        // For better UX, let's do parallel chunks
        const promises = targets.map(async (emp) => {
            let method = 'whatsapp';
            try {
                // Try WhatsApp first
                await sendWhatsApp(emp.phone, message);
                return { name: emp.name, status: 'success', method: 'whatsapp' };
            } catch (waErr) {
                console.warn(`WhatsApp failed for ${emp.name}, trying SMS...`, waErr);
                try {
                    // Fallback to SMS
                    await sendSMS(emp.phone, message);
                    return { name: emp.name, status: 'success', method: 'sms' };
                } catch (smsErr) {
                    console.error(`SMS also failed for ${emp.name}`, smsErr);
                    return { name: emp.name, status: 'failed', error: smsErr.message };
                }
            }
        });

        const results = await Promise.all(promises);
        setResults(results);
        setSending(false);

        // Auto close after 3 seconds if all success
        if (results.every(r => r.status === 'success')) {
            setTimeout(onClose, 2500);
        }
    };

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" dir="rtl">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
                {/* Header */}
                <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
                    <div>
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <MessageCircle className="text-purple-400" size={20} />
                            הודעה לצוות
                        </h2>
                        <p className="text-xs text-slate-400">שלח עדכון חשוב לכולם או לקבוצות</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {results ? (
                    // Results View
                    <div className="flex-1 overflow-y-auto p-6 text-center">
                        <div className="mb-4">
                            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                                <Send className="text-green-400 w-8 h-8" />
                            </div>
                            <h3 className="text-xl font-bold text-white">ההודעות נשלחו!</h3>
                            <p className="text-slate-400 text-sm">סיכום שליחה ל-{results.length} אנשי צוות</p>
                        </div>

                        <div className="space-y-2 text-right">
                            {results.map((res, idx) => (
                                <div key={idx} className="flex justify-between items-center bg-slate-800 p-3 rounded-lg border border-slate-700">
                                    <span className="text-white font-medium">{res.name}</span>
                                    {res.status === 'success' ? (
                                        <span className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-400 flex items-center gap-1">
                                            {res.method === 'whatsapp' ? <MessageCircle size={12} /> : <MessageSquare size={12} />}
                                            נשלח
                                        </span>
                                    ) : (
                                        <span className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-400">נכשל</span>
                                    )}
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={onClose}
                            className="mt-6 w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-all"
                        >
                            סגור
                        </button>
                    </div>
                ) : (
                    // Compose View
                    <div className="flex flex-col h-full overflow-hidden">

                        {/* Filters */}
                        <div className="p-4 flex gap-2 overflow-x-auto border-b border-slate-800">
                            {[
                                { id: 'all', label: 'כל הצוות', icon: Users },
                                { id: 'manager', label: 'מנהלים בלבד', icon: Shield },
                                { id: 'staff', label: 'עובדים', icon: User }
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setFilter(tab.id)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 whitespace-nowrap transition-all
                                        ${filter === tab.id
                                            ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20'
                                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'}`}
                                >
                                    <tab.icon size={14} />
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Employee List */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-[150px]">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center h-20 text-slate-500 gap-2">
                                    <Loader2 className="animate-spin" />
                                    <span className="text-xs">טוען עובדים...</span>
                                </div>
                            ) : employees.length === 0 ? (
                                <div className="text-center text-slate-500 py-8">
                                    לא נמצאו עובדים ברשימה
                                </div>
                            ) : (
                                employees.map(emp => {
                                    const isSelected = selectedEmployees.includes(emp.id);
                                    return (
                                        <div
                                            key={emp.id}
                                            onClick={() => toggleSelection(emp.id)}
                                            className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all
                                                ${isSelected
                                                    ? 'bg-purple-500/10 border-purple-500/50'
                                                    : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
                                                    ${['owner', 'admin'].includes(emp.access_level) ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700 text-slate-300'}`}>
                                                    {emp.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <div className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-slate-400'}`}>
                                                        {emp.name}
                                                    </div>
                                                    <div className="text-[10px] text-slate-500 uppercase">{emp.access_level}</div>
                                                </div>
                                            </div>

                                            <div className={isSelected ? 'text-purple-400' : 'text-slate-600'}>
                                                {isSelected ? <CheckSquare size={20} /> : <Square size={20} />}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Compose Area */}
                        <div className="p-4 bg-slate-800 border-t border-slate-700">
                            <div className="bg-slate-900 rounded-xl p-3 border border-slate-700 focus-within:border-purple-500/50 transition-colors">
                                <textarea
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    placeholder="כתוב הודעה לצוות כאן..."
                                    className="w-full bg-transparent text-white placeholder:text-slate-500 text-sm resize-none focus:outline-none min-h-[80px]"
                                    autoFocus
                                />
                                <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-800">
                                    <span className="text-xs text-slate-500">
                                        ישלח ל-{selectedEmployees.length} נמענים
                                    </span>
                                    <button
                                        onClick={handleSend}
                                        disabled={sending || !message.trim() || selectedEmployees.length === 0}
                                        className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-900/20 transition-all active:scale-95"
                                    >
                                        {sending ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                                        {sending ? 'שולח...' : 'שלח הודעה'}
                                    </button>
                                </div>
                            </div>
                            <div className="mt-2 text-[10px] text-slate-500 text-center">
                                * המערכת תנסה לשלוח WhatsApp, ואם נכשל תשלח SMS
                            </div>
                        </div>
                    </div>
                )}
            </motion.div>
        </div>
    );
};

export default TeamMessageModal;
