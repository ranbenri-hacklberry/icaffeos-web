// @ts-nocheck
/**
 * PINPadCompact - Compact PIN Entry
 *
 * Smaller version designed for 400px Maya window
 * 3x4 grid with smaller buttons (h-12 instead of h-16)
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Delete, CheckCircle, AlertCircle, Camera, Loader2 } from 'lucide-react';

interface PINPadCompactProps {
  onSuccess: (employee: any, similarity: number) => void;
  onError?: (error: string) => void;
  onSwitchToFace?: () => void;
}

export const PINPadCompact: React.FC<PINPadCompactProps> = ({
  onSuccess,
  onError,
  onSwitchToFace
}) => {
  const [pin, setPin] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string>('');
  const [attempts, setAttempts] = useState<number>(0);

  const MAX_ATTEMPTS = 3;
  const PIN_LENGTH = 4;

  const handleNumberPress = (num: number) => {
    if (pin.length < PIN_LENGTH) {
      setPin(prev => prev + num);
      setError('');
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
    setError('');
  };

  const handleSubmit = async () => {
    if (pin.length !== PIN_LENGTH) {
      setError('יש להזין 4 ספרות');
      return;
    }

    setIsVerifying(true);
    setError('');

    try {
      const response = await fetch('http://localhost:8081/api/maya/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      });

      const result = await response.json();

      if (response.ok && result.valid) {
        console.log('✅ PIN verified:', result.employee);
        onSuccess(result.employee, 1.0);
      } else {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);

        if (newAttempts >= MAX_ATTEMPTS) {
          setError('נסיונות רבים מדי');
          onError?.('Too many attempts');
        } else {
          setError(`PIN שגוי (${MAX_ATTEMPTS - newAttempts} נותרו)`);
        }

        setPin('');
      }
    } catch (err) {
      console.error('PIN verification error:', err);
      setError('שגיאת תקשורת');
      onError?.('Network error');
    } finally {
      setIsVerifying(false);
    }
  };

  // Auto-submit on 4 digits
  useEffect(() => {
    if (pin.length === PIN_LENGTH && !isVerifying) {
      handleSubmit();
    }
  }, [pin]);

  const numbers = [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9],
    ['backspace', 0, 'submit']
  ];

  if (attempts >= MAX_ATTEMPTS) {
    return (
      <div className="flex flex-col items-center justify-center p-6 space-y-4">
        <Lock className="w-12 h-12 text-red-400" />
        <h3 className="text-base font-bold text-white">מערכת נעולה</h3>
        <p className="text-white/60 text-xs text-center">
          נסה שוב בעוד 5 דקות
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center p-4 space-y-4">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-12 h-12
                        bg-cyan-500/20 backdrop-blur-sm border border-cyan-400/30
                        rounded-xl mb-3">
          <Lock className="w-6 h-6 text-cyan-400" />
        </div>
        <h3 className="text-base font-bold text-white mb-1">הזן PIN</h3>
        <p className="text-xs text-white/60">
          {isVerifying ? 'מאמת...' : '4 ספרות'}
        </p>
      </div>

      {/* PIN Display */}
      <div className="flex items-center justify-center gap-2">
        {[...Array(PIN_LENGTH)].map((_, index) => (
          <motion.div
            key={index}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: index * 0.05 }}
            className={`
              w-12 h-12 rounded-xl flex items-center justify-center
              ${pin.length > index
                ? 'bg-gradient-to-br from-cyan-500 to-purple-500 shadow-lg shadow-cyan-500/30'
                : 'bg-white/5 border border-cyan-400/20'
              }
              transition-all duration-200
            `}
          >
            {pin.length > index && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-2.5 h-2.5 bg-white rounded-full"
              />
            )}
          </motion.div>
        ))}
      </div>

      {/* Error Message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="flex items-center gap-2 bg-red-500/20 border border-red-400/30
                       text-red-400 px-3 py-1.5 rounded-lg"
          >
            <AlertCircle size={12} />
            <span className="text-xs font-medium">{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Number Pad - Compact */}
      <div className="grid grid-cols-3 gap-2 w-full max-w-[240px]">
        {numbers.map((row, rowIndex) =>
          row.map((item, colIndex) => {
            const key = `${rowIndex}-${colIndex}`;

            // Backspace
            if (item === 'backspace') {
              return (
                <motion.button
                  key={key}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleBackspace}
                  disabled={pin.length === 0 || isVerifying}
                  className="h-12 rounded-xl bg-slate-700/30 border border-slate-600/30
                             hover:bg-slate-600/40 disabled:opacity-30
                             flex items-center justify-center transition"
                >
                  <Delete className="w-5 h-5 text-slate-400" />
                </motion.button>
              );
            }

            // Submit
            if (item === 'submit') {
              return (
                <motion.button
                  key={key}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleSubmit}
                  disabled={pin.length !== PIN_LENGTH || isVerifying}
                  className="h-12 rounded-xl bg-green-500/30 border border-green-400/40
                             hover:bg-green-500/40 disabled:opacity-30
                             flex items-center justify-center transition
                             shadow-lg shadow-green-500/20"
                >
                  {isVerifying ? (
                    <Loader2 className="w-5 h-5 text-green-400 animate-spin" />
                  ) : (
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  )}
                </motion.button>
              );
            }

            // Number
            return (
              <motion.button
                key={key}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleNumberPress(item as number)}
                disabled={pin.length >= PIN_LENGTH || isVerifying}
                className="h-12 rounded-xl bg-slate-900/40 border border-cyan-400/20
                           hover:bg-slate-800/60 hover:border-cyan-400/40
                           disabled:opacity-30 transition
                           flex items-center justify-center group"
              >
                <span className="text-xl font-bold text-cyan-400 group-hover:text-cyan-300">
                  {item}
                </span>
              </motion.button>
            );
          })
        )}
      </div>

      {/* Switch to Face */}
      {onSwitchToFace && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          onClick={onSwitchToFace}
          className="mt-2 text-white/50 hover:text-white/80 text-xs font-medium
                     flex items-center gap-1.5 transition"
        >
          <Camera size={12} />
          חזור לזיהוי פנים
        </motion.button>
      )}
    </div>
  );
};

export default PINPadCompact;
