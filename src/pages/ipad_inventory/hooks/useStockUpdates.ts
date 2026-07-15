import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export const useStockUpdates = () => {
    const [isUpdating, setIsUpdating] = useState(false);

    const updateStock = async (itemId: string, newStock: number, userId?: string, source: string = 'manual') => {
        setIsUpdating(true);
        try {
            const { data, error } = await supabase.rpc('update_inventory_stock', {
                p_item_id: itemId,
                p_new_stock: newStock,
                p_counted_by: userId || null,
                p_source: source
            });

            if (error) throw error;
            return { success: true, data };
        } catch (err: any) {
            console.error('Error updating stock:', err);
            return { success: false, error: err.message };
        } finally {
            setIsUpdating(false);
        }
    };

    return { updateStock, isUpdating };
};
