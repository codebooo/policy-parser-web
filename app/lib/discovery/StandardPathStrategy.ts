import { DiscoveryStrategy } from './Strategy';
import { PolicyCandidate } from '../types/policy';
import { CONFIG } from '../config';
import got from 'got';
import { logger } from '../logger';
import { isValidPolicyUrl } from '../extractor/fetcher';
import { enforceRateLimit } from './rateLimiter';

export class StandardPathStrategy implements DiscoveryStrategy {
    name = 'StandardPathStrategy';

    async execute(domain: string): Promise<PolicyCandidate[]> {
        const candidates: PolicyCandidate[] = [];
        const baseUrl = `https://${domain}`;
        
        // Check if this domain has special handling
        const specialConfig = CONFIG.SPECIAL_DOMAINS[domain];
        if (specialConfig?.privacy) {
            logger.info(`Using special privacy URL for ${domain}: ${specialConfig.privacy}`);
            try {
                // Enforce rate limiting before request
                await enforceRateLimit(specialConfig.privacy);
                
                // Use GET instead of HEAD - some servers (like Facebook) don't respond well to HEAD
                const response = await got(specialConfig.privacy, {
                    timeout: { request: 10000 },
                    retry: { limit: 1 } as any,
                    headers: { 
                        'User-Agent': CONFIG.USER_AGENT,
                        'Accept-Language': 'en-US,en;q=0.9',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    },
                    followRedirect: true,
                    throwHttpErrors: false, // Don't throw on non-2xx, handle manually
                });
                
                // Accept 200-399 range (includes redirects that resolve)
                if (response.statusCode >= 200 && response.statusCode < 400) {
                    const finalUrl = response.url;
                    
                    // Verify it's not a login page
                    if (isValidPolicyUrl(finalUrl)) {
                        // Quick content check - make sure it's not a login page content
                        const body = response.body.toLowerCase().slice(0, 5000);
                        const hasPrivacyContent = body.includes('privacy') || body.includes('data protection') || body.includes('personal information');
                        const isLoginPage = body.includes('sign in') && body.includes('password') && !hasPrivacyContent;
                        
                        if (!isLoginPage && hasPrivacyContent) {
                            candidates.push({
                                url: finalUrl,
                                source: 'special_domain',
                                confidence: 95,
                                foundAt: new Date(),
                                methodDetail: `Special domain config for ${domain}`
                            } as PolicyCandidate);
                            
                            logger.info(`Special URL successful for ${domain}: ${finalUrl}`);
                            return candidates;
                        } else {
                            logger.info(`Special URL content check failed for ${domain} (login page or no privacy content)`);
                        }
                    }
                } else {
                    logger.info(`Special URL returned status ${response.statusCode} for ${domain}`);
                }
            } catch (error: any) {
                logger.error(`Special URL failed for ${domain}`, error.message || error);
            }
        }

        // Standard path discovery with parallel HEAD requests
        const checks = CONFIG.STANDARD_PATHS.map(async (path) => {
            const url = `${baseUrl}${path}`;
            try {
                const response = await got.head(url, {
                    timeout: { request: 5000 },
                    retry: { limit: 0 } as any,
                    headers: { 
                        'User-Agent': CONFIG.USER_AGENT,
                        'Accept-Language': 'en-US,en;q=0.9',
                    },
                    followRedirect: true,
                    throwHttpErrors: false,
                });

                if (response.statusCode === 200) {
                    const contentType = response.headers['content-type'];
                    const finalUrl = response.url;
                    
                    if (!isValidPolicyUrl(finalUrl)) {
                        logger.info(`Skipping ${finalUrl} - appears to be auth page`);
                        return null;
                    }
                    
                    if (contentType && contentType.includes('text/html')) {
                        return {
                            url: finalUrl,
                            source: 'standard_path',
                            confidence: 80,
                            foundAt: new Date(),
                            methodDetail: `Found at ${path}`
                        } as PolicyCandidate;
                    }
                }
            } catch (error) {
                // Ignore errors silently
            }
            return null;
        });

        const results = await Promise.all(checks);

        results.forEach(r => {
            if (r) candidates.push(r);
        });

        return candidates;
    }
}
