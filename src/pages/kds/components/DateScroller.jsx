import React, { useRef, useEffect, useState } from 'react';

const DateScroller = ({ selectedDate, onDateChange }) => {
    const containerRef = useRef(null);
    const [dates, setDates] = useState([]);
    const ITEM_WIDTH = 100;

    // 1. Generate Dates: PAST -> TODAY
    useEffect(() => {
        const tempDates = [];
        const range = 60;
        const today = new Date();

        // List: [Today, Yesterday, ..., -60]
        for (let i = 0; i >= -range; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() + i);
            tempDates.push(d);
        }
        setDates(tempDates);
    }, []);

    // 2. Initial Center & External Selection Changes
    const isManualScroll = useRef(false);

    useEffect(() => {
        if (dates.length > 0 && containerRef.current) {
            // Find current selected index
            const index = dates.findIndex(d =>
                d.toDateString() === selectedDate.toDateString()
            );
            const targetIndex = index === -1 ? 0 : index;

            // If this change came from outside (not manual scroll), scroll to it smoothly
            if (!isManualScroll.current) {
                scrollToIndex(targetIndex, 'smooth');
            }

            // Reset flag after any change
            isManualScroll.current = false;
        }
    }, [selectedDate, dates.length]);

    // 3. Scroll Helper
    const scrollToIndex = (index, behavior = 'smooth') => {
        const container = containerRef.current;
        if (!container) return;
        const targetEl = container.children[index];
        if (targetEl) {
            targetEl.scrollIntoView({ behavior, inline: 'center', block: 'nearest' });
        }
    };

    // 4. Scroll Detection (Auto-Select on Stop)
    const handleScroll = (e) => {
        if (scrollTimeout.current) clearTimeout(scrollTimeout.current);

        // Debounce: Wait for scroll to stop before selecting
        scrollTimeout.current = setTimeout(() => {
            findAndSelectCenterDate();
        }, 100);
    };

    const scrollTimeout = useRef(null);

    const findAndSelectCenterDate = () => {
        const container = containerRef.current;
        if (!container) return;

        const center = container.getBoundingClientRect().left + (container.clientWidth / 2);
        let closestDate = null;
        let minDiff = Infinity;

        Array.from(container.children).forEach((child, idx) => {
            const rect = child.getBoundingClientRect();
            const childCenter = rect.left + (rect.width / 2);
            const diff = Math.abs(center - childCenter);
            if (diff < minDiff) {
                minDiff = diff;
                closestDate = dates[idx];
            }
        });

        if (closestDate && (!selectedDate || closestDate.getTime() !== selectedDate.getTime())) {
            isManualScroll.current = true;
            onDateChange(closestDate);
        }
    };

    const handleManualInteraction = () => {
        isManualScroll.current = true;
    };


    // 4. Select Handler
    const handleItemClick = (date, index) => {
        onDateChange(date);
        scrollToIndex(index, 'smooth');
    };

    return (
        <div className={`w-full h-32 relative bg-white border-t border-gray-100 flex items-center justify-center shrink-0 z-40 select-none shadow-[0_-5px_30px_rgba(0,0,0,0.08)]`}>

            {/* CENTER FRAME / LENS */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-24 pointer-events-none z-10 flex flex-col justify-between py-1">
                <div className="w-full h-0.5 bg-blue-500/80 rounded-full shadow-sm"></div>
                <div className="w-full h-0.5 bg-blue-500/80 rounded-full shadow-sm"></div>
            </div>

            {/* FADE GRADIENTS (Keep minimal to not look 'faded') */}
            <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-white via-white/80 to-transparent z-20 pointer-events-none"></div>
            <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-white via-white/80 to-transparent z-20 pointer-events-none"></div>

            {/* CONTAINER - Enable Snap */}
            <div
                ref={containerRef}
                className="flex items-center w-full h-full overflow-x-auto hide-scrollbar snap-x snap-mandatory"
                // Center padding allows first/last items to reach middle
                style={{ paddingInline: 'calc(50% - 50px)', scrollBehavior: 'smooth' }}
                dir="rtl"
                onScroll={handleScroll}
                onTouchStart={handleManualInteraction}
                onMouseDown={handleManualInteraction}
                onWheel={handleManualInteraction}
            >
                {dates.map((date, idx) => {
                    // Loose comparison for highlighting while scrolling might be tricky if state lags,
                    // but 'selectedDate' updates on stop.
                    const isSelectedDate = date.toDateString() === selectedDate.toDateString();
                    const isToday = date.toDateString() === new Date().toDateString();

                    return (
                        <button
                            key={idx}
                            style={{ width: ITEM_WIDTH, minWidth: ITEM_WIDTH }}
                            // Snap alignment key:
                            className={`snap-center flex flex-col items-center justify-center transition-all duration-300 transform outline-none
                    ${isSelectedDate ? 'scale-110 z-10' : 'scale-85 hover:scale-90 text-slate-500'}
                `}
                            onClick={() => {
                                handleItemClick(date, idx);
                            }}
                        >
                            <div className={`h-20 flex flex-col items-center justify-center rounded-xl px-2 transition-colors`}>
                                <span className={`text-sm font-medium ${isSelectedDate ? 'text-blue-600' : 'text-slate-400'}`}>
                                    {date.toLocaleDateString('he-IL', { weekday: 'short' })}
                                </span>
                                <span className={`text-3xl font-black leading-none my-0.5 ${isSelectedDate ? 'text-slate-800' : 'text-slate-400'}`}>
                                    {date.getDate()}
                                </span>
                                <span className={`text-[10px] uppercase font-bold ${isSelectedDate ? 'text-slate-500' : 'text-slate-300'}`}>
                                    {date.toLocaleDateString('he-IL', { month: 'short' })}
                                </span>
                            </div>

                            {isToday && <div className="absolute bottom-1 px-2 py-0.5 bg-blue-500 text-white text-[9px] rounded-full font-bold shadow-sm">היום</div>}
                        </button>
                    );
                })}
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
       `}} />
        </div>
    );
};

export default DateScroller;
