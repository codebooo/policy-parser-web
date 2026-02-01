
import { NextResponse } from 'next/server';
import { findAndFetchPolicy, analyzePolicy } from '@/app/actions';

export const maxDuration = 300; // 5 minutes timeout

const TRICKY_DOMAINS = [
    "spotify.com",
    "netflix.com",
    "airbnb.com",
    "twitter.com",
    "apple.com"
];

export async function GET() {
    const results = [];

    for (const domain of TRICKY_DOMAINS) {
        const start = Date.now();
        try {
            // 1. Crawl
            const crawlResult = await findAndFetchPolicy(domain);

            if (!crawlResult.success) {
                results.push({ domain, status: 'crawl_failed', error: crawlResult.error });
                continue;
            }

            // 2. Analyze
            // Pass a dummy userId or handle the cookie issue by making analyzePolicy robust to missing cookies if possible
            // But analyzePolicy calls createClient() which needs cookies.
            // We can pass a special flag or just let it fail on DB insert if we don't care about DB for this test.
            // However, actions.ts:289 calls createClient().

            const analysisResult = await analyzePolicy(crawlResult.text!, crawlResult.url!, "test-user");

            const duration = (Date.now() - start) / 1000;
            results.push({
                domain,
                status: 'success',
                url: crawlResult.url,
                score: analysisResult.privacyScore,
                summary: analysisResult.summary,
                risks_count: analysisResult.risks?.length,
                duration
            });

        } catch (e: any) {
            results.push({ domain, status: 'error', error: e.message });
        }
    }

    return NextResponse.json({ results });
}
