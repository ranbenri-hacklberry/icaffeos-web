import React, { useState, useEffect } from 'react';
import { ArrowRight, Clock, Check, ChevronRight, ChevronLeft, AlertCircle, Info, Image, PlayCircle, Video, Plus, Save, Minus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { isCategoryMatch, TASK_CATEGORIES } from '@/config/taskCategories';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.05
        }
    }
};

const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.8,
            ease: [0.22, 1, 0.36, 1]
        }
    },
    exit: {
        opacity: 0,
        y: -15,
        transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] }
    }
};

const detailVariants = {
    hidden: { x: '100%', opacity: 0 },
    visible: {
        x: 0,
        opacity: 1,
        transition: { type: 'spring', damping: 25, stiffness: 200 }
    },
    exit: {
        x: '100%',
        opacity: 0,
        transition: { duration: 0.3 }
    }
};

const TaskManagementView = ({ tasks, onComplete, title, tabType }) => {
    const { currentUser } = useAuth();
    const [selectedTask, setSelectedTask] = useState(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [showDetails, setShowDetails] = useState(false);

    // Supplier Items State
    const [supplierItems, setSupplierItems] = useState([]);
    const [isLoadingItems, setIsLoadingItems] = useState(false);
    const [stockUpdates, setStockUpdates] = useState({}); // itemId -> newStock
    const [savingItem, setSavingItem] = useState(null); // ID of item being saved
    const [savedItemIds, setSavedItemIds] = useState(new Set()); // IDs of items saved in this session
    const [weightModes, setWeightModes] = useState({}); // itemId -> boolean (true if weight mode)
    const [actualQty, setActualQty] = useState(1); // For regular tasks quantity adjustment

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Separate pre-closing from regular closing tasks
    const morningTasks = tasks.filter(t =>
        (t.due_time && t.due_time < '10:00') ||
        isCategoryMatch(TASK_CATEGORIES.OPENING.id, t.category) ||
        (t.name || '').includes('בקר') ||
        (t.name || '').includes('פתיחה')
    );
    const preClosingTasks = tasks.filter(t => t.is_pre_closing && !morningTasks.find(m => m.id === t.id));
    const regularTasks = tasks.filter(t => !t.is_pre_closing && !morningTasks.find(m => m.id === t.id));

    // Auto-deselect if task was completed
    useEffect(() => {
        if (selectedTask && !tasks.find(t => t.id === selectedTask.id)) {
            setSelectedTask(null);
            setShowDetails(false);
        }
    }, [tasks, selectedTask]);

    const handleSelectTask = (task) => {
        setSelectedTask(task);
        setActualQty(task.target_qty || 0); // Default to target quantity
        if (isMobile) {
            setShowDetails(true);
        }
    };

    // Fetch supplier items when a supplier task is selected
    useEffect(() => {
        if (selectedTask?.supplier_id && currentUser?.business_id) {
            fetchSupplierItems(selectedTask.supplier_id);
            setStockUpdates({});
            setSavedItemIds(new Set()); // Clear saved state for new task
        } else {
            setSupplierItems([]);
            setSavedItemIds(new Set());
        }
    }, [selectedTask, currentUser?.business_id]);

    const fetchSupplierItems = async (supplierId) => {
        setIsLoadingItems(true);
        try {
            if (!currentUser?.business_id) {
                console.warn('No business_id found for current user, aborting fetch.');
                setSupplierItems([]);
                return;
            }

            const { data, error } = await supabase
                .from('inventory_items')
                .select('*')
                .eq('supplier_id', supplierId)
                .eq('business_id', currentUser.business_id);

            if (error) throw error;

            // Robust Sorting by Department Keywords
            const getDeptIndex = (cat) => {
                const c = (cat || '').toLowerCase();
                if (c.includes('ירק') || c.includes('פיר')) return 0;
                if (c.includes('לחם') || c.includes('לחמני')) return 1;
                if (c.includes('מאפ') || c.includes('בורקס') || c.includes('עוג')) return 2;
                if (c.includes('חלב') || c.includes('גבינ') || c.includes('מעדן')) return 3;
                if (c.includes('יבש') || c.includes('שימור') || c.includes('חד פעמי')) return 4;
                if (c.includes('נקי') || c.includes('ניקיון')) return 5;
                return 99;
            };

            const sorted = (data || []).sort((a, b) => {
                const indexA = getDeptIndex(a.category);
                const indexB = getDeptIndex(b.category);

                if (indexA !== indexB) return indexA - indexB;
                return (a.name || '').localeCompare(b.name || '', 'he');
            });

            setSupplierItems(sorted);
        } catch (err) {
            console.error('Error fetching supplier items:', err);
        } finally {
            setIsLoadingItems(false);
        }
    };

    const isItemCounted = (item) => {
        if (savedItemIds.has(item.id)) return true;
        if (stockUpdates[item.id] !== undefined) return true;

        // Check if counted today
        if (item.last_counted_at) {
            const lastDate = new Date(item.last_counted_at).toLocaleDateString();
            const today = new Date().toLocaleDateString();
            if (lastDate === today) return true;
        }
        return false;
    };

    const remainingToCount = supplierItems.filter(item => !isItemCounted(item)).length;
    const allCounted = remainingToCount === 0;

    const toggleWeightMode = (itemId) => {
        setWeightModes(prev => ({ ...prev, [itemId]: !prev[itemId] }));
    };

    const handleStockChange = (itemId, direction) => {
        setStockUpdates(prev => {
            const currentItem = supplierItems.find(i => i.id === itemId);
            if (!currentItem) return prev;

            const currentVal = prev[itemId] !== undefined ? prev[itemId] : (currentItem?.current_stock || 0);

            // Logic similar to InventoryItemCard:
            const isWeight = weightModes[itemId];
            const wpu = parseFloat(currentItem.weight_per_unit) || 0;
            const countStep = currentItem.count_step || 1;

            let delta = 0;
            if (wpu > 0) {
                if (isWeight) {
                    // Weight Mode: 0.5 KG steps
                    delta = direction * 500;
                } else {
                    // Unit Mode: step * weight
                    delta = direction * countStep * wpu;
                }
            } else {
                delta = direction * countStep;
            }

            // Smart Snap Logic
            const nextVal = currentVal + delta;
            const step = wpu > 0 && !isWeight ? (countStep * wpu) : (wpu > 0 ? 500 : countStep);

            const remainder = nextVal % step;
            const isRound = Math.abs(remainder) < 0.1 || Math.abs(remainder - step) < 0.1;

            let newVal = nextVal;
            // If it's not a round number after the change, we usually just let it be, 
            // but the user wants consistent snapping.
            // For now, let's keep it simple: just add the delta.

            // Floating point precision fix
            const precision = 1000;
            newVal = Math.round(newVal * precision) / precision;
            newVal = Math.max(0, newVal);

            if (savedItemIds.has(itemId)) {
                setSavedItemIds(p => {
                    const next = new Set(p);
                    next.delete(itemId);
                    return next;
                });
            }

            return { ...prev, [itemId]: newVal };
        });
    };

    const handleSaveItem = async (itemId) => {
        const newVal = stockUpdates[itemId];
        if (newVal === undefined) return;

        setSavingItem(itemId);
        try {
            // Robust Direct Update instead of RPC
            const { error } = await supabase
                .from('inventory_items')
                .update({
                    current_stock: newVal,
                    last_counted_at: new Date().toISOString(),
                    // We might not have 'counted_by' column in all schemas, but usually harmless if ignored or we can verify
                    // checking schema helps. For now, stock and time are critical.
                })
                .eq('id', itemId);

            if (error) throw error;

            // Update local state
            setSupplierItems(prev => prev.map(item =>
                item.id === itemId ? { ...item, current_stock: newVal } : item
            ));

            // Mark as saved
            setSavedItemIds(prev => new Set(prev).add(itemId));

            // Clear from updates buffer
            setStockUpdates(prev => {
                const next = { ...prev };
                delete next[itemId];
                return next;
            });
        } catch (err) {
            console.error('Error saving item:', err);
            alert('שגיאה בשמירה');
        } finally {
            setSavingItem(null);
        }
    };

    const handleSaveAllAndComplete = async () => {
        const itemIdsToUpdate = Object.keys(stockUpdates);
        setIsLoadingItems(true);

        try {
            // 1. Save all stock updates
            const updatePromises = itemIdsToUpdate.map(itemId => {
                const newVal = stockUpdates[itemId];
                return supabase.rpc('update_inventory_stock', {
                    p_item_id: itemId,
                    p_new_stock: newVal,
                    p_counted_by: currentUser?.id || null,
                    p_source: 'inventory_task'
                });
            });

            const results = await Promise.all(updatePromises);
            const errors = results.filter(r => r.error);
            if (errors.length > 0) throw errors[0].error;

            // 2. Mark task as completed
            await onComplete(selectedTask);

            // 3. Close the panel
            setShowDetails(false);
            setSelectedTask(null);
            setStockUpdates({});
            setSavedItemIds(new Set()); // Clear saved state

        } catch (err) {
            console.error('Error saving all stock:', err);
            alert('שגיאה בעדכון המלאי. אנא נסה שוב.');
        } finally {
            setIsLoadingItems(false);
        }
    };

    // Memoized TaskCard for performance (Maya's suggestion)
    const TaskCard = React.memo(({ task }) => {
        const isSelected = selectedTask?.id === task.id;

        return (
            <div
                onClick={() => handleSelectTask(task)}
                className={`group flex items-center gap-3 p-2 rounded-2xl border transition-all duration-200 cursor-pointer active:scale-[0.98]
                    ${isSelected
                        ? 'bg-blue-50 border-blue-200 shadow-md z-10'
                        : 'bg-white border-slate-100 hover:border-slate-200 shadow-sm'
                    }`}
            >
                {/* Complete Button (Right - Matches PrepItemCard position) */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onComplete(task);
                    }}
                    className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center transition-all shadow-sm active:scale-90 
                        ${tabType === 'opening' ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white' :
                            (tabType === 'prep' || tabType === 'pre_closing') ? 'bg-orange-50 text-orange-600 hover:bg-orange-500 hover:text-white' :
                                'bg-purple-50 text-purple-600 hover:bg-purple-500 hover:text-white'}
                        ${task.is_completed ? 'bg-emerald-500 text-white' : ''}
                    `}
                >
                    <Check size={18} strokeWidth={3} />
                </button>

                {/* Name & Info (Middle) */}
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="flex items-center gap-2">
                        <h4 className={`font-black text-sm leading-tight truncate ${isSelected ? 'text-slate-900' : 'text-slate-800'}`}>
                            {task.name}
                        </h4>
                        {task.target_qty > 0 && (
                            <span className="text-[10px] text-slate-400 font-bold bg-slate-50 px-1.5 py-0.5 rounded-md shrink-0">
                                יעד: {task.target_qty}
                            </span>
                        )}
                    </div>
                </div>

                {/* Left Side: Chevron (Matches Counter position) */}
                <div className="flex items-center justify-center bg-slate-50 p-1 rounded-xl border border-slate-100 h-9 w-9">
                    <ChevronLeft className={`transition-transform ${isSelected ? 'text-blue-500' : 'text-slate-300'}`} size={18} />
                </div>
            </div>
        );
    });
    TaskCard.displayName = 'TaskCard';

    return (
        <div className="flex h-full w-full overflow-hidden bg-transparent">
            {/* Right Side: Task List (Desktop 2/3, Mobile full) */}
            <motion.div
                className="flex-1 h-full flex flex-col px-4 md:px-8 pb-4 md:pb-8 pt-0 overflow-y-auto custom-scrollbar shadow-inner"
                initial={{ opacity: 0, scale: 1 }}
                animate={{
                    opacity: selectedTask && isMobile && showDetails ? 0 : 1,
                    scale: selectedTask && isMobile && showDetails ? 0.96 : 1,
                    pointerEvents: selectedTask && isMobile && showDetails ? 'none' : 'auto'
                }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
                {title && (
                    <header className="mb-8 shrink-0">
                        <div className="flex items-center justify-between mb-2">
                            <h2 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                                {title}
                            </h2>
                        </div>
                        <div className="h-1 w-20 bg-slate-200 rounded-full" />
                    </header>
                )}

                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="flex flex-col gap-4"
                >
                    {/* Morning Tasks Section */}
                    {morningTasks.length > 0 && (
                        <section>
                            <div className="grid grid-cols-1 gap-4">
                                <AnimatePresence initial={false}>
                                    {morningTasks.map(task => <TaskCard key={task.id} task={task} />)}
                                </AnimatePresence>
                            </div>
                        </section>
                    )}

                    {/* Pre-Closing Section */}
                    {preClosingTasks.length > 0 && (
                        <section className={morningTasks.length > 0 ? "mt-4" : ""}>
                            <div className="grid grid-cols-1 gap-4">
                                <AnimatePresence initial={false}>
                                    {preClosingTasks.map(task => <TaskCard key={task.id} task={task} />)}
                                </AnimatePresence>
                            </div>
                        </section>
                    )}

                    {/* Regular Tasks Section */}
                    {regularTasks.length > 0 && (
                        <section className={preClosingTasks.length > 0 || morningTasks.length > 0 ? "mt-4" : ""}>
                            <div className="grid grid-cols-1 gap-4">
                                <AnimatePresence initial={false}>
                                    {regularTasks.map(task => <TaskCard key={task.id} task={task} />)}
                                </AnimatePresence>
                            </div>
                        </section>
                    )}

                    {tasks.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-32 text-slate-300">
                            <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center mb-6 text-emerald-400">
                                <Check size={48} />
                            </div>
                            <p className="text-xl font-black text-slate-400 italic">הכל מוכן! עבודה מצוינת.</p>
                        </div>
                    )}
                </motion.div>
            </motion.div>

            {/* Task Detail Sidebar/Modal (Fixed) */}
            <AnimatePresence>
                {(selectedTask && (!isMobile || showDetails)) && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.4 }}
                            exit={{ opacity: 0 }}
                            onClick={() => {
                                setShowDetails(false);
                                setSelectedTask(null);
                            }}
                            className="fixed inset-0 bg-slate-900 z-[60]"
                        />
                        {/* Drawer */}
                        <motion.div
                            variants={detailVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            className={`fixed top-0 left-0 bottom-0 w-full md:w-[800px] bg-white shadow-2xl z-[70] overflow-hidden flex flex-col`}
                        >
                            {/* Detail Header - Super Condensed */}
                            <div className="p-3 md:p-4 shrink-0 flex items-center justify-between border-b border-slate-100 bg-white/80 backdrop-blur-md sticky top-0 z-10">
                                <button
                                    onClick={() => {
                                        setShowDetails(false);
                                        setSelectedTask(null);
                                    }}
                                    className="w-12 h-12 bg-slate-100/80 hover:bg-slate-200 border border-slate-200/50 rounded-2xl text-slate-600 active:scale-95 transition-all flex items-center justify-center shrink-0 shadow-sm"
                                >
                                    <ArrowRight size={22} strokeWidth={2.5} />
                                </button>

                                <div className="flex flex-col min-w-0 flex-1 mr-4 text-left">
                                    <h3 className="text-lg font-black text-slate-900 tracking-tight leading-tight truncate">
                                        {selectedTask.name}
                                    </h3>
                                    <div className="h-0.5 w-6 bg-blue-500 rounded-full mt-0.5 ml-auto" />
                                </div>
                            </div>

                            {/* Detail Scrollable Body */}
                            <div className={`flex-1 overflow-y-auto custom-scrollbar ${selectedTask.is_supplier_task ? 'p-3 md:p-4' : 'p-6 md:p-10'}`}>
                                {!selectedTask.is_supplier_task && (
                                    <div className="bg-slate-50/50 rounded-[2.5rem] p-8 md:p-10 border border-slate-100 mb-8 overflow-hidden relative group">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-[80px] rounded-full pointer-events-none" />

                                        <h4 className="text-3xl font-black text-slate-800 mb-1 tracking-tight">
                                            {selectedTask.name}
                                        </h4>
                                        {(() => {
                                            const inventory = selectedTask.menu_item?.prepared_items_inventory;
                                            const stock = Array.isArray(inventory) ? inventory[0]?.current_stock : inventory?.current_stock;
                                            if (stock === undefined || stock === null) return null;
                                            return (
                                                <p className="text-emerald-600 font-black text-sm mb-4">
                                                    במלאי כעת: {stock}
                                                </p>
                                            );
                                        })()}

                                        <div className="flex flex-wrap gap-3 mb-8">
                                            <div className="px-4 py-2 bg-blue-100/50 text-blue-700 rounded-xl text-xs font-black flex items-center gap-2">
                                                <Clock size={14} />
                                                ביצוע יומי
                                            </div>
                                            <div className="px-4 py-2 bg-emerald-100/50 text-emerald-700 rounded-xl text-xs font-black flex items-center gap-2">
                                                <Info size={14} />
                                                מספר # {selectedTask.id}
                                            </div>
                                        </div>

                                        <p className="text-lg text-slate-500 font-medium leading-relaxed mb-6">
                                            {selectedTask.description || 'אין תיאור מפורט למשימה זו.'}
                                        </p>

                                        {/* 🔢 Quantity Adjustment Control - Only for Prep Tasks */}
                                        {((tabType === 'prep' || tabType === 'pre_closing') || (selectedTask.category === 'prep') || (selectedTask.menu_item && selectedTask.menu_item.inventory_settings)) && Number(selectedTask.target_qty) > 0 && (
                                            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                                                <div className="flex justify-between items-center mb-4">
                                                    <span className="text-sm font-black text-slate-400 uppercase tracking-widest">כמות להכנה</span>
                                                    <span className="text-xs font-bold text-slate-300 bg-slate-100 px-2 py-1 rounded-lg">
                                                        יעד: {selectedTask.target_qty}
                                                    </span>
                                                </div>

                                                <div className="flex items-center justify-between">
                                                    <button
                                                        onClick={() => setActualQty(Math.max(0, actualQty - 1))}
                                                        className="w-16 h-16 bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-red-500 rounded-2xl flex items-center justify-center transition-colors active:scale-90"
                                                    >
                                                        <Minus size={32} strokeWidth={3} />
                                                    </button>

                                                    <div className="flex flex-col items-center">
                                                        <span className="text-5xl font-black text-slate-800 font-mono tracking-tighter">
                                                            {actualQty}
                                                        </span>
                                                        <span className="text-xs font-bold text-slate-400">יחידות מוכנות</span>
                                                    </div>

                                                    <button
                                                        onClick={() => setActualQty(actualQty + 1)}
                                                        className="w-16 h-16 bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-emerald-500 rounded-2xl flex items-center justify-center transition-colors active:scale-90"
                                                    >
                                                        <Plus size={32} strokeWidth={3} />
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Inventory Counting View for Supplier Tasks */}
                                {selectedTask.supplier_id && (
                                    <div className="space-y-3 mb-6">
                                        {!selectedTask.is_supplier_task && (
                                            <h5 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-3">
                                                <span>ספירת מלאי לפריטי ספק</span>
                                                <div className="flex-1 h-px bg-slate-100" />
                                            </h5>
                                        )}

                                        {isLoadingItems ? (
                                            <div className="py-20 text-center">
                                                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-6" />
                                                <p className="text-slate-400 font-black text-lg">מעדכן נתוני מלאי...</p>
                                            </div>
                                        ) : supplierItems.length === 0 ? (
                                            <div className="py-12 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                                                <p className="text-slate-400 font-medium">לא נמצאו פריטים לספק זה.</p>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                {/* Sort by Category, then Name */}
                                                {[...supplierItems].sort((a, b) => {
                                                    const catA = a.category || '';
                                                    const catB = b.category || '';
                                                    if (catA !== catB) return catA.localeCompare(catB);
                                                    return (a.name || '').localeCompare(b.name || '');
                                                }).map(item => {
                                                    const rawStock = stockUpdates[item.id] !== undefined ? stockUpdates[item.id] : item.current_stock;
                                                    const isChanged = stockUpdates[item.id] !== undefined;
                                                    const isSaved = savedItemIds.has(item.id);
                                                    const isSaving = savingItem === item.id;
                                                    const isWeight = !!weightModes[item.id];
                                                    const wpu = parseFloat(item.weight_per_unit) || 0;

                                                    let displayValue = rawStock;
                                                    let displayUnit = item.unit || 'יח׳';

                                                    if (wpu > 0) {
                                                        if (isWeight) {
                                                            displayValue = rawStock / 1000;
                                                            displayUnit = 'ק״ג';
                                                        } else {
                                                            displayValue = rawStock / wpu;
                                                            displayUnit = 'יח׳';
                                                        }
                                                    }

                                                    return (
                                                        <div key={item.id} className={`flex items-center justify-between p-3 rounded-2xl border transition-all 
                                                        ${isChanged ? 'bg-blue-50 border-blue-200 shadow-sm' :
                                                                isSaved ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-100 hover:border-slate-200'}`}>
                                                            <div className="min-w-0 pr-1 flex-1">
                                                                <div className="flex items-center gap-2">
                                                                    <h6 className="font-black text-slate-800 truncate text-sm leading-none mb-1">{item.name}</h6>
                                                                    {isSaved && !isChanged && <Check size={14} className="text-emerald-500" strokeWidth={4} />}
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">{displayUnit}</p>
                                                                    {wpu > 0 && (
                                                                        <button
                                                                            onClick={() => toggleWeightMode(item.id)}
                                                                            className={`px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-tight transition-all
                                                                            ${isWeight ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-500'}`}
                                                                        >
                                                                            {isWeight ? 'עבור ליחידות' : 'עבור למשקל'}
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center gap-1.5 bg-slate-100/50 p-1 rounded-xl border border-slate-200/40">
                                                                <div className="flex items-center bg-white rounded-lg shadow-sm border border-slate-100">
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleStockChange(item.id, -1);
                                                                        }}
                                                                        className="w-9 h-9 flex items-center justify-center text-slate-500 hover:text-red-500 active:scale-90 transition-all border-l border-slate-100"
                                                                    >
                                                                        <Minus size={14} strokeWidth={3} />
                                                                    </button>

                                                                    <div className="w-12 text-center">
                                                                        <span className={`font-mono text-sm font-black ${isChanged ? 'text-blue-600' : isSaved ? 'text-emerald-600' : 'text-slate-700'}`}>
                                                                            {parseFloat(displayValue.toFixed(2))}
                                                                        </span>
                                                                    </div>

                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleStockChange(item.id, 1);
                                                                        }}
                                                                        className="w-9 h-9 flex items-center justify-center text-slate-500 hover:text-emerald-500 active:scale-90 transition-all border-r border-slate-100"
                                                                    >
                                                                        <Plus size={14} strokeWidth={3} />
                                                                    </button>
                                                                </div>

                                                                {/* Item Save Button - Always visible but disabled if no change */}
                                                                <button
                                                                    onClick={() => handleSaveItem(item.id)}
                                                                    disabled={isSaving || !isChanged}
                                                                    className={`w-9 h-9 rounded-lg shadow-md flex items-center justify-center transition-all active:scale-90 
                                                                    ${isChanged ? 'bg-indigo-600 text-white shadow-indigo-100 hover:bg-indigo-700' : 'bg-slate-100 text-slate-300 shadow-none cursor-not-allowed'}`}
                                                                >
                                                                    {isSaving ? (
                                                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                                    ) : (
                                                                        <Save size={16} strokeWidth={2.5} />
                                                                    )}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Regular Media Placeholder (only if not a supplier task or show always?) */}
                                {!selectedTask.supplier_id && (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="aspect-square bg-slate-100 rounded-3xl flex flex-col items-center justify-center gap-2 text-slate-400 hover:bg-slate-200 transition-colors cursor-pointer border-2 border-dashed border-slate-200">
                                            <Image size={32} strokeWidth={1.5} />
                                            <span className="text-[10px] font-black uppercase tracking-widest">תמונה</span>
                                        </div>
                                        <div className="aspect-square bg-slate-100 rounded-3xl flex flex-col items-center justify-center gap-2 text-slate-400 hover:bg-slate-200 transition-colors cursor-pointer border-2 border-dashed border-slate-200">
                                            <PlayCircle size={32} strokeWidth={1.5} />
                                            <span className="text-[10px] font-black uppercase tracking-widest">וידאו</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Complete Action Footer */}
                            <div className="p-6 md:p-8 bg-white border-t border-slate-100 sticky bottom-0">
                                {selectedTask.is_supplier_task ? (
                                    <button
                                        onClick={handleSaveAllAndComplete}
                                        disabled={isLoadingItems || !allCounted}
                                        className={`w-full py-6 rounded-[2rem] font-black text-xl shadow-xl flex flex-col items-center justify-center gap-1 transition-all active:scale-95 
                                        ${allCounted ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200' : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'}`}
                                    >
                                        <div className="flex items-center gap-4">
                                            {isLoadingItems ? (
                                                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            ) : (
                                                <Save size={28} strokeWidth={3} />
                                            )}
                                            <span>סיים ספירה וסגור משימה</span>
                                        </div>
                                        {!allCounted && (
                                            <span className="text-xs font-bold opacity-70">
                                                {`נותרו עוד ${remainingToCount} פריטים לספירה`}
                                            </span>
                                        )}
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => onComplete(selectedTask, actualQty)}
                                        className={`w-full py-6 rounded-[2rem] font-black text-xl shadow-xl flex items-center justify-center gap-4 transition-all active:scale-95
                                        ${tabType === 'opening' ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-200' :
                                                (tabType === 'prep' || tabType === 'pre_closing') ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-orange-200' :
                                                    'bg-purple-500 hover:bg-purple-600 text-white shadow-purple-200'}`}
                                    >
                                        <Check size={28} strokeWidth={4} />
                                        סיימתי את המשימה
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};

export default TaskManagementView;
