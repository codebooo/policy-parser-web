/**
 * JARVIS - Parallel Policy Discovery System
 * 
 * Main orchestrator that manages worker pool and coordinates parallel discovery.
 * Achieves 5x speed improvement through 10 concurrent workers.
 */

import { logger } from '../logger';
import { CONFIG, PolicyType } from '../config';
import { getCarl } from '../carl';
import { JarvisWorker } from './JarvisWorker';
import {
    JarvisCandidate,
    JarvisOptions,
    JarvisPolicy,
    JarvisProgress,
    JarvisResult,
    JarvisStrategy,
    JarvisTask,
    JarvisWorkerConfig
} from './types';

// Default options
const DEFAULT_OPTIONS: Required<JarvisOptions> = {
    maxWorkers: 10,
    timeout: 15000,
    streaming: false,
    useCarl: true,
    targetPolicies: ['privacy', 'terms', 'cookies', 'security', 'gdpr', 'ccpa', 'ai', 'acceptable_use']
};

// Worker strategy assignments (how to distribute work across workers)
const WORKER_STRATEGY_ASSIGNMENTS: { strategy: JarvisStrategy; priority: number }[] = [
    { strategy: 'homepage_crawl', priority: 1 },    // Worker 1 - Primary homepage scan
    { strategy: 'homepage_crawl', priority: 1 },    // Worker 2 - Backup homepage scan
    { strategy: 'sitemap_parse', priority: 2 },     // Worker 3 - Sitemap
    { strategy: 'legal_hub_crawl', priority: 2 },   // Worker 4 - Legal hub
    { strategy: 'direct_probe', priority: 3 },      // Worker 5 - Direct paths (privacy/terms)
    { strategy: 'direct_probe', priority: 3 },      // Worker 6 - Direct paths (cookies/security)
    { strategy: 'direct_probe', priority: 4 },      // Worker 7 - Direct paths (gdpr/ccpa)
    { strategy: 'direct_probe', priority: 4 },      // Worker 8 - Direct paths (ai/aup)
    { strategy: 'search_engine', priority: 5 },     // Worker 9 - Search fallback
    { strategy: 'deep_scan', priority: 6 }          // Worker 10 - Deep scanning
];

/**
 * Jarvis - Main orchestrator class
 */
export class Jarvis {
    private options: Required<JarvisOptions>;
    private workers: JarvisWorker[] = [];
    private progressCallback?: (progress: JarvisProgress) => void;

    constructor(options?: JarvisOptions) {
        this.options = { ...DEFAULT_OPTIONS, ...options };
    }

    /**
     * Set a callback for streaming progress updates
     */
    onProgress(callback: (progress: JarvisProgress) => void): void {
        this.progressCallback = callback;
    }

    /**
     * Emit a progress update
     */
    private emitProgress(phase: JarvisProgress['phase'], message: string, workersActive: number, candidatesFound: number, elapsedMs: number): void {
        if (this.options.streaming && this.progressCallback) {
            this.progressCallback({
                phase,
                message,
                workersActive,
                candidatesFound,
                elapsedMs
            });
        }
    }

    /**
     * Main discovery entry point
     */
    async discover(domain: string): Promise<JarvisResult> {
        const startTime = Date.now();
        const cleanDomain = domain.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, '');
        const baseUrl = `https://${cleanDomain}`;

        logger.info(`[Discovery] Starting parallel search for: ${cleanDomain}`);
        logger.info(`[Discovery] Workers: ${this.options.maxWorkers}, Timeout: ${this.options.timeout}ms`);

        this.emitProgress('initializing', `Initializing ${this.options.maxWorkers} workers...`, 0, 0, 0);

        try {
            // ============ PHASE 0: CHECK SPECIAL DOMAINS ============
            const specialPolicies = this.checkSpecialDomains(cleanDomain);
            if (specialPolicies.length > 0) {
                logger.info(`[Discovery] Found ${specialPolicies.length} special domain policies`);

                return {
                    success: true,
                    domain: cleanDomain,
                    policies: specialPolicies,
                    discoveryTimeMs: Date.now() - startTime,
                    workersUsed: 0,
                    candidatesFound: specialPolicies.length
                };
            }

            // ============ PHASE 1: INITIALIZE WORKERS ============
            await this.initializeWorkers();
            this.emitProgress('discovering', `Deploying ${this.workers.length} workers...`, this.workers.length, 0, Date.now() - startTime);

            // ============ PHASE 2: CREATE TASKS ============
            const tasks = this.createTasks(cleanDomain, baseUrl);

            // ============ PHASE 3: PARALLEL EXECUTION ============
            logger.info(`[Jarvis] 🚀 Launching ${tasks.length} parallel tasks`);

            // Execute all workers in parallel with timeout
            const workerPromises = tasks.map((task, idx) =>
                this.workers[idx % this.workers.length].execute(task)
            );

            const allResults = await Promise.race([
                Promise.all(workerPromises),
                this.createTimeout(this.options.timeout)
            ]);

            // Flatten results
            const allCandidates: JarvisCandidate[] = (allResults as JarvisCandidate[][]).flat();

            logger.info(`[Jarvis] 📦 Collected ${allCandidates.length} total candidates`);
            this.emitProgress('scoring', `Scoring ${allCandidates.length} candidates...`, 0, allCandidates.length, Date.now() - startTime);

            // ============ PHASE 4: DEDUPLICATE AND SCORE ============
            const policies = this.deduplicateAndScore(allCandidates);

            // ============ PHASE 5: FINALIZE ============
            const duration = Date.now() - startTime;
            logger.info(`[Jarvis] ✅ Discovery complete! Found ${policies.length} policies in ${duration}ms`);
            this.emitProgress('complete', `Found ${policies.length} policies`, 0, policies.length, duration);

            return {
                success: true,
                domain: cleanDomain,
                policies,
                discoveryTimeMs: duration,
                workersUsed: this.workers.length,
                candidatesFound: allCandidates.length
            };

        } catch (error: any) {
            // On timeout or error, try the old TURBO discovery as fallback
            logger.warn(`[Jarvis] ⚠️ Parallel discovery failed, falling back to TURBO engine`);

            try {
                const { discoverPolicies } = await import('../discovery/index');
                const turboResult = await discoverPolicies(cleanDomain);

                if (turboResult.success && turboResult.policies.length > 0) {
                    const duration = Date.now() - startTime;
                    logger.info(`[Jarvis] ✅ TURBO fallback succeeded! Found ${turboResult.policies.length} policies`);

                    // Convert TURBO policies to Jarvis format
                    const policies: JarvisPolicy[] = turboResult.policies.map(p => ({
                        type: p.type,
                        name: p.name,
                        url: p.url,
                        confidence: p.confidence,
                        source: p.source as any,
                        neuralScore: p.neuralScore
                    }));

                    return {
                        success: true,
                        domain: cleanDomain,
                        policies,
                        discoveryTimeMs: duration,
                        workersUsed: 0,
                        candidatesFound: policies.length
                    };
                }
            } catch (fallbackError: any) {
                logger.error(`[Jarvis] TURBO fallback also failed`, fallbackError);
            }

            const duration = Date.now() - startTime;
            logger.error(`[Jarvis] ❌ Discovery failed`, error);
            this.emitProgress('error', error.message, 0, 0, duration);

            return {
                success: false,
                domain: cleanDomain,
                policies: [],
                discoveryTimeMs: duration,
                workersUsed: this.workers.length,
                candidatesFound: 0,
                error: error.message
            };
        }
    }

    /**
     * Check special domains configuration (instant - no HTTP)
     */
    private checkSpecialDomains(domain: string): JarvisPolicy[] {
        const policies: JarvisPolicy[] = [];

        const specialConfig = CONFIG.SPECIAL_DOMAINS[domain] ||
            CONFIG.SPECIAL_DOMAINS[`www.${domain}`] ||
            CONFIG.SPECIAL_DOMAINS[domain.replace(/^www\./, '')];

        if (!specialConfig) return policies;

        for (const [type, url] of Object.entries(specialConfig)) {
            if (url && typeof url === 'string') {
                policies.push({
                    type: type as PolicyType,
                    name: CONFIG.POLICY_TYPES[type as PolicyType]?.name || type,
                    url,
                    confidence: 'high',
                    source: 'special_domain'
                });
            }
        }

        return policies;
    }

    /**
     * Initialize worker pool
     */
    private async initializeWorkers(): Promise<void> {
        this.workers = [];

        const numWorkers = Math.min(this.options.maxWorkers, WORKER_STRATEGY_ASSIGNMENTS.length);

        for (let i = 0; i < numWorkers; i++) {
            const assignment = WORKER_STRATEGY_ASSIGNMENTS[i];
            const config: JarvisWorkerConfig = {
                id: i + 1,
                strategy: assignment.strategy,
                timeout: 3000,
                priority: assignment.priority
            };

            const worker = new JarvisWorker(config);
            await worker.init();
            this.workers.push(worker);
        }

        logger.info(`[Jarvis] Initialized ${this.workers.length} workers`);
    }

    /**
     * Create tasks for workers
     */
    private createTasks(domain: string, baseUrl: string): JarvisTask[] {
        const tasks: JarvisTask[] = [];

        // Split policy types across direct probe workers
        const directProbeTypes: PolicyType[][] = [
            ['privacy', 'terms'],
            ['cookies', 'security'],
            ['gdpr', 'ccpa'],
            ['ai', 'acceptable_use']
        ];

        let directProbeIdx = 0;

        for (let i = 0; i < this.workers.length; i++) {
            const assignment = WORKER_STRATEGY_ASSIGNMENTS[i];

            // Determine which policy types this worker should target
            let targetTypes = this.options.targetPolicies;

            if (assignment.strategy === 'direct_probe') {
                targetTypes = directProbeTypes[directProbeIdx % directProbeTypes.length];
                directProbeIdx++;
            }

            tasks.push({
                id: `task_${i + 1}`,
                strategy: assignment.strategy,
                domain,
                baseUrl,
                priority: assignment.priority,
                targetTypes
            });
        }

        return tasks;
    }

    /**
     * Create a timeout promise
     */
    private createTimeout(ms: number): Promise<JarvisCandidate[][]> {
        return new Promise((_, reject) => {
            setTimeout(() => {
                logger.warn(`[Jarvis] ⏱️ Timeout after ${ms}ms`);
                reject(new Error(`Discovery timeout after ${ms}ms`));
            }, ms);
        });
    }

    /**
     * Deduplicate and score candidates
     */
    private deduplicateAndScore(candidates: JarvisCandidate[]): JarvisPolicy[] {
        // Group by policy type
        const byType = new Map<PolicyType, JarvisCandidate[]>();

        for (const candidate of candidates) {
            if (!byType.has(candidate.type)) {
                byType.set(candidate.type, []);
            }
            byType.get(candidate.type)!.push(candidate);
        }

        // For each type, pick the best candidate
        const policies: JarvisPolicy[] = [];

        for (const [type, typeCandidates] of byType) {
            // Sort by confidence descending
            typeCandidates.sort((a, b) => b.confidence - a.confidence);

            // Take the best one
            const best = typeCandidates[0];

            // Convert confidence score to level
            let confidenceLevel: 'high' | 'medium' | 'low';
            if (best.confidence >= 80) {
                confidenceLevel = 'high';
            } else if (best.confidence >= 50) {
                confidenceLevel = 'medium';
            } else {
                confidenceLevel = 'low';
            }

            policies.push({
                type,
                name: CONFIG.POLICY_TYPES[type]?.name || type,
                url: best.url,
                confidence: confidenceLevel,
                source: best.source,
                neuralScore: best.neuralScore
            });
        }

        // Sort by priority (privacy, terms, cookies, etc.)
        const priority: PolicyType[] = ['privacy', 'terms', 'cookies', 'security', 'gdpr', 'ccpa', 'ai', 'acceptable_use'];
        policies.sort((a, b) => priority.indexOf(a.type) - priority.indexOf(b.type));

        return policies;
    }
}

/**
 * Convenience function for quick discovery
 */
export async function discoverWithJarvis(domain: string, options?: JarvisOptions): Promise<JarvisResult> {
    const jarvis = new Jarvis(options);
    return jarvis.discover(domain);
}
