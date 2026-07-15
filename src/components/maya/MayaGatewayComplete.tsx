// @ts-nocheck
/**
 * Maya Gateway - Complete State Machine Orchestrator (Phase 4)
 *
 * Manages authentication flow with dynamic configuration:
 * - Face Recognition (if enabled in business settings)
 * - PIN Entry (always available as fallback/primary)
 * - Clock-in requirement (optional based on settings)
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useMayaAuth, canViewFinancialData } from '../../context/MayaAuthContext';
import FaceScanner from './FaceScanner';
import PINPad from './PINPad';
import ClockInModal from './ClockInModal';
import MayaOverlay from './MayaOverlay';
import { Loader2, ShieldAlert, Clock, UserCheck, Key, Camera } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getBackendApiUrl } from '../../utils/apiUtils';

interface MayaGatewayProps {
  forceOpen?: boolean;
  hideClose?: boolean;
}

export const MayaGateway: React.FC<MayaGatewayProps> = ({
  forceOpen = false,
  hideClose = false
}) => {
  const mayaAuth = useMayaAuth();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(forceOpen);
  const [wasFaceAuthenticated, setWasFaceAuthenticated] = useState(false);
  const [config, setConfig] = useState({
    faceEnabled: false,
    faceRequiredForClockin: false,
    loading: true
  });

  // Load business settings on mount
  useEffect(() => {
    const loadBusinessSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('businesses')
          .select('settings')
          .eq('id', localStorage.getItem('business_id') || '22222222-2222-2222-2222-222222222222')
          .single();

        if (error) throw error;

        const faceSettings = data?.settings?.face_recognition || {};
        setConfig({
          faceEnabled: faceSettings.enabled === true,
          faceRequiredForClockin: faceSettings.required_for_clockin === true,
          loading: false
        });

        // Initialize auth state based on config
        if (isOpen && mayaAuth.authState === 'LOADING') {
          if (faceSettings.enabled) {
            mayaAuth.setAuthState('SCANNING');
          } else {
            mayaAuth.setAuthState('PIN_FALLBACK');
          }
        }
      } catch (err) {
        console.error('⚠️ Could not load business settings:', err);
        setConfig(prev => ({ ...prev, loading: false }));
        if (isOpen && mayaAuth.authState === 'LOADING') {
          mayaAuth.setAuthState('PIN_FALLBACK');
        }
      }
    };

    loadBusinessSettings();
  }, [isOpen, mayaAuth]);

  // Navigate based on user role when authorized
  useEffect(() => {
    if (mayaAuth.authState === 'AUTHORIZED') {
      const isSuperAdmin = mayaAuth.employee?.isSuperAdmin;
      const destination = isSuperAdmin ? '/super-admin' : '/mode-selection';
      setTimeout(() => navigate(destination, { replace: true }), 1000);
    }
  }, [mayaAuth.authState, mayaAuth.employee, navigate]);

  // Handle face scan completion
  const handleFaceScanComplete = async (embedding: Float32Array, confidence: number) => {
    try {
      mayaAuth.setAuthState('MATCHING');
      const API_URL = getBackendApiUrl();
      const response = await fetch(`${API_URL}/api/maya/verify-face`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embedding: Array.from(embedding),
          threshold: 0.55,
          businessId: localStorage.getItem('business_id') || '22222222-2222-2222-2222-222222222222'
        })
      });

      if (!response.ok) throw new Error('Verification failed');
      const verifiedData = await response.json();
      if (!verifiedData.matched) throw new Error('No employee match');

      const employee = {
        id: verifiedData.employee.id,
        name: verifiedData.employee.name,
        accessLevel: verifiedData.employee.accessLevel,
        isSuperAdmin: verifiedData.employee.isSuperAdmin,
        businessId: verifiedData.employee.businessId
      };

      mayaAuth.setEmployee(employee, verifiedData.employee.similarity);
      mayaAuth.setAuthState('IDENTIFIED');
      await login(employee);
      setWasFaceAuthenticated(true);

      setTimeout(() => checkAccessRequirements(employee, true), 1500);
    } catch (err) {
      console.warn('Face verification failed, switching to PIN');
      mayaAuth.setAuthState('PIN_FALLBACK');
    }
  };

  // Handle PIN verification success
  const handlePINSuccess = async (employee: any, similarity: number) => {
    // 👑 Only real super admins get isSuperAdmin=true. Owners are NOT super admins.
    const isSuperAdmin = employee.isSuperAdmin || employee.is_super_admin ||
      employee.accessLevel === 'super-admin' || employee.access_level === 'super-admin';
    const employeeData = {
      id: employee.id,
      name: employee.name,
      accessLevel: employee.accessLevel || employee.access_level,
      isSuperAdmin: isSuperAdmin,
      businessId: employee.businessId || employee.business_id,
      business_id: employee.business_id || employee.businessId,
      business_name: employee.business_name || employee.businessName,
    };

    mayaAuth.setEmployee(employeeData, similarity);
    mayaAuth.setAuthState('IDENTIFIED');
    await login(employeeData);
    setWasFaceAuthenticated(false);

    setTimeout(() => checkAccessRequirements(employeeData, false), 1500);
  };

  // Check access requirements
  const checkAccessRequirements = async (employee: any, wasFaceAuthenticated: boolean) => {
    const isSuper = employee.isSuperAdmin || employee.accessLevel === 'super-admin';
    // Super-admins bypass clock-in enforcement
    if (isSuper) {
      console.log('👑 Super Admin Bypass Authorized');
      mayaAuth.setAuthState('AUTHORIZED');
      return;
    }
    await checkClockInStatus(employee, wasFaceAuthenticated);
  };

  // Check if employee is clocked in
  const checkClockInStatus = async (employee: any, wasFaceAuthenticated: boolean) => {
    try {
      const { data, error } = await supabase.rpc('check_clocked_in', { p_employee_id: employee.id });
      if (error) throw error;

      const isSuper = employee.isSuperAdmin || employee.accessLevel === 'super-admin';

      if (data?.is_clocked_in) {
        mayaAuth.setClockInStatus(true, data.assigned_role);
        mayaAuth.setAuthState('AUTHORIZED');
      } else {
        mayaAuth.setClockInStatus(false);
        if (isSuper) {
          mayaAuth.setAuthState('AUTHORIZED');
          return;
        }
        mayaAuth.setAuthState('CLOCK_IN_REQUIRED');
      }
    } catch (err) {
      mayaAuth.setClockInStatus(false);
      mayaAuth.setAuthState('AUTHORIZED');
    }
  };

  const handleClockInSuccess = (role: string, eventId: string) => {
    mayaAuth.setClockInStatus(true, role);
    mayaAuth.setAuthState('AUTHORIZED');
  };

  const handleError = (error: string) => mayaAuth.setError(error, true);
  const handleFallbackToPIN = () => mayaAuth.setAuthState('PIN_FALLBACK');
  const handleSwitchToFace = () => {
    mayaAuth.reset();
    mayaAuth.setAuthState('SCANNING');
  };
  const handleRetry = () => {
    mayaAuth.reset();
    mayaAuth.setAuthState(config.faceEnabled ? 'SCANNING' : 'PIN_FALLBACK');
  };

  const transitionVariants = {
    initial: { opacity: 0, scale: 0.95, y: 20 },
    animate: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', damping: 25, stiffness: 300 } },
    exit: { opacity: 0, scale: 1.05, y: -20, transition: { duration: 0.3 } }
  };

  if (mayaAuth.authState === 'AUTHORIZED') {
    return (
      <MayaOverlay
        employee={mayaAuth.employee}
        canViewFinancialData={canViewFinancialData(mayaAuth)}
        sessionId={mayaAuth.currentSessionId}
        isClockedIn={mayaAuth.isClockedIn}
        onLogout={() => { mayaAuth.reset(); setIsOpen(false); }}
      />
    );
  }

  return (
    <>
      <AnimatePresence>
        {!forceOpen && !isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-[88px] left-4 z-[9999] w-14 h-14 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 border-2 border-cyan-400 shadow-lg shadow-cyan-500/30 flex items-center justify-center lg:bottom-6"
          >
            <span className="text-3xl">✨</span>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && mayaAuth.authState !== 'AUTHORIZED' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          >
            <motion.div
              variants={transitionVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className={`w-full max-w-[500px] ${mayaAuth.authState === 'CLOCK_IN_REQUIRED' ? 'sm:max-w-[800px]' : ''} max-h-[90vh] rounded-3xl overflow-hidden backdrop-blur-xl bg-slate-900/90 border-2 border-cyan-400/30 shadow-2xl shadow-cyan-500/20`}
            >
              <div className="h-14 sm:h-16 px-4 sm:px-6 flex items-center justify-between bg-gradient-to-r from-purple-600/50 to-pink-600/50 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-cyan-400/20 flex items-center justify-center">
                    {mayaAuth.authState === 'PIN_FALLBACK' ? <Key size={18} className="text-cyan-400" /> : <span className="text-xl sm:text-2xl">✨</span>}
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-white">כניסה למערכת</h3>
                    <p className="text-[10px] sm:text-xs text-white/60">
                      {config.loading ? 'טוען הגדרות...' : (mayaAuth.authState === 'SCANNING' ? 'מזהה פנים...' : 'הזן קוד PIN')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const currentIp = localStorage.getItem('kds_server_ip') || '192.168.1.10';
                      const newIp = prompt('הזן את כתובת ה-IP של שרת ה-iCaffeOS:', currentIp);
                      if (newIp !== null && newIp.trim() !== '') {
                        localStorage.setItem('kds_server_ip', newIp.trim());
                        window.location.reload();
                      }
                    }}
                    className="px-2.5 py-1 text-[10px] font-bold bg-white/10 hover:bg-white/20 text-cyan-300 rounded-lg border border-cyan-400/30 transition-colors"
                  >
                    הגדרת שרת ({localStorage.getItem('kds_server_ip') || '192.168.1.10'})
                  </button>
                  {!hideClose && (
                    <button onClick={() => { if (!forceOpen) { setIsOpen(false); mayaAuth.reset(); } }} className="p-2 hover:bg-white/10 rounded-lg text-white">×</button>
                  )}
                </div>
              </div>

              <div className="p-4 sm:p-8 min-h-[400px] sm:min-h-[500px] flex justify-center overflow-y-auto">
                <AnimatePresence mode="wait">
                  {mayaAuth.authState === 'SCANNING' && (
                    <motion.div key="scanning" variants={transitionVariants} initial="initial" animate="animate" exit="exit" className="w-full">
                      <FaceScanner onScanComplete={handleFaceScanComplete} onError={handleError} onFallbackToPIN={handleFallbackToPIN} />
                    </motion.div>
                  )}

                  {mayaAuth.authState === 'PIN_FALLBACK' && (
                    <motion.div key="pin-entry" variants={transitionVariants} initial="initial" animate="animate" exit="exit" className="w-full">
                      <PINPad onSuccess={handlePINSuccess} onError={handleError} onSwitchToFace={config.faceEnabled ? handleSwitchToFace : undefined} />
                    </motion.div>
                  )}

                  {mayaAuth.authState === 'MATCHING' && (
                    <div className="text-center">
                      <Loader2 className="w-12 h-12 text-cyan-400 mx-auto mb-4 animate-spin" />
                      <h3 className="text-lg font-bold text-white">בודק במערכת...</h3>
                    </div>
                  )}

                  {mayaAuth.authState === 'IDENTIFIED' && (
                    <div className="text-center">
                      <UserCheck className="w-16 h-16 text-green-400 mx-auto mb-4" />
                      <h3 className="text-xl font-bold text-white">היי {mayaAuth.employee?.name}! 👋</h3>
                    </div>
                  )}

                  {mayaAuth.authState === 'CLOCK_IN_REQUIRED' && (
                    <div className="w-full">
                      <ClockInModal
                        employee={mayaAuth.employee}
                        onClockInSuccess={handleClockInSuccess}
                        onError={handleError}
                        // If face is REQUIRED for clock-in and they used PIN, they CANNOT skip
                        onSkip={(wasFaceAuthenticated || !config.faceRequiredForClockin) ? () => {
                          mayaAuth.setClockInStatus(false);
                          mayaAuth.setAuthState('AUTHORIZED');
                        } : undefined}
                      />
                      {config.faceRequiredForClockin && !wasFaceAuthenticated && (
                        <p className="text-amber-400 text-center text-xs mt-4">⚠️ חובה להזדהות עם פנים כדי לדלג על החתמת שעון</p>
                      )}
                    </div>
                  )}

                  {mayaAuth.authState === 'ERROR' && (
                    <div className="text-center">
                      <ShieldAlert className="w-12 h-12 text-red-400 mx-auto mb-4" />
                      <h3 className="text-lg font-bold text-white">שגיאה</h3>
                      <p className="text-red-400 text-sm mb-6">{mayaAuth.error}</p>
                      <button onClick={handleRetry} className="px-6 py-2 bg-purple-500 rounded-xl text-white">נסה שוב</button>
                    </div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default MayaGateway;
