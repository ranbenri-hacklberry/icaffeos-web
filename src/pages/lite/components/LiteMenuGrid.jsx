
import React, { useState, useEffect, useMemo, useRef } from 'react';
import LiteMenuItemCard from '@/pages/lite/components/LiteMenuItemCard';
import { Search } from 'lucide-react';

const LiteMenuGrid = ({ items = [], onAddToCart, isLoading = false }) => {
    const isDarkMode = true;

    // Simple category derivation for tabs
    const categories = useMemo(() => {
        const cats = new Set(items.map(i => i.category || 'כללי').filter(Boolean));
        return ['הכל', ...Array.from(cats).sort()];
    }, [items]);

    const [activeCategory, setActiveCategory] = useState('הכל');
    const [searchTerm, setSearchTerm] = useState('');

    const filteredItems = useMemo(() => {
        let res = items.filter(i => {
            // 🆕 Filter hidden POS items
            // Check both snake_case (DB) and camelCase (Local)
            const visible = (i.is_visible_pos !== false) && (i.isVisiblePos !== false);
            return visible;
        });

        if (activeCategory !== 'הכל') {
            res = res.filter(i => (i.category || 'כללי') === activeCategory);
        }
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            res = res.filter(i => i.name.toLowerCase().includes(lower));
        }
        return res;
    }, [items, activeCategory, searchTerm]);

    // Handle category click - with scroll to top logic if needed
    const handleCategoryClick = (cat) => {
        setActiveCategory(cat);
        // Optional: reset search
        // setSearchTerm('');
    };

    if (isLoading) {
        return <div className="p-10 text-center text-white text-xl animate-pulse">טוען תפריט...</div>;
    }

    return (
        <div className="flex flex-col h-full bg-slate-900 border-l border-slate-800" dir="rtl">
            {/* Search & Filter Header (Sticky) */}
            <div className="p-4 bg-slate-900 sticky top-0 z-20 shadow-lg shrink-0">
                {/* Search */}
                <div className="relative mb-4">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="חיפוש בתפריט..."
                        className="w-full bg-slate-800 text-white rounded-xl py-3 pr-10 pl-4 border border-slate-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all placeholder:text-slate-500 font-medium"
                    />
                </div>

                {/* Category Tabs */}
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => handleCategoryClick(cat)}
                            className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all border ${activeCategory === cat
                                ? 'bg-amber-500 text-white border-amber-600 shadow-amber-900/20 shadow-lg'
                                : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-slate-200'
                                }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {filteredItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                        <Search size={48} className="mb-2 opacity-50" />
                        <p>לא נמצאו פריטים</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 pb-20">
                        {filteredItems.map(item => (
                            <LiteMenuItemCard
                                key={item.id}
                                item={item}
                                onAddToCart={onAddToCart}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default LiteMenuGrid;
