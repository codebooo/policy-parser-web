import * as cheerio from 'cheerio';
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

interface AnalysisChunk {
    id: string;
    title: string;
    content: string;
    risks: any[];
    summary: string;
}

export class AdvancedAnalyzer {
    private model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

    /**
     * Step 8: Noise Filtration Engine
     * Uses cheerio to strip clutter (Vercel-compatible replacement for jsdom+Readability).
     */
    public cleanText(html: string, url: string): string {
        const $ = cheerio.load(html);
        
        // Remove non-content elements
        $('script, style, noscript, meta, link, svg, iframe, nav, header, footer, aside, .nav, .header, .footer, .sidebar, .menu, .advertisement, .ad, .social-share').remove();
        
        // Try to find main content area
        const contentSelectors = ['main', 'article', '[role="main"]', '.content', '#content', '.main-content'];
        let textContent = '';
        
        for (const selector of contentSelectors) {
            const el = $(selector).first();
            if (el.length && el.text().trim().length > 200) {
                textContent = el.text().trim();
                break;
            }
        }
        
        // Fallback to body
        if (!textContent || textContent.length < 200) {
            textContent = $('body').text().trim();
        }
        
        // Clean up whitespace
        textContent = textContent.replace(/\s+/g, ' ').replace(/\n\s*\n/g, '\n').trim();
        
        return textContent;
    }

    /**
     * Step 9: Smart Semantic Chunking
     * Splits text by headers to preserve context.
     */
    public chunkText(text: string): { title: string, content: string }[] {
        const chunks: { title: string, content: string }[] = [];
        // Split by likely headers (lines that are short, uppercase, or end with colon, but not ending with punctuation like .)
        // This regex looks for double newlines followed by a short line that looks like a header
        const sections = text.split(/\n\s*\n(?=[A-Z0-9][^.!?]{0,100}(?:\n|$))/);

        let currentTitle = "Introduction";

        for (const section of sections) {
            const lines = section.split('\n');
            let title = currentTitle;
            let content = section;

            // If the first line is short, treat it as the title for this section
            if (lines[0].length < 100 && lines[0].length > 3) {
                title = lines[0].trim();
                content = lines.slice(1).join('\n').trim();
            }

            // If content is too large, split it further
            if (content.length > 8000) {
                const subChunks = content.match(/.{1,8000}(?:\s|$)/g) || [content];
                subChunks.forEach((sub, idx) => {
                    chunks.push({
                        title: `${title} (Part ${idx + 1})`,
                        content: sub.trim()
                    });
                });
            } else {
                chunks.push({ title, content });
            }

            // Update current title for next iteration if we found a good one
            if (title !== currentTitle) currentTitle = title;
        }

        return chunks.length > 0 ? chunks : [{ title: "Full Document", content: text }];
    }

    /**
     * Step 10: Map-Reduce Architecture
     */
    public async analyzeDocument(text: string, sourceUrl: string): Promise<any> {
        // 1. Clean (Assumes text is already cleaned or we pass HTML. For now, let's assume we get raw text from Puppeteer)

        // 2. Chunk
        const chunks = this.chunkText(text);
        console.log(`[Analyzer] Split document into ${chunks.length} chunks.`);

        // 3. Map (Analyze Chunks in Parallel)
        const chunkResults: AnalysisChunk[] = [];
        const batchSize = 5; // Increased batch size for speed

        for (let i = 0; i < chunks.length; i += batchSize) {
            const batch = chunks.slice(i, i + batchSize);
            const results = await Promise.all(batch.map((chunk, idx) => this.analyzeChunk(chunk, i + idx)));
            chunkResults.push(...results);
        }

        // 4. Reduce (Synthesize)
        const finalReport = await this.synthesizeReport(chunkResults, sourceUrl);

        // 5. Verify (The Quote Verifier)
        const verifiedReport = await this.verifyClaims(finalReport, text);

        // 6. Attach Full Text Sections for Frontend
        verifiedReport.fullTextSections = chunks.map((c, i) => ({
            id: `section-${i}`,
            title: c.title,
            content: c.content,
            summary: chunkResults[i]?.summary || "No summary available."
        }));

        return verifiedReport;
    }

    private async analyzeChunk(chunk: { title: string, content: string }, index: number): Promise<AnalysisChunk> {
        const prompt = `
            Analyze this section of a privacy policy.
            Title: ${chunk.title}
            Content: ${chunk.content.substring(0, 15000)}

            Return JSON:
            {
                "summary": "1 sentence summary",
                "risks": [
                    { "level": "high|medium|low", "title": "Risk Title", "description": "Risk Description" }
                ]
            }
        `;

        try {
            const result = await this.model.generateContent(prompt);
            const text = result.response.text();
            const json = JSON.parse(text.replace(/```json/g, "").replace(/```/g, "").trim());
            return {
                id: `chunk-${index}`,
                title: chunk.title,
                content: chunk.content,
                risks: json.risks || [],
                summary: json.summary
            };
        } catch (e) {
            console.error(`[Analyzer] Chunk ${index} failed`, e);
            return { id: `chunk-${index}`, title: chunk.title, content: chunk.content, risks: [], summary: "" };
        }
    }

    private async synthesizeReport(chunks: AnalysisChunk[], sourceUrl: string): Promise<any> {
        const allRisks = chunks.flatMap(c => c.risks);
        const summaries = chunks.map(c => c.summary).join(" ");

        const prompt = `
            Synthesize these analysis parts into a final report.
            
            Source URL: ${sourceUrl}
            Combined Summaries: ${summaries}
            Identified Risks: ${JSON.stringify(allRisks)}

            Return strict JSON matching this schema:
            {
                "summary": "Executive summary (3 sentences)",
                "privacyScore": number (0-100),
                "risks": [top 5 unique risks],
                "secureUsageRecommendations": [3 actionable tips],
                "bulletPoints": [
                    { "category": "Threat|Warning|Caution|Good|Brilliant", "text": "..." }
                ]
            }
        `;

        const result = await this.model.generateContent(prompt);
        const text = result.response.text();
        return JSON.parse(text.replace(/```json/g, "").replace(/```/g, "").trim());
    }

    /**
     * Step 11: The Quote Verifier
     * Cross-references high-risk claims against the full text to prevent hallucinations.
     */
    private async verifyClaims(report: any, fullText: string): Promise<any> {
        console.log("[Analyzer] Verifying claims...");
        const criticalClaims = [
            ...report.risks.filter((r: any) => r.level === 'high').map((r: any) => r.description),
            ...report.bulletPoints.filter((b: any) => b.category === 'Threat').map((b: any) => b.text)
        ];

        if (criticalClaims.length === 0) return report;

        // Check top 3 claims to save time
        const claimsToCheck = criticalClaims.slice(0, 3);

        const prompt = `
            You are a strict fact-checker.
            Document Text: ${fullText.substring(0, 25000)}...

            Claims to Verify:
            ${JSON.stringify(claimsToCheck)}

            For each claim, determine if it is supported by the text.
            If supported, return the claim.
            If NOT supported (hallucination), return NULL.

            Return JSON:
            {
                "verified_claims": ["claim 1", "claim 2"] 
            }
        `;

        try {
            const result = await this.model.generateContent(prompt);
            const json = JSON.parse(result.response.text().replace(/```json/g, "").replace(/```/g, "").trim());
            const validClaims = new Set(json.verified_claims);

            // Filter out risks/bullets that were not verified
            report.risks = report.risks.filter((r: any) => r.level !== 'high' || validClaims.has(r.description));
            report.bulletPoints = report.bulletPoints.filter((b: any) => b.category !== 'Threat' || validClaims.has(b.text));

            console.log(`[Analyzer] Verification complete. Retained ${validClaims.size}/${claimsToCheck.length} critical claims.`);
        } catch (e) {
            console.error("[Analyzer] Verification failed, skipping filtering.", e);
        }

        return report;
    }
}
