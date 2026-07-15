// @ts-nocheck
/**
 * Maya Gateway Test Page
 * בדיקת מערכת הזיהוי הביומטרי - Anti-Gravity Design
 *
 * Split Screen:
 * - שמאל: Maya Gateway (זיהוי פנים + PIN)
 * - ימין: Debug Panel (לוגים ומידע)
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PlayCircle, RefreshCw, CheckCircle, AlertCircle,
  User, Key, Clock, Shield, Terminal, Activity
} from 'lucide-react';
import { MayaAuthProvider, useMayaAuth } from '../context/MayaAuthContext';
import MayaGateway from '../components/maya/MayaGatewayComplete';

// Component פנימי שיש לו גישה ל-MayaAuth
const TestPageContent: React.FC = () => {
  const mayaAuth = useMayaAuth();
  const [logs, setLogs] = useState<string[]>([]);
  const [manualPIN, setManualPIN] = useState('1234');
  const [showGateway, setShowGateway] = useState(false);

  // לוג כל שינוי ב-authState
  useEffect(() => {
    addLog(`🔄 State changed: ${mayaAuth.authState}`);
  }, [mayaAuth.authState]);

  // לוג כל זיהוי עובד
  useEffect(() => {
    if (mayaAuth.employee) {
      addLog(`👤 Employee identified: ${mayaAuth.employee.name} (${mayaAuth.employee.accessLevel})`);
      if (mayaAuth.similarity > 0) {
        addLog(`📊 Similarity: ${(mayaAuth.similarity * 100).toFixed(1)}%`);
      }
    }
  }, [mayaAuth.employee]);

  // לוג clock-in status
  useEffect(() => {
    if (mayaAuth.isClockedIn && mayaAuth.currentRole) {
      addLog(`⏰ Clocked in as: ${mayaAuth.currentRole}`);
    }
  }, [mayaAuth.isClockedIn, mayaAuth.currentRole]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString('he-IL');
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev].slice(0, 50));
  };

  const handleOpenGateway = () => {
    setShowGateway(true);
    addLog('🚀 Opening Maya Gateway...');
    mayaAuth.setAuthState('SCANNING');
  };

  const handleManualPIN = async () => {
    addLog(`🔑 Testing manual PIN: ${manualPIN}`);
    try {
      const response = await fetch('http://localhost:8081/api/maya/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pin: manualPIN,
          businessId: '22222222-2222-2222-2222-222222222222'
        })
      });

      const result = await response.json();

      if (result.matched) {
        addLog('✅ PIN verified successfully!');
        mayaAuth.setEmployee({
          id: result.employee.id,
          name: result.employee.name,
          accessLevel: result.employee.accessLevel,
          isSuperAdmin: result.employee.isSuperAdmin,
          businessId: result.employee.businessId
        }, 1.0);
        mayaAuth.setAuthState('IDENTIFIED');
        setTimeout(() => {
          mayaAuth.setAuthState('CLOCK_IN_REQUIRED');
        }, 1500);
      } else {
        addLog('❌ PIN verification failed');
        mayaAuth.setError('Invalid PIN', true);
      }
    } catch (err) {
      addLog(`❌ Error: ${err.message}`);
    }
  };

  const handleReset = () => {
    mayaAuth.reset();
    setShowGateway(false);
    setLogs([]);
    addLog('🔄 System reset');
  };

  const getStatusColor = () => {
    switch (mayaAuth.authState) {
      case 'AUTHORIZED': return 'text-green-400';
      case 'ERROR': return 'text-red-400';
      case 'SCANNING':
      case 'MATCHING': return 'text-cyan-400';
      case 'IDENTIFIED':
      case 'CLOCK_IN_REQUIRED': return 'text-yellow-400';
      default: return 'text-white/60';
    }
  };

  const getStatusIcon = () => {
    switch (mayaAuth.authState) {
      case 'AUTHORIZED': return <CheckCircle className="w-5 h-5" />;
      case 'ERROR': return <AlertCircle className="w-5 h-5" />;
      case 'SCANNING': return <Activity className="w-5 h-5 animate-pulse" />;
      case 'IDENTIFIED': return <User className="w-5 h-5" />;
      case 'CLOCK_IN_REQUIRED': return <Clock className="w-5 h-5" />;
      default: return <Shield className="w-5 h-5" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex">
      {/* Left Side - Gateway */}
      <div className="flex-1 relative">
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 p-6 bg-gradient-to-b from-slate-900/90 to-transparent backdrop-blur-sm z-10">
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <Shield className="w-8 h-8 text-cyan-400" />
            Maya Gateway Test
          </h1>
          <p className="text-white/60 text-sm">בדיקת מערכת זיהוי ביומטרי</p>
        </div>

        {/* Gateway Area */}
        <div className="h-full flex items-center justify-center p-6 pt-32">
          {!showGateway ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleOpenGateway}
                className="px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-2xl
                         text-white font-bold text-lg shadow-xl shadow-cyan-500/50
                         hover:shadow-cyan-500/70 transition-all duration-200
                         flex items-center gap-3 mx-auto"
              >
                <PlayCircle className="w-6 h-6" />
                פתח Maya Gateway
              </motion.button>

              <p className="text-white/40 text-sm mt-6">
                לחץ להתחלת תהליך הזיהוי
              </p>
            </motion.div>
          ) : (
            <div className="w-full h-full">
              {/* Maya Gateway Component */}
              <MayaGateway />
            </div>
          )}
        </div>
      </div>

      {/* Right Side - Debug Panel */}
      <div className="w-[500px] bg-slate-900/50 backdrop-blur-xl border-l border-white/10 flex flex-col">
        {/* Debug Header */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Terminal className="w-6 h-6 text-cyan-400" />
              <h2 className="text-xl font-bold text-white">Debug Panel</h2>
            </div>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleReset}
              className="p-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg transition"
              title="Reset Everything"
            >
              <RefreshCw className="w-5 h-5 text-red-400" />
            </motion.button>
          </div>

          {/* Status Display */}
          <div className="bg-slate-800/50 rounded-xl p-4 border border-white/10">
            <div className="flex items-center justify-between mb-3">
              <span className="text-white/60 text-sm">Status:</span>
              <div className={`flex items-center gap-2 ${getStatusColor()} font-bold`}>
                {getStatusIcon()}
                {mayaAuth.authState}
              </div>
            </div>

            {mayaAuth.employee && (
              <>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white/60 text-sm">Employee:</span>
                  <span className="text-white font-medium">{mayaAuth.employee.name}</span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white/60 text-sm">Role:</span>
                  <span className="text-cyan-400 font-medium">{mayaAuth.employee.accessLevel}</span>
                </div>
                {mayaAuth.similarity > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-white/60 text-sm">Confidence:</span>
                    <span className="text-green-400 font-medium">
                      {(mayaAuth.similarity * 100).toFixed(1)}%
                    </span>
                  </div>
                )}
              </>
            )}

            {mayaAuth.error && (
              <div className="mt-3 p-2 bg-red-500/20 border border-red-400/30 rounded text-red-400 text-sm">
                {mayaAuth.error}
              </div>
            )}
          </div>

          {/* Manual PIN Test */}
          <div className="mt-4 bg-slate-800/50 rounded-xl p-4 border border-white/10">
            <div className="flex items-center gap-2 mb-3">
              <Key className="w-4 h-4 text-purple-400" />
              <span className="text-white font-medium text-sm">Manual PIN Test</span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualPIN}
                onChange={(e) => setManualPIN(e.target.value)}
                maxLength={4}
                className="flex-1 px-3 py-2 bg-slate-700/50 border border-white/20 rounded-lg
                         text-white text-center font-mono text-lg focus:outline-none focus:border-purple-400"
                placeholder="1234"
              />
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleManualPIN}
                className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-400/30
                         rounded-lg text-purple-400 font-medium text-sm transition"
              >
                Test
              </motion.button>
            </div>
          </div>
        </div>

        {/* Logs */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center justify-between">
              <span className="text-white font-medium text-sm">System Logs</span>
              <button
                onClick={() => setLogs([])}
                className="text-xs text-white/40 hover:text-white/60 transition"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-1 font-mono text-xs">
            <AnimatePresence mode="popLayout">
              {logs.map((log, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className={`p-2 rounded ${
                    log.includes('❌') ? 'bg-red-500/10 text-red-400' :
                    log.includes('✅') ? 'bg-green-500/10 text-green-400' :
                    log.includes('🔄') ? 'bg-cyan-500/10 text-cyan-400' :
                    'bg-slate-800/50 text-white/70'
                  }`}
                >
                  {log}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="p-4 border-t border-white/10">
          <div className="text-white/60 text-xs mb-2">Quick Actions:</div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                mayaAuth.setAuthState('SCANNING');
                addLog('🔄 Force SCANNING state');
              }}
              className="px-3 py-2 bg-slate-800/50 hover:bg-slate-700/50 border border-white/10
                       rounded-lg text-white/70 text-xs transition"
            >
              → SCANNING
            </button>
            <button
              onClick={() => {
                mayaAuth.setAuthState('MATCHING');
                addLog('🔄 Force MATCHING state');
              }}
              className="px-3 py-2 bg-slate-800/50 hover:bg-slate-700/50 border border-white/10
                       rounded-lg text-white/70 text-xs transition"
            >
              → MATCHING
            </button>
            <button
              onClick={() => {
                mayaAuth.setAuthState('ERROR');
                mayaAuth.setError('Test error message', true);
                addLog('❌ Force ERROR state');
              }}
              className="px-3 py-2 bg-slate-800/50 hover:bg-slate-700/50 border border-white/10
                       rounded-lg text-white/70 text-xs transition"
            >
              → ERROR
            </button>
            <button
              onClick={() => {
                if (mayaAuth.employee) {
                  mayaAuth.setAuthState('CLOCK_IN_REQUIRED');
                  addLog('⏰ Force CLOCK_IN_REQUIRED');
                }
              }}
              className="px-3 py-2 bg-slate-800/50 hover:bg-slate-700/50 border border-white/10
                       rounded-lg text-white/70 text-xs transition"
            >
              → CLOCK_IN
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Component ראשי עם Provider
export const TestMayaGateway: React.FC = () => {
  return (
    <MayaAuthProvider>
      <TestPageContent />
    </MayaAuthProvider>
  );
};

export default TestMayaGateway;
