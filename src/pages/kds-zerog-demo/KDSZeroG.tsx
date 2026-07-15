
// App.tsx - KDS-ZeroG Standalone Demo

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Mic, Check, Coffee, Clock } from 'lucide-react';

// --- SDK INTERFACE & MOCK ---
declare global { interface Window { icaffe: any; } }

// Force sync initialization to avoid race conditions in children
if (typeof window !== 'undefined' && !window.icaffe) {
    window.icaffe = {
        auth: {
            identify: async () => ({ id: 'staff-123', name: 'רני', role: 'barista' })
        },
        db: {
            query: async () => ({
                data: [
                    {
                        id: 'ORD-7842',
                        status: 'pending',
                        table_number: 'T12',
                        items: [
                            { name: 'לאטה גדול', quantity: 2, modifiers: ['ללא סוכר'] },
                            { name: 'קרואסון', quantity: 1 }
                        ],
                        created_at: new Date().toISOString()
                    },
                    {
                        id: 'ORD-7843',
                        status: 'cooking',
                        table_number: 'T05',
                        items: [
                            { name: 'אספרסו', quantity: 1 },
                            { name: 'סנדוויץ\' אבוקדו', quantity: 2 }
                        ],
                        created_at: new Date().toISOString()
                    },
                    {
                        id: 'ORD-7844',
                        status: 'ready',
                        table_number: 'T08',
                        items: [
                            { name: 'קפוצ\'ינו', quantity: 3 },
                            { name: 'עוגיית שוקולד', quantity: 1 }
                        ],
                        created_at: new Date().toISOString()
                    }
                ],
                error: null
            }),
            commit: async (table: string, data: any, options: any) => {
                console.log('SDK Commit:', { table, data, options });
                return { success: true, rollback_token: 'mock_' + Date.now() };
            }
        },
        ai: {
            consult: async () => ({
                content: JSON.stringify({
                    message: "היום נראה הרבה הזמנות של קפה קר – כדאי להכין מראש קנקן גדול.",
                    tip: "טיפ: העבר 1 בריסטה לתחנת cold brew בשעה 11:00"
                })
            })
        }
    };
}

const statusColors: any = {
    pending: 'border-cyan-400 bg-cyan-900/20',
    cooking: 'border-orange-400 bg-orange-900/20',
    ready: 'border-emerald-400 bg-emerald-900/20 shadow-[0_0_20px_#10b98133]'
};

const OrderCard = ({ order, onUpdate }: any) => {
    const markReady = async () => {
        await window.icaffe.db.commit('orders',
            { id: order.id, status: 'ready' },
            { app_id: 'kds-zerog-demo', reason: 'Mark as ready from UI' }
        );
        onUpdate(order.id, 'ready');
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -80, scale: 0.92 }}
            transition={{ duration: 0.4 }}
            className={`p-5 rounded-2xl border-2 ${statusColors[order.status] || ''} backdrop-blur-sm text-white`}
        >
            <div className="flex justify-between items-start mb-4">
                <div className="text-3xl font-bold tracking-tight">#{order.id.slice(-4)}</div>
                <div className="text-xs uppercase px-3 py-1 rounded-full border border-white/30">
                    {order.status.toUpperCase()}
                </div>
            </div>

            <div className="space-y-2 mb-4 text-base">
                {order.items.map((item: any, i: number) => (
                    <div key={i} className="flex justify-between">
                        <span>{item.quantity}× {item.name}</span>
                        {item.modifiers && <span className="text-white/60 text-sm">({item.modifiers.join(', ')})</span>}
                    </div>
                ))}
            </div>

            {order.status !== 'ready' && (
                <button
                    onClick={markReady}
                    className="w-full bg-white/90 text-black font-bold py-3 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform"
                >
                    <Check size={20} />
                    {order.status === 'pending' ? 'התחל' : 'מוכן'}
                </button>
            )}
        </motion.div>
    );
};

const MayaTip = () => {
    const [tip, setTip] = useState<any>(null);

    useEffect(() => {
        if (window.icaffe && window.icaffe.ai) {
            window.icaffe.ai.consult("תני טיפ יצירתי קצר למטבח קפה עמוס").then((r: any) => {
                try {
                    setTip(JSON.parse(r.content));
                } catch { }
            });
        }
    }, []);

    if (!tip) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="fixed bottom-20 inset-x-4 bg-black/60 backdrop-blur-lg border border-white/10 rounded-2xl p-4 text-sm"
        >
            <div className="text-purple-300 font-medium flex items-center gap-2 mb-1">
                <Coffee size={16} /> Maya Tip
            </div>
            <div className="text-white/90">{tip.message}</div>
            <div className="text-emerald-300 text-xs mt-1">{tip.tip}</div>
        </motion.div>
    );
};

export default function App() {
    const [orders, setOrders] = useState<any[]>([]);
    const [staff, setStaff] = useState<any>(null);

    useEffect(() => {
        // Safety check in case it wasn't initialized
        if (!window.icaffe) return;

        window.icaffe.auth.identify().then(setStaff);
        window.icaffe.db.query('orders').then((r: any) => setOrders(r.data || []));
    }, []);

    const updateStatus = useCallback((id: string, newStatus: string) => {
        setOrders(prev => prev.map(o => o.id === id ? { ...o, status: newStatus } : o));
    }, []);

    if (!staff && !orders.length) {
        return <div className="min-h-screen bg-black text-white flex items-center justify-center">Loading KDS...</div>
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-zinc-950 to-black text-white relative font-sans text-right" dir="rtl">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 backdrop-blur-md">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                        <User size={20} />
                    </div>
                    <div>
                        <div className="font-semibold">{staff?.name || 'מתחבר...'}</div>
                        <div className="text-cyan-400 text-xs">{staff?.role}</div>
                    </div>
                </div>
                <div className="flex items-center gap-2 text-cyan-300 text-sm">
                    <Clock size={16} /> SDK Live
                </div>
            </div>

            {/* Orders */}
            <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl mx-auto">
                    <AnimatePresence mode="popLayout">
                        {orders.map(order => (
                            <OrderCard
                                key={order.id}
                                order={order}
                                onUpdate={updateStatus}
                            />
                        ))}
                    </AnimatePresence>
                </div>
            </div>

            <MayaTip />

            {/* Voice button placeholder */}
            <button className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center shadow-xl">
                <Mic size={24} />
            </button>
        </div>
    );
}
