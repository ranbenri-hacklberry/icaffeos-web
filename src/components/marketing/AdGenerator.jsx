/**
 * AdGenerator.jsx - Digital Ad Agency Component
 *
 * Autonomous workflow for generating professional marketing visuals
 * with Hebrew text overlay using local AI infrastructure.
 *
 * Flow: User Input → Mistral (Prompt Enrichment) → ComfyUI (Image) → Sharp (Hebrew Overlay)
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
    Sparkles,
    Image as ImageIcon,
    Type,
    Download,
    RefreshCw,
    Wand2,
    Camera,
    Languages,
    CheckCircle2,
    Loader2,
    AlertCircle,
    Upload,
    Palette,
    Settings2,
    Cpu,
    Cloud
} from 'lucide-react';

// Generation stages for status display
const STAGES = {
    IDLE: { id: 'idle', label: 'ממתין להוראות', icon: Sparkles, color: 'text-slate-400' },
    THINKING: { id: 'thinking', label: 'מאיה חושבת על הפרומפט...', icon: Wand2, color: 'text-purple-500' },
    GENERATING: { id: 'generating', label: 'יוצרת את התמונה...', icon: Camera, color: 'text-blue-500' },
    COMPOSITING: { id: 'compositing', label: 'מוסיפה טקסט עברי...', icon: Type, color: 'text-amber-500' },
    DONE: { id: 'done', label: 'מוכן!', icon: CheckCircle2, color: 'text-emerald-500' },
    ERROR: { id: 'error', label: 'שגיאה', icon: AlertCircle, color: 'text-red-500' }
};

// Style presets
const STYLE_PRESETS = [
    { id: 'modern', label: 'מודרני', prompt: 'minimalist, clean, modern design' },
    { id: 'warm', label: 'חם ומזמין', prompt: 'warm lighting, cozy atmosphere, inviting' },
    { id: 'luxury', label: 'יוקרתי', prompt: 'luxury, elegant, premium quality, golden accents' },
    { id: 'fresh', label: 'רענן', prompt: 'fresh, vibrant colors, natural lighting' },
    { id: 'street', label: 'סטריט', prompt: 'urban style, street food aesthetic, bold' }
];

// Image generation providers
const IMAGE_PROVIDERS = [
    { id: 'local', label: 'מקומי (ComfyUI)', icon: '🖥️', description: 'יצירה מקומית - ללא עלות, דורש ComfyUI' },
    { id: 'canvas-design', label: 'סטודיו עיצוב', icon: '🎨', description: 'עיצוב מקצועי ברמת מוזיאון - ללא API key' },
    { id: 'grok', label: 'xAI Grok', icon: '🚀', description: 'Aurora - מהיר ויצירתי, דורש API key' }
];

const AdGenerator = ({ businessId, businessName, logoUrl }) => {
    // State
    const [prompt, setPrompt] = useState('');
    const [overlayText, setOverlayText] = useState('');
    const [selectedStyle, setSelectedStyle] = useState('modern');
    const [selectedProvider, setSelectedProvider] = useState('canvas-design'); // local, canvas-design, grok
    const [stage, setStage] = useState(STAGES.IDLE);
    const [progress, setProgress] = useState(0);
    const [generatedImage, setGeneratedImage] = useState(null);
    const [enrichedPrompt, setEnrichedPrompt] = useState('');
    const [error, setError] = useState(null);
    const [showAdvanced, setShowAdvanced] = useState(false);

    // Seed image state
    const [seedImage, setSeedImage] = useState(null); // { base64, preview }
    const seedInputRef = React.useRef(null);

    // Provider availability (fetched from backend)
    const [providerStatus, setProviderStatus] = useState({});

    // Fetch provider availability on mount
    useEffect(() => {
        const fetchProviders = async () => {
            if (!businessId) return;
            try {
                const res = await fetch(`http://localhost:8081/api/marketing/providers/${businessId}`);
                if (res.ok) {
                    const data = await res.json();
                    setProviderStatus(data.providers || {});
                }
            } catch (err) {
                console.error('Failed to fetch provider status:', err);
            }
        };
        fetchProviders();
    }, [businessId]);

    // Advanced settings
    const [settings, setSettings] = useState({
        textPosition: 'bottom', // top, center, bottom
        textColor: '#FFFFFF',
        textSize: 'large', // small, medium, large
        addLogo: true,
        imageRatio: '1:1', // 1:1, 4:5, 9:16
        denoise: 0.75 // For img2img (lower = more influence from seed)
    });

    // Handle seed image upload
    const handleSeedImageUpload = useCallback((e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            setError('נא לבחור קובץ תמונה');
            return;
        }

        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            setError('גודל התמונה מקסימלי הוא 10MB');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const base64Full = event.target.result;
            // Extract just the base64 data (remove data:image/xxx;base64, prefix)
            const base64 = base64Full.split(',')[1];
            setSeedImage({
                base64,
                preview: base64Full
            });
        };
        reader.readAsDataURL(file);
    }, []);

    // Remove seed image
    const handleRemoveSeedImage = useCallback(() => {
        setSeedImage(null);
        if (seedInputRef.current) {
            seedInputRef.current.value = '';
        }
    }, []);

    // Generate the ad
    const handleGenerate = useCallback(async () => {
        if (!prompt.trim()) {
            setError('נא להזין תיאור למבצע');
            return;
        }

        setError(null);
        setGeneratedImage(null);
        setEnrichedPrompt('');

        try {
            // Stage 1: Thinking (Mistral prompt enrichment)
            setStage(STAGES.THINKING);
            setProgress(15);

            const stylePreset = STYLE_PRESETS.find(s => s.id === selectedStyle);

            const thinkingRes = await fetch('http://localhost:8081/api/marketing/enrich-prompt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    businessId,
                    userPrompt: prompt,
                    styleHint: stylePreset?.prompt || '',
                    context: businessName
                })
            });

            if (!thinkingRes.ok) throw new Error('שגיאה בעיבוד הפרומפט');

            const { enrichedPrompt: enriched, suggestedOverlay } = await thinkingRes.json();
            setEnrichedPrompt(enriched);

            // Auto-set overlay text if not provided
            if (!overlayText && suggestedOverlay) {
                setOverlayText(suggestedOverlay);
            }

            setProgress(35);

            // Stage 2: Image Generation (provider-based)
            setStage(STAGES.GENERATING);

            const generatePayload = {
                businessId,
                prompt: enriched,
                aspectRatio: settings.imageRatio,
                style: selectedStyle,
                provider: selectedProvider // local, gemini, grok
            };

            // Add seed image if provided (for img2img - local only)
            if (seedImage?.base64) {
                generatePayload.seedImageBase64 = seedImage.base64;
                generatePayload.denoise = settings.denoise;
            }

            const generateRes = await fetch('http://localhost:8081/api/marketing/generate-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(generatePayload)
            });

            if (!generateRes.ok) throw new Error('שגיאה ביצירת התמונה');

            const { imageBase64: rawImage, comfyJobId } = await generateRes.json();
            setProgress(70);

            // Stage 3: Hebrew Text Compositing (Sharp)
            // Skip for canvas-design (already has text integrated)
            let finalImage = rawImage;

            if (selectedProvider !== 'canvas-design') {
                setStage(STAGES.COMPOSITING);

                const finalText = overlayText || prompt;

                const compositeRes = await fetch('http://localhost:8081/api/marketing/composite-hebrew', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        businessId,
                        imageBase64: rawImage,
                        hebrewText: finalText,
                        textPosition: settings.textPosition,
                        textColor: settings.textColor,
                        textSize: settings.textSize,
                        addLogo: settings.addLogo,
                        logoUrl: logoUrl
                    })
                });

                if (!compositeRes.ok) throw new Error('שגיאה בהוספת הטקסט');

                const compositeData = await compositeRes.json();
                finalImage = compositeData.finalImage;
            }

            setProgress(100);

            // Done!
            setStage(STAGES.DONE);
            setGeneratedImage(finalImage);

        } catch (err) {
            console.error('Ad generation error:', err);
            setStage(STAGES.ERROR);
            setError(err.message || 'שגיאה לא צפויה');
        }
    }, [prompt, overlayText, selectedStyle, selectedProvider, settings, businessId, businessName, logoUrl, seedImage]);

    // Download the image
    const handleDownload = useCallback(() => {
        if (!generatedImage) return;

        const link = document.createElement('a');
        link.href = `data:image/png;base64,${generatedImage}`;
        link.download = `ad-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }, [generatedImage]);

    // Reset
    const handleReset = useCallback(() => {
        setPrompt('');
        setOverlayText('');
        setGeneratedImage(null);
        setEnrichedPrompt('');
        setStage(STAGES.IDLE);
        setProgress(0);
        setError(null);
    }, []);

    const StageIcon = stage.icon;
    const isProcessing = ['thinking', 'generating', 'compositing'].includes(stage.id);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 p-6" dir="rtl">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-3 bg-white/10 backdrop-blur-sm px-6 py-3 rounded-full mb-4">
                        <Sparkles className="w-6 h-6 text-purple-400" />
                        <span className="text-white font-bold text-lg">סוכנות פרסום דיגיטלית</span>
                    </div>
                    <p className="text-slate-400">יצירת חומרי שיווק מקצועיים בעברית - אוטומטית לחלוטין</p>
                </div>

                <div className="grid lg:grid-cols-2 gap-6">
                    {/* Input Panel */}
                    <div className="bg-white/5 backdrop-blur-md rounded-3xl p-6 border border-white/10">
                        <h2 className="text-white font-bold text-xl mb-4 flex items-center gap-2">
                            <Wand2 className="w-5 h-5 text-purple-400" />
                            מה נפרסם היום?
                        </h2>

                        {/* Main Prompt Input */}
                        <div className="mb-4">
                            <label className="text-slate-300 text-sm mb-2 block">תאר את המבצע או המוצר</label>
                            <textarea
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                placeholder="לדוגמה: מבצע קיץ - קפה קר ומאפה ב-25 ש״ח בלבד!"
                                className="w-full bg-white/10 border border-white/20 rounded-2xl p-4 text-white placeholder-slate-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all resize-none h-28"
                                disabled={isProcessing}
                            />
                        </div>

                        {/* Overlay Text (optional) */}
                        <div className="mb-4">
                            <label className="text-slate-300 text-sm mb-2 block">טקסט לתמונה (אופציונלי)</label>
                            <input
                                type="text"
                                value={overlayText}
                                onChange={(e) => setOverlayText(e.target.value)}
                                placeholder="הטקסט שיופיע על התמונה"
                                className="w-full bg-white/10 border border-white/20 rounded-xl p-3 text-white placeholder-slate-500 focus:border-purple-500 transition-all"
                                disabled={isProcessing}
                            />
                        </div>

                        {/* Style Presets */}
                        <div className="mb-4">
                            <label className="text-slate-300 text-sm mb-2 block flex items-center gap-2">
                                <Palette className="w-4 h-4" />
                                סגנון
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {STYLE_PRESETS.map((style) => (
                                    <button
                                        key={style.id}
                                        onClick={() => setSelectedStyle(style.id)}
                                        disabled={isProcessing}
                                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                                            selectedStyle === style.id
                                                ? 'bg-purple-500 text-white'
                                                : 'bg-white/10 text-slate-300 hover:bg-white/20'
                                        }`}
                                    >
                                        {style.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Image Provider Selection */}
                        <div className="mb-4">
                            <label className="text-slate-300 text-sm mb-2 block flex items-center gap-2">
                                <Cloud className="w-4 h-4" />
                                ספק יצירת תמונות
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                {IMAGE_PROVIDERS.map((provider) => {
                                    const status = providerStatus[provider.id];
                                    const isAvailable = status?.available !== false;

                                    return (
                                        <button
                                            key={provider.id}
                                            onClick={() => setSelectedProvider(provider.id)}
                                            disabled={isProcessing}
                                            className={`p-3 rounded-xl text-center transition-all border relative ${
                                                selectedProvider === provider.id
                                                    ? 'bg-purple-500/20 border-purple-500 text-white'
                                                    : isAvailable
                                                        ? 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                                                        : 'bg-white/5 border-red-500/30 text-slate-500'
                                            }`}
                                        >
                                            <span className="text-xl block mb-1">{provider.icon}</span>
                                            <span className="text-xs font-medium block">{provider.label}</span>
                                            {/* Availability indicator */}
                                            <span className={`absolute top-1 left-1 w-2 h-2 rounded-full ${
                                                isAvailable ? 'bg-green-500' : 'bg-red-500'
                                            }`} />
                                        </button>
                                    );
                                })}
                            </div>
                            <p className="text-slate-500 text-xs mt-2">
                                {providerStatus[selectedProvider]?.description ||
                                 IMAGE_PROVIDERS.find(p => p.id === selectedProvider)?.description}
                            </p>
                        </div>

                        {/* Seed Image Upload */}
                        <div className="mb-4">
                            <label className="text-slate-300 text-sm mb-2 block flex items-center gap-2">
                                <Upload className="w-4 h-4" />
                                תמונת רקע (אופציונלי)
                            </label>
                            <p className="text-slate-500 text-xs mb-2">
                                העלה תמונה כבסיס - ה-AI ישתמש בה כהשראה לסגנון ולצבעים
                            </p>

                            {seedImage ? (
                                <div className="relative bg-white/5 rounded-xl p-2 border border-white/20">
                                    <img
                                        src={seedImage.preview}
                                        alt="Seed"
                                        className="w-full h-32 object-cover rounded-lg"
                                    />
                                    <button
                                        onClick={handleRemoveSeedImage}
                                        disabled={isProcessing}
                                        className="absolute top-4 right-4 bg-red-500/80 hover:bg-red-500 text-white p-1.5 rounded-full transition-all"
                                    >
                                        <RefreshCw className="w-4 h-4" />
                                    </button>
                                    <p className="text-slate-400 text-xs mt-2 text-center">תמונת רקע מוגדרת</p>
                                </div>
                            ) : (
                                <label className="block cursor-pointer">
                                    <input
                                        ref={seedInputRef}
                                        type="file"
                                        accept="image/*"
                                        onChange={handleSeedImageUpload}
                                        disabled={isProcessing}
                                        className="hidden"
                                    />
                                    <div className="border-2 border-dashed border-white/20 hover:border-purple-500/50 rounded-xl p-4 text-center transition-all">
                                        <Upload className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                                        <p className="text-slate-400 text-sm">לחץ להעלאת תמונה</p>
                                        <p className="text-slate-600 text-xs">PNG, JPG עד 10MB</p>
                                    </div>
                                </label>
                            )}
                        </div>

                        {/* Advanced Settings Toggle */}
                        <button
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            className="text-slate-400 text-sm flex items-center gap-2 mb-4 hover:text-white transition-colors"
                        >
                            <Settings2 className="w-4 h-4" />
                            הגדרות מתקדמות
                        </button>

                        {showAdvanced && (
                            <div className="bg-white/5 rounded-xl p-4 mb-4 space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-slate-400 text-xs block mb-1">מיקום טקסט</label>
                                        <select
                                            value={settings.textPosition}
                                            onChange={(e) => setSettings(s => ({ ...s, textPosition: e.target.value }))}
                                            className="w-full bg-white/10 border border-white/20 rounded-lg p-2 text-white text-sm"
                                        >
                                            <option value="top">למעלה</option>
                                            <option value="center">מרכז</option>
                                            <option value="bottom">למטה</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-slate-400 text-xs block mb-1">גודל טקסט</label>
                                        <select
                                            value={settings.textSize}
                                            onChange={(e) => setSettings(s => ({ ...s, textSize: e.target.value }))}
                                            className="w-full bg-white/10 border border-white/20 rounded-lg p-2 text-white text-sm"
                                        >
                                            <option value="small">קטן</option>
                                            <option value="medium">בינוני</option>
                                            <option value="large">גדול</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <label className="text-slate-400 text-xs">צבע טקסט</label>
                                    <input
                                        type="color"
                                        value={settings.textColor}
                                        onChange={(e) => setSettings(s => ({ ...s, textColor: e.target.value }))}
                                        className="w-8 h-8 rounded cursor-pointer"
                                    />
                                    <label className="text-slate-400 text-xs flex items-center gap-2 mr-auto">
                                        <input
                                            type="checkbox"
                                            checked={settings.addLogo}
                                            onChange={(e) => setSettings(s => ({ ...s, addLogo: e.target.checked }))}
                                            className="rounded"
                                        />
                                        הוסף לוגו
                                    </label>
                                </div>

                                {/* Denoise Slider - Only visible when seed image is uploaded */}
                                {seedImage && (
                                    <div className="pt-3 border-t border-white/10">
                                        <label className="text-slate-400 text-xs block mb-2">
                                            השפעת תמונת הרקע: {Math.round((1 - settings.denoise) * 100)}%
                                        </label>
                                        <input
                                            type="range"
                                            min="0.1"
                                            max="0.95"
                                            step="0.05"
                                            value={settings.denoise}
                                            onChange={(e) => setSettings(s => ({ ...s, denoise: parseFloat(e.target.value) }))}
                                            className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500"
                                        />
                                        <div className="flex justify-between text-slate-500 text-xs mt-1">
                                            <span>שמור על המקור</span>
                                            <span>יצירתי יותר</span>
                                        </div>
                                        <p className="text-slate-600 text-xs mt-2">
                                            ערך נמוך = התמונה תישאר דומה לרקע המקורי. ערך גבוה = יותר חופש יצירתי ל-AI
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Generate Button */}
                        <button
                            onClick={handleGenerate}
                            disabled={isProcessing || !prompt.trim()}
                            className={`w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all ${
                                isProcessing
                                    ? 'bg-purple-500/50 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 shadow-lg shadow-purple-500/30'
                            } text-white`}
                        >
                            {isProcessing ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    מייצר...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-5 h-5" />
                                    צור פרסומת
                                </>
                            )}
                        </button>

                        {/* Error Display */}
                        {error && (
                            <div className="mt-4 bg-red-500/20 border border-red-500/50 rounded-xl p-3 flex items-center gap-2 text-red-300">
                                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}
                    </div>

                    {/* Output Panel */}
                    <div className="bg-white/5 backdrop-blur-md rounded-3xl p-6 border border-white/10">
                        <h2 className="text-white font-bold text-xl mb-4 flex items-center gap-2">
                            <ImageIcon className="w-5 h-5 text-purple-400" />
                            תוצאה
                        </h2>

                        {/* Status Display */}
                        <div className={`flex items-center gap-3 mb-4 p-3 rounded-xl ${
                            stage.id === 'error' ? 'bg-red-500/20' : 'bg-white/5'
                        }`}>
                            <StageIcon className={`w-5 h-5 ${stage.color} ${isProcessing ? 'animate-pulse' : ''}`} />
                            <span className={`font-medium ${stage.color}`}>{stage.label}</span>
                        </div>

                        {/* Progress Bar */}
                        {isProcessing && (
                            <div className="mb-4">
                                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                                <p className="text-slate-500 text-xs mt-1 text-center">{progress}%</p>
                            </div>
                        )}

                        {/* Enriched Prompt Display */}
                        {enrichedPrompt && (
                            <div className="mb-4 p-3 bg-purple-500/10 border border-purple-500/30 rounded-xl">
                                <p className="text-purple-300 text-xs mb-1 flex items-center gap-1">
                                    <Languages className="w-3 h-3" />
                                    פרומפט מועשר (אנגלית):
                                </p>
                                <p className="text-slate-400 text-sm leading-relaxed" dir="ltr">
                                    {enrichedPrompt.slice(0, 200)}...
                                </p>
                            </div>
                        )}

                        {/* Image Preview */}
                        <div className="aspect-square bg-slate-800/50 rounded-2xl overflow-hidden flex items-center justify-center border-2 border-dashed border-white/10">
                            {generatedImage ? (
                                <img
                                    src={`data:image/png;base64,${generatedImage}`}
                                    alt="Generated Ad"
                                    className="w-full h-full object-contain"
                                />
                            ) : (
                                <div className="text-center p-8">
                                    <ImageIcon className="w-16 h-16 text-slate-600 mx-auto mb-3" />
                                    <p className="text-slate-500">התמונה תופיע כאן</p>
                                </div>
                            )}
                        </div>

                        {/* Action Buttons */}
                        {generatedImage && (
                            <div className="flex gap-3 mt-4">
                                <button
                                    onClick={handleDownload}
                                    className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-all"
                                >
                                    <Download className="w-4 h-4" />
                                    הורד תמונה
                                </button>
                                <button
                                    onClick={handleReset}
                                    className="py-3 px-4 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Quick Templates */}
                <div className="mt-8 bg-white/5 backdrop-blur-md rounded-3xl p-6 border border-white/10">
                    <h3 className="text-white font-bold mb-4">תבניות מהירות</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                            { label: 'מבצע יומי', prompt: 'מבצע היום - ' },
                            { label: 'מוצר חדש', prompt: 'חדש בתפריט! ' },
                            { label: 'Happy Hour', prompt: 'Happy Hour - ' },
                            { label: 'אירוע מיוחד', prompt: 'הזמנה לאירוע - ' }
                        ].map((template) => (
                            <button
                                key={template.label}
                                onClick={() => setPrompt(template.prompt)}
                                disabled={isProcessing}
                                className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-slate-300 text-sm transition-all"
                            >
                                {template.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdGenerator;
