// @ts-nocheck
/**
 * POS Checkout with Biometric Verification
 * @abra-table orders, employees
 * @abra-dexie orders
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, AlertCircle, CreditCard } from 'lucide-react';
import QuickFaceLog from '../maya/QuickFaceLog';
import BiometricIndicator from './BiometricIndicator';

interface POSCheckoutWithBiometricProps {
    orderData: any;
    businessId: string;
    onOrderComplete: (order: any) => void;
}

export const POSCheckoutWithBiometric: React.FC<POSCheckoutWithBiometricProps> = ({
    orderData,
    businessId,
    onOrderComplete
}) => {
    const [biometricActive, setBiometricActive] = useState(true); // Active by default
    const [isProcessing, setIsProcessing] = useState(false);
    const [verifiedCashier, setVerifiedCashier] = useState(null);
    const [error, setError] = useState(null);

    // Handle embedding capture from QuickFaceLog
    const handleFaceCapture = async (embedding: Float32Array, confidence: number) => {
        console.log('✅ Face captured for order verification', { confidence });

        // Don't process yet - wait for user to click "Complete Order"
        // Store embedding for later use
        window.tempEmbedding = Array.from(embedding);
        window.tempConfidence = confidence;
    };

    // Handle face capture error (non-critical - can fallback to PIN)
    const handleFaceError = (error: string) => {
        console.warn('QuickFaceLog error (non-critical):', error);
        setBiometricActive(false);
        // Still allow order completion without biometric
    };

    // Complete order with biometric verification
    const handleCompleteOrder = async () => {
        setIsProcessing(true);
        setError(null);

        try {
            // Check if we have biometric data
            const embedding = window.tempEmbedding;

            if (embedding) {
                // Verify and log order with biometric
                const response = await fetch('http://localhost:8081/api/maya/verify-and-log-order', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        orderData,
                        embedding,
                        businessId
                    })
                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.error || 'Verification failed');
                }

                // Success! Show verified cashier
                setVerifiedCashier(result.cashier);

                // Clean up temp data
                delete window.tempEmbedding;
                delete window.tempConfidence;

                // Complete order
                setTimeout(() => {
                    onOrderComplete(result.order);
                }, 1500); // Show success feedback briefly

            } else {
                // Fallback: Save order without biometric (PIN required separately)
                console.warn('No biometric data - using fallback');

                const response = await fetch('http://localhost:8081/api/orders', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ...orderData,
                        businessId,
                        biometric_verified: false,
                        cashier_id: null // Requires manual PIN entry
                    })
                });

                const result = await response.json();
                onOrderComplete(result);
            }

        } catch (err) {
            console.error('Order completion error:', err);
            setError(err.message);
            setIsProcessing(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-900">
            {/* QuickFaceLog (hidden, runs in background) */}
            {biometricActive && !verifiedCashier && (
                <QuickFaceLog
                    onCapture={handleFaceCapture}
                    onError={handleFaceError}
                    autoStart={true}
                />
            )}

            {/* Header with Biometric Indicator */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
                <h2 className="text-xl font-bold text-white">Payment</h2>

                {/* Biometric status indicator */}
                <BiometricIndicator
                    active={biometricActive && !verifiedCashier}
                    verified={!!verifiedCashier}
                    cashierName={verifiedCashier?.name}
                />
            </div>

            {/* Order Summary */}
            <div className="flex-1 p-6 overflow-y-auto">
                <div className="bg-slate-800/50 rounded-xl p-6 mb-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Order Summary</h3>

                    {/* Order items */}
                    <div className="space-y-2 mb-4">
                        {orderData.items?.map((item, idx) => (
                            <div key={idx} className="flex justify-between text-white/80">
                                <span>{item.quantity}x {item.name}</span>
                                <span>₪{item.price}</span>
                            </div>
                        ))}
                    </div>

                    {/* Total */}
                    <div className="border-t border-white/10 pt-4 mt-4">
                        <div className="flex justify-between text-xl font-bold text-white">
                            <span>Total</span>
                            <span>₪{orderData.total}</span>
                        </div>
                    </div>
                </div>

                {/* Payment Method */}
                <div className="bg-slate-800/50 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Payment Method</h3>
                    <div className="flex gap-3">
                        <button className="flex-1 p-4 bg-cyan-500/20 border border-cyan-400/30 rounded-xl text-cyan-400 font-medium hover:bg-cyan-500/30 transition">
                            <CreditCard className="w-5 h-5 mx-auto mb-2" />
                            Card
                        </button>
                        <button className="flex-1 p-4 bg-white/10 border border-white/20 rounded-xl text-white font-medium hover:bg-white/20 transition">
                            Cash
                        </button>
                    </div>
                </div>
            </div>

            {/* Error message */}
            {error && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mx-6 mb-4 p-4 bg-red-500/20 border border-red-400/30 rounded-xl"
                >
                    <div className="flex items-center gap-2 text-red-400">
                        <AlertCircle className="w-5 h-5" />
                        <span className="text-sm font-medium">{error}</span>
                    </div>
                </motion.div>
            )}

            {/* Verified success message */}
            {verifiedCashier && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mx-6 mb-4 p-4 bg-green-500/20 border border-green-400/30 rounded-xl"
                >
                    <div className="flex items-center gap-2 text-green-400">
                        <CheckCircle className="w-5 h-5" />
                        <span className="text-sm font-medium">
                            Verified by {verifiedCashier.name} ({(verifiedCashier.confidence * 100).toFixed(0)}% confidence)
                        </span>
                    </div>
                </motion.div>
            )}

            {/* Complete Order Button */}
            <div className="p-6 border-t border-white/10">
                <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={handleCompleteOrder}
                    disabled={isProcessing || !!verifiedCashier}
                    className={`w-full py-4 rounded-xl font-bold text-lg transition-all
                        ${verifiedCashier
                            ? 'bg-green-500/20 text-green-400 cursor-not-allowed'
                            : isProcessing
                                ? 'bg-cyan-500/50 text-white/50 cursor-wait'
                                : 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:shadow-lg hover:shadow-cyan-500/50'
                        }`}
                >
                    {isProcessing ? 'Processing...' : verifiedCashier ? 'Order Completed ✓' : 'Complete Order'}
                </motion.button>
            </div>
        </div>
    );
};

export default POSCheckoutWithBiometric;
