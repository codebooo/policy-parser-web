/**
 * INTELLIGENT POLICY DISCOVERY ENGINE v4.0 - TURBO EDITION
 * 
 * Ultra-fast parallel discovery with aggressive timeouts.
 * Target: Complete discovery in under 10 seconds.
 * 
 * STRATEGY:
 * - Run all discovery phases in PARALLEL
 * - Use aggressive 3-second timeouts
 * - Skip validation for high-confidence links (Carl score > 0.7)
 * - Early exit when core policies found
 * 
 * PHASES (run in parallel):
 * 1. Special domain lookup (instant - no fetch needed)
 * 2. Homepage crawl (footer + body links)
 * 3. Common URL patterns (direct checks)
 * 4. Sitemap parsing (background)
 */

import got from 'got';
import * as cheerio from 'cheerio';
import { CONFIG, PolicyType } from '../config';
import { logger } from '../logger';
// import { deepScanPrivacyPage } from './deepLinkScanner'; // Disabled for TURBO mode
import { Carl, getCarl, extractCarlFeatures } from '../carl';

export interface DiscoveredPolicy {
    type: PolicyType;
    name: string;
    url: string;
    confidence: 'high' | 'medium' | 'low';
    source: 'special_domain' | 'footer_link' | 'legal_page' | 'sitemap' | 'search_engine' | 'content_analysis';
    neuralScore?: number; // Added neural score
}

export interface DiscoveryResult {
    success: boolean;
    domain: string;
    policies: DiscoveredPolicy[];
    discoveryTime: number;
    phasesCompleted: string[];
    error?: string;
}

// Common footer selectors across different website designs
const FOOTER_SELECTORS = [
    'footer',
    '#footer',
    '.footer',
    '[role="contentinfo"]',
    '.site-footer',
    '#site-footer',
    '.page-footer',
    '#page-footer',
    '.global-footer',
    '.main-footer',
    '.bottom-nav',
    '.footer-nav',
    '.footer-links',
    '.legal-links',
    '.legal-footer',
    '.copyright',
    '.footer-legal',
    '.footer-bottom',
    // Steam-specific
    '.valve_links',
    '#footer_text',
    '#footer_logo_steam',
    // Common CMS patterns
    '.wp-block-template-part', // WordPress
    '.elementor-location-footer', // Elementor
];

// Keywords that MUST appear in the content to validate it's a policy
const POLICY_VALIDATION_KEYWORDS: Record<PolicyType, string[]> = {
    privacy: [
        'collect', 'personal data', 'personal information', 'information we collect',
        'data we collect', 'privacy', 'cookies', 'third parties', 'share',
        'your rights', 'data protection', 'processing', 'consent',
        // German
        'datenschutz', 'personenbezogene daten', 'erheben', 'verarbeitung', 
        'einwilligung', 'ihre rechte', 'dritte', 'speichern', 'betroffene',
        // Spanish
        'datos personales', 'recopilar', 'privacidad', 'consentimiento',
        // French
        'données personnelles', 'collecte', 'traitement', 'consentement'
    ],
    terms: [
        'agreement', 'license', 'prohibited', 'termination', 'liability',
        'warranty', 'indemnify', 'governing law', 'dispute', 'arbitration',
        'user conduct', 'acceptable use', 'intellectual property',
        // German
        'nutzungsbedingungen', 'haftung', 'gewährleistung', 'kündigung',
        'vereinbarung', 'verboten', 'streitigkeiten', 'geistiges eigentum',
        // Spanish
        'términos', 'condiciones', 'acuerdo', 'responsabilidad',
        // French
        'conditions', 'utilisation', 'responsabilité', 'accord'
    ],
    cookies: [
        'cookie', 'cookies', 'tracking', 'analytics', 'advertising cookies',
        'session', 'persistent', 'third-party cookies', 'opt-out', 'consent',
        // German
        'tracking', 'analyse', 'werbecookies', 'einwilligung'
    ],
    security: [
        'security', 'encryption', 'protect', 'secure', 'vulnerability',
        'authentication', 'access control', 'safeguards', 'breach', 'incident',
        // German
        'sicherheit', 'verschlüsselung', 'schutz', 'zugriff'
    ],
    gdpr: [
        'gdpr', 'european', 'data subject', 'right to erasure', 'portability',
        'legitimate interest', 'lawful basis', 'processing', 'controller', 'processor',
        // German
        'dsgvo', 'betroffenenrechte', 'löschung', 'datenübertragbarkeit'
    ],
    ccpa: [
        'ccpa', 'california', 'do not sell', 'opt-out', 'consumer rights',
        'shine the light', 'personal information', 'categories', 'disclosed'
    ],
    ai: [
        'artificial intelligence', 'machine learning', 'ai', 'model',
        'training data', 'automated', 'algorithm', 'generative'
    ],
    acceptable_use: [
        'acceptable use', 'prohibited', 'abuse', 'spam', 'harassment',
        'content policy', 'community guidelines', 'violations', 'enforcement'
    ]
};

// Link text patterns that indicate policy links
const POLICY_LINK_PATTERNS: Record<PolicyType, RegExp[]> = {
    privacy: [
        /privacy\s*(policy|notice|statement)?/i,
        /data\s*(protection|policy)/i,
        /personal\s*(data|information)/i,
        /datenschutz/i, // German
        /privacidad/i, // Spanish
        /confidentialit[eé]/i, // French
    ],
    terms: [
        /terms\s*(of\s*)?(service|use|agreement)?/i,
        /user\s*agreement/i,
        /legal\s*(terms|agreement)/i,
        /conditions?\s*(of\s*)?(use|service)?/i,
        /subscriber\s*agreement/i,
        /eula|end\s*user/i,
        /nutzungsbedingungen/i, // German
        /agb/i, // German abbreviation
    ],
    cookies: [
        /cookie\s*(policy|notice|settings)?/i,
        /cookies/i,
        /tracking/i,
    ],
    security: [
        /security\s*(policy|center|info)?/i,
        /trust\s*(center)?/i,
        /data\s*security/i,
    ],
    gdpr: [
        /gdpr/i,
        /eu\s*privacy/i,
        /european?\s*(privacy|data)/i,
    ],
    ccpa: [
        /ccpa/i,
        /california\s*(privacy|consumer)/i,
        /do\s*not\s*sell/i,
        /your\s*privacy\s*choices/i,
    ],
    ai: [
        /ai\s*(policy|terms|guidelines)?/i,
        /machine\s*learning/i,
        /artificial\s*intelligence/i,
    ],
    acceptable_use: [
        /acceptable\s*use/i,
        /aup/i,
        /community\s*(guidelines|standards)/i,
        /user\s*guidelines/i,
        /content\s*policy/i,
    ]
};

// URLs that are known to be legal hubs/indexes (not the policies themselves)
const LEGAL_HUB_PATTERNS = [
    /\/legal\/?$/i,
    /\/policies\/?$/i,
    /\/legal\/index/i,
    /\/about\/legal\/?$/i,
    /\/company\/legal\/?$/i,
];

// User agent for crawling
const CRAWLER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// TURBO: Aggressive timeout for fast discovery
const FAST_TIMEOUT = 3000; // 3 seconds max per request
const MEDIUM_TIMEOUT = 5000; // 5 seconds for important requests

// Common policy URL patterns to try directly (very fast)
const COMMON_POLICY_PATHS: Record<PolicyType, string[]> = {
    privacy: ['/privacy', '/privacy-policy', '/privacypolicy', '/datenschutz', '/privacy.html'],
    terms: ['/terms', '/tos', '/terms-of-service', '/terms-of-use', '/nutzungsbedingungen', '/agb'],
    cookies: ['/cookies', '/cookie-policy'],
    security: ['/security'],
    gdpr: ['/gdpr', '/eu-privacy'],
    ccpa: ['/ccpa', '/privacy-rights'],
    ai: ['/ai-policy', '/ai-terms'],
    acceptable_use: ['/acceptable-use', '/aup', '/community-guidelines']
};

/**
 * Main discovery function - TURBO PARALLEL VERSION
 * Target: Complete in under 10 seconds
 */
export async function discoverPolicies(domain: string): Promise<DiscoveryResult> {
    const startTime = Date.now();
    const phasesCompleted: string[] = [];

    const baseUrl = domain.startsWith('http') ? domain : `https://${domain}`;
    const cleanDomain = new URL(baseUrl).hostname.replace(/^www\./, '');

    logger.info(`[PolicyDiscovery] 🚀 TURBO discovery starting for: ${cleanDomain}`);

    // Initialize Carl Neural Network
    const nn = await getCarl();

    try {
        // ============ RUN ALL DISCOVERY IN PARALLEL ============
        const [specialPolicies, crawlResults, directHits] = await Promise.all([
            // Phase 1: Special domain lookup (instant - config only)
            checkSpecialDomains(cleanDomain, baseUrl),
            
            // Phase 2: Homepage crawl (footer + body links) - MAIN PHASE
            crawlHomepageFast(baseUrl, cleanDomain, nn),
            
            // Phase 3: Direct URL pattern checks (parallel probes)
            probeCommonPaths(baseUrl, cleanDomain)
        ]);

        phasesCompleted.push(`special:${specialPolicies.length}`);
        phasesCompleted.push(`crawl:${crawlResults.length}`);
        phasesCompleted.push(`direct:${directHits.length}`);

        // Merge results (priority: special > crawl > direct)
        const discoveredPolicies = new Map<PolicyType, DiscoveredPolicy>();
        
        // Add special domain policies first (highest priority)
        specialPolicies.forEach(p => discoveredPolicies.set(p.type, p));
        
        // Add crawled policies (good confidence from link text + Carl)
        crawlResults.forEach(p => {
            if (!discoveredPolicies.has(p.type)) {
                discoveredPolicies.set(p.type, p);
            }
        });
        
        // Add direct hits as fallback
        directHits.forEach(p => {
            if (!discoveredPolicies.has(p.type)) {
                discoveredPolicies.set(p.type, p);
            }
        });

        // Quick validation only for low-confidence finds
        const finalPolicies: DiscoveredPolicy[] = [];
        const validationPromises: Promise<DiscoveredPolicy | null>[] = [];

        for (const [type, policy] of discoveredPolicies) {
            // High confidence (special domain or high Carl score) - skip validation
            if (policy.source === 'special_domain' || 
                (policy.neuralScore && policy.neuralScore > 0.7) ||
                policy.confidence === 'high') {
                finalPolicies.push(policy);
                logger.info(`[PolicyDiscovery] ✓ Fast-track ${type}: ${policy.url} (score: ${policy.neuralScore?.toFixed(2) || 'n/a'})`);
            } else {
                // Quick validation for uncertain policies
                validationPromises.push(
                    quickValidate(policy, type, nn).then(valid => valid ? policy : null)
                );
            }
        }

        // Run all validations in parallel
        const validatedResults = await Promise.all(validationPromises);
        validatedResults.forEach(p => {
            if (p) finalPolicies.push(p);
        });

        phasesCompleted.push(`validated:${finalPolicies.length}`);

        // Sort by priority
        const priority: PolicyType[] = ['privacy', 'terms', 'cookies', 'security', 'gdpr', 'ccpa', 'ai', 'acceptable_use'];
        finalPolicies.sort((a, b) => priority.indexOf(a.type) - priority.indexOf(b.type));

        const duration = Date.now() - startTime;
        logger.info(`[PolicyDiscovery] ⚡ TURBO complete! Found ${finalPolicies.length} policies in ${duration}ms`);
        logger.info(`[PolicyDiscovery] Phases: ${phasesCompleted.join(' -> ')}`);

        return {
            success: true,
            domain: cleanDomain,
            policies: finalPolicies,
            discoveryTime: duration,
            phasesCompleted
        };

    } catch (error: any) {
        logger.error(`[PolicyDiscovery] Discovery failed`, error);
        return {
            success: false,
            domain: cleanDomain,
            policies: [],
            discoveryTime: Date.now() - startTime,
            phasesCompleted,
            error: error?.message || 'Discovery failed'
        };
    }
}

/**
 * Phase 1: Check special domains configuration (instant - no HTTP)
 */
async function checkSpecialDomains(domain: string, baseUrl: string): Promise<DiscoveredPolicy[]> {
    const policies: DiscoveredPolicy[] = [];

    const specialConfig = CONFIG.SPECIAL_DOMAINS[domain] ||
        CONFIG.SPECIAL_DOMAINS[`www.${domain}`] ||
        CONFIG.SPECIAL_DOMAINS[domain.replace(/^www\./, '')];

    if (!specialConfig) return policies;

    // Just return the URLs from config - don't validate (trust the config)
    for (const [type, url] of Object.entries(specialConfig)) {
        if (url && typeof url === 'string') {
            policies.push({
                type: type as PolicyType,
                name: CONFIG.POLICY_TYPES[type as PolicyType]?.name || type,
                url,
                confidence: 'high',
                source: 'special_domain'
            });
        }
    }

    return policies;
}

/**
 * Phase 2: TURBO homepage crawl - single fast fetch, extract all policy links
 */
async function crawlHomepageFast(baseUrl: string, domain: string, nn?: Carl): Promise<DiscoveredPolicy[]> {
    const policies: DiscoveredPolicy[] = [];

    try {
        const response = await got(baseUrl, {
            timeout: { request: MEDIUM_TIMEOUT },
            headers: {
                'User-Agent': CRAWLER_UA,
                'Accept-Language': 'en-US,en;q=0.9'
            },
            followRedirect: true,
            retry: { limit: 0 } as any
        });

        const $ = cheerio.load(response.body);
        const foundLinks = new Map<PolicyType, { url: string; score: number; neuralScore: number }>();

        // Scan ALL links on page (footer priority handled by scoring)
        const processLink = (el: any, locationBonus: number) => {
            const href = $(el).attr('href');
            const linkText = $(el).text().trim().toLowerCase();

            if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;

            let absoluteUrl: string;
            try {
                absoluteUrl = new URL(href, baseUrl).toString();
            } catch {
                return;
            }

            // Check each policy type
            for (const [type, patterns] of Object.entries(POLICY_LINK_PATTERNS)) {
                for (const pattern of patterns) {
                    const textMatch = pattern.test(linkText);
                    const urlMatch = pattern.test(href);
                    
                    if (textMatch || urlMatch) {
                        // Skip hub pages
                        if (LEGAL_HUB_PATTERNS.some(p => p.test(absoluteUrl))) continue;
                        
                        // Score: text match is better, footer location is better
                        let score = (textMatch ? 2 : 0) + (urlMatch ? 1 : 0) + locationBonus;
                        
                        // Neural score
                        let neuralScore = 0;
                        if (nn) {
                            const location = locationBonus > 0 ? 'footer' : 'body';
                            const features = extractCarlFeatures(linkText, href, location as 'footer' | 'body', baseUrl);
                            neuralScore = nn.predict(features).score;
                            score += neuralScore * 2; // Neural boost
                        }

                        const existing = foundLinks.get(type as PolicyType);
                        if (!existing || existing.score < score) {
                            foundLinks.set(type as PolicyType, { url: absoluteUrl, score, neuralScore });
                        }
                        break;
                    }
                }
            }
        };

        // Process footer links first (with location bonus)
        for (const selector of FOOTER_SELECTORS) {
            $(selector).find('a').each((_, el) => processLink(el, 3));
        }

        // Process all other links
        $('a').each((_, el) => processLink(el, 0));

        // Convert to policies
        for (const [type, { url, neuralScore }] of foundLinks) {
            policies.push({
                type,
                name: CONFIG.POLICY_TYPES[type]?.name || type,
                url,
                confidence: neuralScore > 0.7 ? 'high' : 'medium',
                source: 'footer_link',
                neuralScore
            });
        }

    } catch (error: any) {
        logger.error(`[PolicyDiscovery] Homepage crawl failed`, error?.message);
    }

    return policies;
}

/**
 * Phase 3: Probe common URL paths directly in parallel
 */
async function probeCommonPaths(baseUrl: string, domain: string): Promise<DiscoveredPolicy[]> {
    const policies: DiscoveredPolicy[] = [];
    const probes: Promise<DiscoveredPolicy | null>[] = [];

    // Only probe for privacy and terms (most common)
    const typesToProbe: PolicyType[] = ['privacy', 'terms'];

    for (const type of typesToProbe) {
        const paths = COMMON_POLICY_PATHS[type];
        
        for (const path of paths) {
            probes.push((async () => {
                try {
                    const url = new URL(path, baseUrl).toString();
                    const response = await got(url, {
                        timeout: { request: FAST_TIMEOUT },
                        headers: { 'User-Agent': CRAWLER_UA },
                        followRedirect: true,
                        retry: { limit: 0 } as any,
                        throwHttpErrors: false
                    });

                    // Quick check: is it a real page with substantial content?
                    if (response.statusCode === 200 && response.body.length > 2000) {
                        const bodyLower = response.body.toLowerCase();
                        // Must contain at least one policy keyword
                        const keywords = POLICY_VALIDATION_KEYWORDS[type];
                        const hasKeyword = keywords.some(k => bodyLower.includes(k));
                        
                        if (hasKeyword) {
                            return {
                                type,
                                name: CONFIG.POLICY_TYPES[type]?.name || type,
                                url,
                                confidence: 'medium' as const,
                                source: 'content_analysis' as const
                            };
                        }
                    }
                } catch {
                    // Path doesn't exist - that's fine
                }
                return null;
            })());
        }
    }

    // Run all probes in parallel with a timeout
    const results = await Promise.race([
        Promise.all(probes),
        new Promise<(DiscoveredPolicy | null)[]>(resolve => 
            setTimeout(() => resolve([]), 4000) // Max 4 seconds for all probes
        )
    ]);

    // Dedupe by type (take first hit)
    const seenTypes = new Set<PolicyType>();
    for (const result of results) {
        if (result && !seenTypes.has(result.type)) {
            policies.push(result);
            seenTypes.add(result.type);
        }
    }

    return policies;
}

/**
 * Quick validation for uncertain policies - minimal HTTP, fast checks
 */
async function quickValidate(policy: DiscoveredPolicy, type: PolicyType, nn?: Carl): Promise<boolean> {
    try {
        const response = await got(policy.url, {
            timeout: { request: FAST_TIMEOUT },
            headers: {
                'User-Agent': CRAWLER_UA,
                'Accept-Language': 'en-US,en;q=0.9'
            },
            followRedirect: true,
            retry: { limit: 0 } as any
        });

        if (response.statusCode !== 200) return false;

        const bodyLower = response.body.toLowerCase();
        
        // Minimum length check
        if (bodyLower.length < 1000) return false;

        // Keyword check
        const keywords = POLICY_VALIDATION_KEYWORDS[type];
        let matches = 0;
        for (const keyword of keywords) {
            if (bodyLower.includes(keyword)) matches++;
            if (matches >= 2) return true; // Early exit - valid enough
        }

        return matches >= 1;

    } catch {
        return false;
    }
}

/**
 * Full content validation for external use (exported function)
 */
async function validatePolicyContent(url: string, type: PolicyType, nn?: Carl): Promise<boolean> {
    try {
        const response = await got(url, {
            timeout: { request: MEDIUM_TIMEOUT },
            headers: {
                'User-Agent': CRAWLER_UA,
                'Accept-Language': 'en-US,en;q=0.9'
            },
            followRedirect: true,
            retry: { limit: 0 } as any
        });

        if (response.statusCode !== 200) return false;

        const bodyLower = response.body.toLowerCase();
        
        // Minimum length check
        if (bodyLower.length < 1000) return false;

        // Keyword check
        const keywords = POLICY_VALIDATION_KEYWORDS[type];
        let matches = 0;
        for (const keyword of keywords) {
            if (bodyLower.includes(keyword)) matches++;
            if (matches >= 2) return true;
        }

        return matches >= 1;

    } catch {
        return false;
    }
}

export { validatePolicyContent };
