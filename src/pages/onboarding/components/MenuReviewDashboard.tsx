import { useState, useEffect, useMemo } from 'react';
import {
    Plus, Settings, Trash2, RefreshCw, Wand2, Check, Coffee,
    Package, Clock, Globe, AlertCircle, Flame, ShoppingBag, HelpCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useOnboardingStore } from '@/pages/onboarding/store/useOnboardingStore';
import { useAuth } from '@/context/AuthContext';
import { OnboardingItem } from '@/pages/onboarding/types/onboardingTypes';
import { normalizeCategory } from '@/pages/onboarding/logic/onboardingLogic';

// Components
import HumorousLoader from '@/pages/onboarding/components/menu-editor/shared/HumorousLoader';
import CategoryDesignModal from '@/pages/onboarding/components/menu-editor/editor/CategoryDesignModal';
import MenuItemEditModal from '@/pages/onboarding/components/menu-editor/editor/MenuItemEditModal';
// ManagerAuthModal removed - PIN is checked in HierarchicalDashboard before navigation
import UnifiedHeader from '@/components/UnifiedHeader';

const MenuReviewDashboard = () => {
    const { currentUser } = useAuth();
    const {
        items,
        addNewItem, geminiApiKey, setGeminiApiKey,
        error, setError, updateItem, initSession, sessionId, isLoading
    } = useOnboardingStore();
    const navigate = useNavigate();

    const [selectedCategory, setSelectedCategory] = useState<string>('');
    const [editItem, setEditItem] = useState<OnboardingItem | null>(null);
    const [editCategory, setEditCategory] = useState<string | null>(null);
    const [showApiSettings, setShowApiSettings] = useState(false);
    const [tempApiKey, setTempApiKey] = useState(geminiApiKey || '');

    // 🔒 Entry Protection - REMOVED DUPLICATE PIN CHECK
    // PIN is already checked in HierarchicalDashboard before navigation
    // Users reaching this page have already been authorized
    const isAuthorized = true;

    // Initialize Session
    useEffect(() => {
        if (currentUser?.business_id && !sessionId) {
            (useOnboardingStore.getState() as any).exposeDebug?.();
            initSession(currentUser.business_id);
        }
    }, [currentUser, sessionId, initSession]);

    // Handle Errors
    useEffect(() => {
        if (error === 'MISSING_API_KEY' || error === 'GEMINI_KEY_INVALID' || error === 'GEMINI_KEY_LEAKED') {
            setShowApiSettings(true);
        }
    }, [error]);

    const categories = useMemo(() => {
        const normalizedCats = items.map(i => normalizeCategory(i.category || 'Uncategorized'));
        const cats = new Set(normalizedCats);
        cats.delete('All');
        return Array.from(cats).sort();
    }, [items]);

    // 🆕 Auto-select first category when loaded
    useEffect(() => {
        if (!selectedCategory && categories.length > 0) {
            setSelectedCategory(categories[0]);
        }
    }, [categories, selectedCategory]);

    const filteredItems = useMemo(() => {
        if (selectedCategory === 'Pending') return items.filter(i => i.status === 'pending');
        if (!selectedCategory || selectedCategory === 'All') return items;
        return items.filter(i => normalizeCategory(i.category) === selectedCategory);
    }, [items, selectedCategory]);

    const stats = useMemo(() => {
        const errors = items.filter(i => (i.validationErrors?.length || 0) > 0).length;
        const pending = items.filter(i => i.status === 'pending' || i.status === 'preparing' || i.status === 'generating').length;
        return { errors, pending, total: items.length };
    }, [items]);

    const handleQuickApprove = async (e: React.MouseEvent, item: OnboardingItem) => {
        e.stopPropagation();
        await updateItem(item.id, { status: 'completed' });
    };

    const handleAddItem = (category?: string) => {
        const targetCategory = category || (selectedCategory !== 'Pending' ? selectedCategory : 'General');
        const newItem = addNewItem(targetCategory);
        if (newItem) setEditItem(newItem);
    };

    const handleDeleteClick = async (e: React.MouseEvent, item: OnboardingItem) => {
        e.stopPropagation();
        if (confirm(`האם אתה בטוח שברצונך למחוק את ${item.name}?`)) {
            await useOnboardingStore.getState().deleteItem(item.id);
        }
    };


    if (isLoading) {
        return (
            <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-50 gap-8 px-6 transition-all duration-500" dir="rtl">
                <div className="relative w-32 h-32 md:w-40 md:h-40">
                    {/* Outer ripples */}
                    <div className="absolute inset-0 bg-orange-500/10 rounded-full animate-[ping_3s_infinite]" />
                    <div className="absolute inset-4 bg-orange-500/20 rounded-full animate-[ping_2s_infinite]" />

                    {/* Main loader core */}
                    <div className="absolute inset-8 rounded-full border-2 bg-white border-orange-200 shadow-xl flex items-center justify-center overflow-hidden">
                        <div className="relative z-10">
                            <Coffee size={32} className="text-orange-500 animate-pulse" />
                        </div>
                        {/* Progress sweep overlay */}
                        <div className="absolute inset-0 border-t-2 border-orange-500 animate-spin duration-[2000ms]" />
                    </div>
                </div>

                <div className="text-center space-y-3 max-w-xs scale-90 md:scale-100">
                    <h2 className="text-2xl md:text-3xl font-black tracking-tighter uppercase text-slate-900">
                        טוענים את התפריט...
                    </h2>
                    <div className="flex items-center justify-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-bounce [animation-delay:-0.3s]" />
                        <div className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-bounce [animation-delay:-0.15s]" />
                        <div className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-bounce" />
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">
                        iCaffeOS Cloud Sync v7.0
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full min-h-screen gap-0 font-sans select-none bg-slate-50/50" dir="rtl">
            {/* Header */}
            {/* UnifiedHeader Header */}
            <UnifiedHeader
                onHome={() => navigate('/mode-selection')}
            >
                <div className="flex items-center gap-2">
                    <button onClick={() => setShowApiSettings(true)} className={`w-10 h-10 flex items-center justify-center rounded-xl border transition-all ${geminiApiKey ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-amber-50 border-amber-100 text-amber-600'}`} title="הגדרות AI">
                        <Settings size={18} />
                    </button>
                    <button
                        onClick={async () => {
                            if (confirm('האם לרענן את כל הנתונים מהענן? (זה ינקה כפילים מקומיים)')) {
                                if (currentUser?.business_id) {
                                    await initSession(currentUser.business_id);
                                }
                            }
                        }}
                        className="w-10 h-10 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition-all"
                        title="רענן נתונים"
                    >
                        <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
                    </button>
                    <button onClick={() => handleAddItem()} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-md transition-all">
                        <Plus size={18} /> הוסף מוצר
                    </button>
                </div>
            </UnifiedHeader>

            {/* Categories */}
            <div className="px-6 py-3 bg-white border-b border-slate-200 flex items-center gap-2 overflow-x-auto no-scrollbar shadow-inner sticky top-[73px] z-40">
                <button
                    onClick={() => {
                        const newCat = prompt("שם הקטגוריה החדשה:");
                        if (newCat) handleAddItem(newCat);
                    }}
                    className="px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest whitespace-nowrap transition-all border bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200"
                >
                    + קטגוריה חדשה
                </button>

                <div className="w-[1px] h-6 bg-slate-200 mx-2" />

                {categories.map(cat => (
                    <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-5 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest whitespace-nowrap transition-all border
                            ${selectedCategory === cat ? 'bg-slate-900 border-slate-900 text-white shadow-md' : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'}`}
                    >
                        {cat}
                        <span className={`mr-2 opacity-40 text-[9px] ${selectedCategory === cat ? 'text-white' : ''}`}>{items.filter(i => i.category === cat).length}</span>
                    </button>
                ))}

                <div className="flex-1" />

                {(selectedCategory !== 'All' && selectedCategory !== 'Pending') && (
                    <button
                        onClick={() => setEditCategory(selectedCategory)}
                        className="ml-2 px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest whitespace-nowrap transition-all border border-indigo-200 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 flex items-center gap-2 font-sans"
                    >
                        <Settings size={12} />
                        הגדרות עיצוב לקטגוריה
                    </button>
                )}

                <button
                    onClick={() => setSelectedCategory('Pending')}
                    className={`px-5 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest whitespace-nowrap transition-all border flex items-center gap-2
                        ${selectedCategory === 'Pending' ? 'bg-amber-500 border-amber-500 text-white shadow-md' : 'bg-amber-50 border-amber-100 text-amber-600 hover:bg-amber-100'}`}
                >
                    <Clock size={12} />
                    ממתינים לאישור
                    <span className={`opacity-60 text-[9px] ${selectedCategory === 'Pending' ? 'text-white' : ''}`}>{stats.pending}</span>
                </button>
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar scroll-smooth">
                {items.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4">
                        <Package size={40} className="text-slate-300" />
                        <h3 className="text-xl font-bold text-slate-700">התפריט שלך ריק כרגע</h3>
                        <button onClick={() => handleAddItem()} className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm shadow-lg hover:bg-indigo-700 transition-all mt-4">
                            התחל להוסיף מוצרים
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-6 pb-40">
                        {filteredItems.map((item: OnboardingItem) => (
                            <div
                                key={item.id}
                                onClick={() => setEditItem(item)}
                                className="group bg-white rounded-xl border border-slate-200 overflow-hidden cursor-pointer hover:shadow-xl transition-all flex flex-col h-full relative"
                            >
                                <div className="relative aspect-[4/3] bg-slate-50 border-b border-slate-100 overflow-hidden flex items-center justify-center">
                                    {item.imageUrl ? (
                                        <img src={item.imageUrl} className="w-full h-full object-cover transition-all duration-700 group-hover:scale-105" />
                                    ) : (
                                        <div className="flex flex-col items-center justify-center text-slate-400 gap-2">
                                            <Wand2 size={20} />
                                            <span className="text-[9px] font-black uppercase tracking-widest">{item.status === 'image_skipped' ? 'No Image' : 'AI Ready'}</span>
                                        </div>
                                    )}

                                    {(item.status === 'generating' || item.status === 'preparing') && <HumorousLoader variant="mini" />}

                                    <div className="absolute top-2 right-2 flex flex-row-reverse gap-1 z-10 items-center">
                                        {item.isVisiblePos !== false && <span className="h-5 px-1.5 bg-white border border-slate-200 rounded text-[9px] font-black flex items-center">POS</span>}
                                        {item.isVisibleOnline !== false && <span className="h-5 px-1.5 bg-white border border-slate-200 rounded text-indigo-600 flex items-center"><Globe size={11} /></span>}
                                    </div>

                                    {/* KDS Mode Badge */}
                                    <div className="absolute bottom-2 right-2 z-10">
                                        {item.preparationMode === 'requires_prep' && (
                                            <div className="bg-orange-500/90 text-white p-1.5 rounded-lg shadow-sm backdrop-blur-sm" title="דורש הכנה">
                                                <Flame size={12} strokeWidth={3} />
                                            </div>
                                        )}
                                        {item.preparationMode === 'ready' && (
                                            <div className="bg-emerald-500/90 text-white p-1.5 rounded-lg shadow-sm backdrop-blur-sm" title="מוכן להגשה (Grab & Go)">
                                                <ShoppingBag size={12} strokeWidth={3} />
                                            </div>
                                        )}
                                        {item.preparationMode === 'cashier_choice' && (
                                            <div className="bg-purple-500/90 text-white p-1.5 rounded-lg shadow-sm backdrop-blur-sm" title="מותנה (לפי בחירת קופאי)">
                                                <HelpCircle size={12} strokeWidth={3} />
                                            </div>
                                        )}
                                    </div>

                                    <div className="absolute top-2 left-2 flex gap-1 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {item.status !== 'completed' && (
                                            <button
                                                onClick={(e) => handleQuickApprove(e, item)}
                                                className="p-1.5 bg-white shadow-sm text-emerald-500 hover:bg-emerald-50 rounded-lg"
                                                title="אישור מהיר"
                                            >
                                                <Check size={14} />
                                            </button>
                                        )}
                                        <button
                                            onClick={(e) => handleDeleteClick(e, item)}
                                            className="p-1.5 bg-white shadow-sm text-slate-400 hover:text-red-500 rounded-lg"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>

                                <div className="p-4 flex flex-col gap-2 flex-1">
                                    <h4 className="text-[13px] font-bold text-slate-900 truncate">{item.name}</h4>
                                    <div className="flex flex-wrap gap-1 mt-auto">
                                        <span className="px-2 py-0.5 rounded-md text-[8px] font-bold bg-indigo-50 text-indigo-500">
                                            {item.category}
                                        </span>
                                        <span className="px-2 py-0.5 rounded-md text-[8px] font-bold bg-emerald-50 text-emerald-600">
                                            ₪{item.price}
                                        </span>
                                        {(item.modifiers?.length || 0) > 0 && (
                                            <span className="px-2 py-0.5 rounded-md text-[8px] font-bold bg-orange-50 text-orange-600 flex items-center gap-1">
                                                <Plus size={8} /> {item.modifiers?.length} תוספות
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Footer Queue - DISABLED: Use 'regenerateSingleItem' per item instead */}
            {/* stats.pending > 0 batch generation button removed in v7 */}

            {/* Modals */}
            {editItem && <MenuItemEditModal item={editItem} onClose={() => setEditItem(null)} />}
            {editCategory && <CategoryDesignModal category={editCategory} onClose={() => setEditCategory(null)} />}

            {showApiSettings && (
                <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl space-y-8 animate-in zoom-in-95 duration-300 relative overflow-hidden">
                        {/* Error Context Banner */}
                        {(error === 'GEMINI_KEY_LEAKED' || error === 'GEMINI_KEY_INVALID') && (
                            <div className="absolute top-0 left-0 right-0 p-4 bg-rose-500 text-white flex items-center justify-center gap-3 animate-in slide-in-from-top-full duration-500">
                                <AlertCircle size={20} className="animate-bounce" />
                                <span className="font-black text-xs uppercase tracking-wider">
                                    {error === 'GEMINI_KEY_LEAKED' ? 'אבטחה: המפתח שלך נחסם!' : 'שגיאה: המפתח אינו תקין'}
                                </span>
                            </div>
                        )}

                        <div className="pt-6 space-y-4">
                            <h3 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                                <Settings className="text-indigo-600" />
                                הגדרות בינה מלאכותית
                            </h3>

                            {error === 'GEMINI_KEY_LEAKED' ? (
                                <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl space-y-3">
                                    <p className="text-sm font-bold text-rose-700 leading-relaxed">
                                        גוגל זיהתה שהמפתח שלך נחשף באינטרנט וחסמה אותו מטעמי אבטחה.
                                    </p>
                                    <div className="space-y-2">
                                        <p className="text-[11px] text-rose-600 font-medium italic">מה צריך לעשות?</p>
                                        <ol className="text-[11px] text-rose-600 list-decimal mr-4 space-y-1">
                                            <li>לחץ על הקישור למטה כדי להיכנס ל-Google AI Studio.</li>
                                            <li>צור מפתח חדש (Create API Key).</li>
                                            <li>הדבק את המפתח החדש בתיבת הטקסט למטה.</li>
                                        </ol>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm text-slate-500 font-medium leading-relaxed">
                                    כדי שנוכל לייצר תמונות ותיאורים למנות שלך, אנחנו צריכים מפתח גישה (API Key) של Gemini.
                                </p>
                            )}
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">מפתח Gemini API</label>
                                <input
                                    type="password"
                                    value={tempApiKey}
                                    onChange={(e) => setTempApiKey(e.target.value)}
                                    placeholder="AIzaSy..."
                                    className={`w-full p-4 bg-slate-50 border rounded-2xl text-sm font-mono transition-all outline-none focus:ring-4 focus:ring-indigo-100 ${error ? 'border-rose-200' : 'border-slate-200 focus:border-indigo-400'}`}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">סגנון העסק</label>
                                <select
                                    value={useOnboardingStore.getState().businessContext || 'Coffee Shop / Restaurant'}
                                    onChange={(e) => useOnboardingStore.getState().setBusinessContext(e.target.value)}
                                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:border-indigo-400"
                                >
                                    <option value="Coffee Shop / Restaurant">מסעדה / בית קפה</option>
                                    <option value="Plant Nursery (משתלה)">משתלה / חנות פרחים</option>
                                    <option value="Bar / Nightlife">בר / חיי לילה</option>
                                    <option value="Bakery">מאפייה / קונדיטוריה</option>
                                </select>
                            </div>
                        </div>

                        <div className="p-4 bg-indigo-50/50 rounded-2xl flex items-center justify-between gap-4">
                            <span className="text-[11px] font-bold text-indigo-600">אין לך מפתח?</span>
                            <a
                                href="https://aistudio.google.com/app/apikey"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-4 py-2 bg-indigo-600 text-white text-[10px] font-black uppercase rounded-lg shadow-sm hover:bg-indigo-700 transition-all flex items-center gap-2"
                            >
                                <Globe size={12} /> הוצא מפתח בחינם (Google)
                            </a>
                        </div>

                        <div className="flex gap-4 pt-4 border-t border-slate-100">
                            <button
                                onClick={() => { setShowApiSettings(false); setError(null); }}
                                className="flex-1 py-4 text-slate-400 font-black text-[11px] uppercase tracking-wider hover:bg-slate-50 rounded-xl transition-all"
                            >
                                ביטול
                            </button>
                            <button
                                onClick={() => {
                                    setGeminiApiKey(tempApiKey);
                                    setShowApiSettings(false);
                                    setError(null);
                                }}
                                className="flex-[2] py-4 bg-slate-900 text-white font-black text-[11px] uppercase tracking-wider rounded-xl shadow-xl hover:bg-black active:scale-95 transition-all"
                            >
                                עדכן ושמור הגדרות
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MenuReviewDashboard;
