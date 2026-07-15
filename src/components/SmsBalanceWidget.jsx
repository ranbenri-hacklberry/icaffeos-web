import React, { useState, useEffect } from 'react';
import { MessageSquare, ExternalLink } from 'lucide-react';
import { getSmsBalance } from '@/services/smsService';

const SmsBalanceWidget = () => {
    const [balance, setBalance] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Initial Fetch
        getSmsBalance().then(bal => {
            setBalance(bal);
            setLoading(false);
        });

        // Listen for live updates
        const handleUpdate = (e) => setBalance(e.detail);
        window.addEventListener('sms-balance-updated', handleUpdate);
        return () => window.removeEventListener('sms-balance-updated', handleUpdate);
    }, []);

    if (loading) return <div className="h-6 w-24 bg-white/5 rounded-full animate-pulse mx-auto mb-3" />;

    return (
        <a
            href="https://itnewsletter.itnewsletter.co.il/app/login.html"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white px-3 py-1.5 rounded-full transition-all text-sm mb-3 group border border-white/5 hover:border-white/20"
        >
            <MessageSquare size={14} className={balance < 50 ? "text-red-400" : "text-emerald-400"} />
            <span className="font-medium">
                יתרת הודעות: <span className={balance < 50 ? "text-red-400 font-bold" : "text-emerald-400 font-bold"}>{balance !== null ? balance : '---'}</span>
            </span>
            <ExternalLink size={12} className="opacity-50 group-hover:opacity-100 transition-opacity" />
        </a>
    );
};

export default SmsBalanceWidget;
