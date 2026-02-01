import { AnalysisResult } from '../types/analysis';

export function calculateScore(analysis: Partial<AnalysisResult>): number {
    let score = 100;
    const deductions: string[] = [];

    // 1. Critical Missing Clauses
    const clauses = analysis.clauses_found || [];

    if (!clauses.includes('deletion_clause')) {
        score -= 15;
        deductions.push('No data deletion clause (-15)');
    }

    if (!clauses.includes('contact_clause') && !analysis.contact_info) {
        score -= 10;
        deductions.push('No contact information (-10)');
    }

    // 2. Data Collection & Sharing (granular scoring)
    const thirdPartySharing = analysis.third_party_sharing || [];
    if (thirdPartySharing.some(s => s.toLowerCase().includes('sell'))) {
        score -= 18;
        deductions.push('Sells user data (-18)');
    } else if (thirdPartySharing.some(s => s.toLowerCase().includes('marketing'))) {
        score -= 12;
        deductions.push('Shares for marketing (-12)');
    } else if (thirdPartySharing.length > 5) {
        score -= 8;
        deductions.push('Many third-party data shares (-8)');
    } else if (thirdPartySharing.length > 2) {
        score -= 4;
        deductions.push('Some third-party data shares (-4)');
    }

    // 3. Readability (granular)
    if (analysis.reading_level === 'Complex') {
        score -= 7;
        deductions.push('Complex legal jargon (-7)');
    } else if (analysis.reading_level === 'Moderate') {
        score -= 3;
        deductions.push('Moderate complexity (-3)');
    }

    // 4. Vague Language (Heuristic based on findings)
    const findings = analysis.key_findings?.join(' ') || '';
    const findingsLower = findings.toLowerCase();
    if (findingsLower.includes('vague') || findingsLower.includes('unclear')) {
        score -= 8;
        deductions.push('Vague or unclear language (-8)');
    }

    // 5. Data retention concerns
    if (findingsLower.includes('indefinite') || findingsLower.includes('forever')) {
        score -= 6;
        deductions.push('Indefinite data retention (-6)');
    }

    // 6. Tracking concerns
    if (findingsLower.includes('track') && findingsLower.includes('third')) {
        score -= 5;
        deductions.push('Third-party tracking (-5)');
    }

    // 7. Positive signals (add points back)
    if (clauses.includes('opt_out_clause')) {
        score += 3;
        deductions.push('Opt-out available (+3)');
    }

    if (analysis.reading_level === 'Simple') {
        score += 2;
        deductions.push('Clear, simple language (+2)');
    }

    // Clamp score to 1-100 range (never 0, that's too harsh)
    return Math.max(1, Math.min(100, score));
}
