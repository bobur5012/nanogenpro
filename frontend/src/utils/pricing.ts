/**
 * Pricing Utilities
 * All prices in UZS with 3x markup
 */

// Exchange: 1 credit = 1000 UZS
export const CREDITS_PER_UZS = 1000;

// ========== VIDEO MODELS (per second) ==========
export const VIDEO_PRICES = {
    // Kling 2.6 Pro
    kling_pro: 22050,          // $0.0735 * 3 * 100
    kling_pro_audio: 44100,    // $0.147 * 3 * 100
    
    // Kling Turbo
    kling_turbo: 22050,
    
    // Kling O1
    kling_o1: 22050,
    
    // Seedance
    seedance_pro: 18900,       // $0.063 * 3 * 100
    seedance_lite: 9450,       // $0.0315 * 3 * 100
    
    // Wan 2.5 / 2.6
    wan: 18900,
    wan_2_6: 18900,
    
    // Runway Gen-4
    runway: 15750,             // $0.0525 * 3 * 100
    
    // Sora 2 Pro
    sora: 94500,               // $0.315 * 3 * 100
    
    // Veo 3.1
    veo: 63000,                // $0.21 * 3 * 100
} as const;

// ========== IMAGE MODELS (per image) ==========
export const IMAGE_PRICES = {
    // GPT Image
    gpt_image_low: 6000,
    gpt_image_medium: 12000,   // ~$0.04 * 3 * 100
    gpt_image_high: 24000,
    
    // Imagen 4
    imagen_fast: 6300,         // $0.021 * 3 * 100
    imagen_generate: 12600,    // $0.042 * 3 * 100
    imagen_ultra: 18900,       // $0.063 * 3 * 100
    
    // Nano Banana
    nano_banana: 12285,        // $0.04095 * 3 * 100
    nano_banana_pro: 47250,    // $0.1575 * 3 * 100
} as const;

// ========== RESOLUTION MULTIPLIERS ==========
export const RESOLUTION_MULTIPLIERS = {
    '480p': 1,
    '720p': 1.5,
    '1080p': 2.5,
    '4K': 5,
} as const;

// ========== UTILITY FUNCTIONS ==========

/**
 * Calculate cost in credits from UZS
 */
export function uzsToCredits(uzs: number): number {
    return Math.ceil(uzs / CREDITS_PER_UZS);
}

/**
 * Calculate cost in UZS from credits
 */
export function creditsToUzs(credits: number): number {
    return credits * CREDITS_PER_UZS;
}

/**
 * Format UZS amount with separators
 */
export function formatUZS(amount: number): string {
    return amount.toLocaleString('ru-RU');
}

/**
 * Format price display: "X,XXX UZS"
 */
export function formatPrice(uzs: number): string {
    return `${formatUZS(uzs)} UZS`;
}

/**
 * Format credits display: "X 💎"
 */
export function formatCredits(credits: number): string {
    return `${credits} 💎`;
}

/**
 * Calculate video generation cost
 */
export function calculateVideoCost(
    pricePerSecond: number,
    durationSeconds: number,
    resolutionMultiplier: number = 1
): { uzs: number; credits: number } {
    const uzs = Math.ceil(pricePerSecond * durationSeconds * resolutionMultiplier);
    const credits = uzsToCredits(uzs);
    return { uzs, credits };
}

/**
 * Calculate image generation cost
 */
export function calculateImageCost(
    pricePerImage: number,
    count: number = 1
): { uzs: number; credits: number } {
    const uzs = pricePerImage * count;
    const credits = uzsToCredits(uzs);
    return { uzs, credits };
}

/**
 * Check if user can afford
 */
export function canAfford(userCredits: number, costCredits: number): boolean {
    return userCredits >= costCredits;
}

/**
 * Get remaining credits after purchase
 */
export function getRemainingCredits(userCredits: number, costCredits: number): number {
    return Math.max(0, userCredits - costCredits);
}
