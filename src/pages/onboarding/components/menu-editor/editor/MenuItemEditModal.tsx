import { useState, useEffect } from 'react';
import { X, ChefHat, Package, Wand2, Plus, Settings, Clock, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { OnboardingItem } from '@/pages/onboarding/types/onboardingTypes';
import { useOnboardingStore } from '@/pages/onboarding/store/useOnboardingStore';
import { supabase } from '@/lib/supabase';
import { analyzeVisualSeed, compressImageToBlob } from '@/pages/onboarding/logic/onboardingLogic';
import { AlertCircle, Trash2 } from 'lucide-react';

// Tabs
import TabGeneralDetails from '@/pages/onboarding/components/menu-editor/editor/tabs/TabGeneralDetails';
import TabVisualsAI from '@/pages/onboarding/components/menu-editor/editor/tabs/TabVisualsAI';
import TabModifiers from '@/pages/onboarding/components/menu-editor/editor/tabs/TabModifiers';
import TabRecipe from '@/pages/onboarding/components/menu-editor/editor/tabs/TabRecipe';
import TabPrep from '@/pages/onboarding/components/menu-editor/editor/tabs/TabPrep';
import ManagerAuthModal from '@/components/ManagerAuthModal';

interface MenuItemEditModalProps {
    item: OnboardingItem;
    onClose: () => void;
}

const MenuItemEditModal = ({ item, onClose }: MenuItemEditModalProps) => {
    const [activeTab, setActiveTab] = useState<'main' | 'visuals' | 'modifiers' | 'recipe' | 'prep'>('main');
    const [isFlipped, setIsFlipped] = useState(false);
    const [showSaleDates, setShowSaleDates] = useState(!!item.saleStartDate || !!item.saleEndDate);
    const {
        updateItem, regenerateSingleItem, uploadOriginalImage,
        atmosphereSeeds, addAtmosphereSeed, removeAtmosphereSeed,
        businessId, geminiApiKey, items: allItems
    } = useOnboardingStore();

    const [localItem, setLocalItem] = useState<OnboardingItem>({ ...item });
    const [currentStock, setCurrentStock] = useState<number | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Fetch Inventory
    useEffect(() => {
        if (!item.id || item.id.toString().startsWith('local-')) return;
        const fetchInventory = async () => {
            const { data } = await supabase
                .from('prepared_items_inventory')
                .select('current_stock')
                .eq('item_id', item.id)
                .maybeSingle();
            if (data) setCurrentStock(data.current_stock);
        };
        fetchInventory();
    }, [item.id]);

    const [isUploadingBackground, setIsUploadingBackground] = useState(false);
    const [isUploadingContainer, setIsUploadingContainer] = useState(false);
    const [generationError, setGenerationError] = useState<string | null>(null);
    const [saveSuccess, setSaveSuccess] = useState(false);

    // Sync local item with store for AI updates
    useEffect(() => {
        const freshItem = allItems.find(i => i.id === item.id);
        if (freshItem) {
            setLocalItem(prev => ({
                ...prev,
                status: freshItem.status,
                imageUrl: freshItem.imageUrl,
                modifiers: freshItem.modifiers || [],
                generationTime: freshItem.generationTime,
                powerSource: freshItem.powerSource,
                lastPrompt: freshItem.lastPrompt,
                originalImageUrls: freshItem.originalImageUrls // Ensure URLs are synced
            }));
            if (freshItem.status === 'completed') setGenerationError(null);
        }
    }, [allItems, item.id]);

    const handleUploadSeed = async (file: File, type: 'container' | 'background') => {
        if (!file || !file.type.startsWith('image/')) return;
        type === 'background' ? setIsUploadingBackground(true) : setIsUploadingContainer(true);
        const tempId = uuidv4();
        try {
            const compressedFile = await compressImageToBlob(file);
            const fileExt = file.name.split('.').pop();
            const fileName = `wizard/${businessId || 'anonymous'}/seed_${tempId}.${fileExt}`;
            const { error: uploadError } = await supabase.storage.from('menu-images').upload(fileName, compressedFile);
            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage.from('menu-images').getPublicUrl(fileName);

            // 🛡️ FIRST: Add to local state immediately so image is never lost
            const newSeed = { id: tempId, blob: publicUrl, type, promptHint: `User ${type}`, storagePath: fileName };
            addAtmosphereSeed(newSeed);
            if (type === 'container') setLocalItem(prev => ({ ...prev, selectedContainerId: tempId }));
            if (type === 'background') setLocalItem(prev => ({ ...prev, selectedBackgroundId: tempId }));

            // 🧠 SECOND: Background AI Analysis (Doesn't block the UI anymore)
            setTimeout(async () => {
                try {
                    const visionDescription = await analyzeVisualSeed(publicUrl, type, geminiApiKey || undefined);
                    // Update the seed hint silently when ready
                    const { atmosphereSeeds: currentSeeds } = useOnboardingStore.getState();
                    const seedToUpdate = currentSeeds.find(s => s.id === tempId);
                    if (seedToUpdate) {
                        useOnboardingStore.setState(state => ({
                            atmosphereSeeds: state.atmosphereSeeds.map(s => s.id === tempId ? { ...s, promptHint: visionDescription } : s)
                        }));
                    }
                } catch (e) { console.warn("Background analysis skipped:", e); }
            }, 100);

        } catch (error) { console.error('Seed upload failed:', error); }
        finally { type === 'background' ? setIsUploadingBackground(false) : setIsUploadingContainer(false); }
    };

    const handleSave = async (autoGenerate = false, shouldClose = true) => {
        setIsSaving(true);
        try {
            await updateItem(item.id, localItem);

            // 🛡️ Robust Verification: Check by ID or Name/Category (handles local->numeric ID transition)
            const allItemsInStore = useOnboardingStore.getState().items;
            const saved = allItemsInStore.find(i => i.id === item.id) ||
                allItemsInStore.find(i => i.name === localItem.name && i.category === localItem.category);

            if (saved) {
                // Update localItem with new ID if it changed
                if (saved.id !== localItem.id) {
                    setLocalItem(prev => ({ ...prev, id: saved.id }));
                }
                setSaveSuccess(true);
                setTimeout(() => {
                    setSaveSuccess(false);
                    if (shouldClose && !autoGenerate) onClose();
                }, 1500);
            }

            if (autoGenerate) await regenerateSingleItem(item.id);
        } catch (e) {
            console.error("Save failed", e);
            alert("שגיאה בשמירה. אנא וודא חיבור לאינטרנט.");
        }
        setIsSaving(false);
    };

    const [showDeleteAuth, setShowDeleteAuth] = useState(false);

    const checkDeleteAuth = () => {
        setShowDeleteAuth(true);
    };

    const performDelete = async () => {
        try {
            await useOnboardingStore.getState().deleteItem(item.id);
            onClose();
        } catch (e) {
            console.error("Delete failed", e);
            alert("שגיאה במחיקת פריט");
        }
    };

    const StatusBadge = () => (
        <div className="flex items-center gap-2 mb-1">
            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${localItem.status === 'completed' ? 'bg-emerald-500 text-white' : 'bg-amber-100 text-amber-700'}`}>
                {localItem.status}
            </span>
            {localItem.saleEndDate && (
                <span className="text-[9px] font-bold text-rose-500 flex items-center gap-1 bg-rose-50 px-2 py-0.5 rounded border border-rose-100 animate-pulse">
                    <Clock size={8} /> מבצע עד {new Date(localItem.saleEndDate).toLocaleDateString('he-IL')}
                </span>
            )}
        </div>
    );

    return (
        <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300" dir="rtl">
            <div className="w-full max-w-4xl h-[100dvh] sm:h-[90vh] bg-white sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-300">
                {/* Header */}
                <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col gap-4 shrink-0 bg-white/80 backdrop-blur sticky top-0 z-50">
                    {/* Success Overlay */}
                    <AnimatePresence>
                        {saveSuccess && (
                            <div className="absolute inset-0 z-[100] pointer-events-none">
                                <motion.div
                                    initial={{ opacity: 0, y: -50 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -50 }}
                                    style={{ width: '100%', height: '100%' }}
                                >
                                    <div className="w-full h-full bg-emerald-500 text-white flex items-center justify-center gap-4 shadow-xl pointer-events-auto">
                                        <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                                            <Check size={28} className="text-white" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-xl font-black">נשמר בהצלחה!</span>
                                            <span className="text-xs font-bold opacity-80">כל השינויים עודכנו בענן.</span>
                                        </div>
                                    </div>
                                </motion.div>
                            </div>
                        )}
                    </AnimatePresence>

                    {/* Error Banner */}
                    {useOnboardingStore.getState().error && useOnboardingStore.getState().error?.includes('GEMINI_KEY') && (
                        <div className="mb-2 p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-center justify-between animate-in slide-in-from-top-4 duration-300">
                            <div className="flex items-center gap-3">
                                <AlertCircle size={18} className="text-rose-500" />
                                <span className="text-[11px] font-bold text-rose-700">
                                    {useOnboardingStore.getState().error === 'GEMINI_KEY_LEAKED' ? 'המפתח נחסם מטעמי אבטחה' : 'מפתח API לא תקין'}
                                </span>
                            </div>
                            <button
                                onClick={() => useOnboardingStore.setState({ error: 'MISSING_API_KEY' })}
                                className="px-3 py-1 bg-rose-600 text-white text-[10px] font-black uppercase rounded-lg shadow-sm hover:bg-rose-700 transition-all"
                            >
                                תקן עכשיו
                            </button>
                        </div>
                    )}

                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-4 flex-1">
                            {/* Close Button Replaces Chef Hat */}
                            <button
                                onClick={onClose}
                                className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors shadow-sm shrink-0"
                            >
                                <X size={28} />
                            </button>

                            <div className="flex-1 min-w-0">
                                <StatusBadge />
                                <h2 className="text-xl sm:text-2xl font-black text-slate-800 truncate leading-tight">
                                    {localItem.name || 'מוצר חדש'}
                                    <span className="mr-2 text-slate-300 text-sm font-normal">/ {localItem.englishName || 'Unnamed'}</span>
                                </h2>
                                {currentStock !== null && (
                                    <p className="text-emerald-500 font-bold text-xs mt-1">
                                        במלאי כעת: {currentStock} יחידות
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Delete Button (Left Side) - Added */}
                        <button
                            onClick={checkDeleteAuth}
                            className="w-10 h-10 rounded-xl bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center transition-colors shadow-sm"
                            title="מחק מנה"
                        >
                            <Trash2 size={20} />
                        </button>
                    </div>

                    {/* Navbar */}
                    <div className="flex bg-slate-100/80 p-1 rounded-xl overflow-x-auto no-scrollbar gap-1 flex-none">
                        {[
                            { id: 'main', label: 'פרטי מנה', icon: <Package size={14} /> },
                            { id: 'visuals', label: 'ויזואל & AI', icon: <Wand2 size={14} /> },
                            { id: 'modifiers', label: 'תוספות', icon: <Plus size={14} /> },
                            { id: 'recipe', label: 'מתכון ורכיבים', icon: <ChefHat size={14} /> },
                            { id: 'prep', label: 'הכנה ומלאי', icon: <Settings size={14} /> }
                        ].map(t => (
                            <button
                                key={t.id}
                                onClick={() => setActiveTab(t.id as any)}
                                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-[10px] sm:text-xs font-black transition-all whitespace-nowrap ${activeTab === t.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                            >
                                {t.icon} {t.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className={`flex-1 overflow-y-auto custom-scrollbar bg-slate-50/30 ${['recipe', 'prep'].includes(activeTab) ? 'p-0 overflow-hidden flex flex-col' : 'px-4 sm:px-8 py-6'}`}>
                    {activeTab === 'main' && (
                        <TabGeneralDetails
                            localItem={localItem}
                            setLocalItem={setLocalItem}
                            allItems={allItems}
                            showSaleDates={showSaleDates}
                            setShowSaleDates={setShowSaleDates}
                        />
                    )}
                    {activeTab === 'visuals' && (
                        <TabVisualsAI
                            localItem={localItem}
                            setLocalItem={setLocalItem}
                            isFlipped={isFlipped}
                            setIsFlipped={setIsFlipped}
                            regenerateSingleItem={async (id) => {
                                setGenerationError(null);
                                await updateItem(id, localItem);
                                try {
                                    await regenerateSingleItem(id);
                                } catch (e: any) {
                                    console.error("Manual regeneration failed:", e);
                                    setGenerationError(e.message || "Something went wrong.");
                                }
                            }}
                            uploadOriginalImage={async (id, file) => {
                                try {
                                    const url = await uploadOriginalImage(id, file);
                                    return url;
                                } finally {
                                }
                            }}
                            atmosphereSeeds={atmosphereSeeds}
                            handleUploadSeed={handleUploadSeed}
                            removeAtmosphereSeed={removeAtmosphereSeed}
                            isUploadingBackground={isUploadingBackground}
                            isUploadingContainer={isUploadingContainer}
                            generationError={generationError}
                        />
                    )}
                    {activeTab === 'modifiers' && (
                        <TabModifiers
                            localItem={localItem}
                            setLocalItem={setLocalItem}
                        />
                    )}
                    {activeTab === 'recipe' && (
                        <div className="h-full p-4 sm:p-8 overflow-hidden">
                            <TabRecipe
                                localItem={localItem}
                                setLocalItem={setLocalItem}
                                onSave={() => handleSave(false, false)}
                            />
                        </div>
                    )}
                    {activeTab === 'prep' && (
                        <div className="h-full p-4 sm:p-8 overflow-hidden">
                            <TabPrep
                                localItem={localItem}
                                setLocalItem={setLocalItem}
                            />
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-100 bg-slate-50/80 flex gap-3 flex-none">
                    {/* Trash removed from here */}

                    <button onClick={onClose} className="px-6 py-3 rounded-xl text-slate-400 font-bold text-xs uppercase tracking-wider hover:bg-slate-100 hover:text-slate-600 transition-all">ביטול</button>

                    <button onClick={() => handleSave(false, false)} className="flex-1 py-3 bg-white border border-slate-200 text-indigo-600 font-black text-xs uppercase tracking-wider rounded-xl hover:bg-indigo-50 hover:border-indigo-100 shadow-sm transition-all">
                        שמור (המשך עריכה)
                    </button>

                    <button onClick={() => handleSave(false, true)} disabled={isSaving} className="flex-1 py-3 bg-slate-900 hover:bg-black text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all active:scale-95 transform hover:-translate-y-0.5">
                        {isSaving ? 'שומר...' : 'שמור וסגור'}
                    </button>
                </div>

                <ManagerAuthModal
                    isOpen={showDeleteAuth}
                    actionDescription={`מחיקת מנה: ${localItem.name}`}
                    onSuccess={() => {
                        setShowDeleteAuth(false);
                        performDelete();
                    }}
                    onCancel={() => setShowDeleteAuth(false)}
                />
            </div>

        </div>
    );
};

export default MenuItemEditModal;
