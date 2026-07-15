import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { IncomingOrder } from '@/pages/ipad_inventory/types';

export const useIncomingOrders = (businessId?: string) => {
    const [orders, setOrders] = useState<IncomingOrder[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchOrders = useCallback(async () => {
        if (!businessId) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .rpc('get_my_supplier_orders', { p_business_id: businessId });

            if (error) throw error;

            const formatted = (data || [])
                .filter((order: any) => order.status !== 'received' && order.delivery_status !== 'arrived')
                .map((order: any) => ({
                    id: order.id,
                    created_at: order.created_at,
                    supplier_name: order.supplier_name || 'ספק כללי',
                    items: order.items || []
                }))
                .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
            setOrders(formatted);
        } catch (err) {
            console.error('Error fetching orders:', err);
        } finally {
            setLoading(false);
        }
    }, [businessId]);

    useEffect(() => {
        fetchOrders();
    }, [fetchOrders]);

    return { orders, loading, refresh: fetchOrders };
};
