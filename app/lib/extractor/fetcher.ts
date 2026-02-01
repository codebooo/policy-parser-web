import got, { RequestError } from 'got';
import { CONFIG } from '../config';
import { logger } from '../logger';
import { handleRateLimitResponse } from '../discovery/rateLimiter';

/**
 * ENHANCED FETCHER
 * ================
 * Optimized policy page fetching with:
 * - Smart retries with timeout handling
 * - Locale-aware fetching for German/EU domains
 * - Bot and cookie handling for complex sites
 * - Rate limiting (429) handling with exponential backoff
 */

// ============ RATE LIMITING PROTECTION ============
// Track last request time per domain to avoid hitting rate limits
const domainLastRequestTime: Map<string, number> = new Map();
const MIN_REQUEST_INTERVAL_MS = 1000; // Minimum 1 second between requests to same domain

/**
 * Parse Retry-After header (can be seconds or HTTP date)
 */
function parseRetryAfter(retryAfter: string | undefined): number {
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
 * Sleep function with optional jitter to avoid thundering herd
 */
function sleep(ms: number, addJitter = true): Promise<void> {
    const jitter = addJitter ? Math.random() * 500 : 0;
    return new Promise(resolve => setTimeout(resolve, ms + jitter));
}

/**
 * Enforce rate limit - ensures minimum time between requests to same domain
 */
async function enforceRateLimit(domain: string): Promise<void> {
    const lastRequest = domainLastRequestTime.get(domain);
    if (lastRequest) {
        const elapsed = Date.now() - lastRequest;
        if (elapsed < MIN_REQUEST_INTERVAL_MS) {
            const waitTime = MIN_REQUEST_INTERVAL_MS - elapsed;
            logger.info(`[fetcher] Rate limiting: waiting ${waitTime}ms before request to ${domain}`);
            await sleep(waitTime, false);
        }
    }
    domainLastRequestTime.set(domain, Date.now());
}

/**
 * URLs or patterns that indicate authentication walls or non-policy pages
 */
const BLOCKED_URL_PATTERNS = [
    '/login',
    '/signin',
    '/sign-in',
    '/authenticate',
    '/auth/',
    'accounts.google.com',
    '/oauth',
    '/sso/',
    'login.php',
    '?next=',
    'returnUrl=',
    'redirect_uri=',
    '/challenge/',
    '/checkpoint/'
];

/**
 * LEGAL NOTICE: Googlebot impersonation removed (December 2024)
 * 
 * Impersonating search engine bots may violate the Computer Fraud and Abuse Act (CFAA)
 * by constituting "unauthorized access" or access that "exceeds authorization."
 * 
 * Sites that block regular browser requests will:
 * 1. Fail gracefully with a clear error message
 * 2. Fall back to Wayback Machine/Google Cache if available
 * 
 * Users can still manually paste policy text from these sites.
 */
const BOT_REQUIRED_DOMAINS: string[] = []; // Disabled for legal compliance

/**
 * Domains with aggressive anti-bot protection that may need special handling
 */
const AGGRESSIVE_ANTIBOT_DOMAINS = [
    'bhphotovideo.com',
    'bestbuy.com',
    'walmart.com',
    'target.com',
    'homedepot.com',
];

/**
 * Fetch from Wayback Machine as last resort fallback
 * Returns null if not available or fails
 */
async function fetchFromWaybackMachine(url: string): Promise<{ body: string; finalUrl: string } | null> {
    try {
        logger.info(`[fetcher] Trying Wayback Machine for ${url}`);

        // First, check if Wayback has this URL
        const availabilityUrl = `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`;
        const availResponse = await got(availabilityUrl, {
            timeout: { request: 10000 },
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; PolicyParser/1.0)',
                'Accept': 'application/json',
            },
        });

        const availability = JSON.parse(availResponse.body);

        if (!availability?.archived_snapshots?.closest?.available) {
            logger.info(`[fetcher] No Wayback snapshot available for ${url}`);
            return null;
        }

        const snapshotUrl = availability.archived_snapshots.closest.url;
        const snapshotTimestamp = availability.archived_snapshots.closest.timestamp;

        logger.info(`[fetcher] Found Wayback snapshot from ${snapshotTimestamp}: ${snapshotUrl}`);

        // Fetch the actual snapshot
        const snapshotResponse = await got(snapshotUrl, {
            timeout: { request: 15000 },
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml',
            },
            followRedirect: true,
        });

        if (snapshotResponse.statusCode === 200) {
            // Remove Wayback Machine toolbar injection from the HTML
            let body = snapshotResponse.body;

            // Remove Wayback toolbar scripts and styles
            body = body.replace(/<!-- BEGIN WAYBACK TOOLBAR INSERT -->[\s\S]*?<!-- END WAYBACK TOOLBAR INSERT -->/gi, '');
            body = body.replace(/<script[^>]*archive\.org[^>]*>[\s\S]*?<\/script>/gi, '');
            body = body.replace(/<link[^>]*archive\.org[^>]*>/gi, '');

            logger.info(`[fetcher] Successfully fetched from Wayback Machine (${body.length} chars)`);
            return {
                body,
                finalUrl: url, // Use original URL, not Wayback URL
            };
        }

        return null;
    } catch (error: any) {
        logger.warn(`[fetcher] Wayback Machine fallback failed: ${error.message}`);
        return null;
    }
}

/**
 * Fetch from Google Cache as fallback
 * Returns null if not available or fails
 */
async function fetchFromGoogleCache(url: string): Promise<{ body: string; finalUrl: string } | null> {
    try {
        logger.info(`[fetcher] Trying Google Cache for ${url}`);

        const cacheUrl = `https://webcache.googleusercontent.com/search?q=cache:${encodeURIComponent(url)}`;

        const response = await got(cacheUrl, {
            timeout: { request: 15000 },
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'en-US,en;q=0.9',
            },
            followRedirect: true,
            throwHttpErrors: false,
        });

        if (response.statusCode === 200 && response.body.length > 500) {
            // Remove Google Cache header/banner
            let body = response.body;
            body = body.replace(/<div[^>]*id="bN015htcoyT__google-cache-hdr"[^>]*>[\s\S]*?<\/div>/gi, '');
            body = body.replace(/<style[^>]*>[\s\S]*?google-cache[\s\S]*?<\/style>/gi, '');

            logger.info(`[fetcher] Successfully fetched from Google Cache (${body.length} chars)`);
            return {
                body,
                finalUrl: url,
            };
        }

        logger.info(`[fetcher] Google Cache not available for ${url}`);
        return null;
    } catch (error: any) {
        logger.warn(`[fetcher] Google Cache fallback failed: ${error.message}`);
        return null;
    }
}

/**
 * Alternative URL patterns to try when primary URL fails or has insufficient content
 */
const ALTERNATIVE_URL_PATTERNS = [
    // Global/English versions
    (url: string) => url.replace(/\/de\//, '/en/'),
    (url: string) => url.replace(/\/de\//, '/global/'),
    (url: string) => url.replace(/\/de\//, '/us/'),
    (url: string) => url.replace(/\/fr\//, '/en/'),
    (url: string) => url.replace(/\/es\//, '/en/'),
    // Common alternative paths
    (url: string) => url.replace(/\/privacy\/?$/, '/legal/privacy'),
    (url: string) => url.replace(/\/privacy\/?$/, '/about/privacy'),
    (url: string) => url.replace(/\/privacy\/?$/, '/privacy-policy'),
    (url: string) => url + '/index.html',
    (url: string) => url.replace(/\/$/, '') + '.html',
];

/**
 * Try alternative URL patterns when primary fails
 */
async function tryAlternativeUrls(originalUrl: string, userAgent: string): Promise<{ body: string; finalUrl: string; contentType: string; buffer: Buffer } | null> {
    logger.info(`[fetcher] Trying alternative URL patterns for ${originalUrl}`);

    for (const transform of ALTERNATIVE_URL_PATTERNS) {
        const altUrl = transform(originalUrl);

        // Skip if same as original or invalid transformation
        if (altUrl === originalUrl || !altUrl.startsWith('http')) {
            continue;
        }

        try {
            logger.debug(`[fetcher] Trying alternative: ${altUrl}`);
            const result = await fetchHtmlCore(altUrl, userAgent);

            // Check if we got meaningful content
            if (result.body.length > 1000) {
                logger.info(`[fetcher] Alternative URL succeeded: ${altUrl}`);
                return result;
            }
        } catch (error: any) {
            // Silently continue to next alternative
        }
    }

    return null;
}

/**
 * Cascade through all fallback sources
 */
async function cascadeFallbacks(url: string): Promise<{ body: string; finalUrl: string } | null> {
    logger.info(`[fetcher] Starting fallback cascade for ${url}`);

    // 1. Try Google Cache first (usually has JS-rendered content)
    const googleResult = await fetchFromGoogleCache(url);
    if (googleResult && googleResult.body.length > 500) {
        return googleResult;
    }

    // 2. Try Wayback Machine
    const waybackResult = await fetchFromWaybackMachine(url);
    if (waybackResult && waybackResult.body.length > 500) {
        return waybackResult;
    }

    logger.info(`[fetcher] All fallback sources exhausted for ${url}`);
    return null;
}

/**
 * Alternative user agents to try when initial request fails
 * 
 * LEGAL NOTE: Only legitimate browser user agents are used.
 * Googlebot impersonation has been removed to avoid potential CFAA violations.
 */
const FALLBACK_USER_AGENTS = [
    // Chrome on Windows (most common)
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    // Chrome on Mac
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    // Firefox on Windows
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    // Safari on Mac
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
    // Edge on Windows
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
    // Note: Googlebot UA removed for legal compliance - use Wayback Machine fallback instead
];

/**
 * Locale codes that indicate non-English content
 * Used to detect geo-redirects to local language versions
 */
const NON_ENGLISH_LOCALE_PATTERNS = [
    /\/de\//i, /\/de-de\//i,    // German
    /\/fr\//i, /\/fr-fr\//i,    // French
    /\/es\//i, /\/es-es\//i,    // Spanish
    /\/it\//i, /\/it-it\//i,    // Italian
    /\/pt\//i, /\/pt-br\//i,    // Portuguese
    /\/nl\//i,                   // Dutch
    /\/pl\//i,                   // Polish
    /\/ru\//i,                   // Russian
    /\/ja\//i,                   // Japanese
    /\/ko\//i,                   // Korean
    /\/zh\//i,                   // Chinese
    /\/ar\//i,                   // Arabic
    /\/tr\//i,                   // Turkish
    /\/sv\//i,                   // Swedish
    /\/no\//i,                   // Norwegian
    /\/da\//i,                   // Danish
    /\/fi\//i,                   // Finnish
];

/**
 * English locale patterns to try if non-English detected
 */
const ENGLISH_LOCALE_REPLACEMENTS: [RegExp, string][] = [
    [/\/(de|fr|es|it|pt|nl|pl|ru|ja|ko|zh|ar|tr|sv|no|da|fi)(-[a-z]{2})?\//i, '/us/'],
    [/\/(de|fr|es|it|pt|nl|pl|ru|ja|ko|zh|ar|tr|sv|no|da|fi)(-[a-z]{2})?\//i, '/en/'],
    [/\/(de|fr|es|it|pt|nl|pl|ru|ja|ko|zh|ar|tr|sv|no|da|fi)(-[a-z]{2})?\//i, '/en-us/'],
];

// REMOVED: Googlebot impersonation disabled for legal compliance
// const GOOGLEBOT_UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const GOOGLEBOT_UA = ''; // Disabled - sites will use browser UA or fail to Wayback fallback

/**
 * Validates that a URL is not an authentication/login page
 */
export function isValidPolicyUrl(url: string): boolean {
    const lowerUrl = url.toLowerCase();
    return !BLOCKED_URL_PATTERNS.some(pattern => lowerUrl.includes(pattern));
}

/**
 * Check if a URL requires bot user-agent
 */
function requiresBotUA(url: string): boolean {
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.toLowerCase().replace(/^www\./, '');
        return BOT_REQUIRED_DOMAINS.some(domain =>
            hostname === domain || hostname.endsWith(`.${domain}`)
        );
    } catch {
        return false;
    }
}

/**
 * Check if a domain has aggressive anti-bot protection
 */
function hasAggressiveAntibot(url: string): boolean {
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.toLowerCase().replace(/^www\./, '');
        return AGGRESSIVE_ANTIBOT_DOMAINS.some(domain =>
            hostname === domain || hostname.endsWith(`.${domain}`)
        );
    } catch {
        return false;
    }
}

/**
 * Check if a URL has been redirected to a non-English locale
 */
function hasNonEnglishLocale(url: string): boolean {
    return NON_ENGLISH_LOCALE_PATTERNS.some(pattern => pattern.test(url));
}

/**
 * Try to convert a localized URL to English version
 */
function getEnglishUrlVariants(url: string): string[] {
    const variants: string[] = [];
    for (const [pattern, replacement] of ENGLISH_LOCALE_REPLACEMENTS) {
        if (pattern.test(url)) {
            variants.push(url.replace(pattern, replacement));
        }
    }
    return variants;
}

/**
 * Core fetch function with 429 handling and exponential backoff
 */
async function fetchHtmlCore(url: string, userAgent: string): Promise<{ body: string; finalUrl: string; contentType: string; buffer: Buffer }> {
    // Extract domain for rate limiting
    let domain: string;
    try {
        domain = new URL(url).hostname;
    } catch {
        domain = url;
    }

    // Enforce rate limiting before making request
    await enforceRateLimit(domain);

    const maxRetries = CONFIG.MAX_RETRIES || 3;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const response = await got(url, {
                timeout: { request: CONFIG.TIMEOUT_MS },
                headers: {
                    'User-Agent': userAgent,
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache',
                    'Sec-Fetch-Dest': 'document',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-Site': 'none',
                    'Sec-Fetch-User': '?1',
                    'Upgrade-Insecure-Requests': '1',
                },
                retry: { limit: 0 }, // Handle retries ourselves for better 429 control
                followRedirect: true,
                throwHttpErrors: false, // Handle status codes ourselves
                hooks: {
                    afterResponse: [
                        (response) => {
                            // Check if we got redirected to a login page
                            const finalUrl = response.url;
                            if (!isValidPolicyUrl(finalUrl)) {
                                throw new Error(`Redirected to authentication page: ${finalUrl}`);
                            }
                            return response;
                        }
                    ]
                }
            });

            // Handle rate limiting (429)
            if (response.statusCode === 429) {
                // Notify central rate limiter about this domain
                handleRateLimitResponse(url, response.headers['retry-after'] as string);

                const retryAfter = parseRetryAfter(response.headers['retry-after'] as string);
                const backoffTime = Math.min(retryAfter * Math.pow(2, attempt), 60000);

                logger.warn(`[fetcher] Rate limited (429) on ${url}, attempt ${attempt + 1}/${maxRetries + 1}, waiting ${backoffTime}ms`);

                if (attempt < maxRetries) {
                    await sleep(backoffTime, true);
                    // Update the domain's last request time after waiting
                    domainLastRequestTime.set(domain, Date.now());
                    continue; // Retry
                } else {
                    throw new Error(`Rate limited (429) after ${maxRetries + 1} attempts. Please try again later.`);
                }
            }

            // Handle server errors (5xx) with retry
            if (response.statusCode >= 500) {
                const backoffTime = 2000 * Math.pow(2, attempt);
                logger.warn(`[fetcher] Server error (${response.statusCode}) on ${url}, attempt ${attempt + 1}/${maxRetries + 1}`);

                if (attempt < maxRetries) {
                    await sleep(backoffTime, true);
                    continue;
                } else {
                    throw new Error(`Server error (${response.statusCode}) after ${maxRetries + 1} attempts`);
                }
            }

            // Handle other error status codes
            if (response.statusCode >= 400) {
                // For 403 Forbidden, throw a special error that can be caught for UA retry
                if (response.statusCode === 403) {
                    throw new Error(`HTTP_403_FORBIDDEN`);
                }
                throw new Error(`HTTP error ${response.statusCode}: ${response.statusMessage}`);
            }

            // Success!
            return {
                body: response.body,
                finalUrl: response.url,
                contentType: response.headers['content-type'] || 'text/html',
                buffer: response.rawBody
            };

        } catch (error: any) {
            lastError = error;

            // Handle request errors (timeouts, network issues)
            if (error instanceof RequestError) {
                const backoffTime = 2000 * Math.pow(2, attempt);
                logger.warn(`[fetcher] Request error on ${url}: ${error.message}, attempt ${attempt + 1}/${maxRetries + 1}`);

                if (attempt < maxRetries) {
                    await sleep(backoffTime, true);
                    continue;
                }
            }

            // Non-retryable error or max retries exceeded
            throw error;
        }
    }

    // Should not reach here, but just in case
    throw lastError || new Error(`Failed to fetch ${url} after ${maxRetries + 1} attempts`);
}

export interface FetchResult {
    body: string;
    buffer: Buffer;
    contentType: string;
    url: string;
}

export async function fetchResource(url: string): Promise<FetchResult> {
    // First check if URL looks like a login page
    if (!isValidPolicyUrl(url)) {
        logger.error(`URL appears to be a login/auth page: ${url}`);
        throw new Error(`Cannot fetch content from authentication page. Please ensure the policy URL is publicly accessible.`);
    }

    // Determine if we need to use Googlebot UA
    const useBotUA = requiresBotUA(url);
    const isAggressiveAntibot = hasAggressiveAntibot(url);

    // Build list of user agents to try
    let userAgentsToTry: string[] = [];

    if (useBotUA) {
        logger.info(`Using Googlebot UA for ${url}`);
        userAgentsToTry = [GOOGLEBOT_UA];
    } else if (isAggressiveAntibot) {
        logger.info(`Site has aggressive anti-bot, will try multiple UAs for ${url}`);
        userAgentsToTry = FALLBACK_USER_AGENTS;
    } else {
        userAgentsToTry = [CONFIG.USER_AGENT, ...FALLBACK_USER_AGENTS.slice(0, 3)];
    }

    let lastError: Error | null = null;

    for (let uaIndex = 0; uaIndex < userAgentsToTry.length; uaIndex++) {
        const userAgent = userAgentsToTry[uaIndex];

        try {
            let { body, finalUrl, contentType, buffer } = await fetchHtmlCore(url, userAgent);

            // Check if we were redirected to a non-English locale (only for HTML)
            if (contentType.includes('text/html') && hasNonEnglishLocale(finalUrl)) {
                logger.info(`[fetchResource] Detected non-English locale redirect: ${finalUrl}`);

                // Try to get English version
                const englishVariants = getEnglishUrlVariants(finalUrl);

                for (const englishUrl of englishVariants) {
                    try {
                        logger.info(`[fetchResource] Trying English URL: ${englishUrl}`);
                        const englishResult = await fetchHtmlCore(englishUrl, userAgent);

                        // Check if we got a valid response (not redirected back to non-English)
                        if (!hasNonEnglishLocale(englishResult.finalUrl)) {
                            logger.info(`[fetchResource] Successfully fetched English version from: ${englishResult.finalUrl}`);
                            body = englishResult.body;
                            finalUrl = englishResult.finalUrl;
                            contentType = englishResult.contentType;
                            buffer = englishResult.buffer;
                            break;
                        }
                    } catch (englishError: any) {
                        logger.debug(`[fetchResource] English variant ${englishUrl} failed: ${englishError?.message}`);
                        // Continue to next variant
                    }
                }

                // If still non-English after trying all variants, log warning but continue
                if (hasNonEnglishLocale(finalUrl)) {
                    logger.warn(`[fetchResource] Could not find English version, using localized content from: ${finalUrl}`);
                }
            }

            // Double-check the response body for signs it's a login page (only for HTML)
            if (contentType.includes('text/html')) {
                const lowerBody = body.toLowerCase().slice(0, 5000); // Check first 5KB

                const loginIndicators = [
                    '<input type="password"',
                    'sign in to continue',
                    'log in to continue',
                    'please log in',
                    'login required',
                    'authentication required',
                    'enter your password'
                ];

                if (loginIndicators.some(indicator => lowerBody.includes(indicator))) {
                    logger.error(`Page content appears to be a login form: ${url}`);
                    throw new Error(`Cannot access policy - page requires authentication`);
                }
            }

            logger.info(`[fetchResource] Successfully fetched ${url} with UA #${uaIndex + 1}`);
            return {
                body,
                buffer,
                contentType,
                url: finalUrl
            };
        } catch (error: any) {
            lastError = error;

            // If we got a 403, try the next user agent
            if (error.message === 'HTTP_403_FORBIDDEN') {
                logger.warn(`[fetchResource] Got 403 with UA #${uaIndex + 1}, trying next...`);
                // Small delay before trying next UA
                await sleep(500 + Math.random() * 500, false);
                continue;
            }

            // For other errors, if we still have UAs to try and it's a network error
            if (uaIndex < userAgentsToTry.length - 1 &&
                (error instanceof RequestError || error.message.includes('HTTP'))) {
                logger.warn(`[fetchResource] Error with UA #${uaIndex + 1}: ${error.message}, trying next...`);
                await sleep(500, false);
                continue;
            }

            // Non-retryable error or last UA failed
            break;
        }
    }

    // All UAs failed - try fallback cascade
    logger.info(`[fetchResource] All UAs failed, trying fallback cascade...`);

    // Try alternative URL patterns first (might find a working version)
    const altResult = await tryAlternativeUrls(url, CONFIG.USER_AGENT);
    if (altResult && altResult.body.length > 500) {
        logger.info(`[fetchResource] Alternative URL succeeded`);
        return {
            body: altResult.body,
            buffer: altResult.buffer,
            contentType: altResult.contentType,
            url: altResult.finalUrl,
        };
    }

    // Try cache sources (Google Cache, Wayback)
    const cacheResult = await cascadeFallbacks(url);
    if (cacheResult) {
        logger.info(`[fetchResource] Cache fallback succeeded`);
        return {
            body: cacheResult.body,
            buffer: Buffer.from(cacheResult.body, 'utf-8'),
            contentType: 'text/html',
            url: cacheResult.finalUrl,
        };
    }

    // Provide specific error messages
    if (lastError?.message === 'HTTP_403_FORBIDDEN') {
        throw new Error(`Access forbidden (403). The website is blocking automated requests. Try again later or use a different URL.`);
    }

    logger.error(`Failed to fetch resource from ${url}`, lastError?.message);
    throw new Error(`Failed to fetch content: ${lastError?.message || 'Unknown error'}`);
}

// Backward compatibility wrapper
export async function fetchHtml(url: string): Promise<string> {
    const result = await fetchResource(url);
    return result.body;
}
