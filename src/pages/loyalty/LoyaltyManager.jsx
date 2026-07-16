import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { getBackendApiUrl } from '@/utils/apiUtils';
import { 
  Sparkles, Coffee, Percent, Star, Heart, Flame, Gift, 
  Upload, Check, ArrowRight, Paintbrush, ShieldCheck, 
  Trash2, Send, Plus, Loader2, LogOut, CheckCircle, Info, Calendar
} from 'lucide-react';

const STAMP_ICONS = {
  'coffee-cup': Coffee,
  'star': Star,
  'heart': Heart,
  'flame': Flame,
  'gift': Gift
};

export default function LoyaltyManager() {
  const { currentUser, logout } = useAuth();
  const businessId = currentUser?.business_id;

  // Global UI State
  const [activeTab, setActiveTab] = useState('card'); // 'card' or 'promotions'
  const [loadingBiz, setLoadingBiz] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Business Card Editor State
  const [businessName, setBusinessName] = useState('');
  const [brandColor, setBrandColor] = useState('#1c1a19');
  const [logoUrl, setLogoUrl] = useState('');
  const [hasStamps, setHasStamps] = useState(true);
  const [stampLimit, setStampLimit] = useState(10);
  const [stampIcon, setStampIcon] = useState('coffee-cup');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [logoFile, setLogoFile] = useState(null);

  // Promotions State
  const [promotions, setPromotions] = useState([]);
  const [loadingPromos, setLoadingPromos] = useState(false);
  const [newPromoTitle, setNewPromoTitle] = useState('');
  const [newPromoDesc, setNewPromoDesc] = useState('');
  const [newPromoDiscount, setNewPromoDiscount] = useState('');
  const [newPromoValidTo, setNewPromoValidTo] = useState('');

  const logoInputRef = useRef(null);

  // Load business & promotions on mount
  useEffect(() => {
    if (businessId) {
      fetchBusinessData();
      fetchPromotions();
    }
  }, [businessId]);

  const fetchBusinessData = async () => {
    try {
      setLoadingBiz(true);
      const { data, error } = await supabase
        .from('businesses')
        .select('name, brand_color, logo_url, has_stamps, stamp_limit, stamp_icon')
        .eq('id', businessId)
        .single();

      if (error) throw error;
      if (data) {
        setBusinessName(data.name || '');
        setBrandColor(data.brand_color || '#1c1a19');
        setLogoUrl(data.logo_url || '');
        setHasStamps(data.has_stamps !== false);
        setStampLimit(data.stamp_limit || 10);
        setStampIcon(data.stamp_icon || 'coffee-cup');
      }
    } catch (err) {
      console.error('Error fetching business:', err);
      setErrorMsg('שגיאה בטעינת נתוני העסק');
    } finally {
      setLoadingBiz(false);
    }
  };

  const fetchPromotions = async () => {
    try {
      setLoadingPromos(true);
      const { data, error } = await supabase
        .from('marketplace_promotions')
        .select('*')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPromotions(data || []);
    } catch (err) {
      console.error('Error fetching promotions:', err);
    } finally {
      setLoadingPromos(false);
    }
  };

  // Handle Logo Upload
  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      setLogoUrl(URL.createObjectURL(file));
    }
  };

  const handleSaveCardSettings = async () => {
    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      let finalLogoUrl = logoUrl;

      // 1. Upload Logo if new file selected
      if (logoFile) {
        const fileExt = logoFile.name.split('.').pop();
        const fileName = `logos/${businessId}/${Date.now()}.${fileExt}`;
        const { error: uploadErr } = await supabase.storage
          .from('menu-images')
          .upload(fileName, logoFile);

        if (uploadErr) throw uploadErr;

        const { data: { publicUrl } } = supabase.storage
          .from('menu-images')
          .getPublicUrl(fileName);

        finalLogoUrl = publicUrl;
      }

      // 2. Fetch current settings JSON to preserve other attributes (status = approved!)
      const { data: currentBiz } = await supabase
        .from('businesses')
        .select('settings')
        .eq('id', businessId)
        .single();

      const updatedSettings = {
        ...(currentBiz?.settings || {}),
        logo_url: finalLogoUrl
      };

      // 3. Update top-level business settings
      const { error: updateErr } = await supabase
        .from('businesses')
        .update({
          name: businessName,
          brand_color: brandColor,
          logo_url: finalLogoUrl,
          has_stamps: hasStamps,
          stamp_limit: stampLimit,
          stamp_icon: stampIcon,
          settings: updatedSettings
        })
        .eq('id', businessId);

      if (updateErr) throw updateErr;

      setSuccessMsg('הגדרות כרטיס המועדון נשמרו בהצלחה! ✨');
      setLogoFile(null);
      setLogoUrl(finalLogoUrl);
    } catch (err) {
      console.error('Error saving settings:', err);
      setErrorMsg('שגיאה בשמירת הגדרות הכרטיס');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Add Promotion
  const handleAddPromotion = async (e) => {
    e.preventDefault();
    if (!newPromoTitle.trim() || !newPromoDesc.trim()) {
      setErrorMsg('נא להזין שם ותיאור למבצע');
      return;
    }

    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const { error } = await supabase
        .from('marketplace_promotions')
        .insert({
          business_id: businessId,
          title: newPromoTitle,
          description: newPromoDesc,
          discount_type: 'percent',
          discount_value: parseFloat(newPromoDiscount) || 0,
          valid_to: newPromoValidTo || null,
          is_active: true
        });

      if (error) throw error;

      setSuccessMsg('מבצע חדש נוסף בהצלחה! 🏷️');
      setNewPromoTitle('');
      setNewPromoDesc('');
      setNewPromoDiscount('');
      setNewPromoValidTo('');
      fetchPromotions();
    } catch (err) {
      console.error('Error adding promotion:', err);
      setErrorMsg('שגיאה בהוספת המבצע');
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle Promotion active status
  const handleTogglePromoStatus = async (promo) => {
    try {
      const { error } = await supabase
        .from('marketplace_promotions')
        .update({ is_active: !promo.is_active })
        .eq('id', promo.id);

      if (error) throw error;
      fetchPromotions();
    } catch (err) {
      console.error('Error toggling status:', err);
    }
  };

  // Delete Promotion
  const handleDeletePromo = async (promoId) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק מבצע זה?')) return;

    try {
      const { error } = await supabase
        .from('marketplace_promotions')
        .delete()
        .eq('id', promoId);

      if (error) throw error;
      setSuccessMsg('המבצע נמחק בהצלחה.');
      fetchPromotions();
    } catch (err) {
      console.error('Error deleting promotion:', err);
      setErrorMsg('שגיאה במחיקת המבצע');
    }
  };

  // Send Push Notification
  const handleSendPush = async (promo) => {
    if (!promo.is_active) {
      alert('לא ניתן לשלוח פוש עבור מבצע שאינו פעיל. נא להפעיל את המבצע תחילה.');
      return;
    }

    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const response = await fetch(`${getBackendApiUrl()}/api/promotions/send-regional`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          storeId: businessId,
          title: `${businessName}: ${promo.title}`,
          body: promo.description,
          data: {
            promotionId: promo.id,
            businessId: businessId
          }
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to dispatch push notifications');
      }

      if (result.devMode) {
        setSuccessMsg(`📢 [סימולציה] פוש ממותג נשלח ל-${result.sentCount || 0} לקוחות רשומים!`);
      } else {
        setSuccessMsg(`🔥 פוש ממותג נשלח בהצלחה ל-${result.sentCount || 0} מכשירים!`);
      }
    } catch (err) {
      console.error('Failed to send push:', err);
      setErrorMsg(`שגיאה בשליחת הודעת הפוש: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const SelectedStampIcon = STAMP_ICONS[stampIcon] || Coffee;

  if (loadingBiz) {
    return (
      <div className="min-h-screen bg-[#0f0e0d] text-stone-200 flex flex-col items-center justify-center font-sans" dir="rtl">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin mb-4" />
        <p className="text-sm text-stone-400">טוען פורטל מועדון לקוחות...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0e0d] text-stone-200 flex flex-col font-sans" dir="rtl">
      
      {/* Header bar */}
      <header className="w-full bg-[#161514] border-b border-stone-800/80 sticky top-0 z-50 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h1 className="text-lg font-black text-stone-100">{businessName || 'עריכת כרטיס מועדון'}</h1>
              <p className="text-[11px] text-stone-400">פורטל ניהול מועדון לקוחות לעסקים</p>
            </div>
          </div>
          <button 
            onClick={logout}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-stone-900 border border-stone-800/80 text-stone-400 hover:text-stone-200 transition text-xs font-bold"
          >
            <span>התנתק</span>
            <LogOut size={14} />
          </button>
        </div>
      </header>

      {/* Main body wrapper */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8 flex flex-col gap-6">
        
        {/* Messages */}
        {successMsg && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-2xl text-sm flex items-center gap-3">
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-2xl text-sm flex items-center gap-3">
            <Info className="w-5 h-5 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Tab Controls */}
        <div className="flex gap-2 p-1.5 bg-[#161514] border border-stone-800/80 rounded-2xl w-fit self-center md:self-start">
          <button 
            onClick={() => { setActiveTab('card'); setErrorMsg(''); setSuccessMsg(''); }}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'card' ? 'bg-amber-600 text-stone-950 shadow-md shadow-amber-600/10' : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Paintbrush className="w-4 h-4" />
            עיצוב כרטיס דיגיטלי
          </button>
          <button 
            onClick={() => { setActiveTab('promotions'); setErrorMsg(''); setSuccessMsg(''); }}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'promotions' ? 'bg-amber-600 text-stone-950 shadow-md shadow-amber-600/10' : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Percent className="w-4 h-4" />
            ניהול מבצעים והטבות
          </button>
        </div>

        {/* Dynamic content tab screens */}
        {activeTab === 'card' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left Col: Sticky Live Preview */}
            <div className="lg:col-span-5 flex flex-col gap-4 lg:sticky lg:top-[96px]">
              <h3 className="text-sm font-bold text-stone-400">תצוגה מקדימה (Apple Wallet)</h3>
              
              <div 
                style={{ backgroundColor: brandColor }}
                className="w-full aspect-[1.6/1] rounded-2xl p-5 shadow-xl relative overflow-hidden transition-all duration-500 border border-white/5 cursor-pointer hover:scale-[1.01]"
                onClick={() => setShowColorPicker(true)}
              >
                <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/10" />

                <div className="flex justify-between items-start relative z-10">
                  {/* Logo Spot */}
                  <div 
                    onClick={(e) => { e.stopPropagation(); logoInputRef.current?.click(); }}
                    className="w-12 h-12 rounded-xl bg-black/40 border border-white/10 flex items-center justify-center overflow-hidden transition hover:bg-black/60 relative group"
                  >
                    {logoUrl ? (
                      <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
                    ) : (
                      <Upload className="w-5 h-5 text-stone-400 group-hover:text-white" />
                    )}
                    <div className="absolute inset-0 bg-black/55 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-[8px] text-white font-bold">לוגו</span>
                    </div>
                  </div>

                  {/* Title / Brand */}
                  <div className="text-left">
                    <span className="text-[10px] text-white/50 font-bold uppercase tracking-wider block">MEMBER CARD</span>
                    <span className="text-sm font-black text-white">{businessName || 'שם העסק שלך'}</span>
                  </div>
                </div>

                {/* Inner Content */}
                <div className="mt-6 flex justify-between items-end relative z-10">
                  {hasStamps ? (
                    <div>
                      <span className="text-[10px] text-white/60 block mb-1">סטטוס כרטיסייה</span>
                      <div className="flex items-center gap-1.5">
                        {Array.from({ length: Math.min(5, stampLimit) }).map((_, i) => (
                          <div key={i} className="w-7 h-7 rounded-full bg-black/35 border border-white/10 flex items-center justify-center text-white/80">
                            {i < 3 ? <SelectedStampIcon className="w-4 h-4 text-amber-400 fill-amber-400/20" /> : <span className="text-[10px] text-white/30">{i+1}</span>}
                          </div>
                        ))}
                        {stampLimit > 5 && <span className="text-xs text-white/60 mr-1">+{stampLimit - 5}</span>}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-black/25 border border-white/10 px-4 py-2 rounded-xl backdrop-blur-sm">
                      <span className="text-[10px] text-white/50 block">הטבה קבועה</span>
                      <span className="text-sm font-black text-amber-400">10% הנחה לחברי מועדון 🏷️</span>
                    </div>
                  )}

                  <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center">
                    <span className="text-xs">📱</span>
                  </div>
                </div>
              </div>
              
              <span className="text-[10px] text-stone-500 font-mono text-center">הערה: השינויים יוצגו מיידית בנייד של הלקוח לאחר שמירה</span>
            </div>

            {/* Right Col: Editor Panel */}
            <div className="lg:col-span-7 bg-[#161514] border border-stone-800/80 rounded-3xl p-6 flex flex-col gap-6">
              
              <div>
                <h3 className="text-base font-black text-stone-100">הגדרות ומיתוג מועדון</h3>
                <p className="text-xs text-stone-400 leading-relaxed">התאם את מראה כרטיס המועדון, הלוגו וחוקי צבירת הנקודות של העסק.</p>
              </div>

              {/* Form inputs */}
              <div className="flex flex-col gap-5">
                
                {/* Business Name */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-stone-400">שם העסק המוצג בכרטיס</label>
                  <input 
                    type="text" 
                    value={businessName} 
                    onChange={(e) => setBusinessName(e.target.value)} 
                    placeholder="שם העסק שלך" 
                    className="w-full px-4 py-3 rounded-xl bg-stone-900 border border-stone-850 text-sm focus:border-amber-500 outline-none transition text-stone-200"
                  />
                </div>

                {/* Brand Color selection */}
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-stone-400">צבע מותג ראשי</label>
                    <button 
                      onClick={() => setShowColorPicker(!showColorPicker)} 
                      className="text-xs text-amber-500 font-bold"
                    >
                      {showColorPicker ? 'סגור בוחר צבע' : 'החלף צבע חופשי'}
                    </button>
                  </div>
                  
                  <div className="flex gap-2.5 justify-start flex-wrap">
                    {['#1c1a19', '#15803d', '#1d4ed8', '#b91c1c', '#6d28d9', '#c2410c'].map((color) => (
                      <button 
                        key={color}
                        style={{ backgroundColor: color }}
                        onClick={() => { setBrandColor(color); setShowColorPicker(false); }}
                        className={`w-9 h-9 rounded-full border-2 ${brandColor === color ? 'border-stone-100 scale-105' : 'border-transparent hover:scale-105'} transition-all`}
                      />
                    ))}
                  </div>

                  {showColorPicker && (
                    <div className="p-3 bg-stone-900 rounded-xl border border-stone-800 flex flex-col gap-2 w-full mt-1">
                      <input 
                        type="color" 
                        value={brandColor} 
                        onChange={(e) => setBrandColor(e.target.value)} 
                        className="w-full h-10 rounded-lg bg-transparent cursor-pointer border border-stone-800"
                      />
                      <span className="text-[10px] text-stone-400 font-mono text-center">{brandColor}</span>
                    </div>
                  )}
                </div>

                {/* File input for logo */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-stone-400">לוגו מועדון</label>
                  <input 
                    type="file" 
                    ref={logoInputRef} 
                    onChange={handleLogoChange} 
                    accept="image/*" 
                    className="hidden" 
                  />
                  <div 
                    onClick={() => logoInputRef.current?.click()}
                    className="w-full py-4 border-2 border-dashed border-stone-800 hover:border-amber-500/40 rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer transition bg-stone-900/50"
                  >
                    <Upload className="w-5 h-5 text-stone-500" />
                    <span className="text-xs text-stone-400">{logoFile ? `קובץ שנבחר: ${logoFile.name}` : 'העלה לוגו חדש (ריבוע מומלץ)'}</span>
                  </div>
                </div>

                {/* Card Type toggle */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-stone-400 font-sans">סוג מועדון לקוחות</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => setHasStamps(true)}
                      className={`p-3.5 rounded-xl border flex flex-col items-center gap-1.5 transition ${
                        hasStamps ? 'bg-amber-500/10 border-amber-500 text-amber-400' : 'bg-stone-900 border-stone-800/80 text-stone-400'
                      }`}
                    >
                      <Coffee className="w-5 h-5" />
                      <span className="text-xs font-bold">כרטיסיית ניקובים</span>
                    </button>
                    <button 
                      onClick={() => setHasStamps(false)}
                      className={`p-3.5 rounded-xl border flex flex-col items-center gap-1.5 transition ${
                        !hasStamps ? 'bg-amber-500/10 border-amber-500 text-amber-400' : 'bg-stone-900 border-stone-800/80 text-stone-400'
                      }`}
                    >
                      <Percent className="w-5 h-5" />
                      <span className="text-xs font-bold">כרטיס הטבות/הנחה</span>
                    </button>
                  </div>
                </div>

                {/* Conditional Stamps settings */}
                {hasStamps && (
                  <div className="flex flex-col gap-4 p-4 rounded-2xl bg-stone-900/60 border border-stone-850 mt-1">
                    
                    {/* Stamp Limit */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-stone-400">כמות ניקובים לכרטיסייה שלמה</label>
                      <div className="flex gap-2">
                        {[8, 10, 12].map((limit) => (
                          <button 
                            key={limit}
                            onClick={() => setStampLimit(limit)}
                            className={`flex-1 py-2 rounded-xl border text-xs font-bold transition ${
                              stampLimit === limit ? 'bg-stone-950 border-amber-500 text-amber-450' : 'bg-stone-900 border-stone-800/80 text-stone-400'
                            }`}
                          >
                            {limit} ניקובים
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Stamp Icons */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-stone-400">סמל הניקוב</label>
                      <div className="flex gap-2 justify-between">
                        {Object.entries(STAMP_ICONS).map(([key, IconComponent]) => (
                          <button 
                            key={key}
                            onClick={() => setStampIcon(key)}
                            className={`p-3.5 rounded-xl border transition ${
                              stampIcon === key ? 'bg-stone-950 border-amber-500 text-amber-400' : 'bg-stone-900 border-stone-850 text-stone-400'
                            }`}
                          >
                            <IconComponent className="w-5 h-5" />
                          </button>
                        ))}
                      </div>
                    </div>

                  </div>
                )}

              </div>

              {/* Save Button */}
              <button 
                onClick={handleSaveCardSettings}
                disabled={actionLoading}
                className="w-full mt-4 py-3.5 rounded-2xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold transition duration-300 shadow-lg shadow-amber-600/10 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {actionLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    שמור הגדרות מועדון
                  </>
                )}
              </button>

            </div>

          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left Col: Add New Promotion Form */}
            <div className="lg:col-span-5 bg-[#161514] border border-stone-800/80 rounded-3xl p-6 flex flex-col gap-5">
              <div>
                <h3 className="text-sm font-black text-stone-100 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-amber-500" />
                  הוספת מבצע/הטבה חדשה
                </h3>
                <p className="text-[11px] text-stone-400">המבצעים יוצגו ללקוחות באפליקציה.</p>
              </div>

              <form onSubmit={handleAddPromotion} className="flex flex-col gap-4">
                
                {/* Title */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-stone-400">כותרת המבצע/הטבה</label>
                  <input 
                    type="text" 
                    value={newPromoTitle} 
                    onChange={(e) => setNewPromoTitle(e.target.value)} 
                    placeholder="לדוגמה: 1+1 על המאפים, קפה שני בחצי מחיר" 
                    className="w-full px-4 py-3 rounded-xl bg-stone-900 border border-stone-850 text-xs focus:border-amber-500 outline-none transition text-stone-200"
                  />
                </div>

                {/* Description */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-stone-400">תיאור מפורט</label>
                  <textarea 
                    value={newPromoDesc} 
                    onChange={(e) => setNewPromoDesc(e.target.value)} 
                    placeholder="לדוגמה: לחברי מועדון בלבד, בהצגת הכרטיס הדיגיטלי במעמד התשלום..." 
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl bg-stone-900 border border-stone-850 text-xs focus:border-amber-500 outline-none transition text-stone-200 resize-none"
                  />
                </div>

                {/* Expiration Date & Discount Value */}
                <div className="grid grid-cols-2 gap-3">
                  
                  {/* Discount */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-stone-400">אחוז הנחה (אופציונלי)</label>
                    <input 
                      type="number" 
                      value={newPromoDiscount} 
                      onChange={(e) => setNewPromoDiscount(e.target.value)} 
                      placeholder="לדוגמה: 15" 
                      className="w-full px-4 py-3 rounded-xl bg-stone-900 border border-stone-850 text-xs focus:border-amber-500 outline-none transition text-stone-200"
                    />
                  </div>

                  {/* Validity Date */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-stone-400">בתוקף עד (אופציונלי)</label>
                    <div className="relative">
                      <input 
                        type="date" 
                        value={newPromoValidTo} 
                        onChange={(e) => setNewPromoValidTo(e.target.value)} 
                        className="w-full px-4 py-3 rounded-xl bg-stone-900 border border-stone-850 text-xs focus:border-amber-500 outline-none transition text-stone-200"
                      />
                    </div>
                  </div>

                </div>

                {/* Submit button */}
                <button 
                  type="submit"
                  disabled={actionLoading}
                  className="w-full py-3.5 rounded-2xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold transition duration-300 shadow-lg shadow-amber-600/10 flex items-center justify-center gap-2 disabled:opacity-50 text-xs mt-2"
                >
                  {actionLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      צור ופרסם מבצע
                    </>
                  )}
                </button>

              </form>

            </div>

            {/* Right Col: Active Promotions list */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              <h3 className="text-sm font-bold text-stone-400">מבצעים פעילים כרגע</h3>
              
              {loadingPromos ? (
                <div className="p-8 text-center text-stone-500 flex flex-col items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-stone-600 mb-2" />
                  <span className="text-xs">טוען רשימת מבצעים...</span>
                </div>
              ) : promotions.length === 0 ? (
                <div className="bg-[#161514] border border-stone-800/80 rounded-3xl p-8 text-center flex flex-col items-center justify-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-stone-900 border border-stone-850 flex items-center justify-center text-stone-500">
                    <Info className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-stone-300">אין מבצעים מוגדרים</h4>
                    <p className="text-xs text-stone-500">הוסף את המבצע הראשון שלך בטופס הצידי.</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {promotions.map((promo) => (
                    <div 
                      key={promo.id}
                      className={`bg-[#161514] border rounded-2xl p-5 flex flex-col gap-4 transition-all duration-300 ${
                        promo.is_active ? 'border-stone-800/80' : 'border-stone-850 opacity-60'
                      }`}
                    >
                      {/* Top Row: Promo Info */}
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <h4 className="text-sm font-black text-stone-150 truncate">{promo.title}</h4>
                            
                            {/* Status badge */}
                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                              promo.is_active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-stone-800 text-stone-500 border border-stone-850'
                            }`}>
                              {promo.is_active ? 'פעיל' : 'לא פעיל'}
                            </span>

                            {promo.discount_value > 0 && (
                              <span className="text-[9px] px-2 py-0.5 rounded-full font-bold bg-amber-500/10 text-amber-450 border border-amber-500/20">
                                {promo.discount_value}% הנחה
                              </span>
                            )}
                          </div>
                          
                          <p className="text-xs text-stone-400 leading-relaxed font-sans">{promo.description}</p>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1.5">
                          {/* Toggle active switch */}
                          <button 
                            onClick={() => handleTogglePromoStatus(promo)}
                            title={promo.is_active ? 'השבת מבצע' : 'הפעל מבצע'}
                            className={`p-2 rounded-xl border transition ${
                              promo.is_active ? 'bg-emerald-550/15 border-emerald-500/30 text-emerald-400 hover:bg-emerald-550/20' : 'bg-stone-900 border-stone-800 text-stone-500 hover:text-stone-300'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          
                          {/* Delete promotion */}
                          <button 
                            onClick={() => handleDeletePromo(promo.id)}
                            title="מחק מבצע"
                            className="p-2 rounded-xl bg-stone-900 border border-stone-800 text-stone-550 hover:text-red-400 hover:border-red-500/20 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Expiration date */}
                      {promo.valid_to && (
                        <div className="flex items-center gap-1.5 text-[10px] text-stone-500 font-mono">
                          <Calendar size={12} />
                          <span>בתוקף עד: {new Date(promo.valid_to).toLocaleDateString('he-IL')}</span>
                        </div>
                      )}

                      {/* Send Push Button - Only for active promotions */}
                      {promo.is_active && (
                        <div className="border-t border-stone-850/80 pt-3.5 flex justify-end">
                          <button 
                            onClick={() => handleSendPush(promo)}
                            disabled={actionLoading}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600/15 border border-amber-500/20 hover:bg-amber-650/25 text-amber-450 hover:text-amber-400 transition text-xs font-bold disabled:opacity-50"
                          >
                            <Send className="w-3 h-3" />
                            שלח פוש שיווקי ללקוחות
                          </button>
                        </div>
                      )}

                    </div>
                  ))}
                </div>
              )}

            </div>

          </div>
        )}

      </main>

    </div>
  );
}
