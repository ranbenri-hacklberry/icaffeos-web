import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { House, Plus, FolderPlus, Loader2, Edit, Trash2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useMenuItems } from '../menu-ordering-interface/hooks/useMenuItems';
import MenuCategoryFilter from '../menu-ordering-interface/components/MenuCategoryFilter';
import MenuItemCard from '../menu-ordering-interface/components/MenuItemCard';
import ModifierModal from '../menu-ordering-interface/components/ModifierModal';
import { supabase } from '@/lib/supabase';

const MobileMenuEditor = () => {
  const { currentUser } = useAuth();
  const { isDarkMode } = useTheme();
  const navigate = useNavigate();

  // ===== Hook for Menu Data =====
  const {
    menuItems,
    menuLoading,
    isHydrated,
    activeCategory,
    filteredItems,
    categories,
    handleCategoryChange,
    fetchMenuItems,
    fetchCategories,
    updateMenuItemLocally
  } = useMenuItems(null, currentUser?.business_id);

  // ===== UI States =====
  const [selectedItemForMod, setSelectedItemForMod] = useState(null);
  const [showModifierModal, setShowModifierModal] = useState(false);
  const [isCreatingNewProduct, setIsCreatingNewProduct] = useState(false);

  // Category Edit States
  const [isCategoryEditMode, setIsCategoryEditMode] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null); // null = create, object = edit
  const [categoryName, setCategoryName] = useState('');
  const [isSavingCategory, setIsSavingCategory] = useState(false);

  // Modals Caching (as required by ModifierModal)
  const [modifierOptionsCache, setModifierOptionsCache] = useState({});

  // Background Photo Enhancement State
  const [enhancingItems, setEnhancingItems] = useState({});

  // Start background studio enhancement (ComfyUI Bridge)
  const startBackgroundEnhancement = useCallback(async (itemId, originalFile) => {
    console.log('🎨 [Background Enhance] Starting for item:', itemId);
    setEnhancingItems(prev => ({ ...prev, [itemId]: 'enhancing' }));
    
    try {
      const reader = new FileReader();
      const base64 = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(originalFile);
      });

      const response = await fetch('/studio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'product on clean white studio background, soft lighting, commercial photo',
          image: base64,
          provider: 'flux'
        })
      });

      if (!response.ok) throw new Error('Studio enhancement request failed');
      const data = await response.json();

      if (data.enhanced_image_url || data.image_url) {
        const publicUrl = data.enhanced_image_url || data.image_url;
        console.log('🎨 [Background Enhance] Completed! New URL:', publicUrl);
        
        await supabase
          .from('menu_items')
          .update({ image_url: publicUrl })
          .eq('id', itemId);

        updateMenuItemLocally(itemId, { image_url: publicUrl });
        setEnhancingItems(prev => ({ ...prev, [itemId]: 'done' }));
      } else {
        throw new Error('No image URL in response');
      }
    } catch (err) {
      console.error('❌ [Background Enhance] Failed:', err);
      setEnhancingItems(prev => {
        const copy = { ...prev };
        delete copy[itemId];
        return copy;
      });
    }
  }, [updateMenuItemLocally]);

  // ===== Item Actions =====
  const handleEditItemClick = useCallback((item) => {
    setSelectedItemForMod(item);
    setIsCreatingNewProduct(false);
    setShowModifierModal(true);
  }, []);

  const handleAddNewProduct = useCallback((categoryId) => {
    const effectiveCatId = categoryId || activeCategory;
    const cat = categories.find(c => c.id === effectiveCatId);
    
    const blankItem = {
      id: `new-${Date.now()}`,
      name: '',
      price: 0,
      image: null,
      image_url: null,
      category: effectiveCatId,
      db_category: cat?.db_name || cat?.name || '',
      modifiers: [],
      business_id: currentUser?.business_id,
      _isNewProduct: true,
      _categoryId: effectiveCatId,
    };

    setSelectedItemForMod(blankItem);
    setIsCreatingNewProduct(true);
    setShowModifierModal(true);
  }, [categories, currentUser?.business_id, activeCategory]);

  // ===== Category Actions =====
  const handleOpenCategoryModal = useCallback((category = null) => {
    if (category) {
      setEditingCategory(category);
      setCategoryName(category.name_he || category.name || '');
    } else {
      setEditingCategory(null);
      setCategoryName('');
    }
    setShowCategoryModal(true);
  }, []);

  const handleSaveCategory = useCallback(async () => {
    const trimmed = categoryName.trim();
    if (!trimmed) return;
    setIsSavingCategory(true);

    try {
      const bizId = currentUser?.business_id || localStorage.getItem('businessId');
      
      if (editingCategory) {
        // Update
        const { error } = await supabase
          .from('item_category')
          .update({
            name: trimmed,
            name_he: trimmed,
          })
          .eq('id', editingCategory.id);
        
        if (error) throw error;
        console.log('✅ [UpdateCategory] Category updated:', trimmed);
      } else {
        // Create
        const nextPos = categories.length > 0 ? Math.max(...categories.map(c => c.position || 0)) + 1 : 0;
        const { error } = await supabase
          .from('item_category')
          .insert({
            name: trimmed,
            name_he: trimmed,
            business_id: bizId,
            position: nextPos,
          });
        
        if (error) throw error;
        console.log('✅ [AddCategory] Category created:', trimmed);
      }
      
      setShowCategoryModal(false);
      setCategoryName('');
      setEditingCategory(null);
      fetchCategories();
    } catch (err) {
      console.error('❌ [SaveCategory] Failed:', err);
    } finally {
      setIsSavingCategory(false);
    }
  }, [categoryName, editingCategory, categories, currentUser?.business_id, fetchCategories]);

  const handleReorderCategories = useCallback(async (reorderedCategories) => {
    try {
      const updates = reorderedCategories.map((cat, index) =>
        supabase.from('item_category').update({ position: index }).eq('id', cat.id)
      );
      await Promise.all(updates);
      console.log('✅ [ReorderCategories] Updated positions for', reorderedCategories.length, 'categories');
      fetchCategories();
    } catch (err) {
      console.error('❌ [ReorderCategories] Failed:', err);
      fetchCategories();
    }
  }, [fetchCategories]);

  return (
    <div className={`min-h-screen font-heebo pb-24 transition-colors duration-300 ${isDarkMode ? 'bg-[#0f172a] text-slate-100' : 'bg-[#f8fafc] text-slate-800'}`} dir="rtl">
      
      {/* Sticky Header */}
      <header className={`sticky top-0 z-30 backdrop-blur-md border-b px-3 py-3 flex items-center justify-between ${isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white/80 border-slate-100'} shadow-sm`}>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => navigate('/mode-selection')}
            className={`p-2.5 rounded-xl border transition-all active:scale-95 flex items-center justify-center ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300' : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'}`}
          >
            <House size={18} strokeWidth={2.5} />
          </button>
        </div>

        {/* Category Actions directly in the top row */}
        <div className="flex items-center gap-1.5">
          {/* Add Category Button */}
          <button
            onClick={() => handleOpenCategoryModal(null)}
            className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 border border-dashed
              ${isDarkMode 
                ? 'bg-slate-800/50 hover:bg-slate-800 border-slate-700 text-indigo-400' 
                : 'bg-indigo-50/50 hover:bg-indigo-50 border-indigo-200 text-indigo-600'
              }`}
          >
            <Plus size={12} />
            <span>קטגוריה</span>
          </button>

          {/* Edit Categories Toggle */}
          <button
            onClick={() => setIsCategoryEditMode(prev => !prev)}
            className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 border
              ${isCategoryEditMode
                ? (isDarkMode
                  ? 'bg-orange-500/20 text-orange-400 border-orange-500 shadow-lg shadow-orange-500/10'
                  : 'bg-orange-100 text-orange-600 border-orange-400 shadow-lg shadow-orange-200')
                : (isDarkMode
                  ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
                  : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600')
              }`}
          >
            {isCategoryEditMode ? <Plus size={12} className="rotate-45" /> : <Edit size={10} />}
            <span>{isCategoryEditMode ? 'סיום' : 'עריכה'}</span>
          </button>
        </div>
      </header>

      {/* Category Navigation filter (edge to edge, no inner actions) */}
      <MenuCategoryFilter
        activeCategory={activeCategory}
        onCategoryChange={handleCategoryChange}
        categories={categories}
        isEditMode={isCategoryEditMode}
        onEditCategory={handleOpenCategoryModal}
        onReorderCategories={handleReorderCategories}
      />

      {/* Main Content Area */}
      <main className="px-4 py-6">
        {menuLoading && !isHydrated ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 size={36} className="animate-spin text-indigo-500" />
            <p className="text-sm opacity-60">טוען את פריטי התפריט...</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 sm:gap-4">
            
            {/* Display Items */}
            {filteredItems.map(item => (
              <MenuItemCard
                key={item.id}
                item={item}
                onAddToCart={handleEditItemClick}
                enhancingStatus={enhancingItems[item.id]}
              />
            ))}

            {/* Dotted "Add New Item" Card */}
            {!menuLoading && (
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleAddNewProduct(activeCategory)}
                className={`w-full aspect-square compact-card-ratio rounded-3xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all gap-2 p-4 text-center
                  ${isDarkMode 
                    ? 'border-slate-700 bg-slate-800/20 text-slate-400 hover:border-slate-500 hover:text-slate-300' 
                    : 'border-slate-200 bg-slate-50/50 text-slate-500 hover:border-indigo-300 hover:bg-indigo-50/20'
                  }`}
              >
                <div className={`p-3 rounded-full ${isDarkMode ? 'bg-slate-800' : 'bg-indigo-50/60'}`}>
                  <Plus size={20} className={isDarkMode ? 'text-slate-400' : 'text-indigo-600'} />
                </div>
                <span className="text-sm font-bold">הוספת מנה</span>
              </motion.div>
            )}
          </div>
        )}

        {/* Empty Category State */}
        {!menuLoading && filteredItems.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className={`p-4 rounded-3xl mb-4 ${isDarkMode ? 'bg-slate-800/40 text-slate-500' : 'bg-slate-100 text-slate-400'}`}>
              <FolderPlus size={36} />
            </div>
            <h3 className="font-bold text-base mb-1">אין פריטים בקטגוריה זו</h3>
            <p className="text-xs opacity-60 max-w-[240px] leading-relaxed">
              הקטגוריה הזו ריקה כרגע. לחץ על כפתור "הוספת מנה" כדי ליצור מנה ראשונה בקטגוריה.
            </p>
          </div>
        )}
      </main>

      {/* Category Create/Edit Modal */}
      <AnimatePresence>
        {showCategoryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowCategoryModal(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={e => e.stopPropagation()}
              className={`w-full max-w-sm rounded-[2rem] overflow-hidden p-6 border shadow-2xl ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}
            >
              <h3 className="text-lg font-black mb-1">
                {editingCategory ? '✏️ עריכת קטגוריה' : '➕ הוספת קטגוריה חדשה'}
              </h3>
              <p className="text-xs opacity-60 mb-5">הזן שם עבור הקטגוריה בתפריט</p>
              
              <input
                autoFocus
                type="text"
                value={categoryName}
                onChange={e => setCategoryName(e.target.value)}
                placeholder="שם הקטגוריה (למשל: סלטים, קינוחים)"
                onKeyDown={e => {
                  if (e.key === 'Enter' && categoryName.trim() && !isSavingCategory) {
                    handleSaveCategory();
                  }
                }}
                className={`w-full px-4 py-3 rounded-2xl border text-sm font-medium outline-none transition-all mb-6
                  ${isDarkMode 
                    ? 'bg-slate-800 border-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20' 
                    : 'bg-slate-50 border-slate-200 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20'
                  }`}
              />

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowCategoryModal(false)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}
                >
                  ביטול
                </button>
                <button
                  disabled={!categoryName.trim() || isSavingCategory}
                  onClick={handleSaveCategory}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSavingCategory && <Loader2 size={12} className="animate-spin" />}
                  <span>שמור</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modifier Modal - Loaded in Edit Mode directly */}
      {selectedItemForMod && (
        <ModifierModal
          isOpen={showModifierModal}
          selectedItem={isCreatingNewProduct ? selectedItemForMod : (menuItems.find(i => i.id === selectedItemForMod.id) || selectedItemForMod)}
          allowAutoAdd={false}
          businessId={currentUser?.business_id}
          initialEditMode={true}
          onClose={() => {
            setShowModifierModal(false);
            setSelectedItemForMod(null);
            setIsCreatingNewProduct(false);
          }}
          onAddItem={() => {}} // Not adding to cart since this is purely a menu editor!
          optionsCache={modifierOptionsCache}
          onCacheUpdate={setModifierOptionsCache}
          onItemUpdated={updateMenuItemLocally}
          onNewProductCreated={(newId) => {
            console.log('✅ [AddNewProduct] Product created in editor with ID:', newId);
            setIsCreatingNewProduct(false);
            fetchMenuItems();
          }}
          onStartBackgroundEnhancement={startBackgroundEnhancement}
          enhancingItems={enhancingItems}
        />
      )}
      
    </div>
  );
};

export default MobileMenuEditor;
