
import React, { useState, useEffect, useMemo } from 'react';
import { X, Check } from 'lucide-react';
import { db } from '@/db/database';

const LiteModifierModal = ({ item, onClose, onConfirm }) => {
    const [loading, setLoading] = useState(true);
    const [groups, setGroups] = useState([]);
    const [selections, setSelections] = useState({}); // { groupId: [valueId, ...] }

    // Fetch options from Dexie or Embedded JSON
    useEffect(() => {
        const fetchOptions = async () => {
            try {
                // 🆕 1. Check for Embedded JSON Modifiers (From Onboarding Wizard)
                if (item.modifiers && Array.isArray(item.modifiers) && item.modifiers.length > 0) {
                    console.log("Using Embedded JSON Modifiers for:", item.name);
                    const mappedGroups = item.modifiers.map((group, gIdx) => ({
                        id: `json-g${gIdx}-${group.name}`, // Stable ID
                        name: group.name,
                        requirement: group.requirement || 'optional',
                        logic: group.logic || 'add',
                        values: (group.items || []).map((opt, oIdx) => ({
                            id: `json-v${gIdx}-${oIdx}-${opt.name}`,
                            value_name: opt.name,
                            price_adjustment: Number(opt.price) || 0,
                            // Preserve original meta if needed
                            original_price: Number(opt.price) || 0
                        }))
                    }));

                    setGroups(mappedGroups);
                    setLoading(false);
                    return;
                }

                // 2. Fallback: Dexie Relational Lookup (Legacy)
                // Find groups linked to this item
                const links = await db.menuitemoptions.where('item_id').equals(item.id).toArray();
                const groupIds = links.map(l => l.group_id);

                // Fetch groups
                const groupsData = await db.optiongroups.bulkGet(groupIds);

                // Fetch values for each group
                const fullGroups = await Promise.all(groupsData.filter(g => g).map(async group => {
                    const values = await db.optionvalues.where('group_id').equals(group.id).toArray();
                    return { ...group, values };
                }));

                setGroups(fullGroups);
                setLoading(false);

            } catch (e) {
                console.error("Failed to fetch modifiers", e);
                setLoading(false);
            }
        };
        fetchOptions();
    }, [item.id, item.modifiers]);

    const handleToggle = (group, value) => {
        setSelections(prev => {
            const current = prev[group.id] || [];
            // For now assume single selection per group for simplicity unless configured otherwise
            // Real system has 'max_selection', 'min_selection'.
            // We'll implement simple Toggle:
            // If selected, remove. If not, add (and clear others if single choice logic desired? Let's allow multi for simplicity in Lite).

            // Check if already selected
            const exists = current.find(v => v.id === value.id);
            if (exists) {
                return { ...prev, [group.id]: current.filter(v => v.id !== value.id) };
            } else {
                // Check if group name implies single choice? (e.g "Milk Type")
                // Let's assume single choice for now as it's safer for demo
                return { ...prev, [group.id]: [value] };
            }
        });
    };

    const handleSave = () => {
        // Flatten selections into a list of modifiers compatible with our data structure
        // structure: [{ text: "Soy Milk", valueId: ... }]
        const mods = Object.values(selections).flat().map(v => ({
            text: v.value_name,
            valueId: v.id,
            price: v.price_adjustment
        }));

        onConfirm(mods);
    };

    if (loading) return null;

    // If no groups found, and we are just "loading", maybe auto-close? 
    // Or show "No options" and allow adding notes?
    if (!loading && groups.length === 0) {
        // Auto confirm if no options? Or just show "Add Note"?
        // Let's render a simple "Add Note" UI or just Confirm.
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" dir="rtl">
            <div className="bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-slate-700 flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="p-4 bg-slate-800 border-b border-slate-700 flex justify-between items-center shrink-0">
                    <div>
                        <h2 className="text-xl font-black text-white">{item.name}</h2>
                        {item.current_stock !== null && item.current_stock !== undefined && (
                            <p className="text-xs font-bold text-emerald-400">
                                {item.inventory_settings?.prepType === 'defrost' ? 'מופשרים:' : 'מוכנים:'} {item.current_stock}
                            </p>
                        )}
                    </div>
                    <button onClick={onClose} className="p-2 bg-slate-700 hover:bg-slate-600 rounded-full text-slate-300">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-4 overflow-y-auto flex-1 custom-scrollbar space-y-6">
                    {groups.length === 0 ? (
                        <div className="text-center py-10 text-slate-500">
                            אין אפשרויות בחירה לפריט זה
                        </div>
                    ) : (
                        groups.map(group => (
                            <div key={group.id}>
                                <h3 className="text-amber-500 font-bold mb-3 text-lg border-b border-slate-800 pb-1">
                                    {group.name}
                                </h3>
                                <div className="grid grid-cols-2 gap-3">
                                    {group.values.map(val => {
                                        const isSelected = selections[group.id]?.some(v => v.id === val.id);
                                        return (
                                            <button
                                                key={val.id}
                                                onClick={() => handleToggle(group, val)}
                                                className={`p-3 rounded-xl border text-right transition-all flex justify-between items-center ${isSelected
                                                    ? 'bg-amber-500/20 border-amber-500 text-amber-100 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                                                    : 'bg-slate-800 border-transparent text-slate-400 hover:bg-slate-700'
                                                    }`}
                                            >
                                                <span className="font-bold">{val.value_name}</span>
                                                {val.price_adjustment > 0 && (
                                                    <span className="text-xs bg-slate-900 px-1.5 py-0.5 rounded text-amber-500">
                                                        +{val.price_adjustment}
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-800 border-t border-slate-700 shrink-0">
                    <button
                        onClick={handleSave}
                        className="w-full py-3.5 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-black rounded-xl text-lg shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                        <Check size={24} />
                        <span>הוסף להזמנה</span>
                    </button>
                </div>

            </div>
        </div>
    );
};

export default LiteModifierModal;
