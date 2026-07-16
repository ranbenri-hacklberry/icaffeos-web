import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBackendApiUrl } from '../utils/apiUtils';
import { useAuth } from '../context/AuthContext';

export default function LandingPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [clubType, setClubType] = useState('☕ כרטיסיית ניקובים (עגלת קפה, מאפייה)');
  const [activationCode, setActivationCode] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!businessName || !ownerName || !phone) {
      setErrorMsg('נא למלא את כל השדות החשובים.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const baseUrl = getBackendApiUrl();
      const response = await fetch(`${baseUrl}/api/public/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          businessName,
          ownerName,
          phone,
          clubType,
          activationCode,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      if (data.employee) {
        await login(data.employee);
        navigate('/onboarding');
        return;
      }

      setSuccess(true);
    } catch (err) {
      console.error('Registration failed:', err);
      setErrorMsg(err.message || 'שגיאה ברישום העסק. אנא נסה שוב או צור קשר.');
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen bg-[#121110] text-[#f4f1ed] font-sans selection:bg-amber-700/30 selection:text-amber-400" dir="rtl">
      
      {/* 1. Header / Navigation */}
      <header className="max-w-6xl mx-auto px-6 py-4 md:py-6 flex justify-between items-center border-b border-stone-900">
        <div className="flex items-center gap-3">
          <img src="/rainbow_cup.png" alt="icaffeOS Logo" className="w-8 h-8 object-contain" />
          <span className="text-[24px] sm:text-xl font-extrabold tracking-wider text-amber-500">icaffeOS</span>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="max-w-4xl mx-auto px-6 pt-8 md:pt-20 pb-12 md:pb-16 text-center">
        
        <h1 className="text-[34px] sm:text-4xl md:text-6xl font-extrabold tracking-tight mb-6 leading-tight md:leading-none">
          <span className="block sm:inline">מועדון לקוחות </span>
          <span className="block sm:inline">שעובד בשבילכם.</span>
          <br className="hidden sm:inline" />
          <span className="block sm:inline-block text-[25px] sm:text-[inherit] text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-600 mt-2 sm:mt-0">
            לא בשביל חברות ה-SMS.
          </span>
        </h1>
        
        <p className="text-lg md:text-xl text-stone-400 max-w-3xl mx-auto mb-10 leading-relaxed">
          הגיע הזמן להתקדם לפתרון שמשלב את כל מה שהעסק שלכם צריך. icaffeOS מביאה לכם 2 במחיר 1: כרטיסיית ניקובים דיגיטלית קלה לתפעול, פלוס מערכת מועדון לקוחות שמאפשרת לכם לשלוח מבצעים והטבות ישירות למסך הבית של הלקוחות שלכם. הכל מעוצב לפי המותג, הצבעים והלוגו שלכם, בלי דמי הקמה ובלי הגבלה על כמות ההודעות.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <a 
            href="#trial-form" 
            className="w-full sm:w-auto px-8 py-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-[#121110] font-bold text-lg shadow-lg shadow-amber-600/20 transition duration-300 transform hover:-translate-y-0.5"
          >
            התחילו חודש ניסיון חינם 🎉
          </a>
          <span className="text-sm text-stone-500">ללא התחייבות • ללא כרטיס אשראי מראש</span>
        </div>
      </section>

      {/* 3. Time Machine Section (Comparison) */}
      <section className="max-w-5xl mx-auto px-4 md:px-6 py-20 border-t border-stone-900/50 text-center">
        <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4">כנסו למכונת הזמן: איך נראה מועדון הלקוחות שלכם בעתיד?</h2>
        <p className="text-stone-400 max-w-2xl mx-auto mb-12 text-base md:text-lg leading-relaxed">
          הודעות ה-SMS הומצאו ב-1992 (כן, עוד במאה הקודמת). אז למה העסק שלכם עדיין משלם עליהן הון ב-2026? הגיע הזמן לעשות קפיצה קטנה קדימה ולגלות איך נראה הדלפק שלכם כשמפסיקים לחיות בעבר:
        </p>

        <div className="grid grid-cols-2 gap-3 md:gap-8 w-full text-right">
          
          {/* Column 1: Year 1992 (Old World) */}
          <div className="bg-stone-200 text-stone-900 p-3 md:p-6 rounded-none border-2 border-dashed border-stone-400 flex flex-col gap-4 font-mono">
            <h3 className="text-stone-700 font-bold text-base md:text-xl border-b border-stone-400 pb-2 uppercase tracking-wider">
              ⚠️ שנת 1992 (העולם הישן)
            </h3>
            <div className="text-[11px] md:text-sm text-stone-850 space-y-4 leading-relaxed font-semibold">
              <p>
                <strong>הסיוט של הכרטיסיות האבודות:</strong> הלקוח מגיע לקופה, שוב שכח את כרטיסיית הנייר באוטו, ואתם נאלצים לאלתר פתרונות או לתת קפה חינם כדי שלא יתבאס. שלא לדבר על הבריסטה שמחלק ניקובים לחברים שלו "על יבש".
              </p>
              <p>
                <strong>מס ה-SMS השוחט:</strong> אתם משלמים דמי מנוי חודשיים יקרים רק על התוכנה, ובנוסף קונים חבילות SMS מוגבלות. ככל שאתם גדלים ומביאים יותר לקוחות – חברות התוכנה קונסות אתכם ביותר כסף על הודעות.
              </p>
              <p>
                <strong>הברזלים והכבלים בקופה:</strong> מאלצים אתכם לשלם דמי הקמה מטורפים, לקנות טאבלטים ייעודיים שיעמדו על הדלפק, יקחו מקום יקר ויסבכו את הצוות בשיא הלחץ של הבוקר.
              </p>
            </div>
          </div>
          
          {/* Column 2: Year 2026 (icaffeOS) */}
          <div className="bg-stone-950/70 text-stone-100 border border-amber-500/30 rounded-3xl p-4 md:p-8 flex flex-col gap-4 shadow-[0_16px_32px_rgba(245,158,11,0.08)]">
            <h3 className="text-amber-400 font-black text-sm md:text-xl border-b border-stone-850 pb-3 flex items-center gap-1.5">
              <span>🚀</span> שנת 2026 (icaffeOS)
            </h3>
            <div className="text-[11px] md:text-sm text-stone-300 space-y-4 font-semibold leading-relaxed">
              <p>
                <strong>הכרטיסייה קבוע בתוך הטלפון:</strong> סריקה מהירה של קוד ה-QR בקופה והכרטיסייה עולה ישירות על מסך הבית. כל הניקובים מאובטחים, מהירים ובלי קומבינות בקופה.
              </p>
              <p>
                <strong>הודעות פוש ללא הגבלה ובמחיר פיקס:</strong> <strong>2 באחד</strong> – כרטיסייה ומערכת הודעות. שולחים 5,000, 10,000 או אפילו 50,000 הודעות בחודש והעלות היא תמיד <strong>200 ₪ בחודש וזהו</strong>.
              </p>
              <p>
                <strong>אפס חומרה, הקמה עצמית ב-5 דקות:</strong> בלי מכשירים חדשים ובלי דמי התקנה מומצאים. הגדרה עצמאית מהנייד שלכם תוך 5 דקות גג – והכל ממותג בלוגו ובצבעים שלכם.
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* 3.5 Cost and Visual Comparison Section */}
      <section className="py-16 px-4 max-w-6xl mx-auto border-t border-stone-900/50">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4">סמס מיושן או פוש ממותג? תעשו את החשבון בעצמכם</h2>
          <p className="text-stone-400 max-w-2xl mx-auto text-base md:text-lg leading-relaxed">
            תראו איך המותג שלכם נראה על המסך שלהם, ותראו כמה כסף נשאר לכם בקופה בסוף החודש.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Column 1: Visual comparison (5 columns out of 12) */}
          <div className="lg:col-span-5 flex flex-col gap-6 items-center">
            
            {/* Simulators Container */}
            <div className="flex items-end justify-center gap-2 sm:gap-6 w-full max-w-[460px] mx-auto select-none pt-4">
              
              {/* Right column: SMS */}
              <div className="flex flex-col items-center flex-1">
                {/* Nokia retro simulator */}
                <div className="w-[125px] sm:w-[155px] bg-stone-800 rounded-[24px] border-[3px] border-stone-700 p-2.5 flex flex-col items-center shadow-lg">
                  {/* Nokia Brand text */}
                  <div className="text-[7px] font-mono tracking-widest text-stone-500 font-bold mb-1">NOKIA</div>
                  
                  {/* Screen */}
                  <div className="w-full h-24 bg-[#8da781] border border-stone-900 rounded p-1.5 font-mono text-stone-950 text-[7.5px] leading-tight flex flex-col justify-between shadow-inner">
                    <div>
                      <div className="flex justify-between border-b border-stone-900/30 pb-0.5 mb-1 font-bold text-[6px]">
                        <span>[1] SMS</span>
                        <span>052-9999999</span>
                      </div>
                      <p className="font-bold text-stone-900/90 leading-tight text-[7px] text-right" dir="rtl">
                        מבצע סופ"ש: 25% הנחה על כל המאפים! להסרה השב הסר.
                      </p>
                    </div>
                    <div className="text-[5.5px] text-stone-900/60 text-center border-t border-stone-900/30 pt-0.5">
                      1992
                    </div>
                  </div>
                  
                  {/* Nokia Keypad grid */}
                  <div className="w-full mt-2.5 px-0.5 space-y-1">
                    {/* Menu / Select keys */}
                    <div className="grid grid-cols-3 gap-1 px-0.5">
                      <div className="h-1 bg-stone-700 rounded-sm"></div>
                      <div className="h-1.5 bg-stone-600 rounded-sm"></div>
                      <div className="h-1 bg-stone-700 rounded-sm"></div>
                    </div>
                    {/* Call keys */}
                    <div className="grid grid-cols-2 gap-3 px-0.5">
                      <div className="h-1 bg-green-950/40 border border-green-800/40 rounded-sm"></div>
                      <div className="h-1 bg-red-950/40 border border-red-800/40 rounded-sm"></div>
                    </div>
                    {/* Number pad */}
                    <div className="grid grid-cols-3 gap-1 pt-0.5 text-[6px] font-mono text-stone-500 text-center">
                      <div className="bg-stone-900/40 h-3 rounded-sm flex items-center justify-center">1</div>
                      <div className="bg-stone-900/40 h-3 rounded-sm flex items-center justify-center">2</div>
                      <div className="bg-stone-900/40 h-3 rounded-sm flex items-center justify-center">3</div>
                      <div className="bg-stone-900/40 h-3 rounded-sm flex items-center justify-center">4</div>
                      <div className="bg-stone-900/40 h-3 rounded-sm flex items-center justify-center">5</div>
                      <div className="bg-stone-900/40 h-3 rounded-sm flex items-center justify-center">6</div>
                      <div className="bg-stone-900/40 h-3 rounded-sm flex items-center justify-center">7</div>
                      <div className="bg-stone-900/40 h-3 rounded-sm flex items-center justify-center">8</div>
                      <div className="bg-stone-900/40 h-3 rounded-sm flex items-center justify-center">9</div>
                      <div className="bg-stone-900/40 h-3 rounded-sm flex items-center justify-center">*</div>
                      <div className="bg-stone-900/40 h-3 rounded-sm flex items-center justify-center">0</div>
                      <div className="bg-stone-900/40 h-3 rounded-sm flex items-center justify-center">#</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Middle VS */}
              <div className="flex items-center justify-center px-1 pb-16">
                <span className="bg-amber-600/10 text-amber-500 border border-amber-600/20 text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                  vs
                </span>
              </div>

              {/* Left column: Push */}
              <div className="flex flex-col items-center flex-1">
                {/* iPhone modern simulator */}
                <div className="w-[160px] sm:w-[190px] h-[260px] sm:h-[310px] bg-stone-950 rounded-[28px] border-[4px] border-stone-800 p-2 flex flex-col relative shadow-xl overflow-hidden">
                  {/* Dynamic island */}
                  <div className="absolute top-1 left-1/2 transform -translate-x-1/2 w-14 h-2.5 bg-black rounded-full z-20"></div>
                  
                  {/* Screen content */}
                  <div className="w-full h-full rounded-[22px] bg-gradient-to-b from-[#211610] to-[#0d0907] p-1.5 flex flex-col justify-between relative overflow-hidden">
                    
                    {/* Top clock */}
                    <div className="text-center mt-1">
                      <span className="text-sm font-light text-stone-200/90 font-sans tracking-tight">09:41</span>
                    </div>

                    {/* Floating Rich Push notification */}
                    <div className="bg-amber-500/[0.04] border border-amber-500/25 rounded-xl p-1.5 text-stone-200 text-right shadow-md backdrop-blur-sm">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[6px] text-amber-400 font-bold bg-amber-500/10 px-1 py-0.2 rounded-full">2026</span>
                        <div className="flex items-center gap-1">
                          <span className="text-[7px] font-bold text-amber-400">icaffeOS</span>
                          <img src="/rainbow_cup.png" alt="Logo" className="w-2.5 h-2.5 object-contain" />
                        </div>
                      </div>
                      
                      <div className="bg-stone-900/80 p-1.5 rounded-lg border border-stone-850">
                        <div className="text-[7px] font-black text-white mb-0.5">מבצע סופ"ש: 25% הנחה על כל המאפים! 🥐☕</div>
                        <p className="text-[6px] text-stone-300 leading-normal">
                          קרואסון חמאה פריך, דניש שוקולד עשיר ורוגלך חם מחכים לך בהנחה מטורפת של 25%.
                        </p>
                        
                        {/* Embedded Image in Push */}
                        <img 
                          src="/assets/fallback_pastries.png" 
                          alt="Pastries" 
                          className="w-full h-10 object-cover rounded my-1 border border-stone-800"
                        />

                        <div className="flex gap-1 justify-end">
                          <span className="text-[6px] font-bold px-1 py-0.5 bg-amber-600 text-stone-950 rounded-sm">
                            כנס 📲
                          </span>
                          <span className="text-[6px] font-bold px-1 py-0.5 bg-stone-800 text-stone-300 rounded-sm">
                            הטבות 🎁
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom bar indicator */}
                    <div className="w-12 h-0.5 bg-white/40 rounded-full mx-auto mb-0.5"></div>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Column 2: Economic Table (7 columns out of 12) */}
          <div className="lg:col-span-7 bg-[#1c1a18] p-6 md:p-8 rounded-3xl border border-stone-900 text-right overflow-x-auto shadow-xl">
            <h3 className="text-xl font-bold text-amber-500 mb-4 border-b border-stone-900 pb-3">חישוב עלויות חודשי לעסק (לפי הודעה אחת בשבוע)</h3>
            
            <table className="w-full text-right border-collapse text-sm md:text-base">
              <thead>
                <tr className="border-b border-stone-850 text-stone-400 text-xs md:text-sm">
                  <th className="pb-3 font-bold">לקוחות במועדון</th>
                  <th className="pb-3 font-bold">עלות SMS בשוק</th>
                  <th className="pb-3 font-bold text-amber-400">עלות ב-icaffeOS</th>
                  <th className="pb-3 font-bold text-green-400">כסף שנשאר בכיס</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-900/60 text-stone-200">
                <tr className="hover:bg-stone-900/20 transition duration-150">
                  <td className="py-3.5 font-bold">500 לקוחות</td>
                  <td className="py-3.5 text-stone-400">₪390</td>
                  <td className="py-3.5 text-amber-400 font-bold">₪200</td>
                  <td className="py-3.5 text-green-400 font-semibold">₪190</td>
                </tr>
                <tr className="hover:bg-stone-900/20 transition duration-150">
                  <td className="py-3.5 font-bold">1,000 לקוחות</td>
                  <td className="py-3.5 text-stone-400">₪630</td>
                  <td className="py-3.5 text-amber-400 font-bold">₪200</td>
                  <td className="py-3.5 text-green-400 font-semibold">₪430</td>
                </tr>
                <tr className="bg-amber-500/[0.03] border-y border-amber-500/10">
                  <td className="py-4 font-bold text-amber-400">2,500 לקוחות</td>
                  <td className="py-4 text-stone-400">₪1,350</td>
                  <td className="py-4 text-amber-400 font-extrabold">₪200</td>
                  <td className="py-4 text-green-400 font-black">₪1,150 🚀</td>
                </tr>
                <tr className="hover:bg-stone-900/20 transition duration-150">
                  <td className="py-3.5 font-bold">5,000 לקוחות</td>
                  <td className="py-3.5 text-stone-400">₪2,550</td>
                  <td className="py-3.5 text-amber-400 font-bold">₪200</td>
                  <td className="py-3.5 text-green-400 font-semibold">₪2,350</td>
                </tr>
              </tbody>
            </table>
            
            <p className="text-xs text-stone-500 mt-5 leading-relaxed border-t border-stone-900/50 pt-4">
              * החישוב מבוסס על עלות SMS ממוצעת בשוק של כ-12 אג' + דמי שימוש חודשיים בסיסיים של כ-150 ₪ במערכת דיוור לעומת Flat Fee קבוע ב-icaffeOS.
            </p>
          </div>

        </div>
      </section>

      {/* 4. How It Works */}
      <section className="bg-[#181715]/30 border-y border-stone-900/50 py-20">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-16">איך זה עובד בפועל? (3 שלבים פשוטים)</h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center md:text-right">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center text-xl font-bold mb-4 md:mr-0 mx-auto">1</div>
              <h3 className="text-xl font-bold mb-2">מגדירים את הכרטיס בדקה</h3>
              <p className="text-stone-400 text-sm leading-relaxed">מעלים לוגו, בוחרים את צבע המותג הייחודי שלכם, וקובעים את חוקי המועדון של העסק.</p>
            </div>
            
            <div className="text-center md:text-right">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center text-xl font-bold mb-4 md:mr-0 mx-auto">2</div>
              <h3 className="text-xl font-bold mb-2">הלקוחות סורקים ומצטרפים</h3>
              <p className="text-stone-400 text-sm leading-relaxed">מציבים מעמד קטן ומעוצב עם קוד QR על הדלפק. הלקוח סורק מהנייד שלו, ומקבל את הכרטיס לארנק שלו ברגע.</p>
            </div>

            <div className="text-center md:text-right">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center text-xl font-bold mb-4 md:mr-0 mx-auto">3</div>
              <h3 className="text-xl font-bold mb-2">מבצעים והודעות באפס מאמץ</h3>
              <p className="text-stone-400 text-sm leading-relaxed">כמה זה פשוט דרך הנייד להעלות מבצע – רק צריך לכתוב כותרת, תיאור, להעלות תמונה ולשלוח במכה לכל הלקוחות שלכם.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 4.5 About the Founder */}
      <section className="max-w-5xl mx-auto px-6 py-20 border-t border-stone-900/50">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Image Column */}
          <div className="order-2 md:order-1 flex justify-center">
            <div className="relative group w-full max-w-sm aspect-[4/5] rounded-3xl overflow-hidden border border-stone-800 shadow-2xl transition duration-500 hover:border-amber-500/30">
              <img 
                src="./assets/ran_founder.jpg" 
                alt="רן בן ארי מחזיק Mac Mini M4" 
                className="absolute inset-0 w-full h-full object-cover grayscale group-hover:grayscale-0 transition duration-700 ease-out transform group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-85" />
              
              <div className="absolute inset-0 p-6 flex flex-col justify-end z-10">
                <div className="flex justify-between items-end border-t border-stone-800/40 pt-4">
                  <div>
                    <h4 className="text-sm font-bold text-amber-400">רן בן ארי</h4>
                    <p className="text-[10px] text-stone-400">שף וארכיטקט מערכות</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Story Column */}
          <div className="order-1 md:order-2 text-right">
            <div className="inline-block px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs mb-4">
              מאחורי הקלעים 🛠️
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold mb-6">
              נעים להכיר, אני <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-600">רן 👋</span>
            </h2>
            <div className="space-y-6 text-stone-400 text-base md:text-lg leading-relaxed">
              <p>
                כארכיטקט מערכות מידע ומפתח תוכנה (שמבלה לא מעט שעות גם במטבח כשף), ראיתי מקרוב איך הטכנולוגיה של היום פשוט מנותקת מהשטח. בעלי עסקים נאלצים להילחם בקופות מסובכות, לשלם עמלות מטורפות, ולהתפלל שהאינטרנט לא יקרוס באמצע הלחץ של הבוקר.
              </p>
              <p>
                אז החלטתי לבנות את <strong className="text-amber-500/90">icaffeOS</strong>. מערכת שנולדה מתוך השטח ועבור השטח - כדי להעניק לעסקים נודדים, כפריים ומקומיים פלטפורמה חזקה ויציבה כמו של החברות הגדולות בעולם, אבל באפס חיכוך, באפס כאבי ראש, ובמחיר חודשי קבוע ומשתלם אחד. בלי אותיות קטנות.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Free Trial Registration Form */}
      <section id="trial-form" className="max-w-xl mx-auto px-6 py-20 text-center">
        <h2 className="text-3xl font-bold mb-4">בואו נקים את המועדון שלכם</h2>
        <p className="text-stone-400 mb-8">
          הצטרפו לפיילוט היום וקבלו <strong>30 ימי ניסיון מלאים בחינם</strong>. <br />
          אין צורך בכרטיס אשראי, ואין שום התחייבות.
        </p>

        {success ? (
          <div className="bg-emerald-950/20 border border-emerald-500/30 p-8 rounded-2xl text-center shadow-xl">
            <span className="text-4xl block mb-4">🎉</span>
            <h3 className="text-2xl font-bold text-emerald-400 mb-2">נרשמתם בהצלחה לפיילוט!</h3>
            <p className="text-stone-300 text-sm leading-relaxed mb-6">
              העסק <strong>{businessName}</strong> נרשם במערכת בסטטוס ראשוני. צוות העיצוב שלנו ייצור אתכם קשר במספר <strong>{phone}</strong> תוך מספר שעות כדי להתאים את כרטיסיית המועדון שלכם.
            </p>
            <div className="text-xs text-stone-500">
              קוד ה-PIN הזמני שלך להתחברות לקופה הוא: <strong>1234</strong>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-right bg-[#181715] border border-stone-900 p-8 rounded-2xl shadow-xl">
            {errorMsg && (
              <div className="p-3 bg-red-950/20 border border-red-500/30 text-red-400 text-sm rounded-lg text-center">
                {errorMsg}
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-stone-400 mb-1">שם העסק</label>
              <input 
                type="text" 
                placeholder="למשל: עגלת קפה בטבע"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-[#121110] border border-stone-800 text-white placeholder-stone-600 focus:outline-none focus:border-amber-500 transition"
                required 
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-stone-400 mb-1">שם מלא</label>
                <input 
                  type="text" 
                  placeholder="ישראל ישראלי"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-[#121110] border border-stone-800 text-white placeholder-stone-600 focus:outline-none focus:border-amber-500 transition"
                  required 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-400 mb-1">טלפון ליצירת קשר</label>
                <input 
                  type="tel" 
                  placeholder="050-1234567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-[#121110] border border-stone-800 text-white placeholder-stone-600 focus:outline-none focus:border-amber-500 text-left transition"
                  required 
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-stone-400 mb-1">סוג המועדון המבוקש</label>
              <select 
                value={clubType}
                onChange={(e) => setClubType(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-[#121110] border border-stone-800 text-white focus:outline-none focus:border-amber-500 transition"
              >
                <option>☕ כרטיסיית ניקובים (עגלת קפה, מאפייה)</option>
                <option>🌿 כרטיס חבר מועדון והטבות (משתלה, חנות, משק)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-400 mb-1">קוד הפעלה מיידית (אופציונלי)</label>
              <input 
                type="text" 
                placeholder="2102 להפעלה מיידית ומעבר לעריכת הכרטיס"
                value={activationCode}
                onChange={(e) => setActivationCode(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-[#121110] border border-stone-800 text-white placeholder-stone-600 focus:outline-none focus:border-amber-500 transition"
              />
            </div>
            
            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-4 bg-amber-600 hover:bg-amber-500 text-[#121110] font-bold rounded-xl shadow-lg transition duration-300 mt-4 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-[#121110]/30 border-t-[#121110] rounded-full animate-spin"></div>
                  רושם עסק במערכת...
                </>
              ) : (
                'שלחו בקשה ונתחיל לעצב 🎨'
              )}
            </button>
          </form>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t border-stone-900 py-8 text-center text-stone-600 text-xs">
        <p>© {new Date().getFullYear()} icaffeOS. נבנה באהבה עבור עסקים מקומיים.</p>
      </footer>
    </div>
  );
}
