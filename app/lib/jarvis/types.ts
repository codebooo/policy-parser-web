/**
 * JARVIS - Parallel Policy Discovery System
 * Type definitions and interfaces
 */

import { PolicyType } from '../config';

/**
 * Result from a single worker's discovery attempt
 */
export interface JarvisCandidate {
    url: string;
    type: PolicyType;
    confidence: number; // 0-100
    source: JarvisSource;
    neuralScore?: number; // Carl's score 0-1
    linkText?: string;
    context?: 'footer' | 'nav' | 'body' | 'legal_hub' | 'unknown'; // Match Carl's context types
    workerId: number;
    discoveryTimeMs: number;
}

/**
 * Discovery source types
 */
export type JarvisSource =
    | 'special_domain'    // Pre-configured URL from CONFIG
    | 'footer_link'       // Found in page footer
    | 'nav_link'          // Found in navigation
    | 'legal_hub'         // Found on /legal or /policies page
    | 'sitemap'           // Found in sitemap.xml
    | 'direct_probe'      // Direct URL path check
    | 'search_engine'     // Search engine result
    | 'deep_scan';        // Found via deep link scanning

/**
 * Worker strategy types
 */
export type JarvisStrategy =
    | 'homepage_crawl'    // Crawl homepage for links
    | 'sitemap_parse'     // Parse sitemap.xml
    | 'legal_hub_crawl'   // Crawl /legal, /policies pages
    | 'direct_probe'      // Check common paths directly
    | 'search_engine'     // Query search engines
    | 'deep_scan';        // Deep link scanning from initial results

/**
 * Worker configuration
 */
export interface JarvisWorkerConfig {
    id: number;
    strategy: JarvisStrategy;
    timeout: number;
    priority: number; // Lower = higher priority
}

/**
 * Overall Jarvis discovery options
 */
export interface JarvisOptions {
    maxWorkers?: number;       // Default: 10
    timeout?: number;          // Total timeout in ms, default: 15000
    streaming?: boolean;       // Stream progress updates
    useCarl?: boolean;         // Use Carl neural network, default: true
    targetPolicies?: PolicyType[]; // Which policy types to find
}

/**
 * Discovery result
 */
export interface JarvisResult {
    success: boolean;
    domain: string;
    policies: JarvisPolicy[];
    discoveryTimeMs: number;
    workersUsed: number;
    candidatesFound: number;
    error?: string;
}

/**
 * Final policy output (deduplicated and scored)
 */
export interface JarvisPolicy {
    type: PolicyType;
    name: string;
    url: string;
    confidence: 'high' | 'medium' | 'low';
    source: JarvisSource;
    neuralScore?: number;
}

/**
 * Progress update for streaming
 */
export interface JarvisProgress {
    phase: 'initializing' | 'discovering' | 'scoring' | 'complete' | 'error';
    message: string;
    workersActive: number;
    candidatesFound: number;
    elapsedMs: number;
}

/**
 * Worker task
 */
export interface JarvisTask {
    id: string;
    strategy: JarvisStrategy;
    domain: string;
    baseUrl: string;
    priority: number;
    targetTypes: PolicyType[];
}

/**
 * Worker pool stats
 */
export interface JarvisPoolStats {
    totalWorkers: number;
    activeWorkers: number;
    completedTasks: number;
    failedTasks: number;
    candidatesFound: number;
}
