import React, { useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { getBackendApiUrl } from '@/utils/apiUtils';
import { 
  Sparkles, Coffee, Percent, Star, Heart, Flame, Gift, 
  Upload, Check, ArrowRight, ArrowLeft, Paintbrush, ShieldCheck 
} from 'lucide-react';

const STAMP_ICONS = {
  'coffee-cup': Coffee,
  'star': Star,
  'heart': Heart,
  'flame': Flame,
  'gift': Gift
};

export default function OnboardingWizard() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const businessId = searchParams.get('business_id');

  // Form State
  const [step, setStep] = useState(1);
  const [businessName, setBusinessName] = useState('');
  const [brandColor, setBrandColor] = useState('#1c1a19'); // Cafe brown
  const [logoFile, setLogoFile] = useState(null);
  const [logoUrl, setLogoUrl] = useState('');
  const [hasStamps, setHasStamps] = useState(true);
  const [stampLimit, setStampLimit] = useState(10);
  const [stampIcon, setStampIcon] = useState('coffee-cup');
  
  // Promo State
  const [promoTitle, setPromoTitle] = useState('');
  const [promoDesc, setPromoDesc] = useState('');
  const [promoDiscount, setPromoDiscount] = useState('');

  // UI States
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showColorPicker, setShowColorPicker] = useState(false);

  // File Inputs
  const logoInputRef = useRef(null);

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      setLogoUrl(URL.createObjectURL(file));
    }
  };

  const handleLogoClick = (e) => {
    e.stopPropagation();
    logoInputRef.current?.click();
  };

  const handleCardClick = (e) => {
    // If clicked the card background but not the logo
    setShowColorPicker(true);
  };

  const handleSave = async () => {
    if (!businessId) {
      setErrorMsg('מזהה עסק חסר. אנא הרשם מחדש.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      let finalLogoUrl = '';

      // 1. Upload Logo if exists
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

      // 2. Save Business Config & Status -> pending_admin_approval
      const { error: bizErr } = await supabase
        .from('businesses')
        .update({
          name: businessName || 'עסק חדש',
          brand_color: brandColor,
          logo_url: finalLogoUrl,
          has_stamps: hasStamps,
          stamp_limit: stampLimit,
          stamp_icon: stampIcon,
          settings: {
            status: 'pending_admin_approval',
            logo_url: finalLogoUrl
          }
        })
        .eq('id', businessId);

      if (bizErr) throw bizErr;

      // 3. Save initial promotion if title exists
      if (promoTitle) {
        const { error: promoErr } = await supabase
          .from('marketplace_promotions')
          .insert({
            business_id: businessId,
            title: promoTitle,
            description: promoDesc,
            discount_type: 'percent',
            discount_value: parseFloat(promoDiscount) || 0,
            is_active: true
          });

        if (promoErr) throw promoErr;
      }

      // 4. Onboarding complete -> Redirect to pending lockout screen
      navigate(`/verification-pending?business_id=${businessId}`);
    } catch (err) {
      console.error('Failed to complete onboarding:', err);
      setErrorMsg('שגיאה בשמירת הנתונים. אנא נסה שוב.');
    } finally {
      setLoading(false);
    }
  };

  const SelectedStampIcon = STAMP_ICONS[stampIcon] || Coffee;

  return (
    <div className="min-h-screen bg-[#121110] text-[#f4f1ed] flex flex-col font-sans" dir="rtl">
      
      {/* Step Progress Bar */}
      <div className="w-full bg-stone-900/80 border-b border-stone-800/60 sticky top-0 z-50 backdrop-blur-md">
        <div className="max-w-md mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-sm font-bold text-amber-500">הגדרת מועדון לקוחות</h1>
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4].map((s) => (
              <span 
                key={s} 
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  s === step ? 'w-6 bg-amber-500' : s < step ? 'w-2 bg-amber-500/40' : 'w-2 bg-stone-800'
                }`} 
              />
            ))}
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 flex flex-col items-center justify-start p-4 max-w-md mx-auto w-full gap-6 pb-28">
        
        {/* Sticky Mobile Card Preview */}
        <div className="w-full sticky top-[60px] z-40 bg-[#121110] pb-2 pt-2">
          <p className="text-[10px] text-stone-500 font-mono text-center mb-1">תצוגה מקדימה חיה • לחץ לשינוי צבע/לוגו</p>
          
          <div 
            onClick={handleCardClick}
            style={{ backgroundColor: brandColor }}
            className="w-full aspect-[1.6/1] rounded-2xl p-5 shadow-xl relative overflow-hidden transition-all duration-500 border border-white/5 cursor-pointer hover:scale-[1.01]"
          >
            {/* Ambient Card Shine */}
            <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/10" />

            {/* Hidden File Input */}
            <input 
              type="file" 
              ref={logoInputRef} 
              onChange={handleLogoChange} 
              accept="image/*" 
              className="hidden" 
            />

            <div className="flex justify-between items-start relative z-10">
              {/* Logo Spot */}
              <div 
                onClick={handleLogoClick}
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
                  <span className="text-lg font-black text-amber-400">10% הנחה לחברי מועדון 🏷️</span>
                </div>
              )}

              {/* NFC/Barcode Badge */}
              <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center">
                <span className="text-xs">📱</span>
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Step View */}
        <div className="w-full bg-stone-900/40 border border-stone-800/80 rounded-3xl p-6 backdrop-blur-md">
          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-xs mb-4">
              {errorMsg}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-black mb-1">מיתוג ומראה ויזואלי ✨</h2>
                <p className="text-xs text-stone-400 leading-relaxed">הזן את שם העסק והתאם את מראה כרטיס המועדון שישמר בארנק של הלקוחות.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-stone-400 mb-2">שם העסק</label>
                  <input 
                    type="text" 
                    value={businessName} 
                    onChange={(e) => setBusinessName(e.target.value)} 
                    placeholder="לדוגמה: קפה בנחלה" 
                    className="w-full px-4 py-3 rounded-xl bg-stone-950 border border-stone-800 text-sm focus:border-amber-500 outline-none transition"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-xs font-bold text-stone-400">צבע מותג</label>
                    <button 
                      onClick={() => setShowColorPicker(!showColorPicker)} 
                      className="text-xs text-amber-400 font-bold"
                    >
                      {showColorPicker ? 'סגור' : 'החלף צבע'}
                    </button>
                  </div>
                  
                  {showColorPicker && (
                    <div className="p-3 bg-stone-950 rounded-xl border border-stone-800 space-y-3">
                      <div className="flex gap-2 justify-between">
                        {['#1c1a19', '#15803d', '#1d4ed8', '#b91c1c', '#6d28d9', '#c2410c'].map((color) => (
                          <button 
                            key={color}
                            style={{ backgroundColor: color }}
                            onClick={() => setBrandColor(color)}
                            className={`w-8 h-8 rounded-full border-2 ${brandColor === color ? 'border-white' : 'border-transparent'}`}
                          />
                        ))}
                      </div>
                      <input 
                        type="color" 
                        value={brandColor} 
                        onChange={(e) => setBrandColor(e.target.value)} 
                        className="w-full h-8 rounded-lg bg-transparent cursor-pointer border border-stone-800"
                      />
                    </div>
                  )}
                </div>

                <div 
                  onClick={handleLogoClick}
                  className="w-full py-4 border-2 border-dashed border-stone-800 hover:border-amber-500/40 rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer transition bg-stone-950/20"
                >
                  <Upload className="w-6 h-6 text-stone-500" />
                  <span className="text-xs text-stone-400">{logoFile ? `קובץ נבחר: ${logoFile.name}` : 'העלה לוגו עסק (ריבוע מומלץ)'}</span>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-black mb-1">חוקי מועדון לקוחות ☕</h2>
                <p className="text-xs text-stone-400 leading-relaxed">בחר האם העסק שלך מבוסס על כרטיסיית ניקובים או על מתן הטבות והנחות קבועות.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => setHasStamps(true)}
                  className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition ${
                    hasStamps ? 'bg-amber-500/10 border-amber-500 text-amber-400' : 'bg-stone-950 border-stone-800 text-stone-400'
                  }`}
                >
                  <Coffee className="w-6 h-6" />
                  <span className="text-sm font-bold">כרטיסיית ניקובים</span>
                </button>
                <button 
                  onClick={() => setHasStamps(false)}
                  className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition ${
                    !hasStamps ? 'bg-amber-500/10 border-amber-500 text-amber-400' : 'bg-stone-950 border-stone-800 text-stone-400'
                  }`}
                >
                  <Percent className="w-6 h-6" />
                  <span className="text-sm font-bold">כרטיס הטבות</span>
                </button>
              </div>

              {hasStamps && (
                <div className="space-y-4 pt-2">
                  <div>
                    <label className="block text-xs font-bold text-stone-400 mb-2">כמות ניקובים בכרטיסייה</label>
                    <div className="flex gap-2 justify-between">
                      {[8, 10, 12].map((limit) => (
                        <button 
                          key={limit}
                          onClick={() => setStampLimit(limit)}
                          className={`flex-1 py-2.5 rounded-xl border text-sm font-bold transition ${
                            stampLimit === limit ? 'bg-stone-900 border-amber-500 text-amber-400' : 'bg-stone-950 border-stone-800 text-stone-400'
                          }`}
                        >
                          {limit} ניקובים
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-400 mb-2">סמל הניקוב</label>
                    <div className="flex gap-2 justify-between">
                      {Object.keys(STAMP_ICONS).map((iconKey) => {
                        const IconComponent = STAMP_ICONS[iconKey];
                        return (
                          <button 
                            key={iconKey}
                            onClick={() => setStampIcon(iconKey)}
                            className={`p-2.5 rounded-xl border flex items-center justify-center transition flex-1 ${
                              stampIcon === iconKey ? 'bg-stone-900 border-amber-500 text-amber-400' : 'bg-stone-950 border-stone-800 text-stone-400'
                            }`}
                          >
                            <IconComponent className="w-5 h-5" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-black mb-1">הקמת מבצע ראשון 🎁</h2>
                <p className="text-xs text-stone-400 leading-relaxed">תן ללקוחות שלך סיבה להירשם! הקם את ההטבה הראשונה שהם יקבלו כשיצטרפו.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-stone-400 mb-2">שם המבצע / ההטבה</label>
                  <input 
                    type="text" 
                    value={promoTitle} 
                    onChange={(e) => setPromoTitle(e.target.value)} 
                    placeholder="לדוגמה: קפה 1+1 ברישום למועדון" 
                    className="w-full px-4 py-3 rounded-xl bg-stone-950 border border-stone-800 text-sm focus:border-amber-500 outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-400 mb-2">תיאור ההטבה</label>
                  <textarea 
                    value={promoDesc} 
                    onChange={(e) => setPromoDesc(e.target.value)} 
                    placeholder="לדוגמה: קבלו קפה מתנה במעמד ההרשמה" 
                    rows={2}
                    className="w-full px-4 py-3 rounded-xl bg-stone-950 border border-stone-800 text-sm focus:border-amber-500 outline-none transition resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-400 mb-2">אחוז ההנחה (אם קיים)</label>
                  <input 
                    type="number" 
                    value={promoDiscount} 
                    onChange={(e) => setPromoDiscount(e.target.value)} 
                    placeholder="לדוגמה: 10" 
                    className="w-full px-4 py-3 rounded-xl bg-stone-950 border border-stone-800 text-sm focus:border-amber-500 outline-none transition"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5 text-center py-2">
              <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center mx-auto mb-4 animate-bounce">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-lg font-black mb-1">מוכנים לפרסום! 🚀</h2>
                <p className="text-xs text-stone-400 leading-relaxed">
                  המועדון שלך מוגדר ומעוצב. שמירת הפרטים תעביר את כרטיס המועדון שלך לבדיקת מנהל לאישור סופי.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sticky Bottom Actions */}
      <div className="w-full border-t border-stone-800 bg-[#121110]/95 backdrop-blur-md fixed bottom-0 left-0 right-0 z-50">
        <div className="max-w-md mx-auto px-6 py-4 flex gap-3">
          {step > 1 && (
            <button
              onClick={() => setStep(step - 1)}
              className="px-5 py-3.5 rounded-2xl bg-stone-900 border border-stone-800 hover:bg-stone-800 text-stone-300 font-bold transition duration-300 flex items-center justify-center"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
          )}
          
          {step < 4 ? (
            <button
              onClick={() => setStep(step + 1)}
              className="flex-1 py-3.5 rounded-2xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold transition duration-300 shadow-lg shadow-amber-600/15 flex items-center justify-center gap-2"
            >
              המשך לשלב הבא
              <ArrowLeft className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex-1 py-3.5 rounded-2xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold transition duration-300 shadow-lg shadow-amber-600/15 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? 'שומר ומעבד...' : 'סיום והגשה לאישור מנהל'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
