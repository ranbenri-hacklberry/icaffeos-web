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
          מועדון לקוחות שעובד בשבילכם. <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-600">
            לא בשביל חברות ה-SMS.
          </span>
        </h1>
        
        <p className="text-lg md:text-xl text-stone-400 max-w-3xl mx-auto mb-10 leading-relaxed">
          הגיע הזמן להתקדם לפתרון שמשלב את כל מה שהעסק שלכם צריך. icaffeOS מביאה לכם 2 במחיר 1: כרטיסיית ניקובים דיגיטלית קלה לתפעול, פלוס מערכת מועדון לקוחות שמאפשרת לכם לשלוח מבצעים והטבות ישירות למסך הבית של הלקוחות שלכם. הכל מעוצב לפי המותג, הצבעים והלוגו שלכם, בלי דמי הקמה ובלי הגבלה על כמות ההודעות. רק 200 ₪ בחודש פיקס – גם אם יש לכם 5,000 לקוחות שמקבלים עדכון שבועי.
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
        <p className="text-stone-400 max-w-2xl mx-auto mb-12 text-sm md:text-base leading-relaxed">
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
            <div className="text-[11px] md:text-sm text-stone-300 space-y-4 font-normal leading-relaxed">
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
