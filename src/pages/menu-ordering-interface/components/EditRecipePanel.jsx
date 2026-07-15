import React, { useState, useMemo } from 'react';
import { Trash2, Search, BookOpen, Loader2, Plus, Minus, X, CheckCircle2, AlertCircle } from 'lucide-react';

/**
 * EditRecipePanel — Inline recipe tab for edit mode.
 * Integrates size-based multiplier scaling for recipe costs and ingredient volumes.
 */
const EditRecipePanel = ({
  isActive,
  selectedItem,
  isEditMode,
  recipeIngredients,
  inventoryOptions,
  ingredientSearch,
  setIngredientSearch,
  showIngredientDropdown,
  setShowIngredientDropdown,
  recipeLoading,
  editGroups = [],
  addRecipeIngredient,
  updateIngredientQuantity,
  removeRecipeIngredient,
  recipeSaveStatus,
  recipeCostVariant,
  setRecipeCostVariant,
}) => {
  // Memoize modifier groups
  const groups = useMemo(() => {
    return isEditMode ? editGroups : (Array.isArray(selectedItem?.modifiers) ? selectedItem.modifiers : []);
  }, [isEditMode, editGroups, selectedItem?.modifiers]);

  // Find size modifier groups
  const sizeGroups = useMemo(() => {
    return groups.filter(g => g.type === 'size' && (g.items || []).length > 0);
  }, [groups]);

  // Local state to track which size variant is currently selected/viewed
  const [activeSizeId, setActiveSizeId] = useState(null);

  // Compute active size multiplier (defaults to 1.0)
  const sizeMultiplier = useMemo(() => {
    if (sizeGroups.length === 0) return 1.0;
    const group = sizeGroups[0];
    const defaultItem = (group.items || []).find(item => item.isDefault || item.is_default) || group.items[0];
    
    let activeItem = null;
    if (activeSizeId) {
      activeItem = (group.items || []).find(item => String(item.id) === String(activeSizeId));
    }
    
    const finalItem = activeItem || defaultItem;
    return finalItem ? Number(finalItem.multiplier) || 1.0 : 1.0;
  }, [sizeGroups, activeSizeId]);

  if (!isActive) return null;

  return (
    <section className="min-h-[350px]" dir="rtl" onClick={e => e.stopPropagation()}>

      {/* Search & Add Ingredient — OUTSIDE scroll container so dropdown isn't clipped */}
      <div className="relative pb-2">
        <div className="flex items-center gap-2 bg-white rounded-xl border border-amber-200/60 px-3 py-2.5 shadow-sm">
          <Search size={16} className="text-amber-400 flex-shrink-0" />
          <input
            type="text"
            placeholder="חפש רכיב מהמלאי..."
            value={ingredientSearch}
            onChange={(e) => {
              setIngredientSearch(e.target.value);
              setShowIngredientDropdown(true);
            }}
            onFocus={() => setShowIngredientDropdown(true)}
            onBlur={() => { setTimeout(() => setShowIngredientDropdown(false), 250); }}
            className="flex-1 bg-transparent outline-none text-sm text-slate-700 placeholder-slate-300"
          />
          {ingredientSearch && (
            <button onClick={() => { setIngredientSearch(''); setShowIngredientDropdown(false); }} className="text-slate-300 hover:text-slate-500">
              <X size={14} />
            </button>
          )}
        </div>
        
        {/* Dropdown */}
        {showIngredientDropdown && ingredientSearch.length > 0 && (
          <div
            className="absolute z-[100] top-full mt-1 left-0 right-0 bg-white rounded-xl border border-amber-100 shadow-xl max-h-48 overflow-y-auto"
            onMouseDown={e => e.preventDefault()}
          >
            {inventoryOptions
              .filter(opt => opt.name?.toLowerCase().includes(ingredientSearch.toLowerCase()))
              .slice(0, 15)
              .map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onMouseDown={e => { e.preventDefault(); e.stopPropagation(); }}
                  onClick={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    // Add ingredient with base step quantity (1.0x quantity)
                    addRecipeIngredient(opt);
                  }}
                  className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-amber-50 text-right transition-colors border-b border-slate-50 last:border-0"
                >
                  <span className="text-sm font-medium text-slate-700">{opt.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400">{opt.display_unit || opt.base_unit || ''}</span>
                    {opt.price > 0 && <span className="text-[11px] text-amber-600 font-bold">₪{opt.price.toFixed(2)}</span>}
                    <Plus size={14} className="text-amber-500" />
                  </div>
                </button>
              ))
            }
            {inventoryOptions.filter(opt => opt.name?.toLowerCase().includes(ingredientSearch.toLowerCase())).length === 0 && (
              <div className="px-4 py-3 text-sm text-slate-400 text-center">לא נמצאו רכיבים</div>
            )}
          </div>
        )}
      </div>

      {/* Size selector tabs (only if size groups exist) */}
      {sizeGroups.length > 0 && (
        <div className="mb-4 bg-slate-50 border border-slate-200/60 p-2 rounded-2xl flex flex-col gap-1.5 shadow-sm">
          <span className="text-[10px] font-bold text-slate-500 pr-1">📏 בחר גודל מנה לחישוב עלות ומתכון:</span>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {sizeGroups[0].items.map(item => {
              const isDefault = !!(item.isDefault || item.is_default);
              const itemId = item.id || `size-default`;
              const isSelected = activeSizeId ? String(activeSizeId) === String(itemId) : isDefault;
              const multVal = Number(item.multiplier) || (isDefault ? 1.0 : 1.5);
              return (
                <button
                  key={itemId}
                  type="button"
                  onClick={() => setActiveSizeId(itemId)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                    isSelected
                      ? 'bg-amber-500 text-white shadow-md'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {item.name} ({multVal}x)
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-4" style={{ maxHeight: '45vh', overflowY: 'auto' }}>

        {/* Loading State */}
        {recipeLoading && (
          <div className="flex items-center justify-center py-8 gap-2 text-amber-500">
            <Loader2 size={20} className="animate-spin" />
            <span className="text-sm font-medium">טוען מתכון...</span>
          </div>
        )}

        {/* Empty State */}
        {!recipeLoading && recipeIngredients.length === 0 && (() => {
          const hasLinkedModifiers = groups.some(g => (g.items || []).some(item => item.inventory_item_id));
          if (hasLinkedModifiers) return null;
          return (
            <div className="flex flex-col items-center justify-center py-8 gap-3 text-slate-400">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center">
                <BookOpen size={24} className="text-amber-300" />
              </div>
              <p className="text-sm font-medium">אין רכיבים במתכון</p>
              <p className="text-[11px] text-slate-300">חפש והוסף רכיבים מהמלאי</p>
            </div>
          );
        })()}

        {/* Modifier Groups (Replacement & Additive) */}
        {(() => {
          const replacementGroups = groups.filter(g => (g.type || 'replacement') === 'replacement' && (g.items || []).length > 0);
          const additiveGroups = groups.filter(g => g.type === 'additive' && (g.items || []).length > 0);
          
          if (replacementGroups.length === 0 && additiveGroups.length === 0) return null;
          
          return (
            <>
              {/* Replacement Groups */}
              {replacementGroups.map((group, groupIdx) => {
                const groupLinkedItems = [];
                let groupDefaultItem = null;
                
                (group.items || []).forEach(item => {
                  if (item.inventory_item_id) {
                    const invOpt = inventoryOptions.find(o => o.id === item.inventory_item_id);
                    if (invOpt && !groupLinkedItems.find(m => m.inventory_item_id === item.inventory_item_id)) {
                      const entry = {
                        id: `mod-link-${group.id}-${item.inventory_item_id}`,
                        name: invOpt.name || item.name,
                        inventory_item_id: item.inventory_item_id,
                        unit: invOpt.display_unit || invOpt.base_unit || invOpt.unit || '',
                        price: invOpt.cost_per_unit || invOpt.price || 0,
                        recipe_step: Number(invOpt.recipe_step) || Number(invOpt.quantity_step) || 10,
                        isDefault: item.isDefault || item.is_default,
                        modifierName: item.name
                      };
                      groupLinkedItems.push(entry);
                      if (entry.isDefault) groupDefaultItem = entry;
                    }
                  }
                });
                
                if (groupLinkedItems.length === 0) return null;
                
                // Get default quantity from recipe
                const defaultRecipeIng = groupDefaultItem 
                  ? recipeIngredients.find(ri => ri.inventory_item_id === groupDefaultItem.inventory_item_id)
                  : null;
                const defaultQty = defaultRecipeIng ? Number(defaultRecipeIng.quantity) || 0 : 0;
                
                // Active item based on variant selection
                const activeItem = recipeCostVariant 
                  ? groupLinkedItems.find(m => m.inventory_item_id === recipeCostVariant) || groupDefaultItem
                  : groupDefaultItem;
                const finalActiveItem = activeItem || groupDefaultItem;
                
                const activeQty = (defaultQty || (finalActiveItem?.recipe_step || 10)) * sizeMultiplier;
                const activeStep = (finalActiveItem?.recipe_step || 10) * sizeMultiplier;
                const activeSubtotal = (finalActiveItem?.price || 0) * activeQty;
                
                return (
                  <div key={group.id || groupIdx} className="space-y-2">
                    <div className="flex items-center justify-between px-1 mb-2">
                      <span className="text-[12px] font-bold text-indigo-500 uppercase tracking-wide">
                        {group.icon || '🔗'} {group.name} ({groupLinkedItems.length})
                      </span>
                    </div>
                    
                    {/* Variant selector tabs */}
                    <div className="flex gap-1.5 overflow-x-auto pb-1">
                      {groupLinkedItems.map(item => {
                        const isActive = (!recipeCostVariant && item.isDefault) || recipeCostVariant === item.inventory_item_id;
                        return (
                          <button
                            key={item.id}
                            onClick={() => setRecipeCostVariant(item.isDefault ? null : item.inventory_item_id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                              isActive
                                ? 'bg-indigo-500 text-white shadow-md'
                                : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                            }`}
                          >
                            {item.isDefault ? '⭐' : '🔄'} {item.name}
                          </button>
                        );
                      })}
                    </div>
                    
                    {/* Active variant row */}
                    {finalActiveItem && (
                      <div className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 shadow-sm ${
                        finalActiveItem.isDefault 
                          ? 'bg-white border-amber-100/60' 
                          : 'bg-amber-50/60 border-amber-200/60'
                      }`}>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-semibold text-slate-700 block truncate">{finalActiveItem.name}</span>
                          <span className="text-[10px] text-slate-400">
                            {finalActiveItem.unit} | ₪{(finalActiveItem.price * 1000).toFixed(2)}/{finalActiveItem.unit === 'יח׳' ? 'יח׳' : 'ליטר'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-amber-50 rounded-lg px-1.5 py-1">
                          <button
                            onClick={async () => {
                              const baseStep = finalActiveItem?.recipe_step || 10;
                              const baseQty = defaultRecipeIng ? Number(defaultRecipeIng.quantity) || 0 : 0;
                              const newBaseQty = Math.max(baseStep, baseQty - baseStep);

                              if (defaultRecipeIng) {
                                updateIngredientQuantity(defaultRecipeIng.id, newBaseQty);
                              } else if (finalActiveItem) {
                                await addRecipeIngredient({
                                  id: finalActiveItem.inventory_item_id,
                                  name: finalActiveItem.name,
                                  display_unit: finalActiveItem.unit,
                                  recipe_step: finalActiveItem.recipe_step,
                                  price: finalActiveItem.price,
                                }, newBaseQty);
                              }
                            }}
                            className="w-7 h-7 rounded-lg bg-white shadow-sm flex items-center justify-center text-amber-600 hover:bg-amber-100 active:scale-90 transition-all"
                          >
                            <Minus size={12} />
                          </button>
                          <span className="text-sm font-bold text-slate-700 min-w-[40px] text-center">
                            {activeQty % 1 === 0 ? activeQty : activeQty.toFixed(1)}
                          </span>
                          <button
                            onClick={async () => {
                              const baseStep = finalActiveItem?.recipe_step || 10;
                              const baseQty = defaultRecipeIng ? Number(defaultRecipeIng.quantity) || 0 : 0;
                              const newBaseQty = baseQty + baseStep;

                              if (defaultRecipeIng) {
                                updateIngredientQuantity(defaultRecipeIng.id, newBaseQty);
                              } else if (finalActiveItem) {
                                await addRecipeIngredient({
                                  id: finalActiveItem.inventory_item_id,
                                  name: finalActiveItem.name,
                                  display_unit: finalActiveItem.unit,
                                  recipe_step: finalActiveItem.recipe_step,
                                  price: finalActiveItem.price,
                                }, newBaseQty);
                              }
                            }}
                            className="w-7 h-7 rounded-lg bg-white shadow-sm flex items-center justify-center text-amber-600 hover:bg-amber-100 active:scale-90 transition-all"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                        <span className="text-[11px] font-bold text-amber-700 min-w-[45px] text-center">
                          ₪{activeSubtotal.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
              
              {/* Additive Groups */}
              {additiveGroups.map((group, groupIdx) => {
                const groupItems = (group.items || []).filter(item => item.inventory_item_id);
                if (groupItems.length === 0) return null;
                
                return (
                  <div key={`additive-${group.id || groupIdx}`} className="space-y-2">
                    <div className="flex items-center px-1 mb-1">
                      <span className="text-[12px] font-bold text-emerald-500 uppercase tracking-wide">
                        {group.icon || '➕'} {group.name} (אופציונלי)
                      </span>
                    </div>
                    {groupItems.map(item => {
                      const invOpt = inventoryOptions.find(o => o.id === item.inventory_item_id);
                      if (!invOpt) return null;
                      // Additives are optional, displayed with their scaled recipe costs
                      const cost = (invOpt.cost_per_unit || invOpt.price || 0) * (Number(invOpt.recipe_step) || 1) * sizeMultiplier;
                      return (
                        <div key={item.id} className="flex items-center gap-2 bg-emerald-50/50 rounded-xl border border-emerald-100/60 px-3 py-2 shadow-sm">
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-semibold text-slate-700 block truncate">{invOpt.name || item.name}</span>
                            <span className="text-[10px] text-slate-400">{invOpt.unit || ''} | ₪{(invOpt.cost_per_unit || 0).toFixed(2)}/{invOpt.unit || 'יח׳'}</span>
                          </div>
                          <span className="text-[11px] font-bold text-emerald-600">+₪{cost.toFixed(2)}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </>
          );
        })()}

        {/* Ingredient List — filter out replacement modifier items to avoid double counts */}
        {!recipeLoading && (() => {
          const modifierLinkedInvIds = new Set();
          groups.forEach(group => {
            if ((group.type || 'replacement') === 'replacement') {
              (group.items || []).forEach(item => {
                if (item.inventory_item_id) {
                  modifierLinkedInvIds.add(item.inventory_item_id);
                }
              });
            }
          });
          
          const filteredIngredients = recipeIngredients.filter(ing => !modifierLinkedInvIds.has(ing.inventory_item_id));
          if (filteredIngredients.length === 0) return null;
          
          return (
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1 mb-2">
                <span className="text-[12px] font-bold text-slate-500 uppercase tracking-wide">רכיבים ({filteredIngredients.length})</span>
                {recipeSaveStatus === 'saving' && <span className="text-[11px] text-amber-500 flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> שומר...</span>}
                {recipeSaveStatus === 'saved' && <span className="text-[11px] text-emerald-500 flex items-center gap-1"><CheckCircle2 size={12} /> נשמר!</span>}
                {recipeSaveStatus === 'error' && <span className="text-[11px] text-red-500 flex items-center gap-1"><AlertCircle size={12} /> שגיאה</span>}
              </div>
              
              {filteredIngredients.map((ing) => {
                const invItem = inventoryOptions.find(o => o.id === ing.inventory_item_id);
                const baseStep = Number(invItem?.recipe_step) || Number(invItem?.quantity_step) || 1;
                const baseQty = Number(ing.quantity) || 0;
                
                // Scale UI quantities by active size multiplier
                const currentQty = baseQty * sizeMultiplier;
                const scaledSubtotal = (ing.subtotal || 0) * sizeMultiplier;
                
                return (
                  <div key={ing.id} className="flex items-center gap-2 bg-white rounded-xl border border-amber-100/60 px-3 py-2.5 shadow-sm">
                    {/* Name & Unit */}
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-semibold text-slate-700 block truncate">{ing.name}</span>
                      <span className="text-[10px] text-slate-400">{ing.unit} | ₪{(ing.price || 0).toFixed(2)}/{ing.unit}</span>
                    </div>
                    
                    {/* Quantity Controls (adjusting base value, showing scaled UI value) */}
                    <div className="flex items-center gap-1.5 bg-amber-50 rounded-lg px-1.5 py-1">
                      <button
                        onClick={() => updateIngredientQuantity(ing.id, Math.max(baseStep, baseQty - baseStep))}
                        className="w-7 h-7 rounded-lg bg-white shadow-sm flex items-center justify-center text-amber-600 hover:bg-amber-100 active:scale-90 transition-all"
                      >
                        <Minus size={12} />
                      </button>
                      <span className="text-sm font-bold text-slate-700 min-w-[40px] text-center">
                        {currentQty % 1 === 0 ? currentQty : currentQty.toFixed(2)}
                      </span>
                      <button
                        onClick={() => updateIngredientQuantity(ing.id, baseQty + baseStep)}
                        className="w-7 h-7 rounded-lg bg-white shadow-sm flex items-center justify-center text-amber-600 hover:bg-amber-100 active:scale-90 transition-all"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                    
                    {/* Subtotal */}
                    <span className="text-[11px] font-bold text-amber-700 min-w-[45px] text-center">
                      ₪{scaledSubtotal.toFixed(2)}
                    </span>
                    
                    {/* Delete */}
                    <button
                      onClick={() => removeRecipeIngredient(ing.id)}
                      className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-100 active:scale-90 transition-all"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* Cost Summary Footer */}
      {(recipeIngredients.length > 0) && (() => {
        const baseCost = recipeIngredients.reduce((sum, i) => sum + (i.subtotal || 0), 0) * sizeMultiplier;
        
        let modifierCost = 0;
        let variantItem = null;
        
        // Find which GROUP the selected variant belongs to, and calculate cost difference within that group
        if (recipeCostVariant) {
          const modGroups = Array.isArray(selectedItem?.modifiers) ? selectedItem.modifiers : groups;
          for (const group of modGroups) {
            const groupItems = (group.items || []).filter(it => it.inventory_item_id);
            const variant = groupItems.find(it => it.inventory_item_id === recipeCostVariant);
            if (!variant) continue;
            
            // Found the group — get the default from THIS group
            const groupDefault = groupItems.find(it => it.isDefault || it.is_default) || groupItems[0];
            if (!groupDefault || groupDefault.inventory_item_id === recipeCostVariant) break;
            
            const defaultInv = inventoryOptions.find(o => o.id === groupDefault.inventory_item_id);
            const variantInv = inventoryOptions.find(o => o.id === variant.inventory_item_id);
            if (!defaultInv || !variantInv) break;
            
            // Get default's base quantity from recipe
            const defaultRecipeIng = recipeIngredients.find(ri => ri.inventory_item_id === groupDefault.inventory_item_id);
            const qty = defaultRecipeIng ? Number(defaultRecipeIng.quantity) || 0 : (Number(defaultInv.recipe_step) || 10);
            
            const defaultPrice = defaultInv.cost_per_unit || defaultInv.price || 0;
            const variantPrice = variantInv.cost_per_unit || variantInv.price || 0;
            modifierCost = (variantPrice - defaultPrice) * qty * sizeMultiplier;
            variantItem = { ...variant, name: variantInv.name || variant.name };
            break;
          }
        }
        
        const totalCost = baseCost + modifierCost;
        
        return (
          <div className="mt-3 pt-3 border-t border-amber-100/50">
            <div className="flex flex-col gap-1 px-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600">עלות מתכון{variantItem ? ` (עם ${variantItem.name || ''})` : ''} כוללת:</span>
                <span className="text-base font-black text-amber-700">
                  ₪{totalCost.toFixed(2)}
                </span>
              </div>
              {modifierCost !== 0 && (
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">הפרש מודיפייר: {modifierCost > 0 ? '+' : ''}₪{modifierCost.toFixed(2)}</span>
                  <span className="text-slate-400">בסיס: ₪{baseCost.toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </section>
  );
};

export default EditRecipePanel;
