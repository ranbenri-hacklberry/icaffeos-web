/**
 * Order Tracking Page
 * Public page for customers to track their order status
 * Uses UUID in URL for security (not order_number)
 */

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import {
    Package, Clock, ChefHat, CheckCircle, Truck,
    Home, RefreshCw, MapPin, Phone
} from 'lucide-react';

// Status steps for timeline
const STATUS_STEPS = [
    { key: 'new', label: 'התקבלה', icon: Package },
    { key: 'pending', label: 'מאושרת', icon: Clock },
    { key: 'in_prep', label: 'בהכנה', icon: ChefHat },
    { key: 'ready', label: 'מוכנה', icon: CheckCircle },
    { key: 'shipped', label: 'בדרך אליך', icon: Truck },
    { key: 'delivered', label: 'נמסרה', icon: Home }
];

export default function OrderTrackingPage() {
    const { id } = useParams(); // UUID from URL
    const [order, setOrder] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // Fetch order by UUID
    useEffect(() => {
        if (!id) {
            setError('מזהה הזמנה חסר');
            setIsLoading(false);
            return;
        }

        const fetchOrder = async () => {
            setIsLoading(true);
            try {
                const { data, error: fetchError } = await supabase
                    .from('orders')
                    .select('id, order_number, order_status, order_type, customer_name, total_amount, created_at, updated_at, delivery_address, is_paid')
                    .eq('id', id)
                    .single();

                if (fetchError) throw fetchError;
                setOrder(data);
            } catch (err) {
                console.error('Order fetch error:', err);
                setError('ההזמנה לא נמצאה');
            } finally {
                setIsLoading(false);
            }
        };

        fetchOrder();

        // Subscribe to real-time updates
        const channel = supabase
            .channel(`order-tracking-${id}`)
            .on('postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` },
                (payload) => {
                    setOrder(prev => ({ ...prev, ...payload.new }));
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [id]);

    // Get current step index
    const getCurrentStepIndex = () => {
        if (!order) return 0;
        return STATUS_STEPS.findIndex(s => s.key === order.order_status) || 0;
    };

    const currentStepIndex = getCurrentStepIndex();

    // Loading state
    if (isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center font-heebo" dir="rtl">
                <div className="flex flex-col items-center gap-4">
                    <RefreshCw size={40} className="animate-spin text-blue-500" />
                    <span className="text-gray-600 font-bold">טוען הזמנה...</span>
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-red-50 to-white flex items-center justify-center font-heebo" dir="rtl">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
                    <div className="text-6xl mb-4">😕</div>
                    <h2 className="text-xl font-black text-gray-800 mb-2">{error}</h2>
                    <p className="text-gray-600">
                        נסה לבדוק את הקישור או פנה לעסק
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white font-heebo" dir="rtl">
            {/* Header */}
            <header className="bg-white shadow-sm border-b border-gray-100 px-4 py-4">
                <div className="max-w-lg mx-auto text-center">
                    <h1 className="text-lg font-black text-gray-800">מעקב הזמנה</h1>
                    <p className="text-sm text-gray-500">הזמנה #{order?.order_number}</p>
                </div>
            </header>

            <main className="max-w-lg mx-auto p-4 pt-8">
                {/* Status Card */}
                <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
                    <div className="text-center mb-8">
                        <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-4 ${order.order_status === 'delivered'
                                ? 'bg-green-100 text-green-600'
                                : 'bg-blue-100 text-blue-600'
                            }`}>
                            {React.createElement(STATUS_STEPS[currentStepIndex]?.icon || Package, { size: 40 })}
                        </div>
                        <h2 className="text-2xl font-black text-gray-800 mb-1">
                            {STATUS_STEPS[currentStepIndex]?.label || 'בתהליך'}
                        </h2>
                        {order.customer_name && (
                            <p className="text-gray-600">שלום, {order.customer_name}!</p>
                        )}
                    </div>

                    {/* Timeline */}
                    <div className="relative">
                        {STATUS_STEPS.map((step, idx) => {
                            const isCompleted = idx <= currentStepIndex;
                            const isCurrent = idx === currentStepIndex;
                            const StepIcon = step.icon;

                            return (
                                <div key={step.key} className="flex items-start gap-4 mb-4 last:mb-0">
                                    {/* Icon */}
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isCompleted
                                            ? (isCurrent ? 'bg-blue-500 text-white' : 'bg-green-500 text-white')
                                            : 'bg-gray-100 text-gray-400'
                                        }`}>
                                        <StepIcon size={20} />
                                    </div>

                                    {/* Label */}
                                    <div className={`flex-1 pt-2 ${isCompleted ? 'text-gray-800' : 'text-gray-400'}`}>
                                        <span className={`font-bold ${isCurrent ? 'text-blue-600' : ''}`}>
                                            {step.label}
                                        </span>
                                    </div>

                                    {/* Checkmark */}
                                    {isCompleted && !isCurrent && (
                                        <CheckCircle size={20} className="text-green-500 mt-2" />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Delivery Address (for delivery orders) */}
                {order.order_type === 'delivery' && order.delivery_address && (
                    <div className="bg-white rounded-2xl shadow-lg p-4 mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                                <MapPin size={20} className="text-purple-600" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 font-bold">כתובת למשלוח</p>
                                <p className="text-gray-800 font-bold">{order.delivery_address}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Order Summary */}
                <div className="bg-white rounded-2xl shadow-lg p-4">
                    <div className="flex justify-between items-center">
                        <span className="text-gray-600">סה״כ לתשלום</span>
                        <span className="text-2xl font-black text-gray-800">
                            ₪{order.total_amount?.toFixed(2) || '0.00'}
                        </span>
                    </div>
                    {order.is_paid && (
                        <div className="mt-2 text-center">
                            <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-bold">
                                ✓ שולם
                            </span>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
