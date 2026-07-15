import React, { useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Camera, ScanLine } from 'lucide-react';

/**
 * ProductCamera — visual camera component for AI product recognition.
 *
 * Fixed bottom-right corner, 280×280 visible feed, hidden canvas for
 * motion detection, glassmorphism dark theme matching POS aesthetic.
 */

const MOTION_BADGE_CONFIG = {
  idle: { emoji: '👁️', label: 'מחכה...', bg: 'rgba(100,116,139,0.85)', border: 'rgba(148,163,184,0.5)' },
  motion: { emoji: '🔄', label: 'תנועה', bg: 'rgba(234,179,8,0.85)', border: 'rgba(250,204,21,0.6)' },
  settling: { emoji: '⏳', label: 'מתייצב...', bg: 'rgba(249,115,22,0.85)', border: 'rgba(251,146,60,0.6)' },
  stable: { emoji: '📸', label: 'מנתח...', bg: 'rgba(34,197,94,0.85)', border: 'rgba(74,222,128,0.6)' },
};

/**
 * CameraCanvas — polls /camera/snapshot and draws frames to canvas.
 * Works on Safari (unlike MJPEG multipart streams).
 */
const CameraCanvas = ({ isActive }) => {
  const canvasRef = useRef(null);
  const fetchingRef = useRef(false);

  useEffect(() => {
    if (!isActive) return;

    fetchingRef.current = false; // reset on activation

    const tick = async () => {
      if (fetchingRef.current) return;
      fetchingRef.current = true;
      try {
        const res = await fetch('/edge-node/camera/snapshot', { cache: 'no-store' });
        if (!res.ok) { fetchingRef.current = false; return; }
        const blob = await res.blob();
        const bmp = await createImageBitmap(blob);
        const canvas = canvasRef.current;
        if (canvas) {
          canvas.width = bmp.width;
          canvas.height = bmp.height;
          canvas.getContext('2d').drawImage(bmp, 0, 0);
        }
        bmp.close();
      } catch { /* ignore */ }
      finally { fetchingRef.current = false; }
    };

    tick();
    const id = setInterval(tick, 120); // ~8 FPS
    return () => { clearInterval(id); fetchingRef.current = false; };
  }, [isActive]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        display: 'block',
        background: '#0f172a',
      }}
    />
  );
};

const ProductCamera = ({
  motionCanvasRef,
  motionState,
  lastMatch,
  isInferring,
  isActive,
  onToggle,
}) => {
  if (!isActive) return null;

  const badge = MOTION_BADGE_CONFIG[motionState] || MOTION_BADGE_CONFIG.idle;

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 40 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 40 }}
          transition={{ type: 'spring', damping: 22, stiffness: 300 }}
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 9998,
            width: 300,
            direction: 'rtl',
          }}
        >
          {/* Main Card */}
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.88)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              borderRadius: 24,
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 25px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05) inset',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Camera size={16} style={{ color: '#38bdf8' }} />
                <span style={{ color: 'white', fontSize: 13, fontWeight: 700 }}>
                  סורק מוצרים AI
                </span>
              </div>
              <button
                onClick={onToggle}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  border: 'none',
                  background: 'rgba(255,255,255,0.1)',
                  color: 'rgba(255,255,255,0.6)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.2)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
              >
                <X size={14} />
              </button>
            </div>

            {/* Camera Feed — polling snapshots from Mac Studio Edge Node */}
            <div style={{ position: 'relative', width: '100%', aspectRatio: '1/1' }}>
              <CameraCanvas isActive={isActive} />

              {/* ROI Overlay (detection zone) */}
              <div
                style={{
                  position: 'absolute',
                  top: '20%',
                  left: '20%',
                  width: '60%',
                  height: '60%',
                  border: '2px dashed rgba(56,189,248,0.5)',
                  borderRadius: 16,
                  pointerEvents: 'none',
                  transition: 'border-color 0.3s',
                  borderColor:
                    motionState === 'stable'
                      ? 'rgba(34,197,94,0.7)'
                      : motionState === 'motion'
                        ? 'rgba(234,179,8,0.7)'
                        : 'rgba(56,189,248,0.4)',
                }}
              />

              {/* Scanning animation overlay */}
              {isInferring && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(14,165,233,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <motion.div
                    animate={{ y: [-60, 60] }}
                    transition={{ duration: 1.2, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
                    style={{
                      width: '70%',
                      height: 2,
                      background: 'linear-gradient(90deg, transparent, #38bdf8, transparent)',
                      borderRadius: 2,
                      boxShadow: '0 0 20px rgba(56,189,248,0.5)',
                    }}
                  />
                </motion.div>
              )}

              {/* Motion status badge */}
              <div
                style={{
                  position: 'absolute',
                  top: 10,
                  left: 10,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 10px',
                  borderRadius: 20,
                  background: badge.bg,
                  border: `1px solid ${badge.border}`,
                  backdropFilter: 'blur(8px)',
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'white',
                  transition: 'all 0.3s ease',
                }}
              >
                <span style={{ fontSize: 13 }}>{badge.emoji}</span>
                <span>{badge.label}</span>
              </div>

              {/* Match result overlay */}
              <AnimatePresence>
                {lastMatch && lastMatch.match && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      padding: '12px 14px',
                      background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.85))',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      direction: 'rtl',
                    }}
                  >
                    <span
                      style={{
                        color: 'white',
                        fontSize: 14,
                        fontWeight: 700,
                        textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                      }}
                    >
                      {lastMatch.match.product_name}
                    </span>
                    <span
                      style={{
                        background: 'rgba(34,197,94,0.9)',
                        color: 'white',
                        padding: '2px 8px',
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {Math.round((lastMatch.confidence || lastMatch.match.confidence_score) * 100)}%
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Hidden canvas for motion detection */}
          <canvas
            ref={motionCanvasRef}
            width={200}
            height={200}
            style={{
              position: 'absolute',
              opacity: 0,
              pointerEvents: 'none',
              width: 0,
              height: 0,
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ProductCamera;
