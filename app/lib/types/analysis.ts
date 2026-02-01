import { z } from 'zod';

/**
 * Category labels for key findings (Educational terminology)
 * 
 * LEGAL NOTE: These categories are designed to be educational summaries,
 * NOT legal assessments or risk ratings. This is intentional to avoid
 * unauthorized practice of law concerns.
 * 
 * UI color mapping:
 * - CONCERNING: High-impact privacy practices (red)
 * - NOTABLE: Medium-impact practices users should know about (orange)
 * - ATTENTION: Minor points worth noting (yellow)
 * - STANDARD: Common industry practices (gray)
 * - POSITIVE: User-friendly features (green)
 * - EXCELLENT: Above-standard transparency (cyan)
 * 
 * Legacy support: Old categories are mapped for backwards compatibility
 */
export const FindingCategory = z.enum([
    // New educational terminology
    'CONCERNING',
    'NOTABLE',
    'ATTENTION',
    'STANDARD',
    'POSITIVE',
    'EXCELLENT',
    // Legacy support (map to new in UI)
    'THREAT',    // → CONCERNING
    'WARNING',   // → NOTABLE
    'CAUTION',   // → ATTENTION
    'NORMAL',    // → STANDARD
    'GOOD',      // → POSITIVE
    'BRILLIANT'  // → EXCELLENT
]);

export type FindingCategoryType = z.infer<typeof FindingCategory>;

/**
 * Maps legacy category names to new educational terminology
 */
export const mapLegacyCategory = (category: FindingCategoryType): FindingCategoryType => {
    const legacyMap: Record<string, FindingCategoryType> = {
        'THREAT': 'CONCERNING',
        'WARNING': 'NOTABLE',
        'CAUTION': 'ATTENTION',
        'NORMAL': 'STANDARD',
        'GOOD': 'POSITIVE',
        'BRILLIANT': 'EXCELLENT',
    };
    return legacyMap[category] || category;
};

export const LabeledFindingSchema = z.object({
    category: FindingCategory,
    text: z.string()
});

export type LabeledFinding = z.infer<typeof LabeledFindingSchema>;

export const SecureUsageRecommendationSchema = z.object({
    priority: z.enum(['high', 'medium', 'low']),
    recommendation: z.string()
});

export type SecureUsageRecommendation = z.infer<typeof SecureUsageRecommendationSchema>;

export const AnalysisResultSchema = z.object({
    // AI may return any number, we clamp to 0-100 in the code after parsing
    score: z.number(),
    summary: z.string(),
    key_findings: z.array(LabeledFindingSchema), // Now labeled with categories
    data_collected: z.array(z.string()),
    third_party_sharing: z.array(z.string()),
    user_rights: z.array(z.string()),
    secure_usage_recommendations: z.array(SecureUsageRecommendationSchema), // New: Tips for secure usage
    contact_info: z.string().optional(),
    last_updated: z.string().optional(),
    word_count: z.number().optional(),
    reading_level: z.string().optional(),
    clauses_found: z.array(z.string()).optional(), // For deterministic scoring
});

export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;
