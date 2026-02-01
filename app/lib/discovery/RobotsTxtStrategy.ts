import { DiscoveryStrategy } from './Strategy';
import { PolicyCandidate } from '../types/policy';
import { CONFIG } from '../config';
import got from 'got';
import robotsParser from 'robots-parser';
import { logger } from '../logger';
import { enforceRateLimit } from './rateLimiter';

export class RobotsTxtStrategy implements DiscoveryStrategy {
    name = 'RobotsTxtStrategy';

    async execute(domain: string): Promise<PolicyCandidate[]> {
        // This strategy primarily finds Sitemaps, which are then used by SitemapStrategy.
        // But sometimes robots.txt explicitly disallows privacy policy (rare) or points to it?
        // Actually, robots.txt doesn't usually link to privacy policy directly.
        // It links to sitemaps.
        // So this strategy returns NOTHING directly, but is a helper for SitemapStrategy.
        // However, to keep interface consistent, we'll return empty array.
        // The Engine will call this to get sitemaps.

        // WAIT: The plan says "Parse for Sitemap directives. Return the sitemap URL for the next strategy."
        // But the interface returns PolicyCandidate[].
        // Let's modify the architecture slightly: The Engine will handle Sitemap discovery via a helper, 
        // or we make SitemapStrategy capable of fetching robots.txt itself.

        // Let's make SitemapStrategy robust enough to check robots.txt first.
        return [];
    }

    async getSitemaps(domain: string): Promise<string[]> {
        const robotsUrl = `https://${domain}/robots.txt`;
        try {
            // Enforce rate limiting before request
            await enforceRateLimit(robotsUrl);
            
            const response = await got(robotsUrl, {
                timeout: { request: 5000 },
                headers: { 'User-Agent': CONFIG.USER_AGENT },
                throwHttpErrors: false,
            });
            
            // Handle rate limiting
            if (response.statusCode === 429) {
                logger.warn(`[RobotsTxtStrategy] Rate limited (429) on ${robotsUrl}`);
                return [];
            }
            
            if (response.statusCode !== 200) {
                return [];
            }

            const robot = robotsParser(robotsUrl, response.body);
            return robot.getSitemaps();
        } catch (e) {
            return [];
        }
    }
}
