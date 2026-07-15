import React, { useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Flame, Sparkles } from 'lucide-react';
import { useCachedImage } from '@/hooks/useCachedImage';
import { useTheme } from '@/context/ThemeContext';

const MenuItemCard = ({ item, onAddToCart, enhancingStatus }) => {
  const { isDarkMode } = useTheme();
  const [isHovered, setIsHovered] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Fallback for missing/broken image
  const fallbackImage = '/api/placeholder/400/300';

  // 🖼️ NEW: Use local cache if available
  const { displayUrl } = useCachedImage(item?.image_url || item?.image);

  const bgImage = imageError ? fallbackImage : (displayUrl || fallbackImage);

  const handleClick = useCallback((e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    onAddToCart?.(item);
  }, [item, onAddToCart]);

  const [touchStart, setTouchStart] = useState(null);

  const handleTouchStart = useCallback((e) => {
    const touch = e.touches[0];
    setTouchStart({ x: touch.clientX, y: touch.clientY });
  }, []);

  const handleTouchEnd = useCallback((e) => {
    if (!touchStart) return;
    const touch = e.changedTouches[0];
    const dx = Math.abs(touch.clientX - touchStart.x);
    const dy = Math.abs(touch.clientY - touchStart.y);
    setTouchStart(null);
    if (dx > 10 || dy > 10) return; // Ignore drag/scroll
    e.preventDefault();
    handleClick(e);
  }, [touchStart, handleClick]);

  // 🛡️ Extra safety for touch devices to prevent bubbling to parent listeners
  const stopPropagation = (e) => e.stopPropagation();

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  }, [handleClick]);

  const containerClass = useMemo(() =>
    isDarkMode
      ? 'bg-slate-900 border-slate-700 shadow-black/50'
      : 'bg-white border-slate-200 shadow-slate-200'
    , [isDarkMode]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -5, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className={`relative group w-full aspect-square compact-card-ratio rounded-3xl overflow-hidden cursor-pointer select-none 
        border shadow-2xl transition-colors duration-300
        ${containerClass}
        ${(item?.available === false || item?.is_in_stock === false) ? 'opacity-60 grayscale' : ''}`}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`${item?.name} - ${(item?.available !== false && item?.is_in_stock !== false) ? 'זמין' : 'לא זמין (לחץ לעריכה)'}`}
    >
      <div className={`absolute inset-0 z-0 ${isDarkMode ? 'bg-slate-900' : 'bg-slate-100'}`}>
        {!imageLoaded && (
          <div className={`w-full h-full animate-pulse ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`} />
        )}
        <img
          src={bgImage}
          alt={item?.name}
          loading="lazy"
          className={`w-full h-full object-cover transition-transform duration-700 ease-out 
            ${isHovered ? 'scale-110' : 'scale-100'} 
            ${!imageLoaded ? 'opacity-0' : 'opacity-100'}`}
          onLoad={() => setImageLoaded(true)}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-100" />
        {/* Studio Enhancement Overlay */}
        {enhancingStatus === 'enhancing' && (
          <div className="absolute inset-0 z-30">
            {/* Shimmer sweep */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent" style={{ animation: 'shimmer 2s infinite' }} />
            {/* Badge */}
            <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-600/90 text-white text-[10px] font-bold shadow-lg backdrop-blur-sm border border-indigo-400/30">
              <Sparkles size={10} className="animate-pulse" />
              <span>משדרג תמונה...</span>
            </div>
          </div>
        )}
        {enhancingStatus === 'done' && (
          <div className="absolute top-3 left-3 z-30 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/90 text-white text-[10px] font-bold shadow-lg backdrop-blur-sm border border-green-400/30 animate-bounce">
            <Sparkles size={10} />
            <span>תמונה שודרגה!</span>
          </div>
        )}
      </div>

      {(item?.available === false || item?.is_in_stock === false) && (
        <div className="absolute inset-0 z-20 bg-black/60 backdrop-blur-[2px] flex items-center justify-center">
          <div className="bg-red-500/90 text-white px-4 py-2 rounded-xl font-bold shadow-lg border border-red-400/30">
            לא זמין
          </div>
        </div>
      )}

      <div className="absolute inset-0 z-10 flex flex-col justify-between p-4 compact-padding-s">
        <div className="flex justify-end w-full">
          <div className="flex flex-col gap-2 items-end">
            {item?.isPopular && (
              <motion.div
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                className="px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 text-white text-xs font-bold shadow-lg flex items-center gap-1 backdrop-blur-md border border-white/20"
              >
                <Flame size={12} className="fill-white" />
                פופולרי
              </motion.div>
            )}
            {item?.isNew && (
              <div className="px-3 py-1 rounded-full bg-blue-600/90 text-white text-xs font-bold backdrop-blur-md border border-blue-400/30 shadow-lg">
                חדש
              </div>
            )}
          </div>
        </div>

        <div className="w-full transform transition-transform duration-300 group-hover:-translate-y-1">
          {item?.current_stock !== undefined && item?.current_stock !== null && (
            <div className="mb-2">
              <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-white text-[10px] font-black backdrop-blur-md border shadow-lg ${item.current_stock === 0 ? 'bg-rose-500/90 border-rose-400/30' : 'bg-emerald-500/90 border-emerald-400/30'}`}>
                <span className="opacity-80">
                  {item.inventory_settings?.prepType === 'defrost' ? 'מופשרים:' : 'מוכנים:'}
                </span>
                <span className="font-mono text-xs">{item.current_stock}</span>
              </div>
            </div>
          )}

          <div className="flex items-baseline justify-between gap-3" dir="rtl">
            <h3 className="text-xl font-bold text-white leading-tight drop-shadow-lg truncate flex-1 tracking-wide compact-text-lg">
              {item?.name}
            </h3>

            <div className="flex flex-col items-end shrink-0">
              {item?.originalPrice && (
                <span className="text-slate-400 text-xs line-through mb-[-2px]">
                  {item.originalPrice}
                </span>
              )}
              <span className={`font-black text-xl drop-shadow-lg compact-text-lg ${item?.originalPrice
                ? 'text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-400'
                : 'text-white'
                }`}>
                {item?.price}
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default React.memo(MenuItemCard);