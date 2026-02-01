/**
 * DOMAIN VALIDATION & BLOCKLIST
 * 
 * Prevents the discovery engine from returning social media profiles,
 * aggregator sites, or other non-official company domains as privacy policy sources.
 * 
 * @author PolicyParser
 * @version 2.0.0
 */

import { parse } from 'tldts';
import { logger } from '../logger';

/**
 * Domains that should NEVER be returned as a company's official domain
 * These are social media, aggregator, and directory sites
 */
export const BLOCKED_DOMAINS: string[] = [
    // Social Media Platforms
    'linkedin.com',
    'facebook.com',
    'twitter.com',
    'x.com',
    'instagram.com',
    'tiktok.com',
    'youtube.com',
    'pinterest.com',
    'reddit.com',
    'tumblr.com',
    'snapchat.com',
    'threads.net',
    'mastodon.social',
    'bsky.app',
    
    // Business Directories & Reviews
    'yelp.com',
    'yellowpages.com',
    'bbb.org',
    'trustpilot.com',
    'glassdoor.com',
    'indeed.com',
    'crunchbase.com',
    'zoominfo.com',
    'dnb.com',
    'hoovers.com',
    'manta.com',
    'buzzfile.com',
    'corporationwiki.com',
    'opencorporates.com',
    'companieshouse.gov.uk',
    
    // News & Media Aggregators
    'wikipedia.org',
    'wikimedia.org',
    'wikidata.org',
    'britannica.com',
    'bloomberg.com',
    'reuters.com',
    'forbes.com',
    'businessinsider.com',
    'ft.com',
    'wsj.com',
    'nytimes.com',
    'theguardian.com',
    'bbc.com',
    'bbc.co.uk',
    'cnn.com',
    'cnbc.com',
    'marketwatch.com',
    
    // Search Engines
    'google.com',
    'google.de',
    'google.co.uk',
    'google.fr',
    'google.es',
    'google.it',
    'bing.com',
    'yahoo.com',
    'duckduckgo.com',
    'baidu.com',
    'yandex.ru',
    'yandex.com',
    
    // Tech Directories
    'github.com',
    'gitlab.com',
    'bitbucket.org',
    'sourceforge.net',
    'npmjs.com',
    'pypi.org',
    'packagist.org',
    'rubygems.org',
    'crates.io',
    'nuget.org',
    'hub.docker.com',
    
    // App Stores
    'apps.apple.com',
    'play.google.com',
    'microsoft.com/store',
    'store.steampowered.com',
    'amazon.com/dp',
    
    // Job Sites
    'monster.com',
    'ziprecruiter.com',
    'careerbuilder.com',
    'simplyhired.com',
    'dice.com',
    'hired.com',
    'angellist.com',
    'wellfound.com',
    
    // Finance/Stock Sites
    'finance.yahoo.com',
    'seekingalpha.com',
    'morningstar.com',
    'fool.com',
    'investopedia.com',
    'stocktwits.com',
    'tradingview.com',
    
    // Domain/Hosting Registrars
    'godaddy.com',
    'namecheap.com',
    'cloudflare.com',
    'domains.google',
    'hover.com',
    'name.com',
    'dynadot.com',
    
    // Generic Hosting/Platforms
    'wordpress.com',
    'blogger.com',
    'medium.com',
    'substack.com',
    'squarespace.com',
    'wix.com',
    'weebly.com',
    'shopify.com',
    'bigcommerce.com',
    'woocommerce.com',
    
    // URL Shorteners
    'bit.ly',
    'tinyurl.com',
    't.co',
    'goo.gl',
    'ow.ly',
    'rebrand.ly',
    'is.gd',
    
    // Email Providers (when used as redirect)
    'mail.google.com',
    'outlook.live.com',
    'mail.yahoo.com',
    
    // Other Aggregators
    'archive.org',
    'web.archive.org',
    'similarweb.com',
    'alexa.com',
    'semrush.com',
    'ahrefs.com',
    
    // German Business Directories
    'firmenwissen.de',
    'northdata.de',
    'bundesanzeiger.de',
    'unternehmensregister.de',
    'handelsregister.de',
    'gelbeseiten.de',
    'meinestadt.de',
    '11880.com',
    'wlw.de',
    'kompass.com',
    
    // International Business Directories
    'europages.com',
    'dnb.com',
    'duedil.com',
    'endole.co.uk',
    'companieslist.co.uk',
];

/**
 * Patterns for domains that should be blocked
 * (for dynamic matching where exact domain isn't enough)
 */
export const BLOCKED_DOMAIN_PATTERNS: RegExp[] = [
    // Social media profile pages
    /linkedin\.com\/company\//i,
    /linkedin\.com\/in\//i,
    /facebook\.com\/.*\/(?!privacy|policy|legal)/i,
    /twitter\.com\/(?!.*privacy|.*policy|.*tos)/i,
    /instagram\.com\/(?!.*privacy|.*policy)/i,
    
    // Search result pages
    /google\.[a-z]+\/search/i,
    /bing\.com\/search/i,
    /duckduckgo\.com\/\?q=/i,
    
    // Wikipedia articles (not policy pages)
    /wikipedia\.org\/wiki\/(?!Privacy|Terms|Legal)/i,
    
    // News articles about companies
    /bloomberg\.com\/profile\//i,
    /reuters\.com\/companies\//i,
    /forbes\.com\/companies\//i,
    
    // Aggregator/directory profiles
    /crunchbase\.com\/organization\//i,
    /glassdoor\.[a-z]+\/Overview\//i,
    /indeed\.com\/cmp\//i,
    /yelp\.[a-z]+\/biz\//i,
    
    // Archive pages
    /web\.archive\.org\/web\//i,
    /archive\.org\/details\//i,
];

/**
 * Check if a domain is on the blocklist
 */
export function isBlockedDomain(domain: string): boolean {
    const normalizedDomain = domain.toLowerCase().replace(/^www\./, '');
    
    // Check exact matches
    if (BLOCKED_DOMAINS.includes(normalizedDomain)) {
        return true;
    }
    
    // Check if it's a subdomain of a blocked domain
    for (const blocked of BLOCKED_DOMAINS) {
        if (normalizedDomain.endsWith('.' + blocked)) {
            return true;
        }
    }
    
    return false;
}

/**
 * Check if a URL matches any blocked pattern
 */
export function isBlockedUrl(url: string): boolean {
    // First check domain
    try {
        const urlObj = new URL(url);
        if (isBlockedDomain(urlObj.hostname)) {
            return true;
        }
    } catch {
        // Invalid URL
        return true;
    }
    
    // Then check URL patterns
    for (const pattern of BLOCKED_DOMAIN_PATTERNS) {
        if (pattern.test(url)) {
            return true;
        }
    }
    
    return false;
}

/**
 * Validate that a URL is appropriate for a given company domain
 * Returns true if the URL appears to belong to the company
 */
export function validateUrlForDomain(url: string, targetDomain: string): { 
    isValid: boolean; 
    reason?: string;
    confidence: number;
} {
    try {
        const urlObj = new URL(url);
        const urlDomain = urlObj.hostname.toLowerCase().replace(/^www\./, '');
        const targetNormalized = targetDomain.toLowerCase().replace(/^www\./, '');
        
        // Check if blocked
        if (isBlockedUrl(url)) {
            return {
                isValid: false,
                reason: `URL is from a blocked domain type (social media, directory, etc.)`,
                confidence: 0
            };
        }
        
        // Parse both domains
        const urlParsed = parse(urlDomain);
        const targetParsed = parse(targetNormalized);
        
        // Exact domain match = high confidence
        if (urlDomain === targetNormalized || 
            urlDomain === 'www.' + targetNormalized ||
            'www.' + urlDomain === targetNormalized) {
            return { isValid: true, confidence: 100 };
        }
        
        // Same root domain (e.g., policies.google.com for google.com)
        if (urlParsed.domain === targetParsed.domain) {
            return { isValid: true, confidence: 95 };
        }
        
        // Check for known related domains (e.g., meta.com owns facebook.com)
        const relatedDomains = getRelatedDomains(targetNormalized);
        if (relatedDomains.includes(urlParsed.domain || '')) {
            return { isValid: true, confidence: 90 };
        }
        
        // Different domain entirely
        return {
            isValid: false,
            reason: `URL domain (${urlDomain}) doesn't match target domain (${targetNormalized})`,
            confidence: 0
        };
        
    } catch (error) {
        return {
            isValid: false,
            reason: 'Invalid URL format',
            confidence: 0
        };
    }
}

/**
 * Get related/owned domains for a company
 * (Companies like Meta own multiple domains)
 */
function getRelatedDomains(domain: string): string[] {
    const relatedDomainsMap: Record<string, string[]> = {
        'meta.com': ['facebook.com', 'instagram.com', 'whatsapp.com', 'threads.net', 'oculus.com'],
        'facebook.com': ['meta.com', 'instagram.com', 'whatsapp.com', 'threads.net'],
        'instagram.com': ['meta.com', 'facebook.com'],
        'whatsapp.com': ['meta.com', 'facebook.com'],
        
        'google.com': ['youtube.com', 'alphabet.com', 'blogger.com', 'google.de', 'google.co.uk'],
        'youtube.com': ['google.com', 'alphabet.com'],
        'alphabet.com': ['google.com', 'youtube.com'],
        
        'microsoft.com': ['linkedin.com', 'github.com', 'xbox.com', 'azure.com', 'bing.com', 'live.com', 'outlook.com'],
        
        'amazon.com': ['aws.amazon.com', 'twitch.tv', 'imdb.com', 'whole foods.com', 'ring.com'],
        'twitch.tv': ['amazon.com'],
        
        'apple.com': ['icloud.com', 'me.com', 'apple.de', 'apple.co.uk'],
        
        'twitter.com': ['x.com'],
        'x.com': ['twitter.com'],
        
        'valve.com': ['steampowered.com', 'steamcommunity.com'],
        'steampowered.com': ['valve.com', 'steamcommunity.com'],
    };
    
    return relatedDomainsMap[domain] || [];
}

/**
 * Calculate a quality score for a domain as a privacy policy source
 * Higher score = more likely to be a legitimate company website
 */
export function calculateDomainQualityScore(domain: string, url: string): number {
    let score = 50; // Base score
    
    const normalizedDomain = domain.toLowerCase().replace(/^www\./, '');
    const urlLower = url.toLowerCase();
    
    // Blocked domain = 0
    if (isBlockedDomain(normalizedDomain) || isBlockedUrl(url)) {
        return 0;
    }
    
    // TLD quality bonus
    const tldScores: Record<string, number> = {
        '.com': 10,
        '.de': 10,      // German companies
        '.co.uk': 10,
        '.org': 8,
        '.net': 5,
        '.io': 3,       // Tech companies
        '.app': 3,
        '.bank': 15,    // Banks (highly regulated TLD)
        '.insurance': 15,
        '.gov': 20,     // Government
        '.edu': 15,     // Education
    };
    
    for (const [tld, bonus] of Object.entries(tldScores)) {
        if (normalizedDomain.endsWith(tld)) {
            score += bonus;
            break;
        }
    }
    
    // URL path quality indicators
    if (/\/(privacy|legal|datenschutz|confidentialite|privacidad)/i.test(urlLower)) {
        score += 15; // Clear privacy path
    }
    
    if (/\/(about|corporate|company|unternehmen)/i.test(urlLower)) {
        score += 5; // Corporate section
    }
    
    // Penalty for suspicious patterns
    if (/\/profile\//i.test(urlLower)) {
        score -= 30; // Likely a profile page, not official site
    }
    
    if (/\/(company|business|org)\/[a-z0-9-]+$/i.test(urlLower)) {
        score -= 40; // Directory listing pattern
    }
    
    if (/\?.*(?:id|ref|source|utm)=/i.test(urlLower)) {
        score -= 5; // Tracking parameters (not necessarily bad)
    }
    
    return Math.max(0, Math.min(100, score));
}

/**
 * Enhanced URL validation that combines all checks
 */
export function validatePolicyUrl(url: string, targetDomain: string): {
    isValid: boolean;
    confidence: number;
    qualityScore: number;
    issues: string[];
} {
    const issues: string[] = [];
    
    // Domain validation
    const domainValidation = validateUrlForDomain(url, targetDomain);
    if (!domainValidation.isValid) {
        issues.push(domainValidation.reason || 'Domain mismatch');
    }
    
    // Quality score
    const qualityScore = calculateDomainQualityScore(targetDomain, url);
    if (qualityScore < 30) {
        issues.push('Low quality domain score');
    }
    
    // Blocked check
    if (isBlockedUrl(url)) {
        issues.push('URL matches blocked pattern');
    }
    
    // Calculate final validity
    const isValid = domainValidation.isValid && qualityScore >= 30 && !isBlockedUrl(url);
    
    // Calculate confidence
    let confidence = domainValidation.confidence;
    if (qualityScore >= 70) confidence = Math.min(100, confidence + 10);
    if (qualityScore < 50) confidence = Math.max(0, confidence - 20);
    
    return {
        isValid,
        confidence,
        qualityScore,
        issues
    };
}

/**
 * Log domain validation result for debugging
 */
export function logValidation(url: string, targetDomain: string): void {
    const result = validatePolicyUrl(url, targetDomain);
    
    logger.info(`Domain validation for ${url}`, {
        targetDomain,
        isValid: result.isValid,
        confidence: result.confidence,
        qualityScore: result.qualityScore,
        issues: result.issues
    });
}
