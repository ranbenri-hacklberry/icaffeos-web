import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, Moon, Sun, RefreshCw, Trash2, Lock, FileSpreadsheet, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import EditPanel from '@/pages/ipad-menu-editor/EditPanel';
import PreviewPanel from '@/pages/ipad-menu-editor/PreviewPanel';
import ManagerAuthModal from '@/components/ManagerAuthModal';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import ConnectionStatusBar from '@/components/ConnectionStatusBar';
import MiniMusicPlayer from '@/components/music/MiniMusicPlayer';
import UnifiedHeader from '@/components/UnifiedHeader';
import Icon from '@/components/AppIcon';
import { supabase } from '@/lib/supabase';
import { db } from '@/db/database';
import { fetchAISettings } from '@/services/aiSettingsService';
import * as XLSX from 'xlsx';

/**
 * iPad Menu Editor - Direct Editor Mode
 * Allows editing items directly in Supabase and bulk importing from Excel.
 */
const IPadMenuEditor = () => {
    const { isDarkMode, toggleTheme } = useTheme();
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const [selectedItem, setSelectedItem] = useState(null);
    const [draftItem, setDraftItem] = useState(null);
    const [itemModifiers, setItemModifiers] = useState([]);
    const [isAuthOpen, setIsAuthOpen] = useState(false);
    const [authMode, setAuthMode] = useState('pin');
    const [currentTime, setTime] = useState(new Date());

    // LOCK STATE
    const [isUnlocked, setIsUnlocked] = useState(false);

    // Items Management
    const [localItems, setLocalItems] = useState([]);
    const [isSaving, setIsSaving] = useState(false);
    const [aiSettings, setAiSettings] = useState(null);
    const fileInputRef = useRef(null);
    const [isImporting, setIsImporting] = useState(false);
    const [importProgress, setImportProgress] = useState(0);

    // Load AI Settings
    useEffect(() => {
        if (currentUser?.business_id) {
            setAiSettings(null);
            fetchAISettings(currentUser.business_id).then(setAiSettings);
        }
    }, [currentUser?.business_id]);

    // Load items from Supabase
    useEffect(() => {
        if (!isUnlocked || !currentUser?.business_id) return;

        const loadItems = async () => {
            console.log(`🔄 [MenuEditor] Loading items for business:`, currentUser?.business_id);
            try {
                const { data, error } = await supabase
                    .from('menu_items')
                    .select('*')
                    .eq('business_id', currentUser.business_id)
                    .order('name');

                if (error) {
                    console.error('❌ [MenuEditor] Fetch Error:', error);
                } else {
                    console.log(`✅ [MenuEditor] Fetched ${data?.length || 0} items.`);
                    setLocalItems(data || []);
                }
            } catch (err) {
                console.error('❌ [MenuEditor] Critical Failure:', err);
            }
        };
        loadItems();
    }, [isUnlocked, currentUser?.business_id]);

    // Update time
    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    // Sync draft and fetch modifiers
    useEffect(() => {
        if (selectedItem) {
            setDraftItem({ ...selectedItem });
            fetchModifiers(selectedItem.id);
        } else {
            setDraftItem(null);
            setItemModifiers([]);
        }
    }, [selectedItem]);

    const fetchModifiers = async (itemId) => {
        try {
            // 1. Fetch linked group IDs
            const { data: linked } = await supabase
                .from('menuitemoptions')
                .select('group_id')
                .eq('item_id', itemId);

            const groupIds = linked?.map(l => l.group_id) || [];

            // 2. Fetch groups and their values
            let relevantGroups = [];
            if (groupIds.length > 0) {
                const { data: groups } = await supabase
                    .from('optiongroups')
                    .select('*, optionvalues(id, value_name, price_adjustment, is_default, display_order)')
                    .in('id', groupIds);
                if (groups) relevantGroups = groups;
            }

            // 3. Fetch private groups
            const { data: privateGroups } = await supabase
                .from('optiongroups')
                .select('*, optionvalues(id, value_name, price_adjustment, is_default, display_order)')
                .eq('menu_item_id', itemId);

            if (privateGroups?.length) {
                const existingIds = new Set(relevantGroups.map(g => g.id));
                const uniquePrivate = privateGroups.filter(g => !existingIds.has(g.id));
                relevantGroups = [...relevantGroups, ...uniquePrivate];
            }

            setItemModifiers(relevantGroups);
        } catch (err) {
            console.error('Failed to fetch modifiers:', err);
        }
    };

    const handleSaveRequest = async (updatedItem, updatedModifiers = []) => {
        if (!currentUser?.business_id) return;

        setIsSaving(true);
        try {
            // 1. Save main item data (JSONB + Core fields)
            const itemToSave = {
                ...updatedItem,
                business_id: currentUser.business_id,
                updated_at: new Date().toISOString()
            };

            let result;
            if (typeof updatedItem.id === 'string' && updatedItem.id.startsWith('local_')) {
                const insertData = { ...itemToSave };
                delete insertData.id;
                result = await supabase.from('menu_items').insert([insertData]).select();
            } else {
                result = await supabase.from('menu_items').update(itemToSave).eq('id', updatedItem.id).select();
            }

            if (result.error) throw result.error;
            const savedItem = result.data[0];

            // 2. 🛡️ SYNC TO OLD TABLES: Save modifiers to optiongroups and optionvalues
            if (updatedModifiers && updatedModifiers.length > 0) {
                console.log(`🔄 [MenuEditor] Syncing ${updatedModifiers.length} modifiers to relational tables...`);
                
                for (const group of updatedModifiers) {
                    const groupPayload = {
                        id: group.id,
                        business_id: currentUser.business_id,
                        menu_item_id: savedItem.id,
                        name: group.name || group.title,
                        is_required: group.is_required || group.required || false,
                        is_multiple_select: group.is_multiple_select || group.type === 'multi',
                        updated_at: new Date().toISOString()
                    };
                    
                    await supabase.from('optiongroups').upsert([groupPayload]);
                    
                    if (group.optionvalues && group.optionvalues.length > 0) {
                        const valuesPayload = group.optionvalues.map(v => ({
                            id: v.id,
                            group_id: group.id,
                            value_name: v.value_name || v.name,
                            price_adjustment: v.price_adjustment || v.price || 0,
                            is_default: v.is_default || false,
                            display_order: v.display_order || 0
                        }));
                        await supabase.from('optionvalues').upsert(valuesPayload);
                    }
                }
            }

            setLocalItems(prev => {
                const index = prev.findIndex(i => i.id === updatedItem.id);
                if (index !== -1) {
                    const newItems = [...prev];
                    newItems[index] = savedItem;
                    return newItems;
                }
                return [...prev, savedItem];
            });

            setSelectedItem(savedItem);
            alert('שינויים נשמרו בהצלחה (כולל סנכרון לטבלאות ישנות)');
        } catch (err) {
            console.error('Save failed:', err);
            alert(`שגיאה בשמירה: ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleExcelUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file || !currentUser?.business_id) return;

        setIsImporting(true);
        setImportProgress(10);

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = new Uint8Array(event.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

                const formattedItems = json.map(row => ({
                    name: row['Item Name'] || row['Name'] || row['שם'],
                    category: row['Category'] || row['קטגוריה'] || 'כללי',
                    price: parseFloat(row['Price'] || row['מחיר'] || 0),
                    description: row['Description'] || row['תיאור'] || '',
                    business_id: currentUser.business_id,
                    created_at: new Date().toISOString()
                })).filter(item => item.name);

                const { data: insertedData, error } = await supabase.from('menu_items').insert(formattedItems).select();
                if (error) throw error;

                setLocalItems(prev => [...prev, ...insertedData]);
                alert(`בוצע! נוספו ${insertedData.length} פריטים.`);
            } catch (err) {
                alert(`שגיאה בייבוא: ${err.message}`);
            } finally {
                setIsImporting(false);
                setImportProgress(0);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleRefresh = async () => {
        setIsSaving(true);
        try {
            const { data } = await supabase.from('menu_items').select('*').eq('business_id', currentUser.business_id).order('name');
            if (data) setLocalItems(data);
        } finally {
            setIsSaving(false);
        }
    };

    if (!isUnlocked) {
        return (
            <div className={`fixed inset-0 z-50 flex items-center justify-center ${isDarkMode ? 'bg-slate-900' : 'bg-slate-100'}`} dir="rtl">
                <div className="text-center space-y-6 max-w-sm w-full p-8 bg-white opacity-1 shadow-2xl rounded-3xl" style={{ backgroundColor: isDarkMode ? '#1e293b' : 'white' }}>
                    <div className="w-20 h-20 bg-orange-500 rounded-2xl mx-auto flex items-center justify-center shadow-lg">
                        <Lock size={32} className="text-white" />
                    </div>
                    <div>
                        <h2 className={`text-2xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>עורך תפריט</h2>
                        <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>הזן קוד מנהל</p>
                    </div>
                    <PinEntry onVerify={async (pin) => {
                        const { data } = await supabase.rpc('verify_manager_pin', { p_pin: pin });
                        if (data?.valid) { setIsUnlocked(true); return true; }
                        return false;
                    }} />
                    <button onClick={() => navigate('/mode-selection')} className="text-sm text-slate-400 underline">חזור</button>
                </div>
            </div>
        );
    }

    return (
        <div className={`flex flex-col h-screen w-full overflow-hidden ${isDarkMode ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-900'}`} dir="rtl">
            <UnifiedHeader title={`עורך תפריט - ${currentUser?.business_name || 'טוען...'}`} subtitle={`פריטים: ${localItems?.length || 0}`} onHome={() => navigate('/mode-selection')}>
                <div className="flex items-center gap-2">
                    <button onClick={handleRefresh} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl">
                        <RefreshCw size={20} className={isSaving ? 'animate-spin' : ''} />
                    </button>
                    <div className="w-px h-6 bg-slate-200 mx-2" />
                    <input type="file" ref={fileInputRef} onChange={handleExcelUpload} className="hidden" accept=".xlsx, .xls" />
                    <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg">
                        {isImporting ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
                        {isImporting ? `מייבא (${importProgress}%)...` : 'ייבוא Excel'}
                    </button>
                    <div className="w-px h-6 bg-slate-200 mx-2" />
                    <button onClick={toggleTheme} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-yellow-500">
                        {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
                    </button>
                    <button onClick={() => setIsUnlocked(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-red-500"><Lock size={20} /></button>
                </div>
            </UnifiedHeader>
            <div className="flex flex-1 overflow-hidden">
                <div className="flex-1 h-full overflow-y-auto p-6">
                    <PreviewPanel onItemSelect={setSelectedItem} activeId={selectedItem?.id} localItems={localItems} />
                </div>
                <motion.div initial={{ x: 300 }} animate={{ x: 0 }} className={`w-[400px] border-r shadow-xl z-20 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                    <EditPanel item={draftItem} onItemChange={setDraftItem} modifiers={itemModifiers} onModifiersChange={setItemModifiers} onSave={handleSaveRequest} onClose={() => setSelectedItem(null)} aiSettings={aiSettings} businessId={currentUser?.business_id} />
                </motion.div>
            </div>
        </div>
    );
};

const PinEntry = ({ onVerify }) => {
    const [pin, setPin] = useState('');
    const [loading, setLoading] = useState(false);
    const handleNum = async (num) => {
        if (pin.length < 4) {
            const newPin = pin + num;
            setPin(newPin);
            if (newPin.length === 4) {
                setLoading(true);
                const ok = await onVerify(newPin);
                setLoading(false);
                if (!ok) setPin('');
            }
        }
    };
    return (
        <div className="flex flex-col items-center gap-4">
            <div className="flex gap-2">
                {[0, 1, 2, 3].map(i => (
                    <div key={i} className={`w-12 h-14 rounded-xl border-2 flex items-center justify-center ${pin.length > i ? 'border-orange-500 bg-orange-500/10' : 'border-slate-200'}`}>
                        {pin.length > i && <div className="w-3 h-3 rounded-full bg-orange-500" />}
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-3 gap-3 w-64" dir="ltr">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, 'del'].map((n, i) => (
                    <button key={i} onClick={() => n === 'C' ? setPin('') : n === 'del' ? setPin(p => p.slice(0, -1)) : handleNum(n)} disabled={loading} className={`h-14 rounded-xl font-bold bg-slate-100 dark:bg-slate-700`}>
                        {n}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default IPadMenuEditor;
