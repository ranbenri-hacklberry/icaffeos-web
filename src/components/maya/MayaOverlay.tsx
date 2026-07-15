// @ts-nocheck
/**
 * Maia Chat Overlay - Team Member Interface
 * With Quick Actions for Post Creation
 */
import React, { useState, useRef, useEffect, useCallback, useContext } from 'react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import {
    Sparkles, X, Minimize2, Maximize2, Send,
    Loader2, Bot, User, GripVertical, Zap,
    Instagram, MessageSquare, AlertTriangle,
    Plus, Image as ImageIcon, Square, RectangleVertical,
    RefreshCw, Settings, LogOut, MousePointer2,
    Cpu, ChevronDown, Mic, MicOff
} from 'lucide-react';
import ClockInModalInline from './ClockInModalInline';
import UserSettingsModal from './UserSettingsModal';
import TeamMessageModal from './TeamMessageModal';
import { useAbraHat, useMagicSDK } from '../../context/AbraHatContext';
import { AbraManifesto } from '../../types/AbraTypes';

// Safe location hook - returns fallback if outside Router
const useSafeLocation = () => {
    try {
        // Dynamic import to avoid errors outside Router
        const { useLocation } = require('react-router-dom');
        return useLocation();
    } catch {
        return { pathname: '/manager' }; // Default to showing Maya
    }
};

// Import context directly (not the hook) - this won't throw when outside provider
import AuthContext from '../../context/AuthContextCore';
import { supabase } from '../../lib/supabase';
import maiaLogo from '../../assets/maia-logo.png';
import PostCreator from '../marketing/PostCreator';

// Safe auth hook - returns null safely if outside AuthProvider
const useSafeAuth = () => {
    const ctx = useContext(AuthContext);
    // ctx will be null if outside provider (that's fine, we have fallbacks)
    return ctx || { businessId: null, currentUser: null };
};

// TypeScript Interfaces
interface Employee {
    id: string;
    name: string;
    accessLevel: string;
    isSuperAdmin: boolean;
    businessId: string;
}

interface MayaOverlayProps {
    employee?: Employee | null;
    canViewFinancialData?: boolean;
    sessionId?: string;
    onLogout?: () => void;
    needsClockIn?: boolean;           // 🆕 NEW
    isClockedIn?: boolean;             // 🆕 NEW
    onClockInComplete?: (role: string, eventId: string) => void; // 🆕 NEW
}

interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    isAutomation?: boolean;
    actions?: MessageAction[];
}

interface MessageAction {
    type: 'story' | 'sms' | 'alert';
    label: string;
    data: any;
    pending?: boolean;
    completed?: boolean;
}

interface AutomationLog {
    id: string;
    action: string;
    target: string;
    details: any;
    created_at: string;
}

// Routes where Maya should be visible
const ALLOWED_ROUTES = {
    // Manager screens (for all users)
    manager: ['/', '/kds', '/manager', '/orders', '/kitchen', '/shift', '/staff', '/menu-ordering-interface'],
    // Owner/Admin screens
    owner: ['/data', '/super-admin', '/owner-settings', '/analytics', '/marketing']
};

export const MayaOverlay: React.FC<MayaOverlayProps> = ({
    employee = null,
    canViewFinancialData = false,
    sessionId = null,
    onLogout = null,
    needsClockIn = false,           // 🆕 NEW
    isClockedIn = false,             // 🆕 NEW
    onClockInComplete = null         // 🆕 NEW
}) => {
    const auth = useSafeAuth(); // Safely get auth - won't crash outside AuthProvider
    const location = useSafeLocation(); // Safely get location - won't crash outside Router

    // DISABLED MAYA AT USER REQUEST
    return null;

    // Use passed employee OR fallback to current auth user
    const activeEmployee = employee || auth.currentUser;

    // iCaffe business ID (UUID format)
    const businessId = activeEmployee?.business_id || activeEmployee?.businessId || auth?.businessId || '22222222-2222-2222-2222-222222222222';
    const userRole = activeEmployee?.access_level || activeEmployee?.accessLevel || 'staff';
    const isSuperAdmin = activeEmployee?.is_super_admin || activeEmployee?.isSuperAdmin || false;
    const isOwner = isSuperAdmin || userRole === 'owner' || userRole === 'admin' || userRole === 'Admin' || userRole === 'Owner' || userRole === 'Manager' || userRole === 'manager';

    // Abrakadabra Access Level (V-003: Level 8+)
    const accessLevelNum = typeof userRole === 'number' ? userRole : (
        isSuperAdmin ? 10 : (
            ['Owner', 'owner', 'Admin', 'admin', 'Software Architect'].includes(userRole) ? 9 : (
                ['manager', 'Manager'].includes(userRole) ? 8 : 2
            )
        )
    );
    const hasMagicalAccess = accessLevelNum >= 8;

    // Check if Maya should be visible on current route
    const shouldShow = useCallback(() => {
        const path = location.pathname;

        // Explicitly hide on auth screens
        if (path === '/login' || path === '/mode-selection' || path.startsWith('/login')) {
            return false;
        }

        // Manager routes - always visible
        if (ALLOWED_ROUTES.manager.some(route => route === '/' ? path === '/' : path.startsWith(route))) {
            return true;
        }

        // Owner routes - only for owners/admins
        if (isOwner && ALLOWED_ROUTES.owner.some(route => route === '/' ? path === '/' : path.startsWith(route))) {
            return true;
        }

        return false;
    }, [location.pathname, isOwner]);

    // UI State
    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [position] = useState({ x: 20, y: 20 });
    const [unreadCount, setUnreadCount] = useState(0);

    // Post Creator State
    const [showPostCreator, setShowPostCreator] = useState(false);
    const [activeQuickAction, setActiveQuickAction] = useState<string | null>(null);

    // User Settings State
    const [showSettings, setShowSettings] = useState(false);
    const [showTeamMessage, setShowTeamMessage] = useState(false);
    const [showModelSelector, setShowModelSelector] = useState(false);

    // Chat State
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);

    // Provider State
    const [activeTab, setActiveTab] = useState<'local' | 'api'>('local');
    const [availableProviders, setAvailableProviders] = useState<string[]>(['local']);
    const [provider, setProvider] = useState<'local' | 'google' | 'anthropic' | 'xai'>('local');
    const [model, setModel] = useState('dictalm-hebrew:latest');
    const [localAvailable, setLocalAvailable] = useState(false);
    const [lastUsage, setLastUsage] = useState<any>(null); // For token tracking

    // Fetch available providers - Manual control only, no auto-switch to API!
    useEffect(() => {
        if (!businessId) return;
        const fetchKeys = async () => {
            try {
                const response = await fetch(`${API_URL}/maya/providers?businessId=${businessId}`);
                if (!response.ok) throw new Error('Backend providers fetch failed');

                const providers = await response.json();
                setAvailableProviders(providers || ['local']);
            } catch (err) {
                // Silently fallback to enabling basic providers
                setAvailableProviders(['local', 'google', 'anthropic', 'xai']);
            }
        };
        fetchKeys();
    }, [businessId]);

    // 🎙️ Voice Transcription State
    const [isListening, setIsListening] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    // 🤖 AI Models Configuration (Updated Feb 2026)
    const AI_MODELS = {
        'google': [
            { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (Fast)' },
            { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (Best)' },
            { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash' }
        ],
        'anthropic': [
            { id: 'claude-3-5-sonnet-latest', name: 'Claude 3.5 Sonnet' },
            { id: 'claude-3-5-haiku-latest', name: 'Claude 3.5 Haiku' }
        ],
        'xai': [
            { id: 'grok-beta', name: 'Grok Beta' }
        ],
        'local': [
            { id: 'dictalm-hebrew:latest', name: 'DictaLM 3.0 (1.7B)' },
            { id: 'maya:latest', name: 'Maya Custom (2.0GB)' },
            { id: 'llama3.2:latest', name: 'Llama 3.2 (3B)' }
        ]
    };

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const dragControls = useDragControls();

    // Abrakadabra Integration
    const { wearHat, toggleInspector, inspectorActive } = useAbraHat();
    const sdk = useMagicSDK();
    const [castingSpell, setCastingSpell] = useState(false);

    const castSpell = async () => {
        if (!input.trim() || castingSpell) return;
        setCastingSpell(true);
        setLoading(true);

        try {
            console.log('🧠 DicTAlm 1.7B (Ollama): Capturing Hebrew Intent...');

            // 1. Local Intent Capture via DicTAlm
            const intentResponse = await fetch('/api/maya/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [
                        { role: 'system', content: 'You are DicTAlm 1.7B. Output ONLY a valid JSON AbraIntent object for the Hebrew request.' },
                        { role: 'user', content: input }
                    ],
                    businessId,
                    provider: 'local',
                    model: 'dictalm-hebrew'
                })
            });

            const intentData = await intentResponse.json();
            // Simulate/Parse structured intent
            const abraIntent = {
                intent_type: 'UI_MODIFICATION',
                primary_component_id: input.includes('POS') ? 'pos-checkout-biometric' : 'pages-kds-components-ordercard',
                hebrew_description: input,
                english_summary: 'Evolution triggered via Maya Host (DicTAlm)',
                affected_entities: ['orders'],
                risk_assessment: 'medium',
                correlation_id: `abra-${Date.now()}`
            };

            console.log('👨‍🍳 Prep Kitchen (Claude): Routing intent to prep sandbox...');

            // 2. Claude Prep Routing
            const componentContext = {
                file_path: abraIntent.primary_component_id === 'pos-checkout-biometric'
                    ? 'src/components/pos/POSCheckoutWithBiometric.tsx'
                    : 'src/pages/kds/components/OrderCard.jsx',
                current_behavior: 'Standard behavior before spell casting.',
            };

            const prepResponse = await fetch('/api/abrakadabra/prep', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    intent: abraIntent,
                    componentContext,
                    caster: {
                        employee_id: activeEmployee?.id || 'unknown',
                        role: userRole,
                        business_id: businessId
                    }
                })
            });

            const { manifesto } = await prepResponse.json();

            // 3. Sandbox Deployment
            console.log('⚡ Triggering wearHat (Sandbox Initialization)...');
            wearHat(manifesto);

            const assistantMessage: Message = {
                id: `maia-spell-${Date.now()}`,
                role: 'assistant',
                content: `✨ ניתחתי את הבקשה שלך באמצעות DicTAlm והכנתי את השינוי ב-"Prep Kitchen" (Claude). 
                המניפסט מוכן: **${manifesto.incantation}**. 
                נכנסנו למצב סנדבוקס באופן אוטומטי! בדוק את ה-Drawer בצד הימני.`,
                timestamp: new Date(),
                actions: [
                    {
                        type: 'alert',
                        label: '🔍 הצג שינויים',
                        data: { manifesto }
                    }
                ]
            };

            setMessages(prev => [...prev, assistantMessage]);
            setInput('');
        } catch (err) {
            console.error('Prep Bridge Error:', err);
            setMessages(prev => [...prev, {
                id: `error-${Date.now()}`,
                role: 'assistant',
                content: 'הגשר למטבח ההכנות נקטע... אולי אחת מהבינות מלאכותיות עסוקה? 😅',
                timestamp: new Date()
            }]);
        } finally {
            setCastingSpell(false);
            setLoading(false);
        }
    };

    // 🎙️ Whisper Voice Logic
    const toggleListening = async () => {
        if (isListening) {
            if (mediaRecorderRef.current?.state === 'recording') {
                mediaRecorderRef.current.stop();
            }
            setIsListening(false);
            return;
        }

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
                stream.getTracks().forEach(t => t.stop());
                const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });

                if (audioBlob.size < 1000) return; // ignore silence

                setIsListening(false);
                setInput('🎙️ מעבד...');

                try {
                    const formData = new FormData();
                    formData.append('audio_file', audioBlob, 'recording.webm');

                    const response = await fetch(`/api/maya/transcribe?language=he`, {
                        method: 'POST',
                        body: formData,
                    });

                    if (response.status === 503) {
                        setInput('');
                        setMessages(prev => [...prev, {
                            id: 'asr-err-' + Date.now(),
                            role: 'assistant',
                            content: '⚠️ שירות Whisper לא פעיל (503). ייתכן שהשרת בעומס או נכבה.',
                            timestamp: new Date()
                        }]);
                        return;
                    }

                    if (!response.ok) {
                        const errBody = await response.text().catch(() => 'No body');
                        throw new Error(`HTTP ${response.status}: ${errBody}`);
                    }
                    const { text } = await response.json();
                    setInput(text?.trim() || '');
                } catch (err) {
                    console.error('🎙️ Whisper transcription error:', err);
                    setInput('');
                    setMessages(prev => [...prev, {
                        id: 'asr-err-' + Date.now(),
                        role: 'assistant',
                        content: '❌ שגיאה בזיהוי קולי.',
                        timestamp: new Date()
                    }]);
                }
            };

            mediaRecorderRef.current = recorder;
            recorder.start();
            setIsListening(true);
        } catch (err) {
            console.error('🎙️ Mic access error:', err);
            setIsListening(false);
        }
    };

    // 🆕 Clock-In State
    const [showClockIn, setShowClockIn] = useState(needsClockIn && !isClockedIn);

    // 🆕 Sync showClockIn with props OR Fetch status
    useEffect(() => {
        if (needsClockIn !== undefined) {
            // If prop is explicit, honor it
            setShowClockIn(needsClockIn && !isClockedIn);
        } else if (activeEmployee?.id) {
            // Otherwise, check DB for status via RPC (Reliable)
            console.log('🕰️ Maya: Checking clock status for', activeEmployee.name);
            const checkClockStatus = async () => {
                try {
                    const { data, error } = await supabase.rpc('get_employee_shift_status', {
                        p_employee_id: activeEmployee.id
                    });

                    if (!error && data) {
                        const currentlyClockedIn = data.is_clocked_in; // RPC returns { is_clocked_in: boolean }
                        console.log('🕰️ Clock Status (RPC):', currentlyClockedIn ? 'IN' : 'OUT');
                        if (!currentlyClockedIn) {
                            setShowClockIn(true);
                            // Auto-open if not clocked in
                            setIsOpen(true);
                        }
                    } else if (error) {
                        console.warn('⚠️ RPC failed, assuming clocked out:', error);
                        // Fallback logic could go here, but let's be safe
                        setShowClockIn(true);
                        setIsOpen(true);
                    }
                } catch (err) {
                    console.error('Failed to check clock status:', err);
                }
            };
            checkClockStatus();
        }
    }, [needsClockIn, isClockedIn, activeEmployee?.id, activeEmployee?.name]);

    // Scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Check provider availability on mount
    useEffect(() => {
        const checkProviders = async () => {
            // Check local (Ollama)
            try {
                const res = await fetch('/api/maya/health');
                const data = await res.json();
                setLocalAvailable(data.healthy === true);
            } catch {
                setLocalAvailable(false);
            }
        };
        checkProviders();
    }, [businessId]);

    // Realtime Automations Listener
    useEffect(() => {
        if (!businessId) return;

        const channel = supabase
            .channel('maia-automations')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'automation_logs',
                    filter: `business_id=eq.${businessId}`
                },
                (payload) => {
                    const log = payload.new as AutomationLog;
                    const systemMessage = createSystemMessage(log);

                    setMessages(prev => [...prev, systemMessage]);

                    if (!isOpen) {
                        setUnreadCount(prev => prev + 1);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [businessId, isOpen]);

    const createSystemMessage = (log: AutomationLog): Message => {
        let content = '';
        let actions: MessageAction[] = [];

        switch (log.action) {
            case 'vip_order_detected':
                const vipName = log.target;
                content = `🎯 זיהיתי שנתי הזמין! הזרקתי את הקבוע שלו.`;
                actions = [
                    {
                        type: 'story',
                        label: '📸 פרסם סטורי לדנה',
                        data: { vipName: log.target, ...log.details }
                    },
                    {
                        type: 'sms',
                        label: '📱 שלח מסרון לנתי',
                        data: { target: log.target }
                    }
                ];
                break;

            case 'story_posted':
                content = `✅ הסטורי נשלח לדנה (Instagram Webhook)!`;
                break;

            case 'sms_sent':
                content = `✅ מסרון נשלח בהצלחה ל-${log.target}`;
                break;

            default:
                content = `🤖 אוטומציה: ${log.action}`;
        }

        return {
            id: `auto-${log.id}`,
            role: 'system',
            content,
            timestamp: new Date(log.created_at),
            isAutomation: true,
            actions: actions.length > 0 ? actions : undefined
        };
    };

    const sendMessage = useCallback(async () => {
        if (!input.trim() || loading || !businessId) return;

        const userMsg: Message = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: input,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLastUsage(null);

        // MAGIC DETECTION LOGIC
        const lowerInput = input.toLowerCase();
        const isMagicRequest = lowerInput.includes('kds') || lowerInput.includes('עיצוב') || lowerInput.includes('וורלד') || lowerInput.includes('world') || lowerInput.includes('שינוי') || lowerInput.includes('צבע');
        const isDeviceUser = activeEmployee?.is_device === true || activeEmployee?.name?.includes('Terminal');

        if (isMagicRequest && (hasMagicalAccess || isDeviceUser)) {
            setLoading(true);
            setTimeout(() => {
                const magicSuggestion: Message = {
                    id: `magic-suggest-${Date.now()}`,
                    role: 'assistant',
                    content: 'נראה שאתה מבקש שינוי בממשק. האם תרצה שאשתמש ב-Abrakadabra Engine כדי להכין לך גרסת סנדבוקס של השינוי הזה?',
                    timestamp: new Date(),
                    actions: [
                        {
                            type: 'alert',
                            label: '🪄 הפעל מנוע קוסמי (Cast)',
                            data: { action: 'trigger_cast', original_input: input }
                        }
                    ]
                };
                setMessages(prev => [...prev, magicSuggestion]);
                setLoading(false);
            }, 800);
            return;
        }

        setLoading(true);

        try {
            const res = await fetch('/api/maya/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [...messages, userMsg].map(m => ({
                        role: m.role,
                        content: m.content
                    })),
                    businessId,
                    provider,
                    model, // Pass selected model
                    employeeId: activeEmployee?.id,
                    // Security Context for Backend
                    securityContext: {
                        isSuperAdmin: activeEmployee?.isSuperAdmin || activeEmployee?.is_super_admin,
                        role: activeEmployee?.accessLevel || activeEmployee?.access_level
                    }
                })
            });

            const data = await res.json();

            // Track usage if available
            if (data.usage) {
                setLastUsage(data.usage);
            }

            // Handle response format (string or object)
            const responseText = typeof data.response === 'string' ? data.response : (data.response || 'Error');

            const botMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: responseText || 'סליחה, לא הצלחתי להבין.',
                timestamp: new Date()
            };

            setMessages(prev => [...prev, botMsg]);
        } catch (err) {
            console.error('Error sending message:', err);
            const errorMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: 'סליחה, יש בעיה בתקשורת כרגע.',
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setLoading(false);
        }
    }, [input, loading, messages, businessId, provider, model, activeEmployee, hasMagicalAccess]);



    const handleAction = async (action: MessageAction, messageId: string) => {
        // Set Pending
        setMessages(prev => prev.map(m => {
            if (m.id === messageId && m.actions) {
                return {
                    ...m,
                    actions: m.actions.map(a => a === action ? { ...a, pending: true } : a)
                };
            }
            return m;
        }));

        try {
            if (action.type === 'story') {
                // Generate Caption
                const captionRes = await fetch('/api/marketing/generate-caption', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        businessId,
                        context: `${action.data.vipName} הזמין את הקבוע שלו (הפוך חזק שיבולת)`,
                        style: 'עוקצני'
                    })
                });
                const { caption } = await captionRes.json();

                // Publish
                await fetch('/api/marketing/story', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        businessId,
                        type: 'vip_order',
                        caption,
                        metadata: action.data
                    })
                });
            }

            if (action.type === 'sms') {
                // Placeholder for SMS
                await fetch('/api/marketing/sms', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        businessId,
                        phone: '0501234567', // Nati's phone from DB/Env
                        message: 'הקפה שלך מוכן נתי! בוא לפני שיתקרר 😉'
                    })
                });
            }

            // Set Completed
            setMessages(prev => prev.map(m => {
                if (m.id === messageId && m.actions) {
                    return {
                        ...m,
                        actions: m.actions.map(a => a === action ? { ...a, pending: false, completed: true } : a)
                    };
                }
                return m;
            }));

        } catch (err) {
            console.error('Action Failed:', err);
            // Revert pending
            setMessages(prev => prev.map(m => {
                if (m.id === messageId && m.actions) {
                    return {
                        ...m,
                        actions: m.actions.map(a => a === action ? { ...a, pending: false } : a)
                    };
                }
                return m;
            }));
        }

        // Handle Magic Trigger from Chat
        if (action.type === 'alert' && action.data.action === 'trigger_cast') {
            const originalInput = action.data.original_input;
            setInput(originalInput);
            // We need to wait for state update or just call castSpell with local variable
            // Since castSpell uses 'input' from state, let's call a modified version or just use state
            setTimeout(() => {
                castSpell();
            }, 100);
            return;
        }

        // Handle Magic Sandbox Entry
        if (action.type === 'alert' && action.data.manifesto) {
            console.log('⚡ Triggering wearHat (Sandbox Initialization)...');
            wearHat(action.data.manifesto);
        }
    };


    const handleOpen = () => {
        setIsOpen(true);
        setIsMinimized(false);
        setUnreadCount(0);
    };

    // 🆕 Refresh Handler
    const handleRefresh = () => {
        setMessages([]);
        setInput('');
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // Don't render if not on allowed route
    if (!shouldShow()) {
        return null;
    }

    return (
        <>
            {/* Post Creator Modal */}
            <AnimatePresence>
                {showPostCreator && (
                    <PostCreator
                        businessId={businessId}
                        onClose={() => setShowPostCreator(false)}
                    />
                )}
            </AnimatePresence>

            {/* User Settings Modal */}
            <AnimatePresence>
                {showSettings && activeEmployee && (
                    <UserSettingsModal
                        employee={activeEmployee}
                        onClose={() => setShowSettings(false)}
                    />
                )}
            </AnimatePresence>

            {/* Team Message Modal */}
            <AnimatePresence>
                {showTeamMessage && activeEmployee && (
                    <TeamMessageModal
                        businessId={businessId}
                        activeEmployee={activeEmployee}
                        onClose={() => setShowTeamMessage(false)}
                    />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {!isOpen && (
                    <motion.button
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={handleOpen}
                        className="fixed bottom-[88px] left-4 z-[9999] w-14 h-14 rounded-xl
                       bg-purple-600 border-2 border-purple-400
                       shadow-lg shadow-purple-500/30 flex items-center justify-center
                       hover:bg-purple-500 hover:shadow-purple-500/50 hover:border-purple-300
                       transition-all duration-200 lg:bottom-6"
                    >
                        <img src={maiaLogo} alt="Maia" className="w-8 h-8 object-contain" />
                        {unreadCount > 0 && (
                            <motion.span
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full
                           text-xs text-white flex items-center justify-center font-bold"
                            >
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </motion.span>
                        )}
                    </motion.button>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{
                            opacity: 1,
                            scale: 1,
                            y: 0,
                            height: isMinimized ? 56 : 520,
                            width: isMinimized ? 200 : 400
                        }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        drag
                        dragControls={dragControls}
                        dragMomentum={false}
                        dragElastic={0}
                        className="fixed z-[9999] rounded-2xl overflow-hidden
                       backdrop-blur-xl bg-slate-900/90 border border-white/10
                       shadow-2xl shadow-purple-500/20"
                        style={{ left: position.x, bottom: position.y, direction: 'rtl' }}
                    >
                        {/* Header */}
                        <div
                            className="h-14 px-4 flex items-center justify-between 
                         bg-gradient-to-r from-purple-600/50 to-pink-600/50 
                         border-b border-white/10 cursor-move"
                            onPointerDown={(e) => dragControls.start(e)}
                        >
                            <div className="flex items-center gap-3">
                                <GripVertical className="w-4 h-4 text-white/40" />
                                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center overflow-hidden">
                                    <img src={maiaLogo} alt="Maia" className="w-full h-full object-cover" />
                                </div>
                                {!isMinimized && (
                                    <div>
                                        <h3 className="text-sm font-bold text-white">מאיה 🌸</h3>
                                        <p className="text-xs text-white/60">המנהלת הדיגיטלית</p>
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center gap-1">
                                {/* Compact Model Selector - expands on click */}
                                {!isMinimized && (
                                    <div className="relative">
                                        <button
                                            onClick={() => setShowModelSelector(!showModelSelector)}
                                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/10 border border-white/10 hover:bg-white/20 transition-all"
                                            title="בחירת מודל"
                                        >
                                            <Cpu className={`w-3 h-3 ${activeTab === 'local' ? 'text-blue-400' : 'text-purple-400'}`} />
                                            <span className="text-[10px] font-bold text-white/70">{activeTab === 'local' ? 'LOCAL' : 'API'}</span>
                                            <div className={`w-1.5 h-1.5 rounded-full ${loading ? 'bg-yellow-400 animate-pulse' : (localAvailable ? 'bg-green-400 opacity-80' : 'bg-red-400 opacity-80')}`} />
                                        </button>

                                        {/* Expanded Model Dropdown */}
                                        {showModelSelector && (
                                            <div className="absolute top-full left-0 mt-1 w-[220px] bg-slate-900/95 border border-white/10 rounded-xl p-2 z-50 shadow-2xl backdrop-blur-xl">
                                                {/* Tab Switching */}
                                                <div className="flex gap-1 mb-2">
                                                    <button
                                                        onClick={() => {
                                                            setActiveTab('local');
                                                            setProvider('local');
                                                            setModel('gemma:2b');
                                                        }}
                                                        className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all ${activeTab === 'local'
                                                            ? 'bg-blue-500/30 text-blue-300 border border-blue-500/30'
                                                            : 'text-white/40 hover:text-white/70'
                                                            }`}
                                                    >
                                                        LOCAL
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setActiveTab('api');
                                                            const firstApi = availableProviders.find(p => p !== 'local');
                                                            if (firstApi) {
                                                                setProvider(firstApi as any);
                                                                setModel(AI_MODELS[firstApi as keyof typeof AI_MODELS][0].id);
                                                            }
                                                        }}
                                                        className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all ${activeTab === 'api'
                                                            ? 'bg-purple-500/30 text-purple-300 border border-purple-500/30'
                                                            : 'text-white/40 hover:text-white/70'
                                                            }`}
                                                    >
                                                        API
                                                    </button>
                                                </div>

                                                {/* Model List */}
                                                <select
                                                    value={JSON.stringify({ p: provider, m: model })}
                                                    onChange={(e) => {
                                                        const val = JSON.parse(e.target.value);
                                                        setProvider(val.p);
                                                        setModel(val.m);
                                                        setShowModelSelector(false);
                                                    }}
                                                    className="w-full appearance-none bg-white/5 text-[11px] font-bold text-white/90 px-2 py-2 rounded-lg focus:outline-none cursor-pointer border border-white/10 [&>option]:bg-slate-900 [&>option]:text-white"
                                                >
                                                    {activeTab === 'local' ? (
                                                        <optgroup label="Local (Ollama)">
                                                            {AI_MODELS['local'].map(m => (
                                                                <option key={m.id} value={JSON.stringify({ p: 'local', m: m.id })}>{m.name}</option>
                                                            ))}
                                                        </optgroup>
                                                    ) : (
                                                        <>
                                                            {availableProviders.includes('anthropic') && (
                                                                <optgroup label="Anthropic (Claude)">
                                                                    {AI_MODELS['anthropic'].map(m => (
                                                                        <option key={m.id} value={JSON.stringify({ p: 'anthropic', m: m.id })}>{m.name}</option>
                                                                    ))}
                                                                </optgroup>
                                                            )}
                                                            {availableProviders.includes('google') && (
                                                                <optgroup label="Google (Gemini)">
                                                                    {AI_MODELS['google'].map(m => (
                                                                        <option key={m.id} value={JSON.stringify({ p: 'google', m: m.id })}>{m.name}</option>
                                                                    ))}
                                                                </optgroup>
                                                            )}
                                                            {availableProviders.includes('xai') && (
                                                                <optgroup label="xAI (Grok)">
                                                                    {AI_MODELS['xai'].map(m => (
                                                                        <option key={m.id} value={JSON.stringify({ p: 'xai', m: m.id })}>{m.name}</option>
                                                                    ))}
                                                                </optgroup>
                                                            )}
                                                        </>
                                                    )}
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <motion.button
                                    whileTap={{ scale: 0.9 }}
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onClick={() => setIsMinimized(!isMinimized)}
                                    className="p-2 hover:bg-white/10 rounded-lg transition"
                                    title={isMinimized ? "הגדל חלון" : "מזער חלון"}
                                >
                                    {isMinimized ? <Maximize2 className="w-4 h-4 text-white/70" /> : <Minimize2 className="w-4 h-4 text-white/70" />}
                                </motion.button>

                                <motion.button
                                    whileTap={{ scale: 0.9 }}
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onClick={() => { setIsOpen(false); setShowModelSelector(false); }}
                                    className="p-2 bg-red-500/20 hover:bg-red-500/40 text-red-200 border border-red-500/30 rounded-lg transition"
                                    title="סגור חלון"
                                >
                                    <X className="w-4 h-4" />
                                </motion.button>
                            </div>
                        </div>

                        {/* Chat Body */}
                        {!isMinimized && (
                            <>
                                {/* 🆕 INLINE CLOCK-IN (if needed) */}
                                {showClockIn && activeEmployee && (
                                    <div className="flex-1 overflow-y-auto px-4 py-3">
                                        <ClockInModalInline
                                            employee={activeEmployee}
                                            onClockInSuccess={(role, eventId) => {
                                                console.log('✅ Clocked in:', { role, eventId });
                                                setShowClockIn(false);
                                                if (onClockInComplete) {
                                                    onClockInComplete(role, eventId);
                                                }
                                            }}
                                            onError={(err) => {
                                                console.error('Clock-in error:', err);
                                                // You can add a toast notification here
                                            }}
                                        />
                                    </div>
                                )}

                                {/* CHAT INTERFACE (only if NOT showing clock-in) */}
                                {!showClockIn && (
                                    <>
                                        <div className="h-[400px] overflow-y-auto p-4 space-y-3">
                                            {messages.length === 0 && (
                                                <div className="text-center text-white/40 py-6">
                                                    <Bot className="w-10 h-10 mx-auto mb-2 opacity-50" />
                                                    <p className="text-sm font-medium">היי! אני מאיה 🌸</p>
                                                    <p className="text-xs mb-4">מה אפשר לעשות בשבילך היום?</p>

                                                    {/* Quick Actions – top row (active only) */}
                                                    <div className="flex flex-wrap gap-2 justify-center">
                                                        {/* Team Message - Only for Managers+ */}
                                                        {['owner', 'admin', 'manager'].includes(userRole) && (
                                                            <motion.button
                                                                whileTap={{ scale: 0.95 }}
                                                                onClick={() => setShowTeamMessage(true)}
                                                                className="px-3 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl text-white text-xs font-medium flex items-center gap-2"
                                                            >
                                                                <MessageSquare className="w-3.5 h-3.5" />
                                                                הודעה לצוות
                                                            </motion.button>
                                                        )}
                                                    </div>

                                                    {/* ─── Employee / Admin Actions ─── */}
                                                    <div className="flex flex-wrap gap-2 justify-center mt-3 pt-3 border-t border-white/10">
                                                        {/* 🕒 שעון נוכחות – always visible, opens clock modal */}
                                                        <motion.button
                                                            whileTap={{ scale: 0.95 }}
                                                            onClick={() => {
                                                                setShowClockIn(true);
                                                                // ensure chat body is visible
                                                                setIsMinimized(false);
                                                            }}
                                                            className="px-3 py-2 bg-white/10 hover:bg-cyan-500/20 hover:text-cyan-300 rounded-xl text-white text-xs font-medium flex items-center gap-2"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                                                            שעון נוכחות
                                                        </motion.button>

                                                        {/* 👤 עריכת פרטים אישיים */}
                                                        <motion.button
                                                            whileTap={{ scale: 0.95 }}
                                                            onClick={() => setShowSettings(true)}
                                                            className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-white text-xs font-medium flex items-center gap-2"
                                                        >
                                                            <User className="w-3.5 h-3.5" />
                                                            עריכת פרטים אישיים
                                                        </motion.button>

                                                        {/* 👑 מעבר לסופראדמין – super admin only */}
                                                        {(activeEmployee?.isSuperAdmin || activeEmployee?.is_super_admin || userRole === 'super-admin') && (
                                                            <motion.button
                                                                whileTap={{ scale: 0.95 }}
                                                                onClick={() => {
                                                                    setIsOpen(false);
                                                                    window.location.href = '/super-admin';
                                                                }}
                                                                className="px-3 py-2 bg-purple-500/20 hover:bg-purple-500/30 rounded-xl text-purple-300 text-xs font-medium flex items-center gap-2"
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                                                                מעבר לסופראדמין
                                                            </motion.button>
                                                        )}

                                                        {/* 🖱️ מצב עריכת דף – super admin only */}
                                                        {(activeEmployee?.isSuperAdmin || activeEmployee?.is_super_admin || userRole === 'super-admin') && (
                                                            <motion.button
                                                                whileTap={{ scale: 0.95 }}
                                                                onClick={() => {
                                                                    toggleInspector();
                                                                    setIsMinimized(true);
                                                                }}
                                                                className={`px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2 transition-colors ${inspectorActive ? 'bg-yellow-400 text-purple-900' : 'bg-white/10 hover:bg-white/20 text-white'}`}
                                                            >
                                                                <MousePointer2 className="w-3.5 h-3.5" />
                                                                מצב עריכת דף
                                                            </motion.button>
                                                        )}

                                                        {/* 🚪 התנתקות */}
                                                        <motion.button
                                                            whileTap={{ scale: 0.95 }}
                                                            onClick={() => {
                                                                if (window.confirm('האם אתה בטוח שברצונך להתנתק?')) {
                                                                    auth?.signOut?.();
                                                                    onLogout?.();
                                                                    setIsOpen(false);
                                                                }
                                                            }}
                                                            className="px-3 py-2 bg-white/10 hover:bg-amber-500/20 hover:text-amber-300 rounded-xl text-white text-xs font-medium flex items-center gap-2"
                                                        >
                                                            <LogOut className="w-3.5 h-3.5" />
                                                            התנתקות
                                                        </motion.button>

                                                        {/* 🚫 Coming Soon: צור פוסט */}
                                                        <div className="relative">
                                                            <motion.button
                                                                disabled
                                                                className="px-3 py-2 bg-gradient-to-r from-purple-500/30 to-pink-500/30 rounded-xl text-white/40 text-xs font-medium flex items-center gap-2 cursor-not-allowed"
                                                            >
                                                                <Plus className="w-3.5 h-3.5" />
                                                                צור פוסט
                                                            </motion.button>
                                                            <span className="absolute -top-2 -right-1 text-[9px] bg-amber-500 text-black font-bold px-1.5 py-0.5 rounded-full leading-none">בקרוב</span>
                                                        </div>

                                                        {/* 🚫 Coming Soon: טקסט שיווקי */}
                                                        <div className="relative">
                                                            <motion.button
                                                                disabled
                                                                className="px-3 py-2 bg-white/5 rounded-xl text-white/40 text-xs font-medium flex items-center gap-2 cursor-not-allowed"
                                                            >
                                                                <Sparkles className="w-3.5 h-3.5" />
                                                                טקסט שיווקי
                                                            </motion.button>
                                                            <span className="absolute -top-2 -right-1 text-[9px] bg-amber-500 text-black font-bold px-1.5 py-0.5 rounded-full leading-none">בקרוב</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            <AnimatePresence mode="popLayout">
                                                {messages.map((msg) => (
                                                    <motion.div
                                                        key={msg.id}
                                                        layout
                                                        initial={{ opacity: 0, y: 10 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                                                    >
                                                        {msg.role !== 'user' && (
                                                            <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center 
                                          ${msg.isAutomation ? 'bg-amber-500/30' : 'bg-purple-500/30'}`}>
                                                                {msg.isAutomation ? <Zap className="w-3.5 h-3.5 text-amber-400" /> : <Bot className="w-3.5 h-3.5 text-purple-400" />}
                                                            </div>
                                                        )}

                                                        <div className="max-w-[85%] space-y-2">
                                                            <div className={`px-3 py-2 rounded-xl text-sm 
                                          ${msg.role === 'user' ? 'bg-cyan-500 text-white' :
                                                                    msg.isAutomation ? 'bg-amber-500/20 text-amber-100 border border-amber-500/30' : 'bg-white/10 text-white'}`}>
                                                                <p className="whitespace-pre-wrap">{msg.content}</p>
                                                            </div>

                                                            {msg.actions && (
                                                                <div className="flex flex-wrap gap-2">
                                                                    {msg.actions.map((action, idx) => (
                                                                        <motion.button
                                                                            key={idx}
                                                                            whileTap={{ scale: 0.95 }}
                                                                            onClick={() => handleAction(action, msg.id)}
                                                                            disabled={action.pending || action.completed}
                                                                            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors
                                             ${action.completed ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-white hover:bg-white/20'}`}
                                                                        >
                                                                            {action.pending ? <Loader2 className="w-3 h-3 animate-spin" /> :
                                                                                action.type === 'story' ? <Instagram className="w-3 h-3" /> :
                                                                                    action.type === 'sms' ? <MessageSquare className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                                                                            {action.completed ? 'בוצע' : action.label}
                                                                        </motion.button>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {msg.role === 'user' && (
                                                            <div className="w-7 h-7 rounded-full bg-cyan-500/30 flex-shrink-0 flex items-center justify-center">
                                                                <User className="w-3.5 h-3.5 text-cyan-400" />
                                                            </div>
                                                        )}
                                                    </motion.div>
                                                ))}
                                            </AnimatePresence>

                                            {loading && (
                                                <div className="flex gap-2">
                                                    <div className="w-7 h-7 rounded-full bg-purple-500/30 flex items-center justify-center">
                                                        <Loader2 className="w-3.5 h-3.5 text-purple-400 animate-spin" />
                                                    </div>
                                                    <div className="bg-white/10 px-3 py-2 rounded-xl">
                                                        <div className="flex gap-1">
                                                            <span className="w-1.5 h-1.5 bg-white/50 rounded-full animate-bounce" />
                                                            <span className="w-1.5 h-1.5 bg-white/50 rounded-full animate-bounce [animation-delay:100ms]" />
                                                            <span className="w-1.5 h-1.5 bg-white/50 rounded-full animate-bounce [animation-delay:200ms]" />
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            <div ref={messagesEndRef} />
                                        </div>

                                        {/* Input Area */}
                                        <div className="p-3 border-t border-white/10">
                                            <div className="flex gap-2">
                                                {/* Usage Stats (If available) */}
                                                {lastUsage && (
                                                    <div className="hidden sm:flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs shadow-lg">
                                                        <div className="p-1 bg-emerald-500/20 rounded-full">
                                                            <Zap className="w-3 h-3" />
                                                        </div>
                                                        <div className="flex flex-col leading-none">
                                                            <span className="opacity-60 text-[10px]">שימוש (טוקנים)</span>
                                                            <span className="font-bold font-mono">
                                                                {(lastUsage.input + lastUsage.output).toLocaleString()}
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Quick Create Post Button */}
                                                <motion.button
                                                    whileTap={{ scale: 0.9 }}
                                                    onClick={() => setShowPostCreator(true)}
                                                    className="px-3 py-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl text-white hover:opacity-90 transition-opacity"
                                                    title="צור פוסט"
                                                >
                                                    <Plus className="w-4 h-4" />
                                                </motion.button>
                                                <input
                                                    type="text"
                                                    value={input}
                                                    onChange={(e) => setInput(e.target.value)}
                                                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                                                    placeholder={isListening ? "מקשיבה..." : "דבר איתי..."}
                                                    disabled={loading}
                                                    className={`flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500 disabled:opacity-50 ${isListening ? 'animate-pulse border-purple-500' : ''}`}
                                                />

                                                {/* 🎙️ Voice Button */}
                                                <motion.button
                                                    whileTap={{ scale: 0.9 }}
                                                    onClick={toggleListening}
                                                    disabled={loading}
                                                    className={`px-3 py-2 rounded-xl text-white transition-colors ${isListening ? 'bg-red-500 animate-pulse' : 'bg-white/10 hover:bg-white/20'}`}
                                                    title={isListening ? "עצור הקלטה" : "דבר אל מאיה (Whisper)"}
                                                >
                                                    {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                                                </motion.button>

                                                <motion.button
                                                    whileTap={{ scale: 0.9 }}
                                                    onClick={sendMessage}
                                                    disabled={loading || !input.trim()}
                                                    className="px-3 py-2 bg-purple-500 rounded-xl text-white disabled:opacity-50 hover:bg-purple-600 transition-colors"
                                                >
                                                    <Send className="w-4 h-4" />
                                                </motion.button>



                                            </div>
                                        </div>
                                    </>
                                )}
                            </>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

export default MayaOverlay;
