const fs = require('fs');

async function fetchUrl(url) {
    try {
        console.log(`Fetching ${url}...`);
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
            },
            redirect: 'follow'
        });

        console.log(`Status: ${response.status}`);
        console.log(`Final URL: ${response.url}`);

        const text = await response.text();
        console.log(`Content Length: ${text.length}`);

        // Look for privacy keywords
        const keywords = ['privacy', 'datenschutz', 'impressum', 'legal'];
        console.log('\nSearching for keywords:');
        keywords.forEach(kw => {
            const count = (text.toLowerCase().match(new RegExp(kw, 'g')) || []).length;
            console.log(`- "${kw}": ${count} matches`);
        });

        // Extract links
        console.log('\nExtracting potential policy links:');
        const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;
        let match;
        while ((match = linkRegex.exec(text)) !== null) {
            const href = match[1];
            const linkText = match[2].replace(/<[^>]+>/g, '').trim(); // Strip HTML tags from text

            if (keywords.some(kw => href.toLowerCase().includes(kw) || linkText.toLowerCase().includes(kw))) {
                console.log(`Found: [${linkText}](${href})`);
            }
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

fetchUrl('https://www.iphh.net');
