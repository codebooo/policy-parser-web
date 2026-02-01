import { z } from 'zod';

export const DomainIdentitySchema = z.object({
    originalInput: z.string(),
    cleanDomain: z.string(), // e.g. "google.com"
    subdomain: z.string().optional(), // e.g. "policies"
    rootDomain: z.string(), // e.g. "google"
    tld: z.string(), // e.g. "com"
    isValid: z.boolean(),
});

export type DomainIdentity = z.infer<typeof DomainIdentitySchema>;
