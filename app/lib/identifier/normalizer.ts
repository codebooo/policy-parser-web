import { parse } from 'tldts';

export function normalizeInput(input: string): string {
    let normalized = input.trim().toLowerCase();

    // Remove protocol
    normalized = normalized.replace(/^https?:\/\//, '');

    // Remove www.
    normalized = normalized.replace(/^www\./, '');

    // Remove trailing slash
    if (normalized.endsWith('/')) {
        normalized = normalized.slice(0, -1);
    }

    // Extract domain using tldts to handle subdomains correctly
    const result = parse(normalized);

    if (!result.domain) {
        // If tldts fails, return the cleaned input as best effort
        return normalized;
    }

    return result.hostname || normalized;
}
