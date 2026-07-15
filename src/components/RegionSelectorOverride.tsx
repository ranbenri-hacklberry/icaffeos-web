import React from 'react';
import { useLocationCluster } from '@/hooks/useLocationCluster';

const regionLocalization: Record<string, string> = {
  'Jordan Valley': 'בקעת הירדן 🌾',
  'Sharon': 'השרון 🌳',
  'Poleg': 'פולג 🌊'
};

const getLocalizedName = (name: string) => regionLocalization[name] || name;

export const RegionSelectorOverride: React.FC = () => {
  const { regions, selectedRegion, isOverridden, loading, selectRegionManual, clearOverride } = useLocationCluster();

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-4 bg-[#1c1a19] border border-stone-800 rounded-2xl">
        <div className="w-4 h-4 rounded-full border-2 border-amber-500 border-t-transparent animate-spin"></div>
        <span className="text-stone-400 text-sm font-medium">מזהה מיקום...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4 bg-[#1c1a19] border border-stone-800 rounded-2xl shadow-lg w-full max-w-sm">
      <div className="flex justify-between items-center">
        <span className="text-white font-medium text-sm">
          אזור פעיל: <span className="text-amber-500 font-bold">{getLocalizedName(selectedRegion?.name || 'לא נבחר')}</span>
        </span>
        {isOverridden && (
          <button 
            onClick={clearOverride}
            className="text-xs text-amber-500 hover:text-amber-400 underline transition focus:outline-none"
          >
            חזור לזיהוי אוטומטי 🔄
          </button>
        )}
      </div>

      <div className="relative">
        <select
          value={selectedRegion?.id || ''}
          onChange={(e) => selectRegionManual(e.target.value)}
          className="w-full bg-[#121110] text-white rounded-xl pl-3 pr-8 py-3 text-sm border border-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-500 transition appearance-none cursor-pointer"
        >
          {regions.map((region) => (
            <option key={region.id} value={region.id}>
              {getLocalizedName(region.name)}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
          ▼
        </div>
      </div>
      
      {!isOverridden && (
        <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-bold">
          📍 מזהה מיקום אוטומטי פעיל
        </span>
      )}
    </div>
  );
};

export default RegionSelectorOverride;
