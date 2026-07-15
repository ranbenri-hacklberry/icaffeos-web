import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Upload, Sparkles, Save, X, ChevronDown, Image as ImageIcon, Loader2 } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import SeedContainerPicker from '@/components/SeedContainerPicker';
import { supabase } from '@/lib/supabase';
import { generateMenuImage } from '@/services/geminiService';
import { fetchBusinessSeeds, saveBusinessSeed, deleteBusinessSeed } from '@/services/aiSettingsService';

/**
 * EditPanel - Left side panel for editing menu items
 */
const EditPanel = ({ item, onItemChange, modifiers = [], onModifiersChange, onSave, onClose, authMode, onAuthModeChange, aiSettings, businessId }) => {
    const { isDarkMode } = useTheme();
    const fileInputRef = useRef(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [aiError, setAiError] = useState(null);
    const [selectedContainer, setSelectedContainer] = useState(null);
    const [selectedBackground, setSelectedBackground] = useState(null);
    const [generationStatus, setGenerationStatus] = useState('');
    const [userSeedImage, setUserSeedImage] = useState(null);

    // Business Seeds
    const [businessSeeds, setBusinessSeeds] = useState([]);
    const [isLoadingSeeds, setIsLoadingSeeds] = useState(false);

    useEffect(() => {
        if (businessId) {
            setIsLoadingSeeds(true);
            fetchBusinessSeeds(businessId).then(seeds => {
                setBusinessSeeds(seeds);
                setIsLoadingSeeds(false);
            });
        }
    }, [businessId]);

    const handleAddBusinessSeed = async (newSeed) => {
        if (!businessId) return;

        // Optimistic update
        setBusinessSeeds(prev => [...prev, newSeed]);
        await saveBusinessSeed(businessId, newSeed);
    };

    const handleDeleteBusinessSeed = async (seedId) => {
        if (!businessId) return;

        // Optimistic update
        setBusinessSeeds(prev => prev.filter(s => s.id !== seedId));
        await deleteBusinessSeed(businessId, seedId);
    };

    // Handle input changes
    const handleChange = (field, value) => {
        if (item) {
            onItemChange({ ...item, [field]: value });
        }
    };

    // Handle file upload/camera - Acts as SEED image
    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            setUserSeedImage(reader.result); // Set as seed for AI
        };
        reader.readAsDataURL(file);
    };

    // Handle Magic AI generation
    const handleMagicAI = async () => {
        if (!item?.name) {
            setAiError('יש להזין שם פריט');
            return;
        }

        setIsGenerating(true);
        setAiError(null);
        setGenerationStatus('');

        try {
            const containerHint = selectedContainer?.prompt_hint || '';
            const backgroundHint = selectedBackground?.prompt_hint || '';

            // Status steps (3 seconds each as requested)
            setGenerationStatus(`🔍 מנתח: ${item.name}`);
            await new Promise(r => setTimeout(r, 3000));

            if (backgroundHint) {
                setGenerationStatus('🖼️ מכין סביבה');
                await new Promise(r => setTimeout(r, 3000));
            } else if (!containerHint) {
                setGenerationStatus('🛸 מרכיבים מרחפים');
                await new Promise(r => setTimeout(r, 3000));
            } else {
                setGenerationStatus('🏜️ רקע המדבר');
                await new Promise(r => setTimeout(r, 3000));
            }

            if (containerHint) {
                setGenerationStatus(`🏺 מכין ${selectedContainer?.name}`);
                await new Promise(r => setTimeout(r, 3000));
            } else {
                setGenerationStatus('⚠️ ללא כלי הגשה');
                await new Promise(r => setTimeout(r, 3000));
            }

            setGenerationStatus('🎨 יוצר מציאות...');

            const imageUrl = await generateMenuImage(
                item.name,
                containerHint,
                backgroundHint,
                { description: item.description },
                userSeedImage,
                aiSettings,
                selectedBackground?.image_url // Pass the background seed URL
            );

            if (imageUrl) {
                setGenerationStatus('✅ הושלם!');
                await new Promise(r => setTimeout(r, 1000));
                handleChange('image', imageUrl);
                setUserSeedImage(null); // Clear seed after use
            }
        } catch (err) {
            setAiError('שגיאה ביצירת תמונה');
            setGenerationStatus('');
        } finally {
            setIsGenerating(false);
            setTimeout(() => setGenerationStatus(''), 2000);
        }
    };

    const handleSave = () => {
        if (item && onSave) onSave(item, modifiers);
    };

    if (!item) return null;

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <div className={`flex items-center justify-between p-4 border-b ${isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'}`}>
                <h2 className="text-xl font-black">עריכת פריט</h2>
                <button onClick={onClose} className={`p-2 rounded-xl ${isDarkMode ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}>
                    <X size={20} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-5">
                <div className="space-y-3">
                    <label className={`text-sm font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>תמונה</label>
                    <div className={`relative aspect-[4/3] rounded-2xl overflow-hidden border-2 ${isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-100'}`}>
                        {item.image ? (
                            <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center gap-2 opacity-30">
                                <ImageIcon size={48} />
                                <span className="text-sm">אין תמונה</span>
                            </div>
                        )}

                        <AnimatePresence>
                            {isGenerating && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
                                    <div className="relative mb-4">
                                        <motion.div
                                            initial={{ rotate: 0 }}
                                            animate={{ rotate: 360 }}
                                            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                                            className="w-16 h-16 rounded-full border-4 border-orange-500/20 border-t-orange-500"
                                        />
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <Sparkles className="text-orange-400" size={24} />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-white text-base font-black block">Magic AI</span>
                                        <AnimatePresence mode="wait">
                                            {generationStatus && (
                                                <motion.p key={generationStatus} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="text-orange-300 text-sm font-medium">
                                                    {generationStatus}
                                                </motion.p>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                        <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />

                        <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => fileInputRef.current?.click()}
                            className={`flex flex-col items-center justify-center p-3 rounded-xl text-sm font-semibold transition-all ${isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-white text-slate-600 border shadow-sm'}`}
                        >
                            <Camera size={20} className="mb-1" />
                            <span>צלם</span>
                        </motion.button>

                        <div className="relative">
                            <motion.div
                                whileTap={{ scale: 0.95 }}
                                onClick={() => fileInputRef.current?.click()}
                                className={`w-full h-full flex flex-col items-center justify-center p-3 rounded-xl text-sm font-semibold cursor-pointer transition-all ${userSeedImage ? 'bg-orange-500/10 border-orange-500/50 border-2' : isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-white text-slate-600 border shadow-sm'}`}
                            >
                                {userSeedImage ? (
                                    <img src={userSeedImage} className="w-7 h-7 rounded-sm object-cover mb-1 border border-orange-400" alt="Seed" />
                                ) : (
                                    <Upload size={20} className="mb-1" />
                                )}
                                <span className={userSeedImage ? 'text-orange-500 font-bold' : ''}>{userSeedImage ? 'סקיצה' : 'העלה'}</span>
                            </motion.div>
                            {userSeedImage && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setUserSeedImage(null);
                                    }}
                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md z-10"
                                >
                                    <X size={12} />
                                </button>
                            )}
                        </div>

                        <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={handleMagicAI}
                            disabled={isGenerating}
                            className="flex flex-col items-center justify-center p-3 rounded-xl text-sm font-bold bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow-lg shadow-orange-200 disabled:opacity-50"
                        >
                            <Sparkles size={20} className="mb-1" />
                            <span>Magic AI</span>
                        </motion.button>
                    </div>

                    <SeedContainerPicker
                        selectedContainer={selectedContainer}
                        onSelectContainer={setSelectedContainer}
                        selectedBackground={selectedBackground}
                        onSelectBackground={setSelectedBackground}
                        businessSeeds={businessSeeds}
                        onAddSeed={handleAddBusinessSeed}
                        onDeleteSeed={handleDeleteBusinessSeed}
                        isLoading={isLoadingSeeds}
                    />
                </div>

                <div className="space-y-2">
                    <label className={`text-sm font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>שם המנה</label>
                    <input type="text" value={item.name || ''} onChange={(e) => handleChange('name', e.target.value)} className={`w-full px-4 py-3 rounded-xl text-lg font-bold border-2 outline-none ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900 focus:border-orange-400'}`} dir="rtl" />
                </div>

                <div className="space-y-2">
                    <label className={`text-sm font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>מחיר</label>
                    <div className="relative">
                        <input type="number" value={item.price || ''} onChange={(e) => handleChange('price', e.target.value)} className={`w-full px-4 py-3 pr-12 rounded-xl text-2xl font-black border-2 outline-none ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900 focus:border-green-400'}`} dir="ltr" />
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold opacity-50">₪</span>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className={`text-sm font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>תיאור</label>
                    <textarea value={item.description || ''} onChange={(e) => handleChange('description', e.target.value)} rows={3} className={`w-full px-4 py-3 rounded-xl resize-none border-2 outline-none ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900 focus:border-blue-400'}`} dir="rtl" />
                </div>

                <div className="space-y-2">
                    <label className={`text-sm font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>סוג אישור</label>
                    <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => onAuthModeChange('pin')} className={`p-3 rounded-xl text-sm font-bold border transition-all ${authMode === 'pin' ? 'bg-orange-500 text-white ring-2 ring-orange-400' : isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-white text-slate-500'}`}>🔢 PIN</button>
                        <button onClick={() => onAuthModeChange('push')} className={`p-3 rounded-xl text-sm font-bold border transition-all ${authMode === 'push' ? 'bg-orange-500 text-white ring-2 ring-orange-400' : isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-white text-slate-500'}`}>📱 PUSH</button>
                    </div>
                </div>

                {/* Modifiers Section */}
                <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                        <label className={`text-sm font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>תוספות ושינויים ({modifiers?.length || 0})</label>
                        <button className="text-xs font-bold text-orange-500">+ הוסף קבוצה</button>
                    </div>

                    <div className="space-y-3">
                        {modifiers && modifiers.length > 0 ? (
                            modifiers.map((group) => (
                                <div
                                    key={group.id}
                                    className={`p-4 rounded-2xl border-2 ${isDarkMode ? 'bg-slate-700/50 border-slate-600' : 'bg-white border-slate-100 shadow-sm'}`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-bold text-base">{group.name}</span>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${group.is_required ? 'bg-red-500/10 text-red-500' : 'bg-slate-500/10 text-slate-400'}`}>
                                            {group.is_required ? 'חובה' : 'רשות'}
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {group.optionvalues?.map(opt => (
                                            <div
                                                key={opt.id}
                                                className={`px-2 py-1 rounded-lg text-xs font-medium ${isDarkMode ? 'bg-slate-600 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
                                            >
                                                {opt.value_name} {opt.price_adjustment > 0 ? `(+₪${opt.price_adjustment})` : ''}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className={`p-6 rounded-2xl border-2 border-dashed text-center ${isDarkMode ? 'border-slate-700 text-slate-500' : 'border-slate-200 text-slate-400'}`}>
                                <p className="text-sm">אין תוספות מוגדרות למנה זו</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            {/* Footer */}
            <div className={`p-4 border-t ${isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'}`}>
                <button
                    onClick={handleSave}
                    disabled={isGenerating || isUploading}
                    className={`w-full py-4 rounded-2xl font-black text-lg shadow-xl shadow-orange-500/20 flex items-center justify-center gap-2 transition-all active:scale-95 ${isGenerating || isUploading ? 'bg-slate-700 text-slate-500' : 'bg-orange-500 text-white'
                        }`}
                >
                    <Save size={20} />
                    שמור שינויים לתפריט
                </button>
            </div>
        </div>
    );
};

export default EditPanel;
