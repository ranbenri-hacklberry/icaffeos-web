// @ts-nocheck
/**
 * Maya Gateway - State Machine Orchestrator
 *
 * Manages the authentication flow before granting chat access
 * Flow: SCANNING → IDENTIFIED → CLOCK_IN (if worker) → AUTHORIZED → Chat
 *
 * Anti-Gravity Aesthetic with framer-motion transitions
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMayaAuth, isFullyAuthorized, canViewFinancialData } from '../../context/MayaAuthContext';
import FaceScanner from './FaceScanner';
import MayaOverlay from './MayaOverlay';
import { Loader2, CheckCircle, ShieldAlert, Clock, UserCheck } from 'lucide-react';

export const MayaGateway: React.FC = () => {
  const mayaAuth = useMayaAuth();
  const [isOpen, setIsOpen] = useState(false);

  // Initialize - start scanning when opened
  useEffect(() => {
    if (isOpen && mayaAuth.authState === 'LOADING') {
      mayaAuth.setAuthState('SCANNING');
    }
  }, [isOpen, mayaAuth]);

  // Handle face scan completion
  const handleFaceScanComplete = async (embedding: Float32Array, confidence: number) => {
    try {
      console.log('🎯 Face captured, verifying with backend...', { confidence });
      mayaAuth.setAuthState('MATCHING');

      // Convert Float32Array to regular array
      const embeddingArray = Array.from(embedding);

      // Call backend verification
      const response = await fetch('http://localhost:8081/api/maya/verify-face', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embedding: embeddingArray,
          threshold: 0.4,
          businessId: '22222222-2222-2222-2222-222222222222' // iCaffe business ID
        })
      });

      const result = await response.json();

      if (!response.ok || !result.matched) {
        throw new Error(result.message || 'No matching employee found');
      }

      // 🔒 Security: Set employee ONLY from backend response
      const employee = {
        id: result.employee.id,
        name: result.employee.name,
        accessLevel: result.employee.accessLevel,
        isSuperAdmin: result.employee.isSuperAdmin,
        businessId: result.employee.businessId
      };

      mayaAuth.setEmployee(employee, result.similarity);
      mayaAuth.setAuthState('IDENTIFIED');

      // Check if need to clock in
      if (employee.accessLevel === 'Worker' && !employee.isSuperAdmin) {
        await checkClockInStatus(employee.id);
      } else {
        // Super admin or manager - authorize immediately
        mayaAuth.setAuthState('AUTHORIZED');
      }

    } catch (err) {
      console.error('Face verification failed:', err);
      mayaAuth.setError(err.message || 'Verification failed', true);
    }
  };

  // Check if employee is clocked in
  const checkClockInStatus = async (employeeId: string) => {
    try {
      const response = await fetch('http://localhost:8081/api/maya/check-clocked-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId })
      });

      const result = await response.json();

      if (result.isClockedIn) {
        mayaAuth.setClockInStatus(true, result.lastEvent?.assigned_role);
        mayaAuth.setAuthState('AUTHORIZED');
      } else {
        mayaAuth.setClockInStatus(false);
        mayaAuth.setAuthState('CLOCK_IN_REQUIRED');
      }

    } catch (err) {
      console.error('Clock-in check failed:', err);
      // Don't block - allow access but warn
      mayaAuth.setClockInStatus(false);
      mayaAuth.setAuthState('AUTHORIZED');
    }
  };

  // Handle errors
  const handleError = (error: string) => {
    mayaAuth.setError(error, true);
  };

  // Handle PIN fallback
  const handleFallbackToPIN = () => {
    mayaAuth.setError('Camera not available. Please contact admin.', false);
  };

  // Handle retry
  const handleRetry = () => {
    mayaAuth.reset();
    mayaAuth.setAuthState('SCANNING');
  };

  // Transition variants for Anti-Gravity aesthetic
  const transitionVariants = {
    initial: { opacity: 0, scale: 0.95, y: 20 },
    animate: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        type: 'spring',
        damping: 25,
        stiffness: 300
      }
    },
    exit: {
      opacity: 0,
      scale: 1.05,
      y: -20,
      transition: {
        duration: 0.3
      }
    }
  };

  // If authorized, render the chat
  if (mayaAuth.authState === 'AUTHORIZED' && isFullyAuthorized(mayaAuth)) {
    return (
      <MayaOverlay
        employee={mayaAuth.employee}
        canViewFinancialData={canViewFinancialData(mayaAuth)}
        sessionId={mayaAuth.currentSessionId}
        onLogout={() => {
          mayaAuth.reset();
          setIsOpen(false);
        }}
      />
    );
  }

  // Render gateway states
  return (
    <>
      {/* Maya Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-[88px] left-4 z-[9999] w-14 h-14 rounded-xl
                       bg-gradient-to-br from-purple-600 to-pink-600 border-2 border-cyan-400
                       shadow-lg shadow-cyan-500/30 flex items-center justify-center
                       hover:shadow-cyan-500/50 hover:border-cyan-300
                       transition-all duration-200 lg:bottom-6"
          >
            <span className="text-3xl">✨</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Gateway Modal */}
      <AnimatePresence>
        {isOpen && mayaAuth.authState !== 'AUTHORIZED' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              variants={transitionVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="w-[500px] max-h-[700px] rounded-3xl overflow-hidden
                         backdrop-blur-xl bg-slate-900/90 border-2 border-cyan-400/30
                         shadow-2xl shadow-cyan-500/20"
            >
              {/* Header */}
              <div className="h-16 px-6 flex items-center justify-between
                           bg-gradient-to-r from-purple-600/50 to-pink-600/50
                           border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-cyan-400/20 flex items-center justify-center">
                    <span className="text-2xl">✨</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Maya Gateway</h3>
                    <p className="text-xs text-white/60">
                      {mayaAuth.authState === 'SCANNING' && 'מזהה פנים...'}
                      {mayaAuth.authState === 'MATCHING' && 'בודק במערכת...'}
                      {mayaAuth.authState === 'IDENTIFIED' && 'זוהה!'}
                      {mayaAuth.authState === 'CLOCK_IN_REQUIRED' && 'נא לבחור תפקיד'}
                      {mayaAuth.authState === 'ERROR' && 'שגיאה'}
                    </p>
                  </div>
                </div>

                {/* Close button */}
                <button
                  onClick={() => {
                    setIsOpen(false);
                    mayaAuth.reset();
                  }}
                  className="p-2 hover:bg-white/10 rounded-lg transition"
                >
                  <span className="text-white text-xl">×</span>
                </button>
              </div>

              {/* Body - State-based content */}
              <div className="p-8 min-h-[500px] flex items-center justify-center">
                <AnimatePresence mode="wait">
                  {/* SCANNING State */}
                  {mayaAuth.authState === 'SCANNING' && (
                    <motion.div
                      key="scanning"
                      variants={transitionVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      className="w-full"
                    >
                      <FaceScanner
                        onScanComplete={handleFaceScanComplete}
                        onError={handleError}
                        onFallbackToPIN={handleFallbackToPIN}
                      />
                    </motion.div>
                  )}

                  {/* MATCHING State */}
                  {mayaAuth.authState === 'MATCHING' && (
                    <motion.div
                      key="matching"
                      variants={transitionVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      className="text-center"
                    >
                      <Loader2 className="w-16 h-16 text-cyan-400 mx-auto mb-4 animate-spin" />
                      <h3 className="text-xl font-bold text-white mb-2">בודק במערכת...</h3>
                      <p className="text-white/60 text-sm">
                        Verifying identity
                      </p>
                    </motion.div>
                  )}

                  {/* IDENTIFIED State */}
                  {mayaAuth.authState === 'IDENTIFIED' && (
                    <motion.div
                      key="identified"
                      variants={transitionVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      className="text-center"
                    >
                      <motion.div
                        animate={{ rotate: [0, 360] }}
                        transition={{ duration: 0.6 }}
                      >
                        <UserCheck className="w-20 h-20 text-green-400 mx-auto mb-4" />
                      </motion.div>
                      <h3 className="text-2xl font-bold text-white mb-2">
                        היי {mayaAuth.employee?.name}! 👋
                      </h3>
                      <p className="text-white/60 text-sm mb-2">
                        {mayaAuth.employee?.isSuperAdmin ? 'Super Admin' : mayaAuth.employee?.accessLevel}
                      </p>
                      <p className="text-cyan-400 text-xs">
                        Similarity: {((mayaAuth.similarity || 0) * 100).toFixed(0)}%
                      </p>
                    </motion.div>
                  )}

                  {/* CLOCK_IN_REQUIRED State */}
                  {mayaAuth.authState === 'CLOCK_IN_REQUIRED' && (
                    <motion.div
                      key="clock-in"
                      variants={transitionVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      className="text-center"
                    >
                      <Clock className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
                      <h3 className="text-xl font-bold text-white mb-2">
                        צריך להיכנס למשמרת
                      </h3>
                      <p className="text-white/60 text-sm mb-6">
                        {mayaAuth.employee?.name}, בחר את התפקיד שלך היום
                      </p>

                      {/* Placeholder for ClockInModal */}
                      <div className="text-sm text-white/40">
                        (Clock-in modal placeholder - Phase 4)
                      </div>

                      {/* Temporary bypass for testing */}
                      <button
                        onClick={() => {
                          mayaAuth.setClockInStatus(true, 'Test Role');
                          mayaAuth.setAuthState('AUTHORIZED');
                        }}
                        className="mt-6 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl text-white font-medium"
                      >
                        Skip for now (Testing)
                      </button>
                    </motion.div>
                  )}

                  {/* ERROR State */}
                  {mayaAuth.authState === 'ERROR' && (
                    <motion.div
                      key="error"
                      variants={transitionVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      className="text-center"
                    >
                      <ShieldAlert className="w-16 h-16 text-red-400 mx-auto mb-4" />
                      <h3 className="text-xl font-bold text-white mb-2">שגיאה</h3>
                      <p className="text-red-400 text-sm mb-6">{mayaAuth.error}</p>

                      {mayaAuth.errorRetryable && (
                        <button
                          onClick={handleRetry}
                          className="px-6 py-3 bg-purple-500 hover:bg-purple-600 rounded-xl text-white font-medium transition"
                        >
                          נסה שוב
                        </button>
                      )}
                    </motion.div>
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
