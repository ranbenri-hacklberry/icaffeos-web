import { useState } from 'react';
import { X, Plus, Check, RefreshCw, Wand2 } from 'lucide-react';
import { useOnboardingStore } from '@/pages/onboarding/store/useOnboardingStore';
import { supabase } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import { analyzeVisualSeed } from '@/pages/onboarding/logic/onboardingLogic';

interface CategoryDesignModalProps {
    category: string;
    onClose: () => void;
}

const CategoryDesignModal = ({ category, onClose }: CategoryDesignModalProps) => {
    const { atmosphereSeeds, categorySeeds, setCategorySeed, regenerateSingleItem, items } = useOnboardingStore();
    const currentConfig = categorySeeds[category] || {};
    const [localConfig, setLocalConfig] = useState(currentConfig);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploadingBg, setIsUploadingBg] = useState(false);
    const [isUploadingCont, setIsUploadingCont] = useState(false);

    const handleUploadSeed = async (file: File, type: 'container' | 'background') => {
        if (type === 'background') setIsUploadingBg(true); else setIsUploadingCont(true);
        try {
            const tempId = uuidv4();
            const { businessId, addAtmosphereSeed } = useOnboardingStore.getState();

            const fileExt = file.name.split('.').pop();
            const fileName = `seeds/${businessId || 'anon'}/${type}_${tempId}.${fileExt}`;
            const { error: uploadError } = await supabase.storage.from('menu-images').upload(fileName, file);
            if (uploadError) throw uploadError;

            const { data: { publicUrl: finalUrl } } = supabase.storage.from('menu-images').getPublicUrl(fileName);

            const visionDescription = await analyzeVisualSeed(finalUrl, type);

            const newSeed = {
                id: tempId,
                blob: finalUrl,
                type,
                promptHint: visionDescription,
                storagePath: fileName
            };
            addAtmosphereSeed(newSeed);

            if (type === 'background') {
                setLocalConfig(prev => ({ ...prev, backgroundIds: [...(prev.backgroundIds || []), tempId] }));
            } else {
                setLocalConfig(prev => ({ ...prev, containerIds: [...(prev.containerIds || []), tempId] }));
            }

        } catch (err) {
            console.error('Upload failed:', err);
            alert('העלאה נכשלה. נסה שנית.');
        } finally {
            if (type === 'background') setIsUploadingBg(false); else setIsUploadingCont(false);
        }
    };

    const handleSave = async (regenerateElements = false) => {
        setIsSaving(true);
        setCategorySeed(category, localConfig);

        if (regenerateElements) {
            const categoryItems = items.filter(i => i.category === category);
            const CHUNK_SIZE = 3;
            for (let i = 0; i < categoryItems.length; i += CHUNK_SIZE) {
                const chunk = categoryItems.slice(i, i + CHUNK_SIZE);
                await Promise.all(chunk.map(item => regenerateSingleItem(item.id)));
                if (i + CHUNK_SIZE < categoryItems.length) {
                    await new Promise(r => setTimeout(r, 1200));
                }
            }
        }

        setIsSaving(false);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in" dir="rtl">
            <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl overflow-hidden border border-slate-200">
                <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <h3 className="font-black text-lg text-slate-800">הגדרות עיצוב לקטגוריה: <span className="text-indigo-600">{category}</span></h3>
                    <button onClick={onClose}><X size={20} className="text-slate-400 hover:text-slate-600" /></button>
                </div>

                <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    {/* Background Selection */}
                    <div className="space-y-3">
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider flex justify-between items-center">
                            <span>רקע לקטגוריה</span>
                            {(localConfig.backgroundIds?.length || 0) > 0 && (
                                <span onClick={() => setLocalConfig({ ...localConfig, backgroundIds: [] })} className="text-indigo-500 cursor-pointer hover:underline text-[10px]">
                                    נקה הכל ({localConfig.backgroundIds?.length})
                                </span>
                            )}
                        </label>
                        <div className="grid grid-cols-5 gap-2">
                            <label className="aspect-square rounded-lg border-2 border-dashed border-slate-200 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-400 hover:bg-slate-50 transition-all gap-1 group relative overflow-hidden bg-white">
                                {isUploadingBg && (
                                    <div className="absolute inset-0 bg-white/90 flex items-center justify-center z-10">
                                        <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                                    </div>
                                )}
                                <Plus size={18} className="text-slate-400 group-hover:text-indigo-500" />
                                <span className="text-[8px] font-bold text-slate-400 uppercase group-hover:text-indigo-500 text-center leading-tight">הוסף<br />חדש</span>
                                <input type="file" accept="image/*" className="hidden" disabled={isUploadingBg} onChange={e => e.target.files?.[0] && handleUploadSeed(e.target.files[0], 'background')} />
                            </label>

                            {atmosphereSeeds.filter(s => s.type === 'background').map(seed => {
                                const isSelected = localConfig.backgroundIds?.includes(seed.id);
                                return (
                                    <div
                                        key={seed.id}
                                        onClick={() => {
                                            const current = localConfig.backgroundIds || [];
                                            const newIds = current.includes(seed.id) ? current.filter(id => id !== seed.id) : [...current, seed.id];
                                            setLocalConfig({ ...localConfig, backgroundIds: newIds });
                                        }}
                                        className={`aspect-square rounded-lg overflow-hidden border-2 cursor-pointer transition-all relative group ${isSelected ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-transparent opacity-60 hover:opacity-100 hover:border-slate-300'}`}
                                    >
                                        <img src={seed.blob as string} className="w-full h-full object-cover" />
                                        {isSelected && <div className="absolute top-1 right-1 bg-indigo-600 rounded-full p-0.5 shadow-sm"><Check size={8} className="text-white" /></div>}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Container Selection */}
                    <div className="space-y-3">
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider flex justify-between items-center">
                            <span>כלי הגשה</span>
                            {(localConfig.containerIds?.length || 0) > 0 && (
                                <span onClick={() => setLocalConfig({ ...localConfig, containerIds: [] })} className="text-indigo-500 cursor-pointer hover:underline text-[10px]">
                                    נקה הכל ({localConfig.containerIds?.length})
                                </span>
                            )}
                        </label>
                        <div className="grid grid-cols-5 gap-2">
                            <label className="aspect-square rounded-lg border-2 border-dashed border-slate-200 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-400 hover:bg-slate-50 transition-all gap-1 group relative overflow-hidden bg-white">
                                {isUploadingCont && (
                                    <div className="absolute inset-0 bg-white/90 flex items-center justify-center z-10">
                                        <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                                    </div>
                                )}
                                <Plus size={18} className="text-slate-400 group-hover:text-indigo-500" />
                                <span className="text-[8px] font-bold text-slate-400 uppercase group-hover:text-indigo-500 text-center leading-tight">הוסף<br />חדש</span>
                                <input type="file" accept="image/*" className="hidden" disabled={isUploadingCont} onChange={e => e.target.files?.[0] && handleUploadSeed(e.target.files[0], 'container')} />
                            </label>

                            {atmosphereSeeds.filter(s => s.type === 'container').map(seed => {
                                const isSelected = localConfig.containerIds?.includes(seed.id);
                                return (
                                    <div
                                        key={seed.id}
                                        onClick={() => {
                                            const current = localConfig.containerIds || [];
                                            const newIds = current.includes(seed.id) ? current.filter(id => id !== seed.id) : [...current, seed.id];
                                            setLocalConfig({ ...localConfig, containerIds: newIds });
                                        }}
                                        className={`aspect-square rounded-lg overflow-hidden border-2 cursor-pointer transition-all relative group ${isSelected ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-transparent opacity-60 hover:opacity-100 hover:border-slate-300'}`}
                                    >
                                        <img src={seed.blob as string} className="w-full h-full object-cover" />
                                        {isSelected && <div className="absolute top-1 right-1 bg-indigo-600 rounded-full p-0.5 shadow-sm"><Check size={8} className="text-white" /></div>}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Custom Prompt */}
                    <div className="space-y-2">
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider">פרומפט מיוחד (אופציונלי)</label>
                        <textarea
                            value={localConfig.prompt || ''}
                            onChange={e => setLocalConfig({ ...localConfig, prompt: e.target.value })}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-600 focus:border-indigo-500 outline-none min-h-[80px]"
                            placeholder="למשל: Rustic wooden vibes..."
                        />
                    </div>
                </div>

                <div className="p-5 bg-slate-50 border-t border-slate-100 flex gap-3">
                    <button onClick={() => handleSave(false)} className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-50">
                        שמור הגדרות בלבד
                    </button>
                    <button onClick={() => handleSave(true)} disabled={isSaving} className="flex-1 py-3 bg-indigo-600 text-white font-bold text-xs rounded-xl hover:bg-indigo-700 shadow-md flex items-center justify-center gap-2">
                        {isSaving ? <RefreshCw size={14} className="animate-spin" /> : <Wand2 size={14} />}
                        שמור וצור הכל מחדש
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CategoryDesignModal;
