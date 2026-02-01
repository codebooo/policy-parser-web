import { PolicyType } from '../config';

export interface LinkFeatures {
    isFooter: number;      // 1 if in footer, 0 otherwise
    isNav: number;         // 1 if in nav, 0 otherwise
    hasPrivacyText: number; // 1 if text contains 'privacy'
    hasTermsText: number;   // 1 if text contains 'terms'
    hasLegalText: number;   // 1 if text contains 'legal'
    urlDepth: number;      // Normalized depth (0-1)
    textLength: number;    // Normalized length (0-1)
    isHttps: number;       // 1 if https
    hasYear: number;       // 1 if text contains a year (e.g., 2023)
}

export const FEATURE_COUNT = 9;

/**
 * Extract features from a link element and its context
 */
export function extractFeatures(
    linkText: string,
    href: string,
    context: 'footer' | 'nav' | 'body' | 'legal_hub',
    baseUrl: string
): number[] {
    const text = linkText.toLowerCase();
    const url = href.toLowerCase();

    // 1. Location Features
    const isFooter = context === 'footer' ? 1 : 0;
    const isNav = context === 'nav' ? 1 : 0;

    // 2. Text Pattern Features
    const hasPrivacyText = text.includes('privacy') || text.includes('data protection') ? 1 : 0;
    const hasTermsText = text.includes('terms') || text.includes('conditions') ? 1 : 0;
    const hasLegalText = text.includes('legal') || url.includes('legal') ? 1 : 0;

    // 3. URL Features
    // Calculate depth: count slashes, normalize (max 5)
    const depth = (url.match(/\//g) || []).length;
    const urlDepth = Math.min(depth, 5) / 5;

    const isHttps = url.startsWith('https') ? 1 : 0;

    // 4. Content Features
    // Normalize text length (max 50 chars)
    const textLength = Math.min(text.length, 50) / 50;

    const hasYear = /\b20[2-3][0-9]\b/.test(text) ? 1 : 0;

    return [
        isFooter,
        isNav,
        hasPrivacyText,
        hasTermsText,
        hasLegalText,
        urlDepth,
        textLength,
        isHttps,
        hasYear
    ];
}
