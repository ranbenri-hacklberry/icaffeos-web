import { getSupabase } from '@/lib/supabase';

/**
 * Updates a single timestamp column in the 'orders' table.
 * @param {string} orderId - The ID of the order to update.
 * @param {'fired_at' | 'ready_at'} fieldName - The column name to set.
 */
export async function updateOrderTimestamp(orderId, fieldName, user) {
    // Use ISO format for precise timestamp saving
    const timestamp = new Date().toISOString();
    const updateData = {
        [fieldName]: timestamp,
        // Optional: Update general status for easier filtering
        order_status: fieldName === 'fired_at' ? 'fired' : (fieldName === 'ready_at' ? 'ready' : 'in_progress')
    };

    const client = getSupabase(user);

    const { data, error } = await client
        .from('orders')
        .update(updateData)
        .eq('id', orderId)
        .select();

    if (error) {
        console.error(`Error updating ${fieldName} for order ${orderId}:`, error);
        return { success: false, error };
    }
    return { success: true, data: data[0] };
}
