// @ts-nocheck
/**
 * FaceScanner Test Page
 * Standalone page to test face detection and embedding extraction
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import FaceScanner from '../components/maya/FaceScanner';
import { ArrowLeft } from 'lucide-react';

const FaceScannerTest: React.FC = () => {
  const [embedding, setEmbedding] = useState<Float32Array | null>(null);
  const [confidence, setConfidence] = useState<number>(0);
  const [showPINFallback, setShowPINFallback] = useState(false);
  const [scanComplete, setScanComplete] = useState(false);

  const handleScanComplete = (embed: Float32Array, conf: number) => {
    console.log('🎯 Scan Complete!');
    console.log('Embedding dimensions:', embed.length);
    console.log('Confidence:', conf);
    console.log('First 10 values:', Array.from(embed.slice(0, 10)));

    setEmbedding(embed);
    setConfidence(conf);
    setScanComplete(true);
  };

  const handleError = (error: string) => {
    console.error('❌ Scanner error:', error);
  };

  const handleFallbackToPIN = () => {
    console.log('🔢 Falling back to PIN...');
    setShowPINFallback(true);
  };

  const handleReset = () => {
    setEmbedding(null);
    setConfidence(0);
    setScanComplete(false);
    setShowPINFallback(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-8">
      {/* Back button */}
      <button
        onClick={() => window.history.back()}
        className="fixed top-6 left-6 z-50 p-3 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 hover:bg-white/20 transition-colors"
      >
        <ArrowLeft className="w-5 h-5 text-white" />
      </button>

      <div className="max-w-2xl w-full">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl font-bold text-white mb-2">
            Face Scanner Test 🔬
          </h1>
          <p className="text-white/60">
            Phase 1: Verifying camera access and face detection
          </p>
        </motion.div>

        {/* Scanner Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/20 shadow-2xl shadow-purple-500/20 p-8"
        >
          {!scanComplete && !showPINFallback ? (
            <div className="h-[500px]">
              <FaceScanner
                onScanComplete={handleScanComplete}
                onError={handleError}
                onFallbackToPIN={handleFallbackToPIN}
              />
            </div>
          ) : showPINFallback ? (
            <div className="h-[500px] flex flex-col items-center justify-center gap-4">
              <div className="text-6xl">🔢</div>
              <h2 className="text-2xl font-bold text-white">PIN Fallback</h2>
              <p className="text-white/60 text-center">
                Face recognition not available. Would show PIN pad here.
              </p>
              <button
                onClick={handleReset}
                className="px-6 py-3 bg-purple-500 hover:bg-purple-600 rounded-xl text-white font-medium transition-colors"
              >
                Try Face Scan Again
              </button>
            </div>
          ) : (
            <div className="h-[500px] flex flex-col items-center justify-center gap-6">
              <div className="text-6xl">✅</div>
              <h2 className="text-2xl font-bold text-white">Scan Complete!</h2>

              {/* Results */}
              <div className="w-full space-y-4">
                <div className="p-4 bg-black/30 rounded-xl border border-green-500/30">
                  <p className="text-sm text-white/60 mb-1">Embedding Dimensions</p>
                  <p className="text-2xl font-bold text-green-400">
                    {embedding?.length || 0}
                  </p>
                </div>

                <div className="p-4 bg-black/30 rounded-xl border border-blue-500/30">
                  <p className="text-sm text-white/60 mb-1">Confidence Score</p>
                  <p className="text-2xl font-bold text-blue-400">
                    {confidence.toFixed(2)}%
                  </p>
                </div>

                {embedding && (
                  <div className="p-4 bg-black/30 rounded-xl border border-purple-500/30 max-h-40 overflow-auto">
                    <p className="text-sm text-white/60 mb-2">Embedding Sample (first 20 values)</p>
                    <code className="text-xs text-purple-300 font-mono">
                      {Array.from(embedding.slice(0, 20))
                        .map(v => v.toFixed(4))
                        .join(', ')}
                      ...
                    </code>
                  </div>
                )}
              </div>

              <button
                onClick={handleReset}
                className="px-6 py-3 bg-purple-500 hover:bg-purple-600 rounded-xl text-white font-medium transition-colors"
              >
                Scan Again
              </button>
            </div>
          )}
        </motion.div>

        {/* Info panel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-6 p-6 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10"
        >
          <h3 className="text-lg font-bold text-white mb-3">Test Checklist:</h3>
          <ul className="space-y-2 text-sm text-white/70">
            <li className="flex items-center gap-2">
              <span className={embedding ? 'text-green-400' : 'text-white/40'}>
                {embedding ? '✅' : '⏳'}
              </span>
              Camera opens without errors
            </li>
            <li className="flex items-center gap-2">
              <span className={embedding ? 'text-green-400' : 'text-white/40'}>
                {embedding ? '✅' : '⏳'}
              </span>
              Face detected with scanning ring
            </li>
            <li className="flex items-center gap-2">
              <span className={embedding?.length === 128 ? 'text-green-400' : 'text-white/40'}>
                {embedding?.length === 128 ? '✅' : '⏳'}
              </span>
              128-dimension embedding extracted
            </li>
            <li className="flex items-center gap-2">
              <span className={scanComplete ? 'text-green-400' : 'text-white/40'}>
                {scanComplete ? '✅' : '⏳'}
              </span>
              Success animation plays
            </li>
          </ul>

          <div className="mt-4 pt-4 border-t border-white/10">
            <p className="text-xs text-white/50">
              ⚠️ Note: face-api.js produces 128-dim embeddings by default, not 512-dim.
              We'll need to adjust the database schema or use a different model for 512-dim.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default FaceScannerTest;
