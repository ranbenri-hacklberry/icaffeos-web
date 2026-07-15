
import React, { useState, useEffect } from 'react';
import { ArrowRight, Wifi, WifiOff, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/core/store';

const LiteHeader = ({ title, showBack = true }) => {
    const navigate = useNavigate();
    const { currentUser } = useStore(); // Access store
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        const timer = setInterval(() => setCurrentTime(new Date()), 1000);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            clearInterval(timer);
        };
    }, []);

    return (
        <header className="bg-slate-900 text-white h-16 flex items-center justify-between px-4 shadow-md shrink-0 z-50">
            <div className="flex items-center gap-4">
                {showBack && (
                    <button
                        onClick={() => navigate('/mode-selection')}
                        className="p-2 hover:bg-slate-800 rounded-full transition-colors"
                    >
                        <ArrowRight size={24} />
                    </button>
                )}
                <div>
                    <h1 className="text-xl font-black tracking-wide leading-none">{title}</h1>
                    {(currentUser?.business_name || currentUser?.business_id) && (
                        <div className="text-xs text-slate-400 font-mono mt-0.5">
                            {currentUser.business_name || `ID: ${currentUser.business_id}`}
                        </div>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-6">
                <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
                    <Clock size={16} className="text-slate-400" />
                    <span className="font-mono text-lg font-bold tracking-widest text-slate-200">
                        {currentTime.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                </div>

                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${isOnline ? 'bg-green-900/30 border-green-800 text-green-400' : 'bg-red-900/30 border-red-800 text-red-400'}`}>
                    {isOnline ? <Wifi size={18} /> : <WifiOff size={18} />}
                    <span className="text-xs font-bold">{isOnline ? 'ONLINE' : 'OFFLINE'}</span>
                </div>
            </div>
        </header>
    );
};

export default LiteHeader;
