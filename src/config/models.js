export const AI_MODELS = {
    // Google Gemini Models (Updated Jan 2026)
    // 🛑 CRITICAL: DO NOT USE 1.5 OR 2.0 MODELS. USE ONLY 2.5, 3.0 OR HIGHER. 🛑
    GEMINI: {
        FLASH_3: 'gemini-3-flash',
        FLASH_3_LITE: 'gemini-3-flash-lite',
        PRO_3: 'gemini-3-pro',
        FLASH_2_5: 'gemini-2.5-flash',
        PRO_2_5: 'gemini-2.5-pro',
    },
    // xAI Grok Models (updated Jan 2026)
    GROK: {
        GROK_3: 'grok-3',
        GROK_3_MINI: 'grok-3-mini',
        GROK_2_LATEST: 'grok-2-latest',
        GROK_2_VISION: 'grok-2-vision-latest',
    }
};

export const DEFAULT_MODEL = AI_MODELS.GEMINI.FLASH_3;

export const FALLBACK_MODELS = [
    AI_MODELS.GEMINI.PRO_3,
    AI_MODELS.GEMINI.FLASH_2_5
];
