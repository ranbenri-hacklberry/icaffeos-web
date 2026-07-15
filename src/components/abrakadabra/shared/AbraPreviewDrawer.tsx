import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAbraHat } from '../../../context/AbraHatContext';

const AbraPreviewDrawer: React.FC = () => {
    // If context is missing, hook throws. We should safeguard usage
    // but ideally this is only rendered inside the Provider.
    const { isWearingHat, currentSpell, takeOffHat } = useAbraHat();

    if (!isWearingHat || !currentSpell) {
        return null;
    }

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] pointer-events-none flex justify-end">
                {/* Backdrop if desired, currently transparent to see app behind? No, isolated means focus. */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.5 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black pointer-events-auto"
                    onClick={takeOffHat}
                />

                <motion.div
                    initial={{ x: '100%' }}
                    animate={{ x: 0 }}
                    exit={{ x: '100%' }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    className="pointer-events-auto h-full w-full md:w-2/3 lg:w-1/2 bg-white shadow-2xl flex flex-col border-l-4 border-purple-600 relative z-10"
                >
                    {/* Magical Header */}
                    <div className="bg-purple-900 text-white p-4 flex justify-between items-center shadow-md z-10">
                        <div>
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                🎩 AbraSandbox
                            </h2>
                            <p className="text-xs opacity-75 font-mono">
                                Spell: {currentSpell.spell_id}
                            </p>
                        </div>
                        <button
                            onClick={takeOffHat}
                            className="px-3 py-1 bg-purple-700 hover:bg-purple-600 rounded text-sm transition-colors border border-purple-500"
                        >
                            Dispel (Close)
                        </button>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 overflow-y-auto bg-gray-50 p-8 relative flex flex-col items-center justify-center">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-400 via-pink-500 to-red-500" />

                        <div className="border-4 border-dashed border-purple-300 rounded-xl p-12 text-center max-w-lg bg-white shadow-sm">
                            <div className="text-6xl mb-6">✨</div>
                            <h3 className="text-2xl font-bold text-gray-800 mb-2">Magic Sandbox Active</h3>
                            <p className="text-gray-600 mb-2 text-sm italic">
                                File: {currentSpell.target_component.file_path}
                            </p>
                            <p className="text-gray-700 mb-6 text-sm">
                                <b>Proposed:</b> {currentSpell.target_component.proposed_behavior}
                            </p>

                            {/* Live Mutation Preview Section */}
                            <div className="mt-8 mb-8 p-6 bg-slate-100 rounded-2xl border border-slate-200 shadow-inner">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Live Mutated Component Preview</p>
                                <div className="scale-90 origin-top pointer-events-auto">
                                    {/* Dynamic rendering based on spell_id */}
                                    {currentSpell.spell_id === 'kds-hello-world' && (
                                        <div className="flex justify-center flex-col items-center gap-4">
                                            <div className="bg-white p-4 rounded-xl shadow-lg border border-gray-200 w-64 relative overflow-hidden">
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="text-xl font-black">#42</span>
                                                    <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">NEW</span>
                                                </div>
                                                <div className="space-y-1 mb-4">
                                                    <div className="text-sm font-bold">1x Cappuccino</div>
                                                    <div className="text-sm font-bold">1x Croissant</div>
                                                </div>

                                                {/* ✨ THE HELLO WORLD BADGE ✨ */}
                                                <motion.div
                                                    initial={{ scale: 0 }}
                                                    animate={{ scale: 1 }}
                                                    className="absolute -right-8 -top-8 w-24 h-24 bg-green-500 rotate-45 flex items-end justify-center pb-2 shadow-lg"
                                                >
                                                    <span className="text-[8px] text-white font-black uppercase tracking-tighter">Hello World</span>
                                                </motion.div>
                                            </div>
                                            <p className="text-[10px] text-green-600 font-bold animate-pulse">✨ Logic Mutated Successfully</p>
                                        </div>
                                    )}
                                    {currentSpell.spell_id === 'pos-loyalty-charity' && (

                                        <div className="text-left font-sans">
                                            <div className="bg-white p-4 rounded-xl shadow border border-indigo-100">
                                                <div className="flex justify-between mb-2">
                                                    <span className="font-bold">Total</span>
                                                    <span className="font-black">₪42.50</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-xs text-pink-600 font-bold bg-pink-50 p-2 rounded-lg">
                                                    <div className="w-3 h-3 bg-pink-500 rounded-full animate-pulse" />
                                                    Round up for Charity? (+₪0.50)
                                                </div>
                                                <div className="mt-2 text-[10px] text-indigo-600 font-black">
                                                    ✨ Loyalty Points: 1,240 $BEAN
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="bg-purple-50 p-4 rounded-lg text-left text-sm text-purple-800 border border-purple-100 font-mono">
                                <b>Incantation:</b> {currentSpell.incantation}<br />
                                <b>Effect:</b> {currentSpell.effect}
                            </div>
                        </div>

                    </div>

                    {/* Footer */}
                    <div className="p-4 bg-white border-t border-gray-200 flex justify-between items-center z-10">
                        <div className="text-xs text-gray-500">
                            Correlation: {currentSpell.correlation_id.substring(0, 8)}...
                        </div>
                        <div className="flex gap-3">
                            <button
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded border border-gray-300"
                                onClick={takeOffHat}
                            >
                                Cancel
                            </button>
                            <button
                                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded shadow hover:shadow-lg transform hover:-translate-y-0.5 transition-all font-medium"
                                onClick={() => alert('Presto Promote functionality coming soon!')}
                            >
                                🪄 Presto Promote
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default AbraPreviewDrawer;
