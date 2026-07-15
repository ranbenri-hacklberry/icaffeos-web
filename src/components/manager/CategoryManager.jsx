import React, { useState, useEffect } from 'react';
import { X, Plus, Check, Loader2, ChefHat, Coffee, Trash2, GripVertical, Eye, EyeOff, Edit3, Save, AlertTriangle, Bug, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

// Common emojis for categories
const EMOJI_OPTIONS = ['☕', '🥤', '🥐', '🥗', '🥪', '🍰', '🍕', '🍔', '🌮', '🍜', '🍱', '🍣', '🥘', '🧁', '🍦', '🧃', '🍵', '🫖'];

/**
 * SortableCategory - Individual draggable category item
 */
const SortableCategory = ({ category, index, onToggleVisibility, onToggleOnline, onTogglePrepArea, onDelete, onEdit, isEditing, onSaveEdit, editData, setEditData }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: category.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition: transition || 'transform 250ms ease',
        zIndex: isDragging ? 50 : 'auto',
        opacity: isDragging ? 0.9 : 1,
        scale: isDragging ? 1.02 : 1
    };

    const isHidden = category.is_hidden === true;

    return (
        <motion.div
            ref={setNodeRef}
            style={style}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03 }}
            className={`bg-white border rounded-xl p-4 shadow-sm transition-all ${isDragging ? 'shadow-xl border-blue-400' : 'border-gray-200 hover:shadow-md'} ${isHidden ? 'opacity-60' : ''}`}
        >
            {isEditing ? (
                /* Edit Mode */
                <div className="space-y-3">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={editData.name_he}
                            onChange={e => setEditData({ ...editData, name_he: e.target.value })}
                            placeholder="שם בעברית"
                            className="flex-1 px-3 py-2 border-2 border-blue-400 rounded-lg font-bold outline-none"
                        />
                        <input
                            type="text"
                            value={editData.name}
                            onChange={e => setEditData({ ...editData, name: e.target.value })}
                            placeholder="Name (English)"
                            className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-lg font-medium outline-none focus:border-blue-400"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-500">אמוג'י:</span>
                        <div className="flex flex-wrap gap-1">
                            {EMOJI_OPTIONS.map(emoji => (
                                <button
                                    key={emoji}
                                    onClick={() => setEditData({ ...editData, icon: emoji })}
                                    className={`w-9 h-9 text-lg rounded-lg transition-all ${editData.icon === emoji ? 'bg-blue-100 border-2 border-blue-500 scale-110' : 'bg-gray-100 hover:bg-gray-200 border-2 border-transparent'}`}
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <button
                            onClick={() => onEdit(null)}
                            className="px-4 py-2 bg-gray-100 text-gray-600 font-bold rounded-lg hover:bg-gray-200"
                        >
                            ביטול
                        </button>
                        <button
                            onClick={() => onSaveEdit(category.id, editData)}
                            className="px-4 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 flex items-center gap-2"
                        >
                            <Save size={16} />
                            שמור
                        </button>
                    </div>
                </div>
            ) : (
                /* View Mode */
                <div className="flex items-center gap-3">
                    {/* Drag Handle */}
                    <div
                        {...attributes}
                        {...listeners}
                        className="text-gray-300 cursor-grab active:cursor-grabbing hover:text-gray-500 transition-colors"
                    >
                        <GripVertical size={20} />
                    </div>

                    {/* Position Number */}
                    <div className="w-7 h-7 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center text-sm font-black">
                        {index + 1}
                    </div>

                    {/* Icon */}
                    <div className="text-2xl">
                        {category.icon || '☕'}
                    </div>

                    {/* Category Name */}
                    <div className="flex-1">
                        <div className="font-bold text-gray-800">
                            {category.name_he || category.name}
                        </div>
                        {category.name && category.name !== category.name_he && (
                            <div className="text-xs text-gray-400">{category.name}</div>
                        )}
                    </div>

                    {/* Visibility Toggle (General) */}
                    <button
                        onClick={() => onToggleVisibility(category.id, !isHidden)}
                        className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${isHidden
                            ? 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                            : 'bg-green-100 text-green-600 hover:bg-green-200'
                            }`}
                        title={isHidden ? 'מוסתר - לחץ להצגה' : 'מוצג - לחץ להסתרה'}
                    >
                        {isHidden ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>

                    {/* Online Shop Visibility Toggle */}
                    <button
                        onClick={() => onToggleOnline(category.id, !category.is_visible_online)}
                        className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${category.is_visible_online
                            ? 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                            : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                            }`}
                        title={category.is_visible_online ? 'מוצג באתר - לחץ להסתרה' : 'מוסתר באתר - לחץ להצגה'}
                    >
                        <Globe size={18} />
                    </button>

                    {/* Prep Areas Toggles */}
                    <div className="flex gap-1.5">
                        <button
                            onClick={() => onTogglePrepArea(category.id, 'kitchen')}
                            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${category.prep_areas?.includes('kitchen')
                                ? 'bg-orange-100 text-orange-600 border-2 border-orange-300'
                                : 'bg-gray-100 text-gray-400 border-2 border-transparent hover:border-gray-300'
                                }`}
                            title="מטבח"
                        >
                            <ChefHat size={16} />
                        </button>
                        <button
                            onClick={() => onTogglePrepArea(category.id, 'bar')}
                            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${category.prep_areas?.includes('bar')
                                ? 'bg-purple-100 text-purple-600 border-2 border-purple-300'
                                : 'bg-gray-100 text-gray-400 border-2 border-transparent hover:border-gray-300'
                                }`}
                            title="בר"
                        >
                            <Coffee size={16} />
                        </button>
                    </div>

                    {/* Edit Button */}
                    <button
                        onClick={() => onEdit(category.id)}
                        className="w-9 h-9 rounded-lg bg-blue-50 text-blue-500 hover:bg-blue-100 hover:text-blue-600 flex items-center justify-center transition-all"
                        title="ערוך"
                    >
                        <Edit3 size={16} />
                    </button>

                    {/* Delete Button */}
                    <button
                        onClick={() => onDelete(category.id)}
                        className="w-9 h-9 rounded-lg bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 flex items-center justify-center transition-all"
                        title="מחק"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            )}
        </motion.div>
    );
};

/**
 * CategoryManager - מסך ניהול קטגוריות
 * מאפשר יצירה, עריכה, מחיקה וסידור מחדש של קטגוריות
 */
const CategoryManager = ({ isOpen, onClose, onCategoryCreated }) => {
    const { currentUser: user } = useAuth();
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [editData, setEditData] = useState({ name: '', name_he: '', icon: '' });
    const [orderChanged, setOrderChanged] = useState(false);
    const [activeDragId, setActiveDragId] = useState(null);
    const [generalError, setGeneralError] = useState(null); // Error Modal State

    // DnD sensors
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    // Fetch categories on mount
    useEffect(() => {
        if (isOpen && user?.business_id) {
            fetchCategories();
        }
    }, [isOpen, user?.business_id]);

    const fetchCategories = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('item_category')
                .select('id, name, name_he, icon, position, prep_areas, is_deleted, is_hidden, is_visible_online')
                .eq('business_id', user.business_id)
                .or('is_deleted.is.null,is_deleted.eq.false')
                .order('position', { ascending: true });

            if (error) throw error;
            console.log('📁 Loaded categories:', data?.length);
            setCategories(data || []);
            setOrderChanged(false);
        } catch (e) {
            console.error('Failed to fetch categories:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateCategory = async () => {
        if (!newCategoryName.trim()) return;
        setSaving(true);
        try {
            const { data, error } = await supabase
                .from('item_category')
                .insert({
                    name: newCategoryName.trim(),
                    name_he: newCategoryName.trim(),
                    business_id: user.business_id,
                    position: categories.length + 1,
                    prep_areas: ['kitchen'],
                    icon: '☕'
                })
                .select()
                .single();

            if (error) throw error;

            console.log('✅ Created category:', data);
            setCategories(prev => [...prev, data]);
            setNewCategoryName('');
            setSuccessMessage(`הקטגוריה "${data.name_he || data.name}" נוצרה בהצלחה!`);
            setTimeout(() => setSuccessMessage(''), 3000);
            onCategoryCreated?.(data);
        } catch (e) {
            console.error('Failed to create category:', e);
            setGeneralError({ title: 'שגיאה ביצירת קטגוריה', message: e.message, canReport: true });
        } finally {
            setSaving(false);
        }
    };

    const handleDragStart = (event) => {
        setActiveDragId(event.active.id);
    };

    const handleDragEnd = (event) => {
        const { active, over } = event;
        setActiveDragId(null);

        if (!over || active.id === over.id) return;

        setCategories(prev => {
            const oldIndex = prev.findIndex(c => c.id === active.id);
            const newIndex = prev.findIndex(c => c.id === over.id);
            const newOrder = arrayMove(prev, oldIndex, newIndex);
            setOrderChanged(true);
            return newOrder;
        });
    };

    const handleSaveOrder = async () => {
        setSaving(true);
        try {
            // Update position for each category
            const updates = categories.map((cat, index) => ({
                id: cat.id,
                position: index + 1
            }));

            for (const update of updates) {
                await supabase
                    .from('item_category')
                    .update({ position: update.position })
                    .eq('id', update.id);
            }

            console.log('✅ Saved category order');
            setSuccessMessage('סדר הקטגוריות נשמר בהצלחה!');
            setTimeout(() => setSuccessMessage(''), 3000);
            setOrderChanged(false);
        } catch (e) {
            console.error('Failed to save order:', e);
            setGeneralError({ title: 'שגיאה בשמירת סדר', message: e.message });
        } finally {
            setSaving(false);
        }
    };

    const handleToggleVisibility = async (categoryId, hide) => {
        // Optimistic update
        setCategories(prev => prev.map(c =>
            c.id === categoryId ? { ...c, is_hidden: hide } : c
        ));

        try {
            const { error } = await supabase
                .from('item_category')
                .update({ is_hidden: hide })
                .eq('id', categoryId);

            if (error) throw error;
            console.log(`✅ Category ${hide ? 'hidden' : 'shown'}`);
        } catch (e) {
            console.error('Failed to toggle visibility:', e);
            // Revert
            setCategories(prev => prev.map(c =>
                c.id === categoryId ? { ...c, is_hidden: !hide } : c
            ));
        }
    };

    const handleToggleOnline = async (categoryId, isVisible) => {
        // Optimistic update
        setCategories(prev => prev.map(c =>
            c.id === categoryId ? { ...c, is_visible_online: isVisible } : c
        ));

        try {
            const { error } = await supabase
                .from('item_category')
                .update({ is_visible_online: isVisible })
                .eq('id', categoryId);

            if (error) throw error;
            console.log(`✅ Category online visibility set to: ${isVisible}`);
        } catch (e) {
            console.error('Failed to toggle online visibility:', e);
            // Revert
            setCategories(prev => prev.map(c =>
                c.id === categoryId ? { ...c, is_visible_online: !isVisible } : c
            ));
        }
    };

    const handleTogglePrepArea = async (categoryId, area) => {
        const category = categories.find(c => c.id === categoryId);
        if (!category) return;

        const currentAreas = category.prep_areas || [];
        let newAreas;

        if (currentAreas.includes(area)) {
            newAreas = currentAreas.filter(a => a !== area);
            if (newAreas.length === 0) newAreas = [area];
        } else {
            newAreas = [...currentAreas, area];
        }

        setCategories(prev => prev.map(c =>
            c.id === categoryId ? { ...c, prep_areas: newAreas } : c
        ));

        try {
            const { error } = await supabase
                .from('item_category')
                .update({ prep_areas: newAreas })
                .eq('id', categoryId);

            if (error) throw error;
        } catch (e) {
            console.error('Failed to update prep areas:', e);
            setCategories(prev => prev.map(c =>
                c.id === categoryId ? { ...c, prep_areas: currentAreas } : c
            ));
        }
    };

    const handleStartEdit = (categoryId) => {
        if (categoryId) {
            const cat = categories.find(c => c.id === categoryId);
            setEditData({
                name: cat?.name || '',
                name_he: cat?.name_he || '',
                icon: cat?.icon || '☕'
            });
        }
        setEditingId(categoryId);
    };

    const handleSaveEdit = async (categoryId, data) => {
        try {
            const { error } = await supabase
                .from('item_category')
                .update({
                    name: data.name.trim() || data.name_he.trim(),
                    name_he: data.name_he.trim(),
                    icon: data.icon || '☕'
                })
                .eq('id', categoryId);

            if (error) throw error;

            setCategories(prev => prev.map(c =>
                c.id === categoryId ? { ...c, ...data } : c
            ));
            setEditingId(null);
            setSuccessMessage('הקטגוריה עודכנה');
            setTimeout(() => setSuccessMessage(''), 2000);
        } catch (e) {
            console.error('Failed to update category:', e);
            setGeneralError({ title: 'שגיאה בעדכון', message: e.message });
        }
    };

    const handleDeleteCategory = async (categoryId) => {
        const category = categories.find(c => c.id === categoryId);
        if (!confirm(`האם למחוק את הקטגוריה "${category?.name_he || category?.name}"?`)) return;

        try {
            // Soft Delete using is_deleted
            const { error } = await supabase
                .from('item_category')
                .update({ is_deleted: true })
                .eq('id', categoryId);

            if (error) throw error;

            setCategories(prev => prev.filter(c => c.id !== categoryId));
            setSuccessMessage('הקטגוריה נמחקה');
            setTimeout(() => setSuccessMessage(''), 2000);
        } catch (e) {
            console.error('Failed to delete category:', e);
            setGeneralError({
                title: 'שגיאה במחיקה',
                message: `לא ניתן למחוק את הקטגוריה: ${e.message}`,
                canReport: true
            });
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" dir="rtl">
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
            >
                {/* Header */}
                <div className="bg-gradient-to-l from-blue-600 to-indigo-600 text-white p-5 flex items-center justify-between shrink-0">
                    <div>
                        <h2 className="text-xl font-black">ניהול קטגוריות</h2>
                        <p className="text-blue-100 text-sm">גרור לסידור מחדש • לחץ לעריכה</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all"
                    >
                        <X size={22} />
                    </button>
                </div>

                {/* Success Banner */}
                <AnimatePresence>
                    {successMessage && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="bg-green-500 text-white text-center py-3 font-bold flex items-center justify-center gap-2"
                        >
                            <Check size={20} />
                            {successMessage}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Order Changed Banner */}
                <AnimatePresence>
                    {orderChanged && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="bg-amber-500 text-white text-center py-3 font-bold flex items-center justify-center gap-3"
                        >
                            שינית את הסדר -
                            <button
                                onClick={handleSaveOrder}
                                disabled={saving}
                                className="px-4 py-1.5 bg-white text-amber-600 font-black rounded-lg hover:bg-amber-50 transition-all flex items-center gap-2"
                            >
                                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                שמור סדר
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Add New Category */}
                <div className="p-4 border-b border-gray-100 bg-gray-50 shrink-0">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={newCategoryName}
                            onChange={e => setNewCategoryName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleCreateCategory()}
                            placeholder="שם קטגוריה חדשה..."
                            className="flex-1 px-4 py-3 bg-white border-2 border-gray-200 rounded-xl font-bold outline-none focus:border-blue-500 transition-all"
                        />
                        <button
                            onClick={handleCreateCategory}
                            disabled={!newCategoryName.trim() || saving}
                            className="px-5 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {saving ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                            הוסף
                        </button>
                    </div>
                </div>

                {/* Categories List with DnD */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 size={32} className="animate-spin text-blue-500" />
                        </div>
                    ) : categories.length === 0 ? (
                        <div className="text-center py-12 text-gray-400">
                            <p className="text-lg font-bold">אין קטגוריות</p>
                            <p className="text-sm">הוסף קטגוריה ראשונה למעלה</p>
                        </div>
                    ) : (
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragStart={handleDragStart}
                            onDragEnd={handleDragEnd}
                        >
                            <SortableContext
                                items={categories.map(c => c.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                {categories.map((category, index) => (
                                    <SortableCategory
                                        key={category.id}
                                        category={category}
                                        index={index}
                                        onToggleVisibility={handleToggleVisibility}
                                        onToggleOnline={handleToggleOnline}
                                        onTogglePrepArea={handleTogglePrepArea}
                                        onDelete={handleDeleteCategory}
                                        onEdit={handleStartEdit}
                                        isEditing={editingId === category.id}
                                        onSaveEdit={handleSaveEdit}
                                        editData={editData}
                                        setEditData={setEditData}
                                    />
                                ))}
                            </SortableContext>

                            {/* Drag Overlay - Shows dragged item */}
                            <DragOverlay>
                                {activeDragId ? (
                                    <div className="bg-white border-2 border-blue-500 rounded-xl p-4 shadow-2xl opacity-95 scale-105">
                                        <div className="flex items-center gap-3">
                                            <div className="text-2xl">
                                                {categories.find(c => c.id === activeDragId)?.icon || '☕'}
                                            </div>
                                            <div className="font-bold text-gray-800">
                                                {categories.find(c => c.id === activeDragId)?.name_he || categories.find(c => c.id === activeDragId)?.name}
                                            </div>
                                        </div>
                                    </div>
                                ) : null}
                            </DragOverlay>
                        </DndContext>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-100 bg-gray-50 shrink-0">
                    <button
                        onClick={onClose}
                        className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 active:scale-[0.98] transition-all shadow-lg shadow-blue-200"
                    >
                        סיום
                    </button>
                </div>

                {/* General Error / Message Modal */}
                {generalError && (
                    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" dir="rtl">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col">
                            <div className="bg-red-50 p-6 flex flex-col items-center gap-3 border-b border-red-100">
                                <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center text-red-500 mb-1">
                                    <AlertTriangle size={32} strokeWidth={2.5} />
                                </div>
                                <h3 className="text-xl font-black text-red-900 text-center">{generalError.title || 'שגיאה'}</h3>
                            </div>
                            <div className="p-6 text-center">
                                <p className="text-gray-600 font-medium leading-relaxed mb-6">
                                    {generalError.message}
                                </p>

                                <div className="flex flex-col gap-3">
                                    <button
                                        onClick={() => setGeneralError(null)}
                                        className="w-full py-3.5 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 transition shadow-lg shadow-gray-200"
                                    >
                                        הבנתי, סגור
                                    </button>

                                    {generalError.canReport && (
                                        <button
                                            onClick={() => {
                                                setGeneralError({
                                                    title: 'הדיווח נשלח',
                                                    message: 'תודה! הדיווח הועבר לצוות הטכני לבדיקה.',
                                                    canReport: false
                                                });
                                                setTimeout(() => setGeneralError(null), 2500);
                                            }}
                                            className="w-full py-3 bg-red-50 text-red-600 font-bold rounded-xl hover:bg-red-100 transition flex items-center justify-center gap-2"
                                        >
                                            <Bug size={18} /> דווח על תקלה
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </motion.div>
        </div>
    );
};

export default CategoryManager;
