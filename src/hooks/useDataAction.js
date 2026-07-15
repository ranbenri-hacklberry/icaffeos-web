/**
 * useDataAction Hook
 * 
 * A generic hook for Local-First data operations.
 * 
 * Pattern:
 * 1. Generate ID locally (UUID)
 * 2. Optimistic Update: Write to Dexie immediately
 * 3. Queue Action: Add to offline_queue for background sync
 * 
 * This ensures the UI is always fast and works offline.
 * 
 * @module hooks/useDataAction
 */

import { db } from '@/db/database';
import { v4 as uuidv4 } from 'uuid';

export const useDataAction = () => {

    /**
     * Create a new record
     * @param {string} table - Dexie table name (e.g., 'orders', 'menu_items')
     * @param {Object} data - The data to insert
     * @returns {Promise<Object>} The created record with ID
     */
    const create = async (table, data) => {
        // 1. Prepare record with UUID and local metadata
        const id = data.id || uuidv4();
        const timestamp = new Date().toISOString();

        const record = {
            ...data,
            id,
            created_at: data.created_at || timestamp,
            updated_at: timestamp,
            // Local-first metadata
            _localUpdatedAt: timestamp,
            _pendingSync: true,
            _syncError: null
        };

        // 2. Optimistic Write to Dexie
        await db[table].put(record);
        console.log(`⚡ [Local-First] Created in ${table}:`, id);

        // 3. Queue for Background Sync
        await db.offline_queue_v2.add({
            type: 'CREATE',
            table,
            recordId: id,
            payload: record, // Full payload for creation
            status: 'pending',
            createdAt: timestamp,
            retries: 0
        });

        return record;
    };

    /**
     * Update an existing record
     * @param {string} table - Dexie table name
     * @param {string} id - Record ID
     * @param {Object} changes - Valid changes
     * @returns {Promise<Object>} The updated record
     */
    const update = async (table, id, changes) => {
        // 1. specific logic to ensure we don't partial update if record missing
        const currentCheck = await db[table].get(id);
        if (!currentCheck) {
            console.warn(`⚠️ Cannot update ${table}/${id} - not found locally`);
            throw new Error(`Record ${id} not found locally`);
        }

        const timestamp = new Date().toISOString();

        // 2. Prepare update payload
        const updates = {
            ...changes,
            updated_at: timestamp,
            _localUpdatedAt: timestamp,
            _pendingSync: true,
            _syncError: null
        };

        // 3. Optimistic Write to Dexie
        await db[table].update(id, updates);
        console.log(`⚡ [Local-First] Updated ${table}/${id}`);

        // 4. Queue for Background Sync
        await db.offline_queue_v2.add({
            type: 'UPDATE',
            table,
            recordId: id,
            payload: changes, // Only send changes
            status: 'pending',
            createdAt: timestamp,
            retries: 0
        });

        // Return updated object
        return { ...currentCheck, ...updates };
    };

    /**
     * Delete a record
     * @param {string} table - Dexie table name
     * @param {string} id - Record ID
     */
    const remove = async (table, id) => {
        const timestamp = new Date().toISOString();

        // 1. Optimistic Delete (Soft delete might be better, but we'll do hard delete locally)
        // Note: For complex sync, sometimes we keep "tombstones", but here we trust the queue.
        await db[table].delete(id);
        console.log(`⚡ [Local-First] Deleted from ${table}:`, id);

        // 2. Add to offline queue
        await db.offline_queue_v2.add({
            type: 'DELETE',
            table,
            recordId: id,
            status: 'pending',
            createdAt: timestamp,
            retries: 0
        });
    };

    return { create, update, remove };
};

export default useDataAction;
