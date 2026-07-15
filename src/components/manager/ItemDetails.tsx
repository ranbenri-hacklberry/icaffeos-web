import React, { useCallback, useEffect, useState } from 'react';
import MenuOptionsEditor from '@/components/manager/MenuOptionsEditor';
import { OptionGroup } from '@/components/manager/types';
import { fetchManagerItemOptions } from '@/lib/managerApi';

interface ItemDetailsProps {
  selectedItem: Record<string, any> | null;
  editingItem: string | number | null;
  editForm: Record<string, any>;
  setEditForm: (next: Record<string, any>) => void;
  onStartEdit: () => void;
  onSaveEdit: (payload?: Record<string, any>, options?: OptionGroup[]) => void;
  onCancelEdit: () => void;
}

const ItemDetails: React.FC<ItemDetailsProps> = ({
  selectedItem,
  editingItem,
  editForm,
  setEditForm,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
}) => {
  const [optionGroups, setOptionGroups] = useState<OptionGroup[]>([]);
  const [isOptionsLoading, setIsOptionsLoading] = useState<boolean>(true);
  const [optionsError, setOptionsError] = useState<string | null>(null);

  const isEditing = selectedItem && editingItem === selectedItem.id;

  const fetchOptions = useCallback(async () => {
    if (!selectedItem?.id) {
      setOptionGroups([]);
      setIsOptionsLoading(false);
      return;
    }

    setIsOptionsLoading(true);
    setOptionsError(null);
    try {
      const groups = await fetchManagerItemOptions(selectedItem.id);
      setOptionGroups(groups);
    } catch (error: any) {
      setOptionGroups([]);
      setOptionsError(error?.message || 'שגיאה בטעינת האפשרויות');
    } finally {
      setIsOptionsLoading(false);
    }
  }, [selectedItem?.id]);

  useEffect(() => {
    fetchOptions();
  }, [fetchOptions]);

  const handleSubmit = () => {
    const payload = { ...editForm };
    onSaveEdit?.(payload, optionGroups);
  };

  if (!selectedItem) return null;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-6 space-y-4">
        {isEditing ? (
          <>
            <h3 className="text-2xl font-bold mb-2">עריכת פריט</h3>
            <div className="space-y-4">
              <input
                value={editForm.name || ''}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder="שם"
                className="w-full p-3 border rounded"
              />
              <input
                value={editForm.price || ''}
                onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                placeholder="מחיר"
                type="number"
                className="w-full p-3 border rounded"
              />
              <input
                value={editForm.category || ''}
                onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                placeholder="קטגוריה"
                className="w-full p-3 border rounded"
              />
              <input
                value={editForm.status || ''}
                onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                placeholder="סטטוס (זמין/לא זמין)"
                className="w-full p-3 border rounded"
              />
              <MenuOptionsEditor value={editForm} onChange={setEditForm} />
              <div className="flex gap-2">
                <button onClick={handleSubmit} className="bg-green-500 text-white px-6 py-2 rounded">
                  שמור שינויים
                </button>
                <button onClick={onCancelEdit} className="bg-gray-500 text-white px-6 py-2 rounded">
                  בטל
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-2xl font-bold">{selectedItem.name}</h3>
              <button
                onClick={onStartEdit}
                className="bg-blue-500 text-white px-4 py-2 rounded text-sm"
              >
                ערוך
              </button>
            </div>
            {selectedItem.image_url && (
              <img
                src={selectedItem.image_url}
                alt={selectedItem.name}
                className="w-full h-64 object-cover rounded mb-4"
              />
            )}
            <div className="space-y-2">
              <p><strong>מחיר:</strong> {selectedItem.price}₪</p>
              <p><strong>קטגוריה:</strong> {selectedItem.category}</p>
              <p><strong>סטטוס:</strong> {selectedItem.status || 'זמין'}</p>
            </div>
          </>
        )}

        <div className="border-t pt-4">
          <h4 className="text-lg font-semibold mb-2">אפשרויות מותאמות</h4>
          {isOptionsLoading ? (
            <p className="text-sm text-gray-500">טוען אפשרויות...</p>
          ) : optionsError ? (
            <p className="text-sm text-red-600">{optionsError}</p>
          ) : optionGroups.length === 0 ? (
            <p className="text-sm text-gray-500">אין אפשרויות מוגדרות לפריט זה.</p>
          ) : (
            <div className="space-y-4">
              {optionGroups.map((group) => (
                <div key={group.id} className="border border-gray-100 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{group.title}</p>
                      {group.description && (
                        <p className="text-xs text-gray-500">{group.description}</p>
                      )}
                    </div>
                    {group.required && (
                      <span className="text-xs text-red-500">חובה</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {group.values?.map((value) => (
                      <span
                        key={value.id}
                        className="px-3 py-1 rounded-full border border-gray-200 text-xs text-gray-700 bg-gray-50"
                      >
                        {value.name}
                        {value.price ? ` (+${value.price}₪)` : ''}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ItemDetails;

