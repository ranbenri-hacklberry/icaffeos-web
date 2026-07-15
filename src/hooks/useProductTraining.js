import { useState, useRef, useCallback, useEffect } from 'react';

const MAX_VECTORS = 10;

/**
 * useProductTraining — 3-step product learning pipeline with 10-vector capacity.
 *
 * Flow: Snapshot → CLIP Embedding → Supabase RPC confirmation.
 * Uses AbortController to safely handle unmount mid-pipeline.
 * Tracks vector count per product for progress UI.
 *
 * @returns {{ trainProduct, trainingStatus, vectorCount, maxVectors, errorDetail, resetTraining, fetchVectorCount }}
 */
export function useProductTraining() {
  const [trainingStatus, setTrainingStatus] = useState('idle');
  const [vectorCount, setVectorCount] = useState(0);
  const [errorDetail, setErrorDetail] = useState('');
  const abortRef = useRef(null);
  const timerRef = useRef(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const resetTraining = useCallback(() => {
    setTrainingStatus('idle');
    setVectorCount(0);
    setErrorDetail('');
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  /**
   * Fetch the current vector count for a product from the Edge Node.
   */
  const fetchVectorCount = useCallback(async (menuItemId, businessId, signal) => {
    try {
      const res = await fetch('/edge-node/vector-count?' + new URLSearchParams({
        menu_item_id: String(menuItemId),
        business_id: businessId,
      }), { signal });
      if (res.ok) {
        const data = await res.json();
        const count = data.count ?? data.vector_count ?? 0;
        setVectorCount(count);
        return count;
      }
    } catch {
      // Silently fail — count will stay at current value
    }
    return vectorCount;
  }, [vectorCount]);

  const trainProduct = useCallback(async (menuItemId, businessId, itemName) => {
    // Cancel any in-flight training
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const { signal } = controller;

    setErrorDetail('');

    try {
      // Resolve the correct menu_item_id for this business
      // (cart items may have IDs from a different business)
      let resolvedId = menuItemId;
      if (itemName) {
        try {
          const lookupRes = await fetch(
            `/supabase-api/rest/v1/menu_items?select=id&business_id=eq.${businessId}&name=eq.${encodeURIComponent(itemName)}&limit=1`,
            { headers: { 'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' }, signal }
          );
          if (lookupRes.ok) {
            const items = await lookupRes.json();
            if (items?.[0]?.id) resolvedId = items[0].id;
          }
        } catch { /* use original ID */ }
      }

      // Single server-side call: capture → detect contour → crop → embed → store
      setTrainingStatus('processing');
      const formData = new FormData();
      formData.append('business_id', businessId);
      formData.append('menu_item_id', String(resolvedId));

      let trainRes;
      try {
        trainRes = await fetch('/edge-node/train-from-table', {
          method: 'POST',
          body: formData,
          signal,
        });
      } catch (e) {
        if (e.name === 'AbortError') return;
        throw new Error('לא ניתן להתחבר לשרת — בדוק חיבור Mac Studio');
      }

      if (!trainRes.ok) {
        const errText = await trainRes.text().catch(() => '');
        throw new Error(`שגיאת לימוד (${trainRes.status}): ${errText}`);
      }

      const result = await trainRes.json();
      if (signal.aborted) return;

      // Update vector count from response
      const newCount = result?.vector_count ?? (vectorCount + 1);
      setVectorCount(Math.min(newCount, MAX_VECTORS));

      // Success — brief flash then back to idle for next capture
      setTrainingStatus('success');
      timerRef.current = setTimeout(() => {
        if (!signal.aborted) setTrainingStatus('idle');
      }, 1200);

    } catch (err) {
      if (signal.aborted || err.name === 'AbortError') return;
      console.error('[useProductTraining] Error:', err);
      setErrorDetail(err.message || 'שגיאה לא ידועה');
      setTrainingStatus('error');
      timerRef.current = setTimeout(() => {
        if (!signal.aborted) setTrainingStatus('idle');
      }, 3000);
    }
  }, [vectorCount]);

  /**
   * Delete ALL trained vectors for a product (undo wrong training).
   */
  const resetVectors = useCallback(async (menuItemId, businessId) => {
    try {
      setTrainingStatus('processing');
      const res = await fetch(`/edge-node/vector-reset?menu_item_id=${menuItemId}&business_id=${businessId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error(`Reset failed: ${res.status}`);
      setVectorCount(0);
      setTrainingStatus('idle');
      return true;
    } catch (err) {
      console.error('[useProductTraining] Reset error:', err);
      setErrorDetail('שגיאת איפוס');
      setTrainingStatus('error');
      timerRef.current = setTimeout(() => setTrainingStatus('idle'), 3000);
      return false;
    }
  }, []);

  return {
    trainProduct,
    trainingStatus,
    vectorCount,
    maxVectors: MAX_VECTORS,
    errorDetail,
    resetTraining,
    fetchVectorCount,
    resetVectors,
  };
}
