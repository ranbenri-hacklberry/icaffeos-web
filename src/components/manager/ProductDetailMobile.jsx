import React from 'react';
import MenuOptionsEditor from '@/components/manager/MenuOptionsEditor';

const LABEL_MAP = {
  name: 'שם פריט',
  description: 'תיאור',
  price: 'מחיר',
  category: 'קטגוריה',
  status: 'סטטוס',
  sku: 'מק״ט',
  availability: 'זמינות',
};

const HIDDEN_KEYS = ['id', 'created_at', 'updated_at', 'image_url', 'addons', 'add_ons', 'modifiers'];

const parseAddons = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return raw.split(',').map((text) => text.trim()).filter(Boolean);
    }
  }
  return [];
};

const formatValue = (key, value) => {
  if (value === null || value === undefined || value === '') return '—';
  if (key === 'price') return `${value}₪`;
  if (typeof value === 'boolean') return value ? 'כן' : 'לא';
  return value;
};

const ProductDetailMobile = ({
  item,
  onBack,
  editingItem,
  editForm,
  setEditForm,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
}) => {
  if (!item) return null;

  const addonList = parseAddons(item.addons ?? item.add_ons ?? item.modifiers);

  const detailFields = Object.entries(item).filter(
    ([key, value]) => !HIDDEN_KEYS.includes(key) && typeof value !== 'object'
  );

  const isEditing = editingItem === item.id;

  return (
    <div className="bg-white rounded-xl shadow p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">{item.name}</h2>
          <p className="text-xs text-gray-400">מזהה #{item.id}</p>
        </div>
        <button
          onClick={onBack}
          className="text-sm text-blue-600 border border-blue-200 px-3 py-1 rounded"
        >
          ← חזרה
        </button>
      </div>

      <div className="flex justify-end">
        {isEditing ? (
          <div className="flex gap-2 text-sm">
            <button
              onClick={onSaveEdit}
              className="px-3 py-1 bg-green-500 text-white rounded"
            >
              שמור
            </button>
            <button
              onClick={onCancelEdit}
              className="px-3 py-1 bg-gray-200 text-gray-700 rounded"
            >
              בטל
            </button>
          </div>
        ) : (
          <button
            onClick={onStartEdit}
            className="px-3 py-1 bg-blue-500 text-white rounded text-sm"
          >
            עריכה מהירה
          </button>
        )}
      </div>

      {item.image_url && (
        <img
          src={item.image_url}
          alt={item.name}
          className="w-full h-48 object-cover rounded-lg"
        />
      )}

      {isEditing ? (
        <div className="space-y-3">
          <input
            value={editForm?.name || ''}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-right text-sm"
            placeholder="שם פריט"
          />
          <input
            type="number"
            value={editForm?.price || ''}
            onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-right text-sm"
            placeholder="מחיר"
          />
          <input
            value={editForm?.category || ''}
            onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-right text-sm"
            placeholder="קטגוריה"
          />
          <input
            value={editForm?.status || ''}
            onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-right text-sm"
            placeholder="סטטוס/זמינות"
          />
          <MenuOptionsEditor value={editForm} onChange={setEditForm} />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3">
            {detailFields.map(([key, value]) => (
              <div key={key} className="border border-gray-100 rounded-lg p-3">
                <p className="text-xs text-gray-500">{LABEL_MAP[key] || key}</p>
                <p className="text-base font-semibold text-gray-900">
                  {formatValue(key, value)}
                </p>
              </div>
            ))}
          </div>
          <MenuOptionsEditor value={item} readonly />
        </>
      )}

      {addonList.length > 0 && (
        <div className="border border-blue-100 rounded-lg p-3">
          <h3 className="text-sm font-bold text-blue-700 mb-2">תוספות זמינות</h3>
          <ul className="space-y-1 text-sm text-gray-700 list-disc pr-4">
            {addonList.map((addon, idx) => (
              <li key={idx}>{addon.name || addon.title || addon}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ProductDetailMobile;

