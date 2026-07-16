import React, { useEffect } from 'react';
import { App as CapApp } from '@capacitor/app';
import { AuthProvider } from './context/AuthContext';
import { initActiveEndpoint } from './services/networkResolver';
import { setupApiInterceptor } from './utils/apiInterceptor';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { MusicProvider } from './context/MusicContext';
import AppRoutes from './Routes';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/auth/Login';
import MusicPage from './pages/music';
import YouTubePage from './pages/youtube';
import LoyaltyPortal from './pages/loyalty/LoyaltyPortal';
import './i18n';

const isStandaloneRanTunes = import.meta.env.VITE_STANDALONE_RANTUNES === 'true';
const isCustomerLoyaltyApp = import.meta.env.VITE_CUSTOMER_LOYALTY_APP === 'true';

function AppContent() {
  const { isDarkMode } = useTheme();

  useEffect(() => {
    const handleError = (e) => {
      console.error('🔥 GLOBAL_CRASH:', e);
      const errorMsg = e.message || (e.reason && e.reason.message) || 'Unknown Crash';

      if (
        errorMsg.includes('ResizeObserver loop completed with undelivered notifications') ||
        errorMsg.includes('ResizeObserver loop limit exceeded')
      ) {
        return;
      }

      if (typeof window !== 'undefined') {
        const overlay = document.createElement('div');
        overlay.id = 'crash-overlay';
        overlay.style.cssText =
          'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(15,23,42,0.95);color:white;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:10000;font-family:Inter,sans-serif;text-align:center;direction:ltr;backdrop-blur:10px;';
        overlay.innerHTML = `
          <div style="background:#1e293b;padding:40px;border-radius:24px;border:1px solid #334155;box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);">
            <h3 style="font-size:24px;font-weight:900;margin-bottom:16px;">⚠️ Application Error</h3>
            <p style="color:#94a3b8;margin-bottom:24px;max-width:400px;">${errorMsg}</p>
            <button onclick="window.location.reload()" style="background:#f97316;color:white;border:none;padding:12px 32px;border-radius:12px;font-weight:bold;cursor:pointer;transition:transform 0.2s;">Reload System</button>
          </div>
        `;
        if (!document.getElementById('crash-overlay')) {
          document.body.appendChild(overlay);
        }
      }
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleError);

    // Capacitor back button handler
    const isCapacitor = window.location.hostname === 'localhost' && /android|iphone|ipad/i.test(navigator.userAgent);
    let backButtonListener;
    if (isCapacitor) {
      CapApp.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack) {
          window.history.back();
        } else {
          CapApp.exitApp();
        }
      }).then(listener => {
        backButtonListener = listener;
      });
    }

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleError);
      if (backButtonListener) {
        backButtonListener.remove();
      }
    };
  }, []);

  return (
    <div className={`${isDarkMode ? 'dark' : ''} font-inter`} dir="ltr">
      {isCustomerLoyaltyApp ? (
        <HashRouter>
          <LoyaltyPortal />
        </HashRouter>
      ) : isStandaloneRanTunes ? (
        <HashRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={
              <ProtectedRoute>
                <MusicPage />
              </ProtectedRoute>
            } />
            <Route path="/youtube" element={
              <ProtectedRoute>
                <YouTubePage />
              </ProtectedRoute>
            } />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </HashRouter>
      ) : (
        <AppRoutes />
      )}
    </div>
  );
}

function App() {
  const [isInitializing, setIsInitializing] = React.useState(true);

  React.useEffect(() => {
    async function bootApp() {
      // 1. Resolve active endpoint (local or remote)
      await initActiveEndpoint();
      // 2. Set up our global API fetch interceptor
      setupApiInterceptor();
      // 3. Complete boot
      setIsInitializing(false);
    }
    bootApp();
  }, []);

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center font-inter" dir="rtl">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin mx-auto mb-6"></div>
          <h3 className="text-lg font-bold text-white mb-2">מתחבר לשרת iCaffeOS...</h3>
          <p className="text-xs text-white/50">מזהה רשת ומאמת הגדרות חיבור</p>
        </div>
      </div>
    );
  }

  return (
    <AuthProvider>
      <ThemeProvider>
        <MusicProvider>
          <AppContent />
        </MusicProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
