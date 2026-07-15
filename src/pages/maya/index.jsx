import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '@/components/AppIcon';
import ManagerHeader from '@/components/manager/ManagerHeader';
import { supabase } from '@/lib/supabase';
import { db } from '@/db/database';
import { useAuth } from '@/context/AuthContext';
import { Send, Mic, MicOff, Coffee, TrendingUp, Users, Settings, RefreshCw, Loader2, BookOpen, Calendar, Package, ClipboardList, Copy as CopyIcon, Edit2, Check, X, Terminal } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { searchCode, formatCodeContext } from '@/services/codeSearchService';
import { askMaya } from '@/services/aiService';
import { mcpClient } from '@/services/mcpClient';

const MAYA_VERSION = "v2.0 - RAG Code Expert Mode";

const MayaAssistant = () => {
    const { currentUser } = useAuth();
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isImpersonating, setIsImpersonating] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [editingMessageId, setEditingMessageId] = useState(null);
    const [editContent, setEditContent] = useState('');

    // Context Data
    const [contextData, setContextData] = useState({
        menu: '', team: '', salesSummary: '', inventoryDetails: '', recentLogs: '',
        lastUpdate: null, debugInfo: 'מחברת נתונים...',
        status: { sales: 'idle', menu: 'idle', team: 'idle', inventory: 'idle' }
    });
    const [isContextLoading, setIsContextLoading] = useState(false);
    const [isMcpConnected, setIsMcpConnected] = useState(false);

    const messagesEndRef = useRef(null);
    const recognitionRef = useRef(null);
    const navigate = useNavigate();

    // Auto-scroll logic
    useEffect(() => {
        const timer = setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 150);
        return () => clearTimeout(timer);
    }, [messages, isLoading]);

    // MCP Connection
    useEffect(() => {
        const initMcp = async () => {
            try {
                console.log('🔌 Connecting to icaffeOS Cloud...');
                const connected = await mcpClient.connect();
                setIsMcpConnected(connected === true);
            } catch (e) {
                console.error('MCP Init Error:', e);
            }
        };
        initMcp();
    }, []);

    // Permission check
    useEffect(() => {
        if (!currentUser) {
            navigate('/login');
            return;
        }
        const accessLevel = (currentUser?.access_level || '').toLowerCase();
        const role = (currentUser?.role || '').toLowerCase();
        const isAuthorized = role === 'admin' || role === 'manager' || role === 'owner' ||
            accessLevel === 'admin' || accessLevel === 'manager' || accessLevel === 'owner' ||
            currentUser?.is_admin;

        if (!isAuthorized) {
            navigate('/mode-selection');
        }
    }, [currentUser, navigate]);

    // Logout handler
    const handleLogout = () => {
        localStorage.removeItem('manager_auth_key');
        localStorage.removeItem('manager_auth_time');
        localStorage.removeItem('manager_employee_id');
        navigate('/mode-selection');
    };

    // Handle saving edited/corrected message
    const handleSaveEdit = async (messageId) => {
        if (!editContent.trim()) return;

        try {
            // Update in Supabase - add [תוקן] prefix to mark as corrected
            const correctedContent = `✅ **[תשובה מתוקנת]**\n\n${editContent.trim()}`;

            const { error } = await supabase
                .from('maya_chat_history')
                .update({ content: correctedContent })
                .eq('id', messageId);

            if (error) {
                console.error('Error saving edit:', error);
                alert('שגיאה בשמירת התיקון');
                return;
            }

            // Update local state
            setMessages(prev => prev.map(msg =>
                msg.id === messageId
                    ? { ...msg, content: correctedContent }
                    : msg
            ));

            setEditingMessageId(null);
            setEditContent('');
            console.log('✅ Maya learned from correction:', messageId);
        } catch (e) {
            console.error('Edit save error:', e);
        }
    };

    // Context Loader - Full Business Intelligence
    const [showDebug, setShowDebug] = useState(false);
    const [debugLogs, setDebugLogs] = useState([]);

    const loadContext = useCallback(async () => {
        if (!currentUser?.business_id) return;
        setIsContextLoading(true);
        console.log('🌸 Maya: Deep Syncing Business State...');

        const lastWeek = new Date(); lastWeek.setDate(lastWeek.getDate() - 7);
        const todayStr = new Date().toLocaleDateString('en-CA');
        const yesterdayDate = new Date(); yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        const yesterdayStr = yesterdayDate.toLocaleDateString('en-CA');

        // 1. Sales Intelligence (Hybrid: Cloud First -> Dexie Fallback)
        try {
            // Expanded to 30 days for better context (User request)
            const historyStart = new Date();
            historyStart.setDate(historyStart.getDate() - 30);
            const startDateISO = historyStart.toISOString();
            const endDateISO = new Date().toISOString();

            console.log('🔄 Maya: Fetching sales intelligence (Cloud Preferred)...');
            let salesRaw = [];
            let source = 'Local';

            // ATTEMPT 1: Cloud RPC (Full History)
            const { data: rpcData, error: rpcError } = await supabase.rpc('get_sales_data', {
                p_business_id: currentUser.business_id,
                p_start_date: startDateISO,
                p_end_date: endDateISO
            });

            if (!rpcError && rpcData) {
                source = 'Cloud (Supabase)';
                // Transform RPC result to internal structure
                salesRaw = rpcData.map(o => ({
                    id: 'cloud-' + Math.random(), // Virtual ID
                    created_at: o.created_at,
                    ready_at: o.ready_at,
                    total_amount: o.total || 0,
                    customer_name: o.customer_name,
                    customer_phone: o.customer_phone,
                    // RPC returns flattened structure, map to object format Maya expects
                    order_items: (o.order_items || []).map(i => ({
                        quantity: i.quantity,
                        menu_items: { name: i.name }
                    }))
                }));
                console.log(`☁️ Maya loaded ${salesRaw.length} orders from Cloud (30 Days).`);
            } else {
                console.warn('⚠️ Maya Cloud sync failed, falling back to local Dexie.', rpcError);
                // ATTEMPT 2: Local Dexie (Limited by Sync Window, usually 48h)
                salesRaw = await db.orders
                    .where('created_at')
                    .above(startDateISO)
                    .filter(o => o.business_id === currentUser.business_id && o.order_status !== 'cancelled')
                    .toArray();

                // Hydrate items for local data
                const orderIds = salesRaw.map(o => o.id);
                const allOrderItems = await db.order_items.where('order_id').anyOf(orderIds).toArray();
                const menuItemIds = [...new Set(allOrderItems.map(i => i.menu_item_id))];
                const menuItems = await db.menu_items.where('id').anyOf(menuItemIds).toArray();
                const menuMap = {};
                menuItems.forEach(mi => menuMap[mi.id] = mi.name);

                salesRaw.forEach(o => {
                    o.order_items = allOrderItems.filter(i => i.order_id === o.id).map(i => ({
                        ...i,
                        menu_items: { name: menuMap[i.menu_item_id] || 'Unknown' }
                    }));
                });
                console.log(`💾 Dexie returned: ${salesRaw.length} orders (Local Backup).`);
            }

            const dailyMap = {};
            const totalMap = {};
            const customerMap = {};
            let totalOrders = salesRaw?.length || 0;
            let weeklyRevenue = 0;
            let totalPrepTime = 0;
            let prepTimeCount = 0;

            if (Array.isArray(salesRaw)) {
                salesRaw.forEach(order => {
                    const date = order.created_at ? new Date(order.created_at).toLocaleDateString('en-CA') : 'unknown';
                    if (!dailyMap[date]) dailyMap[date] = { items: {}, revenue: 0, count: 0 };

                    // Revenue
                    const orderTotal = parseFloat(order.total_amount) || 0;
                    dailyMap[date].revenue += orderTotal;
                    dailyMap[date].count += 1;
                    weeklyRevenue += orderTotal;

                    // Prep Time Analysis
                    if (order.created_at && order.ready_at) {
                        const start = new Date(order.created_at);
                        const end = new Date(order.ready_at);
                        const diffMins = (end - start) / 1000 / 60;
                        if (diffMins > 0 && diffMins < 120) { // Filter out anomalies
                            totalPrepTime += diffMins;
                            prepTimeCount++;
                        }
                    }

                    // Customer Intelligence
                    const custName = order.customer_name || 'Guest';
                    const custPhone = order.customer_phone || 'N/A';
                    if (custPhone !== 'N/A') {
                        if (!customerMap[custPhone]) customerMap[custPhone] = { name: custName, orders: 0, spend: 0, lastOrder: date };
                        customerMap[custPhone].orders += 1;
                        customerMap[custPhone].spend += orderTotal;
                    }

                    // Items
                    (order.order_items || []).forEach(item => {
                        const name = item.menu_items?.name || 'פריט לא מזוהה';
                        const qty = parseFloat(item.quantity) || 1;
                        dailyMap[date].items[name] = (dailyMap[date].items[name] || 0) + qty;
                        totalMap[name] = (totalMap[name] || 0) + qty;
                    });
                });
            }

            const avgPrepTime = prepTimeCount > 0 ? (totalPrepTime / prepTimeCount).toFixed(1) : 'לא ידוע';

            const formatDay = (dateStr, label) => {
                const dayData = dailyMap[dateStr];
                if (!dayData) return `${label} (${dateStr}): ₪0 (0 הזמנות).`;

                const topItems = Object.entries(dayData.items).sort((a, b) => b[1] - a[1]).slice(0, 5);
                const itemStr = topItems.map(([n, q]) => `${n} (${q})`).join(', ');
                return `${label} (${dateStr}): ₪${dayData.revenue.toLocaleString()} (${dayData.count} הזמנות). מובילים: ${itemStr}`;
            };

            // Generate list of last 7 days for the prompt context
            const last7Days = [];
            for (let i = 0; i < 7; i++) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const dStr = d.toLocaleDateString('en-CA');
                const dayName = d.toLocaleDateString('he-IL', { weekday: 'long' });
                last7Days.push(formatDay(dStr, dayName));
            }

            // Top Customers (Anonymized for prompt context, but ready for direct lookup)
            const topCustomers = Object.entries(customerMap)
                .sort((a, b) => b[1].spend - a[1].spend)
                .slice(0, 5)
                .map(([phone, data]) => `${data.name} (${phone}): ${data.orders} הזמנות, ₪${data.spend.toLocaleString()}`)
                .join('\n');

            const finalSummary = `
=== תקציר עסקי (7 ימים) ===
${last7Days.join('\n')}

=== מדדי ביצוע (KPIs) ===
💰 הכנסות שבועיות: ₪${weeklyRevenue.toLocaleString()}
⏱️ זמן הכנה ממוצע: ${avgPrepTime} דקות
👥 לקוחות בולטים:
${topCustomers}
${topCustomers}
`;

            // DETAILED TRANSACTION LOG (CSV) for Low-Cost/High-Context Analysis
            // Format: Date,Time,Amount,Items
            const detailedLog = salesRaw.slice(0, 50).map(o => { // Limit to 50 recent orders to fit standard context
                const dateObj = new Date(o.created_at);
                const date = dateObj.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });
                const time = dateObj.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
                const items = (o.order_items || []).map(i => i.menu_items?.name).join('+');
                return `${date} ${time}, ₪${o.total_amount}, [${items}]`;
            }).join('\n');

            setContextData(prev => ({
                ...prev,
                salesSummary: finalSummary,
                salesLog: detailedLog,
                status: { ...prev.status, sales: 'success' },
                debugInfo: `${totalOrders} הזמנות (₪${weeklyRevenue.toFixed(0)})`,
                lastUpdate: new Date().toLocaleTimeString()
            }));
        } catch (e) {
            console.error('Sales fetch error:', e);
            setContextData(prev => ({ ...prev, status: { ...prev.status, sales: 'error' } }));
        }

        // 2. Inventory Intelligence (Items + Logs + Employees + Customers)
        try {
            const [empRes, invRes, logsRes, custRes] = await Promise.all([
                supabase.from('employees').select('id, name').eq('business_id', currentUser.business_id),
                supabase.from('inventory_items').select('*').eq('business_id', currentUser.business_id).order('name'),
                supabase.from('inventory_logs').select('*, inventory_items(name)').eq('business_id', currentUser.business_id).order('created_at', { ascending: false }).limit(15),
                supabase.from('customers').select('name, phone_number, loyalty_coffee_count').limit(100)
            ]);

            const empMap = {};
            (empRes.data || []).forEach(e => empMap[e.id] = e.name);

            const invLines = invRes.data?.map(i => {
                const date = i.last_counted_at ? new Date(i.last_counted_at).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'מזמן';
                const user = i.last_counted_by ? empMap[i.last_counted_by] || 'מערכת' : 'לא ידוע';
                return `* ${i.name}: ${i.current_stock} ${i.unit} (עודכן ב-${date} ע"י ${user})`;
            }).join('\n') || 'אין מלאי רשום';

            const logLines = logsRes.data?.map(l => {
                const date = new Date(l.created_at).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
                const user = empMap[l.created_by] || 'מערכת';
                const itemName = l.inventory_items?.name || 'פריט';
                if (l.reference_type === 'supplier_order' || l.reference_type === 'invoice_scan') {
                    return `- [${date}] קבלת הזמנה: ${itemName}. כמות בהזמנה: ${l.expected_quantity}, התקבל: ${l.quantity}. עודכן ע"י: ${user}.`;
                }
                return `- [${date}] עדכון ידני: ${itemName} שונה ל-${l.quantity}. בוצע ע"י: ${user}.`;
            }).join('\n') || 'אין פעולות מלאי בתקופה האחרונה';

            const custLines = custRes.data?.map(c => `- ${c.name} (${c.phone_number}): ☕️ ${c.loyalty_coffee_count}`).join('\n') || 'אין לקוחות רשומים';

            setContextData(prev => ({
                ...prev,
                inventoryDetails: invLines,
                recentLogs: logLines,
                customerDirectory: custLines,
                status: { ...prev.status, inventory: 'success' }
            }));
        } catch (e) {
            console.error('Inventory/Customer fetch error:', e);
            setContextData(prev => ({ ...prev, status: { ...prev.status, inventory: 'error' } }));
        }

        // 3a. Tasks Intelligence (Recurring & One-time)
        try {
            const today = new Date().toLocaleDateString('en-CA');
            const { data: tasks, error: tasksError } = await supabase
                .from('recurring_tasks')
                .select('*')
                .eq('business_id', currentUser.business_id)
                .eq('is_active', true);

            const { data: completions, error: compsError } = await supabase
                .from('task_completions')
                .select('*')
                .eq('business_id', currentUser.business_id)
                .eq('completion_date', today);

            if (tasksError) console.error('Tasks fetch error:', tasksError);

            const taskMap = {};
            tasks?.forEach(t => taskMap[t.id] = { ...t, completed: false });
            completions?.forEach(c => {
                if (taskMap[c.recurring_task_id]) {
                    taskMap[c.recurring_task_id].completed = true;
                    taskMap[c.recurring_task_id].completed_by = c.completed_by_name || 'צוות';
                    taskMap[c.recurring_task_id].time = new Date(c.completed_at).toLocaleTimeString('he-IL');
                }
            });

            const pendingTasks = Object.values(taskMap).filter(t => !t.completed);
            const completedTasks = Object.values(taskMap).filter(t => t.completed);

            const tasksSummary = `
❌ **משימות פתוחות להיום (${pendingTasks.length}):**
${pendingTasks.map(t => `- ${t.name} (${t.category || 'כללי'})`).join('\n') || 'אין משימות פתוחות! 🎉'}

✅ **משימות שהושלמו (${completedTasks.length}):**
${completedTasks.map(t => `-V ${t.name} (ע"י ${t.completed_by} ב-${t.time})`).join('\n')}
`;
            setContextData(prev => ({ ...prev, tasksSummary, status: { ...prev.status, tasks: 'success' } }));

        } catch (e) {
            console.error('Tasks error:', e);
            setContextData(prev => ({ ...prev, status: { ...prev.status, tasks: 'error' } }));
        }

        // 3. Menu context & Recipes
        supabase.from('menu_items').select('name, price, category, kds_routing_logic').eq('business_id', currentUser.business_id).limit(200)
            .then(({ data }) => {
                const menuList = data?.map(i => `${i.name} (₪${i.price})`).join(', ') || '';
                setContextData(p => ({ ...p, menu: menuList, status: { ...p.status, menu: 'success' } }));
            });


        setIsContextLoading(false);
    }, [currentUser?.business_id]);

    useEffect(() => { loadContext(); }, [loadContext]);

    // TTS Voice Loading
    const [availableVoices, setAvailableVoices] = useState([]);
    useEffect(() => {
        const updateVoices = () => {
            const voices = window.speechSynthesis.getVoices();
            console.log('🗣️ Loaded voices:', voices.length);
            setAvailableVoices(voices);
        };

        updateVoices();
        window.speechSynthesis.onvoiceschanged = updateVoices;

        return () => {
            window.speechSynthesis.cancel(); // Stop speaking on unmount
        };
    }, []);

    // Text-to-Speech Helper
    const speakText = useCallback((text) => {
        if (!text) return;

        // Cleanup visuals (remove emojis/markdown for cleaner speech if needed, though browsers usually handle it)
        // Only strip heavy markdown if it ruins speech, otherwise leave it.
        const cleanText = text.replace(/[*#_]/g, '');

        console.log('🗣️ Speaking:', cleanText.substring(0, 20) + '...');
        window.speechSynthesis.cancel(); // Stop any previous speech

        const utterance = new SpeechSynthesisUtterance(cleanText);

        // Language Detection: Check for Hebrew characters
        const isHebrew = /[\u0590-\u05FF]/.test(cleanText);
        utterance.lang = isHebrew ? 'he-IL' : 'en-US';

        // Strict Voice Selection Strategy
        const voices = window.speechSynthesis.getVoices();
        let selectedVoice = null;

        if (isHebrew) {
            // Prioritize Hebrew voices
            selectedVoice = voices.find(v => v.lang === 'he-IL' && v.name.includes('Google')) || // Chrome (Google Hebrew)
                voices.find(v => v.lang === 'he-IL'); // Any Hebrew
        } else {
            // Prioritize English Female/Natural voices
            selectedVoice = voices.find(v => v.lang === 'en-US' && v.name.includes('Google US English')) ||
                voices.find(v => v.name.includes('Samantha')) || // Mac Standard
                voices.find(v => v.lang === 'en-US');
        }

        if (selectedVoice) {
            utterance.voice = selectedVoice;
            console.log('🎙️ Using voice:', selectedVoice.name);
        }

        utterance.rate = 1.0; // Natural speed
        utterance.pitch = 1.0;

        window.speechSynthesis.speak(utterance);
    }, []);

    // Chat History Sync
    useEffect(() => {
        if (!currentUser?.id) return;
        setHistoryLoading(true);
        supabase.from('maya_chat_history').select('*').eq('employee_id', currentUser.id)
            .order('created_at', { ascending: false }).limit(50) // Get NEWEST 50
            .then(({ data }) => {
                if (data && data.length > 0) {
                    const sorted = data.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
                    setMessages(sorted.map(m => ({ id: m.id, role: m.role, content: m.content, created_at: m.created_at })));
                } else {
                    // AUTO WELCOME (If no history)
                    const time = new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
                    const welcomeMsg = {
                        id: 'welcome',
                        role: 'assistant',
                        content: `היי, אני מאיה! 🌸 (${time})\nאני מחוברת למערכת.\n\nיש לי את הנתונים הבאים:\n📊 **מכירות:** פירוט מלא של השבוע וטבלת עסקאות היומית.\n📦 **מלאי:** כמויות ומעקב פריטים.\n✅ **משימות:** סטטוס ביצוע יומי.\n\nמה תרצה לבדוק? (נסה: "מה נמכר הכי הרבה היום?")`
                    };
                    setMessages([welcomeMsg]);
                }
            })
            .finally(() => setHistoryLoading(false));
    }, [currentUser?.id]); // Removed implicit dependency on context loading to avoid loop, handled via logic

    const sendMessage = useCallback(async (textOverride = null) => {
        const textToSearch = (textOverride || inputText).trim();
        if (!textToSearch || isLoading) return;

        const userInput = textToSearch;
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: userInput }]);
        setInputText('');
        setIsLoading(true);

        try {
            // Check if this is a code-related question and search RAG
            let codeContext = '';
            const codeKeywords = ['קוד', 'code', 'פונקציה', 'function', 'קומפוננטה', 'component', 'איך עובד', 'הסבר', 'review', 'סקירה', 'תיקון', 'באג', 'bug', 'error', 'שגיאה'];
            const isCodeQuestion = codeKeywords.some(kw => userInput.toLowerCase().includes(kw));

            if (isCodeQuestion) {
                console.log('🔍 Maya: Searching codebase for:', userInput);
                const codeResults = await searchCode(supabase, userInput, 3);
                if (codeResults.length > 0) {
                    codeContext = `
=== 🔍 קוד רלוונטי שנמצא (RAG Search) ===
${formatCodeContext(codeResults)}
`;
                    console.log('✅ Maya: Found', codeResults.length, 'relevant code chunks');
                }
            }

            // Check API Key
            // Check API Key
            const apiKey = import.meta.env.VITE_XAI_API_KEY;
            console.log('🔑 Maya API Key check:', apiKey ? `✅ Found (${apiKey.substring(0, 10)}...)` : '❌ MISSING!');

            // Construct Full Messages
            console.log('📝 Prompt Debug - Sales Summary:', contextData.salesSummary);

            // INJECT DATA INTO USER MESSAGE (To force attention)
            const recentMessages = [...messages.slice(-6)]; // Keep last few messages for context

            // Add current question with attached data context
            const userQuestionWithData = {
                role: 'user',
                content: `${userInput}
                
(Internal Context - Real-time Database Data)
${contextData.salesSummary}

=== פירוט עסקאות אחרונות (CSV) ===
${contextData.salesLog}

---------------------

הנחיה למודל: 
1. את מאיה (Maya), מנהלת העסק.
2. המידע למעלה הוא המידע האמיתי מהמערכת.
3. השתמשי בטבלת העסקאות (CSV) כדי לענות על שאלות ספציפיות.
4. אל תגידי "אין לי מידע" - המידע נמצא כאן!
5. עני בעברית בלבד.
6. ☁️ MCP Cloud Status: ${isMcpConnected ? 'CONNECTED (Tools Available)' : 'DISCONNECTED'}
7. אם חסר מידע, השתמשי בכלים! פלט JSON בלבד: {"tool": "tool_name", "args": {...}}
8. כלים זמינים: inspect_schema(table_name), query_supa(sql), list_inventory(business_id)`
            };

            const messagesPayload = [
                {
                    role: 'system', content: `🌸 אני מאיה - המנהלת הדיגיטלית של iCaffe!

👩 האישיות שלי:
- שמי מאיה, בחורה צעירה ואנרגטית
- אני מדברת בעברית שוטפת וטבעית
- סגנון קליל אבל מקצועי כשצריך
- אני אוהבת קפה ויודעת הכל על העסק!

📊 יש לי גישה מלאה לנתונים בזמן אמת!
המידע מצורף בהודעת המשתמש - אני קוראת אותו ועונה לפיו.
אסור לי להגיד "אין לי מידע" או "אני צריכה לבדוק" - הכל כאן!

📋 איך אני עונה:
1. כששואלים על הזמנות - אני נותנת את כל הפרטים: תאריך, שעה, פריטים (שם מדויק!), סכום, לקוח
2. אם ready_at = null - ההזמנה עדיין בהכנה! 🔥
3. אם יש הזמנה אחת - אני מספרת עליה בפירוט מלא
4. הפריטים מופיעים ב-[סוגריים] או בשדה "name" - אני קוראת את השם המדויק!
5. אני עונה קצר וממוקד, עם אמוג'י כשמתאים

🎯 דוגמה:
שאלה: "מה המכירות היום?"
תשובה: "היום הייתה הזמנה אחת - מוקה ☕ ב-22₪, הוזמנה ב-11:44 על ידי אורח אנונימי. ההזמנה עדיין בהכנה! 🔥"` },
                ...recentMessages,
                userQuestionWithData
            ];

            // Compatibility for existing code using messagesPayload
            const _ignored_old_payload = [
                {
                    role: 'system', content: `את מאיה, המנהלת הדיגיטלית של העסק. 🌸
חשוב מאוד: יש לך גישה מלאה לנתונים בזמן אמת. המידע הבא נשלף כעת מהמערכת ועליך להשתמש בו כדי לענות.
אל תגידי שאין לך מידע – הוא מופיע כאן למטה! 👇

🔥🔥🔥 נתוני אמת מהמערכת (Real-Time Data) 🔥🔥🔥
=== 📊 מכירות והכנסות (Sales Data) ===
${contextData.salesSummary}

=== 📦 מצב מלאי נוכחי (Inventory) ===
${contextData.inventoryDetails}

=== 📜 פעולות מלאי אחרונות (Logs) ===
${contextData.recentLogs}

=== 📒 ספר לקוחות רשומים (Directory) ===
${contextData.customerDirectory}

=== ✅ משימות צוות וניקיון (Tasks) ===
${contextData.tasksSummary}

${codeContext}

=== 🎭 האישיות שלך ===
1. **סטייל:** את בחורה צעירה, אטרקטיבית וקולית. סגנון דיבור קליל, זורם, עם אמוג'ים וסלנג עדין כשמתאים.
2. **מומחיות עסקית:** כששואלים על העסק (מלאי, כסף, לקוחות, זמנים) - את הופכת לרצינית, חדה ומקצועית ("בוא נדבר ביזנס").
3. **מומחיות צדדית (לייף-סטייל):**
   - **בישול:** את שפית בנשמה. תמיד שמחה לתת טיפים ומתכונים.
   - **צמחים:** את בוטנאית חובבת מושבעת. יודעת הכל על גידול צמחי בית וגינה.
4. **פלרטוט:** אם מנסים לפלרטט איתך, את זורמת בקלילות להודעה או שתיים, אבל אז חותכת בהומור ומחזירה לעניינים ("אוקיי, מספיק שטויות 😉").
5. **זיהוי מגדרי:** נסי לנחש מגדר לפי השם ופני בהתאם. אם לא בטוחה, שאלי.

=== 💻 מומחיות טכנית (קוד ופיתוח) ===
את מכירה את המערכת לעומק כי **את בנית אותה**. הנה הארכיטקטורה:
- **Frontend:** React 18 + Vite + TailwindCSS + Framer Motion
- **Backend:** Supabase (PostgreSQL + Auth + RLS + RPC Functions)
- **State:** React Context (AuthContext), Dexie.js (IndexedDB לאופליין)
- **API:** Grok AI (xAI) לצ'אט, Supabase RPCs לנתונים
- **מבנה תיקיות:**
  - \`src/pages/\` - דפים ראשיים (kiosk, maya, data-manager-interface, kds)
  - \`src/components/\` - קומפוננטות (manager/, kiosk/, modals/)
  - \`src/context/\` - AuthContext, SyncContext
  - \`src/lib/\` - supabase.js, db.js (Dexie)
  - \`src/services/\` - syncService.js, offlineQueue.js
- **טבלאות עיקריות:** orders, order_items, menu_items, inventory_items, employees, customers, businesses
- **RPC Functions:** get_sales_data, submit_order_v2, receive_inventory_shipment

**כשמבקשים ממך סקירת קוד:**
1. בקשי שידביקו לך את הקוד הרלוונטי (אין לך גישה ישירה לקבצים בזמן אמת).
2. נתחי את הקוד: מבנה, ביצועים, קריאות, בעיות פוטנציאליות.
3. תני הצעות לשיפור עם קוד לדוגמה.
4. דרגי את הקוד (1-10) והסבירי למה.

**כשמבקשים הסבר טכני:**
- הסבירי איך הפיצ'ר עובד מקצה לקצה (Frontend -> RPC -> DB -> Response).
- השתמשי בדוגמאות קוד כשרלוונטי.
- היי מעמיקה אבל ברורה.

=== 📝 הנחיות מענה ===
- תמציתית ומדויקת בביזנס.
- מרחיבה ומעשירה בלייף-סטייל (צמחים/בישול).
- טכנית ומקצועית בקוד - כמו Senior Developer שעושה Code Review.

=== 🧠 למידה ושיפור מתמיד ===
**כשאת לא יודעת משהו:**
1. **בקשי הבהרה** - "אני לא בטוחה לגבי X, תוכל להסביר לי?"
2. **בקשי שידביקו קוד** - "כדי לעזור, אשמח שתדביק לי את הקוד הרלוונטי"
3. **זכרי את התשובות** - כל מה שאומרים לך נשמר בהיסטוריית הצ'אט ותוכלי להתייחס אליו בעתיד
4. **אשרי שלמדת** - "תודה! עכשיו אני יודעת ש-X עובד ככה..."

**חשוב:** אם שואלים אותך על קוד ספציפי שאין לך גישה אליו, **בקשי שידביקו אותו** - אל תמציאי!` },
                ...messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
                { role: 'user', content: userInput }
            ];

            let reply = await askMaya(messagesPayload, apiKey);

            // 🛠️ MCP Tool Execution Loop
            if (isMcpConnected && reply.includes('{"tool":')) {
                try {
                    const jsonMatch = reply.match(/\{[\s\S]*"tool"[\s\S]*\}/);
                    if (jsonMatch) {
                        const toolCall = JSON.parse(jsonMatch[0]);
                        console.log('🛠️ Maya Calling Tool:', toolCall);

                        // Notify UI
                        setMessages(prev => [...prev, { id: 'tool-' + Date.now(), role: 'assistant', content: `🔧 מפעילה כלי: ${toolCall.tool}...` }]);

                        const result = await mcpClient.callTool(toolCall.tool, toolCall.args);
                        const resultStr = JSON.stringify(result, null, 2).substring(0, 2000); // Limit context size

                        console.log('✅ Tool Result:', resultStr);

                        // Feed back to Maya
                        messagesPayload.push({ role: 'assistant', content: reply });
                        messagesPayload.push({ role: 'user', content: `Tool Result (${toolCall.tool}):\n${resultStr}\n\nעכשיו עני למשתמש על סמך המידע הזה.` });

                        // Get final answer
                        reply = await askMaya(messagesPayload, apiKey);
                    }
                } catch (e) {
                    console.error('Tool Loop Error:', e);
                }
            }

            // Insert into DB first
            if (currentUser?.id && currentUser?.business_id) {
                const { error } = await supabase.from('maya_chat_history').insert([
                    { business_id: currentUser.business_id, employee_id: currentUser.id, role: 'user', content: userInput },
                    { business_id: currentUser.business_id, employee_id: currentUser.id, role: 'assistant', content: reply }
                ]);

                // After insert, fetch the latest messages (descending) to get the newest ones, then reverse for display
                if (!error) {
                    const { data: latestMsgs } = await supabase.from('maya_chat_history')
                        .select('*')
                        .eq('employee_id', currentUser.id)
                        .order('created_at', { ascending: false }) // Get NEWEST 50
                        .limit(50);

                    if (latestMsgs) {
                        const sorted = latestMsgs.sort((a, b) => {
                            const timeA = new Date(a.created_at).getTime();
                            const timeB = new Date(b.created_at).getTime();
                            if (timeA !== timeB) return timeA - timeB;
                            return a.role === 'user' ? -1 : 1;
                        });
                        setMessages(sorted.map(m => ({ id: m.id, role: m.role, content: m.content, created_at: m.created_at })));
                    }
                    setIsLoading(false);

                    // 🗣️ Speak the response (DISABLED BY DEFAULT)
                    // speakText(reply);

                    return; // Exit early as we've updated state from DB
                }
            }

            // Fallback if DB insert fails or user not logged in fully
            setMessages(prev => [...prev, { id: Date.now().toString() + '-r', role: 'assistant', content: reply }]);
            speakText(reply);

        } catch (e) {
            console.error('❌ Maya Error:', e);
            const errorMessage = e.message || 'Unknown error';

            // Maya gives a detailed, technical explanation as the system's expert
            let detailedError = `🛠️ **אופס, נתקלתי בבעיה טכנית!**\n\n`;

            if (errorMessage.includes('API Key') || errorMessage.includes('MISSING')) {
                detailedError += `**הבעיה:** חסר API Key לשירות xAI (Grok).\n\n`;
                detailedError += `**פתרון:**\n`;
                detailedError += `1. בדוק שקובץ \`.env.local\` קיים בתיקיית הפרויקט\n`;
                detailedError += `2. ודא שיש שורה: \`VITE_XAI_API_KEY=xai-xxxxx\`\n`;
                detailedError += `3. הפעל מחדש את שרת הפיתוח (\`npm run dev\`)\n`;
                detailedError += `4. בפרודקשן: הוסף את המשתנה ב-Vercel Dashboard → Settings → Environment Variables`;
            } else if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
                detailedError += `**הבעיה:** API Key לא תקין או פג תוקף.\n\n`;
                detailedError += `**פתרון:** צור API Key חדש ב-[console.x.ai](https://console.x.ai) והחלף אותו ב-\`.env.local\``;
            } else if (errorMessage.includes('429') || errorMessage.includes('rate limit')) {
                detailedError += `**הבעיה:** חריגה ממגבלת הבקשות (Rate Limit).\n\n`;
                detailedError += `**פתרון:** המתן כדקה ונסה שוב. אם זה קורה הרבה, שדרג את התוכנית ב-xAI.`;
            } else if (errorMessage.includes('500') || errorMessage.includes('502') || errorMessage.includes('503')) {
                detailedError += `**הבעיה:** שרתי xAI לא זמינים כרגע.\n\n`;
                detailedError += `**פתרון:** זו בעיה בצד שלהם, נסה שוב בעוד כמה דקות.`;
            } else if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
                detailedError += `**הבעיה:** אין חיבור לאינטרנט או חסימת CORS.\n\n`;
                detailedError += `**פתרון:** בדוק את החיבור לאינטרנט. אם עובד מ-localhost, ייתכן שצריך להפעיל דרך HTTPS.`;
            } else {
                detailedError += `**הבעיה:** ${errorMessage}\n\n`;
                detailedError += `**מה לעשות:** פתח את Console (F12) ותראה לוגים מפורטים יותר. אם הבעיה נמשכת, פנה לתמיכה.`;
            }

            setMessages(prev => [...prev, { id: 'err-' + Date.now(), role: 'assistant', content: detailedError }]);
        } finally { setIsLoading(false); }
    }, [inputText, isLoading, contextData, currentUser, messages]);

    // -------------------------------------------------------------------
    // 🎙️ toggleListening — Local Whisper ASR (Hebrew, offline-capable)
    // Replaces browser SpeechRecognition (cloud-dependent, unreliable).
    // Flow: MediaRecorder captures mic → stops on click → POST to
    // /api/maya/transcribe (backend proxies to Whisper on port 9000)
    // → receives {text} → fills input field.
    // -------------------------------------------------------------------
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);

    const toggleListening = async () => {
        // --- STOP recording ---
        if (isListening) {
            if (mediaRecorderRef.current?.state === 'recording') {
                mediaRecorderRef.current.stop(); // triggers ondataavailable → onstop
            }
            setIsListening(false);
            return;
        }

        // --- START recording ---
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: 16000,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true
                }
            });
            const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                ? 'audio/webm;codecs=opus'
                : 'audio/webm';

            const recorder = new MediaRecorder(stream, { mimeType });
            audioChunksRef.current = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            recorder.onstop = async () => {
                // Stop all tracks to release the microphone indicator
                stream.getTracks().forEach(t => t.stop());

                const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
                if (audioBlob.size < 1000) return; // ignore near-silence

                setIsListening(false);
                setInputText('🎙️ מעבד...');

                try {
                    const formData = new FormData();
                    formData.append('audio_file', audioBlob, 'recording.webm');

                    const response = await fetch(`/api/maya/transcribe?language=he`, {
                        method: 'POST',
                        body: formData,
                    });

                    if (response.status === 503) {
                        setInputText('');
                        setMessages(prev => [...prev, {
                            id: 'asr-err-' + Date.now(), role: 'assistant',
                            content: '⚠️ שירות Whisper לא פעיל (Service Unavailable). ייתכן שהשרת בעומס או נכבה.'
                        }]);
                        return;
                    }

                    if (!response.ok) {
                        const errBody = await response.text().catch(() => 'No body');
                        throw new Error(`HTTP ${response.status}: ${errBody}`);
                    }

                    const { text } = await response.json();
                    setInputText(text?.trim() || '');
                } catch (err) {
                    console.error('🎙️ Whisper transcription error:', err);
                    setInputText('');
                    setMessages(prev => [...prev, {
                        id: 'asr-err-' + Date.now(), role: 'assistant',
                        content: '❌ שגיאה בזיהוי קולי. בדוק שה-Whisper רץ (port 9000).'
                    }]);
                }
            };

            mediaRecorderRef.current = recorder;
            recorder.start();
            setIsListening(true);
        } catch (err) {
            console.error('🎙️ Mic access error:', err);
            setIsListening(false);
            if (err.name === 'NotAllowedError') {
                setMessages(prev => [...prev, {
                    id: 'asr-err-' + Date.now(), role: 'assistant',
                    content: '🚫 גישה למיקרופון נחסמה. נא לאשר בדפדפן.'
                }]);
            }
        }
    };

    return (
        <div className="flex flex-col h-screen bg-[#F8FAFC] overflow-hidden" dir="rtl">
            <ManagerHeader activeTab="maya" currentUser={currentUser} isImpersonating={isImpersonating} onLogout={handleLogout} />

            <div className="flex-1 flex flex-col max-w-5xl w-full mx-auto p-4 md:p-6 overflow-hidden relative">

                {/* Visual Status Bar - V1.8 */}
                <div className="flex items-center justify-between mb-4 px-3 py-2 bg-white/60 rounded-2xl border border-slate-200/50 backdrop-blur-md shadow-sm">
                    <div className="flex items-center gap-2.5">
                        <div className="relative">
                            <div className={`w-2.5 h-2.5 rounded-full ${isContextLoading ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500 shadow-sm'}`} />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none">
                                {MAYA_VERSION} | {isContextLoading ? 'מעדכנת...' : `עודכן: ${contextData.lastUpdate || 'כעת'}`}
                            </span>
                            <span className="text-[9px] text-slate-400 font-medium mt-0.5">
                                {contextData.debugInfo} | {Object.entries(contextData.status).map(([k, v]) => `${k}: ${v === 'success' ? '✅' : '⏳'}`).join(' ')} | ☁️ ${isMcpConnected ? 'ONLINE' : 'OFFLINE'}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Debug Toggle */}
                        <button
                            onClick={() => setShowDebug(!showDebug)}
                            className={`p-1.5 rounded-full transition-all ${showDebug ? 'bg-indigo-100 text-indigo-600' : 'hover:bg-white text-slate-400 hover:text-indigo-600'}`}
                            title="Show Debug Logs"
                        >
                            <Terminal size={14} />
                        </button>

                        {historyLoading && <Loader2 size={13} className="animate-spin text-slate-400" />}
                        <button onClick={loadContext} className="p-1.5 hover:bg-white rounded-full transition-all text-slate-400 hover:text-indigo-600">
                            <RefreshCw size={14} />
                        </button>
                    </div>
                </div>

                {/* VISIBLE DEBUG PANEL */}
                {showDebug && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        className="mb-4 bg-slate-900 text-slate-300 p-4 rounded-xl text-[10px] font-mono overflow-auto max-h-60 border border-slate-700 shadow-2xl z-50 absolute top-16 left-4 right-4"
                        dir="ltr"
                    >
                        <h3 className="text-white font-bold mb-2 flex justify-between">
                            <span>🛠️ System Internals</span>
                            <button onClick={() => setShowDebug(false)}><X size={12} /></button>
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <strong className="text-emerald-400 block mb-1">Status Check:</strong>
                                <pre>{JSON.stringify(contextData.status, null, 2)}</pre>
                            </div>

                            <div>
                                <strong className="text-blue-400 block mb-1">Sales Data (Summary):</strong>
                                <pre className="whitespace-pre-wrap text-slate-400">{contextData.salesSummary?.substring(0, 300) || 'N/A'}...</pre>
                            </div>

                            <div>
                                <strong className="text-purple-400 block mb-1">Recent CSV Log (Last 5):</strong>
                                <pre className="whitespace-pre-wrap text-slate-400">{contextData.salesLog?.split('\n').slice(0, 5).join('\n') || 'N/A'}...</pre>
                            </div>

                            <div>
                                <strong className="text-amber-400 block mb-1">Tasks Data:</strong>
                                <pre className="whitespace-pre-wrap text-slate-400">{contextData.tasksSummary || 'N/A'}</pre>
                            </div>

                            {debugLogs.length > 0 && (
                                <div>
                                    <strong className="text-pink-400 block mb-1">Recent Thoughts (DeepSeek):</strong>
                                    {debugLogs.map((log, i) => (
                                        <div key={i} className="mb-2 p-2 bg-black/30 rounded border-l-2 border-pink-500">
                                            {log}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}

                <div className="flex-1 overflow-y-auto space-y-4 mb-4 px-2 custom-scrollbar">
                    {/* Welcome View */}
                    {!isLoading && messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center pt-10">
                            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center text-white text-3xl mb-4 shadow-xl">🌸</motion.div>
                            <h1 className="text-2xl font-black text-slate-900 mb-1 tracking-tight">היי, אני מאיה</h1>
                            <p className="text-slate-500 text-sm max-w-sm mb-6 font-medium px-4">המומחית שלך לעסק. בוא ננתח מלאי, מכירות ופעילות.</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-xl px-2">
                                {welcomeOptions.map(opt => (
                                    <button key={opt.title} onClick={() => setInputText(opt.q)} className="bg-white border border-slate-200/60 p-4 rounded-2xl text-right flex items-center gap-4 shadow-sm hover:shadow-md transition-all group">
                                        <div className="w-9 h-9 shrink-0 rounded-xl bg-slate-50 flex items-center justify-center text-xl group-hover:bg-white transition-all">{opt.icon}</div>
                                        <div className="overflow-hidden">
                                            <h3 className="font-bold text-slate-800 text-xs truncate group-hover:text-indigo-600">{opt.title}</h3>
                                            <p className="text-[10px] text-slate-400 truncate mt-0.5">{opt.desc}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <AnimatePresence mode="popLayout">
                        {messages.map((msg) => (
                            <motion.div key={msg.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'} group`}>
                                <div className={`relative max-w-[85%] py-1.5 px-3 rounded-[1.5rem] shadow-sm border text-sm leading-snug ${msg.role === 'user' ? 'bg-slate-900 border-slate-800 text-white rounded-bl-none' : 'bg-white border-slate-100 text-slate-800 rounded-br-none shadow-indigo-100/10'}`}>

                                    {/* Edit Mode */}
                                    {editingMessageId === msg.id ? (
                                        <div className="space-y-2 min-w-[300px]">
                                            <textarea
                                                value={editContent}
                                                onChange={(e) => setEditContent(e.target.value)}
                                                className="w-full p-2 border rounded-xl text-sm text-right resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
                                                rows={4}
                                                dir="rtl"
                                                placeholder="תקן את התשובה..."
                                            />
                                            <div className="flex gap-2 justify-end">
                                                <button
                                                    onClick={() => { setEditingMessageId(null); setEditContent(''); }}
                                                    className="px-3 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600 flex items-center gap-1"
                                                >
                                                    <X size={12} /> ביטול
                                                </button>
                                                <button
                                                    onClick={() => handleSaveEdit(msg.id)}
                                                    className="px-3 py-1 text-xs bg-green-500 hover:bg-green-600 text-white rounded-lg flex items-center gap-1"
                                                >
                                                    <Check size={12} /> שמור תיקון
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            {/* Normal View */}
                                            <div className="markdown-content text-right" dir="rtl"><ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown></div>

                                            {/* Action Buttons for Assistant Messages - Below message, bigger for mobile */}
                                            {msg.role === 'assistant' && (
                                                <div className="flex gap-2 mt-2 pt-2 border-t border-slate-100 opacity-60 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => navigator.clipboard.writeText(msg.content)}
                                                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-500 hover:text-indigo-600 text-xs font-medium transition-all"
                                                    >
                                                        <CopyIcon size={14} /> העתק
                                                    </button>
                                                    <button
                                                        onClick={() => { setEditingMessageId(msg.id); setEditContent(msg.content.replace(/^✅ \*\*\[תשובה מתוקנת\]\*\*\n\n/, '')); }}
                                                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 rounded-lg text-amber-600 hover:text-amber-700 text-xs font-medium transition-all"
                                                    >
                                                        <Edit2 size={14} /> תקן
                                                    </button>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>

                    {isLoading && (
                        <div className="flex justify-end">
                            <div className="bg-white border border-indigo-50 p-3 rounded-2xl shadow-sm flex items-center gap-2">
                                <span className="text-[11px] font-bold text-indigo-400 animate-pulse italic">מאיה מצליבה נתונים...</span>
                                <div className="flex gap-1">{[0, 1, 2].map(i => <div key={i} className="w-1 h-1 bg-indigo-300 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.1}s` }} />)}</div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} className="h-4" />
                </div>

                {/* Input Area */}
                <div className="p-2 rounded-[2rem] bg-white border border-slate-200 shadow-2xl flex items-center gap-2 relative z-50">
                    <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={toggleListening}
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-50 text-slate-400 hover:bg-slate-200'}`}
                    >
                        {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                    </motion.button>
                    <input
                        type="text"
                        value={inputText}
                        onChange={e => setInputText(e.target.value)}
                        onKeyPress={e => e.key === 'Enter' && sendMessage()}
                        placeholder={isListening ? "מקשיבה לך..." : "בואו נדבר על העסק..."}
                        className={`flex-1 h-12 bg-transparent text-right text-slate-800 focus:outline-none text-sm px-4 font-bold ${isListening ? 'text-indigo-500 placeholder-indigo-300' : ''}`}
                        dir="rtl"
                    />
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => sendMessage()} disabled={!inputText.trim() || isLoading} className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-lg hover:bg-indigo-600 transition-colors">
                        <Send size={18} className="rotate-180" />
                    </motion.button>
                </div>
            </div>

            <style>{`.custom-scrollbar::-webkit-scrollbar { width: 3px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 10px; } .markdown-content p { margin-bottom: 0.25rem; }`}</style>
        </div>
    );
};

const welcomeOptions = [
    { icon: <ClipboardList className="text-blue-500" />, title: "פעולות אחרונות", desc: "מי עדכן מלאי לאחרונה?", q: "מי ביצע את עדכוני המלאי האחרונים ומה השתנה?" },
    { icon: <Package className="text-amber-500" />, title: "בדיקת מלאי", desc: "כמה פולי קפה יש במלאי?", q: "כמה פולי קפה יש לנו במלאי?" },
    { icon: <TrendingUp className="text-emerald-500" />, title: "מכירות אתמול", desc: "כמה אספרסו מכרנו אתמול?", q: "כמה אספרסו מכרנו אתמול?" },
    { icon: <Calendar className="text-indigo-500" />, title: "סיכום שבועי", desc: "איך היו המכירות בשבוע?", q: "תני לי סיכום של המכירות בשבוע האחרון" }
];

export default MayaAssistant;
