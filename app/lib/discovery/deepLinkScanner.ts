/**
 * DEEP LINK SCANNER - Industry State-of-the-Art Privacy Policy Discovery
 * 
 * This module implements deep scanning for nested privacy policy links.
 * Many European companies (especially German banks like Berenberg) have a pattern where:
 * - /datenschutz/ is a landing/hub page
 * - /datenschutz/datenschutzerklaerung/ is the ACTUAL privacy policy
 * 
 * This scanner follows initial privacy links and searches for more specific nested links.
 */

import got from 'got';
import * as cheerio from 'cheerio';
import { URL } from 'url';
import { logger } from '../logger';
import { CONFIG } from '../config';
import { isPrivacyUrl, isPrivacyLinkText, scorePrivacyUrl, scoreLinkText } from './multilingual';
import { isBlockedUrl, validateUrlForDomain } from './domainValidator';
import { enforceRateLimit } from './rateLimiter';

export interface DeepScanResult {
    originalUrl: string;
    foundUrl: string;
    confidence: number;
    reason: string;
    depth: number;
}

/**
 * Keywords indicating we're on a landing/hub page, not the actual policy
 */
const HUB_PAGE_INDICATORS = [
    // German
    'übersicht', 'uebersicht', 'überblick', 'ueberblick',
    'wählen sie', 'waehlen sie', 'auswahl', 'themen',
    // English
    'overview', 'select', 'choose', 'hub', 'landing',
    // French
    'aperçu', 'sélectionner', 'choisir',
    // Spanish
    'descripción general', 'seleccionar',
];

/**
 * Keywords indicating we've found the ACTUAL policy (not a hub)
 */
const ACTUAL_POLICY_INDICATORS = {
    german: [
        'datenschutzerklaerung', 'datenschutzerklarung', 'datenschutzerklärung',
        'datenschutzhinweise', 'datenschutzrichtlinie',
        'personenbezogene daten', 'wir erheben', 'wir verarbeiten',
        'verantwortlich', 'betroffenenrechte', 'datenverarbeitung',
        'rechtsgrundlage', 'art. 6', 'art. 13', 'dsgvo',
        'auskunftsrecht', 'löschung', 'berichtigung',
    ],
    english: [
        'privacy policy', 'privacy statement', 'privacy notice',
        'personal data', 'we collect', 'we process', 'data controller',
        'your rights', 'data subject', 'gdpr', 'article 6', 'article 13',
        'right to access', 'right to erasure', 'right to rectification',
    ],
    french: [
        'politique de confidentialité', 'données personnelles',
        'nous collectons', 'traitement des données',
        'droits des personnes', 'rgpd',
    ],
    spanish: [
        'política de privacidad', 'datos personales',
        'recopilamos', 'tratamiento de datos',
        'derechos de los usuarios', 'rgpd',
    ],
};

/**
 * Nested paths that commonly contain the actual privacy policy
 */
const NESTED_PRIVACY_PATHS = [
    // German patterns (prioritized - most common for German banks)
    '/datenschutzerklaerung',
    '/datenschutzerklarung',
    '/datenschutzhinweise',
    '/datenschutzrichtlinie',
    '/privacy-policy',
    '/details',
    '/vollstaendig',
    '/komplett',
    '/informationen',
    // English patterns
    '/privacy-policy',
    '/privacy-statement',
    '/privacy-notice',
    '/full-policy',
    '/details',
    '/complete',
    // French patterns
    '/politique-de-confidentialite',
    '/declaration-de-confidentialite',
    // Spanish patterns
    '/politica-de-privacidad',
    '/aviso-de-privacidad',
];

/**
 * User agent for scanning
 */
const SCANNER_UA = 'Mozilla/5.0 (compatible; PrivacyPolicyBot/2.0; +https://policyparser.pro)';

/**
 * Main deep scan function - follows a privacy URL and looks for nested policy links
 */
export async function deepScanPrivacyPage(
    initialUrl: string,
    domain: string,
    maxDepth: number = 2
): Promise<DeepScanResult | null> {
    logger.info(`[DeepScanner] Starting deep scan from ${initialUrl} (max depth: ${maxDepth})`);
    
    const visited = new Set<string>();
    const results: DeepScanResult[] = [];
    
    await scanPage(initialUrl, domain, 0, maxDepth, visited, results);
    
    if (results.length === 0) {
        logger.info(`[DeepScanner] No deeper policy found, original URL is best`);
        return null;
    }
    
    // Sort by confidence (highest first)
    results.sort((a, b) => b.confidence - a.confidence);
    
    const best = results[0];
    logger.info(`[DeepScanner] Found better policy: ${best.foundUrl} (confidence: ${best.confidence})`);
    
    return best;
}

/**
 * Recursive page scanning
 */
async function scanPage(
    url: string,
    domain: string,
    depth: number,
    maxDepth: number,
    visited: Set<string>,
    results: DeepScanResult[]
): Promise<void> {
    // Normalize URL for dedup
    const normalizedUrl = normalizeUrl(url);
    if (visited.has(normalizedUrl)) return;
    visited.add(normalizedUrl);
    
    if (depth > maxDepth) return;
    
    try {
        logger.info(`[DeepScanner] Scanning page at depth ${depth}: ${url}`);
        
        // Enforce rate limiting before request
        await enforceRateLimit(url);
        
        const response = await got(url, {
            timeout: { request: 10000 },
            headers: {
                'User-Agent': SCANNER_UA,
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7,fr;q=0.6,es;q=0.5',
            },
            retry: { limit: 0 } as any,  // Handle retries ourselves
            followRedirect: true,
            throwHttpErrors: false,
        });
        
        // Handle rate limiting
        if (response.statusCode === 429) {
            logger.warn(`[DeepScanner] Rate limited (429) on ${url}`);
            return;
        }
        
        if (response.statusCode !== 200) {
            logger.info(`[DeepScanner] Page returned ${response.statusCode}`);
            return;
        }
        
        const $ = cheerio.load(response.body);
        const pageText = $('body').text().toLowerCase();
        
        // Check if current page IS the actual policy (not a hub)
        const isActualPolicy = checkIfActualPolicy(pageText);
        const isHubPage = checkIfHubPage(pageText);
        
        logger.info(`[DeepScanner] Page analysis: isActualPolicy=${isActualPolicy}, isHubPage=${isHubPage}`);
        
        // Collect all links on this page
        const links: { href: string; text: string; score: number }[] = [];
        
        // Scan main content area for nested policy links
        $('main a, article a, .content a, #content a, .main-content a').each((_, el) => {
            processLink($, el, url, domain, links);
        });
        
        // Also scan navigation within the page
        $('nav a, .nav a, .navigation a, .sidebar a, .menu a').each((_, el) => {
            processLink($, el, url, domain, links);
        });
        
        // Scan entire body if we haven't found much
        if (links.length < 3) {
            $('a').each((_, el) => {
                processLink($, el, url, domain, links);
            });
        }
        
        // De-duplicate and sort by score
        const uniqueLinks = deduplicateLinks(links);
        uniqueLinks.sort((a, b) => b.score - a.score);
        
        logger.info(`[DeepScanner] Found ${uniqueLinks.length} potential policy links`);
        
        // Process top candidates
        for (const link of uniqueLinks.slice(0, 5)) {
            // Skip if same as current URL
            if (normalizeUrl(link.href) === normalizedUrl) continue;
            
            // Skip if not on the same domain
            const validation = validateUrlForDomain(link.href, domain);
            if (!validation.isValid) continue;
            
            // Calculate confidence
            let confidence = 50 + link.score;
            
            // Boost for specific privacy path patterns
            const lowerHref = link.href.toLowerCase();
            if (lowerHref.includes('datenschutzerklaerung') || 
                lowerHref.includes('datenschutzerklarung') ||
                lowerHref.includes('datenschutzhinweise')) {
                confidence += 30;
            }
            if (lowerHref.includes('privacy-policy') || 
                lowerHref.includes('privacy-statement')) {
                confidence += 25;
            }
            
            // Boost if coming from a hub page
            if (isHubPage) {
                confidence += 15;
            }
            
            // Boost for deeper path
            if (depth > 0) {
                confidence += 10;
            }
            
            // If this looks like the actual policy, add it as a result
            if (confidence >= 70) {
                results.push({
                    originalUrl: url,
                    foundUrl: link.href,
                    confidence: Math.min(confidence, 98),
                    reason: `Found nested link "${link.text}" with score ${link.score}`,
                    depth: depth + 1,
                });
            }
            
            // Recursively scan if it looks promising
            if (confidence >= 60 && depth < maxDepth) {
                await scanPage(link.href, domain, depth + 1, maxDepth, visited, results);
            }
        }
        
        // Also try known nested paths directly
        if (depth === 0) {
            await tryNestedPaths(url, domain, visited, results);
        }
        
    } catch (error: any) {
        logger.debug(`[DeepScanner] Error scanning ${url}: ${error.message}`);
    }
}

/**
 * Process a link element
 */
function processLink(
    $: cheerio.CheerioAPI,
    el: any,
    baseUrl: string,
    domain: string,
    links: { href: string; text: string; score: number }[]
): void {
    const href = $(el).attr('href');
    const text = $(el).text().trim();
    
    if (!href || href === '#' || href.startsWith('javascript:') || href.startsWith('mailto:')) {
        return;
    }
    
    try {
        const absoluteUrl = new URL(href, baseUrl).toString();
        
        // Skip blocked URLs
        if (isBlockedUrl(absoluteUrl)) return;
        
        // Check if it's privacy-related
        const lowerHref = href.toLowerCase();
        const lowerText = text.toLowerCase();
        
        // Calculate score
        let score = 0;
        
        // URL scoring
        score += scorePrivacyUrl(lowerHref);
        
        // Text scoring
        score += scoreLinkText(lowerText);
        
        // Specific German nested path bonus
        if (lowerHref.includes('datenschutzerklaerung') ||
            lowerHref.includes('datenschutzerklarung') ||
            lowerHref.includes('datenschutzhinweise') ||
            lowerHref.includes('datenschutzrichtlinie')) {
            score += 40;
        }
        
        // General nested privacy path bonus
        if (lowerHref.includes('privacy-policy') ||
            lowerHref.includes('privacy-statement') ||
            lowerHref.includes('privacy-notice')) {
            score += 35;
        }
        
        // Only add if it looks privacy-related
        if (score > 5 || isPrivacyUrl(lowerHref) || isPrivacyLinkText(lowerText)) {
            links.push({ href: absoluteUrl, text: text.slice(0, 100), score });
        }
        
    } catch {
        // Invalid URL
    }
}

/**
 * Try known nested paths directly
 */
async function tryNestedPaths(
    basePrivacyUrl: string,
    domain: string,
    visited: Set<string>,
    results: DeepScanResult[]
): Promise<void> {
    logger.info(`[DeepScanner] Trying known nested paths from ${basePrivacyUrl}`);
    
    // Parse the base URL
    const urlObj = new URL(basePrivacyUrl);
    const basePath = urlObj.pathname.replace(/\/$/, ''); // Remove trailing slash
    
    for (const nestedPath of NESTED_PRIVACY_PATHS) {
        const testUrl = `${urlObj.origin}${basePath}${nestedPath}`;
        const normalizedTest = normalizeUrl(testUrl);
        
        if (visited.has(normalizedTest)) continue;
        visited.add(normalizedTest);
        
        try {
            // Enforce rate limiting before request
            await enforceRateLimit(testUrl);
            
            const response = await got(testUrl, {
                timeout: { request: 5000 },
                headers: {
                    'User-Agent': SCANNER_UA,
                    'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
                },
                retry: { limit: 0 } as any,
                followRedirect: true,
                throwHttpErrors: false,
            });
            
            // Handle rate limiting
            if (response.statusCode === 429) {
                logger.warn(`[DeepScanner] Rate limited (429) on ${testUrl}, stopping nested path search`);
                break;  // Stop trying more paths if rate limited
            }
            
            if (response.statusCode === 200 && response.body.length > 2000) {
                // Verify it's actually a policy page
                const $ = cheerio.load(response.body);
                const pageText = $('body').text().toLowerCase();
                
                if (checkIfActualPolicy(pageText)) {
                    logger.info(`[DeepScanner] Found nested policy at ${testUrl}`);
                    
                    let confidence = 85;
                    if (testUrl.includes('datenschutzerklaerung') ||
                        testUrl.includes('datenschutzerklarung')) {
                        confidence = 95;
                    }
                    
                    results.push({
                        originalUrl: basePrivacyUrl,
                        foundUrl: testUrl,
                        confidence,
                        reason: `Direct nested path ${nestedPath} exists and contains policy content`,
                        depth: 1,
                    });
                }
            }
        } catch {
            // Path doesn't exist or error
        }
    }
}

/**
 * Check if page content indicates it's the actual policy (not a hub)
 */
function checkIfActualPolicy(pageText: string): boolean {
    const lowerText = pageText.toLowerCase();
    
    // Count matches across all languages
    let matches = 0;
    
    for (const indicators of Object.values(ACTUAL_POLICY_INDICATORS)) {
        for (const indicator of indicators) {
            if (lowerText.includes(indicator)) {
                matches++;
            }
        }
    }
    
    // If we have several policy indicators, it's likely the actual policy
    return matches >= 5;
}

/**
 * Check if page content indicates it's a hub/landing page
 */
function checkIfHubPage(pageText: string): boolean {
    const lowerText = pageText.toLowerCase();
    
    for (const indicator of HUB_PAGE_INDICATORS) {
        if (lowerText.includes(indicator)) {
            return true;
        }
    }
    
    return false;
}

/**
 * Normalize URL for comparison
 */
function normalizeUrl(url: string): string {
    try {
        const urlObj = new URL(url);
        // Remove trailing slash, lowercase
        return `${urlObj.origin}${urlObj.pathname.replace(/\/$/, '')}`.toLowerCase();
    } catch {
        return url.toLowerCase();
    }
}

/**
 * De-duplicate links by URL
 */
function deduplicateLinks(
    links: { href: string; text: string; score: number }[]
): { href: string; text: string; score: number }[] {
    const seen = new Map<string, { href: string; text: string; score: number }>();
    
    for (const link of links) {
        const normalized = normalizeUrl(link.href);
        const existing = seen.get(normalized);
        
        if (!existing || existing.score < link.score) {
            seen.set(normalized, link);
        }
    }
    
    return Array.from(seen.values());
}

export {
    checkIfActualPolicy,
    checkIfHubPage,
    ACTUAL_POLICY_INDICATORS,
    HUB_PAGE_INDICATORS,
    NESTED_PRIVACY_PATHS,
};
