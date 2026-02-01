import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import TurndownService from 'turndown';
import fs from 'fs';

interface CrawlResult {
    url: string;
    title: string;
    content: string; // Markdown content
    score: number;
    type: 'privacy' | 'terms' | 'other';
}

export class PuppeteerCrawler {
    private timeout = 30000; // 30s timeout
    private turndownService: TurndownService;

    constructor() {
        this.turndownService = new TurndownService({
            headingStyle: 'atx',
            codeBlockStyle: 'fenced'
        });
        // Remove scripts, styles, etc.
        this.turndownService.remove(['script', 'style', 'nav', 'footer', 'iframe', 'form', 'button']);
    }

    async fetchAndProcess(url: string): Promise<CrawlResult | null> {
        let browser = null;
        try {
            let executablePath = null;

            // Try local Chrome first (better for dev)
            const paths = [
                'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
                'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
                '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
                '/usr/bin/google-chrome',
                '/usr/bin/chromium-browser'
            ];

            for (const p of paths) {
                if (fs.existsSync(p)) {
                    executablePath = p;
                    break;
                }
            }

            // Fallback to @sparticuz/chromium (for Lambda/Production)
            if (!executablePath) {
                executablePath = await chromium.executablePath();
            }

            if (!executablePath) {
                throw new Error("Could not find Chrome executable. Please install Chrome or Chromium.");
            }

            browser = await puppeteer.launch({
                args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox'],
                defaultViewport: { width: 1920, height: 1080 },
                executablePath: executablePath,
                headless: true,
                ignoreHTTPSErrors: true,
            } as any);

            const page = await browser.newPage();
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            
            console.log(`[Puppeteer] Fetching ${url}`);
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: this.timeout });

            // Smart Scroll to load lazy content
            await this.autoScroll(page);

            // Get HTML
            const html = await page.content();
            
            // Parse with Readability
            const doc = new JSDOM(html, { url });
            const reader = new Readability(doc.window.document);
            const article = reader.parse();

            if (!article || !article.content) {
                console.log("[Puppeteer] Readability failed to parse article.");
                return null;
            }

            // Convert to Markdown
            const markdown = this.turndownService.turndown(article.content);
            
            // Basic Validation
            if (markdown.length < 500) {
                console.log("[Puppeteer] Content too short.");
                return null;
            }

            const type = this.classifyContent(markdown);
            if (type === 'other') {
                console.log("[Puppeteer] Content classified as 'other'.");
                // return null; // Strict mode? Or return anyway? Let's return it but with low score.
            }

            return {
                url,
                title: article.title || await page.title(),
                content: markdown,
                score: 100, // We assume search gave us a good URL
                type
            };

        } catch (error) {
            console.error("[Puppeteer] Error:", error);
            return null;
        } finally {
            if (browser) await browser.close();
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

                    if (totalHeight >= scrollHeight - window.innerHeight || totalHeight > 5000) { // Limit scroll
                        clearInterval(timer);
                        resolve();
                    }
                }, 50);
            });
        });
    }

    private classifyContent(text: string): 'privacy' | 'terms' | 'other' {
        const lower = text.toLowerCase().substring(0, 2000);
        if (lower.includes('privacy') || lower.includes('data protection')) return 'privacy';
        if (lower.includes('terms') || lower.includes('conditions')) return 'terms';
        return 'other';
    }
}
