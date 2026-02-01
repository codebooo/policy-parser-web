/**
 * Carl's Feature Extractor
 * 
 * Extracts comprehensive features from links and page content to determine
 * if a URL points to a privacy policy. Carl uses these features to learn
 * patterns that indicate policy pages.
 * 
 * Features are organized into categories:
 * 1. Text Signals (what the link says)
 * 2. URL Signals (what the URL looks like)
 * 3. Context Signals (where the link is located)
 * 4. Content Signals (what's on the page)
 * 5. Domain Signals (characteristics of the site)
 */

// ============================================================================
// KEYWORD DICTIONARIES - Based on analyzed policy documents
// ============================================================================

/** Strong indicators of privacy policies across languages */
const PRIVACY_KEYWORDS = [
    // English
    'privacy', 'privacy policy', 'data protection', 'personal data', 'your data',
    'personal information', 'data privacy', 'privacy notice', 'privacy statement',
    // German
    'datenschutz', 'datenschutzerklärung', 'datenschutzrichtlinie', 'datenschutzhinweise',
    'privatsphäre', 'personenbezogene daten',
    // French
    'confidentialité', 'politique de confidentialité', 'données personnelles',
    // Spanish
    'privacidad', 'política de privacidad', 'datos personales',
    // Generic legal
    'gdpr', 'ccpa', 'dsgvo', 'rgpd'
];

/** Terms of Service indicators */
const TERMS_KEYWORDS = [
    'terms', 'terms of service', 'terms of use', 'terms and conditions',
    'conditions of use', 'user agreement', 'service agreement',
    'nutzungsbedingungen', 'agb', 'allgemeine geschäftsbedingungen',
    'conditions générales', 'condiciones de uso', 'términos y condiciones'
];

/** Cookie policy indicators */
const COOKIE_KEYWORDS = [
    'cookie', 'cookies', 'cookie policy', 'cookie notice',
    'cookie-richtlinie', 'cookies policy', 'use of cookies',
    'politique cookies', 'política de cookies'
];

/** Legal page hub indicators */
const LEGAL_HUB_KEYWORDS = [
    'legal', 'legal notice', 'legal information', 'impressum',
    'rechtliche hinweise', 'mentions légales', 'aviso legal'
];

/** URL path segments that indicate policy pages */
const POLICY_URL_PATTERNS = [
    'privacy', 'privacy-policy', 'privacypolicy', 'privacy_policy',
    'datenschutz', 'datenschutzerklaerung', 'data-protection',
    'terms', 'terms-of-service', 'tos', 'terms-of-use', 'termsofservice',
    'legal', 'policies', 'policy', 'cookie', 'cookies',
    'nutzungsbedingungen', 'agb', 'impressum', 'gdpr', 'ccpa'
];

/** Footer context selectors */
const FOOTER_SELECTORS = [
    'footer', '.footer', '#footer', '[role="contentinfo"]',
    '.site-footer', '.page-footer', '.main-footer',
    '.bottom-bar', '.bottom-nav', '.legal-links'
];

/** Navigation context indicators */
const NAV_SELECTORS = [
    'nav', '.nav', '#nav', 'header nav', '.navigation',
    '.main-nav', '.site-nav', '[role="navigation"]'
];

// ============================================================================
// FEATURE EXTRACTION
// ============================================================================

export interface CarlFeatures {
    // Text signals (5 features)
    hasPrivacyKeyword: number;
    hasTermsKeyword: number;
    hasCookieKeyword: number;
    hasLegalKeyword: number;
    textMatchStrength: number;       // How many keywords matched (normalized)
    
    // URL signals (6 features)
    urlHasPrivacyPath: number;
    urlHasTermsPath: number;
    urlHasLegalPath: number;
    urlDepth: number;               // Normalized path depth (0-1)
    urlLength: number;              // Normalized URL length (0-1)
    urlIsHttps: number;
    
    // Context signals (4 features)
    isInFooter: number;
    isInNav: number;
    isInLegalHub: number;
    isInBody: number;
    
    // Content signals (5 features, extracted from page if available)
    pageHasPrivacyContent: number;
    pageHasPolicyStructure: number; // Headers like "Data Collection", "Your Rights"
    pageHasLegalJargon: number;
    pageWordCount: number;          // Normalized word count
    pageHasContactInfo: number;     // Often in privacy policies
    
    // Link characteristics (4 features)
    linkTextLength: number;         // Normalized
    linkHasIcon: number;            // Shield, lock icons
    linkIsExternal: number;
    linkHasYear: number;            // Copyright years, update dates
}

/** Total number of features Carl uses */
export const CARL_FEATURE_COUNT = 24;

/**
 * Normalize a value to 0-1 range
 */
function normalize(value: number, max: number): number {
    return Math.min(Math.max(value / max, 0), 1);
}

/**
 * Count keyword matches in text
 */
function countKeywords(text: string, keywords: string[]): number {
    const lowerText = text.toLowerCase();
    let count = 0;
    for (const keyword of keywords) {
        if (lowerText.includes(keyword.toLowerCase())) {
            count++;
        }
    }
    return count;
}

/**
 * Check if text contains any keywords
 */
function hasKeywords(text: string, keywords: string[]): boolean {
    const lowerText = text.toLowerCase();
    return keywords.some(k => lowerText.includes(k.toLowerCase()));
}

/**
 * Extract features from a link for Carl to analyze
 * 
 * @param linkText - The visible text of the link
 * @param href - The URL the link points to
 * @param context - Where the link is located on the page
 * @param baseUrl - The base URL of the page
 * @param pageContent - Optional: Full page content for deeper analysis
 * @returns Feature array for Carl
 */
export function extractCarlFeatures(
    linkText: string,
    href: string,
    context: 'footer' | 'nav' | 'body' | 'legal_hub' | 'unknown',
    baseUrl: string,
    pageContent?: string
): number[] {
    const text = linkText.toLowerCase().trim();
    const url = href.toLowerCase();
    const content = pageContent?.toLowerCase() || '';
    
    // ========== TEXT SIGNALS ==========
    const hasPrivacyKeyword = hasKeywords(text, PRIVACY_KEYWORDS) ? 1 : 0;
    const hasTermsKeyword = hasKeywords(text, TERMS_KEYWORDS) ? 1 : 0;
    const hasCookieKeyword = hasKeywords(text, COOKIE_KEYWORDS) ? 1 : 0;
    const hasLegalKeyword = hasKeywords(text, LEGAL_HUB_KEYWORDS) ? 1 : 0;
    const textMatchStrength = normalize(
        countKeywords(text, [...PRIVACY_KEYWORDS, ...TERMS_KEYWORDS, ...COOKIE_KEYWORDS]),
        5
    );
    
    // ========== URL SIGNALS ==========
    const urlHasPrivacyPath = POLICY_URL_PATTERNS.slice(0, 8).some(p => url.includes(p)) ? 1 : 0;
    const urlHasTermsPath = POLICY_URL_PATTERNS.slice(8, 14).some(p => url.includes(p)) ? 1 : 0;
    const urlHasLegalPath = url.includes('legal') || url.includes('policies') ? 1 : 0;
    
    // URL depth (number of path segments)
    let pathDepth = 0;
    try {
        const urlObj = new URL(href, baseUrl);
        pathDepth = urlObj.pathname.split('/').filter(s => s.length > 0).length;
    } catch { }
    const urlDepth = normalize(pathDepth, 5);
    
    // URL length
    const urlLength = normalize(url.length, 200);
    
    // HTTPS
    const urlIsHttps = url.startsWith('https') || baseUrl.startsWith('https') ? 1 : 0;
    
    // ========== CONTEXT SIGNALS ==========
    const isInFooter = context === 'footer' ? 1 : 0;
    const isInNav = context === 'nav' ? 1 : 0;
    const isInLegalHub = context === 'legal_hub' ? 1 : 0;
    const isInBody = context === 'body' || context === 'unknown' ? 1 : 0;
    
    // ========== CONTENT SIGNALS (if page content provided) ==========
    let pageHasPrivacyContent = 0;
    let pageHasPolicyStructure = 0;
    let pageHasLegalJargon = 0;
    let pageWordCount = 0;
    let pageHasContactInfo = 0;
    
    if (content) {
        pageHasPrivacyContent = hasKeywords(content, PRIVACY_KEYWORDS) ? 1 : 0;
        
        // Check for policy structure headers
        const structureKeywords = [
            'data collection', 'information we collect', 'how we use',
            'your rights', 'third parties', 'cookies', 'security',
            'retention', 'updates to this policy', 'contact us',
            'datenerhebung', 'ihre rechte', 'dritte'
        ];
        pageHasPolicyStructure = countKeywords(content, structureKeywords) >= 3 ? 1 : 0;
        
        // Legal jargon
        const legalJargon = [
            'pursuant to', 'hereby', 'notwithstanding', 'liability',
            'indemnify', 'consent', 'processing', 'controller', 'processor',
            'gemäß', 'hiermit', 'verarbeitung', 'verantwortlicher'
        ];
        pageHasLegalJargon = countKeywords(content, legalJargon) >= 2 ? 1 : 0;
        
        // Word count (privacy policies tend to be 1000-10000 words)
        const words = content.split(/\s+/).filter(w => w.length > 0).length;
        pageWordCount = normalize(words, 5000);
        
        // Contact info patterns
        pageHasContactInfo = (
            content.includes('@') || 
            /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/.test(content) ||
            content.includes('contact us')
        ) ? 1 : 0;
    }
    
    // ========== LINK CHARACTERISTICS ==========
    const linkTextLength = normalize(text.length, 50);
    
    // Check for policy-related icons (by looking for common patterns)
    const linkHasIcon = (
        text.includes('🔒') || text.includes('🛡') || text.includes('⚖') ||
        href.includes('shield') || href.includes('lock') || href.includes('secure')
    ) ? 1 : 0;
    
    // External link check
    let linkIsExternal = 0;
    try {
        const linkDomain = new URL(href, baseUrl).hostname;
        const baseDomain = new URL(baseUrl).hostname;
        linkIsExternal = linkDomain !== baseDomain ? 1 : 0;
    } catch { }
    
    // Year in link text (often shows "Privacy Policy 2024")
    const linkHasYear = /\b20[2-3]\d\b/.test(text) ? 1 : 0;
    
    // Return all 24 features as array
    return [
        // Text signals (5)
        hasPrivacyKeyword,
        hasTermsKeyword,
        hasCookieKeyword,
        hasLegalKeyword,
        textMatchStrength,
        // URL signals (6)
        urlHasPrivacyPath,
        urlHasTermsPath,
        urlHasLegalPath,
        urlDepth,
        urlLength,
        urlIsHttps,
        // Context signals (4)
        isInFooter,
        isInNav,
        isInLegalHub,
        isInBody,
        // Content signals (5)
        pageHasPrivacyContent,
        pageHasPolicyStructure,
        pageHasLegalJargon,
        pageWordCount,
        pageHasContactInfo,
        // Link characteristics (4)
        linkTextLength,
        linkHasIcon,
        linkIsExternal,
        linkHasYear
    ];
}

/**
 * Extract features from a URL for policy detection
 * Simplified version when we only have URL
 */
export function extractUrlFeatures(url: string, baseUrl: string): number[] {
    try {
        const urlObj = new URL(url, baseUrl);
        const path = urlObj.pathname.toLowerCase();
        
        // Just extract URL-based features + defaults for others
        return extractCarlFeatures(path, url, 'unknown', baseUrl);
    } catch {
        return new Array(CARL_FEATURE_COUNT).fill(0);
    }
}

/**
 * Get feature names for debugging/visualization
 */
export function getCarlFeatureNames(): string[] {
    return [
        'hasPrivacyKeyword', 'hasTermsKeyword', 'hasCookieKeyword', 
        'hasLegalKeyword', 'textMatchStrength',
        'urlHasPrivacyPath', 'urlHasTermsPath', 'urlHasLegalPath',
        'urlDepth', 'urlLength', 'urlIsHttps',
        'isInFooter', 'isInNav', 'isInLegalHub', 'isInBody',
        'pageHasPrivacyContent', 'pageHasPolicyStructure', 'pageHasLegalJargon',
        'pageWordCount', 'pageHasContactInfo',
        'linkTextLength', 'linkHasIcon', 'linkIsExternal', 'linkHasYear'
    ];
}

// Export keyword lists for external use
export { PRIVACY_KEYWORDS, TERMS_KEYWORDS, COOKIE_KEYWORDS, LEGAL_HUB_KEYWORDS, POLICY_URL_PATTERNS };
