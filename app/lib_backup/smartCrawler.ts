import * as cheerio from 'cheerio';

interface CrawlResult {
    url: string;
    title: string;
    content: string;
    score: number;
    type: 'privacy' | 'terms' | 'other';
}

export class SmartCrawler {
    private visited = new Set<string>();
    private maxDepth = 2;
    private timeout = 10000; // 10s timeout per request

    // Keywords to score links
    private privacyKeywords = ['privacy', 'data protection', 'gdpr', 'ccpa', 'security'];
    private termsKeywords = ['terms', 'conditions', 'tos', 'user agreement'];
    private legalKeywords = ['legal', 'compliance', 'policies'];

    // Negative keywords to avoid
    private negativeKeywords = ['login', 'signup', 'register', 'signin', 'share', 'facebook', 'twitter', 'linkedin', 'mailto:', 'tel:', 'javascript:', '#'];

    constructor(maxDepth = 2) {
        this.maxDepth = maxDepth;
    }

    async findPolicy(domain: string): Promise<CrawlResult | null> {
        this.visited.clear();
        const baseUrl = domain.startsWith('http') ? domain : `https://${domain}`;

        console.log(`[SmartCrawler] Starting crawl for: ${baseUrl}`);

        // 1. Try Homepage
        const homepageResult = await this.crawl(baseUrl, 0);
        if (!homepageResult) return null;

        // 2. Analyze Homepage Links
        const candidates = this.extractCandidates(homepageResult.html, baseUrl);

        // 3. Sort candidates by score
        candidates.sort((a, b) => b.score - a.score);

        console.log(`[SmartCrawler] Found ${candidates.length} candidates. Top 3:`, candidates.slice(0, 3).map(c => c.url));

        // 4. Visit top candidates (max 5) to verify content
        for (const candidate of candidates.slice(0, 5)) {
            if (this.visited.has(candidate.url)) continue;

            const result = await this.crawl(candidate.url, 1);
            if (result) {
                const type = this.classifyContent(result.text);
                if (type !== 'other') {
                    return {
                        url: candidate.url,
                        title: result.title,
                        content: result.text,
                        score: candidate.score,
                        type
                    };
                }
            }
        }

        return null;
    }

    private async crawl(url: string, depth: number): Promise<{ html: string, text: string, title: string } | null> {
        if (depth > this.maxDepth || this.visited.has(url)) return null;
        this.visited.add(url);

        const userAgents = [
            "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0",
            "Mozilla/5.0 (compatible; Bingbot/2.0; +http://www.bing.com/bingbot.htm)"
        ];

        let res;
        for (const ua of userAgents) {
            try {
                const controller = new AbortController();
                const id = setTimeout(() => controller.abort(), this.timeout);

                res = await fetch(url, {
                    headers: {
                        "User-Agent": ua,
                        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
                    },
                    signal: controller.signal
                });
                clearTimeout(id);

                if (res.ok) break;
                if (res.status !== 403 && res.status !== 401) break; // Don't retry on 404s

                // Small delay
                await new Promise(r => setTimeout(r, 1000));
            } catch (e) {
                // Continue to next UA
            }
        }

        if (!res || !res.ok) return null;

        try {
            const html = await res.text();
            const $ = cheerio.load(html);

            // Clean up
            $('script, style, nav, footer, iframe, svg, path').remove();

            const title = $('title').text().trim();
            const text = $('body').text().replace(/\s+/g, ' ').trim();

            return { html, text, title };
        } catch (e) {
            return null;
        }
    }

    private extractCandidates(html: string, baseUrl: string): { url: string, score: number }[] {
        const $ = cheerio.load(html);
        const candidates: { url: string, score: number }[] = [];
        const baseDomain = new URL(baseUrl).hostname;

        $('a').each((_, el) => {
            const href = $(el).attr('href');
            const text = $(el).text().toLowerCase().trim();

            if (!href) return;

            // Normalize URL
            let fullUrl = href;
            try {
                fullUrl = new URL(href, baseUrl).toString();
            } catch {
                return;
            }

            // Skip negative keywords
            if (this.negativeKeywords.some(k => fullUrl.toLowerCase().includes(k) || text.includes(k))) return;

            let score = 0;

            // Score based on URL
            const urlLower = fullUrl.toLowerCase();

            // Prioritize English versions explicitly
            if (urlLower.includes('/en/') || urlLower.includes('en-us') || urlLower.includes('lang=en')) score += 50;

            if (this.privacyKeywords.some(k => urlLower.includes(k))) score += 50;
            if (this.termsKeywords.some(k => urlLower.includes(k))) score += 30;
            if (this.legalKeywords.some(k => urlLower.includes(k))) score += 20;

            // Score based on Text
            if (this.privacyKeywords.some(k => text.includes(k))) score += 40;
            if (this.termsKeywords.some(k => text.includes(k))) score += 20;
            if (this.legalKeywords.some(k => text.includes(k))) score += 10;

            // Boost for footer links (often contain policies)
            if ($(el).closest('footer').length > 0) score += 10;

            // Penalize non-English if possible
            if (urlLower.includes('/de/') || urlLower.includes('/fr/') || urlLower.includes('/es/')) score -= 10;

            if (score > 0) {
                candidates.push({ url: fullUrl, score });
            }
        });

        return candidates;
    }

    private classifyContent(text: string): 'privacy' | 'terms' | 'other' {
        const lower = text.toLowerCase().substring(0, 2000); // Check first 2000 chars

        let privacyScore = 0;
        let termsScore = 0;

        this.privacyKeywords.forEach(k => { if (lower.includes(k)) privacyScore++; });
        this.termsKeywords.forEach(k => { if (lower.includes(k)) termsScore++; });

        if (privacyScore > 2) return 'privacy';
        if (termsScore > 2) return 'terms';

        return 'other';
    }
}
