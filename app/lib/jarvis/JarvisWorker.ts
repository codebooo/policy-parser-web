/**
 * JARVIS Worker - Individual worker instance for parallel discovery
 * 
 * Each worker executes a specific discovery strategy and returns candidates.
 */

import got from 'got';
import * as cheerio from 'cheerio';
import { logger } from '../logger';
import { CONFIG, PolicyType } from '../config';
import { Carl, getCarl, extractCarlFeatures } from '../carl';
import { enforceRateLimit } from '../discovery/rateLimiter';
import {
    JarvisCandidate,
    JarvisStrategy,
    JarvisTask,
    JarvisWorkerConfig,
    JarvisSource
} from './types';

// Fast timeout for individual requests
const WORKER_TIMEOUT = 3000;

// User agent for crawling
const CRAWLER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Footer selectors for homepage crawling
const FOOTER_SELECTORS = [
    'footer', '#footer', '.footer', '[role="contentinfo"]',
    '.site-footer', '.page-footer', '.global-footer', '.main-footer',
    '.footer-links', '.legal-links', '.footer-legal', '.copyright'
];

// Policy link patterns (multilingual)
const POLICY_PATTERNS: Record<PolicyType, RegExp[]> = {
    privacy: [
        /privacy\s*(policy|notice|statement)?/i,
        /data\s*(protection|policy)/i,
        /datenschutz/i, /privacidad/i, /confidentialit[eé]/i
    ],
    terms: [
        /terms\s*(of\s*)?(service|use)?/i,
        /user\s*agreement/i, /nutzungsbedingungen/i, /agb/i
    ],
    cookies: [/cookie\s*(policy|notice)?/i, /cookies/i],
    security: [/security\s*(policy)?/i, /trust/i],
    gdpr: [/gdpr/i, /eu\s*privacy/i],
    ccpa: [/ccpa/i, /california/i, /do\s*not\s*sell/i],
    ai: [/ai\s*(policy|terms)?/i, /machine\s*learning/i],
    acceptable_use: [/acceptable\s*use/i, /aup/i, /community\s*guidelines/i]
};

// Common paths to probe
const COMMON_PATHS: Record<PolicyType, string[]> = {
    privacy: ['/privacy', '/privacy-policy', '/privacypolicy', '/datenschutz'],
    terms: ['/terms', '/tos', '/terms-of-service', '/nutzungsbedingungen'],
    cookies: ['/cookies', '/cookie-policy'],
    security: ['/security', '/trust'],
    gdpr: ['/gdpr'],
    ccpa: ['/ccpa', '/privacy-rights'],
    ai: ['/ai-policy', '/ai-terms'],
    acceptable_use: ['/acceptable-use', '/aup']
};

/**
 * JarvisWorker - Executes a single discovery strategy
 */
export class JarvisWorker {
    private config: JarvisWorkerConfig;
    private carl: Carl | null = null;

    constructor(config: JarvisWorkerConfig) {
        this.config = config;
    }

    /**
     * Initialize the worker (load Carl if available)
     */
    async init(): Promise<void> {
        try {
            this.carl = await getCarl();
        } catch (e) {
            logger.warn(`[Jarvis W${this.config.id}] Carl not available, using heuristics`);
        }
    }

    /**
     * Execute the assigned task
     */
    async execute(task: JarvisTask): Promise<JarvisCandidate[]> {
        const startTime = Date.now();
        logger.info(`[Jarvis W${this.config.id}] Starting ${task.strategy} for ${task.domain}`);

        try {
            let candidates: JarvisCandidate[] = [];

            switch (task.strategy) {
                case 'homepage_crawl':
                    candidates = await this.crawlHomepage(task);
                    break;
                case 'sitemap_parse':
                    candidates = await this.parseSitemap(task);
                    break;
                case 'legal_hub_crawl':
                    candidates = await this.crawlLegalHub(task);
                    break;
                case 'direct_probe':
                    candidates = await this.probeDirectPaths(task);
                    break;
                case 'search_engine':
                    candidates = await this.searchEngine(task);
                    break;
                case 'deep_scan':
                    candidates = await this.deepScan(task);
                    break;
            }

            // Add timing info
            const elapsed = Date.now() - startTime;
            candidates.forEach(c => c.discoveryTimeMs = elapsed);

            logger.info(`[Jarvis W${this.config.id}] Found ${candidates.length} candidates in ${elapsed}ms`);
            return candidates;

        } catch (error: any) {
            logger.error(`[Jarvis W${this.config.id}] Strategy ${task.strategy} failed`, error.message);
            return [];
        }
    }

    /**
     * Strategy: Homepage Crawl
     * Scans the homepage for policy links in footer and body
     */
    private async crawlHomepage(task: JarvisTask): Promise<JarvisCandidate[]> {
        const candidates: JarvisCandidate[] = [];

        await enforceRateLimit(task.baseUrl);

        const response = await got(task.baseUrl, {
            timeout: { request: WORKER_TIMEOUT },
            headers: { 'User-Agent': CRAWLER_UA, 'Accept-Language': 'en-US,en;q=0.9' },
            followRedirect: true,
            retry: { limit: 0 } as any,
            throwHttpErrors: false
        });

        if (response.statusCode !== 200) return candidates;

        const $ = cheerio.load(response.body);
        const foundLinks = new Map<PolicyType, JarvisCandidate>();

        // Process links
        const processLink = (el: any, context: 'footer' | 'nav' | 'body', locationBonus: number) => {
            const href = $(el).attr('href');
            const linkText = $(el).text().trim().toLowerCase();

            if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;

            let absoluteUrl: string;
            try {
                absoluteUrl = new URL(href, task.baseUrl).toString();
            } catch { return; }

            // Check each policy type
            for (const type of task.targetTypes) {
                const patterns = POLICY_PATTERNS[type];
                if (!patterns) continue;

                for (const pattern of patterns) {
                    if (pattern.test(linkText) || pattern.test(href)) {
                        let score = locationBonus + (pattern.test(linkText) ? 20 : 10);
                        let neuralScore = 0;

                        // Use Carl for scoring
                        if (this.carl) {
                            const features = extractCarlFeatures(linkText, href, context, task.baseUrl);
                            neuralScore = this.carl.predict(features).score;
                            score += neuralScore * 30;
                        }

                        const existing = foundLinks.get(type);
                        if (!existing || existing.confidence < score) {
                            foundLinks.set(type, {
                                url: absoluteUrl,
                                type,
                                confidence: Math.min(score, 95),
                                source: context === 'footer' ? 'footer_link' : 'nav_link',
                                neuralScore,
                                linkText,
                                context,
                                workerId: this.config.id,
                                discoveryTimeMs: 0
                            });
                        }
                        break;
                    }
                }
            }
        };

        // Scan footer first (highest priority)
        for (const selector of FOOTER_SELECTORS) {
            $(selector).find('a').each((_, el) => processLink(el, 'footer', 30));
        }

        // Scan navigation
        $('nav a, [role="navigation"] a').each((_, el) => processLink(el, 'nav', 15));

        // Scan body if needed
        $('a').each((_, el) => processLink(el, 'body', 0));

        return Array.from(foundLinks.values());
    }

    /**
     * Strategy: Sitemap Parse
     * Parses sitemap.xml for policy URLs
     */
    private async parseSitemap(task: JarvisTask): Promise<JarvisCandidate[]> {
        const candidates: JarvisCandidate[] = [];

        try {
            await enforceRateLimit(task.baseUrl);

            const sitemapUrl = new URL('/sitemap.xml', task.baseUrl).toString();
            const response = await got(sitemapUrl, {
                timeout: { request: WORKER_TIMEOUT },
                headers: { 'User-Agent': CRAWLER_UA },
                retry: { limit: 0 } as any,
                throwHttpErrors: false
            });

            if (response.statusCode !== 200) return candidates;

            const $ = cheerio.load(response.body, { xmlMode: true });

            $('url loc').each((_, el) => {
                const url = $(el).text();
                const urlLower = url.toLowerCase();

                for (const type of task.targetTypes) {
                    const patterns = POLICY_PATTERNS[type];
                    if (patterns?.some(p => p.test(urlLower))) {
                        candidates.push({
                            url,
                            type,
                            confidence: 60,
                            source: 'sitemap',
                            context: 'unknown',
                            workerId: this.config.id,
                            discoveryTimeMs: 0
                        });
                        break;
                    }
                }
            });
        } catch (e) {
            // Sitemap might not exist
        }

        return candidates;
    }

    /**
     * Strategy: Legal Hub Crawl
     * Crawls /legal, /policies pages for links
     */
    private async crawlLegalHub(task: JarvisTask): Promise<JarvisCandidate[]> {
        const candidates: JarvisCandidate[] = [];
        const hubPaths = ['/legal', '/policies', '/legal/', '/policies/', '/about/legal'];

        for (const path of hubPaths) {
            try {
                const hubUrl = new URL(path, task.baseUrl).toString();
                await enforceRateLimit(hubUrl);

                const response = await got(hubUrl, {
                    timeout: { request: WORKER_TIMEOUT },
                    headers: { 'User-Agent': CRAWLER_UA },
                    followRedirect: true,
                    retry: { limit: 0 } as any,
                    throwHttpErrors: false
                });

                if (response.statusCode !== 200) continue;

                const $ = cheerio.load(response.body);

                $('a').each((_, el) => {
                    const href = $(el).attr('href');
                    const linkText = $(el).text().trim().toLowerCase();

                    if (!href) return;

                    let absoluteUrl: string;
                    try {
                        absoluteUrl = new URL(href, task.baseUrl).toString();
                    } catch { return; }

                    for (const type of task.targetTypes) {
                        const patterns = POLICY_PATTERNS[type];
                        if (patterns?.some(p => p.test(linkText) || p.test(href))) {
                            candidates.push({
                                url: absoluteUrl,
                                type,
                                confidence: 75,
                                source: 'legal_hub',
                                linkText,
                                context: 'legal_hub',
                                workerId: this.config.id,
                                discoveryTimeMs: 0
                            });
                            break;
                        }
                    }
                });

                // Found a hub, don't need to check others
                if (candidates.length > 0) break;

            } catch (e) {
                // Hub might not exist
            }
        }

        return candidates;
    }

    /**
     * Strategy: Direct Probe
     * Checks common policy paths directly
     */
    private async probeDirectPaths(task: JarvisTask): Promise<JarvisCandidate[]> {
        const candidates: JarvisCandidate[] = [];
        const probes: Promise<JarvisCandidate | null>[] = [];

        for (const type of task.targetTypes) {
            const paths = COMMON_PATHS[type] || [];

            for (const path of paths) {
                probes.push((async () => {
                    try {
                        const url = new URL(path, task.baseUrl).toString();
                        await enforceRateLimit(url);

                        const response = await got(url, {
                            timeout: { request: WORKER_TIMEOUT },
                            headers: { 'User-Agent': CRAWLER_UA },
                            followRedirect: true,
                            retry: { limit: 0 } as any,
                            throwHttpErrors: false
                        });

                        // Check if it's a real page with content
                        if (response.statusCode === 200 && response.body.length > 2000) {
                            return {
                                url,
                                type,
                                confidence: 70,
                                source: 'direct_probe' as JarvisSource,
                                context: 'body' as const,
                                workerId: this.config.id,
                                discoveryTimeMs: 0
                            };
                        }
                    } catch (e) {
                        // Path doesn't exist
                    }
                    return null;
                })());
            }
        }

        // Run all probes in parallel
        const results = await Promise.all(probes);
        results.forEach(r => { if (r) candidates.push(r); });

        return candidates;
    }

    /**
     * Strategy: Search Engine
     * Query search engines for policy URLs
     */
    private async searchEngine(task: JarvisTask): Promise<JarvisCandidate[]> {
        const candidates: JarvisCandidate[] = [];

        // DuckDuckGo HTML search
        try {
            const searchQuery = `site:${task.domain} privacy policy`;
            const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`;

            const response = await got(searchUrl, {
                timeout: { request: WORKER_TIMEOUT },
                headers: { 'User-Agent': CRAWLER_UA },
                retry: { limit: 0 } as any,
                throwHttpErrors: false
            });

            if (response.statusCode === 200) {
                const $ = cheerio.load(response.body);

                $('a.result__a').slice(0, 5).each((_, el) => {
                    const href = $(el).attr('href');
                    const title = $(el).text();

                    if (!href || !href.includes(task.domain)) return;

                    // Check if this looks like a policy URL
                    for (const type of task.targetTypes) {
                        const patterns = POLICY_PATTERNS[type];
                        if (patterns?.some(p => p.test(title) || p.test(href))) {
                            candidates.push({
                                url: href,
                                type,
                                confidence: 55,
                                source: 'search_engine',
                                linkText: title,
                                context: 'unknown',
                                workerId: this.config.id,
                                discoveryTimeMs: 0
                            });
                            break;
                        }
                    }
                });
            }
        } catch (e) {
            // Search failed
        }

        return candidates;
    }

    /**
     * Strategy: Deep Scan
     * Follow links from initial results to find nested policies
     */
    private async deepScan(task: JarvisTask): Promise<JarvisCandidate[]> {
        // This is a placeholder - deep scanning would be done in a later phase
        // after initial candidates are found
        return [];
    }
}
