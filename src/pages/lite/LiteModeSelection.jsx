
import React, { useState, useEffect } from 'react';
import { useStore } from '@/core/store';
import { useNavigate } from 'react-router-dom';
import { Delete } from 'lucide-react';

const LiteModeSelection = () => {
    const { login, currentUser } = useStore();
    const navigate = useNavigate();
    const [pin, setPin] = useState('');
    const [error, setError] = useState(false);

    // Auto-login on PIN completion
    useEffect(() => {
        if (pin.length === 6) { // User asked for 6 digits
            handleLogin(pin);
        }
    }, [pin]);

    const handleLogin = async (code) => {
        const success = await login(code);
        if (success) {
            setPin('');
            setError(false);
        } else {
            setError(true);
            setPin('');
        }
    };

    const handleNumClick = (n) => {
        if (pin.length < 6) {
            setPin(prev => prev + n);
        }
    };

    if (!currentUser) {
        return (
            <div className="h-screen flex items-center justify-center bg-slate-900 font-sans p-4" dir="ltr">
                <div className="bg-white p-8 md:p-10 rounded-3xl shadow-2xl text-center w-full max-w-sm border border-slate-200">
                    <h1 className="text-3xl font-black mb-2 text-slate-800 tracking-tight">Login</h1>
                    <p className="text-slate-500 mb-8 font-medium">icaffeOS Lite</p>

                    {/* PIN Display (Circles) */}
                    <div className="flex justify-center gap-3 mb-8">
                        {[...Array(4)].map((_, i) => (
                            <div
                                key={i}
                                className={`w-4 h-4 rounded-full transition-all duration-200 ${i < pin.length ? 'bg-slate-800 scale-110' : 'bg-slate-200'
                                    }`}
                            />
                        ))}
                    </div>

                    {error && <p className="text-red-500 mb-6 font-bold bg-red-50 py-2 rounded-lg animate-pulse">Incorrect PIN</p>}

                    {/* Numeric Keypad - LTR Layout 1-2-3 */}
                    <div className="grid grid-cols-3 gap-3 mb-4">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                            <button
                                key={n}
                                onClick={() => handleNumClick(n)}
                                className="aspect-[4/3] bg-slate-50 hover:bg-slate-100 active:bg-slate-200 rounded-2xl font-black text-2xl text-slate-800 shadow-sm border border-slate-100 transition-all active:scale-95"
                            >
                                {n}
                            </button>
                        ))}
                        {/* Bottom Row */}
                        <div className="aspect-[4/3]"></div> {/* Empty space for alignment */}
                        <button onClick={() => handleNumClick(0)} className="aspect-[4/3] bg-slate-50 hover:bg-slate-100 active:bg-slate-200 rounded-2xl font-black text-2xl text-slate-800 shadow-sm border border-slate-100 transition-all active:scale-95">0</button>
                        <button onClick={() => setPin(prev => prev.slice(0, -1))} className="aspect-[4/3] bg-white hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-2xl flex items-center justify-center transition-all active:scale-95">
                            <Delete size={28} />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen flex flex-col items-center justify-center bg-slate-900 gap-8 font-sans p-4" dir="rtl">
            <h1 className="text-white text-3xl font-black mb-4">שלום, {currentUser.name}</h1>

            <div className="flex flex-col md:flex-row gap-6 w-full max-w-4xl">
                <button onClick={() => navigate('/')} className="flex-1 bg-white hover:bg-orange-50 p-8 rounded-3xl shadow-xl flex flex-col items-center justify-center gap-4 transition-transform hover:scale-105">
                    <span className="text-6xl">☕</span>
                    <span className="text-3xl font-bold text-slate-800">עמדת קופה</span>
                </button>

                <button onClick={() => navigate('/kds')} className="flex-1 bg-white hover:bg-blue-50 p-8 rounded-3xl shadow-xl flex flex-col items-center justify-center gap-4 transition-transform hover:scale-105">
                    <span className="text-6xl">🍳</span>
                    <span className="text-3xl font-bold text-slate-800">מסך מטבח</span>
                </button>
            </div>

            <div className="text-slate-500 mt-8 text-sm font-mono">
                icaffeOS Lite v1.1
            </div>
        </div>
    );
};
export default LiteModeSelection;
