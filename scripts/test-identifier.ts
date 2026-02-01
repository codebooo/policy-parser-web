import { identifyTarget } from '../app/lib/identifier';
import { logger } from '../app/lib/logger';

async function runTests() {
    console.log('--- Starting Identifier Tests ---');

    const testCases = [
        { input: 'google.com', expected: 'google.com', shouldPass: true },
        { input: ' https://APPLE.COM ', expected: 'apple.com', shouldPass: true },
        { input: 'OpenAI', expected: 'openai.com', shouldPass: true }, // Search resolution
        { input: 'this-domain-does-not-exist-12345.xyz', expected: '', shouldPass: false },
    ];

    for (const test of testCases) {
        try {
            console.log(`Testing: '${test.input}'`);
            const result = await identifyTarget(test.input);

            if (test.shouldPass) {
                if (result.cleanDomain === test.expected) {
                    console.log(`✅ PASS: Resolved to ${result.cleanDomain}`);
                } else {
                    console.error(`❌ FAIL: Expected ${test.expected}, got ${result.cleanDomain}`);
                }
            } else {
                console.error(`❌ FAIL: Should have thrown error but got ${result.cleanDomain}`);
            }
        } catch (error: any) {
            if (!test.shouldPass) {
                console.log(`✅ PASS: Correctly failed with error: ${error.message}`);
            } else {
                console.error(`❌ FAIL: Unexpected error: ${error.message}`);
            }
        }
        console.log('---');
    }
}

runTests();
