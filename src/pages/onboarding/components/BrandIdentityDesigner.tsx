import { useState } from 'react';
import { AtmosphereSeed } from '@/pages/onboarding/types/onboardingTypes';
import { useOnboardingStore } from '@/pages/onboarding/store/useOnboardingStore';
import { useTheme } from '@/context/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import { Upload, X, ArrowRight, Utensils, Image as ImageIcon } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/lib/supabase';
import { analyzeVisualSeed } from '@/pages/onboarding/logic/onboardingLogic';

const BrandIdentityDesigner = () => {
    const { businessId, atmosphereSeeds, addAtmosphereSeed, removeAtmosphereSeed, setStep } = useOnboardingStore();
    const { isDarkMode } = useTheme();

    const [uploadingIds, setUploadingIds] = useState<Set<string>>(new Set());
    console.log("Uploading seeds...", Array.from(uploadingIds)); // Using it to avoid lint warning if not fully implemented in UI yet

    // 🆕 Upload to Supabase Storage immediately on drop
    const onDrop = async (acceptedFiles: File[], type: 'container' | 'background') => {
        const newSeeds: AtmosphereSeed[] = [];

        // Pre-checks
        const validFiles = acceptedFiles.filter(file => file.size <= 5 * 1024 * 1024 && file.type.startsWith('image/'));
        if (validFiles.length === 0) return;

        for (const file of acceptedFiles) {
            const tempId = uuidv4();
            setUploadingIds(prev => new Set(prev).add(tempId)); // Start loading (though this ID isn't visible yet)

            if (file.size > 5 * 1024 * 1024) continue;
            if (!file.type.startsWith('image/')) continue;

            try {
                const fileExt = file.name.split('.').pop();
                const fileName = `wizard/${businessId || 'anonymous'}/${tempId}.${fileExt}`;

                const { error: uploadError } = await supabase.storage
                    .from('menu-images')
                    .upload(fileName, file);

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('menu-images')
                    .getPublicUrl(fileName);

                // 🆕 Analyze the image with Gemini Vision to get a professional descriptor
                let visionDescription = `User uploaded ${type}`;
                try {
                    visionDescription = await analyzeVisualSeed(publicUrl, type, useOnboardingStore.getState().geminiApiKey || undefined);
                } catch (err) {
                    console.warn("Visual analysis failed, using default description", err);
                }

                newSeeds.push({
                    id: tempId,
                    blob: publicUrl,
                    type: type,
                    promptHint: visionDescription,
                    storagePath: fileName
                });

                // Add immediately so user sees it
                addAtmosphereSeed({
                    id: tempId,
                    blob: publicUrl,
                    type: type,
                    promptHint: visionDescription,
                    storagePath: fileName
                });

            } catch (error: any) {
                console.error('Error uploading image:', error);
            } finally {
                setUploadingIds(prev => {
                    const next = new Set(prev);
                    next.delete(tempId);
                    return next;
                });
            }
        }
    };

    const { getRootProps: getContainerProps, getInputProps: getContainerInputProps } = useDropzone({
        onDrop: (files) => onDrop(files, 'container'),
        accept: { 'image/*': [] }
    });

    const { getRootProps: getBgProps, getInputProps: getBgInputProps } = useDropzone({
        onDrop: (files) => onDrop(files, 'background'),
        accept: { 'image/*': [] }
    });

    const containers = atmosphereSeeds.filter(s => s.type === 'container');
    const backgrounds = atmosphereSeeds.filter(s => s.type === 'background');

    return (
        <div className="flex flex-col gap-8 h-full">
            <div className="text-center space-y-2">
                <h2 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                    Let's set the vibe 📸
                </h2>
                <p className="text-slate-400 max-w-lg mx-auto">
                    Upload photos of your dishes and restaurant space. Our AI will learn your style to generate matching photos for the rest of your menu.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
                <div className={`rounded-3xl p-6 border-2 border-dashed transition-all flex flex-col gap-4
                    ${isDarkMode ? 'border-slate-700 bg-slate-800/30' : 'border-slate-200 bg-white/50'}`}>

                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-3 rounded-xl bg-orange-500/20 text-orange-400">
                            <Utensils size={24} />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg">Dish Style</h3>
                            <p className="text-xs text-slate-400">Plates, cups, packaging...</p>
                        </div>
                    </div>

                    <div {...getContainerProps()} className="flex-1 min-h-[150px] rounded-2xl bg-slate-500/5 hover:bg-slate-500/10 transition-colors cursor-pointer flex flex-col items-center justify-center gap-3 text-slate-400 border border-transparent hover:border-orange-500/30">
                        <input {...getContainerInputProps()} />
                        <Upload size={32} />
                        <span className="text-sm font-medium">Drop visuals here</span>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                        <AnimatePresence>
                            {containers.map(seed => (
                                <motion.div
                                    key={seed.id}
                                    layout
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0 }}
                                >
                                    <div className="aspect-square rounded-lg overflow-hidden relative group">
                                        <img src={seed.blob as string} className="w-full h-full object-cover" />
                                        <button
                                            onClick={() => removeAtmosphereSeed(seed.id)}
                                            className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X size={10} strokeWidth={3} />
                                        </button>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                </div>

                <div className={`rounded-3xl p-6 border-2 border-dashed transition-all flex flex-col gap-4
                    ${isDarkMode ? 'border-slate-700 bg-slate-800/30' : 'border-slate-200 bg-white/50'}`}>

                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-3 rounded-xl bg-purple-500/20 text-purple-400">
                            <ImageIcon size={24} />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg">Atmosphere</h3>
                            <p className="text-xs text-slate-400">Tables, walls, lighting...</p>
                        </div>
                    </div>

                    <div {...getBgProps()} className="flex-1 min-h-[150px] rounded-2xl bg-slate-500/5 hover:bg-slate-500/10 transition-colors cursor-pointer flex flex-col items-center justify-center gap-3 text-slate-400 border border-transparent hover:border-purple-500/30">
                        <input {...getBgInputProps()} />
                        <Upload size={32} />
                        <span className="text-sm font-medium">Drop visuals here</span>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                        <AnimatePresence>
                            {backgrounds.map(seed => (
                                <motion.div
                                    key={seed.id}
                                    layout
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0 }}
                                >
                                    <div className="aspect-square rounded-lg overflow-hidden relative group">
                                        <img src={seed.blob as string} className="w-full h-full object-cover" />
                                        <button
                                            onClick={() => removeAtmosphereSeed(seed.id)}
                                            className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X size={10} strokeWidth={3} />
                                        </button>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            <div className="flex justify-end pt-4">
                <button
                    onClick={() => setStep(2)}
                    className="flex items-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all"
                >
                    Next Step <ArrowRight size={18} />
                </button>
            </div>
        </div>
    );
};

export default BrandIdentityDesigner;
