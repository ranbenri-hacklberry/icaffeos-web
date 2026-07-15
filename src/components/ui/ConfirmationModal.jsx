import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle, CheckCircle, HelpCircle } from 'lucide-react';

const ConfirmationModal = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'אישור',
    cancelText = 'ביטול',
    variant = 'info', // 'info', 'danger', 'success', 'warning'
    icon
}) => {
    // Determine styles based on variant
    const getVariantStyles = () => {
        switch (variant) {
            case 'danger':
                return {
                    iconBg: 'bg-red-100',
                    iconColor: 'text-red-600',
                    buttonBg: 'bg-red-600 hover:bg-red-700',
                    icon: <AlertTriangle size={32} />
                };
            case 'success':
                return {
                    iconBg: 'bg-green-100',
                    iconColor: 'text-green-600',
                    buttonBg: 'bg-green-600 hover:bg-green-700',
                    icon: <CheckCircle size={32} />
                };
            case 'warning':
                return {
                    iconBg: 'bg-amber-100',
                    iconColor: 'text-amber-600',
                    buttonBg: 'bg-amber-600 hover:bg-amber-700',
                    icon: <AlertTriangle size={32} />
                };
            default: // info
                return {
                    iconBg: 'bg-blue-100',
                    iconColor: 'text-blue-600',
                    buttonBg: 'bg-blue-600 hover:bg-blue-700',
                    icon: <HelpCircle size={32} />
                };
        }
    };

    const styles = getVariantStyles();
    const IconComponent = icon || styles.icon;

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 font-sans" dir="rtl">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                    />

                    {/* Modal Content */}
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-white/20"
                    >
                        {/* Header Pattern/Decoration */}
                        <div className={`absolute top-0 right-0 w-32 h-32 ${styles.iconBg} rounded-full blur-3xl -mr-16 -mt-16 opacity-50 pointer-events-none`} />
                        <div className={`absolute bottom-0 left-0 w-24 h-24 ${styles.iconBg} rounded-full blur-3xl -ml-12 -mb-12 opacity-50 pointer-events-none`} />

                        <div className="p-8 relative z-10 flex flex-col items-center text-center">
                            {/* Icon */}
                            <div className={`w-20 h-20 ${styles.iconBg} ${styles.iconColor} rounded-full flex items-center justify-center mb-6 shadow-sm`}>
                                {IconComponent}
                            </div>

                            {/* Text */}
                            <h3 className="text-2xl font-black text-slate-800 mb-2">
                                {title}
                            </h3>
                            <p className="text-slate-500 font-medium mb-8 leading-relaxed">
                                {message}
                            </p>

                            {/* Buttons */}
                            <div className="flex gap-3 w-full">
                                <button
                                    onClick={onClose}
                                    className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-xl font-bold text-lg hover:bg-slate-200 transition-colors"
                                >
                                    {cancelText}
                                </button>
                                <button
                                    onClick={() => {
                                        onConfirm();
                                        onClose();
                                    }}
                                    className={`flex-1 py-4 ${styles.buttonBg} text-white rounded-xl font-bold text-lg shadow-lg shadow-black/5 transition-all active:scale-95`}
                                >
                                    {confirmText}
                                </button>
                            </div>
                        </div>

                        {/* Close X */}
                        <button
                            onClick={onClose}
                            className="absolute top-4 left-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default ConfirmationModal;
