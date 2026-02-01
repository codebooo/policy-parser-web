import { DiscoveryStrategy } from './Strategy';
import { PolicyCandidate } from '../types/policy';
import { CONFIG } from '../config';
import got from 'got';
import * as cheerio from 'cheerio';
import { logger } from '../logger';
import { isBlockedDomain } from './domainValidator';
import { enforceRateLimit } from './rateLimiter';

export class SearchFallbackStrategy implements DiscoveryStrategy {
    name = 'SearchFallbackStrategy';

    async execute(domain: string): Promise<PolicyCandidate[]> {
        const candidates: PolicyCandidate[] = [];
        
        // Try multiple search approaches
        const searchMethods = [
            this.tryDuckDuckGo.bind(this),
            this.tryBingSearch.bind(this),
        ];
        
        for (const method of searchMethods) {
            try {
                const results = await method(domain);
                if (results.length > 0) {
                    candidates.push(...results);
                    break; // Stop if we found results
                }
            } catch (error) {
                // Continue to next method
            }
        }
        
        return candidates;
    }
    
    private async tryDuckDuckGo(domain: string): Promise<PolicyCandidate[]> {
        const candidates: PolicyCandidate[] = [];
        const query = encodeURIComponent(`site:${domain} privacy policy`);
        const url = `https://html.duckduckgo.com/html/?q=${query}`;

        try {
            // Enforce rate limiting before request
            await enforceRateLimit(url);
            
            const response = await got(url, {
                headers: { 
                    'User-Agent': CONFIG.USER_AGENT,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                },
                timeout: { request: 10000 },
                retry: { limit: 0 } as any,
                throwHttpErrors: false,
            });

            if (response.statusCode === 429) {
                logger.warn(`DuckDuckGo rate limited (429)`);
                return candidates;
            }

            if (response.statusCode !== 200) {
                logger.info(`DuckDuckGo returned status ${response.statusCode}`);
                return candidates;
            }

            const $ = cheerio.load(response.body);

            $('.result__a').each((i, el) => {
                if (i >= 5) return; // Check more results to find non-blocked ones

                const href = $(el).attr('href');
                const text = $(el).text().trim();

                if (href && href.includes(domain)) {
                    // CRITICAL: Skip blocked domains (LinkedIn, social media, etc.)
                    if (isBlockedDomain(href)) {
                        logger.info(`SearchFallback: Skipping blocked DuckDuckGo result: ${href}`);
                        return; // continue to next result
                    }
                    
                    if (candidates.length < 3) { // Only add first 3 valid results
                        candidates.push({
                            url: href,
                            source: 'search_fallback',
                            confidence: 50 - (candidates.length * 10),
                            foundAt: new Date(),
                            methodDetail: `DuckDuckGo result #${i + 1}: "${text}"`
                        });
                    }
                }
            });
        } catch (error: any) {
            logger.error(`DuckDuckGo search failed for ${domain}`, error.message);
        }

        return candidates;
    }
    
    private async tryBingSearch(domain: string): Promise<PolicyCandidate[]> {
        const candidates: PolicyCandidate[] = [];
        const query = encodeURIComponent(`site:${domain} privacy policy`);
        const url = `https://www.bing.com/search?q=${query}`;

        try {
            // Enforce rate limiting before request
            await enforceRateLimit(url);
            
            const response = await got(url, {
                headers: { 
                    'User-Agent': CONFIG.USER_AGENT,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                },
                timeout: { request: 10000 },
                retry: { limit: 0 } as any,
                throwHttpErrors: false,
            });

            if (response.statusCode === 429) {
                logger.warn(`Bing rate limited (429)`);
                return candidates;
            }

            if (response.statusCode !== 200) {
                return candidates;
            }

            const $ = cheerio.load(response.body);

            $('li.b_algo h2 a').each((i, el) => {
                if (i >= 5) return; // Check more results to find non-blocked ones

                const href = $(el).attr('href');
                const text = $(el).text().trim();

                if (href && (href.includes(domain) || href.includes('privacy'))) {
                    // CRITICAL: Skip blocked domains (LinkedIn, social media, etc.)
                    if (isBlockedDomain(href)) {
                        logger.info(`SearchFallback: Skipping blocked Bing result: ${href}`);
                        return; // continue to next result
                    }
                    
                    if (candidates.length < 3) { // Only add first 3 valid results
                        candidates.push({
                            url: href,
                            source: 'search_fallback',
                            confidence: 45 - (candidates.length * 10),
                            foundAt: new Date(),
                            methodDetail: `Bing result #${i + 1}: "${text}"`
                        });
                    }
                }
            });
        } catch (error: any) {
            logger.error(`Bing search failed for ${domain}`, error.message);
        }

        return candidates;
    }
}
