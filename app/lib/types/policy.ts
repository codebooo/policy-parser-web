import { z } from 'zod';

export const PolicySourceSchema = z.enum([
    'standard_path',
    'sitemap',
    'footer_link',
    'search_fallback',
    'manual_override',
    'special_domain',
    'direct_fetch'
]);

export const PolicyCandidateSchema = z.object({
    url: z.string().url(),
    source: PolicySourceSchema,
    confidence: z.number().min(0).max(100),
    foundAt: z.date(),
    methodDetail: z.string().optional(), // e.g. "Found in sitemap.xml at index 3"
});

export type PolicySource = z.infer<typeof PolicySourceSchema>;
export type PolicyCandidate = z.infer<typeof PolicyCandidateSchema>;
