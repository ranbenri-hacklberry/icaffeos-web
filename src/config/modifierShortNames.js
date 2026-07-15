
// Map of common modifier names to short 2-3 char abbreviations
// Colors: 'blue', 'green', 'red', 'yellow', 'purple', 'gray', 'pink', 'indigo'

export const modifierAliases = {
    // Milk Types
    "חלב רגיל": "רגיל",
    "חלב דל שומן": "חלב דל",
    "חלב סויה": "סויה",
    "חלב שקדים": "שקדים",
    "חלב שיבולת שועל": "שיבולת",
    "חלב שיבולת": "שיבולת",
    "חלב אורז": "אורז",
    "בלי חלב": "בלי חלב",
    "מעט חלב": "מעט חלב",
    "חלב בצד": "חלב בצד",

    // Coffee/Drink Specs
    "חזק": "חזק",
    "חלש": "חלש",
    "בלי קצף": "בלי קצף",
    "הרבה קצף": "הרבה קצף",
    "פושר": "פושר",
    "רותח": "רותח",
    "קר": "קר",
    "בלי קרח": "בלי קרח",

    // Extras
    "תוספת קצפת": "קצפת",
    "בלי סוכר": "בלי סוכר",
    "סוכר חום": "סוכר חום",
    "סליל": "סליל",

    // Food
    "בלי בצל": "בלי בצל",
    "בלי עגבניה": "בלי עגבניה",
    "תוספת גבינה": "תוספת גבינה",
    "לחם בצד": "לחם בצד",
    "חיטה מלאה": "מלאה",
    "ללא גלוטן": "לל״ג"
};

export const modifierColors = {
    // Milk -> Blue/Cyan variations
    "רגיל": "bg-blue-100 text-blue-800 border-blue-200",
    "דל": "bg-cyan-100 text-cyan-800 border-cyan-200",
    "סויה": "bg-orange-100 text-orange-800 border-orange-200", // Soy = Orange usually
    "שקד": "bg-amber-100 text-amber-800 border-amber-200",
    "ש״ש": "bg-yellow-100 text-yellow-800 border-yellow-200", // Oat = Yellow/Wheat

    // Temp/Strength -> Red/Gray
    "רותח": "bg-red-100 text-red-800 border-red-200",
    "חזק": "bg-slate-800 text-white border-slate-900",
    "חלש": "bg-gray-100 text-gray-600 border-gray-200",

    // Default
    "default": "bg-slate-100 text-slate-700 border-slate-200"
};

export const getShortName = (fullName) => {
    if (!fullName) return '';
    // Direct aliasing
    if (modifierAliases[fullName]) return modifierAliases[fullName];

    // If simplified/aliased name is passed directly
    const reversed = Object.entries(modifierAliases).find(([k, v]) => v === fullName);
    if (reversed) return fullName;

    // 🛑 CRITICAL: DO NOT TRUNCATE NOTES OR NAMES.
    // Kitchen staff must see the FULL text for free-form instructions.
    return fullName;
};

export const getModColorClass = (fullName, shortName) => {
    // Priority 1: Check full name map
    // Priority 2: Check short name map
    const key = shortName || fullName;
    if (modifierColors[key]) return modifierColors[key];

    // Heuristic coloring
    if (key.includes('חלב')) return modifierColors["רגיל"];
    if (key.includes('בלי')) return "bg-red-50 text-red-600 border-red-100 line-through decoration-red-400";

    return modifierColors["default"];
};
