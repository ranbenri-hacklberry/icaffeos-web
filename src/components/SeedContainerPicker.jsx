import React, { useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Check, X, Coffee, Salad, Sandwich, Mountain, Sparkles, Upload, Loader2 } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';

/**
 * SeedContainerPicker - Two sections: Containers & Backgrounds
 * Allows selecting ONE from EACH category.
 * Supports business-specific seeds stored in Supabase.
 */
const SeedContainerPicker = ({
    selectedContainer,
    onSelectContainer,
    selectedBackground,
    onSelectBackground,
    businessSeeds = [],
    onAddSeed,
    onDeleteSeed,
    isLoading = false
}) => {
    const { isDarkMode } = useTheme();
    const [activeTab, setActiveTab] = useState('containers');
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef(null);

    // Initial default seeds
    const defaultSeeds = {
        containers: [
            { id: 'seed_cup_white_plain', name: 'כוס לבנה', category: 'container', image_url: null, prompt_hint: 'PREMIUM PLAIN WHITE disposable paper coffee cup, no logos, minimalist' },
            { id: 'seed_cup_white', name: 'קפוצ׳ינו', category: 'container', image_url: '/cafe-images/item_84_קפוצ׳ינו.png', prompt_hint: 'white paper coffee cup with latte art' },
            { id: 'seed_cup_espresso', name: 'אספרסו', category: 'container', image_url: '/cafe-images/item_74_אספרסו_כפול.png', prompt_hint: 'small espresso cup, ceramic' },
            { id: 'seed_bowl_salad', name: 'קערת סלט', category: 'container', image_url: '/cafe-images/item_3_סלט_חסלק.png', prompt_hint: 'brown kraft paper salad bowl' },
            { id: 'seed_sandwich', name: 'כריך', category: 'container', image_url: '/cafe-images/item_5_כריך_סלק.png', prompt_hint: 'sandwich on greaseproof paper' }
        ],
        backgrounds: [
            { id: 'bg_desert', name: 'מדבר', category: 'background', image_url: '/cafe-images/item_82_קפה_שחור.png', prompt_hint: 'desert landscape with sand dunes and clear blue sky, bokeh background', icon: Mountain },
            { id: 'bg_cafe', name: 'בית קפה', category: 'background', image_url: '/cafe-images/item_77_מוקה.png', prompt_hint: 'cozy cafe interior with wooden tables, warm lighting', icon: Coffee },
            { id: 'bg_garden', name: 'גינה', category: 'background', image_url: '/cafe-images/item_224_סלט_ירקות_קצוץ_טרי.png', prompt_hint: 'fresh garden with green plants and natural light', icon: Salad },
            { id: 'bg_minimal', name: 'מינימלי', category: 'background', image_url: null, prompt_hint: 'clean white background, minimal, studio lighting', icon: Sparkles }
        ]
    };

    // Combine defaults with business-specific seeds
    const currentSeeds = useMemo(() => {
        const category = activeTab === 'containers' ? 'container' : 'background';
        const defaults = activeTab === 'containers' ? defaultSeeds.containers : defaultSeeds.backgrounds;
        const customs = Array.isArray(businessSeeds) ? businessSeeds.filter(s => s.category === category) : [];
        return [...defaults, ...customs];
    }, [activeTab, businessSeeds]);

    const handleSelect = (seed) => {
        if (activeTab === 'containers') {
            onSelectContainer(selectedContainer?.id === seed.id ? null : seed);
        } else {
            onSelectBackground(selectedBackground?.id === seed.id ? null : seed);
        }
    };

    const handleDeleteSeed = async (e, seedToDelete) => {
        e.stopPropagation();
        if (onDeleteSeed) {
            onDeleteSeed(seedToDelete.id);
        }
        if (selectedContainer?.id === seedToDelete.id) onSelectContainer(null);
        if (selectedBackground?.id === seedToDelete.id) onSelectBackground(null);
    };

    const handleAddSeed = async (e) => {
        const file = e.target.files?.[0];
        if (!file || !onAddSeed) return;

        setIsUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `seed_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('menu-images')
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('menu-images')
                .getPublicUrl(fileName);

            const newSeed = {
                id: `user_seed_${Date.now()}`,
                name: 'העלאה',
                category: activeTab === 'containers' ? 'container' : 'background',
                image_url: publicUrl,
                prompt_hint: activeTab === 'containers' ? 'user provided container style' : 'user provided background style',
                is_custom: true
            };

            onAddSeed(newSeed);
        } catch (error) {
            console.error('Error uploading seed:', error);
            alert('שגיאה בהעלאת הסיד');
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <div className="space-y-3">
            {/* Header & Badges */}
            <div className="flex items-center justify-between">
                <span className={`text-xs font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    {activeTab === 'containers' ? '🍽️ סגנון כלי' : '🏜️ רקע'}
                </span>

                <div className="flex gap-1">
                    {selectedContainer && (
                        <div className="px-2 py-1 rounded-full text-[10px] font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center gap-1">
                            {selectedContainer.name}
                            <X size={10} className="cursor-pointer" onClick={() => onSelectContainer(null)} />
                        </div>
                    )}
                    {selectedBackground && (
                        <div className="px-2 py-1 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center gap-1">
                            {selectedBackground.name}
                            <X size={10} className="cursor-pointer" onClick={() => onSelectBackground(null)} />
                        </div>
                    )}
                </div>
            </div>

            {/* Tab Switcher */}
            <div className="flex gap-2">
                <button
                    onClick={() => setActiveTab('containers')}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all ${activeTab === 'containers' ? 'bg-orange-500 text-white' : 'bg-slate-700/50 text-slate-400'}`}
                >
                    כלי הגשה
                </button>
                <button
                    onClick={() => setActiveTab('backgrounds')}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all ${activeTab === 'backgrounds' ? 'bg-purple-500 text-white' : 'bg-slate-700/50 text-slate-400'}`}
                >
                    רקעים
                </button>
            </div>

            {/* Seeds Grid */}
            <div className="grid grid-cols-4 gap-2">
                {currentSeeds.map((seed) => {
                    const isSelected = (activeTab === 'containers' ? selectedContainer?.id : selectedBackground?.id) === seed.id;
                    const SeedIcon = seed.icon;
                    const isCustom = seed.is_custom || seed.id.toString().startsWith('user_seed');

                    return (
                        <motion.div
                            key={seed.id}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleSelect(seed)}
                            className={`group relative rounded-xl overflow-hidden cursor-pointer aspect-square border-2 transition-all ${isSelected ? (activeTab === 'containers' ? 'border-orange-500' : 'border-purple-500') : 'border-transparent bg-slate-800'}`}
                        >
                            {isCustom && (
                                <button onClick={(e) => handleDeleteSeed(e, seed)} className="absolute top-1 left-1 z-20 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                    <X size={8} strokeWidth={4} />
                                </button>
                            )}

                            {seed.image_url ? (
                                <img src={seed.image_url} alt={seed.name} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-slate-700/50">
                                    {SeedIcon ? <SeedIcon size={20} className="text-slate-400" /> : <span className="text-xl">🍽️</span>}
                                </div>
                            )}

                            {isSelected && (
                                <div className={`absolute inset-0 flex items-center justify-center ${activeTab === 'containers' ? 'bg-orange-500/20' : 'bg-purple-500/20'}`}>
                                    <Check size={16} className="text-white" strokeWidth={3} />
                                </div>
                            )}

                            <div className="absolute bottom-0 inset-x-0 p-1 bg-black/60 text-[10px] text-white text-center font-bold truncate">
                                {seed.name}
                            </div>
                        </motion.div>
                    );
                })}

                {isLoading ? (
                    <div className="aspect-square rounded-xl bg-slate-800/50 flex items-center justify-center order-last">
                        <Loader2 className="animate-spin text-slate-500" size={16} />
                    </div>
                ) : (
                    <>
                        <input type="file" ref={fileInputRef} onChange={handleAddSeed} accept="image/*" className="hidden" />
                        <motion.div
                            whileTap={{ scale: 0.95 }}
                            onClick={() => !isUploading && fileInputRef.current?.click()}
                            className={`aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 cursor-pointer transition-all ${isDarkMode
                                ? 'border-slate-600 hover:bg-slate-700/50 hover:border-orange-500'
                                : 'border-slate-300 hover:bg-slate-50 hover:border-orange-400'
                                } ${isUploading ? 'opacity-50 cursor-wait' : ''}`}
                        >
                            {isUploading ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} className={isDarkMode ? 'text-slate-500' : 'text-slate-400'} />}
                            <span className={`text-[10px] font-bold ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                {isUploading ? 'מעלה...' : 'הוסף'}
                            </span>
                        </motion.div>
                    </>
                )}
            </div>
        </div>
    );
};

export default SeedContainerPicker;
