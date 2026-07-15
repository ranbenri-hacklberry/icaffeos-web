/**
 * Driver Page
 * Simplified view for delivery drivers
 * Shows 'ready' (Pickup) and 'shipped' (En Route) tabs
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useOrders } from '@/hooks/useOrders';
import OrderCard from '@/pages/kds/components/OrderCard';
import {
    ArrowRight, Truck, RefreshCw, AlertTriangle, Package
} from 'lucide-react';

export default function DriverPage() {
    const navigate = useNavigate();
    const { currentUser: user } = useAuth();
    const [hasAccess, setHasAccess] = useState(true);
    const [activeTab, setActiveTab] = useState('ready'); // 'ready' | 'shipped'

    // Get ALL delivery orders (Client-side filtering is safer for now)
    const {
        ordersByStatus,
        isLoading,
        updateStatus,
        refresh
    } = useOrders({
        businessId: user?.business_id,
        filters: {
            // No strict filters for now to ensure visibility across all order types
        }
    });

    // Filter orders for the current driver (Client Side)
    const myOrders = useMemo(() => {
        const ready = ordersByStatus.ready || [];
        const shipped = ordersByStatus.shipped || [];

        // Currently showing all orders. Can re-enable filtering here if needed:
        // const isMyOrder = (o) => o.driver_id === user?.id || o.driver_name === user?.name;

        return { ready, shipped };
    }, [ordersByStatus, user]);

    const currentList = myOrders[activeTab] || [];
    const totalReady = myOrders.ready.length;
    const totalShipped = myOrders.shipped.length;

    // Check driver access
    useEffect(() => {
        setHasAccess(true);
    }, [user]);

    // Handle status update
    const handleStatusUpdate = async (orderId, newStatus) => {
        await updateStatus(orderId, newStatus);
    };

    // Access denied screen
    if (!hasAccess) {
        return (
            <div className="h-screen flex items-center justify-center bg-gray-100 font-heebo" dir="rtl">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertTriangle size={32} className="text-red-500" />
                    </div>
                    <h2 className="text-xl font-black text-gray-800 mb-2">אין גישה</h2>
                    <p className="text-gray-600 mb-6">אין לך הרשאות נהג משלוחים.</p>
                    <button onClick={() => navigate('/mode-selection')} className="px-6 py-3 bg-gray-900 text-white rounded-xl font-bold">חזור</button>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen flex flex-col bg-gray-900 font-heebo" dir="rtl">
            {/* Header */}
            <header className="bg-gray-800 px-4 py-3 pb-6 flex flex-col gap-4 shrink-0 shadow-lg z-10">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate('/mode-selection')}
                            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-xl transition-colors"
                        >
                            <ArrowRight size={24} />
                        </button>
                        <div className="flex items-center gap-2">
                            <Truck size={24} className="text-purple-400" />
                            <h1 className="text-xl font-black text-white">מסך נהג</h1>
                        </div>
                    </div>

                    <button
                        onClick={refresh}
                        disabled={isLoading}
                        className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-xl transition-colors disabled:opacity-50"
                    >
                        <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} />
                    </button>
                </div>

                {/* Tabs / Stats Buttons */}
                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={() => setActiveTab('ready')}
                        className={`relative p-3 rounded-xl border-2 transition-all flex items-center justify-between overflow-hidden ${activeTab === 'ready'
                            ? 'bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-900/20'
                            : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                            }`}
                    >
                        <div className="flex flex-col items-start z-10">
                            <span className="text-xs font-bold opacity-80">לאיסוף מלקט</span>
                            <span className="text-2xl font-black">{totalReady}</span>
                        </div>
                        <Package size={32} className={`z-10 ${activeTab === 'ready' ? 'opacity-100' : 'opacity-20'}`} />
                        {activeTab === 'ready' && (
                            <div className="absolute -right-2 -bottom-4 w-20 h-20 bg-white/10 rounded-full blur-xl" />
                        )}
                    </button>

                    <button
                        onClick={() => setActiveTab('shipped')}
                        className={`relative p-3 rounded-xl border-2 transition-all flex items-center justify-between overflow-hidden ${activeTab === 'shipped'
                            ? 'bg-purple-600 border-purple-600 text-white shadow-lg shadow-purple-900/20'
                            : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                            }`}
                    >
                        <div className="flex flex-col items-start z-10">
                            <span className="text-xs font-bold opacity-80">בדרך ליעד</span>
                            <span className="text-2xl font-black">{totalShipped}</span>
                        </div>
                        <Truck size={32} className={`z-10 ${activeTab === 'shipped' ? 'opacity-100' : 'opacity-20'}`} />
                        {activeTab === 'shipped' && (
                            <div className="absolute -right-2 -bottom-4 w-20 h-20 bg-white/10 rounded-full blur-xl" />
                        )}
                    </button>
                </div>
            </header>

            {/* Main Content List */}
            <main className="flex-1 overflow-y-auto bg-gray-900 p-4">
                {isLoading && currentList.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-gray-500 flex-col gap-3">
                        <RefreshCw className="animate-spin" />
                        <span>טוען...</span>
                    </div>
                ) : currentList.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-600 gap-4 opacity-50">
                        {activeTab === 'ready' ? <Package size={48} /> : <Truck size={48} />}
                        <span className="font-bold text-lg">אין הזמנות {activeTab === 'ready' ? 'לאיסוף' : 'בדרך'}</span>
                    </div>
                ) : (
                    <div className="space-y-4 pb-20">
                        {currentList.map(order => (
                            <OrderCard
                                key={order.id}
                                order={order}
                                isKanban={false} // Use standard mode but with driver props
                                isDriverView={true}
                                onOrderStatusUpdate={handleStatusUpdate}
                            />
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
