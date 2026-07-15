import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, ScanLine, Camera, Check, AlertTriangle, Loader2, Crosshair } from 'lucide-react';

const EDGE_NODE = '/edge-node';

const SCAN_INTERVAL = 3000;       // ms between scans
const AUTO_ADD_THRESHOLD = 0.80;  // auto-add to cart
const CONFIRM_THRESHOLD = 0.65;   // show bounding box
const MISS_STREAK_TO_REMOVE = 2;  // consecutive scans without product → remove from cart

/**
 * ScanModeOverlay — Inline table scanner with full cart sync.
 * - Counts multiple instances of same product
 * - Adds immediately on first detection
 * - Removes after 3 consecutive misses (prevents flickering)
 */
export default function ScanModeOverlay({
  isOpen, onClose, onAddItem, onRemoveItem, cartItems,
  businessId, menuItems, inline
}) {
  const canvasRef = useRef(null);
  const fetchingRef = useRef(false);
  const scanningRef = useRef(false);

  const [isCalibrated, setIsCalibrated] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [detections, setDetections] = useState([]);
  const [scanCount, setScanCount] = useState(0);
  const [lastScanMs, setLastScanMs] = useState(0);
  const [error, setError] = useState('');

  /**
   * Table state: tracks what we believe is on the table.
   * Map<productId, { count: number, missStreak: number, menuItem: object }>
   * - count: how many of this product are confirmed in cart
   * - missStreak: consecutive scans where detected count < confirmed count
   */
  const tableStateRef = useRef(new Map());

  // ── Camera Feed ──
  useEffect(() => {
    if (!isOpen) return;
    fetchingRef.current = false;

    const tick = async () => {
      if (fetchingRef.current) return;
      fetchingRef.current = true;
      try {
        const res = await fetch(`${EDGE_NODE}/camera/snapshot`, { cache: 'no-store' });
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
    const id = setInterval(tick, 100);
    return () => { clearInterval(id); fetchingRef.current = false; };
  }, [isOpen]);

  // ── Calibration ──
  const handleCalibrate = useCallback(async () => {
    setIsCalibrating(true);
    setError('');
    try {
      const res = await fetch(`${EDGE_NODE}/calibrate`, { method: 'POST' });
      if (!res.ok) throw new Error(`Calibration failed: ${res.status}`);
      setIsCalibrated(true);
      setDetections([]);
      tableStateRef.current = new Map();
    } catch (e) {
      setError(e.message);
    } finally {
      setIsCalibrating(false);
    }
  }, []);

  // ── Scan Loop with Full Cart Sync ──
  useEffect(() => {
    if (!isOpen || !isCalibrated) return;
    scanningRef.current = true;

    const scan = async () => {
      if (!scanningRef.current) return;
      try {
        const formData = new FormData();
        formData.append('business_id', businessId);

        const res = await fetch(`${EDGE_NODE}/scan-table`, {
          method: 'POST',
          body: formData,
        });

        if (res.status === 429) return;
        if (!res.ok) return;

        const data = await res.json();
        const rawDets = data.detections || [];

        // Keep ALL detections for bounding boxes (no dedup)
        const displayDets = rawDets.filter(d => d.product_id && d.confidence >= CONFIRM_THRESHOLD);
        setDetections(displayDets);
        setScanCount(c => c + 1);
        setLastScanMs(data.scan_time_ms || 0);

        // ── Count detections per product (only high-confidence) ──
        // Also store the detection data so we can construct items from it
        const detectedCounts = {};
        const detectionData = {};
        for (const det of rawDets) {
          if (!det.product_id || det.confidence < AUTO_ADD_THRESHOLD) continue;
          const pid = String(det.product_id);
          detectedCounts[pid] = (detectedCounts[pid] || 0) + 1;
          if (!detectionData[pid]) detectionData[pid] = det;
        }

        const tableState = tableStateRef.current;

        // ── Sync: Add products / increase quantity ──
        for (const [pid, detectedCount] of Object.entries(detectedCounts)) {
          const state = tableState.get(pid) || { count: 0, missStreak: 0, confirmStreak: 0, menuItem: null };
          state.missStreak = 0; // product seen, reset miss streak
          state.confirmStreak = (state.confirmStreak || 0) + 1; // track consecutive detections

          if (!state.menuItem) {
            // Try to find in menuItems by ID first
            state.menuItem = menuItems?.find(m => String(m.id) === pid);
            
            // If not found by ID, try matching by product name
            if (!state.menuItem && detectionData[pid]?.product_name) {
              state.menuItem = menuItems?.find(m => m.name === detectionData[pid].product_name);
            }

            // Last resort: construct from detection data (but use businessId for safety)
            if (!state.menuItem && detectionData[pid]) {
              const det = detectionData[pid];
              // Try to find the correct ID by name one more time
              const correctItem = menuItems?.find(m => m.name === det.product_name);
              state.menuItem = {
                id: correctItem?.id || det.product_id,
                menu_item_id: correctItem?.id || det.product_id,
                name: det.product_name || 'מוצר לא ידוע',
                price: correctItem?.price || det.product_price || 0,
                category: correctItem?.category || det.product_category || '',
                image_url: correctItem?.image || det.product_image_url || '',
                business_id: businessId,
              };
            }
          }

          // Update price if it was 0 and we now have price data
          if (state.menuItem && !state.menuItem.price && detectionData[pid]?.product_price) {
            state.menuItem.price = detectionData[pid].product_price;
          }

          // Only add after 2 consecutive detections (prevents false positives)
          if (detectedCount > state.count && state.menuItem && state.confirmStreak >= 2) {
            // Add the difference to cart
            const toAdd = detectedCount - state.count;
            for (let i = 0; i < toAdd; i++) {
              onAddItem(state.menuItem, [], 1);
            }
            state.count = detectedCount;
          }

          tableState.set(pid, state);
        }

        // ── Sync: Remove products that are no longer on table ──
        for (const [pid, state] of tableState.entries()) {
          const detectedCount = detectedCounts[pid] || 0;
          // Use the corrected ID (from menuItems lookup) for cart operations
          const cartId = state.menuItem?.id || pid;

          if (detectedCount < state.count) {
            // Product count decreased — reset confirm streak
            state.missStreak++;
            state.confirmStreak = 0;

            if (state.missStreak >= MISS_STREAK_TO_REMOVE) {
              // Remove the difference from cart
              const toRemove = state.count - detectedCount;
              for (let i = 0; i < toRemove; i++) {
                onRemoveItem(cartId, null, null);
              }
              state.count = detectedCount;
              state.missStreak = 0;

              // If count is 0, remove from tracking entirely
              if (state.count === 0) {
                tableState.delete(pid);
              }
            }
          } else if (detectedCount === 0 && state.count === 0) {
            // Not detected and not in cart — clean up tracking
            state.confirmStreak = 0;
            state.missStreak++;
            if (state.missStreak >= MISS_STREAK_TO_REMOVE) {
              tableState.delete(pid);
            }
          } else {
            // Count is same or higher, no miss
            state.missStreak = 0;
          }
        }

        // ── Hard cap: cart items can never exceed detected contours ──
        const totalContours = displayDets.length;
        let totalTracked = 0;
        for (const [, s] of tableState.entries()) totalTracked += s.count;

        if (totalTracked > totalContours && totalContours >= 0) {
          // Too many items — remove the ones with lowest confirmStreak first
          const entries = [...tableState.entries()]
            .filter(([, s]) => s.count > 0)
            .sort((a, b) => (a[1].confirmStreak || 0) - (b[1].confirmStreak || 0));
          
          let excess = totalTracked - totalContours;
          for (const [pid, state] of entries) {
            if (excess <= 0) break;
            const cartId = state.menuItem?.id || pid;
            const removeCount = Math.min(state.count, excess);
            for (let i = 0; i < removeCount; i++) {
              onRemoveItem(cartId, null, null);
            }
            state.count -= removeCount;
            excess -= removeCount;
            if (state.count === 0) tableState.delete(pid);
          }
        }

      } catch { /* ignore */ }
    };

    scan();
    const id = setInterval(scan, SCAN_INTERVAL);
    return () => { clearInterval(id); scanningRef.current = false; };
  }, [isOpen, isCalibrated, businessId, menuItems, onAddItem, onRemoveItem]);

  // ── Reset on close ──
  useEffect(() => {
    if (!isOpen) {
      setDetections([]);
      setIsCalibrated(false);
      tableStateRef.current = new Map();
      setScanCount(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const getDetectionColor = (confidence, productId) => {
    const state = tableStateRef.current.get(String(productId));
    const isInCart = state && state.count > 0;
    if (isInCart) return { border: '#22c55e', bg: 'rgba(34,197,94,0.18)', label: '#22c55e' };
    if (confidence >= AUTO_ADD_THRESHOLD) return { border: '#22c55e', bg: 'rgba(34,197,94,0.12)', label: '#22c55e' };
    if (confidence >= CONFIRM_THRESHOLD) return { border: '#eab308', bg: 'rgba(234,179,8,0.10)', label: '#eab308' };
    return { border: '#ef4444', bg: 'rgba(239,68,68,0.10)', label: '#ef4444' };
  };

  const cartCount = cartItems?.length || 0;

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 16px',
        background: 'rgba(0,0,0,0.3)',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ScanLine size={18} color="#818cf8" />
          <span style={{ color: 'white', fontWeight: 700, fontSize: 14 }}>סורק שולחן</span>
          {isCalibrated && (
            <span style={{
              background: 'rgba(34,197,94,0.2)',
              color: '#4ade80',
              padding: '2px 8px',
              borderRadius: 12,
              fontSize: 10,
              fontWeight: 600,
            }}>
              #{scanCount} · {lastScanMs.toFixed(0)}ms
            </span>
          )}
          {cartCount > 0 && (
            <span style={{
              background: 'rgba(99,102,241,0.2)',
              color: '#a5b4fc',
              padding: '2px 8px',
              borderRadius: 12,
              fontSize: 10,
              fontWeight: 600,
            }}>
              {cartCount} בעגלה
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isCalibrated && (
            <button
              onClick={handleCalibrate}
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 8,
                padding: '4px 10px',
                color: 'rgba(255,255,255,0.6)',
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              🔄 כייל
            </button>
          )}
          <button
            onClick={onClose}
            style={{
              background: 'rgba(239,68,68,0.2)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 8,
              padding: '4px 12px',
              color: '#fca5a5',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <X size={14} />
            סגור
          </button>
        </div>
      </div>

      {/* Camera */}
      <div style={{
        flex: 1,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          borderRadius: 12,
          overflow: 'hidden',
          border: `2px solid ${isCalibrated ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.1)'}`,
        }}>
          <canvas
            ref={canvasRef}
            style={{
              width: '100%',
              height: '100%',
              display: 'block',
              objectFit: 'contain',
            }}
          />

          {/* Bounding Boxes — show ALL detections including duplicates */}
          {detections.map((det, i) => {
            const colors = getDetectionColor(det.confidence, det.product_id);
            const state = tableStateRef.current.get(String(det.product_id));
            const isInCart = state && state.count > 0;

            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: `${det.bbox.x * 100}%`,
                  top: `${det.bbox.y * 100}%`,
                  width: `${det.bbox.w * 100}%`,
                  height: `${det.bbox.h * 100}%`,
                  border: `2px solid ${colors.border}`,
                  background: colors.bg,
                  borderRadius: 6,
                  transition: 'all 0.3s ease',
                  pointerEvents: !isInCart && det.confidence >= CONFIRM_THRESHOLD ? 'auto' : 'none',
                  cursor: !isInCart && det.confidence >= CONFIRM_THRESHOLD ? 'pointer' : 'default',
                }}
                onClick={() => {
                  if (isInCart || !det.product_id) return;
                  const menuItem = menuItems?.find(m => String(m.id) === String(det.product_id));
                  if (menuItem) {
                    const pid = String(det.product_id);
                    const st = tableStateRef.current.get(pid) || { count: 0, missStreak: 0, menuItem };
                    st.count++;
                    st.menuItem = menuItem;
                    tableStateRef.current.set(pid, st);
                    onAddItem(menuItem, [], 1);
                  }
                }}
              >
                <div style={{
                  position: 'absolute',
                  top: -24,
                  left: 0,
                  background: isInCart ? '#22c55e' : colors.border,
                  color: '#000',
                  padding: '1px 6px',
                  borderRadius: '4px 4px 0 0',
                  fontSize: 10,
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                }}>
                  {isInCart && <Check size={10} />}
                  {det.product_name || '?'} · {Math.round(det.confidence * 100)}%
                </div>
              </div>
            );
          })}

          {/* Calibration */}
          {!isCalibrated && (
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.6)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              backdropFilter: 'blur(4px)',
            }}>
              <Crosshair size={40} color="#818cf8" style={{ animation: 'pulse 2s infinite' }} />
              <div style={{ color: 'white', fontSize: 16, fontWeight: 700 }}>כייל שולחן ריק</div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, textAlign: 'center', maxWidth: 250 }}>
                ודא שהשולחן ריק ולחץ למטה
              </div>
              <button
                onClick={handleCalibrate}
                disabled={isCalibrating}
                style={{
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  border: 'none',
                  borderRadius: 10,
                  padding: '10px 28px',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: isCalibrating ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  opacity: isCalibrating ? 0.6 : 1,
                }}
              >
                {isCalibrating ? (
                  <><Loader2 size={16} className="animate-spin" /> מכייל...</>
                ) : (
                  <><Camera size={16} /> כייל</>
                )}
              </button>
              {error && (
                <div style={{ color: '#fca5a5', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <AlertTriangle size={12} /> {error}
                </div>
              )}
            </div>
          )}

          {/* Active indicator */}
          {isCalibrated && (
            <div style={{
              position: 'absolute',
              top: 8,
              right: 8,
              background: 'rgba(0,0,0,0.5)',
              backdropFilter: 'blur(8px)',
              padding: '4px 10px',
              borderRadius: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}>
              <div style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#22c55e',
                animation: 'pulse 1.5s infinite',
              }} />
              <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: 600 }}>
                סורק פעיל
              </span>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
