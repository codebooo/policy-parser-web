import { normalizeInput } from './normalizer';
import { verifyDNS } from './dns';
import { resolveCompanyToDomain } from './searchResolver';
import { DomainIdentity, DomainIdentitySchema } from '../types/domain';
import { parse } from 'tldts';
import { logger } from '../logger';

export async function identifyTarget(input: string): Promise<DomainIdentity> {
    let cleanDomain = normalizeInput(input);
    let isDomain = cleanDomain.includes('.'); // Simple heuristic

    if (!isDomain) {
        logger.info(`Input '${input}' is not a domain. Resolving via search...`);
        const resolved = await resolveCompanyToDomain(input);
        if (resolved) {
            cleanDomain = normalizeInput(resolved);
            logger.info(`Resolved '${input}' to '${cleanDomain}'`);
        } else {
            throw new Error(`Could not resolve company '${input}' to a domain.`);
        }
    }

    // Verify DNS
    const exists = await verifyDNS(cleanDomain);
    if (!exists) {
        throw new Error(`Domain '${cleanDomain}' does not exist (DNS lookup failed).`);
    }

    const parsed = parse(cleanDomain);

    const identity: DomainIdentity = {
        originalInput: input,
        cleanDomain: cleanDomain,
        subdomain: parsed.subdomain || undefined,
        rootDomain: parsed.domain || cleanDomain,
        tld: parsed.publicSuffix || '',
        isValid: true
    };

    return DomainIdentitySchema.parse(identity);
}
