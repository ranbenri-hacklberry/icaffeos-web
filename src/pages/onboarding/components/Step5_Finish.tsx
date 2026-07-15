import { useState } from 'react';
import { motion } from 'framer-motion';
import { useOnboardingStore } from '@/pages/onboarding/store/useOnboardingStore';
import { useTheme } from '@/context/ThemeContext';
import {
    CheckCircle2,
    Rocket,
    LayoutDashboard,
    ShoppingBag,
    Sparkles,
    Loader2,
    AlertCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Step5_Finish = () => {
    const { isDarkMode } = useTheme();
    const { items, finalizeImport, isLoading, error } = useOnboardingStore();
    const navigate = useNavigate();
    const [isFinished, setIsFinished] = useState(false);

    const categories = Array.from(new Set(items.map(i => i.category)));
    const totalItems = items.length;
    const itemsWithImages = items.filter(i => i.imageUrl || i.manualImage).length;

    const handleGoLive = async () => {
        try {
            await finalizeImport();
            setIsFinished(true);
            // Confetti or celebratory sound could go here
        } catch (e) {
            // Error is handled in store
        }
    };

    if (isFinished) {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
            >
                <div className="flex flex-col items-center justify-center p-12 text-center space-y-8">
                    <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center shadow-xl shadow-green-500/20">
                        <CheckCircle2 size={48} className="text-white" />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-4xl font-extrabold tracking-tight">ברוכים הבאים ל-icaffeOS! 🚀</h2>
                        <p className="text-xl text-slate-400">התפריט שלך מוכן ומחכה לך בלוח הבקרה.</p>
                    </div>
                    <div className="flex gap-4">
                        <button
                            onClick={() => navigate('/owner-settings')}
                            className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
                        >
                            <LayoutDashboard size={20} />
                            חזור להגדרות
                        </button>
                    </div>
                </div>
            </motion.div>
        );
    }

    return (
        <div className="flex flex-col gap-8 max-w-4xl mx-auto py-10">
            {/* Celebration Header */}
            <div className="space-y-4 text-center">
                <motion.div
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                >
                    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border ${isDarkMode ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' : 'bg-indigo-50 border-indigo-100 text-indigo-600'} text-xs font-bold uppercase tracking-wider`}>
                        <Sparkles size={14} />
                        הגעת לקו הסיום
                    </div>
                </motion.div>
                <h2 className="text-4xl font-black tracking-tight">התפריט שלך מוכן להרצה</h2>
                <p className="text-slate-400 max-w-xl mx-auto">
                    כל המנות עובדו, התמונות נוצרו, והכל מסונכרן. עכשיו רק נותר להעלות הכל לאוויר.
                </p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className={`p-6 rounded-3xl border transition-all ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-100 shadow-sm'} flex flex-col items-center gap-2`}>
                    <span className="text-3xl font-black text-indigo-500">{totalItems}</span>
                    <span className="text-xs text-slate-500 font-bold uppercase">סה"כ מנות</span>
                </div>
                <div className={`p-6 rounded-3xl border transition-all ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-100 shadow-sm'} flex flex-col items-center gap-2`}>
                    <span className="text-3xl font-black text-amber-500">{categories.length}</span>
                    <span className="text-xs text-slate-500 font-bold uppercase">קטגוריות</span>
                </div>
                <div className={`p-6 rounded-3xl border transition-all ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-100 shadow-sm'} flex flex-col items-center gap-2`}>
                    <span className="text-3xl font-black text-emerald-500">{itemsWithImages}</span>
                    <span className="text-xs text-slate-500 font-bold uppercase">מנות עם תמונה</span>
                </div>
            </div>

            {/* Detailed Preview */}
            <div className={`rounded-3xl border ${isDarkMode ? 'bg-slate-800/20 border-slate-800' : 'bg-slate-100 border-slate-200'} p-8`}>
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                    <ShoppingBag size={20} className="text-indigo-400" />
                    פירוט לפי קטגוריה
                </h3>
                <div className="space-y-3">
                    {categories.map((cat) => (
                        <div key={cat} className={`flex items-center justify-between p-4 rounded-2xl ${isDarkMode ? 'bg-slate-800/40 hover:bg-slate-800/60' : 'bg-white hover:bg-slate-50'} transition-colors border ${isDarkMode ? 'border-slate-700/50' : 'border-slate-200'}`}>
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-indigo-500" />
                                <span className="font-bold">{cat}</span>
                            </div>
                            <span className="text-sm text-slate-500">{items.filter(i => i.category === cat).length} מנות</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Final Action */}
            <div className="mt-8 flex flex-col items-center gap-6">
                {error && (
                    <div className="w-full p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-500">
                        <AlertCircle size={20} />
                        <p className="text-sm italic font-medium">{error}</p>
                    </div>
                )}

                <button
                    disabled={isLoading}
                    onClick={handleGoLive}
                    className={`group relative px-12 py-6 rounded-3xl font-black text-xl transition-all overflow-hidden
                    ${isLoading ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-500 hover:scale-105 active:scale-95 shadow-2xl shadow-indigo-500/40'}`}
                >
                    <div className="flex items-center gap-3 relative z-10">
                        {isLoading ? (
                            <>
                                <Loader2 size={24} className="animate-spin" />
                                מעלה נתונים...
                            </>
                        ) : (
                            <>
                                <Rocket size={24} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                                סנכרן ועבור לתפריט
                            </>
                        )}
                    </div>
                    {!isLoading && (
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                    )}
                </button>

                <p className="text-slate-500 text-sm italic">
                    בלחיצה על הכפתור, כל המנות יישמרו בבסיס הנתונים ויוצגו בטאבלטים.
                </p>
            </div>
        </div>
    );
};

export default Step5_Finish;
