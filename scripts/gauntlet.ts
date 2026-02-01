import { identifyTarget } from '../app/lib/identifier';
import { PolicyDiscoveryEngine } from '../app/lib/discovery/Engine';
import { extractPolicyContent } from '../app/lib/extractor';
import { logger } from '../app/lib/logger';

async function runGauntlet() {
    console.log('--- 🛡️ STARTING GAUNTLET 🛡️ ---');

    const targets = [
        'google.com',
        'apple.com',
        'github.com',
        'stackoverflow.com',
        'vercel.com',
        'linear.app',
        'notion.so'
    ];

    let passed = 0;
    let failed = 0;

    for (const input of targets) {
        console.log(`\n⚔️  Testing: ${input}`);
        try {
            // 1. Identify
            console.time('Identify');
            const identity = await identifyTarget(input);
            console.timeEnd('Identify');
            console.log(`   ✅ Identity: ${identity.cleanDomain}`);

            // 2. Discover
            console.time('Discover');
            const engine = new PolicyDiscoveryEngine();
            const candidate = await engine.discover(identity.cleanDomain);
            console.timeEnd('Discover');

            if (!candidate) {
                throw new Error('No policy found');
            }
            console.log(`   ✅ Discovered: ${candidate.url} (${candidate.source})`);

            // 3. Extract
            console.time('Extract');
            const extracted = await extractPolicyContent(candidate.url);
            console.timeEnd('Extract');
            console.log(`   ✅ Extracted: ${extracted.rawLength} chars`);

            if (extracted.rawLength < 500) {
                throw new Error('Extracted content too short');
            }

            console.log(`   🎉 SUCCESS for ${input}`);
            passed++;

        } catch (error: any) {
            console.error(`   💀 FAILED for ${input}: ${error.message}`);
            failed++;
        }
    }

    console.log('\n--- 🏁 GAUNTLET RESULTS 🏁 ---');
    console.log(`Passed: ${passed}/${targets.length}`);
    console.log(`Failed: ${failed}/${targets.length}`);

    if (failed === 0) {
        console.log('🏆 PERFECT RUN');
    } else {
        console.log('⚠️  SOME FAILURES');
    }
}

runGauntlet();
