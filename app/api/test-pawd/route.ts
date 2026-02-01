import { NextResponse } from 'next/server';
import { findAndFetchPolicy } from '@/app/actions';

export const maxDuration = 300; // 5 minutes timeout

export async function GET() {
    const companies = [
        "Google", "Facebook", "Amazon", "Apple", "Microsoft",
        "Netflix", "Spotify", "Twitter", "Instagram", "LinkedIn",
        "TikTok", "Uber", "Airbnb", "OpenAI", "Anthropic",
        "Perplexity", "Discord", "Slack", "Zoom", "Reddit"
    ];

    const results = [];
    let successCount = 0;

    for (const company of companies) {
        const start = Date.now();
        try {
            const result = await findAndFetchPolicy(company);
            const duration = Date.now() - start;

            if (result.success) {
                successCount++;
                results.push({
                    company,
                    success: true,
                    url: result.url,
                    date: result.date,
                    duration: `${duration}ms`
                });
            } else {
                results.push({
                    company,
                    success: false,
                    error: result.error,
                    duration: `${duration}ms`
                });
            }
        } catch (error: any) {
            results.push({
                company,
                success: false,
                error: error.message,
                duration: `${Date.now() - start}ms`
            });
        }
    }

    return NextResponse.json({
        total: companies.length,
        successCount,
        successRate: `${(successCount / companies.length) * 100}%`,
        results
    });
}
