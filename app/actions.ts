'use server';

import { createStreamableValue } from '@ai-sdk/rsc';
import { identifyTarget } from './lib/identifier';
import { PolicyDiscoveryEngine } from './lib/discovery/Engine';
import { Jarvis, discoverWithJarvis } from './lib/jarvis';
import { extractPolicyContent } from './lib/extractor';
import { SYSTEM_PROMPT, USER_PROMPT } from './lib/analyzer/prompt';
import { calculateScore } from './lib/analyzer/scorer';
import { AnalysisResultSchema, AnalysisResult } from './lib/types/analysis';
import { generateObject } from 'ai';
import { getGeminiModel, withKeyRotation, isQuotaError, markKeyExhausted, getLastUsedKeyIndex, getKeyPoolStatus } from './lib/ai/gemini';
import { createClient } from '@/utils/supabase/server';
import { logger } from './lib/logger';
import { logAnalysis, updateAnalysisFeedback } from './lib/analysisStore';
import { CONFIG, PolicyType } from './lib/config';
import { checkPolicyCache, savePolicyVersion } from './versionActions';
import { getCarl, extractCarlFeatures, getCarlFeatureNames, CARL_FEATURE_COUNT } from './lib/carl';
import { addToQueue, getNextQueueItem, updateQueueStatus, getQueueStats } from './lib/scraper/queue';
import { fetchHtml } from './lib/extractor/fetcher';

/**
 * Generate AI analysis with automatic API key rotation on quota errors
 * Wraps generateObject from Vercel AI SDK with retry logic
 */
async function generateWithRetry<T>(options: {
    system: string;
    prompt: string;
    schema: any;
    mode?: 'json' | 'tool';
}): Promise<{ object: T }> {
    const status = getKeyPoolStatus();
    logger.info(`[AI] Starting generation with ${status.available}/${status.total} keys available`);

    let lastError: Error | null = null;

    // Try each available key
    for (let attempt = 0; attempt < status.total; attempt++) {
        try {
            const model = getGeminiModel();
            const keyIndex = getLastUsedKeyIndex();

            logger.info(`[AI] Attempt ${attempt + 1}/${status.total} using key ${keyIndex + 1}`);

            const result = await generateObject({
                model,
                system: options.system,
                prompt: options.prompt,
                schema: options.schema,
                mode: options.mode || 'json'
            });

            logger.info(`[AI] Success with key ${keyIndex + 1}`);
            return result as { object: T };

        } catch (error: any) {
            lastError = error;
            const keyIndex = getLastUsedKeyIndex();

            // Check if this is a quota/rate limit error
            if (isQuotaError(error)) {
                markKeyExhausted(keyIndex);
                const remaining = getKeyPoolStatus();
                logger.warn(`[AI] Quota exceeded on key ${keyIndex + 1}. ${remaining.available} keys remaining. Error: ${error.message}`);

                if (remaining.available === 0) {
                    throw new Error(`All ${status.total} API keys have hit their quota limits. Please try again in 15 minutes.`);
                }

                // Continue to next key
                continue;
            }

            // Non-quota error - don't retry
            logger.error(`[AI] Non-quota error: ${error.message}`);
            throw error;
        }
    }

    // All attempts failed
    throw lastError || new Error('Analysis failed after trying all available API keys');
}

/**
 * Simple function to find and fetch a policy for testing purposes
 * Used by /api/test-pawd and /api/test-ironclad endpoints
 */
export async function findAndFetchPolicy(input: string): Promise<{
    success: boolean;
    url?: string;
    date?: string;
    textLength?: number;
    text?: string;
    error?: string;
}> {
    try {
        // Step 1: Identify the target
        const identity = await identifyTarget(input);
        logger.info('findAndFetchPolicy: Identified', identity);

        // Step 2: Discover policy URL (using JARVIS! 🚀)
        const jarvisResult = await discoverWithJarvis(identity.cleanDomain, {
            maxWorkers: 10,
            timeout: 10000,
            targetPolicies: ['privacy']
        });

        if (!jarvisResult.success || jarvisResult.policies.length === 0) {
            return {
                success: false,
                error: `Could not find a privacy policy for ${identity.cleanDomain}`
            };
        }

        const candidate = jarvisResult.policies.find(p => p.type === 'privacy') || jarvisResult.policies[0];
        logger.info(`findAndFetchPolicy: JARVIS found policy in ${jarvisResult.discoveryTimeMs}ms`, candidate);

        // Step 3: Extract content to verify it works
        const extracted = await extractPolicyContent(candidate.url);

        return {
            success: true,
            url: candidate.url,
            date: new Date().toISOString(),
            textLength: extracted.rawLength,
            text: extracted.markdown
        };
    } catch (error: any) {
        logger.error('findAndFetchPolicy failed', error);
        return {
            success: false,
            error: error?.message || 'Unknown error'
        };
    }
}

/**
 * Analyze a policy text (for testing endpoints)
 * Used by /api/test-ironclad
 */
export async function analyzePolicy(text: string, url: string, userId?: string): Promise<{
    privacyScore: number;
    summary: string;
    risks?: any[];
}> {
    const { object: analysis } = await generateWithRetry<AnalysisResult>({
        system: SYSTEM_PROMPT,
        prompt: USER_PROMPT(text),
        schema: AnalysisResultSchema,
        mode: 'json'
    });

    const score = calculateScore(analysis);

    return {
        privacyScore: score,
        summary: analysis.summary,
        risks: analysis.key_findings
    };
}

export async function analyzeDomain(input: string) {
    // Wrap entire function in try-catch to surface any initialization errors
    try {
        const stream = createStreamableValue({
            status: 'initializing',
            message: 'Initializing analysis...',
            step: 0,
            data: null as any
        });

        (async () => {
            try {
                // Step 1: Identification
                stream.update({ status: 'identifying', message: `Verifying ${input}...`, step: 1, data: null });
                const identity = await identifyTarget(input);
                logger.info('Identity verified', identity);

            // Step 2: Check cache FIRST - save API credits! 💰
            stream.update({ status: 'checking_cache', message: `Checking for cached analysis...`, step: 2, data: null });
            const cacheResult = await checkPolicyCache(identity.cleanDomain, 'privacy');

            if (cacheResult.isCached && cacheResult.isUpToDate && cacheResult.cachedVersion) {
                logger.info('🎉 CACHE HIT! Using cached analysis - saving API credits!');
                stream.update({ status: 'cache_hit', message: `Found up-to-date cached analysis! Saving API credits...`, step: 3, data: null });

                const cachedData = {
                    ...cacheResult.cachedVersion.analysis_data,
                    url: cacheResult.cachedVersion.policy_url,
                    domain: identity.cleanDomain,
                    rawPolicyText: cacheResult.cachedVersion.raw_text,
                    fromCache: true,
                    cachedAt: cacheResult.cachedVersion.analyzed_at,
                    versionId: cacheResult.cachedVersion.id
                };

                stream.done({ status: 'complete', message: 'Analysis complete! (from cache)', step: 4, data: cachedData });
                return;
            }

            logger.info('Cache miss or outdated - performing fresh analysis');

            // Step 3: Discovery (using JARVIS - 5x faster! 🚀)
            stream.update({ status: 'discovering', message: `Searching for privacy policy on ${identity.cleanDomain}...`, step: 3, data: null });
            const jarvisResult = await discoverWithJarvis(identity.cleanDomain, {
                maxWorkers: 10,
                timeout: 10000,
                useCarl: true,
                targetPolicies: ['privacy']
            });

            if (!jarvisResult.success || jarvisResult.policies.length === 0) {
                throw new Error(`Could not find a privacy policy for ${identity.cleanDomain}`);
            }

            const candidate = jarvisResult.policies.find(p => p.type === 'privacy') || jarvisResult.policies[0];
            logger.info(`Policy found by JARVIS in ${jarvisResult.discoveryTimeMs}ms`, candidate);

            // Step 4: Extraction
            stream.update({ status: 'extracting', message: `Reading policy from ${candidate.url}...`, step: 4, data: null });
            const extracted = await extractPolicyContent(candidate.url);
            logger.info('Content extracted', { length: extracted.rawLength });

            // Step 5: Analysis (using Gemini with key rotation)
            stream.update({ status: 'analyzing', message: 'Analyzing legal text (this may take a moment)...', step: 5, data: null });

            const { object: analysis } = await generateWithRetry<AnalysisResult>({
                system: SYSTEM_PROMPT,
                prompt: USER_PROMPT(extracted.markdown),
                schema: AnalysisResultSchema,
                mode: 'json'
            });

            // Calculate Score Deterministically
            const score = calculateScore(analysis);
            analysis.score = score;

            // Add URL and raw text to results
            const resultsWithUrl = {
                ...analysis,
                url: candidate.url,
                domain: identity.cleanDomain,
                rawPolicyText: extracted.markdown // Include the original extracted text
            };

            // Step 6: Save to cache (version history) 📦
            stream.update({ status: 'caching', message: 'Caching results for future use...', step: 6, data: null });
            const versionResult = await savePolicyVersion(
                identity.cleanDomain,
                'privacy',
                candidate.url,
                extracted.markdown,
                analysis,
                score
            );

            if (versionResult.success) {
                logger.info(`Saved to version cache: ${versionResult.versionId}`);
                (resultsWithUrl as any).versionId = versionResult.versionId;
            }

            // Step 7: Save to user's analysis history
            stream.update({ status: 'saving', message: 'Saving results...', step: 7, data: null });
            const supabase = await createClient();

            const { data: { user } } = await supabase.auth.getUser();

            if (user) {
                await supabase.from('analyses').insert({
                    user_id: user.id,
                    domain: identity.cleanDomain,
                    company_name: identity.originalInput,
                    policy_url: candidate.url,
                    score: score,
                    summary: analysis.summary,
                    key_findings: analysis.key_findings,
                    data_collected: analysis.data_collected,
                    third_party_sharing: analysis.third_party_sharing,
                    user_rights: analysis.user_rights,
                    contact_info: analysis.contact_info,
                    raw_text: extracted.markdown
                });
            }

            // Log to file-based analysis store for admin dashboard
            await logAnalysis({
                domain: identity.cleanDomain,
                url: candidate.url,
                timestamp: new Date().toISOString(),
                success: true,
                score,
                policyType: 'privacy',
                analysisTimeMs: Date.now() - Date.now()
            });

            stream.done({ status: 'complete', message: 'Analysis complete!', step: 8, data: resultsWithUrl });

        } catch (error: any) {
            logger.error('Analysis failed', error);
            const errorMessage = error?.message || 'An unexpected error occurred';

            // Log failure to analysis store
            await logAnalysis({
                domain: input,
                url: null,
                timestamp: new Date().toISOString(),
                success: false,
                error: errorMessage,
                policyType: 'privacy'
            });

            stream.done({ status: 'error', message: errorMessage, step: -1, data: null });
        }
    })();

    return { output: stream.value };
    } catch (initError: any) {
        // If stream creation itself fails, return a simple error object
        console.error('[analyzeDomain] Initialization error:', initError);
        const errorStream = createStreamableValue({
            status: 'error',
            message: `Initialization failed: ${initError?.message || 'Unknown error'}`,
            step: -1,
            data: null
        });
        errorStream.done();
        return { output: errorStream.value };
    }
}

/**
 * Internal (non-streaming) version of analyzeDomain for server-to-server calls
 * Used by tracking system to check for policy updates
 */
export async function analyzeDomainInternal(input: string): Promise<{
    success: boolean;
    data?: any;
    error?: string;
}> {
    try {
        // Step 1: Identification
        const identity = await identifyTarget(input);
        logger.info('Internal analysis: Identity verified', identity);

        // Step 2: Discovery
        const engine = new PolicyDiscoveryEngine();
        const candidate = await engine.discover(identity.cleanDomain);

        if (!candidate) {
            return { success: false, error: `Could not find a privacy policy for ${identity.cleanDomain}` };
        }
        logger.info('Internal analysis: Policy found', candidate);

        // Step 3: Extraction
        const extracted = await extractPolicyContent(candidate.url);
        logger.info('Internal analysis: Content extracted', { length: extracted.rawLength });

        // Step 4: Analysis
        const { object: analysis } = await generateWithRetry<AnalysisResult>({
            system: SYSTEM_PROMPT,
            prompt: USER_PROMPT(extracted.markdown),
            schema: AnalysisResultSchema,
            mode: 'json'
        });

        // Calculate Score
        const score = calculateScore(analysis);
        analysis.score = score;

        // Add URL and raw text to results
        const resultsWithUrl = {
            ...analysis,
            url: candidate.url,
            domain: identity.cleanDomain,
            rawPolicyText: extracted.markdown
        };

        return { success: true, data: resultsWithUrl };
    } catch (error: any) {
        logger.error('Internal analysis failed', error);
        return { success: false, error: error?.message || 'An unexpected error occurred' };
    }
}

/**
 * Analyze policy text directly (for file uploads and paste text)
 * Streaming version for UI with progress updates
 */
export async function analyzeText(text: string, sourceName?: string) {
    const stream = createStreamableValue({
        status: 'initializing',
        message: 'Initializing analysis...',
        step: 0,
        data: null as any
    });

    (async () => {
        try {
            // Validate input
            if (!text || text.trim().length < 100) {
                throw new Error('Text is too short. Please provide at least 100 characters of policy text.');
            }

            // Step 1: Analyzing
            stream.update({ status: 'analyzing', message: 'Analyzing legal text (this may take a moment)...', step: 1, data: null });

            const { object: analysis } = await generateWithRetry<AnalysisResult>({
                system: SYSTEM_PROMPT,
                prompt: USER_PROMPT(text),
                schema: AnalysisResultSchema,
                mode: 'json'
            });

            // Calculate Score Deterministically
            const score = calculateScore(analysis);
            analysis.score = score;

            // Add metadata to results
            const resultsWithMeta = {
                ...analysis,
                url: null, // No URL for uploaded/pasted text
                domain: sourceName || 'Uploaded Document',
                rawPolicyText: text
            };

            // Step 2: Save to DB (if user is logged in)
            stream.update({ status: 'saving', message: 'Saving results...', step: 2, data: null });
            const supabase = await createClient();

            const { data: { user } } = await supabase.auth.getUser();

            if (user) {
                await supabase.from('analyses').insert({
                    user_id: user.id,
                    domain: sourceName || 'uploaded_document',
                    company_name: sourceName || 'Uploaded Document',
                    policy_url: null,
                    score: score,
                    summary: analysis.summary,
                    key_findings: analysis.key_findings,
                    data_collected: analysis.data_collected,
                    third_party_sharing: analysis.third_party_sharing,
                    user_rights: analysis.user_rights,
                    contact_info: analysis.contact_info,
                    raw_text: text.substring(0, 50000) // Limit stored text size
                });
            }

            stream.done({ status: 'complete', message: 'Analysis complete!', step: 3, data: resultsWithMeta });

        } catch (error: any) {
            logger.error('Text analysis failed', error);
            const errorMessage = error?.message || 'An unexpected error occurred';
            stream.done({ status: 'error', message: errorMessage, step: -1, data: null });
        }
    })();

    return { output: stream.value };
}

/**
 * PRO FEATURE: Discover all available policies for a company
 * Returns a list of found policy types and their URLs
 * 
 * NEW v2.0 INTELLIGENT APPROACH:
 * 1. Check SPECIAL_DOMAINS config first (verified company URLs)
 * 2. Deep footer crawling (policies are almost always in footers)
 * 3. Legal hub discovery (/legal, /policies pages)
 * 4. Sitemap parsing for policy URLs
 * 5. CONTENT VALIDATION - verify the page is actually a policy document
 * 6. Search engine fallback with content validation
 * 
 * This approach doesn't just append "/privacy" to URLs - it intelligently
 * crawls, validates, and verifies that discovered URLs are ACTUAL policy documents.
 */
export async function discoverAllPolicies(input: string): Promise<{
    success: boolean;
    domain?: string;
    policies?: { type: PolicyType; name: string; url: string }[];
    error?: string;
}> {
    try {
        logger.info(`[discoverAllPolicies] 🤖 Starting JARVIS parallel discovery for: ${input}`);

        const identity = await identifyTarget(input);
        const domain = identity.cleanDomain;

        logger.info(`[discoverAllPolicies] Resolved domain: ${domain}`);

        // Use JARVIS - parallel discovery with 10 workers! 🚀
        const result = await discoverWithJarvis(domain, {
            maxWorkers: 10,
            timeout: 15000,
            useCarl: true
        });

        if (!result.success) {
            return {
                success: false,
                error: result.error || 'Discovery failed'
            };
        }

        // Convert to the expected format
        const foundPolicies = result.policies.map(p => ({
            type: p.type,
            name: p.name,
            url: p.url
        }));

        logger.info(`[discoverAllPolicies] 🤖 JARVIS complete! Found ${foundPolicies.length} policies in ${result.discoveryTimeMs}ms`);
        logger.info(`[discoverAllPolicies] Workers: ${result.workersUsed}, Candidates: ${result.candidatesFound}`);

        return {
            success: true,
            domain,
            policies: foundPolicies
        };
    } catch (error: any) {
        logger.error('[discoverAllPolicies] JARVIS discovery failed', error);
        return {
            success: false,
            error: error?.message || 'Failed to discover policies'
        };
    }
}

/**
 * PRO FEATURE: Analyze a specific policy URL
 * For use after discoverAllPolicies to analyze individual policies
 * Now with caching support to save API credits! 💰
 */
export async function analyzeSpecificPolicy(url: string, policyType: string, domain?: string) {
    const stream = createStreamableValue({
        status: 'initializing',
        message: 'Initializing analysis...',
        step: 0,
        data: null as any,
        policyType
    });

    (async () => {
        try {
            logger.info(`[analyzeSpecificPolicy] Starting analysis for ${policyType}`, { url });

            // Try to extract domain from URL if not provided
            let policyDomain = domain;
            if (!policyDomain) {
                try {
                    policyDomain = new URL(url).hostname.replace(/^www\./, '');
                } catch {
                    policyDomain = 'unknown';
                }
            }

            // Map policy name to type for caching
            const cacheType = policyType.toLowerCase()
                .replace(/privacy policy/i, 'privacy')
                .replace(/terms of service|terms & conditions|terms/i, 'terms')
                .replace(/cookie policy|cookies/i, 'cookies')
                .replace(/data processing|dpa/i, 'dpa')
                .replace(/acceptable use|aup/i, 'aup')
                .replace(/security/i, 'security');

            // Step 1: Check cache first 💰
            stream.update({ status: 'checking_cache', message: `Checking cache for ${policyType}...`, step: 1, data: null, policyType });
            const cacheResult = await checkPolicyCache(policyDomain, cacheType);

            if (cacheResult.isCached && cacheResult.isUpToDate && cacheResult.cachedVersion) {
                logger.info(`🎉 CACHE HIT for ${policyType}! Using cached analysis`);
                stream.update({ status: 'cache_hit', message: `Found cached ${policyType}! Saving API credits...`, step: 2, data: null, policyType });

                const cachedData = {
                    ...cacheResult.cachedVersion.analysis_data,
                    url: cacheResult.cachedVersion.policy_url || url,
                    policyType,
                    rawPolicyText: cacheResult.cachedVersion.raw_text,
                    fromCache: true,
                    cachedAt: cacheResult.cachedVersion.analyzed_at,
                    versionId: cacheResult.cachedVersion.id
                };

                stream.done({ status: 'complete', message: 'Analysis complete! (from cache)', step: 3, data: cachedData, policyType });
                return;
            }

            logger.info(`Cache miss for ${policyType} - performing fresh analysis`);

            // Step 2: Extract content
            stream.update({ status: 'extracting', message: `Reading ${policyType}...`, step: 2, data: null, policyType });

            let extracted;
            try {
                extracted = await extractPolicyContent(url);
                logger.info(`[analyzeSpecificPolicy] ${policyType} content extracted successfully`, {
                    length: extracted.rawLength,
                    title: extracted.title,
                    url: extracted.url
                });
            } catch (extractError: any) {
                logger.error(`[analyzeSpecificPolicy] ${policyType} extraction failed`, {
                    url,
                    error: extractError?.message,
                    stack: extractError?.stack
                });
                throw new Error(`Failed to extract ${policyType} content: ${extractError?.message || 'Unknown extraction error'}`);
            }

            // Step 3: AI Analysis
            stream.update({ status: 'analyzing', message: `Analyzing ${policyType}...`, step: 3, data: null, policyType });

            let analysis;
            try {
                const result = await generateWithRetry<AnalysisResult>({
                    system: SYSTEM_PROMPT,
                    prompt: USER_PROMPT(extracted.markdown),
                    schema: AnalysisResultSchema,
                    mode: 'json'
                });
                analysis = result.object;
                logger.info(`[analyzeSpecificPolicy] ${policyType} AI analysis complete`);
            } catch (aiError: any) {
                logger.error(`[analyzeSpecificPolicy] ${policyType} AI analysis failed`, {
                    error: aiError?.message,
                    stack: aiError?.stack
                });
                throw new Error(`AI analysis failed for ${policyType}: ${aiError?.message || 'Unknown AI error'}`);
            }

            const score = calculateScore(analysis);
            analysis.score = score;

            // Step 4: Save to cache 📦
            stream.update({ status: 'caching', message: `Caching ${policyType}...`, step: 4, data: null, policyType });
            const versionResult = await savePolicyVersion(
                policyDomain,
                cacheType,
                url,
                extracted.markdown,
                analysis,
                score
            );

            const resultsWithMeta = {
                ...analysis,
                url,
                policyType,
                rawPolicyText: extracted.markdown,
                versionId: versionResult.versionId
            };

            logger.info(`[analyzeSpecificPolicy] ${policyType} complete`, { score, url, versionId: versionResult.versionId });
            stream.done({ status: 'complete', message: 'Analysis complete!', step: 5, data: resultsWithMeta, policyType });

        } catch (error: any) {
            logger.error(`[analyzeSpecificPolicy] ${policyType} analysis failed`, {
                url,
                error: error?.message,
                stack: error?.stack
            });
            const errorMessage = error?.message || 'An unexpected error occurred';
            stream.done({ status: 'error', message: errorMessage, step: -1, data: null, policyType });
        }
    })();

    return { output: stream.value };
}

/**
 * Submit feedback to train the Neural Network
 * @param domain The domain being analyzed
 * @param correctUrl The URL that is definitely correct (Reward +1)
 * @param incorrectUrl Optional URL that was wrong (Reward 0)
 */
export async function submitPolicyFeedback(
    domain: string,
    correctUrl: string,
    incorrectUrl?: string
): Promise<{ success: boolean; error?: string }> {
    try {
        logger.info(`[Feedback] Received feedback for ${domain}`);

        const carl = await getCarl();

        // Train Carl on Correct URL (Target = 1)
        // We need to fetch the page to extract features properly
        try {
            const html = await fetchHtml(correctUrl).catch(() => '');
            const features = extractCarlFeatures(
                html.substring(0, 1000),
                correctUrl,
                'footer',
                domain,
                html // Pass full content for better feature extraction
            );
            await carl.train(features, 1, domain, correctUrl);
            logger.info(`[Feedback] Carl trained positive on ${correctUrl}`);
        } catch (e) {
            logger.warn(`[Feedback] Failed to fetch correct URL for Carl training: ${correctUrl}`);
        }

        // Train Carl on Incorrect URL (Target = 0)
        if (incorrectUrl) {
            try {
                const html = await fetchHtml(incorrectUrl).catch(() => '');
                const features = extractCarlFeatures(
                    html.substring(0, 1000),
                    incorrectUrl,
                    'footer',
                    domain,
                    html
                );
                await carl.train(features, 0, domain, incorrectUrl);
                logger.info(`[Feedback] Carl trained negative on ${incorrectUrl}`);
            } catch (e) {
                logger.warn(`[Feedback] Failed to fetch incorrect URL for Carl training: ${incorrectUrl}`);
            }
        }

        // Update analysis store with feedback
        const feedbackType = incorrectUrl ? 'negative' : 'positive';
        await updateAnalysisFeedback(domain, feedbackType, correctUrl);

        return { success: true };
    } catch (error: any) {
        logger.error('[Feedback] Failed to process feedback', error);
        return { success: false, error: error.message };
    }
}

/**
 * Add domains to the background scraping queue
 */
export async function addDomainsToQueue(domains: string[]) {
    return await addToQueue(domains);
}

/**
 * Process the next item in the queue
 * This is called by the client (e.g., "Start Processing" button)
 */
export async function processNextQueueItem() {
    try {
        const item = await getNextQueueItem();
        if (!item) {
            return { success: false, message: 'Queue is empty' };
        }

        logger.info(`[Queue] Processing ${item.domain}...`);

        // Run discovery
        const result = await discoverAllPolicies(item.domain);

        // Update status
        if (result.success) {
            await updateQueueStatus(item.id, 'completed', result);
            return { success: true, domain: item.domain, result };
        } else {
            await updateQueueStatus(item.id, 'failed', { error: result.error });
            return { success: false, domain: item.domain, error: result.error };
        }
    } catch (error: any) {
        logger.error('[Queue] Processing failed', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get current queue statistics
 */
export async function getQueueStatus() {
    return await getQueueStats();
}

/**
 * Clears all cached policy versions from the database
 * Admin only feature
 */
export async function clearAllCache(): Promise<{ success: boolean; count?: number; error?: string }> {
    try {
        const supabase = await createClient();

        // First count how many items we have
        const { count: beforeCount } = await supabase
            .from('policy_versions')
            .select('*', { count: 'exact', head: true });

        // Delete all records from policy_versions
        // Note: This requires a policy that allows deletion or being a service role/admin
        const { error } = await supabase
            .from('policy_versions')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000'); // Hack to delete all rows (delete requires a filter)

        if (error) {
            logger.error('Failed to clear cache', error);
            return { success: false, error: error.message };
        }

        logger.info(`Cleared ${beforeCount} items from cache`);
        return { success: true, count: beforeCount || 0 };
    } catch (error: any) {
        logger.error('Error clearing cache', error);
        return { success: false, error: error.message };
    }
}

/**
 * CARL BRAIN DASHBOARD ACTIONS
 * Exposed for the /brain page to visualize and train Carl
 */

export async function getBrainStats() {
    const carl = await getCarl();
    const stats = carl.getStats();

    return {
        generation: stats.generation,
        trainingCount: stats.trainingCount,
        accuracy: stats.accuracy,
        lastTrainedAt: stats.lastTrainedAt,
        architecture: stats.architecture,
        learningRate: stats.learningRate,
        status: stats.isInitialized ? 'Active' : 'Loading',
        featureCount: CARL_FEATURE_COUNT
    };
}

export async function testBrainPrediction(
    url: string,
    linkText: string,
    context: 'footer' | 'nav' | 'body' | 'legal_hub'
) {
    const carl = await getCarl();

    // Determine the base URL for feature extraction
    let baseUrl = 'https://example.com';
    let pageContent: string | undefined = undefined;
    let fetchError: string | undefined = undefined;

    try {
        // Parse the URL to get the base domain
        const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
        baseUrl = `${urlObj.protocol}//${urlObj.hostname}`;

        // Actually fetch the page content to analyze
        logger.info(`[Carl Test] Fetching page content from: ${urlObj.toString()}`);

        try {
            const html = await fetchHtml(urlObj.toString());
            if (html && html.length > 0) {
                pageContent = html;
                logger.info(`[Carl Test] Fetched ${pageContent.length} chars of content`);
            } else {
                fetchError = 'Empty response';
            }
        } catch (fetchErr) {
            fetchError = fetchErr instanceof Error ? fetchErr.message : 'Failed to fetch page';
            logger.warn(`[Carl Test] Could not fetch page: ${fetchError}`);
        }
    } catch (e) {
        fetchError = e instanceof Error ? e.message : 'Invalid URL';
        logger.warn(`[Carl Test] URL parse error: ${fetchError}`);
    }

    // Extract features with actual page content
    const features = extractCarlFeatures(linkText, url, context, baseUrl, pageContent);
    const prediction = carl.predict(features);

    // Determine if this looks like a homepage vs actual policy page
    const isHomepage = checkIfHomepage(url);

    // Check URL strength - does it strongly suggest a policy?
    const urlLower = url.toLowerCase();
    const strongPolicyUrl = urlLower.includes('/privacy-policy') ||
        urlLower.includes('/privacy_policy') ||
        urlLower.includes('/privacypolicy') ||
        urlLower.includes('/datenschutz') ||
        urlLower.includes('/policies/privacy') ||
        urlLower.includes('/legal/privacy');

    // Adjust confidence based on actual analysis
    let adjustedScore = prediction.score;
    let adjustedConfidence = prediction.confidence;
    let analysisNote = '';

    // CRITICAL: If we couldn't fetch the page (404, network error, etc.), 
    // we can't trust URL-based features alone
    if (fetchError) {
        // Page doesn't exist or couldn't be fetched - very low confidence
        adjustedScore = Math.min(prediction.score * 0.1, 0.15); // Cap at 15% max
        adjustedConfidence = 'low';
        analysisNote = `Cannot verify - page fetch failed. URL patterns alone are not reliable.`;
        logger.info(`[Carl Test] Fetch failed, reducing score from ${prediction.score.toFixed(2)} to ${adjustedScore.toFixed(2)}`);
    } else if (!pageContent || pageContent.length < 100) {
        // Empty or very short response - suspicious
        adjustedScore = Math.min(prediction.score, 0.2);
        adjustedConfidence = 'low';
        analysisNote = 'Page content is empty or too short to analyze.';
    } else if (isHomepage) {
        // If it's a homepage, check if it actually contains policy content
        const contentAnalysis = analyzePageContent(pageContent);
        if (!contentAnalysis.isPolicy) {
            // Homepage without policy content should have low score
            adjustedScore = Math.min(prediction.score, 0.2);
            adjustedConfidence = 'low';
            analysisNote = 'This appears to be a homepage, not a privacy policy page.';
        }
    } else if (pageContent) {
        // We have content - analyze it more thoroughly
        const contentAnalysis = analyzePageContent(pageContent);

        if (contentAnalysis.isPolicy) {
            // Content confirms this is a policy - trust the raw score
            adjustedScore = prediction.score;
            adjustedConfidence = prediction.confidence;
            analysisNote = `Verified: ${contentAnalysis.matchCount} policy indicators found.`;
        } else if (strongPolicyUrl && pageContent.length > 5000) {
            // URL strongly suggests policy AND substantial content exists
            // This is likely a policy in another language or unusual format
            // Use a weighted approach instead of hard cap
            adjustedScore = Math.max(prediction.score * 0.85, 0.6); // At least 60% if URL is strong
            adjustedConfidence = 'medium';
            analysisNote = 'URL strongly indicates a policy page. Content may be in another language or format.';
        } else if (strongPolicyUrl) {
            // Strong policy URL but less content
            adjustedScore = Math.max(prediction.score * 0.7, 0.5);
            adjustedConfidence = 'medium';
            analysisNote = 'URL suggests a policy page, but content analysis is inconclusive.';
        } else {
            // Weak URL signals and no content match
            adjustedScore = Math.min(prediction.score, 0.35);
            adjustedConfidence = 'low';
            analysisNote = 'Could not verify this is a privacy policy from content analysis.';
        }
    }

    return {
        features,
        featureNames: getCarlFeatureNames(),
        score: adjustedScore,
        rawScore: prediction.score,
        isPolicy: adjustedScore > 0.5,
        confidence: adjustedConfidence,
        generation: prediction.generation,
        pageAnalyzed: !!pageContent,
        contentLength: pageContent?.length || 0,
        fetchError,
        analysisNote,
        isHomepage
    };
}

/**
 * Check if a URL appears to be a homepage (no path or just /)
 */
function checkIfHomepage(url: string): boolean {
    try {
        const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
        const path = urlObj.pathname;
        // Homepage has no path, just /, or index.html/php
        return path === '/' || path === '' || /^\/(index\.(html?|php|asp))?$/i.test(path);
    } catch {
        return false;
    }
}

/**
 * Check if page content contains privacy policy indicators
 */
function checkPageForPolicyContent(content: string): boolean {
    return analyzePageContent(content).isPolicy;
}

interface ContentAnalysis {
    isPolicy: boolean;
    matchCount: number;
    strongMatches: number;
    structuralMatches: number;
}

function analyzePageContent(content: string): ContentAnalysis {
    const lowerContent = content.toLowerCase();

    // Strong indicators that this IS a privacy policy
    const strongIndicators = [
        'privacy policy', 'privacy notice', 'data protection policy',
        'datenschutzerklärung', 'datenschutzrichtlinie', 'datenschutzhinweise',
        'politique de confidentialité', 'política de privacidad',
        'informativa sulla privacy', 'privacybeleid', 'integritetspolicy',
        'we collect', 'we may collect', 'personal information',
        'personenbezogene daten', 'datenerhebung', 'datenverarbeitung',
        'your rights', 'ihre rechte', 'right to access', 'right to erasure',
        'gdpr', 'dsgvo', 'ccpa', 'lgpd', 'pipeda',
        'data controller', 'data processor', 'personal data',
        'cookies we use', 'information we collect', 'how we protect'
    ];

    // Count how many strong indicators are present
    let strongMatches = 0;
    for (const indicator of strongIndicators) {
        if (lowerContent.includes(indicator)) {
            strongMatches++;
        }
    }

    // Also check for structural elements common in policies
    const structuralPatterns = [
        /what (information|data) (we|do we) collect/i,
        /how we use your (data|information)/i,
        /third.?part(y|ies)/i,
        /cookie(s)? (policy|notice)/i,
        /data retention/i,
        /contact us.*privacy/i,
        /welche daten.*erheben/i,
        /wie.*verwenden.*daten/i,
        /your (privacy )?choices/i,
        /opt.?out/i,
        /do not sell/i,
        /effective date/i,
        /last (updated|modified)/i
    ];

    let structuralMatches = 0;
    for (const pattern of structuralPatterns) {
        if (pattern.test(lowerContent)) {
            structuralMatches++;
        }
    }

    const totalMatches = strongMatches + structuralMatches;

    // Consider it a policy if we have at least 2 strong indicators or 3 structural matches
    const isPolicy = strongMatches >= 2 || structuralMatches >= 3 || (strongMatches >= 1 && structuralMatches >= 1);

    return {
        isPolicy,
        matchCount: totalMatches,
        strongMatches,
        structuralMatches
    };
}

export async function trainBrain(
    features: number[],
    target: number,
    domain: string = '',
    url: string = ''
) {
    const carl = await getCarl();
    await carl.train(features, target, domain, url);
    const stats = carl.getStats();

    return {
        success: true,
        newGeneration: stats.generation,
        trainingCount: stats.trainingCount
    };
}

export async function retrainBrain() {
    const carl = await getCarl();
    const result = await carl.retrain();

    return {
        success: true,
        generation: result.generation,
        accuracy: result.accuracy,
        examplesUsed: result.examplesUsed
    };
}

export async function resetBrain() {
    const carl = await getCarl();
    await carl.reset();

    return {
        success: true,
        message: 'Carl has been reset to factory settings'
    };
}

// ============================================================================
// ADMIN ACTIONS - Require admin authentication
// ============================================================================

const ADMIN_EMAIL = 'policyparser.admin@gmail.com';

/**
 * Check if current user is admin
 */
export async function isAdminUser(): Promise<boolean> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user?.email === ADMIN_EMAIL;
}

/**
 * Get all cached policies for admin view
 */
export async function getAdminCacheList(): Promise<{
    success: boolean;
    items?: {
        id: string;
        domain: string;
        policy_type: string;
        policy_url: string | null;
        score: number | null;
        word_count: number | null;
        analyzed_at: string;
    }[];
    error?: string;
}> {
    try {
        const supabase = await createClient();

        // Check admin
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email !== ADMIN_EMAIL) {
            return { success: false, error: 'Unauthorized' };
        }

        const { data, error } = await supabase
            .from('policy_versions')
            .select('id, domain, policy_type, policy_url, score, word_count, analyzed_at')
            .order('analyzed_at', { ascending: false })
            .limit(100);

        if (error) {
            logger.error('Failed to get cache list', error);
            return { success: false, error: error.message };
        }

        return { success: true, items: data || [] };
    } catch (error: any) {
        logger.error('Error getting cache list', error);
        return { success: false, error: error.message };
    }
}

/**
 * Delete a specific cached policy by ID
 */
export async function deleteCacheItem(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        const supabase = await createClient();

        // Check admin
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email !== ADMIN_EMAIL) {
            return { success: false, error: 'Unauthorized' };
        }

        const { error } = await supabase
            .from('policy_versions')
            .delete()
            .eq('id', id);

        if (error) {
            logger.error('Failed to delete cache item', error);
            return { success: false, error: error.message };
        }

        logger.info(`Deleted cache item: ${id}`);
        return { success: true };
    } catch (error: any) {
        logger.error('Error deleting cache item', error);
        return { success: false, error: error.message };
    }
}

/**
 * Delete all cached policies for a specific domain
 */
export async function deleteCacheByDomain(domain: string): Promise<{ success: boolean; count?: number; error?: string }> {
    try {
        const supabase = await createClient();

        // Check admin
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email !== ADMIN_EMAIL) {
            return { success: false, error: 'Unauthorized' };
        }

        const cleanDomain = domain.replace(/^www\./, '').toLowerCase();

        const { data, error } = await supabase
            .from('policy_versions')
            .delete()
            .eq('domain', cleanDomain)
            .select('id');

        if (error) {
            logger.error('Failed to delete domain cache', error);
            return { success: false, error: error.message };
        }

        const count = data?.length || 0;
        logger.info(`Deleted ${count} cache items for domain: ${cleanDomain}`);
        return { success: true, count };
    } catch (error: any) {
        logger.error('Error deleting domain cache', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get admin dashboard stats
 */
export async function getAdminStats(): Promise<{
    success: boolean;
    stats?: {
        totalUsers: number;
        totalAnalyses: number;
        totalCachedPolicies: number;
        totalLogs: number;
        queuePending: number;
        queueCompleted: number;
        queueFailed: number;
        brainGeneration: number;
    };
    error?: string;
}> {
    try {
        const supabase = await createClient();

        // Check admin
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email !== ADMIN_EMAIL) {
            return { success: false, error: 'Unauthorized' };
        }

        // Gather all stats in parallel
        const [
            { count: userCount },
            { count: analysisCount },
            { count: cacheCount },
            { count: logCount },
            queueStats,
            brainStats
        ] = await Promise.all([
            supabase.from('profiles').select('*', { count: 'exact', head: true }),
            supabase.from('analyses').select('*', { count: 'exact', head: true }),
            supabase.from('policy_versions').select('*', { count: 'exact', head: true }),
            supabase.from('deep_logs').select('*', { count: 'exact', head: true }),
            getQueueStats(),
            getBrainStats()
        ]);

        return {
            success: true,
            stats: {
                totalUsers: userCount || 0,
                totalAnalyses: analysisCount || 0,
                totalCachedPolicies: cacheCount || 0,
                totalLogs: logCount || 0,
                queuePending: queueStats.pending,
                queueCompleted: queueStats.completed,
                queueFailed: queueStats.failed,
                brainGeneration: brainStats.generation
            }
        };
    } catch (error: any) {
        logger.error('Error getting admin stats', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get recent analyses for admin dashboard
 */
export async function getAdminRecentAnalyses(): Promise<{
    success: boolean;
    analyses?: any[];
    error?: string;
}> {
    try {
        const supabase = await createClient();

        // Check admin
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email !== ADMIN_EMAIL) {
            return { success: false, error: 'Unauthorized' };
        }

        const { data, error } = await supabase
            .from('analyses')
            .select('id, company_name, domain, created_at, score, policy_url, discovery_method')
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) {
            logger.error('Failed to get recent analyses', error);
            return { success: false, error: error.message };
        }

        return { success: true, analyses: data || [] };
    } catch (error: any) {
        logger.error('Error getting recent analyses', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get all users for admin dashboard
 */
export async function getAdminUsers(): Promise<{
    success: boolean;
    users?: any[];
    error?: string;
}> {
    try {
        const supabase = await createClient();

        // Check admin
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email !== ADMIN_EMAIL) {
            return { success: false, error: 'Unauthorized' };
        }

        const { data, error } = await supabase
            .from('profiles')
            .select('id, email, display_name, is_pro, created_at')
            .order('created_at', { ascending: false });

        if (error) {
            logger.error('Failed to get users', error);
            return { success: false, error: error.message };
        }

        return { success: true, users: data || [] };
    } catch (error: any) {
        logger.error('Error getting users', error);
        return { success: false, error: error.message };
    }
}
