/**
 * Universal Modifier Parsing Utility
 * Handles transition from legacy relational tables to JSONB modifiers.
 */

import { fetchManagerItemOptions, normalizeOptionGroups } from '../lib/managerApi';
import { db } from '../db/database';

/**
 * Normalization Precedence Rules (Hebrew):
 * 1. שדה modifiers (JSONB): אם קיים ואינו ריק, הוא נחשב למקור האמת (Source of Truth).
 * 2. טבלאות מקושרות (menu_item_options): ברירת מחדל לפריטים ישנים (מורשת).
 * 3. החזרה של מערך ריק: אם לא נמצאו תוספות בשום צורה.
 */

/**
 * normalizes modifiers for any given item
 * @param {Object} item - The product item object
 * @returns {Promise<Array>} Normalized array of modifier groups
 */
export const getNormalizedModifiers = async (item) => {
    if (!item) return [];

    // Priority 1: New JSONB blob (Direct from item object)
    if (item.modifiers && Array.isArray(item.modifiers) && item.modifiers.length > 0) {
        console.log('💎 getNormalizedModifiers: Using JSONB source for', item.name);
        return normalizeOptionGroups(item.modifiers);
    }

    // Priority 2: Dexie Fallback (Check if Dexie has the modifiers field)
    try {
        const localItem = await db.menu_items.get(String(item.id));
        if (localItem?.modifiers && Array.isArray(localItem.modifiers) && localItem.modifiers.length > 0) {
            console.log('💾 getNormalizedModifiers: Using Dexie JSONB source for', item.name);
            return normalizeOptionGroups(localItem.modifiers);
        }
    } catch (err) {
        console.warn('⚠️ getNormalizedModifiers: Dexie lookup failed', err);
    }

    // Priority 3: Legacy Relational Tables (Aggregation)
    console.log('🕰️ getNormalizedModifiers: Falling back to legacy relational tables for', item.name);
    return await fetchManagerItemOptions(item.id, item.business_id);
};
