import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import { supabase } from '@/lib/supabase';

// --- TYPES FOR HOTEL POC ---

export interface HotelTask {
    id: string;
    label: string;
    status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
    assignedTo?: string;
    updatedAt?: string;
}

export interface HotelOrder {
    id: string;
    order_number: number;
    order_status: 'new' | 'in_progress' | 'ready' | 'completed' | 'cancelled';
    metadata: {
        is_hotel: boolean;
        room_number: string | number;
        guest_id?: string;
        guest_name?: string;
        cleaning_type?: 'standard' | 'deep' | 'express';
    };
    items: HotelTask[];
    created_at: string;
    updated_at: string;
    business_id: string;
}

/**
 * useHotelOrders - Specialized hook for the Hotel Management POC.
 * Integrates local Dexie persistence with Supabase RPC for atomic "State Machine" transitions.
 */
export const useHotelOrders = () => {

    // 📊 DATA SOURCE: useLiveQuery monitors the local Dexie store for real-time reactive updates
    const hotelOrders = useLiveQuery(async () => {
        // 🔍 FILTERING LOGIC: Only fetch orders flagged as hotel orders in metadata
        const orders = await db.orders
            .filter((order: any) => order.metadata?.is_hotel === true)
            .toArray();

        // 🏗️ SORTING & MAPPING: 
        // 1. Sort by room_number (alphanumeric/natural sort)
        // 2. Secondary sort by last updated time (newest first)
        return orders.sort((a: any, b: any) => {
            const roomA = String(a.metadata?.room_number || '').padStart(5, '0');
            const roomB = String(b.metadata?.room_number || '').padStart(5, '0');

            if (roomA !== roomB) {
                return roomA.localeCompare(roomB, undefined, { numeric: true });
            }

            const timeA = new Date(a.updated_at || a.created_at).getTime();
            const timeB = new Date(b.updated_at || b.created_at).getTime();
            return timeB - timeA;
        }) as HotelOrder[];
    }, []);

    /**
     * updateRoomStatus - Atomic "State Machine" transition.
     * Updates a single task within the JSONB array without overriding other data.
     * 
     * @param orderId - The UUID of the order (Room)
     * @param taskId - The unique ID of the task inside the items array
     * @param newStatus - The new status (pending/completed/etc)
     */
    const updateRoomStatus = async (orderId: string, taskId: string, newStatus: string) => {
        try {
            console.log(`🏨 [HotelOrders] Transitioning task ${taskId} to ${newStatus}...`);

            // 🚀 Call the Security Definer RPC
            // This ensures logic like "if all tasks done -> set order to Ready" happens on the server.
            const { data, error } = await supabase.rpc('update_room_task_status', {
                p_order_id: orderId,
                p_task_id: taskId,
                p_new_status: newStatus
            });

            if (error) throw error;

            console.log('✅ [HotelOrders] Server transition successful:', data);

            // 🔄 REALTIME SYNC:
            // We do NOT manually update Dexie here. 
            // The existing sync engine is expected to receive the webhook/broadcast 
            // from Supabase and update the local store immediately.

            return { success: true, data };
        } catch (err) {
            console.error('❌ [HotelOrders] Transition failed:', err);
            return { success: false, error: err };
        }
    };

    /**
     * toggleMaintenance - Toggles the maintenance flag on a room.
     */
    const toggleMaintenance = async (orderId: string) => {
        try {
            const { data, error } = await supabase.rpc('toggle_room_maintenance', {
                p_order_id: orderId
            });
            if (error) throw error;
            return { success: true, data };
        } catch (err) {
            console.error('❌ [HotelOrders] Toggle maintenance failed:', err);
            return { success: false, error: err };
        }
    };

    return {
        hotelOrders: hotelOrders || [],
        isLoading: hotelOrders === undefined,
        updateRoomStatus,
        toggleMaintenance
    };
};
