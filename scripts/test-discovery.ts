import { PolicyDiscoveryEngine } from '../app/lib/discovery/Engine';
import { logger } from '../app/lib/logger';

async function runTests() {
    console.log('--- Starting Discovery Engine Tests ---');
    const engine = new PolicyDiscoveryEngine();

    const testDomains = [
        'google.com',
        'github.com',
        'openai.com',
        'stackoverflow.com'
    ];

    for (const domain of testDomains) {
        try {
            console.log(`\n🔍 Discovering policy for: ${domain}`);
            const result = await engine.discover(domain);

            if (result) {
                console.log(`✅ FOUND: ${result.url}`);
                console.log(`   Source: ${result.source}`);
                console.log(`   Confidence: ${result.confidence}`);
                console.log(`   Detail: ${result.methodDetail}`);
            } else {
                console.error(`❌ FAILED: No policy found for ${domain}`);
            }
        } catch (error: any) {
            console.error(`❌ ERROR: ${error.message}`);
        }
    }
}

runTests();
