import { DiscoveryStrategy } from './Strategy';
import { PolicyCandidate } from '../types/policy';
import { CONFIG } from '../config';
import got from 'got';
import * as cheerio from 'cheerio';
import { URL } from 'url';
import { logger } from '../logger';
import { isValidPolicyUrl } from '../extractor/fetcher';
import {
    isPrivacyUrl,
    isPrivacyLinkText,
    scoreLinkText,
    scorePrivacyUrl,
    FOOTER_LINK_PATTERNS
} from './multilingual';
import { isBlockedUrl, validateUrlForDomain } from './domainValidator';
import { enforceRateLimit } from './rateLimiter';
import { extractCarlFeatures } from '../carl/FeatureExtractor';
import { getCarl } from '../carl/Carl';

/**
 * Enhanced Homepage Scraper Strategy with Multilingual Support
 * 
 * This strategy scans the website homepage (and subpages) for privacy policy links,
 * with special focus on footer links where policies are typically located.
 * 
 * Key improvements:
 * - Multilingual support (190+ languages)
 * - Deep footer scanning (multiple footer detection methods)
 * - Domain validation (blocks social media profiles)
 * - Content area prioritization (footer > nav > body)
 */
export class HomepageScraperStrategy implements DiscoveryStrategy {
    name = 'HomepageScraperStrategy';

    /**
     * Extended multilingual privacy keywords for link detection
     */
    private readonly PRIVACY_KEYWORDS = [
        // English
        'privacy', 'data protection', 'personal data', 'data policy',
        // German
        'datenschutz', 'datenschutzerklärung', 'datenschutzrichtlinie', 'impressum',
        // French
        'confidentialité', 'vie privée', 'données personnelles', 'mentions légales',
        // Spanish
        'privacidad', 'protección de datos', 'datos personales', 'aviso legal',
        // Italian
        'privacy', 'riservatezza', 'protezione dei dati', 'informativa',
        // Portuguese
        'privacidade', 'proteção de dados', 'dados pessoais',
        // Dutch
        'privacy', 'gegevensbescherming', 'privacybeleid',
        // Russian
        'конфиденциальность', 'защита данных', 'персональные данные',
        // Japanese
        'プライバシー', '個人情報', '個人情報保護',
        // Chinese
        '隐私', '隐私政策', '个人信息', '隱私', '隱私政策',
        // Korean
        '개인정보', '개인정보처리방침', '프라이버시',
        // Turkish
        'gizlilik', 'kişisel veriler', 'kvkk', 'aydınlatma',
        // Polish
        'prywatność', 'ochrona danych', 'polityka prywatności',
        // Swedish
        'integritet', 'dataskydd', 'personuppgifter',
        // Norwegian
        'personvern', 'personopplysninger',
        // Danish
        'privatliv', 'databeskyttelse', 'persondata',
        // Finnish
        'tietosuoja', 'yksityisyys', 'henkilötiedot',
        // Czech
        'soukromí', 'ochrana údajů', 'osobní údaje',
        // Hungarian
        'adatvédelem', 'személyes adatok',
        // Greek
        'απόρρητο', 'προστασία δεδομένων',
        // Arabic
        'الخصوصية', 'حماية البيانات',
        // Hebrew
        'פרטיות', 'הגנת מידע',
        // Thai
        'ความเป็นส่วนตัว', 'นโยบายความเป็นส่วนตัว',
        // Vietnamese
        'quyền riêng tư', 'bảo mật',
        // Indonesian/Malay
        'privasi', 'perlindungan data',
    ];

    /**
     * Footer detection selectors (in priority order)
     */
    private readonly FOOTER_SELECTORS = [
        'footer',
        '[role="contentinfo"]',
        '.footer',
        '#footer',
        '.site-footer',
        '.page-footer',
        '.global-footer',
        '.main-footer',
        '[class*="footer"]',
        '[id*="footer"]',
    ];

    /**
     * Legal section selectors
     */
    private readonly LEGAL_SECTION_SELECTORS = [
        '[class*="legal"]',
        '[id*="legal"]',
        '[class*="policy"]',
        '[class*="terms"]',
        '.bottom-links',
        '.footer-links',
        '.footer-legal',
        '.legal-links',
    ];

    async execute(domain: string): Promise<PolicyCandidate[]> {
        const candidates: PolicyCandidate[] = [];
        const baseUrl = `https://${domain}`;

        // Get Carl for neural network scoring
        let carl: Awaited<ReturnType<typeof getCarl>> | null = null;
        try {
            carl = await getCarl();
        } catch (e) {
            logger.warn('HomepageScraper: Could not load Carl, using heuristic scoring only');
        }

        try {
            // Enforce rate limiting before request
            await enforceRateLimit(baseUrl);

            // Fetch homepage
            const response = await got(baseUrl, {
                timeout: { request: 15000 },
                headers: {
                    'User-Agent': CONFIG.USER_AGENT,
                    // Accept multiple languages to get localized footer links
                    'Accept-Language': 'en-US,en;q=0.9,de;q=0.8,fr;q=0.7,es;q=0.6',
                },
                retry: { limit: 1 } as any,  // Reduced retries, we handle 429 ourselves
                followRedirect: true,
                throwHttpErrors: false,
            });

            // Handle rate limiting
            if (response.statusCode === 429) {
                logger.warn(`HomepageScraper: Rate limited (429) by ${domain}`);
                return candidates;
            }

            if (response.statusCode !== 200) {
                logger.info(`HomepageScraper: ${baseUrl} returned status ${response.statusCode}`);
                return candidates;
            }

            const $ = cheerio.load(response.body);

            // Collect links with context information
            const links: {
                href: string;
                text: string;
                context: 'footer' | 'legal_hub' | 'nav' | 'body';
                score: number;
            }[] = [];

            // PHASE 1: Deep footer scanning (highest priority)
            for (const selector of this.FOOTER_SELECTORS) {
                $(selector).find('a').each((i, el) => {
                    this.processLink($, el, baseUrl, domain, 'footer', links);
                });
            }

            // PHASE 2: Legal section scanning
            for (const selector of this.LEGAL_SECTION_SELECTORS) {
                $(selector).find('a').each((i, el) => {
                    this.processLink($, el, baseUrl, domain, 'legal_hub', links);
                });
            }

            // PHASE 3: Navigation scanning (medium priority)
            $('nav a, [role="navigation"] a').each((i, el) => {
                this.processLink($, el, baseUrl, domain, 'nav', links);
            });

            // PHASE 4: Full page scan for any remaining privacy links
            // (Only if we haven't found enough in footer/nav)
            if (links.length < 3) {
                $('a').each((i, el) => {
                    // Skip if already in footer/legal/nav
                    const inFooter = $(el).closest('footer, [role="contentinfo"]').length > 0;
                    const inNav = $(el).closest('nav, [role="navigation"]').length > 0;
                    if (!inFooter && !inNav) {
                        this.processLink($, el, baseUrl, domain, 'body', links);
                    }
                });
            }

            // De-duplicate by URL and sort by score
            const seenUrls = new Set<string>();
            const uniqueLinks = links.filter(link => {
                if (seenUrls.has(link.href)) return false;
                seenUrls.add(link.href);
                return true;
            });

            // Sort by score (highest first)
            uniqueLinks.sort((a, b) => b.score - a.score);

            logger.info(`HomepageScraper: Found ${uniqueLinks.length} unique privacy-related links on ${domain}`);

            // Convert to candidates (top 5) - use Carl for smarter scoring
            for (const link of uniqueLinks.slice(0, 5)) {
                // Final domain validation
                const validation = validateUrlForDomain(link.href, domain);
                if (!validation.isValid) {
                    logger.info(`HomepageScraper: Skipping ${link.href} - ${validation.reason || 'Failed validation'}`);
                    continue;
                }

                // Calculate confidence using Carl if available
                let confidence: number;
                let methodDetail: string;

                if (carl) {
                    // Use Carl's neural network for scoring
                    const features = extractCarlFeatures(
                        link.text,           // linkText
                        link.href,           // url
                        link.context,        // context (footer, nav, body, legal)
                        baseUrl,             // baseUrl
                        undefined            // pageContent (not fetched yet)
                    );
                    const prediction = carl.predict(features);

                    // Carl returns 0-1, convert to 0-100 confidence
                    // But also factor in the heuristic score as a sanity check
                    const carlScore = prediction.score * 100;
                    const heuristicScore = 50 + link.score;

                    // Weighted combination: 70% Carl, 30% heuristics
                    confidence = Math.round(carlScore * 0.7 + heuristicScore * 0.3);

                    // Context bonuses still apply (Carl may not have full context info)
                    if (link.context === 'footer') confidence += 10;
                    if (link.context === 'legal_hub') confidence += 8;

                    methodDetail = `Carl: ${Math.round(carlScore)}%, Heuristic: ${Math.round(heuristicScore)}%, Context: ${link.context}`;
                    logger.info(`HomepageScraper: Carl scored "${link.text.slice(0, 30)}" at ${carlScore.toFixed(1)}%`);
                } else {
                    // Fallback to heuristic scoring
                    confidence = 50 + link.score;

                    // Context bonuses
                    if (link.context === 'footer') confidence += 15;
                    if (link.context === 'legal_hub') confidence += 12;
                    if (link.context === 'nav') confidence += 5;

                    methodDetail = `Found "${link.text.slice(0, 50)}" in ${link.context} (score: ${link.score})`;
                }

                // Domain match bonus
                confidence += Math.floor(validation.confidence / 10);

                candidates.push({
                    url: link.href,
                    source: 'footer_link',
                    confidence: Math.min(confidence, 98),
                    foundAt: new Date(),
                    methodDetail
                });
            }

        } catch (error: any) {
            logger.error(`HomepageScraper: Error fetching ${baseUrl}`, error.message);
        }

        return candidates;
    }

    /**
     * Process a link element and add to candidates if it looks like a privacy link
     */
    private processLink(
        $: cheerio.CheerioAPI,
        el: any,  // Cheerio element type
        baseUrl: string,
        domain: string,
        context: 'footer' | 'legal_hub' | 'nav' | 'body',
        links: { href: string; text: string; context: typeof context; score: number }[]
    ): void {
        const href = $(el).attr('href');
        const text = $(el).text().trim();
        const title = $(el).attr('title') || '';
        const ariaLabel = $(el).attr('aria-label') || '';

        if (!href || href === '#' || href.startsWith('javascript:') || href.startsWith('mailto:')) {
            return;
        }

        // Combine all text for matching
        const combinedText = `${text} ${title} ${ariaLabel}`.toLowerCase();
        const lowerHref = href.toLowerCase();

        // Check if this is a privacy-related link
        const hasPrivacyKeyword = this.PRIVACY_KEYWORDS.some(kw =>
            combinedText.includes(kw.toLowerCase()) || lowerHref.includes(kw.toLowerCase())
        );

        // Also use the multilingual matcher
        const isPrivacyText = isPrivacyLinkText(combinedText);
        const isPrivacyHref = isPrivacyUrl(href);

        if (!hasPrivacyKeyword && !isPrivacyText && !isPrivacyHref) {
            return;
        }

        try {
            // Resolve to absolute URL
            const absoluteUrl = new URL(href, baseUrl).toString();

            // Skip blocked domains (social media, etc.)
            if (isBlockedUrl(absoluteUrl)) {
                logger.info(`HomepageScraper: Skipping blocked URL ${absoluteUrl}`);
                return;
            }

            // Skip auth pages
            if (!isValidPolicyUrl(absoluteUrl)) {
                logger.info(`HomepageScraper: Skipping auth URL ${absoluteUrl}`);
                return;
            }

            // Calculate relevance score
            let score = 0;

            // Text scoring using multilingual scorer
            score += scoreLinkText(combinedText);

            // URL scoring using multilingual scorer
            score += scorePrivacyUrl(href);

            // Exact match bonuses
            const exactMatches = [
                'privacy policy', 'privacy', 'datenschutz', 'confidentialité',
                'privacidad', 'プライバシーポリシー', '隐私政策', '개인정보처리방침'
            ];
            if (exactMatches.some(m => combinedText.trim() === m)) {
                score += 25;
            }

            // Path bonuses
            if (/\/(privacy|datenschutz|confidentialite|privacidad)($|\/)/i.test(lowerHref)) {
                score += 20;
            }

            // PDF Bonus - if it looks like a policy and is a PDF, that's often the "official" doc
            if (lowerHref.endsWith('.pdf')) {
                // Only boost if it also has privacy keywords
                if (score > 10 || hasPrivacyKeyword) {
                    score += 15;
                    logger.info(`HomepageScraper: Found PDF policy candidate: ${absoluteUrl} (score boost +15)`);
                }
            }

            links.push({
                href: absoluteUrl,
                text: text.slice(0, 100), // Truncate for logging
                context,
                score
            });

        } catch (e) {
            // Invalid URL, skip
        }
    }
}
