import React from 'react';
import { ShieldAlert, RefreshCw, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function VerificationPending() {
  const navigate = useNavigate();

  const handleRefresh = () => {
    window.location.reload();
  };

  const handleLogout = () => {
    localStorage.removeItem('manager_auth_key');
    localStorage.removeItem('manager_auth_time');
    localStorage.removeItem('manager_employee_id');
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-[#121110] text-[#f4f1ed] flex flex-col items-center justify-center p-6 font-sans select-none" dir="rtl">
      {/* Glow Effect */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full bg-amber-500/5 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md bg-stone-900/60 border border-stone-800 p-8 rounded-3xl backdrop-blur-xl shadow-2xl text-center flex flex-col items-center">
        {/* Animated Lock Shield */}
        <div className="w-20 h-20 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 mb-8 relative group">
          <div className="absolute inset-0 bg-amber-500/10 rounded-2xl blur-lg opacity-60 animate-pulse" />
          <ShieldAlert className="w-10 h-10 relative z-10" />
        </div>

        <h1 className="text-2xl font-black mb-3">ממתין לאישור מערכת ⏳</h1>
        <p className="text-stone-400 text-sm leading-relaxed mb-8">
          העסק שלך נרשם בהצלחה וממתין כעת לאישור מנהל המערכת. 
          כדי להבטיח את איכות הרשת, אנו מאשרים כל עסק באופן ידני תוך מספר שעות.
        </p>

        {/* Status Indicator */}
        <div className="w-full bg-stone-950/80 border border-stone-800/60 rounded-2xl p-4 flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
            <span className="text-xs font-mono text-stone-400">STATUS // PENDING</span>
          </div>
          <span className="text-xs text-amber-400 font-bold">בבדיקת מנהל</span>
        </div>

        {/* Actions */}
        <div className="w-full space-y-3">
          <button
            onClick={handleRefresh}
            className="w-full py-3.5 rounded-2xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold transition duration-300 shadow-lg shadow-amber-600/15 flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            בדוק סטטוס אישור
          </button>
          
          <button
            onClick={handleLogout}
            className="w-full py-3.5 rounded-2xl bg-stone-900 border border-stone-800 hover:bg-stone-800 text-stone-300 font-semibold transition duration-300 flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            התנתק וחזור לדף הבית
          </button>
        </div>
      </div>
    </div>
  );
}
