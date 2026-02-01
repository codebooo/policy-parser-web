/**
 * SHARED RATE LIMITER
 * ====================
 * Centralized rate limiting for all HTTP requests across the discovery system.
 * Prevents 429 (Too Many Requests) errors by enforcing minimum intervals
 * between requests to the same domain.
 */

import { logger } from '../logger';

// Per-domain request tracking
const domainLastRequestTime: Map<string, number> = new Map();
const domainRequestCount: Map<string, number> = new Map();
const domainRateLimited: Map<string, number> = new Map(); // Track domains that returned 429

// Configuration - Conservative to avoid rate limiting
const MIN_REQUEST_INTERVAL_MS = 2000;  // 2 seconds between requests to same domain
const BURST_PROTECTION_WINDOW_MS = 15000;  // 15 second window  
const MAX_REQUESTS_PER_WINDOW = 5;  // Max 5 requests per 15 seconds = 0.33 req/sec
const RATE_LIMITED_COOLDOWN_MS = 30000;  // 30 seconds cooldown after 429

/**
 * Parse Retry-After header value
 */
export function parseRetryAfter(retryAfter: string | undefined): number {
    if (!retryAfter) return 5000; // Default 5 seconds
    
    const seconds = parseInt(retryAfter, 10);
    if (!isNaN(seconds)) {
        return Math.min(seconds * 1000, 60000); // Cap at 60 seconds
    }
    
    // Try parsing as HTTP date
    const date = new Date(retryAfter);
    if (!isNaN(date.getTime())) {
        const waitMs = date.getTime() - Date.now();
        return Math.min(Math.max(waitMs, 1000), 60000);
    }
    
    return 5000;
}

/**
 * Sleep with optional jitter to avoid thundering herd
 */
export function sleep(ms: number, addJitter = true): Promise<void> {
    const jitter = addJitter ? Math.random() * 500 : 0;
    return new Promise(resolve => setTimeout(resolve, ms + jitter));
}

/**
 * Extract domain from URL for rate limiting purposes
 */
export function extractDomain(url: string): string {
    try {
        const urlObj = new URL(url);
        // Normalize: remove www. prefix and use lowercase
        return urlObj.hostname.toLowerCase().replace(/^www\./, '');
    } catch {
        return url.toLowerCase();
    }
}

/**
 * Get current request count for a domain within the burst window
 */
function getRequestCount(domain: string): number {
    const now = Date.now();
    const lastTime = domainLastRequestTime.get(domain) || 0;
    
    // Reset count if outside the burst window
    if (now - lastTime > BURST_PROTECTION_WINDOW_MS) {
        domainRequestCount.set(domain, 0);
    }
    
    return domainRequestCount.get(domain) || 0;
}

/**
 * Increment request count for a domain
 */
function incrementRequestCount(domain: string): void {
    const currentCount = domainRequestCount.get(domain) || 0;
    domainRequestCount.set(domain, currentCount + 1);
}

/**
 * Enforce rate limiting before making a request
 * Returns immediately if no wait needed, otherwise waits the appropriate time
 */
export async function enforceRateLimit(url: string): Promise<void> {
    const domain = extractDomain(url);
    const now = Date.now();
    
    // Check if domain was recently rate-limited (429)
    const rateLimitedUntil = domainRateLimited.get(domain);
    if (rateLimitedUntil && now < rateLimitedUntil) {
        const waitTime = rateLimitedUntil - now;
        logger.info(`[rateLimiter] Domain ${domain} was rate-limited, waiting ${waitTime}ms cooldown`);
        await sleep(waitTime, true);
        domainRateLimited.delete(domain);
    }
    
    const lastRequest = domainLastRequestTime.get(domain);
    
    // Check burst protection
    const requestCount = getRequestCount(domain);
    if (requestCount >= MAX_REQUESTS_PER_WINDOW) {
        const timeSinceFirst = now - (domainLastRequestTime.get(domain) || now);
        const waitTime = Math.max(0, BURST_PROTECTION_WINDOW_MS - timeSinceFirst);
        
        if (waitTime > 0) {
            logger.info(`[rateLimiter] Burst protection: waiting ${waitTime}ms for ${domain} (${requestCount} requests in window)`);
            await sleep(waitTime, true);
            // Reset after waiting
            domainRequestCount.set(domain, 0);
        }
    }
    
    // Check minimum interval
    if (lastRequest) {
        const elapsed = now - lastRequest;
        if (elapsed < MIN_REQUEST_INTERVAL_MS) {
            const waitTime = MIN_REQUEST_INTERVAL_MS - elapsed;
            logger.debug(`[rateLimiter] Rate limiting: waiting ${waitTime}ms before request to ${domain}`);
            await sleep(waitTime, false);
        }
    }
    
    // Update tracking
    domainLastRequestTime.set(domain, Date.now());
    incrementRequestCount(domain);
}

/**
 * Mark that a request was rate-limited (429 response received)
 * This triggers a longer backoff for subsequent requests
 */
export async function handleRateLimitResponse(url: string, retryAfterHeader?: string): Promise<number> {
    const domain = extractDomain(url);
    const waitTime = Math.max(parseRetryAfter(retryAfterHeader), RATE_LIMITED_COOLDOWN_MS);
    
    logger.warn(`[rateLimiter] 429 received for ${domain}, enforcing ${waitTime}ms backoff`);
    
    // Mark domain as rate-limited with cooldown period
    domainRateLimited.set(domain, Date.now() + waitTime);
    
    // Reset the request count and set a future timestamp
    domainRequestCount.set(domain, 0);
    domainLastRequestTime.set(domain, Date.now() + waitTime);
    
    return waitTime;
}

/**
 * Clear rate limit tracking for a domain (for testing)
 */
export function clearRateLimitTracking(domain?: string): void {
    if (domain) {
        const normalizedDomain = extractDomain(domain);
        domainLastRequestTime.delete(normalizedDomain);
        domainRequestCount.delete(normalizedDomain);
        domainRateLimited.delete(normalizedDomain);
    } else {
        domainLastRequestTime.clear();
        domainRequestCount.clear();
        domainRateLimited.clear();
    }
}
