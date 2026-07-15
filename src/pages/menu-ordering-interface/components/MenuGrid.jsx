import React from 'react';
import MenuItemCard from './MenuItemCard';
import { motion } from 'framer-motion';
import Icon from '../../../components/AppIcon';
import { useTheme } from '../../../context/ThemeContext';

const MenuGrid = ({ items = [], onAddToCart, isLoading = false, groupedItems = null, categories = [], enhancingItems = {} }) => {
  const { isDarkMode } = useTheme();

  // 🚩 TRACE: MenuGrid Render Log
  console.log('📋 [MenuGrid Render]:', categories.length, 'categories');


  if (isLoading) {
    return (
      <div className="p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 responsive-menu-grid">
          {Array.from({ length: 10 })?.map((_, index) => (
            <motion.div
              key={`skeleton-${index}`}
              initial={{ opacity: 0.5 }}
              animate={{ opacity: [0.5, 0.8, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              className={`rounded-3xl overflow-hidden aspect-square border shadow-xl ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-100'
                }`}
            >
              <div className={`h-full w-full relative ${isDarkMode ? 'bg-slate-700/30' : 'bg-gray-100/50'}`}>
                <div className="absolute bottom-0 left-0 right-0 p-4 space-y-2">
                  <div className={`h-4 rounded-full w-3/4 ${isDarkMode ? 'bg-slate-600/50' : 'bg-gray-200'}`}></div>
                  <div className="flex justify-between items-center">
                    <div className={`h-6 rounded-lg w-16 ${isDarkMode ? 'bg-slate-600/50' : 'bg-gray-200'}`}></div>
                    <div className={`h-8 rounded-full w-8 ${isDarkMode ? 'bg-slate-600/50' : 'bg-gray-200'}`}></div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  if (items?.length === 0 && !groupedItems) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 mt-10" dir="rtl">
        <div className={`rounded-full p-8 mb-6 transition-colors duration-300 ${isDarkMode ? 'bg-slate-800' : 'bg-gray-100'}`}>
          <Icon name="Search" size={56} className={isDarkMode ? 'text-slate-600' : 'text-gray-400'} />
        </div>
        <h3 className={`text-2xl font-bold mb-2 transition-colors duration-300 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
          לא נמצאו פריטים
        </h3>
        <p className={`text-center max-w-md transition-colors duration-300 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          נסה לבחור קטגוריה אחרת או חזור לתפריט הראשי
        </p>
      </div>
    );
  }

  // If we have grouped items, render each group in its own row
  if (groupedItems && groupedItems.length > 0) {
    return (
      <div className="p-4 space-y-4">
        {groupedItems.map((group, groupIndex) => (
          <div key={group.title || groupIndex}>
            {/* Group Title - optional */}
            {group.showTitle && (
              <h3 className={`text-sm font-bold mb-3 pr-1 transition-colors duration-300 ${isDarkMode ? 'text-slate-500' : 'text-gray-500'}`} dir="rtl">
                {group.title}
              </h3>
            )}
              {/* Items in this group */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 responsive-menu-grid">
              {group.items?.map((item) => (
                <MenuItemCard
                  key={item?.id}
                  item={item}
                  onAddToCart={onAddToCart}
                  enhancingStatus={enhancingItems[item?.id]}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Default: flat list
  return (
    <div className="p-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 responsive-menu-grid">
        {items?.map((item) => (
          <MenuItemCard
            key={item?.id}
            item={item}
            onAddToCart={onAddToCart}
            enhancingStatus={enhancingItems[item?.id]}
          />
        ))}
      </div>
    </div>
  );
};

export default MenuGrid;