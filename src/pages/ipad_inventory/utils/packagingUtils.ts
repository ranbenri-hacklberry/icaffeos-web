import { PackagingLevel } from '@/pages/ipad_inventory/types';

/**
 * Convert a quantity at a given packaging level to base units.
 * e.g. convertToBase(3, 2, levels) where levels[2].qty=1000 → 3000
 */
export const convertToBase = (
    qty: number,
    levelIndex: number,
    levels: PackagingLevel[]
): number => qty * (levels[levelIndex]?.qty ?? 1);

/**
 * Convert base units to a quantity at a given packaging level.
 * e.g. convertFromBase(3000, 2, levels) where levels[2].qty=1000 → 3
 */
export const convertFromBase = (
    baseQty: number,
    levelIndex: number,
    levels: PackagingLevel[]
): number => baseQty / (levels[levelIndex]?.qty ?? 1);

/**
 * Get packaging levels from an inventory item, with fallback for items
 * that don't have the packaging JSON set.
 * 
 * Legacy support: items stored in grams/ml get a synthetic kg/L level so
 * the display doesn't show raw gram values.
 */
export const getPackagingLevels = (item: any): { levels: PackagingLevel[]; countLevel: number } => {
    // 1. If the item has the new packaging JSON, use it directly
    if (item?.packaging?.levels?.length) {
        return {
            levels: item.packaging.levels,
            countLevel: item.packaging.countLevel ?? 0
        };
    }

    // 2. Legacy fallback: reconstruct from old fields
    const rawUnit = (item?.base_unit || item?.unit || '').toLowerCase();
    const isGramBased = rawUnit.includes('גרם') || rawUnit === 'g' || rawUnit === 'grams';
    const isMlBased = rawUnit.includes('מ"ל') || rawUnit === 'ml';

    // Calculate legacy conversion factor (same logic as old InventoryItemCard)
    let conversionFactor = 1;
    let conversionSource: 'settings' | 'weight' | 'unit_fallback' | 'none' = 'none';
    const fromSettings = parseFloat(item?.settings?.conversion_factor);
    if (!isNaN(fromSettings) && fromSettings > 0) {
        conversionFactor = fromSettings;
        conversionSource = 'settings';
    } else {
        const fromWeight = parseFloat(item?.weight_per_unit);
        if (!isNaN(fromWeight) && fromWeight > 0) {
            conversionFactor = fromWeight;
            conversionSource = 'weight';
        } else if (isGramBased || isMlBased) {
            conversionFactor = 1000;
            conversionSource = 'unit_fallback';
        }
    }

    // No conversion needed — simple item
    if (conversionFactor <= 1) {
        const unitName = item?.display_unit || item?.unit || 'יח\'';
        const levels: PackagingLevel[] = [{ name: unitName, qty: 1 }];
        if (item?.case_quantity && item.case_quantity > 1) {
            levels.push({ name: 'מארז', qty: item.case_quantity });
        }
        return { levels, countLevel: 0 };
    }

    // Conversion exists → stock is stored in a small unit (grams/ml/etc.)
    // Base level = the small unit the stock is actually stored in
    const smallUnitName = isGramBased || conversionSource === 'weight' ? 'גרם' : (isMlBased ? 'מ"ל' : (item?.base_unit || 'גרם'));
    const levels: PackagingLevel[] = [{ name: smallUnitName, qty: 1 }];

    if (conversionSource === 'weight') {
        // weight_per_unit = grams per piece → add both piece level AND kg level
        const pieceName = item?.display_unit || item?.unit || 'יח\'';
        levels.push({ name: pieceName, qty: conversionFactor });
        // Also add ק"ג for convenience
        if (conversionFactor !== 1000) {
            levels.push({ name: 'ק"ג', qty: 1000 });
        }
    } else {
        // Direct gram→kg or ml→L or settings-based
        const displayName = item?.display_unit || item?.settings?.display_unit
            || (isGramBased ? 'ק"ג' : (isMlBased ? 'ליטר' : (item?.unit || 'יח\'')));
        levels.push({ name: displayName, qty: conversionFactor });
    }

    // Also add case level if applicable and not a duplicate
    if (item?.case_quantity && item.case_quantity > 1) {
        const alreadyExists = levels.some(l => l.qty === item.case_quantity);
        if (!alreadyExists) {
            levels.push({ name: 'מארז', qty: item.case_quantity });
        }
    }

    // Default count level: ק"ג (or the first display level) when conversion exists
    // For weight-based items with kg available, default to kg (last level or level with qty=1000)
    const kgLevelIdx = levels.findIndex(l => l.qty === 1000);
    const countLevel = kgLevelIdx >= 0 ? kgLevelIdx : 1;

    return { levels, countLevel };
};

/**
 * Sanitize a value for numeric DB columns.
 * Converts empty strings, null, undefined to a fallback value.
 */
export const sanitizeNumeric = (val: any, fallback: number | null = 0): number | null => {
    if (val === '' || val === null || val === undefined) return fallback;
    const parsed = parseFloat(val);
    return isNaN(parsed) ? fallback : parsed;
};
