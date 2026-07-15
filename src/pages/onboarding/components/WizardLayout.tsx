import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOnboardingStore } from '@/pages/onboarding/store/useOnboardingStore';
import BrandIdentityDesigner from '@/pages/onboarding/components/BrandIdentityDesigner';
import MenuDataImporter from '@/pages/onboarding/components/MenuDataImporter';
import MenuReviewDashboard from '@/pages/onboarding/components/MenuReviewDashboard';
import { useTheme } from '@/context/ThemeContext';
import { ChevronLeft, AlertTriangle, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

const WizardLayout = () => {
    const { step, setStep, initSession, isLoading, error, setError } = useOnboardingStore();
    const { isDarkMode } = useTheme();
    const { currentUser } = useAuth();
    const navigate = useNavigate();

    // Init session for resuming data
    useEffect(() => {
        if (!currentUser?.business_id) return;
        initSession(currentUser.business_id);
    }, [currentUser?.business_id, initSession]);

    const variants = {
        enter: { opacity: 0, x: 20 },
        center: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -20 }
    };

    const renderStep = () => {
        switch (step) {
            case 1: return <BrandIdentityDesigner />;
            case 2: return <MenuDataImporter />;
            case 3: return <MenuReviewDashboard />;
            default: return <BrandIdentityDesigner />;
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-400 text-xs font-bold tracking-widest uppercase">Initializing Wizard...</p>
                </div>
            </div>
        );
    }

    return (
        <div className={`min-h-screen flex flex-col ${isDarkMode ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
            {/* Header */}
            <div className={`px-6 py-4 flex items-center justify-between border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/owner-settings')} className={`p-2 rounded-full ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}>
                        <ChevronLeft />
                    </button>
                    <h1 className="text-xl font-bold">Menu Setup Wizard 🪄</h1>
                </div>

                <div className="flex items-center gap-2">
                    {[1, 2, 3].map((s) => (
                        <div key={s} className="flex items-center gap-2">
                            <button
                                onClick={() => setStep(s)}
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all
                                ${step === s ? 'bg-indigo-500 text-white scale-110 shadow-lg shadow-indigo-500/30' :
                                        step > s ? 'bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30' :
                                            'bg-slate-700/30 text-slate-500 hover:bg-slate-700/50'}`}
                            >
                                {s}
                            </button>
                            {s < 3 && <div className={`w-6 h-[2px] rounded-full ${step > s ? 'bg-indigo-500/50' : 'bg-slate-700/30'}`} />}
                        </div>
                    ))}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden relative">
                <AnimatePresence mode='wait'>
                    <motion.div
                        key={step}
                        variants={variants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                        style={{ position: 'absolute', inset: 0, overflowY: 'auto' }}
                    >
                        <div className="max-w-5xl mx-auto p-6 min-h-full">
                            {renderStep()}
                        </div>
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Funny Error Toast */}
            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: 50, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 50, scale: 0.9 }}
                        className="fixed bottom-6 left-6 right-6 md:left-auto md:right-6 md:w-96 bg-white rounded-2xl shadow-2xl border-l-4 border-l-red-500 border border-slate-100 p-4 z-[400] flex gap-4 items-start"
                        dir="rtl"
                    >
                        <div className="bg-red-50 p-2 rounded-full shrink-0">
                            <AlertTriangle className="text-red-500" size={24} />
                        </div>
                        <div className="flex-1">
                            <h4 className="font-black text-slate-800 text-sm mb-1">אופס! קרתה תקלה 🍌</h4>
                            <p className="text-xs text-slate-500 leading-relaxed font-medium mb-2">
                                נראה שהמערכת החליקה על בננה (או סתם באג)...
                            </p>
                            <div className="bg-slate-50 p-2 rounded border border-slate-100 font-mono text-[10px] text-red-400 break-all">
                                {error}
                            </div>
                            <button onClick={() => setError(null)} className="mt-2 text-[10px] font-bold text-slate-400 hover:text-slate-600 underline">
                                סגור והתעלם (כאילו לא קרה כלום)
                            </button>
                        </div>
                        <button onClick={() => setError(null)} className="text-slate-300 hover:text-slate-500">
                            <X size={16} />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div >
    );
};

export default WizardLayout;
