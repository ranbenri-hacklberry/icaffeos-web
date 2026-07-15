import React, { useState, useEffect } from 'react';
import { X, Sparkles, Image as ImageIcon, Wand2, Loader2, Check, Upload, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { generateImageWithAI } from '@/lib/managerApi';

const MagicImageModal = ({ onClose, onImageGenerated, productName }) => {
    const [mode, setMode] = useState('create'); // 'create' | 'enhance'
    const [prompt, setPrompt] = useState(productName || '');
    const [style, setStyle] = useState('realistic');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedUrl, setGeneratedUrl] = useState(null);
    const [error, setError] = useState(null);

    // Persistence: Save prompt to avoid loss on phone sleep/refresh
    useEffect(() => {
        const saved = localStorage.getItem('magic_prompt_backup');
        if (saved && !prompt) setPrompt(saved);
    }, []);

    useEffect(() => {
        if (prompt) {
            localStorage.setItem('magic_prompt_backup', prompt);
        }
    }, [prompt]);


    // Enhancement State
    const [referenceImage, setReferenceImage] = useState(null);
    const [isUploading, setIsUploading] = useState(false);

    const styles = [
        { id: 'realistic', label: 'ריאליסטי', icon: '📸' },
        { id: 'appetizing', label: 'מעורר תיאבון', icon: '😋' },
        { id: 'studio', label: 'סטודיו', icon: '💡' },
        { id: 'artistic', label: 'אומנותי', icon: '🎨' }
    ];

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `temp_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
            const { error: uploadError } = await supabase.storage
                .from('menu-images')
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('menu-images')
                .getPublicUrl(fileName);

            setReferenceImage(publicUrl);
        } catch (error) {
            console.error('Error uploading ref image:', error);
            setError('שגיאה בהעלאת תמונת מקור');
        } finally {
            setIsUploading(false);
        }
    };

    const simpleTranslate = (text) => {
        const dictionary = {
            'אייס': 'Iced', 'קפה': 'Coffee', 'הפוך': 'Cappuccino', 'אספרסו': 'Espresso',
            'אמריקנו': 'Americano', 'תה': 'Tea', 'שוקו': 'Hot Chocolate', 'סחלב': 'Sahlab',
            'פיצה': 'Pizza', 'המבורגר': 'Burger', 'סלט': 'Salad', 'כריך': 'Sandwich',
            'טוסט': 'Toast', 'גבינה': 'Cheese', 'עוגה': 'Cake', 'עוגת': 'Cake', 'עוגיות': 'Cookies', 'עוגייה': 'Cookie', 'עוגיית': 'Cookie',
            'שוקולד': 'Chocolate', 'גלידה': 'Ice Cream', 'לחם': 'Bread', 'פסטה': 'Pasta', 'רביולי': 'Ravioli',
            'מרק': 'Soup', 'קינוח': 'Dessert', 'שתיה': 'Drink', 'קולה': 'Coke',
            'מים': 'Water', 'מיץ': 'Juice', 'תפוזים': 'Orange', 'לימונדה': 'Lemonade',
            'ביצה': 'Egg', 'חביתה': 'Omelette', 'בוקר': 'Breakfast', 'קוראסון': 'Croissant',
            'רוגלך': 'Rugelach', 'בורקס': 'Burekas', 'מאפה': 'Pastry',
            'בראוניז': 'Brownie', 'מוס': 'Mousse', 'קראנץ': 'Crunch', 'שמרים': 'Yeast Cake',
            'וניל': 'Vanilla', 'תות': 'Strawberry', 'בננה': 'Banana', 'פירות': 'Fruit'
        };

        let translated = text;
        Object.keys(dictionary).forEach(key => {
            // Simple replace, word for word
            translated = translated.replace(new RegExp(key, 'g'), dictionary[key]);
        });

        // Cleanup: Remove remaining Hebrew chars to prevent weird prompts
        translated = translated.replace(/[\u0590-\u05FF]/g, '').replace(/\s+/g, ' ').trim();

        return translated;
    };

    const handleGenerate = async () => {
        // Validation: Prompt is usually needed, but for 'enhance' with image, we can default to product name if empty
        const rawPrompt = prompt.trim() || productName || "delicious food";
        const effectivePrompt = simpleTranslate(rawPrompt);

        setIsGenerating(true);
        setError(null);
        setGeneratedUrl(null);

        try {
            // 1. Base Prompt with strict "Single Item" constraint
            // Fix: Explicitly say "food inside packaging" to avoid empty boxes
            let finalPrompt = `Single delicious ${effectivePrompt} inside plain disposable takeaway packaging`;

            // 2. Add 'Takeaway' Context + No Text/Brand constraints
            finalPrompt += ", plastic cup or paper box, unbranded, blank, no text, no writing, no labels, no logo, minimal style, centered, high view";

            // 3. Add Style Modifiers
            if (style === 'realistic') finalPrompt += ", realistic food photography, 4k, sharp focus, no background clutter";
            if (style === 'appetizing') finalPrompt += ", delicious, vibrant, golden hour lighting, clean";
            if (style === 'studio') finalPrompt += ", studio lighting, white background, product shot, isolated";
            if (style === 'artistic') finalPrompt += ", artistic painting style, creative, minimal";

            const seed = Math.floor(Math.random() * 1000000);
            const encoded = encodeURIComponent(finalPrompt);

            // 3. Construct URL
            // Removed 'model=flux' to prioritize speed (Flux is slow, default is fast)
            let url = `https://image.pollinations.ai/prompt/${encoded}?width=512&height=512&seed=${seed}&nologin=true`;

            if (mode === 'enhance' && referenceImage) {
                // For Img2Img, Pollinations uses the 'image' parameter.
                url += `&image=${encodeURIComponent(referenceImage)}`;
            }

            console.log('Generating AI Image URL:', url);
            setGeneratedUrl(url);

        } catch (err) {
            console.error('Generation init failed:', err);
            setError('שגיאה ביצירת תמונה');
            setIsGenerating(false);
        }
    };

    const handleAccept = () => {
        if (generatedUrl) {
            onImageGenerated(generatedUrl);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col" dir="rtl">

                {/* Header */}
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-purple-50 to-white">
                    <div className="flex items-center gap-2 text-purple-700">
                        <Sparkles size={24} />
                        <h2 className="text-xl font-black">AI Magic Image</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition">
                        <X size={20} />
                    </button>
                </div>

                {/* Mode Tabs */}
                <div className="flex p-2 bg-gray-50/80 gap-2 shrink-0">
                    <button
                        onClick={() => setMode('create')}
                        className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${mode === 'create' ? 'bg-white shadow text-purple-600' : 'text-gray-500 hover:bg-gray-200'}`}
                    >
                        <Sparkles size={16} />
                        יצירה מחדש
                    </button>
                    <button
                        onClick={() => setMode('enhance')}
                        className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${mode === 'enhance' ? 'bg-white shadow text-purple-600' : 'text-gray-500 hover:bg-gray-200'}`}
                    >
                        <RefreshCw size={16} />
                        שיפור תמונה קיימת
                    </button>
                </div>

                <div className="p-6 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
                    {/* Reference Image Upload (Enhance Mode) */}
                    {mode === 'enhance' && (
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500">תמונת מקור (הAI ישתמש בה כבסיס)</label>
                            <div className="relative h-16 bg-gray-50 border border-dashed border-gray-300 rounded-lg overflow-hidden group hover:border-purple-500 transition-colors">
                                {referenceImage ? (
                                    <div className="flex items-center justify-between h-full px-2">
                                        <img src={referenceImage} alt="Reference" className="h-12 w-12 rounded object-cover border border-gray-200" />
                                        <span className="text-xs text-green-600 font-bold">התמונה נבחרה</span>
                                        <button
                                            onClick={() => setReferenceImage(null)}
                                            className="p-1.5 bg-red-50 rounded-full text-red-500 hover:bg-red-100 transition"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ) : (
                                    <label className="flex items-center justify-center h-full cursor-pointer gap-2 hover:bg-gray-100 transition">
                                        {isUploading ? (
                                            <Loader2 className="animate-spin text-purple-500" />
                                        ) : (
                                            <>
                                                <Upload className="text-gray-400 mb-2 group-hover:scale-110 transition" size={24} />
                                                <span className="text-xs text-gray-400 font-medium">לחץ להעלאת תמונה</span>
                                            </>
                                        )}
                                        <input
                                            type="file"
                                            className="hidden"
                                            accept="image/*"
                                            onChange={handleFileUpload}
                                            disabled={isUploading}
                                        />
                                    </label>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Prompt Input */}
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-700">{mode === 'create' ? 'מה תרצה שנכין לך?' : 'הנחיות לשיפור (אופציונלי)'}</label>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            className="w-full p-3 border border-purple-100 rounded-xl focus:border-purple-500 focus:bg-purple-50/20 outline-none text-sm font-medium resize-none h-20"
                            placeholder={mode === 'create' ? "דוגמה: Pizza או פיצה מרגריטה..." : "דוגמה: make it spicy, add cheese..."}
                        />
                    </div>

                    {/* Style Selection */}
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-700">סגנון</label>
                        <div className="grid grid-cols-4 gap-2">
                            {styles.map(s => (
                                <button
                                    key={s.id}
                                    onClick={() => setStyle(s.id)}
                                    className={`flex flex-col items-center justify-center p-2 rounded-xl border-2 transition-all ${style === s.id
                                        ? 'border-purple-500 bg-purple-50 text-purple-700'
                                        : 'border-transparent bg-gray-50 text-gray-500 hover:bg-gray-100'
                                        }`}
                                >
                                    <span className="text-xl mb-1">{s.icon}</span>
                                    <span className="text-xs font-bold">{s.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Result Area */}
                    <div className="relative mx-auto h-64 w-64 bg-gray-100 rounded-xl overflow-hidden flex items-center justify-center border-2 border-dashed border-gray-200 shrink-0 shadow-sm">

                        {/* Image Layer - Always render if URL exists to trigger load */}
                        {generatedUrl && (
                            <img
                                src={generatedUrl}
                                alt="Generated"
                                className={`w-full h-full object-cover transition-opacity duration-500 ${isGenerating ? 'opacity-0 absolute' : 'opacity-100'}`}
                                onLoad={() => setIsGenerating(false)}
                                onError={() => { setIsGenerating(false); setError('שגיאה בטעינת התמונה'); }}
                            />
                        )}

                        {/* Loading Overlay */}
                        {isGenerating && (
                            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 text-purple-600 bg-gray-50/50 backdrop-blur-sm">
                                <Loader2 size={40} className="animate-spin" />
                                <span className="font-bold text-sm">הקסם קורה...</span>
                            </div>
                        )}

                        {/* Error State */}
                        {error && !isGenerating && (
                            <div className="text-center p-4 text-red-500 bg-red-50 rounded-xl">
                                <p className="font-bold mb-1">אופס!</p>
                                <p className="text-sm">{error}</p>
                            </div>
                        )}

                        {/* Empty State */}
                        {!generatedUrl && !isGenerating && !error && (
                            <div className="text-gray-300 flex flex-col items-center gap-2">
                                <ImageIcon size={48} />
                                <span className="text-sm font-bold text-gray-400">התמונה תופיע כאן</span>
                            </div>
                        )}
                    </div>
                    {/* Debug Info (User requested to see prompt) */}
                    <div className="text-[10px] text-gray-400 text-center px-4 font-mono truncate">
                        Prompt: {prompt.trim() || productName} ({style})
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-100 bg-gray-50 flex gap-3">
                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating || (!prompt.trim() && !productName)}
                        className="flex-1 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-purple-200"
                    >
                        <Wand2 size={18} />
                        {isGenerating ? (mode === 'create' ? 'מייצר...' : 'משפר...') : (mode === 'create' ? 'צור תמונה' : 'שפר תמונה')}
                    </button>

                    {generatedUrl && (
                        <button
                            onClick={handleAccept}
                            className="flex-[2] py-3 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600 flex items-center justify-center gap-2 shadow-lg shadow-green-200 animate-in fade-in slide-in-from-right-4"
                        >
                            <Check size={18} strokeWidth={3} />
                            השתמש בתמונה
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MagicImageModal;
