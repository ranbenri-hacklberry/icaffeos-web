import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useTheme } from '../../../context/ThemeContext';
import { FolderPlus, Pencil, X, GripVertical } from 'lucide-react';

const DRAG_THRESHOLD = 10; // px of movement before drag activates

const MenuCategoryFilter = ({
  activeCategory = 'hot-drinks',
  onCategoryChange,
  categories: propCategories,
  onAddCategory,
  isEditMode = false,
  onToggleEditMode,
  onEditCategory,
  onReorderCategories,
}) => {
  const { isDarkMode } = useTheme();
  const categories = propCategories || [];

  // ── Drag-and-drop state ──────────────────────────
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);
  const pillRefs = useRef([]);
  const drag = useRef({ idx: null, startX: 0, active: false });
  const stateRef = useRef({ dragIdx: null, overIdx: null });
  const justDragged = useRef(false);
  const catsRef = useRef(categories);
  catsRef.current = categories;

  // Keep refs in sync with React state
  useEffect(() => { stateRef.current.dragIdx = dragIdx; }, [dragIdx]);
  useEffect(() => { stateRef.current.overIdx = overIdx; }, [overIdx]);

  // Reset drag when leaving edit mode
  useEffect(() => {
    if (!isEditMode) {
      setDragIdx(null);
      setOverIdx(null);
      drag.current = { idx: null, startX: 0, active: false };
    }
  }, [isEditMode]);

  // Find the pill closest to a given X coordinate
  const getClosestIndex = useCallback((clientX) => {
    let closest = 0, minDist = Infinity;
    pillRefs.current.forEach((el, i) => {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const dist = Math.abs(clientX - (rect.left + rect.width / 2));
      if (dist < minDist) { minDist = dist; closest = i; }
    });
    return closest;
  }, []);

  // Commit the reorder to the parent
  const commitDrop = useCallback(() => {
    const { dragIdx: d, overIdx: o } = stateRef.current;
    if (d !== null && o !== null && d !== o && onReorderCategories) {
      const reordered = [...catsRef.current];
      const [moved] = reordered.splice(d, 1);
      reordered.splice(o, 0, moved);
      onReorderCategories(reordered);
    }
    justDragged.current = true;
    setTimeout(() => { justDragged.current = false; }, 200);
    drag.current = { idx: null, startX: 0, active: false };
    setDragIdx(null);
    setOverIdx(null);
  }, [onReorderCategories]);

  // ── Global move / end listeners (touch + mouse) ──
  useEffect(() => {
    const handleMove = (clientX) => {
      const d = drag.current;
      if (d.idx === null) return;
      if (!d.active && Math.abs(clientX - d.startX) > DRAG_THRESHOLD) {
        d.active = true;
        setDragIdx(d.idx);
        setOverIdx(d.idx);
      }
      if (d.active) setOverIdx(getClosestIndex(clientX));
    };

    const onTouchMove = (e) => {
      if (drag.current.active) e.preventDefault(); // prevent scroll during drag
      if (drag.current.idx !== null) handleMove(e.touches[0].clientX);
    };
    const onMouseMove = (e) => handleMove(e.clientX);
    const onEnd = () => {
      if (drag.current.idx === null) return;
      if (drag.current.active) commitDrop();
      else drag.current = { idx: null, startX: 0, active: false };
    };

    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchcancel', onEnd);
    window.addEventListener('mouseup', onEnd);

    return () => {
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
      window.removeEventListener('mouseup', onEnd);
    };
  }, [getClosestIndex, commitDrop]);

  const initDrag = useCallback((index, clientX) => {
    if (!isEditMode) return;
    drag.current = { idx: index, startX: clientX, active: false };
  }, [isEditMode]);

  const handleCategoryClick = (category) => {
    if (justDragged.current) return; // Suppress click after drag ends
    if (isEditMode && onEditCategory) {
      onEditCategory(category);
    } else if (onCategoryChange) {
      onCategoryChange(category?.id);
    }
  };

  return (
    <div className={`sticky top-0 z-20 ${isDarkMode ? 'bg-slate-900/95 border-slate-800' : 'bg-white/95 border-gray-100'} backdrop-blur-sm border-b shadow-sm font-heebo transition-colors duration-300`}>
      <div className="px-1.5 sm:px-4 py-2 sm:py-3">
        <div className="flex items-center gap-2 sm:gap-3" dir="rtl">

          {/* Edit Mode Toggle — right side (first in RTL) */}
          {onToggleEditMode && (
            <button
              onClick={onToggleEditMode}
              title={isEditMode ? 'סיים עריכה' : 'ערוך קטגוריות'}
              className={`shrink-0 flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200 text-xs font-bold whitespace-nowrap
                ${isEditMode
                  ? (isDarkMode
                    ? 'bg-orange-500/20 text-orange-400 border-2 border-orange-500 shadow-lg shadow-orange-500/10'
                    : 'bg-orange-100 text-orange-600 border-2 border-orange-400 shadow-lg shadow-orange-200')
                  : (isDarkMode
                    ? 'border-2 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
                    : 'border-2 border-slate-200 text-slate-400 hover:border-slate-400 hover:text-slate-600 hover:bg-slate-50')
                }
              `}
            >
              {isEditMode ? <X size={16} /> : <Pencil size={16} />}
            </button>
          )}

          {/* ── Categories pills — touch-draggable in edit mode ── */}
          <div className="flex-1 flex items-center overflow-x-auto scrollbar-hide">
            <div
              className={`flex items-center gap-1 p-1 rounded-xl min-w-max mx-auto transition-all duration-300 ${
                isEditMode
                  ? (isDarkMode ? 'bg-orange-900/20 border border-dashed border-orange-500/40' : 'bg-orange-50 border border-dashed border-orange-300')
                  : (isDarkMode ? 'bg-slate-800' : 'bg-gray-100')
              }`}
              style={isEditMode ? { touchAction: 'none' } : undefined}
            >
              {categories?.map((category, index) => {
                const isActive = activeCategory === category?.id;
                const isBeingDragged = dragIdx === index;
                const isDropTarget = overIdx === index && dragIdx !== null && dragIdx !== index;

                return (
                  <div key={category?.id} className="flex items-center">
                    {/* Drop indicator line — BEFORE this pill (item dragged from later → earlier) */}
                    {isDropTarget && dragIdx > index && (
                      <div
                        className={`w-1 rounded-full mx-0.5 animate-pulse shrink-0 ${isDarkMode ? 'bg-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.5)]' : 'bg-purple-500 shadow-[0_0_8px_rgba(147,51,234,0.4)]'}`}
                        style={{ minHeight: '2rem' }}
                      />
                    )}

                    <button
                      ref={el => pillRefs.current[index] = el}
                      onTouchStart={(e) => initDrag(index, e.touches[0].clientX)}
                      onMouseDown={(e) => { if (isEditMode) { e.preventDefault(); initDrag(index, e.clientX); } }}
                      onClick={() => handleCategoryClick(category)}
                      className={`
                        flex items-center gap-1 sm:gap-1.5 px-2 py-2 sm:px-3 sm:py-3 rounded-lg text-xs xs:text-sm sm:text-[15px] font-bold whitespace-nowrap relative select-none
                        transition-all duration-200
                        ${isBeingDragged
                          ? (isDarkMode
                            ? 'opacity-30 scale-[0.88] ring-2 ring-purple-500/60 bg-purple-900/20'
                            : 'opacity-30 scale-[0.88] ring-2 ring-purple-400/60 bg-purple-50')
                          : isDropTarget
                            ? (isDarkMode
                              ? 'scale-[1.06] ring-2 ring-purple-400 bg-purple-900/30 text-purple-300 shadow-lg shadow-purple-500/20'
                              : 'scale-[1.06] ring-2 ring-purple-400 bg-purple-50 text-purple-700 shadow-lg shadow-purple-300/30')
                            : isEditMode
                              ? (isDarkMode
                                ? 'text-orange-300 hover:bg-orange-900/30 border border-dashed border-orange-500/50 mx-0.5 cursor-grab active:cursor-grabbing'
                                : 'text-orange-600 hover:bg-orange-100 border border-dashed border-orange-400/60 mx-0.5 cursor-grab active:cursor-grabbing')
                              : (isActive
                                ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20'
                                : (isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-700/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'))
                        }
                      `}
                    >
                      {isEditMode && <GripVertical size={14} className="opacity-40 shrink-0" />}
                      <span>{category?.name}</span>
                    </button>

                    {/* Drop indicator line — AFTER this pill (item dragged from earlier → later) */}
                    {isDropTarget && dragIdx < index && (
                      <div
                        className={`w-1 rounded-full mx-0.5 animate-pulse shrink-0 ${isDarkMode ? 'bg-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.5)]' : 'bg-purple-500 shadow-[0_0_8px_rgba(147,51,234,0.4)]'}`}
                        style={{ minHeight: '2rem' }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>


        </div>
      </div>
    </div>
  );
};

export default MenuCategoryFilter;