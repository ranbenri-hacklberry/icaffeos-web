
import React, { useState, useCallback, useMemo } from 'react';
import { Flame } from 'lucide-react';

// Lite version of MenuItemCard - stripped of heavy motion args but keeping visual class
const LiteMenuItemCard = ({ item, onAddToCart }) => {
    const [isHovered, setIsHovered] = useState(false);
    const [imageLoaded, setImageLoaded] = useState(false);
    const isDarkMode = true; // Always dark/slate theme in Lite for now or derived

    const handleClick = useCallback(() => {
        onAddToCart?.(item);
    }, [item, onAddToCart]);

    // Fallback
    const fallbackImage = 'https://placehold.co/400x300/1e293b/cbd5e1?text=No+Image';

    return (
        <div
            className={`relative group w-full aspect-square rounded-3xl overflow-hidden cursor-pointer select-none 
        border shadow-2xl transition-colors duration-300
        ${isDarkMode ? 'bg-slate-900 border-slate-700 shadow-black/50' : 'bg-white border-slate-200'}
        ${item?.available === false ? 'opacity-60 grayscale' : ''}`}
            onClick={handleClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Background Image */}
            <div className={`absolute inset-0 z-0 ${isDarkMode ? 'bg-slate-900' : 'bg-slate-100'}`}>
                {!imageLoaded && (
                    <div className={`w-full h-full animate-pulse ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`} />
                )}
                <img
                    src={item?.image || fallbackImage}
                    alt={item?.name}
                    className={`w-full h-full object-cover transition-transform duration-700 ease-out 
            ${isHovered ? 'scale-110' : 'scale-100'} 
            ${!imageLoaded ? 'opacity-0' : 'opacity-100'}`}
                    onLoad={() => setImageLoaded(true)}
                    onError={(e) => { e.target.src = fallbackImage; setImageLoaded(true); }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-100" />
            </div>

            {/* Unavailable Overlay */}
            {item?.available === false && (
                <div className="absolute inset-0 z-20 bg-black/60 backdrop-blur-[2px] flex items-center justify-center">
                    <div className="bg-red-500/90 text-white px-4 py-2 rounded-xl font-bold shadow-lg border border-red-400/30">
                        לא זמין
                    </div>
                </div>
            )}

            {/* Content */}
            <div className="absolute inset-0 z-10 flex flex-col justify-between p-4">
                {/* Badges */}
                <div className="flex justify-end w-full">
                    <div className="flex flex-col gap-2 items-end">
                        {item?.isPopular && (
                            <div className="px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 text-white text-xs font-bold shadow-lg flex items-center gap-1 backdrop-blur-md border border-white/20">
                                <Flame size={12} className="fill-white" />
                                פופולרי
                            </div>
                        )}
                    </div>
                </div>

                {/* Text */}
                <div className="w-full transform transition-transform duration-300 group-hover:-translate-y-1">
                    {item?.current_stock !== undefined && item?.current_stock !== null && (
                        <div className="mb-2">
                            <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-white text-[10px] font-black backdrop-blur-md border shadow-lg ${item.current_stock === 0 ? 'bg-rose-500/90 border-rose-400/30' : 'bg-emerald-500/90 border-emerald-400/30'}`}>
                                <span className="opacity-80">
                                    {item.inventory_settings?.prepType === 'defrost' ? 'מופשרים:' : 'מוכנים:'}
                                </span>
                                <span className="font-mono text-xs">{item.current_stock}</span>
                            </div>
                        </div>
                    )}

                    <div className="flex items-baseline justify-between gap-3" dir="rtl">
                        <h3 className="text-xl font-bold text-white leading-tight drop-shadow-lg truncate flex-1 tracking-wide">
                            {item?.name}
                        </h3>
                        <div className="flex flex-col items-end shrink-0">
                            <span className="font-black text-xl text-white drop-shadow-lg">
                                ₪{item?.price}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default React.memo(LiteMenuItemCard);
