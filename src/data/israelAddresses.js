/**
 * Mitzpe Ramon Streets - Bilingual (Hebrew + English)
 * For address autocomplete - supports both Hebrew and English search
 */

// Each street has both Hebrew and English names for bilingual search
export const MITZPE_RAMON_STREETS = [
    // Boulevards & Main Roads
    { he: 'שדרות דוד בן גוריון', en: 'David Ben Gurion Boulevard' },
    { he: 'שדרות קק"ל', en: 'KKL Boulevard' },
    { he: 'דרך רמון', en: 'Ramon Way' },
    { he: 'דרך בראשית', en: 'Beresheet Way' },
    { he: 'שדרות הר הגמל', en: 'Har HaGamel Boulevard' },

    // Har (Mountain) Streets
    { he: 'הר בוקר', en: 'Har Boker' },
    { he: 'הר ארדון', en: 'Har Ardon' },
    { he: 'הר עודד', en: 'Har Oded' },
    { he: 'הר שגי', en: 'Har Sagi' },
    { he: 'הר עריף', en: 'Har Arif' },
    { he: 'הר צין', en: 'Har Tzin' },
    { he: 'הר נפחא', en: 'Har Nefha' },
    { he: 'הר אלדד', en: 'Har Eldad' },
    { he: 'הר קטום', en: 'Har Katum' },
    { he: 'הר חמת', en: 'Har Hamat' },
    { he: 'הר קירטון', en: 'Har Kirton' },

    // Nahal (Stream) Streets
    { he: 'נחל ציה', en: 'Nahal Tzia' },
    { he: 'נחל גרופית', en: 'Nahal Grofit' },
    { he: 'נחל מישר', en: 'Nahal Meshar' },
    { he: 'נחל צאלים', en: 'Nahal Tzalim' },
    { he: 'נחל ציהור', en: 'Nahal Tzihor' },
    { he: 'נחל ערבה', en: 'Nahal Arava' },
    { he: 'נחל נקרות', en: 'Nahal Nekarot' },
    { he: 'נחל ערוד', en: 'Nahal Arod' },
    { he: 'נחל חוה', en: 'Nahal Havvah' },
    { he: 'נחל מחמל', en: 'Nahal Mahmal' },
    { he: 'נחל רעף', en: 'Nahal Raaf' },
    { he: 'נחל סרפד', en: 'Nahal Serpad' },
    { he: 'נחל סלעית', en: 'Nahal Salit' },
    { he: 'נחל כרכום', en: 'Nahal Karkom' },
    { he: 'נחל ברק', en: 'Nahal Barak' },
    { he: 'נחל חולית', en: 'Nahal Holit' },
    { he: 'נחל מנוחה', en: 'Nahal Menucha' },
    { he: 'נחל רעים', en: 'Nahal Reim' },
    { he: 'נחל חמדה', en: 'Nahal Hemda' },
    { he: 'נחל סירה', en: 'Nahal Sira' },
    { he: 'נחל איילות', en: 'Nahal Ayalot' },
    { he: 'נחל תרשים', en: 'Nahal Tarshim' },
    { he: 'נחל ניצנה', en: 'Nahal Nitzana' },
    { he: 'נחל צניפים', en: 'Nahal Tznifim' },
    { he: 'נחל גוונים', en: 'Nahal Gvanim' },

    // Ein (Spring) Streets
    { he: 'עין עקב', en: 'Ein Akeb' },
    { he: 'עין עובדת', en: 'Ein Ovdat' },
    { he: 'עין עופרים', en: 'Ein Oferim' },
    { he: 'עין זיק', en: 'Ein Zik' },
    { he: 'עין סהרונים', en: 'Ein Saharonim' },
    { he: 'עין מור', en: 'Ein Mor' },
    { he: 'עין משק', en: 'Ein Meshek' },
    { he: 'עין שחק', en: 'Ein Shahak' },
    { he: 'עין שביב', en: 'Ein Shaviv' },
    { he: 'עין צין', en: 'Ein Tzin' },
    { he: 'עין ארדון', en: 'Ein Ardon' },
    { he: 'עין המערה', en: 'Ein HaMeara' },
    { he: 'עין ורדית', en: 'Ein Vardit' },
    { he: 'עין מעריף', en: 'Ein Maarif' },

    // Ma'ale (Ascent) Streets
    { he: 'מעלה הדקלים', en: 'Maale HaDekalim' },
    { he: 'מעלה בן תור', en: 'Maale Ben Tur' },
    { he: 'מעלה התור', en: 'Maale HaTor' },

    // Flower Streets
    { he: 'החצב', en: 'HaAtzav' },
    { he: 'האירוס', en: 'HaIrus' },
    { he: 'הצבעוני', en: 'HaTzevaoni' },
    { he: 'השיטה', en: 'HaShita' }
];

// Nearby localities for delivery range
export const NEARBY_CITIES = [
    { he: 'מצפה רמון', en: 'Mitzpe Ramon' },
    { he: 'שדה בוקר', en: 'Sde Boker' },
    { he: 'באר שבע', en: 'Beer Sheva' },
    { he: 'דימונה', en: 'Dimona' },
    { he: 'ירוחם', en: 'Yeruham' }
];

// Default city
export const DEFAULT_CITY = 'מצפה רמון';

/**
 * Get address suggestions (bilingual search)
 */
export function getAddressSuggestions(input) {
    if (!input || input.length < 1) return [];

    const suggestions = [];
    const inputLower = input.toLowerCase();

    // Search in both Hebrew and English
    MITZPE_RAMON_STREETS.forEach(street => {
        const matchHe = street.he.includes(input);
        const matchEn = street.en.toLowerCase().includes(inputLower);

        if (matchHe || matchEn) {
            suggestions.push(`${street.he}, ${DEFAULT_CITY}`);
        }
    });

    // If input contains a number, append to matching streets
    const numberMatch = input.match(/(\d+)/);
    if (numberMatch) {
        const houseNumber = numberMatch[1];
        const textPart = input.replace(/\d+/g, '').trim().toLowerCase();

        MITZPE_RAMON_STREETS.forEach(street => {
            const matchHe = street.he.includes(textPart);
            const matchEn = street.en.toLowerCase().includes(textPart);

            if (!textPart || matchHe || matchEn) {
                suggestions.unshift(`${street.he} ${houseNumber}, ${DEFAULT_CITY}`);
            }
        });
    }

    return [...new Set(suggestions)].slice(0, 10);
}

/**
 * Quick suggestions (popular streets)
 */
export function getQuickSuggestions() {
    return [
        'שדרות דוד בן גוריון',
        'דרך בראשית',
        'נחל ערוד',
        'הר ארדון',
        'עין עקב'
    ].map(s => `${s}, ${DEFAULT_CITY}`);
}

export default {
    MITZPE_RAMON_STREETS,
    NEARBY_CITIES,
    DEFAULT_CITY,
    getAddressSuggestions,
    getQuickSuggestions
};
