// Utility function to shorten modifier names for display
export const shortenModifierName = (name) => {
    if (!name) return '';

    const str = String(name);

    // Foam modifiers - keep only "קצף" with arrow
    if (str.includes('הרבה קצף')) return 'קצף ↑';
    if (str.includes('מעט קצף')) return 'קצף ↓';
    if (str.includes('בלי קצף')) return 'ללא קצף';

    // Milk types
    if (str.includes('שיבולת שועל')) return 'שיבולת';

    // Return original if no match
    return str;
};
