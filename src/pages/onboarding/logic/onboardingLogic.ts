/**
 * Onboarding Logic
 * Core business logic: Parsing, Validation, and Prompt Generation.
 */

import { OnboardingItem, ModifierGroup, ModifierItem, ModifierLogic, ModifierRequirement, AtmosphereSeed } from '@/pages/onboarding/types/onboardingTypes';

/**
 * 🆕 Category Normalization
 */
export const normalizeCategory = (cat: string): string => {
    if (!cat) return 'General';
    let clean = cat.trim();
    if (clean.includes('שת') && clean.includes('חמה')) return 'שתיה חמה';
    if (clean.includes('שת') && clean.includes('קרה')) return 'שתיה קרה';
    clean = clean.replace('שתייה', 'שתיה');
    return clean;
};

/**
 * 🆕 Enhanced Modifier Parser
 */
export const parseModifierString = (modifierString: string): ModifierGroup[] => {
    if (!modifierString || typeof modifierString !== 'string') return [];
    const groups: ModifierGroup[] = [];
    const groupStrings = modifierString.split(';');
    const groupMetaRegex = /^(.+?)\s*(?:\[([MO])\|([RA])\|(\d+)\])?\s*$/;
    for (const gStr of groupStrings) {
        if (!gStr.trim()) continue;
        const firstColonIndex = gStr.indexOf(':');
        if (firstColonIndex === -1) continue;
        const groupPart = gStr.slice(0, firstColonIndex).trim();
        const optionsPart = gStr.slice(firstColonIndex + 1).trim();
        if (!groupPart || !optionsPart) continue;
        const metaMatch = groupPart.match(groupMetaRegex);
        if (!metaMatch) continue;
        const groupName = metaMatch[1].trim();
        const reqFlag = metaMatch[2] as 'M' | 'O' | undefined;
        const logicFlag = metaMatch[3] as 'R' | 'A' | undefined;
        const maxSelStr = metaMatch[4];
        const requirement = reqFlag === 'M' ? ModifierRequirement.MANDATORY : ModifierRequirement.OPTIONAL;
        const logic = logicFlag === 'R' ? ModifierLogic.REPLACE : ModifierLogic.ADD;
        const maxSelection = maxSelStr ? parseInt(maxSelStr, 10) : (logic === ModifierLogic.REPLACE ? 1 : 99);
        const minSelection = requirement === ModifierRequirement.MANDATORY ? 1 : 0;
        let renderAs: 'radio' | 'checkbox' | 'stepper' = 'checkbox';
        if (requirement === ModifierRequirement.MANDATORY && maxSelection === 1) renderAs = 'radio';
        else if (maxSelection > 1) renderAs = 'checkbox';
        const items: ModifierItem[] = [];
        const optionsRaw = optionsPart.split(',');
        const optionRegex = /^(.+?)(?:\[(-?\d+(?:\.\d+)?)\])?(\{D\})?$/;
        for (const opt of optionsRaw) {
            const cleanOpt = opt.trim();
            if (!cleanOpt) continue;
            const optMatch = cleanOpt.match(optionRegex);
            if (optMatch) {
                const name = optMatch[1].trim();
                const price = optMatch[2] ? parseFloat(optMatch[2]) : 0;
                const isDefault = !!optMatch[3];
                items.push({ name, price, isDefault });
            } else { items.push({ name: cleanOpt, price: 0, isDefault: false }); }
        }
        if (items.length > 0) {
            groups.push({ name: groupName, items, requirement, logic, minSelection, maxSelection, renderAs });
        }
    }
    return groups;
};

/**
 * Modifier Group Validation (Required by Store)
 */
export const validateModifierGroups = (groups: ModifierGroup[]) => {
    const errors: any[] = [];
    groups.forEach(g => {
        if (g.requirement === ModifierRequirement.MANDATORY && g.items.filter(i => i.isDefault).length === 0) {
            errors.push({ groupName: g.name, message: 'Missing default option' });
        }
    });
    return errors;
};

/**
 * Excel Validation (Required by Store)
 */
export const validateMenuRow = (row: any, rowIndex: number): string[] => {
    const errors: string[] = [];
    if (!row['Item Name'] && !row['שם מוצר']) errors.push(`Row ${rowIndex + 1}: Missing 'Item Name'`);
    if (!row['Category'] && !row['קטגוריה']) errors.push(`Row ${rowIndex + 1}: Missing 'Category'`);
    return errors;
};

/**
 * Image Helpers with Safety
 */
const fetchWithTimeout = async (url: string, timeout = 15000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (e) {
        clearTimeout(id);
        throw e;
    }
};

/**
 * ⚡ Extreme Client-Side Compression
 * Shrinks 7MB+ images to ~300KB before upload to prevent UI hanging.
 */
export const compressImageToBlob = async (file: File | Blob, maxDim = 1500, quality = 0.75): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let w = img.width; let h = img.height;
            if (w > h) { if (w > maxDim) { h *= maxDim / w; w = maxDim; } }
            else { if (h > maxDim) { w *= maxDim / h; h = maxDim; } }
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, w, h);
            canvas.toBlob((blob) => {
                if (blob) resolve(blob);
                else reject(new Error("Canvas toBlob failed"));
            }, 'image/jpeg', quality);
        };
        img.onerror = () => reject(new Error("Image load failed"));
        img.src = URL.createObjectURL(file);
    });
};

const compressImage = async (blob: Blob, maxDim = 1024): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let w = img.width; let h = img.height;
            if (w > h) { if (w > maxDim) { h *= maxDim / w; w = maxDim; } }
            else { if (h > maxDim) { w *= maxDim / h; h = maxDim; } }
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL('image/jpeg', 0.8).split(',')[1]);
        };
        const timeout = setTimeout(() => reject(new Error("Compression timeout")), 10000);
        img.onerror = () => { clearTimeout(timeout); reject(new Error("Load error")); };
        img.src = URL.createObjectURL(blob);
    });
};

const resizeBase64 = async (base64Url: string, maxDim = 512): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image(); img.crossOrigin = "anonymous";
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let w = img.width; let h = img.height;
            if (w > h) { if (w > maxDim) { h *= maxDim / w; w = maxDim; } }
            else { if (h > maxDim) { w *= maxDim / h; h = maxDim; } }
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = () => reject(new Error("Resize failed"));
        setTimeout(() => reject(new Error("Resize timeout")), 10000);
        img.src = base64Url;
    });
};

/**
 * 🎨 AI Vision Decoder (Gemini 3 Flash)
 */
export const analyzeVisualSeed = async (imageUrl: string, type: 'container' | 'background' | 'reference', apiKeyPassed?: string): Promise<string> => {
    try {
        const apiKey = apiKeyPassed || import.meta.env.VITE_GEMINI_API_KEY;
        const res = await fetchWithTimeout(imageUrl);
        const blobObj = await res.blob();
        const base64Data = await compressImage(blobObj);

        let prompt = `Analyze this ${type} image for a product catalog. 
        LIST ONLY THE LITERAL VISUAL FACTS:
        - Primary Subject: What is the main object? (Shape, size, key features).
        - Count/Details: Specific number of items or visible components.
        - Surface/Texture: Matte, glossy, organic, waxy, etc.
        - Colors: Key dominant colors.
        - Setup: Placement, lighting, and environment facts.
        - Distractions: Explicitly note if hands, fingers, people, or foreign objects are holding or touching the subject.
        BE BRUTALLY HONEST. DO NOT USE ADJECTIVES LIKE "LUSH" OR "DELICIOUS" UNLESS 100% VISUALLY EVIDENT.`;

        // 🛑 DO NOT CHANGE THIS MODEL WITHOUT EXPLICIT USER APPROVAL. USE 3.0+ 🛑
        const modelId = "gemini-3-flash-preview"; // Restored Gemini 3 Flash for visual analysis
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey
            },
            signal: controller.signal,
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: "image/jpeg", data: base64Data } }] }] })
        });

        clearTimeout(timeoutId);

        if (!response.ok) throw new Error(`Status ${response.status}`);

        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || `User ${type}`;
    } catch (err) {
        console.warn(`Analysis failed for ${type}:`, err);
        return `User ${type}`;
    }
};

/**
 * 🚀 Image Generation (Nano Banana - Gemini 2.5 Flash Image)
 */
export const generateImageGemini = async (prompt: string, apiKey: string, negativePrompt?: string, seeds?: { type: string, data: string }[]): Promise<{ url: string; timeTaken: number; powerSource: string } | null> => {
    const startTime = Date.now();
    try {
        const parts: any[] = [];
        if (seeds && seeds.length > 0) {
            seeds.forEach(s => {
                const label = s.type === 'reference' ? 'SOURCE_IMAGE_DO_NOT_ALTER' : `REFERENCE_${s.type.toUpperCase()}`;
                parts.push({ text: `${label}:` });
                parts.push({ inline_data: { mime_type: "image/jpeg", data: s.data } });
            });
        }
        parts.push({ text: `TASK: ${prompt}${negativePrompt ? ` (Avoid: ${negativePrompt})` : ''}` });

        // 🛑 DO NOT CHANGE THIS MODEL WITHOUT EXPLICIT USER APPROVAL. USE 2.5+ or 3.0+ 🛑
        const modelId = "gemini-2.5-flash-image"; // Restored original 2.5+ image model
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent`;
        console.log("🎨 [AI Artist] Calling Gemini Artist (Header Secure Mode)");

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s safety timeout

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey
            },
            signal: controller.signal,
            body: JSON.stringify({
                contents: [{ parts }],
                generationConfig: {
                    response_modalities: ["IMAGE"]
                }
            })
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            console.error("❌ [AI Artist] API Error:", response.status, err);
            throw new Error(`API failed [${response.status}]`);
        }

        const data = await response.json();
        const responseParts = data.candidates?.[0]?.content?.parts || [];

        let foundBase64: string | null = null;
        for (const p of responseParts) {
            const dataBit = p.inlineData?.data || p.inline_data?.data;
            if (dataBit) { foundBase64 = dataBit; break; }
        }

        if (foundBase64) {
            console.log("✨ [AI Artist] Image received successfully.");
            const fullResUrl = `data:image/png;base64,${foundBase64}`;
            const shrunkUrl = await resizeBase64(fullResUrl, 1024);
            return { url: shrunkUrl, timeTaken: parseFloat(((Date.now() - startTime) / 1000).toFixed(1)), powerSource: 'Gemini 2.5 Flash' };
        }

        return null; // Return null if no image was found
    } catch (err: any) {
        if (err.name === 'AbortError') console.error("❌ [AI Artist] Generation timed out after 60s");
        console.error("❌ [AI Artist] Critical error:", err);
        throw err;
    }
};

/**
 * 🧠 Prompt Architect (Gemini 3 Pro)
 */
export const generateImagePrompt = async (item: OnboardingItem, allAtmosphereSeeds: AtmosphereSeed[] = [], apiKeyPassed?: string, businessContext?: string): Promise<{ prompt: string, negativePrompt: string, suggestedName?: string, seeds?: { type: string, data: string }[] }> => {
    const apiKey = apiKeyPassed || import.meta.env.VITE_GEMINI_API_KEY;
    const background = (allAtmosphereSeeds || []).find(s => s.id === item.selectedBackgroundId);
    const container = (allAtmosphereSeeds || []).find(s => s.id === item.selectedContainerId);

    const visualParts: any[] = [];
    const logicSeeds: { type: string, data: string }[] = [];
    let referenceAnalysis = "Follow user image style and materials";

    try {
        if (item.originalImageUrls?.[0]) {
            const res = await fetchWithTimeout(item.originalImageUrls[0]);
            const b = await res.blob();
            const data = await compressImage(b, 512); // ⚡ Optimized for Architect (Small & Fast)
            visualParts.push({ text: "PRODUCT_REFERENCE (EXACT VISUAL TARGET):" }, { inline_data: { mime_type: "image/jpeg", data } });
            logicSeeds.push({ type: 'reference', data });
            referenceAnalysis = await analyzeVisualSeed(item.originalImageUrls[0], 'reference', apiKey);
        }
        if (container?.blob) {
            const res = await fetchWithTimeout(container.blob as string);
            const b = await res.blob();
            const data = await compressImage(b, 512); // ⚡ Optimized
            visualParts.push({ text: "CONTAINER_REFERENCE:" }, { inline_data: { mime_type: "image/jpeg", data } });
            logicSeeds.push({ type: 'container', data });
        }
        if (background?.blob) {
            const res = await fetchWithTimeout(background.blob as string);
            const b = await res.blob();
            const data = await compressImage(b, 512); // ⚡ Optimized
            visualParts.push({ text: "BACKGROUND_REFERENCE:" }, { inline_data: { mime_type: "image/jpeg", data } });
            logicSeeds.push({ type: 'background', data });
        }
    } catch (e) { console.warn("Seed loading failed:", e); }

    const itemDetails = `
    TARGET ITEM: ${item.name}
    SPECIFIC ADDITIONS: ${item.description || "No specific additions."}
    INGREDIENTS: ${item.ingredients?.join(', ') || "N/A"}
    AI_IMPROVEMENT_MODE: ${item.aiImprovement ? 'ACTIVE (Allow decorative enhancements)' : 'DISABLED (STRICT FIDELITY - NO UNAUTHORIZED CHANGES)'}
    `;

    const sysInstruction = `You are a Digital Imaging Technician and Prompt Architect.
    Your task is to write a prompt that forces the AI to REPLICATE the SUBJECT from the Source Image exactly, maintaining its unique identity and its EXACT PRESENTATION environment.
    
    CRITICAL FIDELITY RULES:
    1. IDENTITY & SETUP (STRICT): The prompt must explicitly say: "The exact subject from the source image, preserving its specific shape, proportions, and textures. Maintain the EXACT setup, scale, and placement as shown in the PRODUCT_REFERENCE."
    2. CONTAINER & PACKAGING: If the source image shows the item on a specific plate, with paper, or in a specific vessel, you MUST mandate its replication. Do NOT 'clean' or 'improve' the presentation unless AI_IMPROVEMENT_MODE is ACTIVE.
    3. DESCRIPTIVE ADDITIONS: If the USER SPECIFICATIONS mentions garnishes (e.g., "basil leaves", "truffle oil"), you MUST include them as "carefully placed additions" that do not change the core item's structure. 
    4. NO UNAUTHORIZED IMPROVEMENTS: If AI_IMPROVEMENT_MODE is DISABLED, DO NOT add ingredients like "pesto inside" or "extra cheese" unless they are visually evident in the source analysis or explicitly in 'SPECIFIC ADDITIONS'.
    5. ISOLATION FROM HANDS: If the reference image shows a hand holding the product, you MUST explicitly instruct the AI to "REMIOVE THE HAND and place the product on the surface/background". The prompt must contain: "Do not include any hands or people holding the item."
    
    Visual Analysis of Seed: ${referenceAnalysis}
    
    ${itemDetails}

    COMPOSITION:
    - SUBJECT: "Digitally replicate the specific ${item.name} and its exact current setup (plate, paper, arrangement) from the source image."
    - MODIFICATIONS: "${item.aiImprovement ? 'Subtly enhance visuals for premium catalog quality.' : 'No unauthorized changes to the dish structure.'} Add ${item.description || 'nothing'} as requested."
    - ENVIRONMENT: "${background?.blob ? 'Place the subject in the exact environment from BACKGROUND_REFERENCE.' : 'Maintain the professional lighting and style of the source image.'}"
    
    Business Context: ${businessContext || 'Professional Menu / Catalog'}
    RETURN FORMAT JSON ONLY: {"prompt": "PROFESSIONAL PHOTOGRAPHY: The exact subject from the product reference, isolated from any hands holding it. Preserve specific shape and unique textures. Placed on [BACKGROUND]...", "negativePrompt": "hands, holding hand, people, body parts, fingers, different object, generic version, changed subject, illustration, drawing, painting, bad lighting, missing parts, changed container, improved dish", "suggestedName": "..."}`;

    // 🛑 DO NOT CHANGE THIS MODEL WITHOUT EXPLICIT USER APPROVAL. USE 3.0+ 🛑
    const modelId = "gemini-3-pro-preview"; // Restored Gemini 3 Pro for prompt generation
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent`;
    console.log(`🧠 [AI Architect] Calling ${modelId} with Visuals...`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey
            },
            signal: controller.signal,
            body: JSON.stringify({
                contents: [{ parts: [{ text: sysInstruction }, ...visualParts] }],
                generationConfig: { response_mime_type: "application/json" }
            })
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errBody = await response.json().catch(() => ({}));
            throw new Error(`API failed [${response.status}]: ${JSON.stringify(errBody)}`);
        }

        const data = await response.json();
        let text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

        // 🛡️ Robust JSON Cleaning: Handle markdown blocks and extra text
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            text = jsonMatch[0];
        }

        const result = JSON.parse(text);

        return {
            prompt: result.prompt || item.name,
            negativePrompt: result.negativePrompt || "extra items, multiple objects, blurry, artwork, text",
            suggestedName: result.suggestedName,
            seeds: logicSeeds
        };
    } catch (err: any) {
        console.error("Prompt generation failed, using Smart Fallback:", err);

        // 🧠 Smart Fallback: Respect selected seeds even on failure
        const ingredientList = item.ingredients?.length ? item.ingredients.join(', ') : 'standard fresh ingredients';

        let fallbackPrompt = `PROFESSIONAL PHOTOGRAPHY: A high-resolution, centered shot of ${item.name}. 
        IMPORTANT: Remove any hands or people from the scene.
        STRUCTURE: ${item.description || 'Authentic dish appearance'}. 
        DETAILS: Visible textures of ${ingredientList}. 
        LIGHTING: Bright, professional studio lighting with soft shadows.`;

        if (container) {
            fallbackPrompt += `\nPRESENTATION: Placed inside the specific vessel from CONTAINER_REFERENCE.`;
        }
        if (background) {
            fallbackPrompt += `\nENVIRONMENT: Placed in the exact environment from BACKGROUND_REFERENCE.`;
        } else {
            fallbackPrompt += `\nPRESENTATION: Placed on a clean, professional surface.`;
        }

        return {
            prompt: fallbackPrompt,
            negativePrompt: "hands, fingers, people, body parts, blurry, dark, low resolution, changed dish structure, extra items not in source",
            seeds: logicSeeds
        };
    }
};

export const enrichItemVisually = async (item: OnboardingItem, apiKeyPassed?: string): Promise<string> => {
    try {
        const apiKey = apiKeyPassed || import.meta.env.VITE_GEMINI_API_KEY;
        // 🛑 DO NOT CHANGE THIS MODEL WITHOUT EXPLICIT USER APPROVAL. USE 3.0+ 🛑
        const modelId = "gemini-3-flash-preview";
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey
            },
            body: JSON.stringify({ contents: [{ parts: [{ text: `Short description for ${item.name}` }] }] })
        });
        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || item.name;
    } catch (e) { return item.name; }
};

export const mapRowToItem = (row: any, fallbackId: string): OnboardingItem => ({
    id: fallbackId,
    name: row['Item Name'] || row['שם מוצר'] || '',
    description: row['Description'] || row['תיאור'] || '',
    price: parseFloat(row['Price'] || row['מחיר'] || '0'),
    category: normalizeCategory(row['Category'] || row['קטגוריה'] || 'General'),
    status: 'pending',
    productionArea: 'Kitchen',
    ingredients: row['Ingredients'] || row['מרכיבים'] ? (row['Ingredients'] || row['מרכיבים']).split(',').map((s: string) => s.trim()) : [],
    modifiers: parseModifierString(row['Modifiers'] || row['תוספות'] || '')
});
