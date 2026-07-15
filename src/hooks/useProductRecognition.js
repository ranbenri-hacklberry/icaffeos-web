import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

// ── Constants ──────────────────────────────────────────────────────────────
const EDGE_NODE_HOST = import.meta.env?.DEV
  ? `${window.location.origin}/edge-node`
  : (import.meta.env?.VITE_EDGE_NODE_URL || `http://${window.location.hostname}:8090`);
const AUTONOMOUS_THRESHOLD = 0.92;
const MOTION_SETTLE_MS = 100;        // settle fast — 100ms of calm → trigger
const MOTION_CHECK_FPS = 8;
const MOTION_PIXEL_THRESHOLD = 50;   // per-pixel delta (higher = ignore camera sway)
const MOTION_FRAME_THRESHOLD = 0.15; // 15% of ROI pixels must change → "motion"

/**
 * useProductRecognition — the BRAIN of the AI product recognition pipeline.
 *
 * Responsibilities:
 *  1. Motion detection via hidden canvas (200×200 grayscale diff)
 *  2. State machine: idle → motion → settling → stable → TRIGGER INFERENCE
 *  3. Capture 512×512 WebP frame, POST to Edge Node /match
 *  4. Route result through 3-stage router
 *  5. Provide fire-and-forget confirmAndLearn for active learning
 */
export function useProductRecognition(businessId) {
  // ── State ──────────────────────────────────────────────────────────────
  const [cameraActive, setCameraActive] = useState(false);
  const [motionState, setMotionState] = useState('idle'); // 'idle' | 'motion' | 'settling' | 'stable'
  const [lastMatch, setLastMatch] = useState(null);
  const [inferenceStage, setInferenceStage] = useState('idle'); // 'idle' | 'scanning' | 'matched' | 'confirming'
  const [isInferring, setIsInferring] = useState(false);

  // ── Refs ────────────────────────────────────────────────────────────────
  const motionCanvasRef = useRef(null);
  const previousFrameRef = useRef(null);
  const motionTimerRef = useRef(null);
  const settleTimerRef = useRef(null);
  const menuItemsRef = useRef([]);
  const capturedBlobRef = useRef(null);
  const isInferringRef = useRef(false); // sync guard
  const latestSnapshotRef = useRef(null); // latest snapshot ImageBitmap
  const cooldownUntilRef = useRef(0); // timestamp: don't infer until after this
  const businessIdRef = useRef(businessId);
  businessIdRef.current = businessId; // always keep current
  const motionStartRef = useRef(null); // timestamp: when continuous motion started (for auto-scan)

  const setMenuItems = useCallback((items) => {
    menuItemsRef.current = items;
  }, []);

  // ══════════════════════════════════════════════════════════════════════
  //  MOTION DETECTION — the "Gatekeeper"
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Fetch a snapshot from the Edge Node server camera,
   * draw it on a hidden canvas, and compute motion fraction.
   */
  const computeMotionFraction = useCallback(async () => {
    const canvas = motionCanvasRef.current;
    if (!canvas) return 0;

    try {
      const res = await fetch(`${EDGE_NODE_HOST}/camera/snapshot`);
      if (!res.ok) return 0;
      const blob = await res.blob();
      const bmp = await createImageBitmap(blob);
      latestSnapshotRef.current = blob; // keep for inference

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const W = 200;
      const H = 200;
      canvas.width = W;
      canvas.height = H;

      ctx.drawImage(bmp, 0, 0, W, H);
      bmp.close();
      const currentData = ctx.getImageData(0, 0, W, H).data;

      const currentGray = new Uint8Array(W * H);
      for (let i = 0; i < W * H; i++) {
        const r = currentData[i * 4];
        const g = currentData[i * 4 + 1];
        const b = currentData[i * 4 + 2];
        currentGray[i] = (r * 77 + g * 150 + b * 29) >> 8;
      }

      if (!previousFrameRef.current) {
        previousFrameRef.current = currentGray;
        return 0;
      }

      const roiStart = Math.floor(W * 0.2);
      const roiEnd = Math.floor(W * 0.8);
      let changedPixels = 0;
      let totalROI = 0;

      for (let y = roiStart; y < roiEnd; y++) {
        for (let x = roiStart; x < roiEnd; x++) {
          const idx = y * W + x;
          const delta = Math.abs(currentGray[idx] - previousFrameRef.current[idx]);
          if (delta > MOTION_PIXEL_THRESHOLD) changedPixels++;
          totalROI++;
        }
      }

      previousFrameRef.current = currentGray;
      return totalROI > 0 ? changedPixels / totalROI : 0;
    } catch (e) {
      return 0;
    }
  }, []);

  /**
   * Single tick of the motion detection FSM.
   */
  const motionTick = useCallback(async () => {
    const fraction = await computeMotionFraction();
    const hasMotion = fraction >= MOTION_FRAME_THRESHOLD;

    setMotionState((prev) => {
      if (hasMotion) {
        // Any motion → reset to 'motion', clear settle timer
        if (settleTimerRef.current) {
          clearTimeout(settleTimerRef.current);
          settleTimerRef.current = null;
        }

        // AUTO-SCAN: if stuck in motion for >2s (swaying camera), force inference
        if (prev === 'motion') {
          if (!motionStartRef.current) motionStartRef.current = Date.now();
          if (Date.now() - motionStartRef.current > 2000) {
            motionStartRef.current = null; // reset
            // Force inference via setTimeout to avoid setMotionState inside setMotionState
            setTimeout(() => {
              setMotionState('stable');
              triggerInference();
            }, 0);
            return 'settling'; // brief settling state before stable
          }
        } else {
          motionStartRef.current = Date.now(); // first motion frame
        }

        return 'motion';
      }

      // No motion detected this tick
      motionStartRef.current = null; // reset motion timer

      if (prev === 'motion') {
        // Start settling countdown
        settleTimerRef.current = setTimeout(() => {
          setMotionState('stable');
          triggerInference();
        }, MOTION_SETTLE_MS);
        return 'settling';
      }

      if (prev === 'settling') {
        // Timer already running — stay in settling
        return 'settling';
      }

      // idle or stable — stay
      return prev;
    });
  }, [computeMotionFraction]);

  // ── Start / Stop motion detection ──────────────────────────────────────
  const startMotionDetection = useCallback(() => {
    if (motionTimerRef.current) return; // already running
    previousFrameRef.current = null;
    setMotionState('idle');
    setLastMatch(null);
    motionTimerRef.current = setInterval(motionTick, 1000 / MOTION_CHECK_FPS);
  }, [motionTick]);

  const stopMotionDetection = useCallback(() => {
    if (motionTimerRef.current) {
      clearInterval(motionTimerRef.current);
      motionTimerRef.current = null;
    }
    if (settleTimerRef.current) {
      clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
    previousFrameRef.current = null;
    setMotionState('idle');
  }, []);

  // Auto start/stop when camera toggles
  useEffect(() => {
    if (cameraActive) {
      // small delay for webcam to initialize
      const t = setTimeout(() => startMotionDetection(), 800);
      return () => clearTimeout(t);
    } else {
      stopMotionDetection();
    }
  }, [cameraActive, startMotionDetection, stopMotionDetection]);

  // PERIODIC AUTO-SCAN: every 5s, if idle/motion and no inference running, force a scan.
  // Handles: product already there, swaying camera, no detectable motion.
  useEffect(() => {
    if (!cameraActive) return;

    const autoScan = setInterval(() => {
      // Only auto-scan if not already inferring and no cooldown
      if (isInferringRef.current) return;
      if (Date.now() < cooldownUntilRef.current) return;

      console.log('🔄 [Auto-Scan] Periodic scan triggered');
      triggerInference();
    }, 5000); // every 5 seconds

    return () => clearInterval(autoScan);
  }, [cameraActive]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMotionDetection();
    };
  }, [stopMotionDetection]);

  // ══════════════════════════════════════════════════════════════════════
  //  INFERENCE — capture + call Edge Node /match
  // ══════════════════════════════════════════════════════════════════════

  const triggerInference = useCallback(async () => {
    if (isInferringRef.current) return; // prevent overlapping calls
    if (Date.now() < cooldownUntilRef.current) {
      // Still in cooldown after a no-match — reset to idle silently
      setMotionState('idle');
      setInferenceStage('idle');
      return;
    }

    isInferringRef.current = true;
    setIsInferring(true);
    setInferenceStage('scanning');

    try {
      // Always fetch a FRESH snapshot from the Edge Node camera
      const res = await fetch(`${EDGE_NODE_HOST}/camera/snapshot`, { cache: 'no-store' });
      if (!res.ok) { console.warn('📷 Failed to capture snapshot'); return; }
      const rawBlob = await res.blob();

      // Apply 1.8x center-crop zoom (same as training) to focus on the product
      const RECOGNITION_ZOOM = 1.8;
      let blob = rawBlob;
      try {
        const bmp = await createImageBitmap(rawBlob);
        const cropW = Math.round(bmp.width / RECOGNITION_ZOOM);
        const cropH = Math.round(bmp.height / RECOGNITION_ZOOM);
        const cropX = Math.round((bmp.width - cropW) / 2);
        const cropY = Math.round((bmp.height - cropH) / 2);
        const offscreen = new OffscreenCanvas(cropW, cropH);
        offscreen.getContext('2d').drawImage(bmp, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
        blob = await offscreen.convertToBlob({ type: 'image/webp', quality: 0.85 });
        bmp.close();
      } catch (e) {
        console.warn('📷 Zoom crop failed, using raw image:', e.message);
      }
      capturedBlobRef.current = blob;

      // Build FormData for Edge Node
      const formData = new FormData();
      formData.append('file', blob, 'capture.webp');
      formData.append('business_id', businessIdRef.current || menuItemsRef.current[0]?.business_id || '');

      // POST to /match
      const response = await fetch(`${EDGE_NODE_HOST}/match`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        console.error('🤖 Edge Node /match error:', response.status);
        return;
      }

      const result = await response.json();
      console.log('🤖 Inference result:', result);

      // Route through 3-stage router
      console.log('🤖 menuItemsRef has', menuItemsRef.current?.length, 'items');
      let routed = routeInferenceResult(result, menuItemsRef.current);
      console.log('🤖 Router returned:', routed.action, routed.item?.name || 'no item');

      // FALLBACK: If router returned 'none' because menuItemsRef is empty,
      // construct match directly from edge node response
      if (routed.action === 'none' && result?.matches?.length > 0) {
        const best = result.matches[0];
        const second = result.matches.length > 1 ? result.matches[1] : null;
        const fallbackMargin = second ? best.confidence_score - second.confidence_score : 1.0;

        if (best.confidence_score >= 0.90 && fallbackMargin >= 0.03 && best.product_name) {
          console.log('🤖 Fallback: using edge node match data directly for', best.product_name, `margin=${(fallbackMargin*100).toFixed(1)}%`);
          const fallbackItem = {
            id: best.matched_product_id,
            name: best.product_name,
            price: best.product_price || 0,
            category: best.product_category || '',
          };
          routed = {
            action: best.existing_vector_count >= 10 && best.confidence_score >= AUTONOMOUS_THRESHOLD
              ? 'auto_add' : 'confirm',
            item: fallbackItem,
            confidence: best.confidence_score,
            match: best,
          };
          console.log('🤖 Fallback router:', routed.action, routed.item.name);
        }
      }

      if (routed.action !== 'none') {
        setInferenceStage('matched');
        setLastMatch({
          ...routed,
          capturedBlob: blob,
        });
      } else {
        setInferenceStage('idle');
        // No match — cooldown 5s before trying again to avoid inference loop
        cooldownUntilRef.current = Date.now() + 5000;
        setMotionState('idle');
      }
    } catch (err) {
      console.error('🤖 Inference error:', err);
      setInferenceStage('idle');
      setMotionState('idle');
    } finally {
      isInferringRef.current = false;
      setIsInferring(false);
    }
  }, []);

  // ══════════════════════════════════════════════════════════════════════
  //  3-STAGE ROUTER
  // ══════════════════════════════════════════════════════════════════════

  function routeInferenceResult(result, menuItems) {
    if (!result?.matches || result.matches.length === 0) {
      return { action: 'none' };
    }

    const bestMatch = result.matches[0];
    const menuItem = menuItems.find(
      (m) => String(m.id) === String(bestMatch.matched_product_id)
    );

    if (!menuItem) {
      console.warn('🤖 Matched product not found in menu:', bestMatch.matched_product_id);
      return { action: 'none' };
    }

    // Stage 3: Autonomous — high confidence + enough vectors
    if (
      bestMatch.existing_vector_count >= 10 &&
      bestMatch.confidence_score >= AUTONOMOUS_THRESHOLD
    ) {
      return {
        action: 'auto_add',
        item: menuItem,
        confidence: bestMatch.confidence_score,
        match: bestMatch,
      };
    }

    // Stage 2: Active Learning — requires BOTH:
    //   1. High confidence (≥90%)
    //   2. Clear margin (≥3%) over 2nd-best match to filter noise/empty surface
    const CONFIRM_THRESHOLD = 0.90;
    const MIN_MARGIN = 0.03;
    const secondBest = result.matches.length > 1 ? result.matches[1] : null;
    const margin = secondBest
      ? bestMatch.confidence_score - secondBest.confidence_score
      : 1.0; // only one match → high margin

    if (bestMatch.confidence_score >= CONFIRM_THRESHOLD && margin >= MIN_MARGIN) {
      return {
        action: 'confirm',
        item: menuItem,
        confidence: bestMatch.confidence_score,
        match: bestMatch,
      };
    }

    if (bestMatch.confidence_score >= CONFIRM_THRESHOLD) {
      console.log(`🤖 Match rejected: margin too low (${(margin * 100).toFixed(1)}% < ${MIN_MARGIN * 100}%)`);
    }

    // Stage 1: Below threshold — no action
    return { action: 'none' };
  }

  // ══════════════════════════════════════════════════════════════════════
  //  CAPTURE & INFER — manual trigger (for external use)
  // ══════════════════════════════════════════════════════════════════════

  const captureAndInfer = useCallback(() => {
    triggerInference();
  }, [triggerInference]);

  // ══════════════════════════════════════════════════════════════════════
  //  CONFIRM & LEARN — async, fire-and-forget from caller
  // ══════════════════════════════════════════════════════════════════════

  const confirmAndLearn = useCallback(async (menuItem, capturedBlob, businessId) => {
    console.log('🧠 confirmAndLearn started for:', menuItem?.name);

    try {
      // 1. Upload image to Supabase Storage (fire-and-forget)
      const fileName = `ai-learn/${businessId}/${menuItem.id || menuItem.menu_item_id}/${Date.now()}.webp`;
      supabase.storage
        .from('menu-images')
        .upload(fileName, capturedBlob, {
          contentType: 'image/webp',
          upsert: false,
        })
        .then(({ error }) => {
          if (error) console.warn('🧠 Image upload warning (non-blocking):', error.message);
          else console.log('🧠 Learning image uploaded:', fileName);
        });

      // 2. Get embedding from Edge Node
      const embedForm = new FormData();
      embedForm.append('file', capturedBlob, 'learn.webp');

      const embedRes = await fetch(`${EDGE_NODE_HOST}/embed-image`, {
        method: 'POST',
        body: embedForm,
      });

      if (!embedRes.ok) {
        console.error('🧠 embed-image failed:', embedRes.status);
        return;
      }

      const { embedding, dimensions } = await embedRes.json();
      console.log('🧠 Got embedding, dimensions:', dimensions);

      // 3. Confirm / store vector via Edge Node
      const confirmRes = await fetch(`${EDGE_NODE_HOST}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          menu_item_id: menuItem.id || menuItem.menu_item_id,
          business_id: businessId,
          embedding,
          image_path: fileName,
        }),
      });

      if (!confirmRes.ok) {
        console.error('🧠 confirm failed:', confirmRes.status);
        return;
      }

      console.log('🧠 Vector stored successfully for:', menuItem.name);
    } catch (err) {
      console.error('🧠 confirmAndLearn error (non-blocking):', err);
    }

    // Reset motion state so camera resumes detection
    setMotionState('idle');
    setInferenceStage('idle');
    setLastMatch(null);
  }, []);

  // ══════════════════════════════════════════════════════════════════════
  //  EXPORTS
  // ══════════════════════════════════════════════════════════════════════

  return {
    // State
    cameraActive,
    setCameraActive,
    motionState,
    lastMatch,
    setLastMatch: useCallback((val) => {
      setLastMatch(val);
      if (val === null) {
        // Reset the entire detection pipeline so next product can be detected
        setMotionState('idle');
        setInferenceStage('idle');
        // Clear previous frame so the scene is re-evaluated as "new motion"
        previousFrameRef.current = null;
        // Cooldown prevents infinite re-trigger loop on the same static product
        cooldownUntilRef.current = Date.now() + 3000;
      }
    }, []),
    inferenceStage,
    isInferring,

    // Actions
    startMotionDetection,
    stopMotionDetection,
    captureAndInfer,
    confirmAndLearn,
    setMenuItems,

    // Refs (for passing to ProductCamera)
    motionCanvasRef,
    previousFrameRef,
  };
}

export default useProductRecognition;
