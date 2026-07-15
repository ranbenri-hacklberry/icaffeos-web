// @ts-nocheck
/**
 * FaceScannerReusable - Reusable Face Scanner Component
 * Wrapper around FaceScanner with additional configuration options
 * for use in profile settings, enrollment, etc.
 */

import React from 'react';
import FaceScanner from './FaceScanner';

interface FaceScannerReusableProps {
  onScanComplete?: (embedding: Float32Array, confidence: number) => void;
  onError?: (error: string) => void;
  compact?: boolean;
  autoStart?: boolean;
  showInstructions?: boolean;
}

const FaceScannerReusable: React.FC<FaceScannerReusableProps> = ({
  onScanComplete,
  onError,
  compact = false,
  autoStart = false,
  showInstructions = false
}) => {
  return (
    <div className={compact ? 'max-w-md mx-auto' : 'w-full'}>
      {showInstructions && (
        <div className="mb-4 p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
          <p className="text-sm font-bold text-indigo-900 text-center">
            מרכז את הפנים שלך במסגרת וחכה לזיהוי אוטומטי
          </p>
        </div>
      )}

      <FaceScanner
        onScanComplete={onScanComplete}
        onError={onError}
      />
    </div>
  );
};

export default FaceScannerReusable;
