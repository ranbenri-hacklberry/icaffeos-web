import { useState, useEffect } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';
import { ChefHat, Sparkles, XCircle, CheckCircle, Loader2, ArrowRight } from 'lucide-react';
import { useOnboardingStore } from '@/pages/onboarding/store/useOnboardingStore';

const TIPS = [
    "Did you know? Consistent lighting in photos increases sales by 20%.",
    "icaffeOS Tip: Group your modifiers to speed up ordering.",
    "Pro Tip: Use the 'Bar' production area for drinks to route them to the espresso machine.",
    "While we bake your photos, why not wipe down the counters? 😉",
    "AI is working hard... pixel by pixel."
];

const Step4_Generation = () => {
    const { isDarkMode } = useTheme();
    const {
        items,
        isGenerating,
        generationProgress,
        currentItemName,
        startLiveGeneration,
        cancelGeneration,
        setStep,
        error
    } = useOnboardingStore();

    const [tipIndex, setTipIndex] = useState(0);
    const completedItems = items.filter(i => i.status === 'completed');

    // Trigger generation on mount if not already generating/completed
    useEffect(() => {
        if (!isGenerating && generationProgress === 0) {
            startLiveGeneration();
        }
    }, [isGenerating, generationProgress, startLiveGeneration]);

    // Rotate tips
    useEffect(() => {
        const tipInterval = setInterval(() => {
            setTipIndex(i => (i + 1) % TIPS.length);
        }, 8000);
        return () => clearInterval(tipInterval);
    }, []);

    return (
        <div className="h-full flex flex-col items-center p-8 gap-8 overflow-y-auto">
            {/* Header Logic */}
            <div className="text-center space-y-2">
                <h2 className="text-4xl font-black bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                    {isGenerating ? "המטבח הדיגיטלי עובד..." : (generationProgress === 100 ? "התפריט מוכן!" : "התהליך נעצר")}
                </h2>
                <div className="text-slate-400">אנחנו יוצרים תמונות ריאליסטיות שמתאימות לאווירה שבחרת.</div>
            </div>

            {/* Main Stage: Live Preview & Progress */}
            <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-8">

                {/* Left: Progress & Controls */}
                <div className={`p-6 rounded-3xl border ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200 shadow-xl'} space-y-6`}>
                    <div className="relative w-32 h-32 mx-auto">
                        <svg className="w-full h-full" viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="45" fill="none" strokeWidth="8" className={isDarkMode ? "stroke-slate-700" : "stroke-slate-100"} />
                            <motion.circle
                                cx="50" cy="50" r="45" fill="none" strokeWidth="8"
                                className="stroke-indigo-500"
                                strokeLinecap="round"
                                strokeDasharray="283"
                                initial={{ strokeDashoffset: 283 }}
                                animate={{ strokeDashoffset: 283 - (283 * generationProgress) / 100 }}
                            />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                            {isGenerating ? (
                                <ChefHat size={40} className="text-indigo-400 animate-bounce" />
                            ) : (
                                <CheckCircle size={40} className="text-emerald-500" />
                            )}
                        </div>
                    </div>

                    <div className="text-center">
                        <div className="text-3xl font-mono font-bold">{generationProgress}%</div>
                        <p className="text-sm text-slate-400 mt-1">
                            {currentItemName ? `עובדים על: ${currentItemName}` : 'ממתין לתור...'}
                        </p>
                    </div>

                    {isGenerating && (
                        <button
                            onClick={cancelGeneration}
                            className="w-full py-3 rounded-xl border border-red-500/30 text-red-500 hover:bg-red-500/10 transition-colors flex items-center justify-center gap-2 font-bold"
                        >
                            <XCircle size={18} />
                            עצור הפקה
                        </button>
                    )}

                    {!isGenerating && generationProgress < 100 && (
                        <button
                            onClick={startLiveGeneration}
                            className="w-full py-3 rounded-xl bg-indigo-500 text-white hover:bg-indigo-600 transition-colors font-bold"
                        >
                            המשך הפקה
                        </button>
                    )}

                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs text-center">
                            {error}
                        </div>
                    )}
                </div>

                {/* Right: Live Grid (2 columns on md) */}
                <div className="md:col-span-2 space-y-4">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                        <Sparkles size={18} className="text-amber-400" />
                        תוצרים אחרונים
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        <AnimatePresence>
                            {completedItems.map((item) => (
                                <motion.div
                                    key={item.id}
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                >
                                    <div className={`aspect-square rounded-2xl overflow-hidden border ${isDarkMode ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-slate-50'} relative group`}>
                                        <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                                            <div className="text-[10px] text-white font-bold truncate">{item.name}</div>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                            {isGenerating && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                >
                                    <div className={`aspect-square rounded-2xl border-2 border-dashed ${isDarkMode ? 'border-slate-700' : 'border-slate-200'} flex flex-col items-center justify-center gap-2 text-slate-500`}>
                                        <Loader2 size={24} className="animate-spin text-indigo-400" />
                                        <span className="text-[10px]">מייצר...</span>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            <div className="max-w-xl w-full h-16 bg-slate-500/5 rounded-2xl p-4 border border-slate-500/10 mt-auto flex items-center justify-center">
                <AnimatePresence mode='wait'>
                    <motion.div
                        key={tipIndex}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                    >
                        <div className="text-sm italic text-slate-400 text-center">
                            "{TIPS[tipIndex]}"
                        </div>
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Next Button - Visible only when all items are 'completed' or 'approved' or 'error' */}
            {items.every(i => i.status === 'completed' || i.status === 'done' || i.status === 'error' || i.status === 'approved') && !isGenerating && (
                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                >
                    <div className="mt-8 flex justify-center">
                        <button
                            onClick={() => setStep(5)}
                            className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-lg flex items-center gap-2 transition-all shadow-xl shadow-indigo-500/20 active:scale-95"
                        >
                            המשך לסיכום והפעלה
                            <ArrowRight size={20} />
                        </button>
                    </div>
                </motion.div>
            )}
        </div>
    );
};

export default Step4_Generation;
