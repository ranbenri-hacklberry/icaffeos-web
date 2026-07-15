// @ts-nocheck
/**
 * BiometricIndicator - Shows biometric status in POS UI
 *
 * Visual indicator that biometric verification is active
 * Non-intrusive cyan dot with optional text
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Shield } from 'lucide-react';

interface BiometricIndicatorProps {
    active?: boolean;
    verified?: boolean;
    cashierName?: string;
    className?: string;
}

export const BiometricIndicator: React.FC<BiometricIndicatorProps> = ({
    active = false,
    verified = false,
    cashierName = null,
    className = ''
}) => {
    if (!active && !verified) return null;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`flex items-center gap-2 ${className}`}
        >
            {/* Status dot */}
            <div className="relative">
                {active && !verified && (
                    <>
                        {/* Pulsing animation */}
                        <div className="absolute inset-0 bg-cyan-400 rounded-full animate-ping opacity-75" />
                        <div className="relative w-2 h-2 bg-cyan-500 rounded-full" />
                    </>
                )}
                {verified && (
                    <div className="relative w-2 h-2 bg-green-500 rounded-full" />
                )}
            </div>

            {/* Text label */}
            {active && !verified && (
                <span className="text-xs font-medium text-cyan-400">
                    Biometric Active
                </span>
            )}

            {verified && cashierName && (
                <div className="flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-green-500" />
                    <span className="text-xs font-medium text-green-400">
                        Verified: {cashierName}
                    </span>
                </div>
            )}
        </motion.div>
    );
};

export default BiometricIndicator;
