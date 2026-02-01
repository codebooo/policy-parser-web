"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FEATURE_COUNT = void 0;
exports.extractFeatures = extractFeatures;
exports.FEATURE_COUNT = 9;
/**
 * Extract features from a link element and its context
 */
function extractFeatures(linkText, href, context, baseUrl) {
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
