import React from 'react';
import { OptionGroup } from '@/components/manager/types';

interface MenuOptionsEditorProps {
  value: Record<string, any>;
  onChange?: (next: Record<string, any>) => void;
  readonly?: boolean;
}

const OPTION_CONFIG = [
  { key: 'allows_plant_milk_mod', label: 'החלפת סוג חלב' },
  { key: 'allows_shot_mod', label: 'שינוי גודל/שוט' },
  { key: 'allows_milk_on_side', label: 'חלב בצד' },
  { key: 'allows_decaf', label: 'נטול קפאין' },
  { key: 'allows_deconstructed', label: 'מפורק (קפה+חלב)' },
  { key: 'allows_foam_mod', label: 'שליטה בקצף' },
  { key: 'allows_water_ratio_mod', label: 'יחס מים/חלב' },
  { key: 'allows_extra_hot', label: 'תוספת חום' },
];

const MenuOptionsEditor: React.FC<MenuOptionsEditorProps> = ({
  value = {},
  onChange,
  readonly = false,
}) => {
  const handleToggle = (key: string) => {
    if (!onChange) return;
    onChange({
      ...value,
      [key]: !value?.[key],
    });
  };

  const handleNumberChange = (key: string, newValue: string) => {
    if (!onChange) return;
    onChange({
      ...value,
      [key]: newValue,
    });
  };

  if (readonly) {
    const enabled = OPTION_CONFIG.filter((opt) => value?.[opt.key]);
    return (
      <div className="space-y-3 mt-4">
        <h4 className="text-sm font-semibold text-gray-600">אפשרויות זמינות</h4>
        {enabled.length ? (
          <div className="flex flex-wrap gap-2">
            {enabled.map((opt) => (
              <span
                key={opt.key}
                className="px-3 py-1 rounded-full border border-blue-200 text-xs text-blue-700 bg-blue-50"
              >
                {opt.label}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-500">לא הוגדרו אפשרויות מיוחדות.</p>
        )}
        {value?.allows_plant_milk_mod && (
          <div className="text-xs text-gray-600">
            תוספת מחיר לחלב צמחי: <strong>{value?.plant_milk_mod_price || 0}₪</strong>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3 mt-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-700">אפשרויות מותאמות אישית</h4>
        <span className="text-xs text-gray-400">לחץ להדליק/לכבות</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {OPTION_CONFIG.map((opt) => {
          const active = !!value?.[opt.key];
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => handleToggle(opt.key)}
              className={`px-3 py-2 rounded-lg border text-xs font-medium transition ${
                active
                  ? 'bg-blue-500 text-white border-blue-500 shadow'
                  : 'bg-white text-gray-700 border-gray-200'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      {value?.allows_plant_milk_mod && (
        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-600" htmlFor="plant-milk-price">
            תוספת מחיר לחלב צמחי (₪)
          </label>
          <input
            id="plant-milk-price"
            type="number"
            min="0"
            step="0.5"
            value={value?.plant_milk_mod_price ?? ''}
            onChange={(e) => handleNumberChange('plant_milk_mod_price', e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-right focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
        </div>
      )}
    </div>
  );
};

export default MenuOptionsEditor;

