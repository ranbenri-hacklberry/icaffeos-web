/**
 * Onboarding Types
 * Defines the data structures for the Menu Onboarding Wizard.
 */

export interface AtmosphereSeed {
    id: string;
    blob: Blob | string; // DataURL or Supabase public URL
    type: 'container' | 'background';
    promptHint: string;
    storagePath?: string; // 🆕 Supabase Storage path for cleanup/persistence
}
/**
 * 🆕 Modifier Type Enums
 * Defines the behavior logic for modifier groups.
 */
export enum ModifierLogic {
    REPLACE = 'R',   // Replaces base item (e.g., swap regular milk for soy)
    ADD = 'A'        // Adds to base item (e.g., add onion, extra cheese)
}

export enum ModifierRequirement {
    MANDATORY = 'M', // Must select at least `minSelection` options
    OPTIONAL = 'O'   // Can skip this group entirely
}

/**
 * Enhanced Modifier Item
 * Supports default selection and negative prices for discounts.
 */
export interface ModifierItem {
    id?: string;          // 🆕 UUID for DB sync
    name: string;
    price: number;        // Can be negative for discounts (e.g., "No Cheese[-5]")
    isDefault?: boolean;  // {D} flag - pre-selected option
}

/**
 * Enhanced Modifier Group
 * Full rule-based system for POS/KDS rendering.
 * 
 * Syntax: GroupName [Type|Logic|Limit]:Option1[Price]{D},Option2;
 * Example: Milk [M|R|1]:Regular{D},Soy[2],Oat[3]
 *          Add-ons [O|A|3]:Onion[2],ExtraCheese[5]
 */
export interface ModifierGroup {
    id?: string; // 🆕 UUID for DB sync
    name: string;
    items: ModifierItem[];

    // 🆕 Rule Properties
    requirement: ModifierRequirement; // M = Mandatory, O = Optional
    logic: ModifierLogic;             // R = Replacement, A = Addition
    minSelection: number;             // 1 if M, 0 if O (or custom)
    maxSelection: number;             // Default: 1 for R, unlimited for A

    // UI Hints (derived)
    renderAs?: 'radio' | 'checkbox' | 'stepper'; // For UI rendering decisions
}

export interface OnboardingItem {
    id: string; // Transient ID (UUID)

    // Excel Data
    category: string;
    name: string;
    description: string;
    price: number;
    salePrice?: number; // 🆕 Added sale price support
    productionArea: 'Kitchen' | 'Bar' | 'Checker' | string;
    ingredients: string[];
    vibeOverride?: string; // from Excel 'Vibe Override'
    modifiers: ModifierGroup[];

    // 🆕 Atmosphere Selection (per-item or per-category)
    selectedBackgroundId?: string; // ID of chosen background from atmosphereSeeds
    selectedContainerId?: string;  // ID of chosen container/serving dish from atmosphereSeeds

    // 🆕 Advanced Manager Fields
    saleStartDate?: string;
    saleEndDate?: string;
    englishName?: string; // 🆕 English name for multilingual menus
    cost?: number;        // 🆕 Cost price for production analysis
    preparationMode?: 'ready' | 'requires_prep' | 'cashier_choice';
    displayKDS?: string[];
    recipe?: { ingredient: string; quantity: string; unit?: string; cost?: number }[];
    productionSchedule?: { day: string; quantity: number }[];

    // 🆕 Visibility & Routing
    isVisiblePos?: boolean;
    isVisibleOnline?: boolean;
    kdsStation?: 'kitchen' | 'bar' | 'none'; // Main checker routing
    subStation?: string; // Specific station (Grill, Fish, etc.)

    // AI & App State
    prompt?: string;
    lastPrompt?: string; // 🆕 The exact prompt used for generation
    negativePrompt?: string;
    imageUrl?: string;        // AI generated image URL (Supabase)
    categoryId?: string | null; // 🆕 Linked DB category ID
    originalImageUrl?: string; // Legacy/Single seed
    originalImageUrls?: string[]; // 🆕 Multiple product reference images
    manualImage?: Blob | string; // User override
    status: 'pending' | 'preparing' | 'generating' | 'completed' | 'done' | 'error' | 'approved' | 'image_skipped';
    visualDescription?: string; // 🆕 Visual anchor for AI generation

    // Validation
    validationErrors?: string[];

    // Metadata for UI
    generationTime?: number; // In seconds
    powerSource?: string;    // e.g., "Apple Silicon"
    error?: string;          // 🆕 Per-item error message
    seeds?: { type: string, data: string }[]; // 🆕 Visual references for i2i
    aiImprovement?: boolean; // 🆕 Toggle for 20% AI improvement

    // 🆕 Inventory Settings (Prepared Items)
    inventorySettings?: {
        isPreparedItem: boolean;
        prepType: 'completion' | 'production' | 'defrost';
        dailyPars: Record<'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday', number>;
        parShifts?: Partial<Record<'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday', 'opening' | 'closing' | 'prep'>>;
        hideOnZeroStock?: boolean;
    };
}

export interface OnboardingSession {
    id?: number; // Dexie incrementing ID
    business_id?: number | string;
    step: number;
    atmosphereSeeds: AtmosphereSeed[];
    items: OnboardingItem[];
    menuTitle?: string;
    updated_at: number;
}

export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    rowErrorIndex: number | null;
}
