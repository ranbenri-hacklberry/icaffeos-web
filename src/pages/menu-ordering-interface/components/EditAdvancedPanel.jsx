import React from 'react';
import { Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const EditAdvancedPanel = ({
  isActive,
  selectedItem,
  editKdsStation,
  setEditKdsStation,
  editKdsRouting,
  setEditKdsRouting,
  editIsInStock,
  setEditIsInStock,
  onItemUpdated,
  onClose,
}) => {
  if (!isActive) return null;

  return (
    <section className="min-h-[350px]" dir="rtl">
      <div className="space-y-4">

        {/* KDS Station */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">📺 תחנות הצגה (KDS)</h4>
          <div className="grid grid-cols-3 gap-2">
            {[
              { key: 'checker', label: "צ'קר", icon: '✅', alwaysOn: true },
              { key: 'kitchen', label: 'מטבח', icon: '🍳' },
              { key: 'bar', label: 'בר', icon: '🍹' },
            ].map(opt => {
              const isOn = opt.alwaysOn || editKdsStation[opt.key];
              return (
                <button
                  key={opt.key}
                  disabled={opt.alwaysOn}
                  onClick={() => !opt.alwaysOn && setEditKdsStation(prev => ({ ...prev, [opt.key]: !prev[opt.key] }))}
                  className={`flex flex-col items-center gap-1 py-3 rounded-xl border-2 text-center transition-all active:scale-95 ${
                    isOn
                      ? opt.alwaysOn
                        ? 'bg-emerald-50 border-emerald-400 text-emerald-700 shadow-sm cursor-default'
                        : 'bg-indigo-50 border-indigo-400 text-indigo-700 shadow-sm'
                      : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  <span className="text-lg">{opt.icon}</span>
                  <span className="text-[10px] font-bold leading-tight">{opt.label}</span>
                  {opt.alwaysOn && <span className="text-[8px] text-emerald-500">תמיד</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Preparation Type */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">🔄 סוג הכנה</h4>
          <div className="grid grid-cols-3 gap-2">
            {[
              { key: 'GRAB_AND_GO', label: 'מוכן מראש', icon: '🛒' },
              { key: 'MADE_TO_ORDER', label: 'הכנה במקום', icon: '👨‍🍳' },
              { key: 'CONDITIONAL', label: 'בחירת קופאי', icon: '🤔' },
            ].map(opt => (
              <button
                key={opt.key}
                onClick={() => setEditKdsRouting(opt.key)}
                className={`flex flex-col items-center gap-1 py-3 rounded-xl border-2 text-center transition-all active:scale-95 ${
                  editKdsRouting === opt.key
                    ? 'bg-indigo-50 border-indigo-400 text-indigo-700 shadow-sm'
                    : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                <span className="text-lg">{opt.icon}</span>
                <span className="text-[10px] font-bold leading-tight">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>


        {/* Delete Item */}
        <button
          onClick={async () => {
            if (!confirm(`האם למחוק את "${selectedItem?.name}"? לא ניתן לבטל פעולה זו.`)) return;
            try {
              const itemId = selectedItem?.id || selectedItem?.menu_item_id;
              await supabase.from('menu_items').update({ is_deleted: true }).eq('id', itemId);
              if (onItemUpdated) onItemUpdated({ ...selectedItem, is_deleted: true });
              onClose();
            } catch (e) {
              alert('שגיאה במחיקה: ' + e.message);
            }
          }}
          className="w-full py-3 rounded-2xl bg-red-50 border-2 border-red-200 text-red-500 font-bold text-sm flex items-center justify-center gap-2 hover:bg-red-100 hover:border-red-300 active:scale-[0.98] transition-all"
        >
          <Trash2 size={16} />
          <span>מחיקת מנה</span>
        </button>

      </div>
    </section>
  );
};

export default EditAdvancedPanel;
