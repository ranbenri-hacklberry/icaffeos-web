/**
 * Centralized configuration for task categories and their aliases.
 * This ensures consistency between the Manager Dashboard and the Prep Screen.
 */
export const TASK_CATEGORIES = {
    OPENING: {
        id: 'opening',
        db_id: 'opening',
        label: 'פתיחה',
        aliases: ['פתיחה', 'opening', 'morning', 'בוקר']
    },
    PREP: {
        id: 'prep',
        db_id: 'pre_closing', // Manager tab ID for prep
        label: 'משימות',
        aliases: ['prep', 'הכנה', 'הכנות', 'mid', 'משימות']
    },
    CLOSING: {
        id: 'closing',
        db_id: 'closing',
        label: 'סגירה',
        aliases: ['סגירה', 'closing', 'evening', 'night', 'לילה']
    }
};

/**
 * Checks if a given task category name matches a target category ID or alias.
 */
export const isCategoryMatch = (targetId, taskCategoryName) => {
    const lowerName = (taskCategoryName || '').toLowerCase();

    // Find category by ID or db_id
    const category = Object.values(TASK_CATEGORIES).find(
        cat => cat.id === targetId || cat.db_id === targetId
    );

    if (!category) return false;
    return category.aliases.includes(lowerName);
};

/**
 * Returns all aliases for a specific category ID.
 */
export const getCategoryAliases = (id) => {
    const category = Object.values(TASK_CATEGORIES).find(
        cat => cat.id === id || cat.db_id === id
    );
    return category ? category.aliases : [];
};

/**
 * Normalizes a category name from the database to a standard internal ID.
 */
export const normalizeCategory = (dbCategory) => {
    const lower = (dbCategory || '').toLowerCase();
    for (const cat of Object.values(TASK_CATEGORIES)) {
        if (cat.aliases.includes(lower)) return cat.id;
    }
    return 'other';
};
