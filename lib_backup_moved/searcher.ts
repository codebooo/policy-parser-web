import * as cheerio from 'cheerio';

interface SearchResult {
    title: string;
    url: string;
    snippet: string;
}

export class Searcher {
    private userAgents = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ];

    /**
     * Searches for a privacy policy for the given company/domain.
     * Returns a list of candidate URLs.
     */
    async search(query: string): Promise<SearchResult[]> {
        console.log(`[Searcher] Searching for: ${query}`);
        
        // 1. Try DuckDuckGo HTML (No API Key needed)
        try {
            const results = await this.searchDDG(query);
            if (results.length > 0) {
                console.log(`[Searcher] DDG found ${results.length} results.`);
                return this.filterResults(results);
            }
        } catch (e) {
            console.error("[Searcher] DDG failed:", e);
        }

        // 2. Fallback to Grok (if available via actions.ts logic, but here we keep it self-contained)
        // For now, we'll rely on DDG. If we need Grok, we can inject it or call it from actions.ts
        
        return [];
    }

    private async searchDDG(query: string): Promise<SearchResult[]> {
        const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
        const ua = this.userAgents[Math.floor(Math.random() * this.userAgents.length)];

        const response = await fetch(url, {
            headers: {
                "User-Agent": ua,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.5"
            }
        });

        if (!response.ok) throw new Error(`DDG status ${response.status}`);

        const html = await response.text();
        const $ = cheerio.load(html);
        const results: SearchResult[] = [];

        $('.result').each((i, el) => {
            const title = $(el).find('.result__title').text().trim();
            const url = $(el).find('.result__a').attr('href');
            const snippet = $(el).find('.result__snippet').text().trim();

            if (url && !url.startsWith('//duckduckgo.com/y.js')) {
                // DDG sometimes wraps URLs, but usually in HTML version they are direct or relative
                // In html.duckduckgo.com, the href is often a redirect like /l/?kh=-1&uddg=...
                // We need to extract the real URL if possible, or use the displayed one.
                // Actually, .result__url often contains the display URL.
                
                // Let's try to decode the uddg param if it exists
                let realUrl = url;
                if (url.includes('uddg=')) {
                    const match = url.match(/uddg=([^&]+)/);
                    if (match && match[1]) {
                        realUrl = decodeURIComponent(match[1]);
                    }
                }

                if (realUrl.startsWith('http')) {
                    results.push({ title, url: realUrl, snippet });
                }
            }
        });

        return results;
    }

    private filterResults(results: SearchResult[]): SearchResult[] {
        const negativeKeywords = ['help', 'community', 'support', 'topic', 'faq', 'login', 'signup', 'signin'];
        const positiveKeywords = ['privacy', 'policy', 'legal', 'terms', 'notice'];

        return results.filter(r => {
            const lowerUrl = r.url.toLowerCase();
            const lowerTitle = r.title.toLowerCase();

            // Must not have negative keywords in URL (unless it also has a strong positive one?)
            // Ebay example: help/policies/member-behaviour-policies/user-privacy-notice
            // This HAS 'help' but also 'privacy-notice'.
            // We should be careful. Maybe just deprioritize 'help' instead of excluding.
            
            // Let's exclude obvious non-policy pages
            if (lowerUrl.includes('login') || lowerUrl.includes('signup')) return false;

            return true;
        }).sort((a, b) => {
            let scoreA = 0;
            let scoreB = 0;

            const score = (item: SearchResult) => {
                let s = 0;
                const text = (item.url + item.title).toLowerCase();
                if (text.includes('privacy')) s += 10;
                if (text.includes('policy')) s += 5;
                if (text.includes('notice')) s += 5;
                
                // Penalize help/support slightly, but don't ban them
                if (text.includes('help')) s -= 5;
                if (text.includes('support')) s -= 5;
                if (text.includes('community')) s -= 10;

                // Prefer shorter URLs
                s -= item.url.length * 0.05; 

                return s;
            };

            return score(b) - score(a);
        });
    }
}
