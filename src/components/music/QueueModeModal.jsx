import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Sparkles, X } from 'lucide-react';

const QueueModeModal = ({ isOpen, onClose, onSelect, title }) => {
    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                />
                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    className="relative w-full max-w-sm bg-[#1a1a2e] rounded-[2.5rem] border border-white/10 shadow-2xl overflow-hidden p-8"
                    dir="rtl"
                >
                    <button
                        onClick={onClose}
                        className="absolute top-6 left-6 w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                    >
                        <X className="w-5 h-5 text-white/40" />
                    </button>

                    <div className="text-center mb-8 mt-4">
                        <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto mb-4">
                            <Sparkles className="w-8 h-8 text-purple-400" />
                        </div>
                        <h3 className="text-white text-2xl font-black mb-2">הוספה לתור</h3>
                        <p className="text-white/40 font-medium">כיצד תרצה להוסיף את "{title}"?</p>
                    </div>

                    <div className="grid gap-3">
                        <button
                            onClick={() => onSelect('next')}
                            className="flex items-center gap-4 p-5 rounded-3xl bg-white/5 hover:bg-purple-500 transition-all group text-right"
                        >
                            <div className="w-12 h-12 rounded-2xl bg-purple-500/20 group-hover:bg-white/20 flex items-center justify-center">
                                <Play className="w-6 h-6 text-purple-400 group-hover:text-white fill-current" />
                            </div>
                            <div>
                                <h4 className="text-white font-bold text-lg">נגן אחרי השיר הנוכחי</h4>
                                <p className="text-white/40 group-hover:text-white/60 text-sm">הבחירה תופיע בראש התור</p>
                            </div>
                        </button>

                        <button
                            onClick={() => onSelect('shuffle')}
                            className="flex items-center gap-4 p-5 rounded-3xl bg-white/5 hover:bg-blue-500 transition-all group text-right"
                        >
                            <div className="w-12 h-12 rounded-2xl bg-blue-500/20 group-hover:bg-white/20 flex items-center justify-center">
                                <Sparkles className="w-6 h-6 text-blue-400 group-hover:text-white" />
                            </div>
                            <div>
                                <h4 className="text-white font-bold text-lg">ערבב לתוך התור</h4>
                                <p className="text-white/40 group-hover:text-white/60 text-sm">התוכן ישולב באופן אקראי ברשימה</p>
                            </div>
                        </button>
                    </div>

                    <button
                        onClick={onClose}
                        className="w-full mt-6 py-4 text-white/20 hover:text-white/40 font-bold transition-colors"
                    >
                        ביטול
                    </button>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default QueueModeModal;
