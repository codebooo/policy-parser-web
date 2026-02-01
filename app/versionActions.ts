'use server';

import { createClient } from '@/utils/supabase/server';
import { logger } from './lib/logger';
import { identifyTarget } from './lib/identifier';
import { PolicyDiscoveryEngine } from './lib/discovery/Engine';
import { extractPolicyContent } from './lib/extractor';
import { SYSTEM_PROMPT, USER_PROMPT } from './lib/analyzer/prompt';
import { calculateScore } from './lib/analyzer/scorer';
import { AnalysisResultSchema } from './lib/types/analysis';
import { generateObject } from 'ai';
import { getGeminiModel } from './lib/ai/gemini';
import crypto from 'crypto';

/**
 * Generate SHA256 hash of policy content for change detection
 */
function hashContent(text: string): string {
    return crypto.createHash('sha256').update(text.trim()).digest('hex');
}

/**
 * Get word count from text
 */
function getWordCount(text: string): number {
    return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

export interface PolicyVersion {
    id: string;
    domain: string;
    policy_type: string;
    policy_url: string | null;
    content_hash: string;
    score: number | null;
    word_count: number | null;
    analyzed_at: string;
}

export interface PolicyVersionDetail extends PolicyVersion {
    raw_text: string | null;
    analysis_data: any;
}

export interface CacheCheckResult {
    isCached: boolean;
    isUpToDate: boolean;
    cachedVersion?: PolicyVersionDetail;
    currentHash?: string;
    message: string;
}

/**
 * Check if a policy has been analyzed and is still up to date
 * Returns cached analysis if available and current, otherwise indicates need for new analysis
 */
/**
 * Check if a policy has been analyzed and is still up to date
 * Returns cached analysis if available and current, otherwise indicates need for new analysis
 */
export async function checkPolicyCache(
    domain: string,
    policyType: string = 'privacy'
): Promise<CacheCheckResult> {
    const supabase = await createClient();
    const cleanDomain = domain.replace(/^www\./, '').toLowerCase();

    logger.info(`[PolicyCache] Checking cache for ${cleanDomain}/${policyType}`);

    try {
        // Step 1: Get the latest cached version
        const { data: latestVersion, error: cacheError } = await supabase
            .from('policy_versions')
            .select('*')
            .eq('domain', cleanDomain)
            .eq('policy_type', policyType)
            .order('analyzed_at', { ascending: false })
            .limit(1)
            .single();

        if (cacheError && cacheError.code !== 'PGRST116') {
            // PGRST116 = no rows found, which is fine
            logger.error('[PolicyCache] Error fetching cached version', cacheError);
        }

        if (!latestVersion) {
            return {
                isCached: false,
                isUpToDate: false,
                message: 'No cached analysis found. Will perform fresh analysis.'
            };
        }

        // OPTIMIZATION: Check TTL (Time To Live)
        // If cache is less than 7 days old, assume it's up to date and SKIP live fetch
        const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
        const analyzedAt = new Date(latestVersion.analyzed_at).getTime();
        const now = Date.now();
        const age = now - analyzedAt;

        if (age < CACHE_TTL_MS) {
            logger.info(`[PolicyCache] Cache is fresh (${Math.round(age / 1000 / 60)} mins old). Skipping live fetch.`);
            return {
                isCached: true,
                isUpToDate: true,
                cachedVersion: latestVersion as PolicyVersionDetail,
                message: 'Cached analysis is recent (< 7 days). Using cached results.'
            };
        }

        logger.info(`[PolicyCache] Cache is stale (${Math.round(age / 1000 / 60 / 60 / 24)} days old). Verifying with live fetch...`);

        // Step 2: Fetch current policy to get hash (only if cache is stale)
        let currentHash: string | undefined;
        let currentUrl: string | undefined;

        try {
            const identity = await identifyTarget(cleanDomain);
            const engine = new PolicyDiscoveryEngine();
            const candidate = await engine.discover(identity.cleanDomain);

            if (candidate) {
                currentUrl = candidate.url;
                const extracted = await extractPolicyContent(candidate.url);
                currentHash = hashContent(extracted.markdown);

                logger.info(`[PolicyCache] Current policy hash: ${currentHash.substring(0, 16)}...`);
            }
        } catch (fetchError) {
            logger.warn('[PolicyCache] Could not fetch current policy for comparison', fetchError);
        }

        // Step 3: Compare
        // Check if cache is up to date
        if (currentHash && latestVersion.content_hash === currentHash) {
            logger.info('[PolicyCache] Cache is UP TO DATE (Hash match)!');

            // Optional: Touch the analyzed_at date to refresh TTL? 
            // For now, we just return it.

            return {
                isCached: true,
                isUpToDate: true,
                cachedVersion: latestVersion as PolicyVersionDetail,
                currentHash,
                message: 'Cached analysis is current. Using cached results to save API credits.'
            };
        }

        // Cache exists but policy has changed
        logger.info('[PolicyCache] Cache exists but policy has CHANGED');
        return {
            isCached: true,
            isUpToDate: false,
            cachedVersion: latestVersion as PolicyVersionDetail,
            currentHash,
            message: 'Policy has been updated since last analysis. Will perform fresh analysis.'
        };

    } catch (error: any) {
        logger.error('[PolicyCache] Cache check failed', error);
        return {
            isCached: false,
            isUpToDate: false,
            message: `Cache check error: ${error.message}`
        };
    }
}

/**
 * Save an analyzed policy to the versions table
 */
export async function savePolicyVersion(
    domain: string,
    policyType: string,
    policyUrl: string | null,
    rawText: string,
    analysisData: any,
    score: number
): Promise<{ success: boolean; versionId?: string; error?: string }> {
    const supabase = await createClient();
    const cleanDomain = domain.replace(/^www\./, '').toLowerCase();
    const contentHash = hashContent(rawText);
    const wordCount = getWordCount(rawText);

    logger.info(`[PolicyCache] Saving new version for ${cleanDomain}/${policyType}`);

    try {
        const { data, error } = await supabase
            .from('policy_versions')
            .upsert({
                domain: cleanDomain,
                policy_type: policyType,
                policy_url: policyUrl,
                content_hash: contentHash,
                raw_text: rawText.substring(0, 500000), // Limit to 500KB
                analysis_data: analysisData,
                score,
                word_count: wordCount,
                analyzed_at: new Date().toISOString()
            }, {
                onConflict: 'domain,policy_type,content_hash',
                ignoreDuplicates: false
            })
            .select('id')
            .single();

        if (error) {
            logger.error('[PolicyCache] Failed to save version', error);
            return { success: false, error: error.message };
        }

        logger.info(`[PolicyCache] Saved version ${data.id}`);
        return { success: true, versionId: data.id };

    } catch (error: any) {
        logger.error('[PolicyCache] Save failed', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get all historical versions of a policy (PRO feature)
 */
export async function getPolicyVersionHistory(
    domain: string,
    policyType: string = 'privacy',
    limit: number = 20
): Promise<{ success: boolean; versions?: PolicyVersion[]; error?: string }> {
    const supabase = await createClient();
    const cleanDomain = domain.replace(/^www\./, '').toLowerCase();

    logger.info(`[PolicyVersions] Fetching history for ${cleanDomain}/${policyType}`);

    try {
        const { data, error } = await supabase
            .from('policy_versions')
            .select('id, domain, policy_type, policy_url, content_hash, score, word_count, analyzed_at')
            .eq('domain', cleanDomain)
            .eq('policy_type', policyType)
            .order('analyzed_at', { ascending: false })
            .limit(limit);

        if (error) {
            logger.error('[PolicyVersions] Failed to fetch history', error);
            return { success: false, error: error.message };
        }

        return { success: true, versions: data as PolicyVersion[] };

    } catch (error: any) {
        logger.error('[PolicyVersions] History fetch failed', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get a specific version's full details (PRO feature)
 */
export async function getPolicyVersionById(
    versionId: string
): Promise<{ success: boolean; version?: PolicyVersionDetail; error?: string }> {
    const supabase = await createClient();

    logger.info(`[PolicyVersions] Fetching version ${versionId}`);

    try {
        const { data, error } = await supabase
            .from('policy_versions')
            .select('*')
            .eq('id', versionId)
            .single();

        if (error) {
            logger.error('[PolicyVersions] Failed to fetch version', error);
            return { success: false, error: error.message };
        }

        // Record view in user history if logged in
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            await supabase.from('user_policy_history').upsert({
                user_id: user.id,
                policy_version_id: versionId,
                viewed_at: new Date().toISOString()
            }, {
                onConflict: 'user_id,policy_version_id'
            });
        }

        return { success: true, version: data as PolicyVersionDetail };

    } catch (error: any) {
        logger.error('[PolicyVersions] Version fetch failed', error);
        return { success: false, error: error.message };
    }
}

/**
 * Compare two policy versions (PRO feature)
 * Returns a detailed diff of the changes
 */
export async function comparePolicyVersions(
    versionId1: string,
    versionId2: string
): Promise<{
    success: boolean;
    comparison?: {
        version1: PolicyVersionDetail;
        version2: PolicyVersionDetail;
        scoreDiff: number;
        wordCountDiff: number;
        textDiff: {
            added: string[];
            removed: string[];
            unchanged: number;
        };
        analysisDiff: {
            key: string;
            oldValue: any;
            newValue: any;
            changed: boolean;
        }[];
    };
    error?: string;
}> {
    const supabase = await createClient();

    logger.info(`[PolicyVersions] Comparing ${versionId1} vs ${versionId2}`);

    try {
        // Fetch both versions
        const { data: versions, error } = await supabase
            .from('policy_versions')
            .select('*')
            .in('id', [versionId1, versionId2]);

        if (error || !versions || versions.length !== 2) {
            return { success: false, error: error?.message || 'Could not fetch both versions' };
        }

        // Sort by analyzed_at to get older vs newer
        versions.sort((a, b) => new Date(a.analyzed_at).getTime() - new Date(b.analyzed_at).getTime());
        const [olderVersion, newerVersion] = versions as PolicyVersionDetail[];

        // Calculate diffs
        const scoreDiff = (newerVersion.score || 0) - (olderVersion.score || 0);
        const wordCountDiff = (newerVersion.word_count || 0) - (olderVersion.word_count || 0);

        // Simple text diff (paragraph-based)
        const oldParagraphs = (olderVersion.raw_text || '').split(/\n\n+/).filter(p => p.trim());
        const newParagraphs = (newerVersion.raw_text || '').split(/\n\n+/).filter(p => p.trim());

        const oldSet = new Set(oldParagraphs.map(p => p.trim().toLowerCase()));
        const newSet = new Set(newParagraphs.map(p => p.trim().toLowerCase()));

        const added = newParagraphs.filter(p => !oldSet.has(p.trim().toLowerCase()));
        const removed = oldParagraphs.filter(p => !newSet.has(p.trim().toLowerCase()));
        const unchanged = newParagraphs.filter(p => oldSet.has(p.trim().toLowerCase())).length;

        // Analysis diff
        const analysisDiff: { key: string; oldValue: any; newValue: any; changed: boolean }[] = [];
        const keysToCompare = ['summary', 'score', 'data_collected', 'third_party_sharing', 'user_rights'];

        for (const key of keysToCompare) {
            const oldVal = olderVersion.analysis_data?.[key];
            const newVal = newerVersion.analysis_data?.[key];
            const changed = JSON.stringify(oldVal) !== JSON.stringify(newVal);

            analysisDiff.push({
                key,
                oldValue: oldVal,
                newValue: newVal,
                changed
            });
        }

        return {
            success: true,
            comparison: {
                version1: olderVersion,
                version2: newerVersion,
                scoreDiff,
                wordCountDiff,
                textDiff: {
                    added,
                    removed,
                    unchanged
                },
                analysisDiff
            }
        };

    } catch (error: any) {
        logger.error('[PolicyVersions] Comparison failed', error);
        return { success: false, error: error.message };
    }
}

/**
 * Analyze with caching - checks cache first, only calls AI if needed
 * This is the main entry point that saves API credits
 */
export async function analyzeWithCaching(
    input: string,
    policyType: string = 'privacy',
    forceRefresh: boolean = false
): Promise<{
    success: boolean;
    fromCache: boolean;
    data?: any;
    versionId?: string;
    error?: string;
}> {
    logger.info(`[AnalyzeWithCache] Starting for ${input}/${policyType} (forceRefresh: ${forceRefresh})`);

    try {
        const identity = await identifyTarget(input);
        const domain = identity.cleanDomain;

        // Step 1: Check cache (unless force refresh)
        if (!forceRefresh) {
            const cacheCheck = await checkPolicyCache(domain, policyType);

            if (cacheCheck.isCached && cacheCheck.isUpToDate && cacheCheck.cachedVersion) {
                logger.info(`[AnalyzeWithCache] CACHE HIT! Returning cached analysis`);

                // Return the cached analysis data
                return {
                    success: true,
                    fromCache: true,
                    data: {
                        ...cacheCheck.cachedVersion.analysis_data,
                        url: cacheCheck.cachedVersion.policy_url,
                        domain: domain,
                        rawPolicyText: cacheCheck.cachedVersion.raw_text,
                        cachedAt: cacheCheck.cachedVersion.analyzed_at
                    },
                    versionId: cacheCheck.cachedVersion.id
                };
            }

            logger.info(`[AnalyzeWithCache] Cache miss or outdated: ${cacheCheck.message}`);
        }

        // Step 2: Perform fresh analysis
        logger.info(`[AnalyzeWithCache] Performing fresh analysis...`);

        const engine = new PolicyDiscoveryEngine();
        const candidate = await engine.discover(domain);

        if (!candidate) {
            return { success: false, fromCache: false, error: `Could not find policy for ${domain}` };
        }

        const extracted = await extractPolicyContent(candidate.url);

        const { object: analysis } = await generateObject({
            model: getGeminiModel(),
            system: SYSTEM_PROMPT,
            prompt: USER_PROMPT(extracted.markdown),
            schema: AnalysisResultSchema,
            mode: 'json'
        });

        const score = calculateScore(analysis);
        analysis.score = score;

        // Step 3: Save to cache
        const saveResult = await savePolicyVersion(
            domain,
            policyType,
            candidate.url,
            extracted.markdown,
            analysis,
            score
        );

        const resultsWithUrl = {
            ...analysis,
            url: candidate.url,
            domain: domain,
            rawPolicyText: extracted.markdown
        };

        logger.info(`[AnalyzeWithCache] Fresh analysis complete, saved version: ${saveResult.versionId}`);

        return {
            success: true,
            fromCache: false,
            data: resultsWithUrl,
            versionId: saveResult.versionId
        };

    } catch (error: any) {
        logger.error('[AnalyzeWithCache] Analysis failed', error);
        return { success: false, fromCache: false, error: error.message };
    }
}

/**
 * Get cached analysis for multiple policy types (used by comprehensive analysis)
 */
export async function getCachedAnalysisMultiple(
    domain: string,
    policyTypes: string[]
): Promise<{
    cached: { type: string; analysis: any; versionId: string }[];
    needsAnalysis: string[];
}> {
    const supabase = await createClient();
    const cleanDomain = domain.replace(/^www\./, '').toLowerCase();

    const cached: { type: string; analysis: any; versionId: string }[] = [];
    const needsAnalysis: string[] = [];

    for (const policyType of policyTypes) {
        const cacheCheck = await checkPolicyCache(cleanDomain, policyType);

        if (cacheCheck.isCached && cacheCheck.isUpToDate && cacheCheck.cachedVersion) {
            cached.push({
                type: policyType,
                analysis: {
                    ...cacheCheck.cachedVersion.analysis_data,
                    url: cacheCheck.cachedVersion.policy_url,
                    rawPolicyText: cacheCheck.cachedVersion.raw_text,
                    cachedAt: cacheCheck.cachedVersion.analyzed_at
                },
                versionId: cacheCheck.cachedVersion.id
            });
        } else {
            needsAnalysis.push(policyType);
        }
    }

    logger.info(`[CacheMultiple] ${cached.length} cached, ${needsAnalysis.length} need analysis`);
    return { cached, needsAnalysis };
}
