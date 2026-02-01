import dns from 'dns';
import { promisify } from 'util';

const resolve4 = promisify(dns.resolve4);
const resolve6 = promisify(dns.resolve6);
const lookup = promisify(dns.lookup);

/**
 * Verify if a domain exists via DNS lookup.
 * Uses multiple methods for robustness:
 * 1. Try IPv4 (A record)
 * 2. Try IPv6 (AAAA record) 
 * 3. Fall back to OS DNS lookup
 * 
 * This handles cases where domains only have IPv6 records or when
 * specific DNS queries fail but the domain is still valid.
 */
export async function verifyDNS(domain: string): Promise<boolean> {
    // Method 1: Try IPv4 resolution
    try {
        const addresses = await resolve4(domain);
        if (addresses.length > 0) {
            return true;
        }
    } catch (error: any) {
        // ENOTFOUND means no A record, but there might be AAAA
        if (error.code !== 'ENOTFOUND' && error.code !== 'ENODATA') {
            // Log unexpected errors but continue to fallbacks
            console.warn(`DNS resolve4 error for ${domain}:`, error.code);
        }
    }

    // Method 2: Try IPv6 resolution (some domains only have AAAA records)
    try {
        const addresses = await resolve6(domain);
        if (addresses.length > 0) {
            return true;
        }
    } catch (error: any) {
        if (error.code !== 'ENOTFOUND' && error.code !== 'ENODATA') {
            console.warn(`DNS resolve6 error for ${domain}:`, error.code);
        }
    }

    // Method 3: Use OS-level DNS lookup as final fallback
    // This uses the system's resolver which may have different results
    try {
        const result = await lookup(domain);
        if (result && result.address) {
            return true;
        }
    } catch (error: any) {
        if (error.code !== 'ENOTFOUND') {
            console.warn(`DNS lookup error for ${domain}:`, error.code);
        }
    }

    // All methods failed - domain likely doesn't exist
    return false;
}
