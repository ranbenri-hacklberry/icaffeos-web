import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { Truck, ChevronLeft, Calendar, Package, ScanLine, FileText } from 'lucide-react';
import { IncomingOrder } from '@/pages/ipad_inventory/types';

const MotionButton = motion.button as any;

interface IncomingOrdersSidebarProps {
    orders: IncomingOrder[];
    selectedOrderId: string | null;
    onSelectOrder: (orderId: string) => void;
    isLoading: boolean;
    onScanInvoice?: (file: File) => void;
    isScanning?: boolean;
}

const IncomingOrdersSidebar: React.FC<IncomingOrdersSidebarProps> = ({
    orders,
    selectedOrderId,
    onSelectOrder,
    isLoading,
    onScanInvoice,
    isScanning = false
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && onScanInvoice) {
            onScanInvoice(file);
        }
        // Reset so the same file can be selected again
        if (e.target) e.target.value = '';
    };

    if (isLoading) {
        return (
            <div className="w-full md:w-80 h-full bg-slate-50 border-l border-slate-200 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="w-full md:w-80 h-full bg-slate-50 border-l border-slate-200 overflow-y-auto no-scrollbar pb-20">
            <div className="p-6">
                <h2 className="text-xl font-black text-slate-900 mb-4 flex items-center gap-2">
                    <Truck size={22} className="text-indigo-600" />
                    <span>קבלת סחורה</span>
                </h2>

                {/* Scan Invoice Button */}
                <MotionButton
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isScanning}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    className={`w-full flex items-center gap-3 p-4 rounded-2xl mb-6 transition-all border-2 border-dashed ${
                        isScanning
                            ? 'bg-indigo-50 border-indigo-300 cursor-wait'
                            : 'bg-gradient-to-l from-indigo-50 to-purple-50 border-indigo-200 hover:border-indigo-400 hover:shadow-md cursor-pointer'
                    }`}
                >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                        isScanning ? 'bg-indigo-100' : 'bg-white shadow-sm'
                    }`}>
                        {isScanning ? (
                            <div className="w-6 h-6 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
                        ) : (
                            <ScanLine size={22} className="text-indigo-600" />
                        )}
                    </div>
                    <div className="flex flex-col items-start">
                        <span className="font-black text-sm text-indigo-700">
                            {isScanning ? 'סורק חשבונית...' : 'סרוק חשבונית'}
                        </span>
                        <span className="text-[10px] text-indigo-400 font-bold leading-tight">
                            {isScanning ? 'ה-AI מנתח את הפריטים...' : 'מומלץ: בחר באפשרות "סרוק מסמך"'}
                        </span>
                    </div>
                </MotionButton>

                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*,application/pdf"
                    onChange={handleFileChange}
                />

                {/* Divider with label */}
                {orders.length > 0 && (
                    <div className="flex items-center gap-3 mb-4">
                        <div className="flex-1 h-px bg-slate-200" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">הזמנות פתוחות</span>
                        <div className="flex-1 h-px bg-slate-200" />
                    </div>
                )}

                {orders.length === 0 ? (
                    <div className="text-center py-8">
                        <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                            <FileText size={28} className="text-slate-300" />
                        </div>
                        <p className="text-slate-400 font-bold text-xs">אין הזמנות פתוחות</p>
                        <p className="text-slate-300 text-[10px] mt-1">ניתן לקבל סחורה ע"י סריקת חשבונית</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {orders.map((order) => {
                            const isActive = selectedOrderId === order.id;
                            const orderDate = new Date(order.order_date || order.created_at);
                            const itemCount = order.items?.length || 0;

                            return (
                                <MotionButton
                                    key={order.id}
                                    onClick={() => onSelectOrder(String(order.id))}
                                    whileHover={{ x: -2 }}
                                    whileTap={{ scale: 0.98 }}
                                    className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all ${
                                        isActive
                                            ? 'bg-white shadow-md border-indigo-100 border'
                                            : 'hover:bg-slate-100 text-slate-600'
                                    }`}
                                >
                                    <div className="flex flex-col items-start flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`font-bold transition-colors truncate ${
                                                isActive ? 'text-indigo-600' : 'text-slate-800'
                                            }`}>
                                                {order.supplier_name || 'ספק לא ידוע'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3 text-[10px] text-slate-500 font-medium">
                                            <span className="flex items-center gap-1">
                                                <Calendar size={10} />
                                                {orderDate.toLocaleDateString('he-IL')}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Package size={10} />
                                                {itemCount} פריטים
                                            </span>
                                        </div>
                                    </div>
                                    <ChevronLeft
                                        size={18}
                                        className={`transition-all shrink-0 ${
                                            isActive
                                                ? 'text-indigo-400 translate-x-0'
                                                : 'text-slate-300 translate-x-1 opacity-0'
                                        }`}
                                    />
                                </MotionButton>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default IncomingOrdersSidebar;
