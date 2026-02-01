import got from 'got';
import dns from 'dns/promises';

async function testNetwork() {
    console.log('--- Network Debug ---');

    try {
        console.log('1. Testing DNS...');
        const ips = await dns.resolve('google.com');
        console.log('   DNS OK:', ips);
    } catch (e: any) {
        console.error('   DNS Failed:', e.message);
    }

    try {
        console.log('2. Testing HTTP (got)...');
        const res = await got('https://google.com', { timeout: { request: 5000 } });
        console.log('   HTTP OK:', res.statusCode);
    } catch (e: any) {
        console.error('   HTTP Failed:', e.message);
    }
}

testNetwork();
