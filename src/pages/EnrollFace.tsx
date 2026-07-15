// @ts-nocheck
/**
 * Face Enrollment Page
 * Admin tool to enroll employee face embeddings
 *
 * Flow: Scan Face → Select Employee → Save to Database
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import FaceScanner from '../components/maya/FaceScanner';
import { supabase } from '../lib/supabase';
import { getBackendApiUrl } from '../utils/apiUtils';
import { ArrowLeft, Users, CheckCircle2, AlertCircle, Loader2, UserPlus } from 'lucide-react';

interface Employee {
  id: string;
  name: string;
  access_level?: string;
  is_super_admin?: boolean;
  face_embedding?: any;
}

const EnrollFace: React.FC = () => {
  const [scanState, setScanState] = useState<'IDLE' | 'SCANNING' | 'CAPTURED' | 'ENROLLING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [embedding, setEmbedding] = useState<Float32Array | null>(null);
  const [confidence, setConfidence] = useState<number>(0);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [loadingEmployees, setLoadingEmployees] = useState(true);

  const [enrollMessage, setEnrollMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Load employees on mount
  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      setLoadingEmployees(true);

      // Get business ID (hardcoded for iCaffe, adjust as needed)
      const businessId = '22222222-2222-2222-2222-222222222222';

      const { data, error } = await supabase
        .from('employees')
        .select('id, name, access_level, is_super_admin, face_embedding')
        .eq('business_id', businessId)
        .order('name');

      if (error) throw error;

      setEmployees(data || []);

      // Pre-select first employee without face enrollment
      const needsEnrollment = data?.find(e => !e.face_embedding);
      if (needsEnrollment) {
        setSelectedEmployeeId(needsEnrollment.id);
      }

    } catch (err) {
      console.error('Failed to load employees:', err);
      setErrorMessage('Failed to load employees');
    } finally {
      setLoadingEmployees(false);
    }
  };

  const handleScanComplete = (embed: Float32Array, conf: number) => {
    console.log('✅ Face captured for enrollment:', {
      dimensions: embed.length,
      confidence: conf,
      sample: Array.from(embed.slice(0, 5))
    });

    setEmbedding(embed);
    setConfidence(conf);
    setScanState('CAPTURED');
  };

  const handleEnroll = async () => {
    if (!selectedEmployeeId) {
      setErrorMessage('Please select an employee');
      return;
    }

    if (!embedding) {
      setErrorMessage('No face embedding captured');
      return;
    }

    try {
      setScanState('ENROLLING');
      setErrorMessage('');

      // Convert Float32Array to regular array
      const embeddingArray = Array.from(embedding);

      // 🛡️ SECURITY UPGRADE: Call Backend API instead of direct Supabase RPC
      // This applies server-side Biometric Peppering before persisting the data.
      const API_URL = getBackendApiUrl();
      const response = await fetch(`${API_URL}/api/maya/enroll-face`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          employeeId: selectedEmployeeId,
          embedding: embeddingArray,
          businessId: '22222222-2222-2222-2222-222222222222'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Backend enrollment error:', errorData);
        throw new Error(errorData.error || 'Enrollment failed');
      }

      const verifiedData = await response.json();
      console.log('✅ Face enrolled via Backend:', verifiedData);

      // Success!
      const employee = employees.find(e => e.id === selectedEmployeeId);
      setEnrollMessage(`✅ ${employee?.name} enrolled successfully!`);
      setScanState('SUCCESS');

      // Reload employees to update face_embedding status
      setTimeout(() => {
        loadEmployees();
      }, 2000);

    } catch (err) {
      console.error('Enrollment error:', err);
      setErrorMessage(err.message || 'Enrollment failed');
      setScanState('ERROR');
    }
  };

  const handleReset = () => {
    setScanState('IDLE');
    setEmbedding(null);
    setConfidence(0);
    setEnrollMessage('');
    setErrorMessage('');
  };

  const selectedEmployee = employees.find(e => e.id === selectedEmployeeId);
  const enrolledCount = employees.filter(e => e.face_embedding).length;
  const totalCount = employees.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-8">
      {/* Back button */}
      <button
        onClick={() => window.history.back()}
        className="fixed top-6 left-6 z-50 p-3 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 hover:bg-white/20 transition-colors"
      >
        <ArrowLeft className="w-5 h-5 text-white" />
      </button>

      <div className="max-w-4xl w-full">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <UserPlus className="w-10 h-10 text-purple-400" />
            <h1 className="text-4xl font-bold text-white">
              Face Enrollment
            </h1>
          </div>
          <p className="text-white/60 mb-2">
            Register employee faces for biometric authentication
          </p>
          <div className="text-sm text-cyan-400">
            {enrolledCount} / {totalCount} employees enrolled
          </div>
        </motion.div>

        {/* Main Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/20 shadow-2xl shadow-purple-500/20 overflow-hidden"
        >
          <div className="grid md:grid-cols-2 gap-6 p-8">

            {/* Left: Scanner */}
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <span className="w-8 h-8 bg-purple-500/20 rounded-full flex items-center justify-center text-purple-400 text-sm">1</span>
                Scan Face
              </h2>

              <div className="h-[500px] flex items-center justify-center">
                {scanState === 'IDLE' || scanState === 'SCANNING' ? (
                  <FaceScanner
                    onScanComplete={handleScanComplete}
                    onError={(err) => {
                      setErrorMessage(err);
                      setScanState('ERROR');
                    }}
                    onFallbackToPIN={() => {
                      setErrorMessage('Camera not available');
                      setScanState('ERROR');
                    }}
                  />
                ) : (
                  <div className="flex flex-col items-center gap-4">
                    {scanState === 'CAPTURED' && (
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="text-center"
                      >
                        <CheckCircle2 className="w-20 h-20 text-green-400 mx-auto mb-4" />
                        <h3 className="text-2xl font-bold text-white mb-2">Face Captured!</h3>
                        <p className="text-white/60 text-sm mb-4">
                          Confidence: {confidence.toFixed(0)}%
                        </p>
                        <p className="text-white/80 text-sm">
                          Now select the employee and click Enroll →
                        </p>
                      </motion.div>
                    )}

                    {scanState === 'ENROLLING' && (
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="text-center"
                      >
                        <Loader2 className="w-16 h-16 text-purple-400 mx-auto mb-4 animate-spin" />
                        <p className="text-white text-lg">Enrolling...</p>
                      </motion.div>
                    )}

                    {scanState === 'SUCCESS' && (
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="text-center"
                      >
                        <CheckCircle2 className="w-20 h-20 text-green-400 mx-auto mb-4" />
                        <h3 className="text-2xl font-bold text-white mb-2">Success!</h3>
                        <p className="text-green-400">{enrollMessage}</p>
                        <button
                          onClick={handleReset}
                          className="mt-6 px-6 py-3 bg-purple-500 hover:bg-purple-600 rounded-xl text-white font-medium transition-colors"
                        >
                          Enroll Another
                        </button>
                      </motion.div>
                    )}

                    {scanState === 'ERROR' && (
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="text-center"
                      >
                        <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-white mb-2">Error</h3>
                        <p className="text-red-400 mb-6">{errorMessage}</p>
                        <button
                          onClick={handleReset}
                          className="px-6 py-3 bg-purple-500 hover:bg-purple-600 rounded-xl text-white font-medium transition-colors"
                        >
                          Try Again
                        </button>
                      </motion.div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Employee Selection */}
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <span className="w-8 h-8 bg-purple-500/20 rounded-full flex items-center justify-center text-purple-400 text-sm">2</span>
                Select Employee
              </h2>

              {loadingEmployees ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Employee List */}
                  <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                    {employees.map((employee) => (
                      <motion.button
                        key={employee.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setSelectedEmployeeId(employee.id)}
                        className={`w-full p-4 rounded-xl border-2 transition-all ${selectedEmployeeId === employee.id
                            ? 'bg-purple-500/20 border-purple-500'
                            : 'bg-white/5 border-white/10 hover:border-white/30'
                          }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="text-left">
                            <div className="font-medium text-white flex items-center gap-2">
                              {employee.name}
                              {employee.is_super_admin && (
                                <span className="px-2 py-0.5 bg-yellow-500/20 border border-yellow-500/40 rounded text-xs text-yellow-400">
                                  Super Admin
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-white/60">
                              {employee.access_level || 'Worker'}
                            </div>
                          </div>
                          {employee.face_embedding ? (
                            <CheckCircle2 className="w-5 h-5 text-green-400" />
                          ) : (
                            <div className="w-5 h-5 rounded-full border-2 border-white/30" />
                          )}
                        </div>
                      </motion.button>
                    ))}
                  </div>

                  {/* Selected Employee Info */}
                  {selectedEmployee && (
                    <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                      <div className="text-sm text-white/60 mb-1">Selected:</div>
                      <div className="font-bold text-white">{selectedEmployee.name}</div>
                      <div className="text-xs text-white/60 mt-1">
                        {selectedEmployee.face_embedding ? '✅ Already enrolled' : '⚠️ Not enrolled yet'}
                      </div>
                    </div>
                  )}

                  {/* Enroll Button */}
                  <button
                    onClick={handleEnroll}
                    disabled={scanState !== 'CAPTURED' || !selectedEmployeeId}
                    className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl text-white font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
                  >
                    {scanState === 'ENROLLING' ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Enrolling...
                      </span>
                    ) : (
                      '✨ Enroll Face'
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Instructions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-6 p-6 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10"
        >
          <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-400" />
            How to Enroll:
          </h3>
          <ol className="space-y-2 text-sm text-white/70">
            <li className="flex items-start gap-2">
              <span className="text-purple-400 font-bold">1.</span>
              Look at the camera and wait for the scanning ring to appear
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-400 font-bold">2.</span>
              Keep your face centered until you see "Face Captured!"
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-400 font-bold">3.</span>
              Select the employee from the list on the right
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-400 font-bold">4.</span>
              Click "Enroll Face" to save the biometric data
            </li>
          </ol>
        </motion.div>
      </div>
    </div>
  );
};

export default EnrollFace;
