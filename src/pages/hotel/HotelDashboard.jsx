import React from 'react';
import { useHotelOrders } from '@/hooks/useHotelOrders';
import HotelRoomCard from '@/components/hotel/HotelRoomCard';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, Search, Filter } from 'lucide-react';

const HotelDashboard = () => {
    const { hotelOrders, isLoading, updateRoomStatus, toggleMaintenance } = useHotelOrders();

    // Separate orders into Active and Completed (Ready)
    const activeRooms = hotelOrders.filter(o => o.order_status !== 'ready');
    const completedRooms = hotelOrders.filter(o => o.order_status === 'ready');

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                    className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full"
                />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 p-8 pt-24" dir="rtl">
            {/* STICKY HEADER */}
            <header className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-b border-slate-200 z-50 px-8 py-4">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-600/20 text-white">
                            <Building2 size={24} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-slate-900">ניהול חדרים</h1>
                            <p className="text-sm font-bold text-slate-400">ישוב כוכב השחר - POC מלונאות</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input 
                                type="text" 
                                placeholder="חפש חדר או אורח..."
                                className="bg-slate-100 border-none rounded-2xl py-3 pr-11 pl-4 text-sm font-bold w-64 focus:ring-2 focus:ring-blue-500/20 transition-all"
                            />
                        </div>
                        <button className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-600 hover:bg-slate-50 transition-colors">
                            <Filter size={20} />
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12">
                
                {/* ACTIVE ROOMS SECTION */}
                <section>
                    <div className="flex items-center justify-between mb-8">
                        <h2 className="text-xl font-black text-slate-800 flex items-center gap-3">
                            חדרים לטיפול
                            <span className="bg-rose-100 text-rose-600 px-3 py-0.5 rounded-full text-xs">{activeRooms.length}</span>
                        </h2>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <AnimatePresence mode="popLayout">
                            {activeRooms.map(order => (
                                <HotelRoomCard 
                                    key={order.id}
                                    order={order}
                                    onUpdateTask={updateRoomStatus}
                                    onToggleMaintenance={toggleMaintenance}
                                />
                            ))}
                        </AnimatePresence>
                    </div>

                    {activeRooms.length === 0 && (
                        <div className="text-center py-20 bg-white rounded-[2rem] border-2 border-dashed border-slate-200">
                            <p className="font-bold text-slate-400 italic">כל החדרים מטופלים! ✨</p>
                        </div>
                    )}
                </section>

                {/* COMPLETED ROOMS SECTION */}
                <section>
                    <div className="flex items-center justify-between mb-8">
                        <h2 className="text-xl font-black text-slate-800 flex items-center gap-3">
                            חדרים מוכנים (Ready)
                            <span className="bg-emerald-100 text-emerald-600 px-3 py-0.5 rounded-full text-xs">{completedRooms.length}</span>
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 opacity-60 grayscale-[0.5] hover:opacity-100 hover:grayscale-0 transition-all duration-500">
                        <AnimatePresence mode="popLayout">
                            {completedRooms.map(order => (
                                <HotelRoomCard 
                                    key={order.id}
                                    order={order}
                                    onUpdateTask={updateRoomStatus}
                                    onToggleMaintenance={toggleMaintenance}
                                />
                            ))}
                        </AnimatePresence>
                    </div>
                </section>

            </main>
        </div>
    );
};

export default HotelDashboard;
