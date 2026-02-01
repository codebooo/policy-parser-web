import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { logger } from '../logger';

/**
 * Gemini API Key Rotation System with Automatic Quota Detection
 * 
 * Keys can be set in multiple formats:
 * 1. GEMINI_API_KEYS=key1,key2,key3 (comma-separated)
 * 2. GEMINI_API_KEY="key1","key2","key3" (quoted comma-separated)
 * 3. GEMINI_API_KEY=singlekey (single key)
 * 
 * Features:
 * - Automatic detection of quota exhaustion (429, 503, RESOURCE_EXHAUSTED)
 * - Automatic rotation to next available key
 * - Tracks exhausted keys to avoid retrying them
 * - Auto-reset of exhausted keys after cooldown period
 */

// Cache of API keys
let apiKeysCache: string[] | null = null;

/**
 * Parse API keys from environment variable
 * Supports formats: "key1","key2" OR key1,key2 OR single key
 */
function parseApiKeys(value: string): string[] {
    // Check if it's in "key","key" format (with quotes)
    if (value.includes('","')) {
        // Split by "," and clean up quotes
        return value
            .split('","')
            .map(k => k.replace(/^"|"$/g, '').trim())
            .filter(k => k.length > 0);
    }
    
    // Check if it's just comma-separated (no quotes)
    if (value.includes(',')) {
        return value
            .split(',')
            .map(k => k.replace(/^"|"$/g, '').trim())
            .filter(k => k.length > 0);
    }
    
    // Single key - strip quotes if present
    const cleaned = value.replace(/^"|"$/g, '').trim();
    return cleaned.length > 0 ? [cleaned] : [];
}

function getApiKeys(): string[] {
    if (apiKeysCache) return apiKeysCache;
    
    // Check for multiple keys first (GEMINI_API_KEYS)
    const multipleKeys = process.env.GEMINI_API_KEYS;
    if (multipleKeys) {
        const keys = parseApiKeys(multipleKeys);
        if (keys.length > 0) {
            apiKeysCache = keys;
            logger.info(`[Gemini] Loaded ${keys.length} API keys from GEMINI_API_KEYS`);
            return keys;
        }
    }
    
    // Check single key variable (may contain multiple keys in "key","key" format)
    const singleKeyVar = process.env.GEMINI_API_KEY;
    if (singleKeyVar) {
        const keys = parseApiKeys(singleKeyVar);
        if (keys.length > 0) {
            apiKeysCache = keys;
            logger.info(`[Gemini] Loaded ${keys.length} API key(s) from GEMINI_API_KEY`);
            return keys;
        }
    }
    
    throw new Error('No Gemini API key configured. Set GEMINI_API_KEY or GEMINI_API_KEYS in .env.local');
}

/**
 * Track exhausted keys and when they were exhausted
 * Key index -> timestamp when exhausted
 */
const exhaustedKeys = new Map<number, number>();

/**
 * Cooldown period before retrying an exhausted key (15 minutes)
 */
const COOLDOWN_MS = 15 * 60 * 1000;

/**
 * Current key index for rotation
 */
let currentKeyIndex = 0;

/**
 * Get the count of available (non-exhausted) keys
 */
function getAvailableKeyCount(): number {
    const keys = getApiKeys();
    const now = Date.now();
    let available = 0;
    
    for (let i = 0; i < keys.length; i++) {
        const exhaustedAt = exhaustedKeys.get(i);
        if (!exhaustedAt || (now - exhaustedAt) > COOLDOWN_MS) {
            available++;
        }
    }
    
    return available;
}

/**
 * Get the next available API key, skipping exhausted ones
 */
function getNextAvailableKey(): { key: string; index: number } | null {
    const keys = getApiKeys();
    const now = Date.now();
    
    // Clean up expired exhausted keys
    for (const [index, timestamp] of exhaustedKeys) {
        if ((now - timestamp) > COOLDOWN_MS) {
            exhaustedKeys.delete(index);
            logger.info(`[Gemini] Key ${index + 1} cooldown expired, marking as available`);
        }
    }
    
    // Try to find an available key starting from current index
    for (let attempts = 0; attempts < keys.length; attempts++) {
        const index = (currentKeyIndex + attempts) % keys.length;
        
        if (!exhaustedKeys.has(index)) {
            currentKeyIndex = (index + 1) % keys.length;
            logger.info(`[Gemini] Using API key ${index + 1}/${keys.length} (${getAvailableKeyCount()} available)`);
            return { key: keys[index], index };
        }
    }
    
    // All keys exhausted
    logger.error(`[Gemini] All ${keys.length} API keys are exhausted!`);
    return null;
}

/**
 * Mark a key as exhausted (hit quota limit)
 */
export function markKeyExhausted(keyIndex: number): void {
    const keys = getApiKeys();
    exhaustedKeys.set(keyIndex, Date.now());
    const remaining = getAvailableKeyCount();
    logger.warn(`[Gemini] Key ${keyIndex + 1}/${keys.length} quota exhausted. ${remaining} keys remaining.`);
}

/**
 * Check if an error indicates quota exhaustion
 */
export function isQuotaError(error: any): boolean {
    if (!error) return false;
    
    const message = error.message?.toLowerCase() || '';
    const status = error.status || error.statusCode || error.code;
    
    // Check for common quota/rate limit indicators
    return (
        status === 429 ||
        status === 503 ||
        message.includes('quota') ||
        message.includes('rate limit') ||
        message.includes('resource_exhausted') ||
        message.includes('too many requests') ||
        message.includes('exceeded') ||
        message.includes('limit exceeded') ||
        error.code === 'RESOURCE_EXHAUSTED'
    );
}

/**
 * State for tracking the current key being used
 */
let lastUsedKeyIndex: number = -1;

/**
 * Create a Gemini provider instance with the next available API key
 * Returns null if all keys are exhausted
 */
export function getGeminiProvider() {
    const keyInfo = getNextAvailableKey();
    
    if (!keyInfo) {
        throw new Error('All Gemini API keys are exhausted. Please wait 15 minutes or add more keys.');
    }
    
    lastUsedKeyIndex = keyInfo.index;
    
    return createGoogleGenerativeAI({
        apiKey: keyInfo.key
    });
}

/**
 * Get the index of the last used key (for marking as exhausted on error)
 */
export function getLastUsedKeyIndex(): number {
    return lastUsedKeyIndex;
}

/**
 * Get the Gemini model for analysis
 * Uses gemini-2.5-flash for all operations
 */
export function getGeminiModel() {
    const google = getGeminiProvider();
    return google('gemini-2.5-flash');
}

/**
 * Default model name for Gemini
 */
export const GEMINI_MODEL = 'gemini-2.5-flash';

/**
 * Get status of API key pool
 */
export function getKeyPoolStatus(): { total: number; available: number; exhausted: number } {
    const keys = getApiKeys();
    const available = getAvailableKeyCount();
    return {
        total: keys.length,
        available,
        exhausted: keys.length - available
    };
}

/**
 * OpenRouter API key for Grok backup (x-ai/grok-3-beta)
 */
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

/**
 * Backup: OpenRouter Grok model
 * Used when Gemini rate limits are exhausted
 */
export async function getGrokBackupModel() {
    if (!OPENROUTER_API_KEY) {
        logger.warn('OpenRouter API key not configured, Grok backup unavailable');
        return null;
    }
    
    // OpenRouter uses OpenAI-compatible API
    const { createOpenAI } = await import('@ai-sdk/openai');
    const openrouter = createOpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: OPENROUTER_API_KEY,
    });
    
    return openrouter('x-ai/grok-3-beta');
}

/**
 * Execute an AI operation with automatic key rotation on quota errors
 * 
 * @param operation - The AI operation to execute (receives model as parameter)
 * @param maxRetries - Maximum number of key rotations to try (default: all available keys)
 * @returns The result of the operation
 * @throws Error if all keys are exhausted
 */
export async function withKeyRotation<T>(
    operation: (model: ReturnType<typeof getGeminiModel>) => Promise<T>,
    maxRetries?: number
): Promise<T> {
    const keys = getApiKeys();
    const retries = maxRetries ?? keys.length;
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const model = getGeminiModel();
            const keyIndex = getLastUsedKeyIndex();
            
            logger.info(`[Gemini] Attempt ${attempt + 1}/${retries} with key ${keyIndex + 1}`);
            
            const result = await operation(model);
            return result;
            
        } catch (error: any) {
            lastError = error;
            const keyIndex = getLastUsedKeyIndex();
            
            if (isQuotaError(error)) {
                markKeyExhausted(keyIndex);
                logger.warn(`[Gemini] Quota error on key ${keyIndex + 1}, rotating... (${error.message})`);
                
                // Check if we have any keys left
                const status = getKeyPoolStatus();
                if (status.available === 0) {
                    logger.error(`[Gemini] All ${status.total} keys exhausted!`);
                    throw new Error(`All ${status.total} Gemini API keys are exhausted. Please wait 15 minutes or add more keys to GEMINI_API_KEYS.`);
                }
                
                // Continue to next iteration with a new key
                continue;
            }
            
            // Non-quota error, don't retry
            logger.error(`[Gemini] Non-quota error: ${error.message}`);
            throw error;
        }
    }
    
    // All retries exhausted
    throw lastError || new Error('All Gemini API key retries exhausted');
}
