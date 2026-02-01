/**
 * JARVIS Test Script
 * 
 * Tests the parallel policy discovery system
 * Run with: npx tsx scripts/test-jarvis.ts
 */

import { Jarvis, discoverWithJarvis } from '../app/lib/jarvis';

const TEST_DOMAINS = [
    'google.com',
    'github.com',
    'openai.com',
    'stackoverflow.com',
    'microsoft.com',
    'amazon.com',
    'apple.com',
    'netflix.com'
];

async function runTests() {
    console.log('━'.repeat(60));
    console.log('🤖 JARVIS Parallel Policy Discovery Tests');
    console.log('━'.repeat(60));
    console.log('');

    const results: { domain: string; success: boolean; count: number; time: number }[] = [];
    let totalPolicies = 0;
    let totalTime = 0;

    for (const domain of TEST_DOMAINS) {
        console.log(`\n🔍 Testing: ${domain}`);
        console.log('─'.repeat(40));

        try {
            const startTime = Date.now();
            const result = await discoverWithJarvis(domain, {
                maxWorkers: 10,
                timeout: 15000
            });
            const elapsed = Date.now() - startTime;

            if (result.success) {
                console.log(`✅ SUCCESS in ${elapsed}ms`);
                console.log(`   Workers used: ${result.workersUsed}`);
                console.log(`   Candidates found: ${result.candidatesFound}`);
                console.log(`   Final policies: ${result.policies.length}`);
                console.log('');

                for (const policy of result.policies) {
                    const confidence = policy.confidence === 'high' ? '🟢' :
                        policy.confidence === 'medium' ? '🟡' : '🔴';
                    console.log(`   ${confidence} ${policy.name}`);
                    console.log(`      URL: ${policy.url}`);
                    console.log(`      Source: ${policy.source}`);
                    if (policy.neuralScore !== undefined) {
                        console.log(`      Carl Score: ${(policy.neuralScore * 100).toFixed(1)}%`);
                    }
                }

                results.push({
                    domain,
                    success: true,
                    count: result.policies.length,
                    time: elapsed
                });
                totalPolicies += result.policies.length;
                totalTime += elapsed;
            } else {
                console.log(`❌ FAILED: ${result.error}`);
                results.push({ domain, success: false, count: 0, time: elapsed });
            }

        } catch (error: any) {
            console.log(`❌ ERROR: ${error.message}`);
            results.push({ domain, success: false, count: 0, time: 0 });
        }
    }

    // Summary
    console.log('\n' + '━'.repeat(60));
    console.log('📊 SUMMARY');
    console.log('━'.repeat(60));
    console.log('');

    const successCount = results.filter(r => r.success).length;
    const avgTime = totalTime / successCount || 0;

    console.log(`Domains tested: ${TEST_DOMAINS.length}`);
    console.log(`Success rate: ${successCount}/${TEST_DOMAINS.length} (${Math.round(successCount / TEST_DOMAINS.length * 100)}%)`);
    console.log(`Total policies found: ${totalPolicies}`);
    console.log(`Average time per domain: ${Math.round(avgTime)}ms`);
    console.log('');

    // Compare to target
    console.log('🎯 Performance vs Target:');
    console.log(`   Speed: ${avgTime < 3000 ? '✅' : '❌'} ${Math.round(avgTime)}ms (target: <3000ms)`);
    console.log(`   Policies per domain: ${totalPolicies / successCount >= 2 ? '✅' : '❌'} ${(totalPolicies / successCount).toFixed(1)} (target: ≥2)`);

    // Detailed table
    console.log('\n' + '─'.repeat(60));
    console.log('Domain                      | Status | Policies | Time');
    console.log('─'.repeat(60));

    for (const r of results) {
        const domain = r.domain.padEnd(27);
        const status = r.success ? '✅     ' : '❌     ';
        const count = r.count.toString().padEnd(8);
        const time = `${r.time}ms`;
        console.log(`${domain} | ${status} | ${count} | ${time}`);
    }

    console.log('─'.repeat(60));
}

// Run with streaming progress
async function runWithStreaming() {
    console.log('\n🌊 Streaming Progress Demo');
    console.log('─'.repeat(40));

    const jarvis = new Jarvis({
        maxWorkers: 10,
        timeout: 15000,
        streaming: true
    });

    jarvis.onProgress((progress) => {
        console.log(`[${progress.phase}] ${progress.message} (${progress.elapsedMs}ms)`);
    });

    await jarvis.discover('github.com');
}

// Main
(async () => {
    await runTests();
    await runWithStreaming();
})();
