// @ts-nocheck
/**
 * FaceScannerCompact - Compact Face Recognition
 *
 * Designed to fit inside Maya's 400px window
 * Webcam: 200x200px (instead of 280x280)
 * Compact UI with minimal text
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Webcam from 'react-webcam';
import * as faceapi from 'face-api.js';
import { Camera, CheckCircle, Loader2, AlertCircle } from 'lucide-react';

interface FaceScannerCompactProps {
  onScanComplete: (embedding: Float32Array, confidence: number) => void;
  onError?: (error: string) => void;
  onSwitchToPIN?: () => void;
}

export const FaceScannerCompact: React.FC<FaceScannerCompactProps> = ({
  onScanComplete,
  onError,
  onSwitchToPIN
}) => {
  const webcamRef = useRef<Webcam>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [embeddings, setEmbeddings] = useState<Float32Array[]>([]);
  const [faceDetected, setFaceDetected] = useState(false);
  const [detectionScore, setDetectionScore] = useState(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'scanning' | 'success' | 'error'>('loading');
  const scanIntervalRef = useRef<number | null>(null);

  const FRAMES_TO_CAPTURE = 2;
  const SCAN_INTERVAL = 200;
  const MIN_CONFIDENCE = 0.5;

  // Load models
  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL)
        ]);
        setModelsLoaded(true);
        setStatus('ready');
        setScanning(true);
      } catch (err) {
        console.error('Model loading failed:', err);
        setStatus('error');
        onError?.('Failed to load face recognition');
      }
    };

    loadModels();
  }, [onError]);

  // Scan for faces
  useEffect(() => {
    if (!modelsLoaded || !scanning || status === 'success') {
      return;
    }

    setStatus('scanning');

    const detectFace = async () => {
      const webcam = webcamRef.current;
      if (!webcam?.video) return;

      const video = webcam.video;
      if (video.readyState !== 4) return;

      try {
        const detections = await faceapi
          .detectSingleFace(video, new faceapi.SsdMobilenetv1Options({ minConfidence: MIN_CONFIDENCE }))
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (detections) {
          const descriptor = detections.descriptor;
          const faceConfidence = detections.detection.score;

          setFaceDetected(true);
          setDetectionScore(faceConfidence);

          setEmbeddings(prev => {
            const newEmbeddings = [...prev, descriptor];

            if (newEmbeddings.length >= FRAMES_TO_CAPTURE) {
              const avgEmbedding = averageEmbeddings(newEmbeddings);
              handleSuccess(avgEmbedding, faceConfidence);
            }

            return newEmbeddings;
          });
        } else {
          setFaceDetected(false);
          setDetectionScore(0);
        }
      } catch (err) {
        console.error('Face detection error:', err);
      }
    };

    scanIntervalRef.current = window.setInterval(detectFace, SCAN_INTERVAL);

    return () => {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
      }
    };
  }, [modelsLoaded, scanning, status]);

  const averageEmbeddings = (embeddings: Float32Array[]): Float32Array => {
    const avgArray = new Float32Array(128);
    for (let i = 0; i < 128; i++) {
      let sum = 0;
      for (const emb of embeddings) {
        sum += emb[i];
      }
      avgArray[i] = sum / embeddings.length;
    }
    return avgArray;
  };

  const handleSuccess = (embedding: Float32Array, confidence: number) => {
    console.log('✅ Face scan complete (compact):', {
      dimensions: embedding.length,
      confidence: (confidence * 100).toFixed(0) + '%'
    });

    setScanning(false);
    setStatus('success');

    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
    }

    onScanComplete(embedding, confidence);
  };

  return (
    <div className="flex flex-col items-center justify-center p-4 space-y-4">
      <AnimatePresence mode="wait">
        {/* Loading State */}
        {status === 'loading' && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-3"
          >
            <Loader2 className="w-10 h-10 text-cyan-400 animate-spin" />
            <p className="text-white/70 text-sm">טוען מודלים...</p>
          </motion.div>
        )}

        {/* Scanning State */}
        {(status === 'ready' || status === 'scanning') && (
          <motion.div
            key="scanning"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            className="flex flex-col items-center gap-4 w-full"
          >
            {/* Title */}
            <h3 className="text-base font-bold text-white">התמקם מול המצלמה</h3>

            {/* Webcam with Ring */}
            <div className="relative">
              {/* Animated Ring */}
              <motion.div
                animate={{
                  scale: faceDetected ? [1, 1.05, 1] : 1,
                  opacity: faceDetected ? 1 : 0.5
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: 'easeInOut'
                }}
                className="absolute inset-0 w-52 h-52"
              >
                <div className={`
                  absolute inset-0 rounded-full
                  ${faceDetected ? 'border-cyan-400' : 'border-cyan-400/30'}
                  border-4 shadow-lg shadow-cyan-500/50
                `} />
              </motion.div>

              {/* Webcam - 200x200 */}
              <div className="relative w-48 h-48 rounded-full overflow-hidden border-4 border-white/10">
                <Webcam
                  ref={webcamRef}
                  audio={false}
                  mirrored={true}
                  screenshotFormat="image/jpeg"
                  videoConstraints={{
                    facingMode: 'user',
                    width: 640,
                    height: 480
                  }}
                  className="w-full h-full object-cover"
                />

                {/* Green border on detection */}
                {faceDetected && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute inset-0 border-4 border-green-400 rounded-full"
                  />
                )}
              </div>

              {/* Confidence Badge */}
              {detectionScore > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute -bottom-6 left-1/2 -translate-x-1/2
                             bg-cyan-400/20 backdrop-blur-sm px-3 py-1 rounded-full
                             border border-cyan-400/30"
                >
                  <span className="text-cyan-400 font-bold text-xs">
                    {(detectionScore * 100).toFixed(0)}%
                  </span>
                </motion.div>
              )}
            </div>

            {/* Progress Text */}
            <p className="text-white/60 text-xs">
              {embeddings.length > 0 ? `צילום ${embeddings.length}/${FRAMES_TO_CAPTURE}...` : 'מחפש פנים...'}
            </p>
          </motion.div>
        )}

        {/* Success State */}
        {status === 'success' && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.2 }}
            className="flex flex-col items-center gap-3"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 0.6 }}
            >
              <CheckCircle className="w-16 h-16 text-green-400" />
            </motion.div>
            <h3 className="text-lg font-bold text-white">זוהה בהצלחה! ✓</h3>
            <p className="text-white/60 text-xs">
              {(detectionScore * 100).toFixed(0)}% דיוק
            </p>
          </motion.div>
        )}

        {/* Error State */}
        {status === 'error' && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-3"
          >
            <AlertCircle className="w-12 h-12 text-red-400" />
            <h3 className="text-base font-bold text-white">שגיאה</h3>
            <p className="text-red-400 text-xs">לא ניתן לטעון זיהוי פנים</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Switch to PIN */}
      {onSwitchToPIN && status !== 'success' && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          onClick={onSwitchToPIN}
          className="mt-2 text-white/50 hover:text-white/80 text-xs font-medium transition"
        >
          או השתמש ב-PIN
        </motion.button>
      )}
    </div>
  );
};

export default FaceScannerCompact;
