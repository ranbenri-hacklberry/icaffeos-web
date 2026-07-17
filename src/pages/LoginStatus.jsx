import React, { useState } from 'react';
import { useAuth } from '../context/SimpleAuthContext';
import { useNavigate } from 'react-router-dom';

export default function LoginStatus() {
  const { currentUser, login, logout, isLoading } = useAuth();
  const navigate = useNavigate();

  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [tooltipText, setTooltipText] = useState('');

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!phone || !pin) {
      setErrorMsg('נא למלא את כל השדות.');
      return;
    }
    
    setSubmitLoading(true);
    setErrorMsg('');
    
    try {
      await login(phone, pin);
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'מספר טלפון או קוד PIN שגויים. אנא נסו שוב.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleAppDownloadClick = (storeName) => {
    setTooltipText(`אפליקציית iCaffeOS ל-${storeName} זמינה כעת בבטא סגורה ללקוחותינו.`);
    setTimeout(() => {
      setTooltipText('');
    }, 4000);
  };

  // Sleek Dark Theme Layout
  return (
    <div className="min-h-screen bg-[#121110] text-[#f4f1ed] flex flex-col justify-between font-sans" dir="rtl">
      
      {/* Header */}
      <header className="max-w-6xl w-full mx-auto px-6 py-6 flex justify-between items-center border-b border-stone-900">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
          <img src="/rainbow_cup.png" alt="icaffeOS Logo" className="w-8 h-8 object-contain" />
          <span className="text-xl font-extrabold tracking-wider text-amber-500">icaffeOS</span>
        </div>
        <button 
          onClick={() => navigate('/')} 
          className="text-stone-400 hover:text-[#f4f1ed] text-sm transition-colors"
        >
          חזרה לדף הבית
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md bg-stone-950/80 border border-stone-900 rounded-3xl p-8 shadow-2xl backdrop-blur-md">
          
          {!currentUser ? (
            /* Login Form Mode */
            <div>
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold mb-2">כניסה לאזור העסקי</h1>
                <p className="text-stone-400 text-sm">התחברו כדי לצפות בסטטוס המועדון שלכם</p>
              </div>

              {errorMsg && (
                <div className="bg-red-950/40 border border-red-900 text-red-400 text-sm rounded-xl p-3 mb-6 text-center">
                  {errorMsg}
                </div>
              )}

              <form onSubmit={handleLoginSubmit} className="space-y-6">
                <div>
                  <label className="block text-stone-400 text-sm font-semibold mb-2" htmlFor="phone">
                    מספר טלפון
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    placeholder="לדוגמה: 0506102416"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-stone-900/60 border border-stone-800 rounded-xl px-4 py-3 text-[#f4f1ed] placeholder:text-stone-600 focus:outline-none focus:border-amber-600 transition-colors"
                    required
                  />
                </div>

                <div>
                  <label className="block text-stone-400 text-sm font-semibold mb-2" htmlFor="pin">
                    קוד PIN (4 ספרות)
                  </label>
                  <input
                    id="pin"
                    type="password"
                    maxLength={4}
                    placeholder="••••"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    className="w-full bg-stone-900/60 border border-stone-800 rounded-xl px-4 py-3 text-[#f4f1ed] placeholder:text-stone-600 focus:outline-none focus:border-amber-600 transition-colors text-center tracking-[0.5em]"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitLoading || isLoading}
                  className="w-full bg-amber-600 hover:bg-amber-700 disabled:bg-amber-900/50 disabled:text-stone-500 text-stone-950 font-bold py-3.5 px-6 rounded-xl transition-all shadow-lg hover:shadow-amber-900/10 flex justify-center items-center gap-2"
                >
                  {submitLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-stone-950 border-t-transparent rounded-full animate-spin"></div>
                      <span>מתחבר...</span>
                    </>
                  ) : (
                    'התחבר למערכת'
                  )}
                </button>
              </form>
            </div>
          ) : (
            /* Logged In Status Mode */
            <div className="space-y-8">
              <div className="text-center">
                <h1 className="text-2xl font-bold mb-1">שלום, {currentUser.name} 👋</h1>
                <p className="text-stone-400 text-sm">{currentUser.business?.name || 'העסק שלך'}</p>
              </div>

              {/* Status Indicator */}
              <div className="bg-stone-900/40 border border-stone-800/80 rounded-2xl p-5 flex flex-col items-center justify-center text-center">
                <span className="text-stone-400 text-xs font-semibold uppercase tracking-wider mb-2">סטטוס מועדון הלקוחות</span>
                {currentUser.business?.settings?.status === 'approved' ? (
                  <div className="flex items-center gap-2 text-emerald-400 font-bold bg-emerald-950/30 border border-emerald-900/50 px-4 py-1.5 rounded-full text-sm">
                    <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse"></span>
                    <span>פעיל ומאושר במערכת</span>
                  </div>
                ) : currentUser.business?.settings?.status === 'pending_admin_approval' ? (
                  <div className="flex items-center gap-2 text-amber-400 font-bold bg-amber-950/30 border border-amber-900/50 px-4 py-1.5 rounded-full text-sm">
                    <span className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-pulse"></span>
                    <span>ממתין לאישור אדמין</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-blue-400 font-bold bg-blue-950/30 border border-blue-900/50 px-4 py-1.5 rounded-full text-sm">
                    <span className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-pulse"></span>
                    <span>ממתין לעיצוב והגדרה</span>
                  </div>
                )}
              </div>

              {/* App redirection section */}
              <div className="border-t border-stone-900 pt-6 text-center space-y-4">
                <h3 className="text-base font-bold text-amber-500">ניהול המועדון מתבצע ישירות מהנייד!</h3>
                <p className="text-stone-400 text-sm leading-relaxed">
                  כדי לעצב את כרטיס ה-Apple Wallet שלך, לעדכן מבצעים ולשלוח התראות פוש ללקוחות בזמן אמת, הורד את האפליקציה למכשירך והתחבר.
                </p>

                {/* App store downloads */}
                <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                  <button 
                    onClick={() => handleAppDownloadClick('iPhone')}
                    className="flex items-center justify-center gap-2 bg-stone-900 hover:bg-stone-850 border border-stone-850 px-4 py-2.5 rounded-xl transition-all"
                  >
                    <img src="https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg" className="w-4 h-4 invert filter" alt="App Store" />
                    <span className="text-xs font-semibold">App Store</span>
                  </button>
                  <button 
                    onClick={() => handleAppDownloadClick('Android')}
                    className="flex items-center justify-center gap-2 bg-stone-900 hover:bg-stone-850 border border-stone-850 px-4 py-2.5 rounded-xl transition-all"
                  >
                    <img src="https://upload.wikimedia.org/wikipedia/commons/d/d7/Play_store_flat_icon_%282022%29.svg" className="w-4 h-4" alt="Google Play" />
                    <span className="text-xs font-semibold">Google Play</span>
                  </button>
                </div>

                {tooltipText && (
                  <div className="bg-amber-950/20 border border-amber-900/30 text-amber-400 text-xs rounded-xl p-3 mt-4 animate-fade-in">
                    {tooltipText}
                  </div>
                )}
              </div>

              {/* Logout button */}
              <div className="border-t border-stone-900 pt-6 flex justify-between items-center">
                <span className="text-stone-500 text-xs">PIN: {currentUser.pin_code || '1234'}</span>
                <button
                  onClick={logout}
                  className="text-stone-400 hover:text-red-400 text-sm font-semibold transition-colors"
                >
                  התנתק מהחשבון
                </button>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 border-t border-stone-900 text-center text-xs text-stone-600">
        iCaffeOS © {new Date().getFullYear()}. נבנה באהבה עבור עסקים מקומיים.
      </footer>
    </div>
  );
}
