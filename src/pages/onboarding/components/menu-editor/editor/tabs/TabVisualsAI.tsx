import React, { useState, useEffect } from 'react';
import { Wand2, Package, RefreshCw, Check, AlertCircle, X, Plus, Trash2, Upload, Copy, Settings, ChevronDown, ChevronUp, Coffee } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { OnboardingItem, AtmosphereSeed } from '@/pages/onboarding/types/onboardingTypes';
import { compressImageToBlob } from '@/pages/onboarding/logic/onboardingLogic';

interface TabVisualsAIProps {
    localItem: OnboardingItem;
    setLocalItem: React.Dispatch<React.SetStateAction<OnboardingItem>>;
    isFlipped: boolean;
    setIsFlipped: (val: boolean) => void;
    regenerateSingleItem: (id: string) => Promise<void>;
    uploadOriginalImage: (id: string, file: File) => Promise<string>;
    atmosphereSeeds: AtmosphereSeed[];
    handleUploadSeed: (file: File, type: 'container' | 'background') => Promise<void>;
    removeAtmosphereSeed: (id: string) => void;
    isUploadingBackground: boolean;
    isUploadingContainer: boolean;
    generationError?: string | null;
}

const TECHNICAL_LOADING_PHRASES = [
    "Analyzing semantic tokens...", "Encoding latent space vectors...", "Optimizing diffusion steps...",
    "Denoising input tensors...", "Aligning CLIP Text Encoder...", "Injecting attention maps...",
    "Upscaling feature layers...", "Calibrating varying autoencoder...", "Synthesizing high-frequency details...",
    "Running negative prompt filter...", "Converging UNet weights...", "Sampling perceptual path length...",
    "Processing cross-attention layers...", "Refining structural integrity...", "Mapping texture coordinates...",
    "Quantizing neural weights...", "Balancing CFG scale...", "Decoding VAE latent image...",
    "Enhancing dynamic range...", "Checking safety constraints..."
];

const TabVisualsAI = ({
    localItem, setLocalItem, regenerateSingleItem, uploadOriginalImage, atmosphereSeeds,
    handleUploadSeed, removeAtmosphereSeed, isUploadingBackground, isUploadingContainer, generationError
}: TabVisualsAIProps) => {

    const [isPromptOpen, setIsPromptOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const [loadingIndex, setLoadingIndex] = useState(0);
    const [isOverlayDismissed, setIsOverlayDismissed] = useState(false);

    // Reset dismissal when entering generating state
    useEffect(() => {
        if (localItem.status === 'generating') {
            setIsOverlayDismissed(false);
        }
    }, [localItem.status]);

    // Rotate loading phrases
    useEffect(() => {
        if (localItem.status === 'generating' || localItem.status === 'preparing') {
            const interval = setInterval(() => {
                setLoadingIndex(prev => (prev + 1) % TECHNICAL_LOADING_PHRASES.length);
            }, 600); // Fast changes
            return () => clearInterval(interval);
        }
    }, [localItem.status]);

    const handleCopyPrompt = () => {
        if (!localItem.lastPrompt) return;
        navigator.clipboard.writeText(localItem.lastPrompt);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Determine displayed image
    const displayImage = localItem.imageUrl || (localItem.originalImageUrls?.[0]) || null;
    const isAiImage = !!localItem.imageUrl;

    return (
        <div className="space-y-4 h-full flex flex-col pt-2" dir="rtl">

            {/* Premium Progress Overlay (v7.0) */}
            {(localItem.status === 'generating' || localItem.status === 'preparing') && !isOverlayDismissed && (
                <div className="fixed inset-0 z-[1000] bg-white flex flex-col items-center justify-center gap-6 animate-in fade-in duration-500">
                    <button 
                        onClick={() => setIsOverlayDismissed(true)} 
                        className="absolute top-6 right-6 p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl transition-all text-slate-400 hover:text-slate-600 z-[1001]"
                    >
                        <X size={24} />
                    </button>

                    <motion.div 
                        animate={{ 
                            rotate: [0, 10, -10, 0],
                            scale: [1, 1.1, 1],
                        }}
                        transition={{ repeat: Infinity, duration: 2 }}
                        className="w-28 h-28 bg-orange-50 rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-orange-100 border-2 border-orange-100"
                    >
                        <Coffee size={56} className="text-orange-500" />
                    </motion.div>
                    
                    <div className="flex flex-col items-center gap-3 text-center">
                        <h2 className="text-2xl font-black text-slate-800 tracking-tight">אנחנו מייצרים את התמונה...</h2>
                        <div className="flex flex-col items-center gap-2">
                            <p className="text-[11px] font-mono text-orange-500 font-bold bg-orange-50 px-4 py-1.5 rounded-full border border-orange-100 opacity-80 animate-pulse">
                                {TECHNICAL_LOADING_PHRASES[loadingIndex]}
                            </p>
                            <div className="flex items-center gap-2 px-4 py-1 bg-slate-50 rounded-full border border-slate-100 mt-2">
                                <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Version 7.0 AI Core</span>
                            </div>
                        </div>
                    </div>

                    <button 
                        onClick={() => setIsOverlayDismissed(true)} 
                        className="mt-4 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 hover:text-orange-500 transition-colors py-2 px-6 border border-slate-100 rounded-xl hover:border-orange-100 hover:bg-orange-50/30"
                    >
                        המשך לערוך בזמן הג׳ינרוט
                    </button>
                </div>
            )}

            {/* Preview Section */}
            <div className="flex flex-col gap-3 bg-slate-50/50 p-4 rounded-3xl border border-slate-200/50">
                <div className="flex items-center justify-between px-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">תצוגה</label>
                    {localItem.powerSource && isAiImage && (
                        <div className="flex items-center gap-1 text-emerald-600">
                            <Wand2 size={10} />
                            <span className="text-[9px] font-black uppercase">{localItem.powerSource}</span>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-3 h-52 sm:h-64">
                    {/* Result */}
                    <div className="relative rounded-2xl overflow-hidden border border-white bg-white shadow-sm ring-4 ring-slate-100/50 transition-all">
                        {(localItem.status === 'generating' || localItem.status === 'preparing') ? (
                            <div className="w-full h-full bg-slate-50 flex flex-col items-center justify-center relative overflow-hidden">
                                <RefreshCw size={24} className="text-indigo-400 animate-spin mb-2" />
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest animate-pulse">מעבד...</span>
                            </div>
                        ) : displayImage ? (
                            <>
                                <img src={displayImage} className="w-full h-full object-cover" />
                                <div className={`absolute top-2 right-2 px-1.5 py-1 rounded-md text-[8px] font-black uppercase tracking-tighter shadow-sm border border-white/20 ${isAiImage ? 'bg-indigo-600/90 text-white' : 'bg-slate-900/70 text-white'}`}>
                                    {isAiImage ? 'AI RESULT' : 'ORIGINAL'}
                                </div>
                            </>
                        ) : (
                            <label className="w-full h-full flex flex-col items-center justify-center text-slate-300 gap-2 cursor-pointer hover:bg-slate-100 transition-colors">
                                <Plus size={32} strokeWidth={1} />
                                <input type="file" className="hidden" onChange={async (e) => {
                                    if (e.target.files?.[0]) {
                                        const file = e.target.files[0];
                                        const compressed = await compressImageToBlob(file);
                                        const url = await uploadOriginalImage(localItem.id, compressed as File);
                                        setLocalItem(prev => ({ ...prev, originalImageUrls: [url] }));
                                    }
                                }} />
                            </label>
                        )}
                        <div className="absolute bottom-2 right-2 bg-white/70 backdrop-blur px-1.5 py-0.5 rounded text-[8px] font-black text-slate-400 uppercase tracking-widest pointer-events-none">תוצאה</div>
                    </div>

                    {/* Seed */}
                    <div className="relative rounded-2xl overflow-hidden border border-dashed border-slate-200 bg-slate-100/20 group">
                        {localItem.originalImageUrls?.[0] ? (
                            <>
                                <img src={localItem.originalImageUrls[0]} className="w-full h-full object-cover opacity-60 grayscale" />
                                <div className="absolute bottom-2 left-2 right-2">
                                    <label className="w-full py-1 bg-white/95 text-slate-900 rounded-lg shadow-sm cursor-pointer hover:bg-white transition-all flex items-center justify-center gap-1.5 font-black text-[9px] uppercase border border-slate-100">
                                        <Upload size={10} className="text-indigo-600" /> החלף
                                        <input type="file" className="hidden" onChange={async (e) => {
                                            if (e.target.files?.[0]) {
                                                const file = e.target.files[0];
                                                const compressed = await compressImageToBlob(file);
                                                const url = await uploadOriginalImage(localItem.id, compressed as File);
                                                setLocalItem(prev => ({ ...prev, originalImageUrls: [url] }));
                                            }
                                        }} />
                                    </label>
                                </div>
                            </>
                        ) : (
                            <label className="w-full h-full flex flex-col items-center justify-center text-slate-200 gap-1.5 p-4 text-center cursor-pointer">
                                <Package size={20} strokeWidth={1} />
                                <span className="text-[9px] font-bold opacity-60 uppercase">העלה מקור</span>
                                <input type="file" className="hidden" onChange={async (e) => {
                                    if (e.target.files?.[0]) {
                                        const file = e.target.files[0];
                                        const compressed = await compressImageToBlob(file);
                                        const url = await uploadOriginalImage(localItem.id, compressed as File);
                                        setLocalItem(prev => ({ ...prev, originalImageUrls: [url] }));
                                    }
                                }} />
                            </label>
                        )}
                        <div className="absolute bottom-2 left-2 bg-white/70 backdrop-blur px-1.5 py-0.5 rounded text-[8px] font-black text-slate-400 uppercase tracking-widest pointer-events-none">מקור</div>
                    </div>
                </div>

                {generationError && (
                    <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex gap-2 items-center">
                        <AlertCircle size={14} className="text-red-500" />
                        <span className="text-[10px] font-black text-red-600">{generationError}</span>
                    </div>
                )}
            </div>

            {/* Action Bar */}
            <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 bg-slate-100/40 p-1.5 rounded-2xl border border-slate-200/50">
                    <div className="flex flex-1 items-center gap-2">
                        {isAiImage && (
                            <>
                                <button
                                    onClick={() => confirm('חזור לתמונה המקורית?') && setLocalItem(p => ({ ...p, imageUrl: undefined }))}
                                    className="flex-1 h-11 bg-white text-slate-600 font-bold rounded-xl border border-slate-200 hover:bg-slate-50 transition-all text-[10px] flex items-center justify-center gap-1.5 shadow-sm"
                                >
                                    <RefreshCw size={12} />
                                    <span>חזור למקור</span>
                                </button>
                                <button
                                    onClick={() => confirm('למחוק את התמונה?') && setLocalItem(p => ({ ...p, imageUrl: undefined, originalImageUrls: [] }))}
                                    className="flex-1 h-11 bg-red-50 text-red-500 font-bold rounded-xl border border-red-100 hover:bg-red-100 transition-all text-[10px] flex items-center justify-center gap-1.5 shadow-sm"
                                >
                                    <Trash2 size={12} />
                                    <span>מחק תמונה</span>
                                </button>
                            </>
                        )}
                        <button
                            onClick={() => regenerateSingleItem(localItem.id)}
                            className="flex-1 h-11 bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 bg-[length:200%_auto] hover:bg-right text-white font-black rounded-xl shadow-lg transition-all duration-500 flex items-center justify-center gap-2 text-[11px]"
                        >
                            <Wand2 size={14} className={(localItem.status === 'generating' || localItem.status === 'preparing') ? 'hidden' : ''} />
                            <RefreshCw size={14} className={(localItem.status === 'generating' || localItem.status === 'preparing') ? 'animate-spin' : ''} />
                            <span>{localItem.imageUrl ? 'ג׳נרט מחדש' : 'צור תמונת AI'}</span>
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pb-2">
                    <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">רקע (Background)</label>
                        <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                            <label className="relative w-12 h-12 shrink-0 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-300 hover:bg-indigo-50 transition-all text-slate-300">
                                <Plus size={14} />
                                <input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && handleUploadSeed(e.target.files[0], 'background')} />
                                {isUploadingBackground && <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-xl"><RefreshCw size={10} className="animate-spin text-indigo-500" /></div>}
                            </label>
                            {atmosphereSeeds.filter(s => s.type === 'background').map(seed => (
                                <div key={seed.id} onClick={() => setLocalItem(p => ({ ...p, selectedBackgroundId: p.selectedBackgroundId === seed.id ? undefined : seed.id }))} className={`relative w-12 h-12 shrink-0 rounded-xl overflow-hidden cursor-pointer border-2 transition-all group ${localItem.selectedBackgroundId === seed.id ? 'border-indigo-500 ring-2 ring-indigo-50' : 'border-slate-50'}`}>
                                    <img src={seed.blob as string} className="w-full h-full object-cover" />
                                    {localItem.selectedBackgroundId === seed.id && <div className="absolute inset-0 bg-indigo-600/20 flex items-center justify-center"><Check size={14} className="text-white" /></div>}
                                    <button onClick={(e) => { e.stopPropagation(); removeAtmosphereSeed(seed.id); }} className="absolute top-0.5 right-0.5 p-0.5 bg-red-400 text-white rounded opacity-0 group-hover:opacity-100"><X size={8} /></button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">כלי (Serving)</label>
                        <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                            <label className="relative w-12 h-12 shrink-0 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-300 hover:bg-indigo-50 transition-all text-slate-300">
                                <Plus size={14} />
                                <input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && handleUploadSeed(e.target.files[0], 'container')} />
                                {isUploadingContainer && <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-xl"><RefreshCw size={10} className="animate-spin text-indigo-500" /></div>}
                            </label>
                            {atmosphereSeeds.filter(s => s.type === 'container').map(seed => (
                                <div key={seed.id} onClick={() => setLocalItem(p => ({ ...p, selectedContainerId: p.selectedContainerId === seed.id ? undefined : seed.id }))} className={`relative w-12 h-12 shrink-0 rounded-xl overflow-hidden cursor-pointer border-2 transition-all group ${localItem.selectedContainerId === seed.id ? 'border-indigo-500 ring-2 ring-indigo-50' : 'border-slate-50'}`}>
                                    <img src={seed.blob as string} className="w-full h-full object-cover" />
                                    {localItem.selectedContainerId === seed.id && <div className="absolute inset-0 bg-indigo-600/20 flex items-center justify-center"><Check size={14} className="text-white" /></div>}
                                    <button onClick={(e) => { e.stopPropagation(); removeAtmosphereSeed(seed.id); }} className="absolute top-0.5 right-0.5 p-0.5 bg-red-400 text-white rounded opacity-0 group-hover:opacity-100"><X size={8} /></button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Advanced Prompt Section */}
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm mt-1 text-right" dir="rtl">
                    <button
                        onClick={() => setIsPromptOpen(!isPromptOpen)}
                        className="w-full p-3 bg-slate-50/80 hover:bg-slate-50 flex items-center justify-between text-[10px] font-black text-slate-500 transition-colors uppercase tracking-tight"
                    >
                        <span className="flex items-center gap-2"><Settings size={12} className="text-slate-400" /> פרומפט מתקדם</span>
                        {isPromptOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    <AnimatePresence>
                        {isPromptOpen && (
                            <div className="border-t border-slate-100 overflow-hidden">
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                >
                                    <div className="p-4 space-y-3">
                                        <div className="flex justify-between items-center mb-1">
                                            <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Logic Flow</p>
                                            {localItem.lastPrompt && (
                                                <button onClick={handleCopyPrompt} className="flex items-center gap-1 text-[9px] font-black text-indigo-500 hover:text-indigo-600 transition-colors bg-indigo-50 px-2 py-0.5 rounded-md">
                                                    {copied ? <Check size={10} /> : <Copy size={10} />}
                                                    {copied ? 'הועתק!' : 'העתק'}
                                                </button>
                                            )}
                                        </div>
                                        <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-[9px] font-mono text-slate-500 leading-relaxed break-words max-h-32 overflow-y-auto custom-scrollbar shadow-inner ltr text-left" dir="ltr">
                                            {localItem.lastPrompt || 'טרם נוצר פרומפט...'}
                                        </div>

                                        <div className="pt-1">
                                            <button
                                                onClick={() => setLocalItem(p => ({ ...p, aiImprovement: !p.aiImprovement }))}
                                                className={`w-full py-2 rounded-xl text-[10px] font-black uppercase tracking-tight transition-all border-2 ${localItem.aiImprovement ? 'bg-indigo-50 border-indigo-100 text-indigo-600 shadow-sm' : 'bg-slate-50 border-slate-100 text-slate-400'}`}
                                            >
                                                {localItem.aiImprovement ? '✨ AI Magic Enabled' : '🎯 Strict Mode Active'}
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            </div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
};

export default TabVisualsAI;
