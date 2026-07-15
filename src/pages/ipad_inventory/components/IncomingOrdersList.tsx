import React from 'react';
import { motion } from 'framer-motion';
import { Truck, Calendar, Package, ArrowRight } from 'lucide-react';
import { IncomingOrder } from '@/pages/ipad_inventory/types';

const MotionDiv = motion.div as any;
const MotionButton = motion.button as any;

interface IncomingOrdersListProps {
    orders: IncomingOrder[];
    onSelectOrder: (order: IncomingOrder) => void;
    onStartScan: () => void;
    isLoading: boolean;
}

const IncomingOrdersList: React.FC<IncomingOrdersListProps> = ({
    orders,
    onSelectOrder,
    onStartScan,
    isLoading
}) => {
    return (
        <div className="flex-1 h-full bg-slate-50 overflow-hidden flex flex-col">
            <div className="px-8 py-8 flex items-center justify-between">
                <div className="flex flex-col">
                    <h2 className="text-3xl font-black text-slate-900 mb-2 flex items-center gap-3">
                        <Truck size={32} className="text-indigo-600" />
                        <span>משלוחים בדרך</span>
                    </h2>
                    <p className="text-slate-500 font-bold">הזמנות שנשלחו לספקים וממתינות לקבלה</p>
                </div>

                <MotionButton
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onStartScan}
                    className="flex items-center gap-3 px-8 py-5 bg-indigo-600 text-white rounded-3xl font-bold text-lg shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all"
                >
                    <Package size={24} />
                    <span>סרוק חשבונית חדשה</span>
                </MotionButton>
            </div>

            <div className="flex-1 overflow-y-auto px-8 pb-32 no-scrollbar">
                {isLoading ? (
                    <div className="h-full flex items-center justify-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                    </div>
                ) : orders.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-6">
                        <div className="w-32 h-32 bg-slate-100 rounded-full flex items-center justify-center border-4 border-white shadow-inner">
                            <Truck size={64} />
                        </div>
                        <div className="text-center">
                            <span className="text-2xl font-black text-slate-400 block mb-2">אין משלוחים פעילים</span>
                            <span className="text-slate-400 font-bold">כל ההזמנות התקבלו או שטרם הוזמן מלאי חדש</span>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-12">
                        {orders.map((order) => (
                            <MotionButton
                                key={order.id}
                                onClick={() => onSelectOrder(order)}
                                whileHover={{ y: -4, shadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                                className="bg-white border border-slate-100 rounded-[2.5rem] p-8 text-right transition-all shadow-sm group relative overflow-hidden"
                            >
                                {/* Decorative Gradient Circle */}
                                <div className="absolute top-0 left-0 w-32 h-32 bg-slate-50 rounded-full -ml-12 -mt-12 transition-transform group-hover:scale-110" />

                                <div className="relative z-10">
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="flex flex-col items-start gap-1">
                                            <span className="text-2xl font-black text-slate-900 leading-tight">
                                                {order.supplier_name}
                                            </span>
                                            <div className="flex items-center gap-2 text-slate-400 font-bold text-xs uppercase tracking-wider">
                                                <Calendar size={14} />
                                                <span>נשלח בתאריך {new Date(order.created_at).toLocaleDateString('he-IL')}</span>
                                            </div>
                                        </div>
                                        <div className="bg-indigo-50 text-indigo-600 p-3 rounded-2xl group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                            <ArrowRight size={20} className="rotate-180" />
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        {order.items.slice(0, 3).map((item, idx) => (
                                            <div key={idx} className="flex justify-between items-center text-sm">
                                                <span className="font-bold text-slate-700">{item.name}</span>
                                                <span className="text-slate-500 font-medium">{item.qty} {item.unit}</span>
                                            </div>
                                        ))}
                                        {order.items.length > 3 && (
                                            <span className="text-xs text-indigo-500 font-black pt-2 block">
                                                +{order.items.length - 3} פריטים נוספים...
                                            </span>
                                        )}
                                    </div>

                                    <div className="mt-8 pt-6 border-t border-slate-50 flex justify-between items-center">
                                        <span className="bg-amber-100 text-amber-700 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-tighter shadow-sm">
                                            ממתין לקבלה
                                        </span>
                                        <div className="flex items-center gap-1 text-slate-400 font-bold text-xs">
                                            <Package size={14} />
                                            <span>#{String(order.id).slice(-6).toUpperCase()}</span>
                                        </div>
                                    </div>
                                </div>
                            </MotionButton>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default IncomingOrdersList;
