import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Plus, Loader2 } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { useMenuItems } from '@/pages/menu-ordering-interface/hooks/useMenuItems';
import MenuItemCard from '@/pages/menu-ordering-interface/components/MenuItemCard';

/**
 * PreviewPanel - Right side panel showing menu items grid
 */
const MOCK_PLACEHOLDERS = [
    { id: 'mock_1', name: 'הפוךגדול', price: 16, category: 'שתיה חמה', image: '/cafe-images/item_84_קפוצ׳ינו.png', description: 'קפה איכותי עם חלב מוקצף' },
    { id: 'mock_2', name: 'אספרסו', price: 9, category: 'שתיה חמה', image: '/cafe-images/item_74_אספרסו_כפול.png', description: 'קצר וחזק' },
    { id: 'mock_3', name: 'סלטיווני', price: 42, category: 'סלטים', image: '/cafe-images/item_3_סלט_חסלק.png', description: 'ירקות טריים עם גבינת פטה' },
    { id: 'mock_4', name: 'כריךסלק', price: 38, category: 'טוסטים וכריכים', image: '/cafe-images/item_5_כריך_סלק.png', description: 'לחם מחמצת עם סלק וגבינה' }
];

const DEFAULT_CATEGORIES = ['שתיה חמה', 'שתיה קרה', 'מאפים', 'סלטים', 'טוסטים וכריכים'];

/**
 * PreviewPanel - Local-First version for Editor
 */
const PreviewPanel = ({ onItemSelect, activeId, localItems }) => {
    const { isDarkMode } = useTheme();

    // Use local items (from DB or uploaded file)
    const items = useMemo(() => {
        return localItems || [];
    }, [localItems]);

    const categories = useMemo(() => {
        const unique = [...new Set(items.map(i => i.category))].filter(Boolean);
        return unique.length > 0 ? unique : DEFAULT_CATEGORIES;
    }, [items]);

    const [activeCategory, setActiveCategory] = useState(categories[0]);

    // Update active category if current one disappears
    useEffect(() => {
        if (!categories.includes(activeCategory)) {
            setActiveCategory(categories[0]);
        }
    }, [categories, activeCategory]);

    const filteredItems = useMemo(() => {
        return items.filter(item => item.category === activeCategory);
    }, [items, activeCategory]);

    const handleQuickAdd = () => {
        const newItem = {
            id: `local_${Date.now()}`,
            name: 'מנה חדשה',
            price: 0,
            category: activeCategory,
            description: '',
            image: null
        };
        onItemSelect(newItem);
    };

    // Items Grid
    return (
        <div className="h-full flex flex-col">
            {categories.length > 0 && (
                <div className="mb-6 overflow-x-auto pb-2 scrollbar-hide">
                    <div className="flex gap-2">
                        {categories.map((cat) => (
                            <motion.button
                                key={cat}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setActiveCategory(cat)}
                                className={`px-6 py-2.5 rounded-2xl text-sm font-bold whitespace-nowrap transition-all shadow-sm ${activeCategory === cat
                                    ? 'bg-orange-500 text-white shadow-orange-200'
                                    : isDarkMode
                                        ? 'bg-slate-800 text-slate-400 border border-slate-700'
                                        : 'bg-white text-slate-500 border border-slate-100 hover:bg-slate-50'
                                    }`}
                            >
                                {cat}
                            </motion.button>
                        ))}
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-y-auto pr-1">
                {items.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center gap-4 text-center">
                        <div className={`p-8 rounded-full ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
                            <Loader2 size={48} className="animate-spin text-orange-500 opacity-20" />
                        </div>
                        <div>
                            <h3 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>אין פריטים להצגה</h3>
                            <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>העלה קובץ או הוסף פריט באופן ידני</p>
                        </div>
                        <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={handleQuickAdd}
                            className="px-8 py-3 bg-orange-500 text-white rounded-2xl font-black shadow-lg shadow-orange-200"
                        >
                            הוסף פריט ראשון
                        </motion.button>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 pb-20">
                        {filteredItems.map((item) => (
                            <motion.div
                                key={item.id}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => onItemSelect(item)}
                                className={`cursor-pointer rounded-2xl overflow-hidden transition-all ${activeId === item.id ? 'ring-4 ring-orange-500 ring-offset-4 shadow-2xl' : ''} ${isDarkMode ? 'ring-offset-slate-900' : 'ring-offset-white'}`}
                            >
                                <MenuItemCard
                                    item={item}
                                    onAddToCart={() => onItemSelect(item)}
                                />
                            </motion.div>
                        ))}

                        {/* Quick Add Card */}
                        <motion.button
                            whileHover={{ scale: 1.02, y: -4 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleQuickAdd}
                            className={`aspect-square rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all group ${isDarkMode
                                ? 'border-slate-700 bg-slate-800/30 hover:border-orange-500 hover:bg-slate-800'
                                : 'border-slate-200 bg-white hover:border-orange-400 hover:shadow-xl'
                                }`}
                        >
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isDarkMode ? 'bg-slate-700 group-hover:bg-orange-500/20' : 'bg-slate-50 group-hover:bg-orange-50'}`}>
                                <Plus size={24} className={`transition-colors ${isDarkMode ? 'text-slate-500 group-hover:text-orange-500' : 'text-slate-400 group-hover:text-orange-400'}`} />
                            </div>
                            <span className={`text-sm font-black ${isDarkMode ? 'text-slate-500 group-hover:text-orange-500' : 'text-slate-400 group-hover:text-orange-400'}`}>הוספה למקומי</span>
                        </motion.button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PreviewPanel;
