import React from 'react';
import { Trash2, Camera, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

// Lazy-loaded camera preview (same component used in ModifierModal)
const TrainingCameraPreview = ({ isActive }) => {
  const videoRef = React.useRef(null);
  const streamRef = React.useRef(null);

  React.useEffect(() => {
    if (!isActive) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      return;
    }
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
        });
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (e) {
        console.warn('Camera error:', e);
      }
    })();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, [isActive]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      style={{
        width: '100%', height: '100%', objectFit: 'cover',
        transform: 'scaleX(-1)', borderRadius: '1rem',
      }}
    />
  );
};

const EditTrainingPanel = ({
  isActive,
  selectedItem,
  businessId,
  vectorCount,
  maxVectors,
  trainingStatus,
  errorDetail,
  trainProduct,
  resetVectors,
}) => {
  if (!isActive) return null;

  return (
    <section className="min-h-[350px] max-h-[450px]" dir="rtl">
      <div className="space-y-3">
        {/* Vector Progress */}
        <div className="pb-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500">וקטורים שנלמדו</span>
            <span className={`text-[11px] font-black tabular-nums ${vectorCount >= maxVectors ? 'text-emerald-600' : 'text-sky-600'}`}>
              {vectorCount} / {maxVectors}
            </span>
          </div>
          <div className="flex gap-1">
            {Array.from({ length: maxVectors }, (_, i) => {
              const isFront = i < 5;
              const isFilled = i < vectorCount;
              const isLatest = i === vectorCount - 1 && trainingStatus === 'success';
              return (
                <div
                  key={i}
                  className={`flex-1 h-2.5 rounded-full transition-all duration-500 ${
                    isLatest
                      ? 'bg-emerald-400 scale-y-150 shadow-sm shadow-emerald-300'
                      : isFilled
                        ? isFront ? 'bg-sky-400' : 'bg-indigo-400'
                        : 'bg-slate-200'
                  }`}
                />
              );
            })}
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-[9px] text-sky-500 font-semibold">← חזית (5)</span>
            <span className="text-[9px] text-indigo-500 font-semibold">גב (5) →</span>
          </div>
        </div>

        {/* Camera Preview */}
        <div className="relative rounded-2xl overflow-hidden bg-slate-900 shadow-inner border border-slate-200" style={{ height: '200px' }}>
          <TrainingCameraPreview isActive={isActive} />

          {trainingStatus === 'capturing' && (
            <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
              <div className="flex flex-col items-center gap-2">
                <Loader2 size={24} className="animate-spin text-sky-500" />
                <span className="text-xs font-bold text-slate-500">מצלם...</span>
              </div>
            </div>
          )}
          {trainingStatus === 'success' && (
            <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center">
              <div className="bg-white rounded-2xl px-4 py-2 shadow-lg flex items-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-500" />
                <span className="text-sm font-bold text-emerald-700">נלמד בהצלחה!</span>
              </div>
            </div>
          )}
          {trainingStatus === 'error' && (
            <div className="absolute inset-0 bg-red-500/10 flex items-center justify-center">
              <div className="bg-white rounded-2xl px-4 py-2 shadow-lg">
                <span className="text-sm font-bold text-red-600">{errorDetail || 'שגיאה'}</span>
              </div>
            </div>
          )}
        </div>

        {/* Capture + Reset Buttons */}
        <div className="flex gap-2">
          {vectorCount > 0 && (
            <button
              onClick={() => {
                if (confirm('למחוק את כל הוקטורים שנלמדו?')) {
                  resetVectors(selectedItem?.id || selectedItem?.menu_item_id, businessId || selectedItem?.business_id);
                }
              }}
              className="w-12 h-12 rounded-2xl bg-red-50 border border-red-200 text-red-400 flex items-center justify-center hover:bg-red-100 active:scale-90 transition-all"
            >
              <Trash2 size={16} />
            </button>
          )}
          <button
            onClick={() => {
              const itemId = selectedItem?.id || selectedItem?.menu_item_id;
              const bId = businessId || selectedItem?.business_id;
              trainProduct(itemId, selectedItem?.name, bId, true);
            }}
            disabled={trainingStatus === 'capturing' || trainingStatus === 'processing' || trainingStatus === 'storing'}
            className={`flex-1 h-12 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
              trainingStatus === 'capturing' || trainingStatus === 'processing' || trainingStatus === 'storing'
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : trainingStatus === 'success'
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200'
                  : vectorCount >= maxVectors
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-200'
                    : 'bg-gradient-to-r from-sky-500 to-indigo-500 text-white shadow-lg shadow-sky-200 hover:shadow-xl'
            }`}
          >
            {trainingStatus === 'idle' && vectorCount >= maxVectors && <><CheckCircle2 size={16} /> מלא! צלם להחלפה</>}
            {trainingStatus === 'idle' && vectorCount < maxVectors && <><Camera size={16} /> צלם ולמד ({vectorCount + 1}/{maxVectors})</>}
            {trainingStatus === 'capturing' && <><Loader2 size={16} className="animate-spin" /> מצלם...</>}
            {(trainingStatus === 'processing' || trainingStatus === 'storing') && <><Loader2 size={16} className="animate-spin" /> מעבד...</>}
            {trainingStatus === 'success' && <><CheckCircle2 size={16} /> נלמד! המשך צילום</>}
            {trainingStatus === 'error' && <><AlertCircle size={16} /> נסה שוב</>}
          </button>
        </div>
      </div>
    </section>
  );
};

export default EditTrainingPanel;
