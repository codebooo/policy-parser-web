console.log('DOMMatrix defined before require?', typeof global.DOMMatrix !== 'undefined');
const pdf = require('pdf-parse');
const https = require('https');

const Parser = pdf.PDFParse;
console.log('Parser type:', typeof Parser);
console.log('DOMMatrix defined after require?', typeof global.DOMMatrix !== 'undefined');

function fetchPdf(url) {
    return new Promise((resolve, reject) => {
        const options = {
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control': 'max-age=0',
                'Sec-Ch-Ua': '"Not_A Brand";v="99", "Google Chrome";v="109", "Chromium";v="109"',
                'Sec-Ch-Ua-Mobile': '?0',
                'Sec-Ch-Ua-Platform': '"Windows"',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Upgrade-Insecure-Requests': '1',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36'
            }
        };
        https.get(url, options, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`Failed to fetch PDF: ${res.statusCode}`));
                return;
            }
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => resolve(Buffer.concat(chunks)));
            res.on('error', reject);
        });
    });
}

(async () => {
    try {
        const url = 'https://atlasedge.com/wp-content/uploads/2025/02/AE-Privacy-Statement-v16-.pdf';
        console.log('Fetching PDF...');
        const buffer = await fetchPdf(url);
        console.log('PDF fetched, size:', buffer.length);
        console.log('Header:', buffer.slice(0, 20).toString());

        const instance = new Parser(new Uint8Array(buffer));
        console.log('Instance created with PDF buffer');
        const result = await instance.getText();
        const text = result.text;
        console.log('Text extracted length:', text.length);
        console.log('Preview:', text.substring(0, 100));
    } catch (e) {
        console.log('Error:', e.message);
        console.log(e.stack);
    }
})();
