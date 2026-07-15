import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, ShoppingCart, Info, Sun, Droplets,
    Wind, Heart, MessageCircle, AlertCircle, Plus, Minus,
    ChevronLeft, TreePine
} from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { useCachedImage } from '@/hooks/useCachedImage';

const ProductDetailModal = ({ isOpen, item, onClose, onAddToCart }) => {
    const { isDarkMode } = useTheme();
    const [quantity, setQuantity] = useState(1);
    const { displayUrl } = useCachedImage(item?.image || item?.image_url);

    if (!isOpen || !item) return null;

    const hasDetails = item.description || (item.metadata && (item.metadata.sun || item.metadata.water));

    // WhatsApp link for Nati
    const whatsappNumber = "972502220475"; // Placeholder number, adjust if known
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(`היי נתי, אשמח לקבל פרטים נוספים על ${item.name}`)}`;

    const handleAdd = () => {
        onAddToCart({ ...item, quantity });
        onClose();
    };

    const careIcons = [
        { id: 'sun', icon: Sun, label: 'אור', value: item.metadata?.sun || 'שמש חלקית' },
        { id: 'water', icon: Droplets, label: 'השקיה', value: item.metadata?.water || 'פעם בשבוע' },
        { id: 'difficulty', icon: Wind, label: 'קושי', value: item.metadata?.difficulty || 'קל לגידול' },
        { id: 'temp', icon: Heart, label: 'עמידות', value: item.metadata?.temp || 'גבוהה' },
    ];

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[1000] flex items-center justify-center p-4 md:p-8 lg:p-12 bg-black/80 backdrop-blur-md overflow-hidden"
                onClick={onClose}
                dir="rtl"
            >
                <motion.div
                    initial={{ scale: 0.9, y: 20, opacity: 0 }}
                    animate={{ scale: 1, y: 0, opacity: 1 }}
                    exit={{ scale: 0.9, y: 20, opacity: 0 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    className={`relative w-full max-w-5xl max-h-[90vh] flex flex-col md:flex-row rounded-[2.5rem] overflow-hidden shadow-2xl ${isDarkMode ? 'bg-slate-900 text-white' : 'bg-white text-slate-800'
                        }`}
                    onClick={e => e.stopPropagation()}
                >
                    {/* Close Button - Mobile Floating */}
                    <button
                        onClick={onClose}
                        className="absolute top-6 left-6 z-50 w-12 h-12 flex items-center justify-center bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-2xl text-white transition-all active:scale-95 shadow-lg border border-white/10"
                    >
                        <X size={24} />
                    </button>

                    {/* Left Side: Product Hero Image */}
                    <div className="relative w-full md:w-1/2 h-64 md:h-auto overflow-hidden">
                        <img
                            src={displayUrl || '/api/placeholder/800/800'}
                            alt={item.name}
                            className="w-full h-full object-cover"
                        />
                        {/* Gradient Overlay for bottom text of image on mobile */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent md:hidden" />

                        {/* Category Badge */}
                        <div className="absolute top-6 right-6 hidden md:block">
                            <div className="bg-emerald-500/90 backdrop-blur-md text-white px-4 py-1.5 rounded-full text-sm font-bold shadow-lg border border-emerald-400/30 flex items-center gap-2">
                                <TreePine size={16} />
                                {item.category || 'צמחיה'}
                            </div>
                        </div>
                    </div>

                    {/* Right Side: Content Area */}
                    <div className="flex-1 flex flex-col p-8 md:p-12 overflow-y-auto custom-scrollbar">
                        {/* Header Info */}
                        <div className="mb-8">
                            <div className="flex items-center gap-2 text-emerald-500 font-bold mb-2 md:hidden">
                                <TreePine size={18} />
                                <span>{item.category || 'צמחיה'}</span>
                            </div>
                            <h1 className="text-4xl md:text-5xl font-black mb-4 leading-tight tracking-tight">
                                {item.name}
                            </h1>
                            <div className="flex items-center gap-4 mb-2">
                                <span className="text-3xl font-bold text-emerald-500">{item.price} ₪</span>
                                {item.originalPrice && (
                                    <span className="text-xl text-slate-400 line-through decoration-red-500/50">{item.originalPrice} ₪</span>
                                )}
                            </div>
                        </div>

                        {/* Care Guide / Details */}
                        {hasDetails ? (
                            <div className="space-y-8">
                                {/* Visual Care Icons */}
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                    {careIcons.map(({ id, icon: Icon, label, value }) => (
                                        <div key={id} className={`p-4 rounded-[1.5rem] border ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'
                                            } flex flex-col items-center gap-2 text-center transition-all hover:shadow-md`}>
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDarkMode ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-600'
                                                }`}>
                                                <Icon size={20} />
                                            </div>
                                            <span className="text-xs font-bold text-slate-400">{label}</span>
                                            <span className="text-sm font-bold truncate w-full">{value}</span>
                                        </div>
                                    ))}
                                </div>

                                {/* Main Description */}
                                <div className="prose prose-emerald max-w-none">
                                    <h3 className={`text-xl font-bold mb-4 flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-slate-800'
                                        }`}>
                                        <Info size={20} className="text-emerald-500" />
                                        קצת על הצמח
                                    </h3>
                                    <p className={`text-lg leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-600'
                                        }`}>
                                        {item.description || "הזמיקוקולוס הוא מלך צמחי הבית. עם עלים בשרניים, מבריקים בצבע ירוק כהה שצומחים בצורה זקופה ומרשימה, הוא משדרג מיידית כל חלל – מהסלון ועד המשרד. הסוד שלו? הוא אוגר מים בפקעות מתחת לאדמה, מה שהופך אותו לאחד הצמחים הכי פחות תובעניים שיש."}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            /* Cute Placeholder for missing details */
                            <div className={`flex-1 flex flex-col items-center justify-center p-8 rounded-[2rem] border-2 border-dashed ${isDarkMode ? 'bg-slate-800/30 border-slate-700' : 'bg-emerald-50/50 border-emerald-100'
                                } text-center`}>
                                <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6 animate-bounce">
                                    <MessageCircle size={40} className="text-emerald-600 fill-emerald-600/20" />
                                </div>
                                <h3 className="text-2xl font-bold mb-3">פרטים נוספים עושים דרכם...</h3>
                                <p className={`max-w-xs mb-8 text-lg ${isDarkMode ? 'text-slate-400' : 'text-slate-600'
                                    }`}>
                                    עוד לא הספקנו להוציא תעודת זהות רשמית ל-{item.name}, אבל נתי מכיר כל עלה וכל ענף שלו!
                                </p>
                                <a
                                    href={whatsappUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-3 px-8 py-4 bg-[#25D366] text-white rounded-2xl font-bold text-lg shadow-xl hover:scale-105 transition-transform active:scale-95"
                                >
                                    <MessageCircle size={24} />
                                    דברו עם נתי בווטסאפ
                                </a>
                            </div>
                        )}

                        {/* Bottom Actions - Fixed at Bottom of content */}
                        <div className={`mt-auto pt-8 flex flex-col sm:flex-row items-center gap-4 sticky bottom-0 ${isDarkMode ? 'bg-slate-900/90' : 'bg-white/90'
                            } backdrop-blur-sm`}>
                            {/* Quantity Selector */}
                            <div className={`flex items-center p-1.5 rounded-2xl border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
                                }`}>
                                <button
                                    onClick={() => setQuantity(q => Math.max(1, q - 1))}
                                    className={`w-12 h-12 flex items-center justify-center rounded-xl transition-all active:scale-90 ${isDarkMode ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-white hover:bg-slate-100 text-slate-600 shadow-sm'
                                        }`}
                                >
                                    <Minus size={20} strokeWidth={3} />
                                </button>
                                <span className="w-16 text-center text-xl font-black tabular-nums">{quantity}</span>
                                <button
                                    onClick={() => setQuantity(q => q + 1)}
                                    className="w-12 h-12 flex items-center justify-center rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 active:scale-90 transition-all shadow-md"
                                >
                                    <Plus size={20} strokeWidth={3} />
                                </button>
                            </div>

                            {/* Add to Cart Button */}
                            <button
                                onClick={handleAdd}
                                className="flex-1 w-full flex items-center justify-center gap-4 py-4 px-8 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xl shadow-xl shadow-emerald-500/20 active:scale-95 transition-all"
                            >
                                <ShoppingCart size={24} />
                                הוספה לעגלה • {(item.price * quantity).toFixed(0)} ₪
                            </button>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default ProductDetailModal;
