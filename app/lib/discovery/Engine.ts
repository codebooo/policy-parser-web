import { DiscoveryStrategy } from './Strategy';
import { DirectFetchStrategy } from './DirectFetchStrategy';
import { StandardPathStrategy } from './StandardPathStrategy';
import { SitemapStrategy } from './SitemapStrategy';
import { HomepageScraperStrategy } from './HomepageScraperStrategy';
import { SearchFallbackStrategy } from './SearchFallbackStrategy';
import { PolicyCandidate } from '../types/policy';
import { logger } from '../logger';
import { deepLogger } from '../deepLogger';
import { CONFIG } from '../config';
import { deepScanPrivacyPage } from './deepLinkScanner';
import { validatePolicyContent, quickRejectCheck, countHighConfidenceKeywords } from './contentValidator';
import { enforceRateLimit } from './rateLimiter';
import { extractCarlFeatures } from '../carl/FeatureExtractor';
import { getCarl } from '../carl/Carl';
import got, { RequestError } from 'got';

export class PolicyDiscoveryEngine {
    private strategies: DiscoveryStrategy[];

    constructor() {
        // STRATEGY ORDER (optimized for reliability):
        // 1. HomepageScraperStrategy - Most reliable, scans footer links
        // 2. DirectFetchStrategy - GET requests with content verification
        // 3. StandardPathStrategy - HEAD requests on common paths
        // 4. SitemapStrategy - Parse sitemap.xml for policy URLs
        // 5. SearchFallbackStrategy - Last resort search engine query
        this.strategies = [
            new HomepageScraperStrategy(),   // PRIMARY - Footer scanning is most reliable
            new DirectFetchStrategy(),       // Secondary - Direct GET verification
            new StandardPathStrategy(),      // Tertiary - Standard path checking
            new SitemapStrategy(),           // Fourth - Sitemap parsing
            new SearchFallbackStrategy()     // Last resort
        ];
    }

    async discover(domain: string): Promise<PolicyCandidate | null> {
        logger.info(`Starting discovery for ${domain}`);
        deepLogger.log('discovery', 'engine_start', 'info', `Starting policy discovery for ${domain}`, {
            domain,
            strategiesCount: this.strategies.length,
            strategyOrder: this.strategies.map(s => s.name)
        });

        // ============ PHASE 0: CHECK SPECIAL DOMAINS FIRST ============
        const cleanDomain = domain.replace(/^www\./, '');
        const specialConfig = CONFIG.SPECIAL_DOMAINS[domain] || 
                              CONFIG.SPECIAL_DOMAINS[`www.${domain}`] ||
                              CONFIG.SPECIAL_DOMAINS[cleanDomain];
        
        if (specialConfig?.privacy) {
            logger.info(`Found SPECIAL_DOMAIN config for ${domain}: ${specialConfig.privacy}`);
            deepLogger.log('discovery', 'special_domain', 'info', 
                `Using special domain config for ${domain}`, {
                    domain,
                    url: specialConfig.privacy
                });
            
            return {
                url: specialConfig.privacy,
                source: 'special_domain' as const,
                confidence: 99,
                foundAt: new Date(),
                methodDetail: `Special domain configuration for ${domain}`
            };
        }

        const allCandidates: PolicyCandidate[] = [];
        const strategyResults: Record<string, { success: boolean; candidatesFound: number; duration: number }> = {};

        for (const strategy of this.strategies) {
            const strategyTimer = deepLogger.time(`strategy_${strategy.name}`);
            
            logger.info(`Running strategy: ${strategy.name}`);
            deepLogger.logStrategy(strategy.name, 'start', { domain });
            
            try {
                const candidates = await strategy.execute(domain);
                const duration = strategyTimer();
                
                strategyResults[strategy.name] = {
                    success: candidates.length > 0,
                    candidatesFound: candidates.length,
                    duration
                };

                if (candidates.length > 0) {
                    logger.info(`Strategy ${strategy.name} found ${candidates.length} candidates`);
                    deepLogger.logStrategy(strategy.name, 'found', {
                        domain,
                        candidatesFound: candidates.length,
                        confidence: candidates[0]?.confidence,
                        url: candidates[0]?.url,
                        duration
                    });
                    
                    // Log each candidate
                    candidates.forEach((c, idx) => {
                        deepLogger.log('discovery', 'candidate_found', 'debug', 
                            `Candidate ${idx + 1}: ${c.url}`, {
                                index: idx,
                                url: c.url,
                                confidence: c.confidence,
                                source: c.source,
                                methodDetail: c.methodDetail
                            });
                    });
                    
                    allCandidates.push(...candidates);

                    // If we found a high confidence candidate (>=85), stop early
                    const perfectMatch = candidates.find(c => c.confidence >= 85);
                    if (perfectMatch) {
                        logger.info(`Found high-confidence match (${perfectMatch.confidence}), stopping early.`);
                        deepLogger.log('discovery', 'early_stop', 'info', 
                            `High-confidence match found, stopping discovery`, {
                                url: perfectMatch.url,
                                confidence: perfectMatch.confidence,
                                strategy: strategy.name
                            });
                        break;
                    }
                } else {
                    deepLogger.logStrategy(strategy.name, 'skip', {
                        domain,
                        reason: 'No candidates found',
                        duration
                    });
                }
            } catch (e: any) {
                const duration = strategyTimer();
                logger.error(`Strategy ${strategy.name} failed`, e);
                deepLogger.logError('discovery', `strategy_${strategy.name}`, e, {
                    domain,
                    duration
                });
                
                strategyResults[strategy.name] = {
                    success: false,
                    candidatesFound: 0,
                    duration
                };
            }
        }

        // Log summary of all strategy results
        deepLogger.log('discovery', 'engine_summary', 'info', 
            `Discovery complete for ${domain}`, {
                domain,
                totalCandidates: allCandidates.length,
                strategyResults,
                topCandidate: allCandidates[0] ? {
                    url: allCandidates[0].url,
                    confidence: allCandidates[0].confidence,
                    source: allCandidates[0].source
                } : null
            });

        if (allCandidates.length === 0) {
            deepLogger.log('discovery', 'no_results', 'warn', 
                `No policy candidates found for ${domain}`, { domain });
            return null;
        }

        // Sort by confidence descending
        allCandidates.sort((a, b) => b.confidence - a.confidence);

        // Return best
        let best = allCandidates[0];
        
        // ============ CONTENT VALIDATION ============
        // Verify the top candidate actually contains policy content
        // If not, this triggers deeper search
        logger.info(`[discovery] Validating top candidate content: ${best.url}`);
        deepLogger.log('discovery', 'content_validation_start', 'info',
            `Validating content of top candidate`, {
                url: best.url,
                initialConfidence: best.confidence
            });
        
        const contentValidation = await this.validateCandidateContent(best.url);
        
        if (!contentValidation.isValid && contentValidation.shouldDeepSearch) {
            logger.info(`[discovery] Top candidate failed content validation, searching deeper...`);
            deepLogger.log('discovery', 'content_validation_failed', 'warn',
                `Top candidate failed content validation, triggering deep search`, {
                    url: best.url,
                    validationConfidence: contentValidation.confidence
                });
            
            // Try the next few candidates
            let foundValidCandidate = false;
            for (let i = 1; i < Math.min(allCandidates.length, 5); i++) {
                const candidate = allCandidates[i];
                const validation = await this.validateCandidateContent(candidate.url);
                
                if (validation.isValid) {
                    logger.info(`[discovery] Found valid policy at ${candidate.url}`);
                    deepLogger.log('discovery', 'alternative_candidate_valid', 'info',
                        `Alternative candidate passed validation`, {
                            url: candidate.url,
                            confidence: validation.confidence
                        });
                    
                    best = {
                        ...candidate,
                        confidence: Math.max(candidate.confidence, validation.confidence),
                        methodDetail: `Content-validated alternative: ${candidate.methodDetail}`
                    };
                    foundValidCandidate = true;
                    break;
                }
            }
            
            if (!foundValidCandidate) {
                // Adjust confidence of best candidate down since content validation failed
                best.confidence = Math.max(best.confidence - 20, 30);
                best.methodDetail = `${best.methodDetail} (content validation inconclusive)`;
            }
        } else if (contentValidation.isValid) {
            // Boost confidence if content validation passed
            logger.info(`[discovery] Content validation PASSED for ${best.url}`);
            deepLogger.log('discovery', 'content_validation_passed', 'info',
                `Top candidate passed content validation`, {
                    url: best.url,
                    validationConfidence: contentValidation.confidence
                });
            
            // Boost confidence based on content validation
            const boost = Math.min(10, Math.floor(contentValidation.confidence / 10));
            best.confidence = Math.min(best.confidence + boost, 98);
            best.methodDetail = `${best.methodDetail} (content validated: ${contentValidation.confidence}%)`;
        }
        
        // ============ DEEP LINK SCANNING ============
        // For privacy policies, try to find nested/more specific pages
        // This handles German patterns like /datenschutz/ -> /datenschutz/datenschutzerklaerung/
        try {
            logger.info(`Running deep link scan from ${best.url}`);
            deepLogger.log('discovery', 'deep_scan_start', 'info', 
                `Starting deep link scan from ${best.url}`, {
                    domain,
                    initialUrl: best.url,
                    initialConfidence: best.confidence
                });
            
            const deepResult = await deepScanPrivacyPage(best.url, domain, 2);
            
            if (deepResult && deepResult.confidence > best.confidence) {
                logger.info(`Deep scan found better URL: ${deepResult.foundUrl} (confidence: ${deepResult.confidence})`);
                deepLogger.log('discovery', 'deep_scan_improved', 'info', 
                    `Deep scan found improved privacy policy URL`, {
                        domain,
                        originalUrl: best.url,
                        newUrl: deepResult.foundUrl,
                        originalConfidence: best.confidence,
                        newConfidence: deepResult.confidence,
                        reason: deepResult.reason
                    });
                
                best = {
                    url: deepResult.foundUrl,
                    source: best.source,
                    confidence: deepResult.confidence,
                    foundAt: new Date(),
                    methodDetail: `Deep scan: ${deepResult.reason}`
                };
            } else {
                logger.info(`Deep scan did not find better URL, using ${best.url}`);
            }
        } catch (e: any) {
            logger.error(`Deep scan failed`, e);
            deepLogger.logError('discovery', 'deep_scan', e, { domain, url: best.url });
        }
        
        deepLogger.log('discovery', 'selected', 'info', 
            `Selected best candidate: ${best.url}`, {
                url: best.url,
                confidence: best.confidence,
                source: best.source,
                methodDetail: best.methodDetail,
                totalCandidatesConsidered: allCandidates.length
            });

        logger.info(`Policy found`, { url: best.url, source: best.source, confidence: best.confidence, foundAt: best.foundAt, methodDetail: best.methodDetail });
        return best;
    }

    /**
     * Fetch and validate content of a URL to verify it's actually a policy
     * Uses Carl neural network + heuristic validation
     * Includes rate limiting protection
     */
    private async validateCandidateContent(url: string): Promise<{
        isValid: boolean;
        confidence: number;
        shouldDeepSearch: boolean;
    }> {
        try {
            // Enforce rate limiting before making request
            await enforceRateLimit(url);
            
            const response = await got(url, {
                timeout: { request: 10000 },
                headers: {
                    'User-Agent': CONFIG.USER_AGENT,
                    'Accept': 'text/html,application/xhtml+xml',
                    'Accept-Language': 'en-US,en;q=0.9,de;q=0.8',
                },
                retry: { limit: 0 } as any, // Handle retries ourselves
                followRedirect: true,
                throwHttpErrors: false,
            });

            // Handle rate limiting
            if (response.statusCode === 429) {
                logger.warn(`[validateCandidateContent] Rate limited (429) for ${url}`);
                // Don't fail validation entirely, just return inconclusive
                return { isValid: false, confidence: 0, shouldDeepSearch: false };
            }

            if (response.statusCode !== 200) {
                logger.info(`[validateCandidateContent] ${url} returned ${response.statusCode}`);
                return { isValid: false, confidence: 0, shouldDeepSearch: false };
            }

            const content = response.body;

            // Quick rejection check first
            const quickCheck = quickRejectCheck(content);
            if (quickCheck.rejected) {
                logger.info(`[validateCandidateContent] Quick reject: ${quickCheck.reason}`);
                return { isValid: false, confidence: 0, shouldDeepSearch: true };
            }

            // Use Carl for neural network validation
            let carlConfidence = 0;
            try {
                const carl = await getCarl();
                const features = extractCarlFeatures(
                    'Privacy Policy',  // Generic link text
                    url,
                    'footer',          // Assume footer context
                    new URL(url).origin,
                    content            // Pass actual page content
                );
                const prediction = carl.predict(features);
                carlConfidence = prediction.score * 100;
                logger.info(`[validateCandidateContent] Carl confidence for ${url}: ${carlConfidence.toFixed(1)}%`);
            } catch (e) {
                logger.warn(`[validateCandidateContent] Carl not available, using heuristics only`);
            }

            // Full heuristic validation
            const validation = validatePolicyContent(content);
            
            // Also check high-confidence keywords
            const highConfResult = countHighConfidenceKeywords(content);
            
            // Combine Carl and heuristic scores
            // If Carl is confident (>70%) OR heuristics pass, consider it valid
            const combinedConfidence = carlConfidence > 0 
                ? Math.round(carlConfidence * 0.6 + validation.confidence * 0.4)
                : validation.confidence;
            
            const isValid = carlConfidence >= 70 || validation.isValid || 
                           (carlConfidence >= 50 && highConfResult.keywordCount >= 3);
            
            logger.info(`[validateCandidateContent] Validation result for ${url}`, {
                isValid,
                carlConfidence: carlConfidence.toFixed(1),
                heuristicConfidence: validation.confidence,
                combinedConfidence,
                keywords: highConfResult.keywordCount,
                bigrams: highConfResult.bigramCount,
            });

            return {
                isValid,
                confidence: combinedConfidence,
                shouldDeepSearch: !isValid && content.length > 500
            };
        } catch (error: any) {
            // Check if it's a rate limit error from got
            if (error instanceof RequestError && error.response?.statusCode === 429) {
                logger.warn(`[validateCandidateContent] Rate limited for ${url}`);
                return { isValid: false, confidence: 0, shouldDeepSearch: false };
            }
            
            logger.error(`[validateCandidateContent] Error validating ${url}`, error.message);
            return { isValid: false, confidence: 0, shouldDeepSearch: false };
        }
    }
}
