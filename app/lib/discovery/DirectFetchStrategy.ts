import { DiscoveryStrategy } from './Strategy';
import { PolicyCandidate, PolicySource } from '../types/policy';
import { CONFIG } from '../config';
import got from 'got';
import { logger } from '../logger';
import { isValidPolicyUrl } from '../extractor/fetcher';
import { isBlockedDomain } from './domainValidator';
import { getPrivacyTermsForUrl, isPrivacyRelatedText } from './multilingual';
import { enforceRateLimit } from './rateLimiter';

/**
 * Domains that require special handling (bot user-agent) to work
 * These sites block regular Chrome user-agent but allow search engine bots
 */
const BOT_REQUIRED_DOMAINS = [
    'facebook.com',
    'www.facebook.com',
    'instagram.com',
    'www.instagram.com',
    'whatsapp.com',
    'www.whatsapp.com',
    'threads.net',
    'www.threads.net',
    'meta.com',
    'www.meta.com',
];

/**
 * User agents to try - Googlebot works for Meta properties
 */
const GOOGLEBOT_UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

/**
 * DirectFetchStrategy: Most reliable strategy that uses GET requests
 * to directly fetch and verify policy pages exist.
 * 
 * This is more reliable than HEAD requests because many servers
 * (like Facebook, Instagram) don't properly respond to HEAD.
 * 
 * For Meta/Facebook family domains, uses Googlebot user-agent
 * because they block regular browser requests but allow search bots.
 * 
 * NEW: Also scans the main page footer for privacy policy links
 */
export class DirectFetchStrategy implements DiscoveryStrategy {
    name = 'DirectFetchStrategy';

    private readonly PRIORITY_PATHS = [
        '/privacy',
        '/privacy-policy',
        '/privacy/policy',
        '/legal/privacy',
        '/about/privacy',
        '/policies/privacy',
        '/privacy/center',
        '/privacycenter',
        '/help/privacy',
        '/privacypolicy',
        '/privacy_policy',
    ];

    /**
     * Check if domain requires bot user-agent
     */
    private requiresBotUA(domain: string): boolean {
        const cleanDomain = domain.toLowerCase().replace(/^www\./, '');
        return BOT_REQUIRED_DOMAINS.some(d => 
            d === domain.toLowerCase() || d === cleanDomain || d === `www.${cleanDomain}`
        );
    }

    /**
     * Extract privacy policy URLs from page footer
     * Most websites link to privacy policies in their footer
     * NOW: Supports 190+ languages using multilingual detection
     */
    private extractFooterPrivacyLinks(html: string, domain: string): string[] {
        const links: string[] = [];
        
        // Look for <footer> section first (most reliable)
        const footerMatch = html.match(/<footer[^>]*>([\s\S]*?)<\/footer>/i);
        const searchArea = footerMatch ? footerMatch[1] : html.slice(-50000); // Last 50KB if no footer tag
        
        // Get privacy terms for this domain's language
        const privacyTerms = getPrivacyTermsForUrl(`https://${domain}`);
        
        // Regex to find links
        const linkRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>([^<]*(?:<[^>]*>[^<]*)*)<\/a>/gi;
        let match;
        
        while ((match = linkRegex.exec(searchArea)) !== null) {
            const href = match[1];
            const linkText = match[2].replace(/<[^>]*>/g, '').toLowerCase().trim();
            
            // CRITICAL: Skip blocked domains (LinkedIn, social media, etc.)
            if (isBlockedDomain(href)) {
                logger.info(`DirectFetch: Skipping blocked URL in footer: ${href}`);
                continue;
            }
            
            // Check if link text matches our footer link patterns (standard)
            const isPrivacyLink = CONFIG.FOOTER_LINK_PATTERNS.some(pattern => 
                linkText.includes(pattern.toLowerCase())
            );
            
            // MULTILINGUAL: Check if link text is privacy-related in any of 190+ languages
            const isMultilingualPrivacyLink = isPrivacyRelatedText(linkText, privacyTerms);
            
            // Or check if URL matches our privacy URL patterns
            const urlMatchesPattern = CONFIG.PRIVACY_URL_PATTERNS.some(pattern => 
                pattern.test(href)
            );
            
            if (isPrivacyLink || isMultilingualPrivacyLink || urlMatchesPattern) {
                // Resolve relative URLs
                let fullUrl = href;
                if (href.startsWith('/')) {
                    fullUrl = `https://${domain}${href}`;
                } else if (!href.startsWith('http')) {
                    fullUrl = `https://${domain}/${href}`;
                }
                
                // Skip mailto, javascript, etc
                if (fullUrl.startsWith('http') && !links.includes(fullUrl)) {
                    links.push(fullUrl);
                }
            }
        }
        
        logger.info(`DirectFetch: Found ${links.length} potential privacy links in footer (multilingual detection active)`);
        return links;
    }

    async execute(domain: string): Promise<PolicyCandidate[]> {
        const candidates: PolicyCandidate[] = [];
        const useBotUA = this.requiresBotUA(domain);
        
        if (useBotUA) {
            logger.info(`DirectFetch: Using Googlebot UA for ${domain}`);
        }
        
        // First check special domains with explicit URLs
        const specialConfig = CONFIG.SPECIAL_DOMAINS[domain];
        if (specialConfig?.privacy) {
            logger.info(`DirectFetch: Trying special domain URL for ${domain}: ${specialConfig.privacy}`);
            const result = await this.tryUrl(specialConfig.privacy, domain, 'special_domain', useBotUA);
            if (result) {
                candidates.push(result);
                return candidates;
            }
        }

        // For bot-required domains, try known working paths first
        if (useBotUA) {
            const metaPaths = [
                '/privacy/policy/',
                '/privacy/policy',
                '/privacy/',
                '/legal/privacy/',
                '/help/privacy/',
            ];
            
            const baseUrl = domain.startsWith('www.') ? `https://${domain}` : `https://www.${domain}`;
            
            for (const path of metaPaths) {
                const url = `${baseUrl}${path}`;
                logger.info(`DirectFetch: Trying ${url} with Googlebot UA`);
                const result = await this.tryUrl(url, domain, 'direct_fetch', true);
                if (result) {
                    candidates.push(result);
                    return candidates;
                }
            }
        }

        // NEW: Fetch main page and scan footer for privacy links
        // This is the most reliable way to find policies since they're almost always in the footer
        try {
            const mainPageUrl = `https://${domain}`;
            logger.info(`DirectFetch: Fetching main page ${mainPageUrl} to scan footer`);
            
            // Enforce rate limiting before request
            await enforceRateLimit(mainPageUrl);
            
            const response = await got(mainPageUrl, {
                timeout: { request: 15000 },
                retry: { limit: 0 } as any,  // Handle retries ourselves
                headers: {
                    'User-Agent': useBotUA ? GOOGLEBOT_UA : CONFIG.USER_AGENT,
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                },
                followRedirect: true,
                throwHttpErrors: false,
            });
            
            // Handle rate limiting
            if (response.statusCode === 429) {
                logger.warn(`DirectFetch: Rate limited (429) by ${domain}`);
                return candidates;
            }
            
            if (response.statusCode === 200) {
                const footerLinks = this.extractFooterPrivacyLinks(response.body, domain);
                
                // Try footer links first (highest confidence)
                for (const link of footerLinks.slice(0, 3)) { // Max 3 footer links
                    const result = await this.tryUrl(link, domain, 'direct_fetch', useBotUA);
                    if (result) {
                        result.confidence = Math.min(result.confidence + 5, 98); // Boost for footer discovery
                        result.methodDetail = 'Footer link discovery';
                        candidates.push(result);
                        if (candidates.length >= 1) return candidates; // Return first valid
                    }
                }
            }
        } catch (error: any) {
            logger.info(`DirectFetch: Error fetching main page: ${error.message}`);
        }

        // Try priority paths in parallel with GET requests
        const baseUrl = `https://${domain}`;
        const wwwBaseUrl = `https://www.${domain}`;
        
        // Build all URLs to try
        const urlsToTry: string[] = [];
        for (const path of this.PRIORITY_PATHS) {
            urlsToTry.push(`${baseUrl}${path}`);
            if (!domain.startsWith('www.')) {
                urlsToTry.push(`${wwwBaseUrl}${path}`);
            }
        }

        // Try in batches to avoid overwhelming
        const batchSize = 5;
        for (let i = 0; i < urlsToTry.length; i += batchSize) {
            const batch = urlsToTry.slice(i, i + batchSize);
            const results = await Promise.all(
                batch.map(url => this.tryUrl(url, domain, 'direct_fetch', useBotUA))
            );
            
            const validResults = results.filter(r => r !== null) as PolicyCandidate[];
            if (validResults.length > 0) {
                // Sort by confidence and return best matches
                validResults.sort((a, b) => b.confidence - a.confidence);
                candidates.push(...validResults.slice(0, 3));
                break; // Stop once we find valid URLs
            }
        }

        return candidates;
    }

    private async tryUrl(url: string, domain: string, source: PolicySource, useBotUA: boolean = false): Promise<PolicyCandidate | null> {
        try {
            // Enforce rate limiting before request
            await enforceRateLimit(url);
            
            // Determine which user agent to use
            const userAgent = useBotUA ? GOOGLEBOT_UA : CONFIG.USER_AGENT;
            
            const response = await got(url, {
                timeout: { request: 12000 },
                retry: { limit: 0 } as any,  // Handle retries ourselves
                headers: {
                    'User-Agent': userAgent,
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                },
                followRedirect: true,
                throwHttpErrors: false,
            });

            // Handle rate limiting
            if (response.statusCode === 429) {
                logger.warn(`DirectFetch: Rate limited (429) for ${url}`);
                return null;
            }

            // Accept 200 status only for reliability
            if (response.statusCode !== 200) {
                logger.info(`DirectFetch: ${url} returned status ${response.statusCode}`);
                return null;
            }

            const finalUrl = response.url;

            // Check if redirected to login page
            if (!isValidPolicyUrl(finalUrl)) {
                logger.info(`DirectFetch: Skipping ${finalUrl} - appears to be auth page`);
                return null;
            }

            // Verify content looks like a privacy policy
            const body = response.body;
            const bodyLength = body.length;
            
            // For large pages (like Facebook's 2MB page), scan more content
            // Small pages: check first 15KB, Large pages (>100KB): check first 500KB
            const scanSize = bodyLength > 100000 ? 500000 : 15000;
            const lowerBody = body.toLowerCase().slice(0, scanSize);

            // Must have privacy-related content
            // ENHANCED: Now includes 190+ language support for privacy terms
            const privacyIndicators = [
                'privacy',
                'personal data',
                'personal information',
                'data protection',
                'collect information',
                'data we collect',
                'information we collect',
                'how we use',
                'your data',
                'your information',
                // German
                'datenschutz',
                'datenschutzerklärung',
                'datenschutzerklaerung',
                'datenschutzhinweise',
                'personenbezogene daten',
                // Spanish
                'privacidad',
                'política de privacidad',
                'datos personales',
                'protección de datos',
                // French
                'confidentialité',
                'politique de confidentialité',
                'données personnelles',
                'protection des données',
                // Italian
                'privacy',
                'informativa privacy',
                'dati personali',
                'protezione dei dati',
                // Portuguese
                'privacidade',
                'política de privacidade',
                'dados pessoais',
                // Dutch
                'privacybeleid',
                'privacyverklaring',
                'persoonsgegevens',
                // Polish
                'polityka prywatności',
                'dane osobowe',
                // Russian
                'конфиденциальность',
                'политика конфиденциальности',
                'персональные данные',
                // Chinese
                '隐私',
                '隐私政策',
                '個人資料',
                // Japanese
                'プライバシー',
                'プライバシーポリシー',
                '個人情報',
                // Korean
                '개인정보',
                '개인정보처리방침',
                // Arabic
                'الخصوصية',
                'سياسة الخصوصية',
            ];

            const matchedIndicators = privacyIndicators.filter(indicator => 
                lowerBody.includes(indicator)
            );
            
            // For bot-fetched pages (like Facebook), we trust the URL more since we know it works
            // Regular pages need 2+ indicators, bot-fetched need just 1 indicator
            const requiredIndicators = useBotUA ? 1 : 2;
            const hasPrivacyContent = matchedIndicators.length >= requiredIndicators;

            // Check for login page indicators (should NOT have these predominantly)
            const loginIndicators = [
                'enter your password',
                'sign in to continue',
                'log in to continue',
                'create an account',
                '<input type="password"',
                'forgot password'
            ];

            const loginMatches = loginIndicators.filter(indicator => 
                lowerBody.includes(indicator)
            ).length;

            const isLikelyLoginPage = loginMatches >= 2;

            if (!hasPrivacyContent) {
                logger.info(`DirectFetch: Skipping ${finalUrl} - insufficient privacy content (found ${matchedIndicators.length}/${requiredIndicators} required: ${matchedIndicators.join(', ')}) [scanned ${scanSize} of ${bodyLength} bytes]`);
                return null;
            }

            if (isLikelyLoginPage) {
                logger.info(`DirectFetch: Skipping ${finalUrl} - appears to be login page`);
                return null;
            }

            // Calculate confidence based on URL, content, and method
            let confidence = 75;
            
            if (source === 'special_domain') {
                confidence = 95;
            } else if (finalUrl.toLowerCase().includes('privacy')) {
                confidence = 85;
            }

            // Boost for multiple privacy indicators
            if (matchedIndicators.length >= 4) {
                confidence += 5;
            }

            // Boost confidence if title looks right
            const titleMatch = body.match(/<title[^>]*>([^<]+)<\/title>/i);
            if (titleMatch && titleMatch[1].toLowerCase().includes('privacy')) {
                confidence += 5;
            }

            // Boost for bot-fetched content (usually more complete)
            if (useBotUA) {
                confidence += 3;
            }

            logger.info(`DirectFetch: Found valid policy at ${finalUrl} (confidence: ${confidence}, indicators: ${matchedIndicators.length})`);

            return {
                url: finalUrl,
                source,
                confidence: Math.min(confidence, 98),
                foundAt: new Date(),
                methodDetail: useBotUA ? 'Direct GET with bot UA' : 'Direct GET request'
            };
        } catch (error: any) {
            logger.info(`DirectFetch: Error fetching ${url}: ${error.message}`);
            return null;
        }
    }
}
