import { useState, useEffect } from 'react';
import { useOnboardingStore } from '@/pages/onboarding/store/useOnboardingStore';

interface HumorousLoaderProps {
    variant?: 'full' | 'mini';
}

const HumorousLoader = ({ variant = 'full' }: HumorousLoaderProps) => {
    const { businessContext } = useOnboardingStore();
    const [msgIndex, setMsgIndex] = useState(0);
    const [percent, setPercent] = useState(0);

    const isNursery = businessContext?.toLowerCase().includes('nursery') || businessContext?.toLowerCase().includes('משתלה');

    const COFFEE_MESSAGES = [
        "מנתח את מבנה המשקה...", "בוחר זווית צילום...", "מחשב מרקם קצף...", "מגדיר תאורה רכה...",
        "מכין את הרקע...", "בוחר ספל הגשה...", "מצייר לאטה ארט...", "מאזן ארומה...",
        "מחדד השתקפויות...", "בודק טריות פולים...", "מוסיף עומק שדה...", "מלטש גימור..."
    ];

    const NURSERY_MESSAGES = [
        "מנתח מבנה צמח...", "בוחר זווית צילום...", "בודק פריחה...", "מחשב לחות עלים...",
        "בוחר עציץ מתאים...", "מסדר תאורת בוקר...", "מכין רקע טבעי...", "בוחן טקסטורת אדמה...",
        "מחדד פרטים בפרח...", "בודק רעננות עלים...", "מוסיף עומק שדה...", "מלטש פוקוס..."
    ];

    const activeMessages = isNursery ? NURSERY_MESSAGES : COFFEE_MESSAGES;

    useEffect(() => {
        const msgInterval = setInterval(() => setMsgIndex(p => (p + 1) % activeMessages.length), 2500);

        // Smarter percentage simulation: starts fast, slows down significantly near end
        const pctInterval = setInterval(() => {
            setPercent(p => {
                if (p < 30) return p + Math.random() * 5; // Fast start
                if (p < 85) return p + Math.random() * 1.5; // Steady middle
                if (p < 98) return p + 0.1; // Very slow end (never hits 100 till done)
                return p;
            });
        }, 300);

        return () => {
            clearInterval(msgInterval);
            clearInterval(pctInterval);
        };
    }, [activeMessages.length]);

    if (variant === 'mini') {
        return (
            <div className="absolute inset-0 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center z-[60] animate-in fade-in duration-300 p-4 text-center overflow-hidden">
                <span className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] animate-pulse block mb-3">Gemini AI Generating</span>

                <div className="w-full max-w-[140px] space-y-2">
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
                        <div
                            className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full shadow-[0_0_10px_rgba(99,102,241,0.4)] transition-all duration-500"
                            style={{ width: `${percent}%` }}
                        />
                    </div>
                    <div className="flex justify-between items-center px-1">
                        <span className="text-[11px] font-black text-slate-800 dir-ltr">{Math.floor(percent)}%</span>
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Processing</span>
                    </div>
                </div>

                <p className="mt-4 text-xs font-bold text-slate-700 dir-rtl leading-relaxed px-2 min-h-[2.5rem] flex items-center justify-center">
                    {activeMessages[msgIndex]}
                </p>
            </div>
        );
    }

    return (
        <div className="absolute inset-0 bg-white/95 backdrop-blur-md flex flex-col items-center justify-center z-[60] animate-in fade-in duration-500 p-8 text-center border-2 border-indigo-500/20 rounded-xl overflow-hidden shadow-2xl">
            <div className="w-14 h-14 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-8 shadow-[0_0_15px_rgba(79,70,229,0.3)]" />

            <div className="space-y-6 w-full max-w-xs">
                <div className="space-y-2">
                    <span className="text-xs font-black text-indigo-500 uppercase tracking-[0.3em] animate-pulse block">Gemini 3 Pro Processing</span>
                    <h4 className="text-lg font-black text-slate-900 bg-white/80 p-4 rounded-xl border border-indigo-50 shadow-sm min-h-[4.5rem] flex items-center justify-center leading-tight">
                        {activeMessages[msgIndex]}
                    </h4>
                </div>

                <div className="space-y-2">
                    <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden p-0.5 border border-slate-200 shadow-inner">
                        <div
                            className="h-full bg-gradient-to-r from-indigo-600 via-purple-500 to-indigo-600 bg-[length:200%_100%] animate-[shimmer_2s_linear_infinite] rounded-full transition-all duration-700"
                            style={{ width: `${percent}%` }}
                        />
                    </div>
                    <p className="text-sm font-black text-indigo-600 flex justify-center items-center gap-2">
                        <span>{Math.floor(percent)}%</span>
                        <span className="w-1 h-1 bg-slate-300 rounded-full" />
                        <span className="text-[10px] text-slate-400 uppercase tracking-widest">Optimizing Image</span>
                    </p>
                </div>
            </div>

            <style>{`
                @keyframes shimmer {
                    0% { background-position: 200% 0; }
                    100% { background-position: -200% 0; }
                }
            `}</style>
        </div>
    );
};

export default HumorousLoader;
