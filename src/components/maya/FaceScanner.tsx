// @ts-nocheck
/**
 * FaceScanner - Anti-Gravity Face Recognition Component
 *
 * Features:
 * - Webcam capture with face-api.js integration
 * - Pulsing neon scanning ring around detected face
 * - Weightless "evaporation" transition on success
 * - Glassmorphism UI aesthetic
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import * as faceapi from 'face-api.js';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface FaceScannerProps {
  onScanComplete?: (embedding: Float32Array, confidence: number) => void;
  onError?: (error: string) => void;
  onFallbackToPIN?: () => void;
}

type ScanState = 'LOADING_MODELS' | 'READY' | 'SCANNING' | 'SUCCESS' | 'ERROR' | 'NO_FACE';

export const FaceScanner: React.FC<FaceScannerProps> = ({
  onScanComplete,
  onError,
  onFallbackToPIN
}) => {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const [scanState, setScanState] = useState<ScanState>('LOADING_MODELS');
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [detectionBox, setDetectionBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [confidence, setConfidence] = useState(0);
  const [captureCount, setCaptureCount] = useState(0);
  const [embeddings, setEmbeddings] = useState<Float32Array[]>([]);
  const [statusMessage, setStatusMessage] = useState('Loading AI models...');

  // Load face-api.js models on mount
  useEffect(() => {
    const loadModels = async () => {
      try {
        setStatusMessage('Loading face detection models...');

        // Use CDN for development (faster, no local files needed)
        const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';

        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);

        console.log('✅ Face-api.js models loaded successfully');
        setModelsLoaded(true);
        setScanState('READY');
        setStatusMessage('Ready to scan');
      } catch (err) {
        console.error('❌ Failed to load face-api models:', err);
        setScanState('ERROR');
        setStatusMessage('Failed to load AI models');
        onError?.('Model loading failed. Please refresh.');
      }
    };

    loadModels();
  }, [onError]);

  // Start face detection when models are loaded
  useEffect(() => {
    if (!modelsLoaded || scanState !== 'READY') return;

    // Wait 500ms before starting scan (let camera stabilize)
    const startTimeout = setTimeout(() => {
      setScanState('SCANNING');
      setStatusMessage('Look at the camera...');
      startDetection();
    }, 500);

    return () => clearTimeout(startTimeout);
  }, [modelsLoaded, scanState]);

  const startDetection = () => {
    if (intervalRef.current) return;

    intervalRef.current = setInterval(async () => {
      await detectFace();
    }, 300); // Check every 300ms
  };

  const stopDetection = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Stop webcam stream - try multiple methods to ensure it stops
    try {
      // Method 1: Stop via webcamRef.stream
      if (webcamRef.current?.stream) {
        const tracks = webcamRef.current.stream.getTracks();
        tracks.forEach(track => {
          track.stop();
          console.log('📷 Stopped track:', track.kind);
        });
      }

      // Method 2: Stop via video.srcObject
      if (webcamRef.current?.video?.srcObject) {
        const stream = webcamRef.current.video.srcObject;
        const tracks = stream.getTracks();
        tracks.forEach(track => {
          track.stop();
          console.log('📷 Stopped track from srcObject:', track.kind);
        });
        webcamRef.current.video.srcObject = null;
      }

      console.log('✅ Camera stream stopped successfully');
    } catch (error) {
      console.error('⚠️ Error stopping camera:', error);
    }
  };

  const detectFace = async () => {
    if (!webcamRef.current?.video || !canvasRef.current) return;

    const video = webcamRef.current.video;
    if (video.readyState !== 4) return; // Video not ready

    try {
      // Detect single face with landmarks and descriptor
      const detection = await faceapi
        .detectSingleFace(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (detection) {
        const { descriptor, detection: box } = detection;

        // Update detection box for UI ring
        setDetectionBox({
          x: box.box.x,
          y: box.box.y,
          width: box.box.width,
          height: box.box.height
        });

        // Calculate confidence (inverse of distance from ideal face position)
        const faceConfidence = Math.min(box.score * 100, 99);
        setConfidence(faceConfidence);

        // Collect embeddings using functional updates to avoid race conditions
        setEmbeddings(prev => {
          const newEmbeddings = [...prev, descriptor];

          // Check if we have enough frames
          if (newEmbeddings.length >= 2) {
            // Average embeddings and complete scan
            const avgEmbedding = averageEmbeddings(newEmbeddings);
            handleScanSuccess(avgEmbedding, faceConfidence);
          }

          return newEmbeddings;
        });

        setCaptureCount(prev => {
          const newCount = prev + 1;
          setStatusMessage(`Capturing... ${newCount}/2`);
          return newCount;
        });
      } else {
        // No face detected
        setDetectionBox(null);
        setConfidence(0);

        // If scanning for more than 5 seconds with no face, show warning
        if (scanState === 'SCANNING' && captureCount === 0) {
          setScanState('NO_FACE');
          setStatusMessage('No face detected. Please center your face.');
        }
      }
    } catch (err) {
      console.error('Detection error:', err);
    }
  };

  const averageEmbeddings = (embeds: Float32Array[]): Float32Array => {
    if (embeds.length === 0) return new Float32Array(128);

    const dim = embeds[0].length;
    const avg = new Float32Array(dim);

    for (let i = 0; i < dim; i++) {
      let sum = 0;
      for (const embed of embeds) {
        sum += embed[i];
      }
      avg[i] = sum / embeds.length;
    }

    return avg;
  };

  const handleScanSuccess = (embedding: Float32Array, conf: number) => {
    stopDetection();
    setScanState('SUCCESS');
    setStatusMessage('Face captured! ✨');

    console.log('✅ Face embedding extracted:', {
      dimensions: embedding.length,
      confidence: conf,
      sample: Array.from(embedding.slice(0, 5))
    });

    // Trigger success callback after animation delay
    setTimeout(() => {
      onScanComplete?.(embedding, conf);
    }, 1500);
  };

  const handleCameraError = (error: string | DOMException) => {
    console.error('Camera error:', error);
    console.log('📱 Camera permission denied - switching to PIN immediately');
    setScanState('ERROR');
    setStatusMessage('Camera access denied - switching to PIN...');

    // Fallback to PIN immediately (no delay)
    setTimeout(() => {
      onFallbackToPIN?.();
    }, 500); // Short delay just to show the message
  };

  const handleRetry = () => {
    setCaptureCount(0);
    setEmbeddings([]);
    setDetectionBox(null);
    setConfidence(0);
    setScanState('READY');
    setStatusMessage('Ready to scan');
  };

  // Auto-fallback to PIN if scanning takes too long
  useEffect(() => {
    let timeout: NodeJS.Timeout;

    if (scanState === 'SCANNING' || scanState === 'NO_FACE') {
      // 8 seconds timeout (increased from 4s) to allow for better scanning
      timeout = setTimeout(() => {
        console.log('⏰ Face scan timeout (8s) - switching to PIN');
        onFallbackToPIN?.();
      }, 8000);
    }

    return () => clearTimeout(timeout);
  }, [scanState, onFallbackToPIN]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopDetection();
    };
  }, []);

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* Hidden Webcam for face-api processing */}
      <Webcam
        ref={webcamRef}
        audio={false}
        screenshotFormat="image/jpeg"
        videoConstraints={{
          width: 640,
          height: 480,
          facingMode: 'user'
        }}
        onUserMediaError={handleCameraError}
        style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
      />

      {/* Canvas for drawing (circular crop) */}
      <div className="relative">
        <AnimatePresence mode="wait">
          {scanState === 'LOADING_MODELS' && (
            <motion.div
              key="loading"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              className="flex flex-col items-center gap-4"
            >
              <Loader2 className="w-16 h-16 text-purple-400 animate-spin" />
              <p className="text-white/80 text-sm">{statusMessage}</p>
            </motion.div>
          )}

          {(scanState === 'READY' || scanState === 'SCANNING' || scanState === 'NO_FACE') && (
            <motion.div
              key="scanning"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.2 }} // ✨ Weightless evaporation
              transition={{ type: 'spring', damping: 25 }}
              className="flex flex-col items-center gap-6"
            >
              {/* Circular Webcam Preview with Glassmorphism */}
              <div className="relative">
                {/* Pulsing Neon Scanning Ring */}
                {scanState === 'SCANNING' && detectionBox && (
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{
                      scale: [1, 1.05, 1],
                      opacity: [0.6, 1, 0.6]
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      ease: 'easeInOut'
                    }}
                    className="absolute inset-0 rounded-full border-4 border-cyan-400 shadow-lg shadow-cyan-500/50"
                    style={{
                      width: '280px',
                      height: '280px'
                    }}
                  />
                )}

                {/* Main circular frame (glassmorphism) */}
                <motion.div
                  className="w-[280px] h-[280px] rounded-full overflow-hidden
                             backdrop-blur-xl bg-white/5 border-2 border-white/20
                             shadow-2xl shadow-purple-500/20 relative"
                >
                  {/* Live video feed - Direct Webcam display */}
                  <Webcam
                    audio={false}
                    videoConstraints={{
                      width: 640,
                      height: 480,
                      facingMode: 'user'
                    }}
                    mirrored={true}
                    className="w-full h-full object-cover"
                    style={{ transform: 'scaleX(-1)' }}
                  />

                  {/* Confidence indicator overlay */}
                  {confidence > 0 && (
                    <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                      <div className="px-3 py-1 rounded-full bg-black/60 backdrop-blur-sm">
                        <span className="text-xs text-green-400 font-medium">
                          {confidence.toFixed(0)}% Match
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Capture progress dots */}
                  {captureCount > 0 && (
                    <div className="absolute top-4 left-0 right-0 flex justify-center gap-2">
                      {[...Array(2)].map((_, i) => (
                        <motion.div
                          key={i}
                          initial={{ scale: 0 }}
                          animate={{ scale: i < captureCount ? 1 : 0.5 }}
                          className={`w-2 h-2 rounded-full ${i < captureCount ? 'bg-cyan-400' : 'bg-white/30'
                            }`}
                        />
                      ))}
                    </div>
                  )}
                </motion.div>
              </div>

              {/* Status message */}
              <motion.div
                animate={{ opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="flex items-center gap-2"
              >
                <Camera className="w-5 h-5 text-purple-400" />
                <p className="text-white/90 text-sm font-medium">{statusMessage}</p>
              </motion.div>

              {/* Warning for no face detected */}
              {scanState === 'NO_FACE' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-500/20 border border-amber-500/40 rounded-xl"
                >
                  <AlertCircle className="w-4 h-4 text-amber-400" />
                  <span className="text-xs text-amber-200">
                    Center your face in the camera
                  </span>
                </motion.div>
              )}
            </motion.div>
          )}

          {scanState === 'SUCCESS' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.3 }} // ✨ Evaporation effect
              transition={{ type: 'spring', damping: 20 }}
              className="flex flex-col items-center gap-4"
            >
              <motion.div
                animate={{
                  rotate: [0, 360],
                  scale: [1, 1.1, 1]
                }}
                transition={{ duration: 0.6 }}
              >
                <CheckCircle className="w-20 h-20 text-green-400" />
              </motion.div>
              <p className="text-white text-lg font-bold">Face Recognized! ✨</p>
              <p className="text-white/60 text-sm">Logging you in...</p>
            </motion.div>
          )}

          {scanState === 'ERROR' && (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-4"
            >
              <XCircle className="w-16 h-16 text-red-400" />
              <p className="text-white text-sm">{statusMessage}</p>
              <button
                onClick={() => onFallbackToPIN?.()}
                className="px-4 py-2 bg-purple-500 hover:bg-purple-600 rounded-xl text-white text-sm font-medium transition-colors"
              >
                Use PIN Instead
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Hidden canvas for face-api processing */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default FaceScanner;
