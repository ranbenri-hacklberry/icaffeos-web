/**
 * 🎩 ABRAKADABRA SPELLBOUND COMPONENT
 * Spell: pos-loyalty-charity
 * 
 * Target: src/components/pos/POSCheckoutWithBiometric.tsx
 * Modification: Loyalty points & Charity round-up.
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Heart, Star, ShieldCheck, CreditCard } from 'lucide-react';

const POSCheckout_SpellBound: React.FC<any> = ({ total = 42.50 }) => {
    const [roundUp, setRoundUp] = useState(false);
    const roundedTotal = Math.ceil(total);
    const donation = (roundedTotal - total).toFixed(2);

    return (
        <div className="p-6 bg-white rounded-3xl shadow-2xl border border-indigo-100 max-w-md mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black text-slate-800">Checkout</h2>
                <div className="bg-indigo-50 px-3 py-1 rounded-full flex items-center gap-2">
                    <Star size={16} className="text-indigo-600 fill-indigo-600" />
                    <span className="text-sm font-bold text-indigo-700">1,240 $BEAN</span>
                </div>
            </div>

            <div className="space-y-4 mb-8">
                <div className="flex justify-between text-gray-600 font-bold">
                    <span>Subtotal</span>
                    <span>₪{total.toFixed(2)}</span>
                </div>

                {/* ✨ SPELL EFFECT: Round-up for Charity */}
                <motion.div
                    className={`p-4 rounded-2xl border-2 transition-colors ${roundUp ? 'border-pink-200 bg-pink-50' : 'border-gray-100 bg-gray-50'}`}
                    animate={{ scale: roundUp ? 1.02 : 1 }}
                >
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${roundUp ? 'bg-pink-500 text-white' : 'bg-gray-200 text-gray-400'}`}>
                                <Heart size={20} />
                            </div>
                            <div>
                                <div className="font-black text-slate-800">Round up for Charity?</div>
                                <div className="text-xs text-gray-500">Donate ₪{donation} to Save the Children</div>
                            </div>
                        </div>
                        <button
                            onClick={() => setRoundUp(!roundUp)}
                            className={`w-12 h-6 rounded-full transition-colors relative ${roundUp ? 'bg-pink-500' : 'bg-gray-300'}`}
                        >
                            <motion.div
                                className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full"
                                animate={{ x: roundUp ? 24 : 0 }}
                            />
                        </button>
                    </div>
                </motion.div>
            </div>

            <div className="border-t pt-4 mb-6">
                <div className="flex justify-between items-end">
                    <span className="text-gray-500 font-bold">Total to Pay</span>
                    <span className="text-4xl font-black text-slate-900">
                        ₪{roundUp ? roundedTotal.toFixed(2) : total.toFixed(2)}
                    </span>
                </div>
            </div>

            <button className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black flex items-center justify-center gap-3 shadow-xl hover:bg-slate-800 transition-all">
                <CreditCard />
                COMPLETE PAYMENT
            </button>

            <div className="mt-4 flex items-center justify-center gap-2 text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                <ShieldCheck size={12} />
                Biometric Verification Enabled
            </div>
        </div>
    );
};

export default POSCheckout_SpellBound;
