// @ts-nocheck
/**
 * QuickFaceLog - Ultra-lightweight biometric verification for POS orders
 *
 * Zero-friction cashier identification:
 * - Single 1-2 frame scan
 * - Non-intrusive background capture
 * - Instant embedding extraction
 * - No UI disruption for customer
 */

import React, { useRef, useEffect, useState } from 'react';
import Webcam from 'react-webcam';
import * as faceapi from 'face-api.js';

interface QuickFaceLogProps {
    onCapture: (embedding: Float32Array, confidence: number) => void;
    onError: (error: string) => void;
    autoStart?: boolean;
}

export const QuickFaceLog: React.FC<QuickFaceLogProps> = ({
    onCapture,
    onError,
    autoStart = true
}) => {
    const webcamRef = useRef<Webcam>(null);
    const [modelsLoaded, setModelsLoaded] = useState(false);
    const [isCapturing, setIsCapturing] = useState(false);
    const captureAttempts = useRef(0);
    const MAX_ATTEMPTS = 3; // Only try 3 times (1-2 seconds total)

    // Load face-api.js models (minimal set for speed)
    useEffect(() => {
        const loadModels = async () => {
            try {
                const MODEL_URL = '/models'; // face-api.js models in public/models
                await Promise.all([
                    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL), // Fastest detector
                    faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL), // Tiny landmarks
                    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL) // 128-dim embeddings
                ]);
                setModelsLoaded(true);
                console.log('✅ QuickFaceLog models loaded');
            } catch (err) {
                console.error('QuickFaceLog model loading error:', err);
                onError('Failed to load face detection models');
            }
        };

        loadModels();
    }, [onError]);

    // Start capture when models loaded and autoStart enabled
    useEffect(() => {
        if (modelsLoaded && autoStart && !isCapturing) {
            startQuickScan();
        }
    }, [modelsLoaded, autoStart]);

    const startQuickScan = async () => {
        if (!webcamRef.current || isCapturing) return;

        setIsCapturing(true);
        captureAttempts.current = 0;

        // Try to capture every 500ms (fast interval)
        const interval = setInterval(async () => {
            if (captureAttempts.current >= MAX_ATTEMPTS) {
                clearInterval(interval);
                setIsCapturing(false);
                onError('No face detected in quick scan');
                return;
            }

            captureAttempts.current++;
            await attemptCapture();

        }, 500); // 500ms between attempts

        // Cleanup after max time (2 seconds)
        setTimeout(() => {
            clearInterval(interval);
            if (isCapturing) {
                setIsCapturing(false);
                onError('Quick scan timeout');
            }
        }, 2000);
    };

    const attemptCapture = async () => {
        if (!webcamRef.current) return;

        try {
            const imageSrc = webcamRef.current.getScreenshot();
            if (!imageSrc) return;

            const img = await faceapi.fetchImage(imageSrc);

            // Use TinyFaceDetector for speed
            const detection = await faceapi
                .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({
                    inputSize: 224, // Smaller = faster
                    scoreThreshold: 0.3 // Lower threshold for speed
                }))
                .withFaceLandmarks(true) // Tiny landmarks
                .withFaceDescriptor(); // 128-dim embedding

            if (detection && detection.descriptor) {
                const confidence = detection.detection.score;
                console.log('✅ Quick face captured:', { confidence, attempt: captureAttempts.current });

                // Success! Return embedding immediately
                setIsCapturing(false);
                onCapture(detection.descriptor, confidence);
            }

        } catch (err) {
            console.error('QuickFaceLog capture error:', err);
        }
    };

    // Minimal UI - hidden or tiny indicator
    return (
        <div className="fixed bottom-4 right-4 z-50">
            {/* Hidden webcam (still captures) */}
            <div className="w-1 h-1 opacity-0 overflow-hidden">
                <Webcam
                    ref={webcamRef}
                    audio={false}
                    screenshotFormat="image/jpeg"
                    videoConstraints={{
                        width: 640,
                        height: 480,
                        facingMode: 'user'
                    }}
                    className="w-full h-full"
                />
            </div>

            {/* Biometric Active Indicator (only when capturing) */}
            {isCapturing && (
                <div className="flex items-center gap-2 bg-slate-900/90 backdrop-blur-xl
                              border border-cyan-400/30 rounded-full px-3 py-1.5 shadow-lg">
                    <div className="relative w-2 h-2">
                        {/* Pulsing cyan dot */}
                        <div className="absolute inset-0 bg-cyan-400 rounded-full animate-ping opacity-75" />
                        <div className="relative w-2 h-2 bg-cyan-500 rounded-full" />
                    </div>
                    <span className="text-xs text-cyan-400 font-medium">Biometric Active</span>
                </div>
            )}
        </div>
    );
};

export default QuickFaceLog;
