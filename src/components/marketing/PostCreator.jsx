/**
 * PostCreator.jsx - Enhanced Post Creation Flow
 *
 * Features:
 * - Select menu item as seed image
 * - AI text enhancement
 * - Separate background seed
 * - Multiple providers (local/gemini/grok)
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Plus, X, Image as ImageIcon, Type, Download, Loader2,
    Square, RectangleVertical, RectangleHorizontal, Sparkles,
    Upload, Check, RefreshCw, Settings2, ChevronLeft, Wand2, UtensilsCrossed
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

// Post types with dimensions
const POST_TYPES = [
    { id: 'story', label: 'סטורי', icon: RectangleVertical, ratio: '9:16', width: 1080, height: 1920, desc: 'אינסטגרם / פייסבוק סטורי' },
    { id: 'post', label: 'פוסט', icon: Square, ratio: '1:1', width: 1080, height: 1080, desc: 'פוסט מרובע לפיד' },
    { id: 'wide', label: 'באנר', icon: RectangleHorizontal, ratio: '16:9', width: 1920, height: 1080, desc: 'באנר רחב לאתר/פייסבוק' },
    { id: 'portrait', label: 'פורטרט', icon: RectangleVertical, ratio: '4:5', width: 1080, height: 1350, desc: 'פורטרט לאינסטגרם' }
];

// Providers
const PROVIDERS = [
    { id: 'local', label: 'מקומי', icon: '🖥️' },
    { id: 'gemini', label: 'Gemini', icon: '✨' },
    { id: 'grok', label: 'Grok', icon: '🚀' }
];

// Backend URL
const BACKEND_URL = 'http://localhost:8081';

const PostCreator = ({ businessId, onClose }) => {
    // Flow state
    const [step, setStep] = useState('select'); // select, create, generating, done
    const [selectedType, setSelectedType] = useState(null);
    const [loading, setLoading] = useState(false);

    // Form state
    const [title, setTitle] = useState('');
    const [bodyText, setBodyText] = useState('');
    const [selectedLogo, setSelectedLogo] = useState(null);
    const [selectedBackground, setSelectedBackground] = useState(null);
    const [selectedMenuItem, setSelectedMenuItem] = useState(null);
    const [provider, setProvider] = useState('gemini');

    // Data state
    const [logos, setLogos] = useState([]);
    const [backgrounds, setBackgrounds] = useState([]);
    const [menuItems, setMenuItems] = useState([]);
    const [providerStatus, setProviderStatus] = useState({});

    // Generation state
    const [isGenerating, setIsGenerating] = useState(false);
    const [isEnhancing, setIsEnhancing] = useState(false);
    const [generatedImage, setGeneratedImage] = useState(null);
    const [error, setError] = useState(null);

    // Refs
    const logoInputRef = useRef(null);
    const bgInputRef = useRef(null);

    // Fetch business data on mount
    useEffect(() => {
        const fetchData = async () => {
            if (!businessId) return;

            // Fetch logos
            const { data: logoData } = await supabase
                .from('business_assets')
                .select('*')
                .eq('business_id', businessId)
                .eq('asset_type', 'logo');

            if (logoData) setLogos(logoData);

            // Fetch background seeds
            const { data: seedData } = await supabase
                .from('business_seeds')
                .select('*')
                .eq('business_id', businessId);

            // Add default backgrounds
            const defaultBgs = [
                { id: 'bg_gradient_purple', name: 'גרדיאנט סגול', style: 'purple gradient background, modern' },
                { id: 'bg_gradient_orange', name: 'גרדיאנט כתום', style: 'warm orange gradient background' },
                { id: 'bg_minimal_white', name: 'לבן נקי', style: 'clean white minimal background' },
                { id: 'bg_cafe', name: 'בית קפה', style: 'cozy cafe interior bokeh background' },
                { id: 'bg_wood', name: 'עץ טבעי', style: 'rustic wooden table surface background' }
            ];
            setBackgrounds([...defaultBgs, ...(seedData || [])]);

            // Fetch menu items with images
            const { data: menuData } = await supabase
                .from('menu_items')
                .select('id, name, description, price, image_url')
                .eq('business_id', businessId)
                .not('image_url', 'is', null)
                .order('name')
                .limit(20);

            if (menuData) setMenuItems(menuData);

            // Fetch provider status
            try {
                const res = await fetch(`${BACKEND_URL}/api/marketing/providers/${businessId}`);
                if (res.ok) {
                    const data = await res.json();
                    setProviderStatus(data.providers || {});
                }
            } catch (err) {
                console.error('Failed to fetch providers:', err);
            }
        };

        fetchData();
    }, [businessId]);

    // AI Text Enhancement
    const handleEnhanceText = async () => {
        if (!title.trim() && !selectedMenuItem) return;

        setIsEnhancing(true);
        try {
            const context = selectedMenuItem
                ? `מנה: ${selectedMenuItem.name}. ${selectedMenuItem.description || ''}`
                : title;

            const res = await fetch(`${BACKEND_URL}/api/maya/marketing`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    businessId,
                    prompt: `צור כותרת שיווקית קצרה ומושכת (עד 5 מילים) ותיאור קצר (משפט אחד) עבור: ${context}.
החזר בפורמט:
כותרת: [הכותרת]
תיאור: [התיאור]`
                })
            });

            if (res.ok) {
                const data = await res.json();
                const response = data.response || data.message || '';

                // Parse response
                const titleMatch = response.match(/כותרת:\s*(.+?)(?:\n|תיאור:|$)/);
                const descMatch = response.match(/תיאור:\s*(.+?)$/);

                if (titleMatch) setTitle(titleMatch[1].trim());
                if (descMatch) setBodyText(descMatch[1].trim());
            }
        } catch (err) {
            console.error('Text enhancement error:', err);
            setError('שגיאה בשיפור הטקסט');
        } finally {
            setIsEnhancing(false);
        }
    };

    // When selecting a menu item, auto-fill title
    const handleMenuItemSelect = (item) => {
        if (selectedMenuItem?.id === item.id) {
            setSelectedMenuItem(null);
        } else {
            setSelectedMenuItem(item);
            if (!title.trim()) {
                setTitle(item.name);
            }
        }
    };

    // Handle logo upload (with automatic background removal)
    const handleLogoUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setLoading(true);
            setError(null);

            // Convert file to base64
            const base64 = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result.split(',')[1]);
                reader.readAsDataURL(file);
            });

            // Remove background using Python script via API
            console.log('🎨 Removing background from logo...');
            let processedBase64 = base64;
            try {
                const bgRes = await fetch(`${BACKEND_URL}/api/marketing/remove-background`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ imageBase64: base64 })
                });
                if (bgRes.ok) {
                    const { imageBase64: transparent } = await bgRes.json();
                    processedBase64 = transparent;
                    console.log('✅ Background removed successfully');
                } else {
                    console.warn('Background removal failed, using original');
                }
            } catch (bgErr) {
                console.warn('Background removal unavailable:', bgErr.message);
            }

            // Convert base64 to blob for upload
            const byteCharacters = atob(processedBase64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'image/png' });

            const fileName = `logo_${businessId}_${Date.now()}.png`;

            const { error: uploadError } = await supabase.storage
                .from('business-assets')
                .upload(`logos/${fileName}`, blob);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('business-assets')
                .getPublicUrl(`logos/${fileName}`);

            // Save to DB
            const { data: newLogo } = await supabase
                .from('business_assets')
                .insert({
                    business_id: businessId,
                    asset_type: 'logo',
                    url: publicUrl,
                    name: file.name.replace(/\.[^/.]+$/, '.png')
                })
                .select()
                .single();

            if (newLogo) {
                setLogos(prev => [...prev, newLogo]);
                setSelectedLogo(newLogo);
            }
        } catch (err) {
            console.error('Logo upload error:', err);
            setError('שגיאה בהעלאת הלוגו');
        } finally {
            setLoading(false);
        }
    };

    // Handle background upload
    const handleBackgroundUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setLoading(true);
            const fileExt = file.name.split('.').pop();
            const fileName = `bg_${businessId}_${Date.now()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('menu-images')
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('menu-images')
                .getPublicUrl(fileName);

            // Save to business_seeds
            const { data: newSeed } = await supabase
                .from('business_seeds')
                .insert({
                    business_id: businessId,
                    category: 'background',
                    image_url: publicUrl,
                    name: file.name
                })
                .select()
                .single();

            if (newSeed) {
                setBackgrounds(prev => [...prev, newSeed]);
                setSelectedBackground(newSeed);
            }
        } catch (err) {
            console.error('Background upload error:', err);
            setError('שגיאה בהעלאת הרקע');
        } finally {
            setLoading(false);
        }
    };

    // Generate post
    const handleGenerate = async () => {
        if (!title.trim()) {
            setError('נא להזין כותרת');
            return;
        }

        setIsGenerating(true);
        setError(null);
        setStep('generating');

        try {
            const postType = POST_TYPES.find(t => t.id === selectedType);
            let imageBase64 = null;

            // If menu item has image - use it directly (no AI generation needed!)
            if (selectedMenuItem?.image_url) {
                console.log('📸 Using menu item image directly - no AI generation');
                try {
                    const imgResponse = await fetch(selectedMenuItem.image_url);
                    const blob = await imgResponse.blob();
                    imageBase64 = await new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result.split(',')[1]);
                        reader.readAsDataURL(blob);
                    });
                } catch (e) {
                    console.error('Failed to load menu item image:', e);
                    throw new Error('לא ניתן לטעון את תמונת המנה');
                }
            } else {
                // No menu item - use AI generation
                console.log('🤖 Generating new image with AI');

                // Build prompt
                const promptParts = [
                    `Create a professional marketing background image`,
                    selectedBackground?.style || '',
                    `Format: ${postType.ratio} aspect ratio`,
                    'Professional food photography, high quality, suitable for social media',
                    'DO NOT include any text, letters, words, or typography in the image',
                    'Clean composition with space for text overlay'
                ].filter(Boolean).join('. ');

                // Get background seed image if available
                let seedImageBase64 = null;
                if (selectedBackground?.image_url) {
                    try {
                        const imgResponse = await fetch(selectedBackground.image_url);
                        const blob = await imgResponse.blob();
                        seedImageBase64 = await new Promise((resolve) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result.split(',')[1]);
                            reader.readAsDataURL(blob);
                        });
                    } catch (e) {
                        console.warn('Could not load seed image:', e);
                    }
                }

                const res = await fetch(`${BACKEND_URL}/api/marketing/generate-image`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        businessId,
                        prompt: promptParts,
                        aspectRatio: postType.ratio,
                        provider,
                        seedImageBase64,
                        denoise: 0.7
                    })
                });

                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || 'שגיאה ביצירת התמונה');
                }

                const data = await res.json();
                imageBase64 = data.imageBase64;
            }

            // Add text overlay (title + description)
            const compositeRes = await fetch(`${BACKEND_URL}/api/marketing/composite-hebrew`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    businessId,
                    imageBase64,
                    hebrewText: title,
                    bodyText: bodyText || '',
                    textPosition: 'bottom',
                    textColor: '#FFFFFF',
                    textSize: 'large',
                    addLogo: !!selectedLogo,
                    logoUrl: selectedLogo?.url
                })
            });

            if (compositeRes.ok) {
                const { finalImage } = await compositeRes.json();
                setGeneratedImage(`data:image/png;base64,${finalImage}`);
            } else {
                setGeneratedImage(`data:image/png;base64,${imageBase64}`);
            }

            setStep('done');

        } catch (err) {
            console.error('Generation error:', err);
            setError(err.message || 'שגיאה ביצירת התמונה');
            setStep('create');
        } finally {
            setIsGenerating(false);
        }
    };

    // Download image
    const handleDownload = () => {
        if (!generatedImage) return;
        const link = document.createElement('a');
        link.href = generatedImage;
        link.download = `post_${selectedType}_${Date.now()}.png`;
        link.click();
    };

    // Reset and create new
    const handleNewPost = () => {
        setStep('select');
        setSelectedType(null);
        setTitle('');
        setBodyText('');
        setSelectedMenuItem(null);
        setGeneratedImage(null);
        setError(null);
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[10000] flex items-center justify-center p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-slate-900 rounded-3xl w-full max-w-md max-h-[90vh] overflow-hidden shadow-2xl border border-white/10"
            >
                {/* Header */}
                <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {step !== 'select' && step !== 'done' && (
                            <button onClick={() => setStep(step === 'generating' ? 'create' : 'select')} className="p-1 hover:bg-white/20 rounded-full">
                                <ChevronLeft className="w-5 h-5 text-white" />
                            </button>
                        )}
                        <h2 className="text-white font-bold text-lg">
                            {step === 'select' && 'יצירת פוסט חדש'}
                            {step === 'create' && POST_TYPES.find(t => t.id === selectedType)?.label}
                            {step === 'generating' && 'יוצר...'}
                            {step === 'done' && 'מוכן! 🎉'}
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <X className="w-5 h-5 text-white" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 overflow-y-auto max-h-[calc(90vh-120px)]">
                    <AnimatePresence mode="wait">
                        {/* Step 1: Select Type */}
                        {step === 'select' && (
                            <motion.div
                                key="select"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                className="grid grid-cols-2 gap-3"
                            >
                                {POST_TYPES.map((type) => {
                                    const Icon = type.icon;
                                    return (
                                        <button
                                            key={type.id}
                                            onClick={() => { setSelectedType(type.id); setStep('create'); }}
                                            className="p-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-500/50 rounded-2xl transition-all text-right"
                                        >
                                            <Icon className="w-8 h-8 text-purple-400 mb-2" />
                                            <h3 className="text-white font-bold">{type.label}</h3>
                                            <p className="text-slate-400 text-xs">{type.desc}</p>
                                            <span className="text-purple-400 text-xs font-mono mt-1 block">{type.ratio}</span>
                                        </button>
                                    );
                                })}
                            </motion.div>
                        )}

                        {/* Step 2: Create Form */}
                        {step === 'create' && (
                            <motion.div
                                key="create"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                className="space-y-4"
                            >
                                {/* Menu Item Selection */}
                                {menuItems.length > 0 && (
                                    <div>
                                        <label className="text-slate-300 text-sm mb-2 flex items-center gap-2">
                                            <UtensilsCrossed className="w-4 h-4" />
                                            בחר מנה מהתפריט
                                        </label>
                                        <div className="flex gap-2 overflow-x-auto pb-2">
                                            {menuItems.map((item) => (
                                                <button
                                                    key={item.id}
                                                    onClick={() => handleMenuItemSelect(item)}
                                                    className={`flex-shrink-0 w-20 rounded-xl overflow-hidden border-2 transition-all ${
                                                        selectedMenuItem?.id === item.id ? 'border-purple-500 ring-2 ring-purple-500/30' : 'border-transparent'
                                                    }`}
                                                >
                                                    <img src={item.image_url} alt={item.name} className="w-full h-16 object-cover" />
                                                    <p className="text-white text-xs p-1 truncate bg-black/50">{item.name}</p>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Title with AI Enhancement */}
                                <div>
                                    <label className="text-slate-300 text-sm mb-1 flex items-center justify-between">
                                        <span>כותרת *</span>
                                        <button
                                            onClick={handleEnhanceText}
                                            disabled={isEnhancing || (!title.trim() && !selectedMenuItem)}
                                            className="text-purple-400 hover:text-purple-300 text-xs flex items-center gap-1 disabled:opacity-50"
                                        >
                                            {isEnhancing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                                            שפר עם AI
                                        </button>
                                    </label>
                                    <input
                                        type="text"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        placeholder="מבצע השבוע!"
                                        className="w-full bg-white/5 border border-white/20 rounded-xl p-3 text-white placeholder-slate-500 focus:border-purple-500 transition-all"
                                    />
                                </div>

                                {/* Body Text */}
                                <div>
                                    <label className="text-slate-300 text-sm mb-1 block">טקסט נוסף (אופציונלי)</label>
                                    <textarea
                                        value={bodyText}
                                        onChange={(e) => setBodyText(e.target.value)}
                                        placeholder="פרטים נוספים..."
                                        rows={2}
                                        className="w-full bg-white/5 border border-white/20 rounded-xl p-3 text-white placeholder-slate-500 focus:border-purple-500 transition-all resize-none"
                                    />
                                </div>

                                {/* Background Selection - Only show if NO menu item selected */}
                                {!selectedMenuItem?.image_url && (
                                    <div>
                                        <label className="text-slate-300 text-sm mb-2 block">סגנון רקע</label>
                                        <div className="flex gap-2 flex-wrap">
                                            {backgrounds.slice(0, 8).map((bg) => (
                                                <button
                                                    key={bg.id}
                                                    onClick={() => setSelectedBackground(selectedBackground?.id === bg.id ? null : bg)}
                                                    className={`w-12 h-12 rounded-xl overflow-hidden border-2 transition-all ${
                                                        selectedBackground?.id === bg.id ? 'border-purple-500' : 'border-transparent'
                                                    }`}
                                                    title={bg.name}
                                                >
                                                    {bg.image_url ? (
                                                        <img src={bg.image_url} alt={bg.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className={`w-full h-full flex items-center justify-center text-xs ${
                                                            bg.id.includes('purple') ? 'bg-gradient-to-br from-purple-500 to-pink-500' :
                                                            bg.id.includes('orange') ? 'bg-gradient-to-br from-orange-500 to-red-500' :
                                                            bg.id.includes('white') ? 'bg-white' :
                                                            bg.id.includes('wood') ? 'bg-amber-800' : 'bg-slate-700'
                                                        }`}>
                                                            {bg.id.includes('cafe') && '☕'}
                                                        </div>
                                                    )}
                                                </button>
                                            ))}
                                            <input type="file" ref={bgInputRef} onChange={handleBackgroundUpload} accept="image/*" className="hidden" />
                                            <button
                                                onClick={() => bgInputRef.current?.click()}
                                                className="w-12 h-12 rounded-xl border-2 border-dashed border-white/20 hover:border-purple-500/50 flex items-center justify-center transition-all"
                                            >
                                                <Upload className="w-4 h-4 text-slate-400" />
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Logo Selection */}
                                <div>
                                    <label className="text-slate-300 text-sm mb-2 flex items-center justify-between">
                                        <span>לוגו</span>
                                        <span className="text-xs text-slate-500">העלה לוגו עם רקע שקוף (PNG)</span>
                                    </label>
                                    <div className="flex gap-2 flex-wrap">
                                        {logos.map((logo) => (
                                            <button
                                                key={logo.id}
                                                onClick={() => setSelectedLogo(selectedLogo?.id === logo.id ? null : logo)}
                                                className={`w-12 h-12 rounded-xl overflow-hidden border-2 transition-all ${
                                                    selectedLogo?.id === logo.id ? 'border-purple-500' : 'border-transparent'
                                                }`}
                                            >
                                                <img src={logo.url} alt={logo.name} className="w-full h-full object-contain bg-white/10" />
                                            </button>
                                        ))}
                                        <input type="file" ref={logoInputRef} onChange={handleLogoUpload} accept="image/png" className="hidden" />
                                        <button
                                            onClick={() => logoInputRef.current?.click()}
                                            disabled={loading}
                                            className="w-12 h-12 rounded-xl border-2 border-dashed border-white/20 hover:border-purple-500/50 flex items-center justify-center transition-all disabled:opacity-50"
                                        >
                                            {loading ? <Loader2 className="w-4 h-4 text-slate-400 animate-spin" /> : <Plus className="w-4 h-4 text-slate-400" />}
                                        </button>
                                    </div>
                                </div>

                                {/* Provider Selection - Only show if NO menu item selected */}
                                {!selectedMenuItem?.image_url && (
                                    <div>
                                        <label className="text-slate-300 text-sm mb-2 block">מנוע יצירה</label>
                                        <div className="flex gap-2">
                                            {PROVIDERS.map((p) => {
                                                const status = providerStatus[p.id];
                                                const isAvailable = status?.available !== false;
                                                return (
                                                    <button
                                                        key={p.id}
                                                        onClick={() => isAvailable && setProvider(p.id)}
                                                        disabled={!isAvailable}
                                                        className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-1 ${
                                                            provider === p.id
                                                                ? 'bg-purple-600 text-white'
                                                                : isAvailable
                                                                    ? 'bg-white/5 text-slate-300 hover:bg-white/10'
                                                                    : 'bg-white/5 text-slate-500 opacity-50 cursor-not-allowed'
                                                        }`}
                                                    >
                                                        <span>{p.icon}</span>
                                                        <span>{p.label}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Info when menu item selected */}
                                {selectedMenuItem?.image_url && (
                                    <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 text-green-300 text-sm">
                                        ✨ תמונת המנה תשמש כבסיס - רק נוסיף כותרות
                                    </div>
                                )}

                                {/* Error */}
                                {error && (
                                    <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-3 text-red-300 text-sm">
                                        {error}
                                    </div>
                                )}

                                {/* Generate Button */}
                                <button
                                    onClick={handleGenerate}
                                    disabled={!title.trim() || isGenerating}
                                    className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all"
                                >
                                    {isGenerating ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            {selectedMenuItem?.image_url ? 'מוסיף כותרות...' : 'יוצר...'}
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="w-5 h-5" />
                                            {selectedMenuItem?.image_url ? 'הוסף כותרות' : 'צור תמונה'}
                                        </>
                                    )}
                                </button>
                            </motion.div>
                        )}

                        {/* Step 3: Generating */}
                        {step === 'generating' && (
                            <motion.div
                                key="generating"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="flex flex-col items-center justify-center py-12"
                            >
                                <Loader2 className="w-16 h-16 text-purple-500 animate-spin mb-4" />
                                <p className="text-white font-medium">יוצר את התמונה...</p>
                                <p className="text-slate-400 text-sm">זה יכול לקחת כמה שניות</p>
                            </motion.div>
                        )}

                        {/* Step 4: Done */}
                        {step === 'done' && generatedImage && (
                            <motion.div
                                key="done"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="space-y-4"
                            >
                                <div className="rounded-2xl overflow-hidden border border-white/10">
                                    <img src={generatedImage} alt="Generated" className="w-full" />
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        onClick={handleDownload}
                                        className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 rounded-xl font-bold text-white flex items-center justify-center gap-2"
                                    >
                                        <Download className="w-5 h-5" />
                                        הורד
                                    </button>
                                    <button
                                        onClick={handleNewPost}
                                        className="flex-1 py-3 bg-white/10 hover:bg-white/20 rounded-xl font-bold text-white flex items-center justify-center gap-2"
                                    >
                                        <RefreshCw className="w-5 h-5" />
                                        חדש
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </motion.div>
    );
};

// Export button component for easy integration
export const PostCreatorButton = ({ businessId, className = '' }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className={`w-14 h-14 rounded-full bg-purple-600 border-4 border-purple-400 shadow-xl shadow-purple-500/40 flex items-center justify-center hover:bg-purple-500 hover:border-purple-300 transition-all ${className}`}
            >
                <Plus className="w-7 h-7 text-white" />
            </button>

            <AnimatePresence>
                {isOpen && <PostCreator businessId={businessId} onClose={() => setIsOpen(false)} />}
            </AnimatePresence>
        </>
    );
};

export default PostCreator;
