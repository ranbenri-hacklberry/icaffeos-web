export const isDrink = (item) => {
    const cat = (item.category || '').toLowerCase();
    return cat.includes('שתיה') || cat.includes('drink') || cat.includes('coffee') || cat.includes('קפה');
};

export const isHotDrink = (item) => {
    const cat = (item.category || '').toLowerCase();
    return isDrink(item) && (cat.includes('חמה') || cat.includes('hot'));
};

/**
 * Unified Preparation Requirement Check
 * STRICTLY based on DB / settings (inclusive of coffee data)
 */
export const isKitchenPrep = (item) => {
    if (!item) return false;
    return (
        item.kds_override ||
        item.mods?.kds_override ||
        item.kds_routing_logic === 'MADE_TO_ORDER' ||
        (typeof item.kds_routing_logic === 'string' && item.kds_routing_logic.includes('routeTo')) ||
        item.is_hot_drink === true ||
        item.category === 'שתיה חמה' ||
        item.db_category === 'שתיה חמה' ||
        item.category === 'hot-drinks' ||
        item.inventory_settings?.preparationMode === 'requires_prep' ||
        (Array.isArray(item.selectedOptions) && item.selectedOptions.some(o => o.valueId === 'prep'))
    );
};

export const sortItems = (items) => {
    return [...items].sort((a, b) => {
        // ⚠️ CRITICAL: NO status-based sorting!
        // Items must NOT jump positions when marked as ready/completed
        // This prevents confusing the barista mid-service

        const aHot = isHotDrink(a);
        const bHot = isHotDrink(b);
        const aDrink = isDrink(a);
        const bDrink = isDrink(b);

        // 1. Hot drinks first (they need to be made fresh)
        if (aHot && !bHot) return -1;
        if (!aHot && bHot) return 1;

        // 2. Cold drinks second
        if (aDrink && !bDrink) return -1;
        if (!aDrink && bDrink) return 1;

        // 3. Food last - preserve original order
        return 0;
    });
};

export const getModColor = (text) => {
    if (!text) return 'mod-color-gray';
    const t = String(text).toLowerCase().trim();

    // Foam Specifics (Priority)
    if (t.includes('בלי קצף') || t.includes('ללא קצף')) return 'mod-color-foam-none';
    if (t.includes('פחות קצף') || t.includes('מעט קצף')) return 'mod-color-foam-down';
    if (t.includes('הרבה קצף') || t.includes('אקסטרה קצף')) return 'mod-color-foam-up';

    // הסרות / בלי
    if (t.includes('בלי') || t.includes('ללא') || t.includes('הורד'))
        return 'mod-color-red';

    // תוספות / אקסטרה / בצד
    if (t.includes('תוספת') || t.includes('אקסטרה') || t.includes('בצד') || t.includes('קצף'))
        return 'mod-color-lightgreen';

    // סוגי חלב
    if (t.includes('סויה') || t.includes('שיבולת שועל') || t.includes('שיבולת'))
        return 'mod-color-soy-oat';
    if (t.includes('שקדים'))
        return 'mod-color-almond';
    if (t.includes('נטול') || t.includes('דקף') || t.includes('ללא לקטוז'))
        return 'mod-color-lactose-free';

    // טמפרטורה וחוזק
    if (t.includes('רותח') || t.includes('חם מאוד'))
        return 'mod-color-extra-hot';
    if (t.includes('חזק') || t.includes('כפול'))
        return 'mod-color-strong';
    if (t.includes('חלש') || t.includes('קל'))
        return 'mod-color-light';

    return 'mod-color-gray';
};

export const shortenKdsMod = (name) => {
    if (!name) return '';
    const s = String(name);
    if (s.includes('חצי חלב חצי מים')) return 'חצי-חצי';
    if (s.includes('נטול קפאין')) return 'נטול';
    if (s.includes('דל שומן')) return 'דל';
    if (s.includes('שיבולת שועל')) return 'שיבולת';
    if (s.includes('חלב שקדים')) return 'שקדים';
    if (s.includes('חלב סויה')) return 'סויה';
    return s;
};

export const groupOrderItems = (items) => {
    if (!items || items.length === 0) return [];

    const grouped = [];
    const map = new Map();

    items.forEach((item, originalIndex) => {
        // ⚠️ CRITICAL: Key does NOT include status or is_early_delivered!
        // This ensures items stay in place when marked as ready
        // מפתח ייחודי: ID המנה + מחרוזת המודים בלבד
        const courseKey = item.course_stage || 1;
        const key = `${item.menuItemId}|${item.modsKey || ''}|course-${courseKey}`;

        if (map.has(key)) {
            const existing = map.get(key);
            existing.quantity += item.quantity;
            existing.ids.push(item.id);
            existing.totalPrice += item.price * item.quantity;
            // Keep the most "advanced" status and early delivered flag
            if (item.is_early_delivered) existing.is_early_delivered = true;
            if (item.early_delivered_at) existing.early_delivered_at = item.early_delivered_at;
            // Keep lowest ID for stable sorting
            if (String(item.id) < String(existing._firstId)) {
                existing._firstId = item.id;
            }
        } else {
            const newItem = {
                ...item,
                ids: [item.id],
                totalPrice: item.price * item.quantity,
                _firstId: item.id // First ID for stable sorting
            };
            map.set(key, newItem);
            grouped.push(newItem);
        }
    });

    // ⚠️ CRITICAL: Sort by first item ID to ensure STABLE order across refreshes
    // Without this, items may appear in different order each time data comes from server
    return grouped.sort((a, b) => String(a._firstId).localeCompare(String(b._firstId)));
};
