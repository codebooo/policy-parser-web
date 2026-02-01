
import { findAndFetchPolicy, analyzePolicy } from '../app/actions';
import fs from 'fs';
import path from 'path';

const TRICKY_DOMAINS = [
    "spotify.com",
    "netflix.com",
    "airbnb.com",
    "twitter.com", // x.com
    "apple.com"
];

async function runTest() {
    console.log("🚀 Starting Ironclad Verification Test...");
    const results = [];

    for (const domain of TRICKY_DOMAINS) {
        console.log(`\nTesting: ${domain}`);
        const start = Date.now();

        try {
            // 1. Crawl
            console.log(`  - Crawling...`);
            const crawlResult = await findAndFetchPolicy(domain);

            if (!crawlResult.success) {
                console.error(`  ❌ Crawl Failed: ${crawlResult.error}`);
                results.push({ domain, status: 'crawl_failed', error: crawlResult.error });
                continue;
            }
            console.log(`  ✅ Crawl Success! Found URL: ${crawlResult.url}`);

            // 2. Analyze
            console.log(`  - Analyzing (Map-Reduce-Verify)...`);
            const analysisResult = await analyzePolicy(crawlResult.text!, crawlResult.url!);

            if (!analysisResult.success) {
                console.error(`  ❌ Analysis Failed: ${analysisResult.error}`);
                results.push({ domain, status: 'analysis_failed', error: analysisResult.error });
                continue;
            }

            const duration = (Date.now() - start) / 1000;
            console.log(`  ✅ Analysis Success! Score: ${analysisResult.privacyScore}`);
            console.log(`  ⏱️ Duration: ${duration.toFixed(2)}s`);

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
            console.error(`  ❌ Unexpected Error: ${e.message}`);
            results.push({ domain, status: 'error', error: e.message });
        }
    }

    // Save Report
    const reportPath = path.join(process.cwd(), 'test_results_ironclad.json');
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    console.log(`\n📝 Report saved to ${reportPath}`);
}

// Execute
runTest();
