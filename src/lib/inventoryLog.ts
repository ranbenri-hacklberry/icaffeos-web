import { supabase } from '@/lib/supabase';

export type InventoryActionType = 'manual_count' | 'order_receipt' | 'order_deduction' | 'waste';

/**
 * Logs an inventory action to the inventory_logs table.
 * @param itemId The ID of the inventory item
 * @param previousStock The stock quantity before the change
 * @param newStock The stock quantity after the change
 * @param actionType The type of action performed
 * @param performedBy The name or ID of the user performing the action (optional)
 * @param notes Any additional notes (optional)
 * @param quantityChange The delta (optional, calculated if not provided)
 */
export const logInventoryAction = async (
    itemId: string | number,
    previousStock: number,
    newStock: number,
    actionType: InventoryActionType,
    performedBy?: string, // This should be user UUID
    notes?: string,
    quantityChange?: number,
    businessId?: string
) => {
    try {
        const change = quantityChange ?? (newStock - previousStock);

        // Map frontend action type to DB log_type/transaction_type
        const logType = actionType === 'order_receipt' ? 'RECEIPT' :
            actionType === 'waste' ? 'WASTE' : 'ADJUSTMENT';
        const transactionType = change >= 0 ? 'IN' : 'OUT';

        // Auto-fetch business_id if missing
        let bId = businessId;
        if (!bId) {
            const { data: item } = await supabase.from('inventory_items').select('business_id').eq('id', itemId).single();
            bId = item?.business_id;
        }

        const { error } = await supabase
            .from('inventory_logs')
            .insert({
                inventory_item_id: itemId,
                transaction_type: transactionType,
                log_type: logType,
                quantity: Math.abs(change),
                physical_count: newStock,
                system_estimate: previousStock,
                variance: change,
                created_by: performedBy && performedBy.length > 30 ? performedBy : null, // Only UUID
                notes: notes || `Performed by: ${performedBy}`,
                business_id: bId,
                created_at: new Date().toISOString()
            });

        if (error) {
            console.error('Failed to log inventory action:', error);
        }
    } catch (err) {
        console.error('Error logging inventory action:', err);
    }
};
