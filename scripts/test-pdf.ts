import { extractPolicyContent } from '../app/lib/extractor/index';
import { logger } from '../app/lib/logger';

// Mock logger to see output
(logger as any).info = console.log;
(logger as any).error = console.error;
(logger as any).debug = console.log;
(logger as any).warn = console.warn;

async function testPdfExtraction() {
    const url = 'https://atlasedge.com/wp-content/uploads/2025/02/AE-Privacy-Statement-v16-.pdf';
    console.log(`Testing PDF extraction for: ${url}`);

    try {
        const result = await extractPolicyContent(url);
        console.log('----------------------------------------');
        console.log('Extraction Successful!');
        console.log('Title:', result.title);
        console.log('URL:', result.url);
        console.log('Content Type:', (result as any).contentType);
        console.log('Raw Length:', result.rawLength);
        console.log('Markdown Preview (first 500 chars):');
        console.log(result.markdown.substring(0, 500));
        console.log('----------------------------------------');
    } catch (error) {
        console.error('Extraction Failed:', error);
    }
}

testPdfExtraction();
