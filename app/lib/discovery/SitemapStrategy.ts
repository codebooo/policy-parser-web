import { DiscoveryStrategy } from './Strategy';
import { PolicyCandidate } from '../types/policy';
import { CONFIG } from '../config';
import got from 'got';
import { parseStringPromise } from 'xml2js';
import { RobotsTxtStrategy } from './RobotsTxtStrategy';
import { logger } from '../logger';
import { enforceRateLimit } from './rateLimiter';

export class SitemapStrategy implements DiscoveryStrategy {
    name = 'SitemapStrategy';

    async execute(domain: string): Promise<PolicyCandidate[]> {
        const candidates: PolicyCandidate[] = [];
        const robotsStrategy = new RobotsTxtStrategy();

        // 1. Get Sitemaps from robots.txt
        let sitemaps = await robotsStrategy.getSitemaps(domain);

        // 2. Add default sitemap.xml if none found
        if (sitemaps.length === 0) {
            sitemaps.push(`https://${domain}/sitemap.xml`);
        }

        // Limit to first 3 sitemaps to avoid massive crawling
        sitemaps = sitemaps.slice(0, 3);

        for (const sitemapUrl of sitemaps) {
            try {
                // Enforce rate limiting before request
                await enforceRateLimit(sitemapUrl);
                
                const response = await got(sitemapUrl, {
                    timeout: { request: 10000 },
                    headers: { 'User-Agent': CONFIG.USER_AGENT },
                    throwHttpErrors: false,
                });
                
                // Handle rate limiting
                if (response.statusCode === 429) {
                    logger.warn(`[SitemapStrategy] Rate limited (429) on ${sitemapUrl}`);
                    continue;
                }
                
                if (response.statusCode !== 200) {
                    continue;
                }

                // Parse XML
                const result = await parseStringPromise(response.body);

                // Handle sitemap index vs urlset
                let urls: string[] = [];

                if (result.urlset && result.urlset.url) {
                    // Standard sitemap
                    urls = result.urlset.url.map((u: any) => u.loc[0]);
                } else if (result.sitemapindex && result.sitemapindex.sitemap) {
                    // Sitemap index - we should fetch these too, but for now let's just log it
                    // Recursive fetching is dangerous for timeouts. 
                    // Let's just try to find "privacy" in the index URLs themselves? Unlikely.
                    // For a robust system, we'd fetch the first child sitemap.
                    const firstChild = result.sitemapindex.sitemap[0].loc[0];
                    // Quick fetch of child with rate limiting
                    try {
                        await enforceRateLimit(firstChild);
                        const childResp = await got(firstChild, { 
                            timeout: { request: 5000 },
                            throwHttpErrors: false,
                        });
                        if (childResp.statusCode === 200) {
                            const childResult = await parseStringPromise(childResp.body);
                            if (childResult.urlset && childResult.urlset.url) {
                                urls = childResult.urlset.url.map((u: any) => u.loc[0]);
                            }
                        }
                    } catch (e) { }
                }

                // Filter for privacy
                const privacyUrls = urls.filter(u =>
                    u.toLowerCase().includes('privacy') ||
                    u.toLowerCase().includes('legal') ||
                    u.toLowerCase().includes('terms')
                );

                privacyUrls.forEach(url => {
                    candidates.push({
                        url: url,
                        source: 'sitemap',
                        confidence: 90, // Very high confidence if in sitemap
                        foundAt: new Date(),
                        methodDetail: `Found in sitemap: ${sitemapUrl}`
                    });
                });

            } catch (error) {
                // Sitemap fetch failed
            }
        }

        return candidates;
    }
}
