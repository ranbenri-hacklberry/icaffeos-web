import React from 'react';
import { Edit2, Image as ImageIcon, Eye, EyeOff, Flame, ShoppingBag, GitBranch } from 'lucide-react';

const MenuManagerCard = ({
    item = null,
    onClick = () => { },
    onToggleAvailability = () => { }
}) => {
    // 🛡️ בדיקת props בסיסית
    if (!item) {
        return (
            <div className="w-full h-20 bg-gray-100 rounded-xl animate-pulse flex items-center justify-center">
                <span className="text-gray-400 text-sm">פריט חסר</span>
            </div>
        );
    }

    // 🛡️ בדיקת נתונים בטוחה
    const safeItem = {
        id: item.id,
        name: item.name || 'ללא שם',
        price: item.price || 0,
        category: item.category || 'ללא קטגוריה',
        image_url: item.image_url || null,
        is_in_stock: item.is_in_stock ?? true,
        // Sale fields
        sale_price: item.sale_price,
        sale_start_date: item.sale_start_date,
        sale_end_date: item.sale_end_date,
        sale_start_time: item.sale_start_time,
        sale_end_time: item.sale_end_time,
        kds_routing_logic: item.kds_routing_logic // Pass through KDS logic
    };

    const isAvailable = safeItem.is_in_stock !== false;

    // Check sale state
    const saleInfo = React.useMemo(() => {
        // Ignore if no sale price, or if sale price equals regular price (not a real sale)
        if (!safeItem.sale_price || Number(safeItem.sale_price) === 0 || Number(safeItem.sale_price) === Number(safeItem.price)) {
            return { state: 'none' };
        }

        const now = new Date();
        let start = null;
        let end = null;

        // Parse start
        if (safeItem.sale_start_date) {
            try {
                start = new Date(`${safeItem.sale_start_date}T${safeItem.sale_start_time || '00:00'}`);
            } catch (e) { }
        }

        // Parse end
        if (safeItem.sale_end_date) {
            try {
                end = new Date(`${safeItem.sale_end_date}T${safeItem.sale_end_time || '23:59:59'}`);
            } catch (e) { }
        }

        // Determine state
        if (start && now < start) {
            // Future sale
            const diffMs = start - now;
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            const diffDays = Math.floor(diffHours / 24);
            const remainingHours = diffHours % 24;

            let timeLabel = '';
            if (diffDays > 0) timeLabel = `${diffDays} ימים ו-${remainingHours} שעות`;
            else timeLabel = `${diffHours} שעות`;

            return { state: 'future', timeLabel, price: safeItem.sale_price };
        } else if ((!start || now >= start) && (!end || now <= end)) {
            // Active sale
            return { state: 'active', price: safeItem.sale_price };
        }

        return { state: 'none' };
    }, [safeItem.sale_price, safeItem.sale_start_date, safeItem.sale_end_date, safeItem.sale_start_time, safeItem.sale_end_time]);

    // Pass the original item with ID to onClick for proper editing
    const handleCardClick = () => onClick?.(item);
    const handleToggle = (e) => {
        e.stopPropagation();
        onToggleAvailability?.(item);
    };

    return (
        <div
            className={`bg-white rounded-xl shadow-sm border border-gray-100 p-2 pr-2 flex items-center gap-3 relative transition-all cursor-pointer group h-[88px]
                ${!isAvailable
                    ? 'opacity-60 bg-gray-50'
                    : 'hover:shadow-md hover:border-blue-200 hover:bg-blue-50/50'
                }`}
            dir="rtl"
            role="button"
            tabIndex={0}
            onClick={handleCardClick}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    handleCardClick();
                }
            }}
            aria-label={`ניהול פריט: ${safeItem.name}`}
        >
            {/* 🖼️ Image Section */}
            <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 relative">
                {safeItem.image_url ? (
                    <img
                        src={safeItem.image_url}
                        alt={safeItem.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                        }}
                    />
                ) : null}
                <div className={`absolute inset-0 flex items-center justify-center text-gray-300 transition-opacity duration-200 ${safeItem.image_url ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'
                    }`}>
                    <ImageIcon size={20} />
                </div>
                {/* Sale Badge */}
                {saleInfo.state === 'active' && (
                    <div className="absolute top-0 right-0 bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-bl-lg animate-pulse">
                        SALE
                    </div>
                )}
                {saleInfo.state === 'future' && (
                    <div className="absolute top-0 right-0 bg-amber-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-bl-lg">
                        בקרוב
                    </div>
                )}

                {/* KDS Routing Badge */}
                {(() => {
                    const routing = safeItem.kds_routing_logic;
                    if (routing === 'MADE_TO_ORDER') {
                        return (
                            <div className="absolute bottom-0 right-0 bg-orange-500/90 backdrop-blur-sm text-white p-1 rounded-tl-lg shadow-sm" title="דורש הכנה">
                                <Flame size={10} strokeWidth={3} />
                            </div>
                        );
                    }
                    if (routing === 'GRAB_AND_GO') {
                        return (
                            <div className="absolute bottom-0 right-0 bg-emerald-500/90 backdrop-blur-sm text-white p-1 rounded-tl-lg shadow-sm" title="מוכן להגשה (Grab & Go)">
                                <ShoppingBag size={10} strokeWidth={3} />
                            </div>
                        );
                    }
                    if (routing === 'CONDITIONAL') {
                        return (
                            <div className="absolute bottom-0 right-0 bg-purple-500/90 backdrop-blur-sm text-white p-1 rounded-tl-lg shadow-sm" title="מותנה (לפי בחירת קופאי)">
                                <GitBranch size={10} strokeWidth={3} />
                            </div>
                        );
                    }
                    return null;
                })()}
            </div>

            {/* 📝 Content Section */}
            <div className="flex-1 flex flex-col justify-center min-w-0 py-1 h-full">
                {/* Title */}
                <h3 className="font-bold text-gray-800 text-sm leading-tight truncate pr-1 mb-1">
                    {safeItem.name}
                </h3>

                {/* Price Display (Under Title) */}
                <div className="pr-1">
                    {saleInfo.state === 'active' ? (
                        <div className="flex items-baseline gap-2">
                            <span className="text-base font-black text-red-500">
                                ₪{safeItem.sale_price}
                            </span>
                            <span className="text-[11px] text-gray-400 line-through">
                                ₪{safeItem.price}
                            </span>
                        </div>
                    ) : saleInfo.state === 'future' ? (
                        <div>
                            <span className="text-sm font-bold text-blue-600 block">
                                ₪{Number(safeItem.price).toFixed(2)}
                            </span>
                            <span className="text-[10px] text-amber-600 font-bold block mt-0.5">
                                ₪{saleInfo.price} בעוד {saleInfo.timeLabel}
                            </span>
                        </div>
                    ) : (
                        <span className="text-sm font-bold text-blue-600">
                            ₪{Number(safeItem.price).toFixed(2)}
                        </span>
                    )}
                </div>
            </div>

            {/* 🔧 Actions Section - Eye Button */}
            <div className="pl-1 flex-shrink-0 flex flex-col justify-center">
                <button
                    onClick={handleToggle}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 shadow-sm hover:shadow-md 
                        ${isAvailable
                            ? 'bg-green-50 text-green-600 hover:bg-green-100 border border-green-200'
                            : 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
                        }`}
                    title={isAvailable ? 'הסתר פריט' : 'הצג פריט'}
                    aria-label={isAvailable ? 'הסתר פריט' : 'הצג פריט'}
                >
                    {isAvailable ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
            </div>
        </div>
    );
};

export default React.memo(MenuManagerCard);
