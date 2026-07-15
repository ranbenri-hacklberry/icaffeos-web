// @ts-nocheck
/**
 * StartScreen - Initial Authentication Choice
 *
 * Lets user choose between Face Recognition or PIN entry
 * Compact design for 400px Maya window
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Camera, Key, Sparkles } from 'lucide-react';

interface StartScreenProps {
  onChooseFace: () => void;
  onChoosePIN: () => void;
}

export const StartScreen: React.FC<StartScreenProps> = ({
  onChooseFace,
  onChoosePIN
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-6 space-y-6">
      {/* Logo/Icon */}
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{
          type: 'spring',
          damping: 15,
          stiffness: 200
        }}
        className="relative"
      >
        <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500
                        rounded-2xl flex items-center justify-center
                        shadow-2xl shadow-purple-500/40">
          <Sparkles className="w-10 h-10 text-white" />
        </div>

        {/* Pulsing ring */}
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.5, 0, 0.5]
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
          className="absolute inset-0 border-4 border-purple-400 rounded-2xl"
        />
      </motion.div>

      {/* Title */}
      <div className="text-center">
        <h2 className="text-xl font-black text-white mb-1">
          ברוכים הבאים ל-Maya
        </h2>
        <p className="text-sm text-white/60">
          בחר שיטת אימות
        </p>
      </div>

      {/* Choice Buttons */}
      <div className="flex flex-col gap-3 w-full max-w-[280px]">
        {/* Face Recognition Button */}
        <motion.button
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
          onClick={onChooseFace}
          className="group relative p-4 rounded-2xl
                     bg-gradient-to-br from-cyan-500/20 to-blue-500/20
                     border-2 border-cyan-400/30
                     hover:border-cyan-400/60
                     backdrop-blur-sm
                     transition-all duration-200
                     overflow-hidden"
        >
          {/* Hover glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-blue-500/10
                          opacity-0 group-hover:opacity-100 transition-opacity" />

          <div className="relative flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-500
                            rounded-xl flex items-center justify-center
                            shadow-lg shadow-cyan-500/30
                            group-hover:scale-110 transition-transform">
              <Camera className="w-6 h-6 text-white" />
            </div>

            <div className="flex-1 text-right">
              <h3 className="text-base font-bold text-white">זיהוי פנים</h3>
              <p className="text-xs text-white/60">מהיר ונוח</p>
            </div>

            <div className="text-cyan-400 text-sm font-bold">
              ←
            </div>
          </div>
        </motion.button>

        {/* PIN Entry Button */}
        <motion.button
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
          onClick={onChoosePIN}
          className="group relative p-4 rounded-2xl
                     bg-gradient-to-br from-purple-500/20 to-pink-500/20
                     border-2 border-purple-400/30
                     hover:border-purple-400/60
                     backdrop-blur-sm
                     transition-all duration-200
                     overflow-hidden"
        >
          {/* Hover glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-pink-500/10
                          opacity-0 group-hover:opacity-100 transition-opacity" />

          <div className="relative flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500
                            rounded-xl flex items-center justify-center
                            shadow-lg shadow-purple-500/30
                            group-hover:scale-110 transition-transform">
              <Key className="w-6 h-6 text-white" />
            </div>

            <div className="flex-1 text-right">
              <h3 className="text-base font-bold text-white">הזנת PIN</h3>
              <p className="text-xs text-white/60">4 ספרות</p>
            </div>

            <div className="text-purple-400 text-sm font-bold">
              ←
            </div>
          </div>
        </motion.button>
      </div>

      {/* Info Text */}
      <p className="text-[10px] text-white/40 text-center max-w-[240px]">
        שני אמצעי האימות מאובטחים ומוצפנים
      </p>
    </div>
  );
};

export default StartScreen;
