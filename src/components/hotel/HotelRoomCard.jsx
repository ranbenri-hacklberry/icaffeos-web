import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Tractor, User, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { cn } from '@/utils/cn';
import Button from '@/components/ui/Button';
import Icon from '@/components/AppIcon';

/**
 * HotelRoomCard - High-fidelity component for Room State Management.
 * Features:
 * - Reactive JSONB task updates
 * - Maintenance toggle with pulsing animation
 * - Multi-state status badges (Hebrew/RTL)
 * - Shimmer & Exit animations for completed rooms
 */
const HotelRoomCard = ({ 
    order, 
    onUpdateTask, 
    onToggleMaintenance 
}) => {
    const { id, metadata, items, order_status } = order;
    const roomNumber = metadata?.room_number || 'N/A';
    const guestName = metadata?.guest_name || 'אורח';
    const needsMaintenance = metadata?.needs_maintenance || false;

    // Status mapping: Red (Dirty), Yellow (Cleaning), Green (Ready)
    const statusConfig = useMemo(() => {
        switch (order_status) {
            case 'ready':
                return { label: 'מוכן', color: 'bg-emerald-500', text: 'text-emerald-500', border: 'border-emerald-500', icon: 'CheckCircle' };
            case 'in_progress':
                return { label: 'בניקיון', color: 'bg-amber-500', text: 'text-amber-500', border: 'border-amber-500', icon: 'Clock' };
            default:
                return { label: 'מלוכלך', color: 'bg-rose-500', text: 'text-rose-500', border: 'border-rose-500', icon: 'AlertCircle' };
        }
    }, [order_status]);

    const isReady = order_status === 'ready';

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ 
                opacity: 1, 
                scale: 1,
                boxShadow: needsMaintenance 
                    ? "0 0 20px rgba(244, 63, 94, 0.4)" 
                    : "0 10px 15px -3px rgba(0, 0, 0, 0.1)"
            }}
            exit={{ opacity: 0, x: 100, transition: { duration: 0.5 } }}
            className={cn(
                "relative flex flex-col w-full max-w-sm overflow-hidden rounded-[2rem] border-2 bg-white p-6 shadow-xl transition-all duration-500",
                statusConfig.border,
                needsMaintenance && "ring-4 ring-rose-500/20 animate-pulse-red"
            )}
            dir="rtl"
        >
            {/* SHIMMER EFFECT FOR READY ROOMS */}
            {isReady && (
                <motion.div
                    initial={{ x: '-100%' }}
                    animate={{ x: '200%' }}
                    transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                    className="absolute inset-0 z-0 bg-gradient-to-r from-transparent via-white/40 to-transparent pointer-events-none"
                    style={{ skewX: -25 }}
                />
            )}

            {/* HEADER SECTION */}
            <div className="relative z-10 flex items-start justify-between mb-6">
                <div className="flex flex-col">
                    <div className="flex items-center gap-3 mb-1">
                        <span className="text-4xl font-black tracking-tight text-slate-900">
                            {roomNumber}
                        </span>
                        <div className={cn(
                            "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider text-white shadow-sm",
                            statusConfig.color
                        )}>
                            {statusConfig.label}
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-slate-500 font-bold">
                        <User size={16} />
                        <span className="text-sm">{guestName}</span>
                    </div>
                </div>

                {/* MAINTENANCE TOGGLE */}
                <motion.button
                    whileTap={{ scale: 0.8 }}
                    onClick={() => onToggleMaintenance(id)}
                    className={cn(
                        "p-4 rounded-2xl transition-all duration-300",
                        needsMaintenance 
                            ? "bg-rose-600 text-white shadow-lg shadow-rose-600/30" 
                            : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                    )}
                >
                    <Tractor size={24} strokeWidth={2.5} />
                </motion.button>
            </div>

            {/* TASK LIST SECTION */}
            <div className="relative z-10 flex flex-col gap-3">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">צ׳ק ליסט ניקיון</h4>
                <div className="flex flex-col gap-2 rounded-2xl bg-slate-50 p-2 border border-slate-100 italic">
                    <AnimatePresence mode="popLayout">
                        {items?.map((task) => (
                            <TaskItem 
                                key={task.id} 
                                task={task} 
                                onToggle={() => onUpdateTask(id, task.id, task.status === 'completed' ? 'pending' : 'completed')}
                            />
                        ))}
                    </AnimatePresence>
                </div>
            </div>

            {/* FOOTER INFO */}
            <div className="mt-6 pt-4 border-t border-slate-100 flex justify-between items-center text-[10px] font-bold text-slate-400">
                <div className="flex items-center gap-1">
                    <Clock size={12} />
                    <span>עודכן לאחרונה: {new Date(order.updated_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                {needsMaintenance && (
                    <div className="flex items-center gap-1 text-rose-500 animate-pulse">
                        <AlertCircle size={12} />
                        <span>דרושה תחזוקה</span>
                    </div>
                )}
            </div>
        </motion.div>
    );
};

/**
 * TaskItem Component - Handles individual checklist entries with animations.
 */
const TaskItem = ({ task, onToggle }) => {
    const isCompleted = task.status === 'completed';

    return (
        <motion.div
            layout
            initial={{ opacity: 0, x: -10 }}
            animate={{ 
                opacity: 1, 
                x: 0,
                scale: isCompleted ? 0.98 : 1,
                backgroundColor: isCompleted ? 'rgba(16, 185, 129, 0.05)' : 'white'
            }}
            whileTap={{ scale: 0.96 }}
            onClick={onToggle}
            className={cn(
                "flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all duration-300",
                isCompleted ? "border-emerald-500/20 shadow-none" : "border-transparent shadow-sm"
            )}
        >
            <div className={cn(
                "w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-all duration-300",
                isCompleted ? "bg-emerald-500 border-emerald-500 text-white" : "bg-white border-slate-200"
            )}>
                {isCompleted && <CheckCircle size={18} strokeWidth={3} />}
            </div>

            <span className={cn(
                "flex-1 text-sm font-black transition-all duration-500",
                isCompleted ? "text-slate-300 line-through italic" : "text-slate-700"
            )}>
                {task.label}
            </span>
        </motion.div>
    );
};

export default HotelRoomCard;
