import React, { useState, useRef } from 'react';
import { X, Plus, Check, Search } from 'lucide-react';

// KDS color mapping for modifiers
const getModClass = (text) => {
    if (!text) return 'mod-color-gray';
    const t = String(text).toLowerCase().trim();

    if (t.includes('בלי קצף') || t.includes('ללא קצף')) return 'mod-color-foam-none';
    if (t.includes('פחות קצף') || t.includes('מעט קצף')) return 'mod-color-foam-down';
    if (t.includes('הרבה קצף') || t.includes('אקסטרה קצף')) return 'mod-color-foam-up';

    if (t.includes('בלי') || t.includes('ללא') || t.includes('הורד')) return 'mod-color-red';

    if (t.includes('תוספת') || t.includes('אקסטרה') || t.includes('בצד') || t.includes('קצף')) return 'mod-color-lightgreen';

    if (t.includes('סויה') || t.includes('שיבולת שועל') || t.includes('שיבולת')) return 'mod-color-soy-oat';
    if (t.includes('שקדים')) return 'mod-color-almond';
    if (t.includes('נטול') || t.includes('דקף') || t.includes('ללא לקטוז')) return 'mod-color-lactose-free';

    if (t.includes('רותח') || t.includes('חם מאוד')) return 'mod-color-extra-hot';
    if (t.includes('חזק') || t.includes('כפול')) return 'mod-color-strong';
    if (t.includes('חלש') || t.includes('קל')) return 'mod-color-light';
    if (t.includes('דל') || t.includes('low')) return 'mod-color-purple';

    return 'mod-color-gray';
};

const ModifierGroup = ({
    group,
    isSelected,
    onToggle,
    onAddOption,
    onDeleteOption,
    allOptionNames = [],
    isEditing,
    onStartEdit,
    onCancelEdit,
    onSaveNewOption
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [newOptionData, setNewOptionData] = useState({ name: '', price: '0', is_default: false });
    const searchRef = useRef(null);

    const filteredSuggestions = allOptionNames.filter(name =>
        name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSelectSuggestion = (name) => {
        setSearchTerm(name);
        setNewOptionData(prev => ({ ...prev, name }));
        setShowSuggestions(false);
    };

    const adjustOptionPrice = (amount) => {
        setNewOptionData(prev => ({
            ...prev,
            price: Math.max(0, parseFloat((Number(prev.price) + amount).toFixed(2))).toString()
        }));
    };

    const handleSave = () => {
        const nameToSave = searchTerm.trim() || newOptionData.name.trim();
        if (!nameToSave) return;

        onSaveNewOption({
            name: nameToSave,
            price: Number(newOptionData.price),
            is_default: newOptionData.is_default
        });

        // Reset state
        setSearchTerm('');
        setNewOptionData({ name: '', price: '0', is_default: false });
    };

    return (
        <div
            className={`border rounded-xl transition-all duration-200 overflow-hidden ${isSelected ? 'border-blue-500 bg-blue-50/10' : 'border-gray-200 bg-white'
                }`}
        >
            {/* Header */}
            <div
                className="p-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={onToggle}
            >
                {/* Checkbox Indicator */}
                <div className={`w-6 h-6 rounded border flex items-center justify-center shrink-0 transition-all ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300 bg-white'
                    }`}>
                    {isSelected && <Check size={14} className="text-white" strokeWidth={3} />}
                </div>

                {/* Name */}
                <span className={`font-bold text-base flex-1 ${isSelected ? 'text-blue-900' : 'text-gray-700'}`}>
                    {group.name}
                </span>

                {/* Add Trigger */}
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onStartEdit(); }}
                    className="px-3 py-1.5 bg-gray-100 text-gray-600 hover:bg-blue-100 hover:text-blue-600 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors"
                >
                    <Plus size={14} strokeWidth={3} />
                    הוסף
                </button>
            </div>

            {/* Options List - KDS Style */}
            <div className="px-3 pb-3 flex flex-wrap gap-2">
                {group.optionvalues?.map(ov => (
                    <div
                        key={ov.id}
                        className={`mod-label py-1 px-2 text-xs rounded-md border cursor-default flex items-center gap-1.5 ${getModClass(ov.value_name)} ${isSelected ? '' : 'opacity-40 grayscale'}`}
                    >
                        {/* Delete Button */}
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onDeleteOption(ov.id); }}
                            className="w-4 h-4 flex items-center justify-center rounded-full bg-black/10 hover:bg-red-500 hover:text-white transition-colors text-current"
                        >
                            <X size={10} strokeWidth={3} />
                        </button>

                        <span className="font-bold">{ov.value_name}</span>

                        {ov.price_adjustment > 0 && (
                            <span className="bg-black/5 px-1 rounded text-[10px] font-mono">+{ov.price_adjustment}</span>
                        )}
                    </div>
                ))}
            </div>

            {/* Inline Editor */}
            {isEditing && (
                <div
                    className="mx-3 mb-3 p-3 bg-white border border-blue-200 rounded-xl shadow-lg flex flex-col gap-3 animate-in slide-in-from-top-1 z-20 relative"
                    onClick={e => e.stopPropagation()}
                >
                    <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                        <span className="font-bold text-blue-800 text-xs">הוספת אפשרות ל{group.name}</span>
                        <button onClick={onCancelEdit} className="text-gray-400 hover:text-red-500">
                            <X size={16} />
                        </button>
                    </div>

                    {/* Search Box */}
                    <div className="relative" ref={searchRef}>
                        <div className="flex items-center border rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500/20 bg-gray-50">
                            <div className="p-2 text-gray-400"><Search size={16} /></div>
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={e => {
                                    setSearchTerm(e.target.value);
                                    setShowSuggestions(true);
                                }}
                                onFocus={() => setShowSuggestions(true)}
                                className="w-full py-2 bg-transparent outline-none text-sm font-bold"
                                placeholder="חפש או הקלד שם חדש..."
                                autoFocus
                            />
                        </div>

                        {/* Suggestions Dropdown */}
                        {showSuggestions && (
                            <div className="absolute top-full right-0 left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto z-50">
                                {filteredSuggestions.map((name, i) => (
                                    <button
                                        key={i}
                                        type="button"
                                        onClick={() => handleSelectSuggestion(name)}
                                        className="w-full text-right px-3 py-2 text-sm hover:bg-blue-50 hover:text-blue-700 block border-b border-gray-50 last:border-0 truncate"
                                    >
                                        {name}
                                    </button>
                                ))}
                                {searchTerm && !filteredSuggestions.includes(searchTerm) && (
                                    <button
                                        type="button"
                                        onClick={() => handleSelectSuggestion(searchTerm)}
                                        className="w-full text-right px-3 py-2 text-sm bg-green-50 text-green-700 hover:bg-green-100 font-bold block"
                                    >
                                        + צור חדש: "{searchTerm}"
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Price & Default */}
                    <div className="flex items-center gap-3">
                        <div className="flex items-center bg-gray-50 rounded-lg border border-gray-200">
                            <button type="button" onClick={() => adjustOptionPrice(-1)} className="w-8 h-8 flex items-center justify-center text-red-500 font-bold hover:bg-white rounded-r-lg">-</button>
                            <input
                                type="number"
                                value={newOptionData.price}
                                onChange={e => setNewOptionData({ ...newOptionData, price: e.target.value })}
                                className="w-12 text-center text-sm font-black bg-transparent outline-none"
                            />
                            <button type="button" onClick={() => adjustOptionPrice(1)} className="w-8 h-8 flex items-center justify-center text-blue-500 font-bold hover:bg-white rounded-l-lg">+</button>
                        </div>

                        <label className="flex items-center gap-1.5 cursor-pointer bg-gray-50 px-2 py-1.5 rounded-lg border border-gray-200">
                            <input
                                type="checkbox"
                                checked={newOptionData.is_default}
                                onChange={e => setNewOptionData({ ...newOptionData, is_default: e.target.checked })}
                                className="w-4 h-4 accent-blue-600 rounded"
                            />
                            <span className="font-bold text-xs text-gray-500">ברירת מחדל</span>
                        </label>

                        <button
                            onClick={handleSave}
                            className="flex-1 py-1.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow text-sm"
                        >
                            שמור
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default React.memo(ModifierGroup);
