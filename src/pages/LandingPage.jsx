import React, { useState } from 'react';
import { getBackendApiUrl } from '../utils/apiUtils';

export default function LandingPage() {
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [clubType, setClubType] = useState('☕ כרטיסיית ניקובים (עגלת קפה, מאפייה)');
  
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
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      setSuccess(true);
    } catch (err) {
      console.error('Registration failed:', err);
      setErrorMsg('שגיאה ברישום העסק. אנא נסה שוב או צור קשר.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#121110] text-[#f4f1ed] font-sans selection:bg-amber-700/30 selection:text-amber-400" dir="rtl">
      
      {/* 1. Header / Navigation */}
      <header className="max-w-6xl mx-auto px-6 py-6 flex justify-between items-center border-b border-stone-900">
        <div className="flex items-center gap-3">
          <span className="text-2xl">☕</span>
          <span className="text-xl font-bold tracking-wider text-amber-500">icaffeOS</span>
        </div>
        <div>
          <a 
            href="#trial-form" 
            className="px-5 py-2.5 rounded-full bg-amber-700/10 border border-amber-600/30 text-amber-400 font-medium hover:bg-amber-700/20 transition duration-300 text-sm"
          >
            הרשמה לבעלי עסקים
          </a>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm mb-8 animate-pulse">
          <span>✨</span> מועדון הלקוחות של העולם החדש
        </div>
        
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6 leading-tight">
          מועדון הלקוחות הדיגיטלי של העסק שלך. <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-600">
            באוויר תוך 10 דקות.
          </span>
        </h1>
        
        <p className="text-lg md:text-xl text-stone-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          בלי להתקין אפליקציות מורכבות, בלי לשלם עמלות שוחטות ובלי לקנות חומרה יקרה. כרטיסיית לקוח מעוצבת בארנק הדיגיטלי של הלקוחות שלך – במחיר חודשי קבוע ומשתלם אחד.
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

      {/* 3. The Contrast Section (Comparison) */}
      <section className="max-w-5xl mx-auto px-6 py-20 border-t border-stone-900/50">
        <h2 className="text-3xl font-bold text-center mb-12">למה icaffeOS משאירה אבק למערכות הישנות?</h2>
        
        <div className="grid md:grid-cols-2 gap-8">
          {/* Old World */}
          <div className="bg-[#181715]/50 border border-stone-900 p-8 rounded-2xl">
            <h3 className="text-xl font-bold text-red-400 mb-6 flex items-center gap-2">
              <span>❌</span> מה שיש להם היום (העולם הישן)
            </h3>
            <ul className="space-y-4 text-stone-400 text-sm md:text-base">
              <li className="flex gap-2">
                <span className="text-red-500/70">•</span>
                <span><strong>אפליקציות מציקות:</strong> הלקוחות מסרבים להוריד עוד אפליקציה שתתפוס להם מקום בטלפון.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-red-500/70">•</span>
                <span><strong>עמלות סמס שוחטות:</strong> משלמים עשרות אגורות על כל הודעה קטנה, קוד אישור או הצטרפות.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-red-500/70">•</span>
                <span><strong>חומרה יקרה ומסובכת:</strong> צורך לקנות טאבלטים מיוחדים, להריץ כבלים ולסבך את הקופאים בשיא הלחץ.</span>
              </li>
            </ul>
          </div>

          {/* New World */}
          <div className="bg-amber-950/10 border border-amber-900/30 p-8 rounded-2xl shadow-xl shadow-amber-950/5">
            <h3 className="text-xl font-bold text-amber-400 mb-6 flex items-center gap-2">
              <span>🚀</span> הפיצוח של icaffeOS
            </h3>
            <ul className="space-y-4 text-stone-300 text-sm md:text-base">
              <li className="flex gap-2">
                <span className="text-amber-500">•</span>
                <span><strong>אפליקציה אחת, כל המועדונים:</strong> הלקוחות פותחים את הארנק האזורי הדיגיטלי ומוצאים את הכרטיס המעוצב שלך מיד.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-amber-500">•</span>
                <span><strong>מיתוג אישי מלא (White Label):</strong> שליטה מלאה בצבעי המותג, בלוגו ובחוקים (ניקוב קפה או הטבות ישירות).</span>
              </li>
              <li className="flex gap-2">
                <span className="text-amber-500">•</span>
                <span><strong>מודל Flat Fee פשוט:</strong> תשלום חודשי קבוע וקליל. בלי אחוזים, בלי אותיות קטנות ובלי הפתעות בחשבון.</span>
              </li>
            </ul>
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
              <h3 className="text-xl font-bold mb-2">מנקבים באפס מאמץ</h3>
              <p className="text-stone-400 text-sm leading-relaxed">הלקוח סורק את קוד ה-QR בקופה כדי להוסיף כוס קפה לכרטיסייה. אימות GPS מהיר ברקע שומר עליכם מרמאויות.</p>
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
              
              <div className="absolute inset-0 p-6 flex flex-col justify-between z-10">
                <div className="flex justify-between items-start">
                  <span className="text-stone-300 text-[10px] font-mono tracking-widest bg-black/50 px-2 py-1 rounded backdrop-blur-sm">FOUNDER // PROFILE</span>
                  <span className="px-2 py-1 rounded bg-amber-500/20 border border-amber-500/30 text-[10px] text-amber-400 font-bold uppercase tracking-wider backdrop-blur-sm">M4 PRO</span>
                </div>
                
                <div className="flex justify-between items-end border-t border-stone-800/40 pt-4">
                  <div>
                    <h4 className="text-sm font-bold text-amber-400">רן בן ארי</h4>
                    <p className="text-[10px] text-stone-400">שף וארכיטקט מערכות</p>
                  </div>
                  <span className="text-xl">☕</span>
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
