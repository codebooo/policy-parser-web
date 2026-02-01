import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import { validatePolicyContent, isGarbageContent } from './contentValidator';

interface CrawlResult {
    url: string;
    title: string;
    content: string;
    score: number;
    type: 'privacy' | 'terms' | 'other';
}

export class UniversalCrawler {
    private maxDepth = 2;
    private timeout = 45000; // Increased timeout for heavy sites
    private visited = new Set<string>();

    // Keywords to score links
    private privacyKeywords = ['privacy', 'data protection', 'gdpr', 'ccpa', 'security', 'datenschutz', 'confidentialité', 'privacidad', 'cookie', 'cookies', 'personal data'];
    private termsKeywords = ['terms', 'conditions', 'tos', 'user agreement', 'nutzungsbedingungen', 'agb', 'service agreement', 'legal notice'];
    private legalKeywords = ['legal', 'compliance', 'policies', 'rechtliches', 'impressum', 'imprint'];

    // Negative keywords
    private negativeKeywords = ['login', 'signup', 'register', 'signin', 'share', 'mailto:', 'tel:', 'javascript:', '#', '/help/', '/support/', '/faq/'];

    constructor(maxDepth = 2) {
        this.maxDepth = maxDepth;
    }

    async findPolicy(domain: string): Promise<CrawlResult | null> {
        let browser = null;
        try {
            const executablePath = await chromium.executablePath() ||
                'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'; // Fallback for local dev

            browser = await puppeteer.launch({
                args: (chromium as any).args,
                defaultViewport: (chromium as any).defaultViewport,
                executablePath: executablePath,
                headless: (chromium as any).headless,
                ignoreHTTPSErrors: true,
            } as any);

            const page = await browser.newPage();

            // 1. Stealth & Anti-Bot
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

            const baseUrl = domain.startsWith('http') ? domain : `https://${domain}`;
            console.log(`[UniversalCrawler] Navigating to ${baseUrl}`);

            await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: this.timeout });

            // 2. Cookie Banner Smashing
            await this.smashCookieBanners(page);

            // 3. Smart Interaction (Scroll to bottom to trigger lazy footers)
            await this.autoScroll(page);

            // 4. Extract Links (Prioritize Footer)
            const links = await this.extractLinks(page);

            // 5. Score Candidates
            const candidates = this.scoreLinks(links, baseUrl);
            console.log(`[UniversalCrawler] Found ${candidates.length} candidates. Top:`, candidates[0]?.url);

            // 6. Visit Top Candidates (Retry Loop)
            for (const candidate of candidates.slice(0, 5)) {
                if (this.visited.has(candidate.url)) continue;
                this.visited.add(candidate.url);

                try {
                    console.log(`[UniversalCrawler] Verifying candidate: ${candidate.url}`);
                    const result = await this.verifyCandidate(page, candidate);
                    if (result) return result;
                } catch (e) {
                    console.error(`[UniversalCrawler] Failed to visit candidate ${candidate.url}`, e);
                }
            }

            return null;

        } catch (error) {
            console.error("[UniversalCrawler] Crawl failed:", error);
            return null;
        } finally {
            if (browser) await browser.close();
        }
    }

    private async verifyCandidate(page: any, candidate: { url: string, score: number }): Promise<CrawlResult | null> {
        await page.goto(candidate.url, { waitUntil: 'domcontentloaded', timeout: 20000 });

        // Wait a bit for dynamic content
        await new Promise(r => setTimeout(r, 2000));

        // Extract HTML for Readability
        const html = await page.content();
        const doc = new JSDOM(html, { url: candidate.url });
        const reader = new Readability(doc.window.document);
        const article = reader.parse();

        let content = "";
        let title = await page.title();

        // Method A: Readability
        if (article && article.textContent && article.textContent.length > 500) {
            content = article.textContent;
            title = article.title || title;
        }
        // Method B: Brute Force Body
        else {
            content = await page.evaluate(() => document.body.innerText);
        }

        // Validate Content
        if (isGarbageContent(content)) {
            console.log(`[UniversalCrawler] Rejected garbage content for ${candidate.url}`);
            return null;
        }

        const validation = validatePolicyContent(content);
        if (!validation.isValid) {
            console.log(`[UniversalCrawler] Rejected invalid content for ${candidate.url}: ${validation.reason}`);
            return null;
        }

        const type = this.classifyContent(content);
        if (type !== 'other') {
            return {
                url: candidate.url,
                title,
                content, // Cleaned content
                score: candidate.score,
                type
            };
        }

        return null;
    }

    private async smashCookieBanners(page: any) {
        try {
            const commonSelectors = [
                '#onetrust-accept-btn-handler',
                '.cc-btn.cc-dismiss',
                '[aria-label="Accept cookies"]',
                'button[contains(text(), "Accept")]',
                'button[contains(text(), "Agree")]',
                '#accept-cookies',
                '.cookie-banner-accept'
            ];

            for (const selector of commonSelectors) {
                const button = await page.$(selector);
                if (button) {
                    console.log(`[UniversalCrawler] Smashing cookie banner: ${selector}`);
                    await button.click();
                    await new Promise(r => setTimeout(r, 1000)); // Wait for animation
                    break;
                }
            }
        } catch (e) {
            // Ignore errors here, it's just an optimization
        }
    }

    private async autoScroll(page: any) {
        await page.evaluate(async () => {
            await new Promise<void>((resolve) => {
                let totalHeight = 0;
                const distance = 100;
                const timer = setInterval(() => {
                    const scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;

                    if (totalHeight >= scrollHeight - window.innerHeight) {
                        clearInterval(timer);
                        resolve();
                    }
                }, 100);
            });
        });
    }

    private async extractLinks(page: any) {
        return await page.evaluate(() => {
            const footer = document.querySelector('footer');
            const footerLinks = footer ? Array.from(footer.querySelectorAll('a')) : [];
            const allLinks = Array.from(document.querySelectorAll('a'));

            return allLinks.map(a => ({
                href: a.href,
                text: a.innerText.toLowerCase(),
                isVisible: a.offsetParent !== null,
                isFooter: footerLinks.includes(a)
            }));
        });
    }

    private scoreLinks(links: any[], baseUrl: string): { url: string, score: number }[] {
        const candidates: { url: string, score: number }[] = [];
        const seen = new Set<string>();

        for (const link of links) {
            if (!link.href || seen.has(link.href)) continue;
            seen.add(link.href);

            // Normalize
            let fullUrl;
            try {
                fullUrl = new URL(link.href, baseUrl).toString();
            } catch { continue; }

            // Skip if it matches negative keywords (unless it's the only option, but for now strict)
            if (this.negativeKeywords.some(k => fullUrl.includes(k))) continue;

            let score = 0;
            const urlLower = fullUrl.toLowerCase();
            const textLower = link.text;

            // English Priority
            if (urlLower.includes('/en/') || urlLower.includes('en-us')) score += 50;
            if (urlLower.includes('/de/') || urlLower.includes('/fr/')) score -= 20;

            // Keyword Matching
            if (this.privacyKeywords.some(k => urlLower.includes(k) || textLower.includes(k))) score += 40;
            if (this.termsKeywords.some(k => urlLower.includes(k) || textLower.includes(k))) score += 20;
            if (this.legalKeywords.some(k => urlLower.includes(k) || textLower.includes(k))) score += 10;

            // Footer Boost
            if (link.isFooter) score += 30;

            // Visibility Boost
            if (link.isVisible) score += 5;

            if (score > 0) {
                candidates.push({ url: fullUrl, score });
            }
        }

        return candidates.sort((a, b) => b.score - a.score);
    }

    private classifyContent(text: string): 'privacy' | 'terms' | 'other' {
        const lower = text.toLowerCase().substring(0, 5000); // Check first 5000 chars
        let privacyScore = 0;
        let termsScore = 0;

        this.privacyKeywords.forEach(k => { if (lower.includes(k)) privacyScore++; });
        this.termsKeywords.forEach(k => { if (lower.includes(k)) termsScore++; });

        if (privacyScore > 2) return 'privacy';
        if (termsScore > 2) return 'terms';
        return 'other';
    }
}
