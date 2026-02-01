import { fetchResource } from './fetcher';
import { cleanHtml } from './cleaner';
import { parseContent } from './parser';
import { convertToMarkdown } from './markdown';
import { parsePdf } from './pdf';
import { logger } from '../logger';

export interface ExtractedPolicy {
    title: string;
    markdown: string;
    rawLength: number;
    url: string;
    contentType?: string;
}

export async function extractPolicyContent(url: string): Promise<ExtractedPolicy> {
    logger.info(`[extractPolicyContent] Starting extraction from ${url}`);

    let rawHtml: string = '';
    let contentType: string = 'text/html';
    let buffer: Buffer | undefined;

    try {
        const result = await fetchResource(url);
        rawHtml = result.body;
        contentType = result.contentType;
        buffer = result.buffer;
        logger.debug(`[extractPolicyContent] Fetched resource`, {
            length: rawHtml.length,
            contentType,
            bufferSize: buffer?.length
        });
    } catch (fetchError: any) {
        logger.error(`[extractPolicyContent] Failed to fetch resource from ${url}`, {
            error: fetchError?.message
        });
        throw fetchError;
    }

    // Handle PDF content
    if (contentType.includes('application/pdf') || url.toLowerCase().endsWith('.pdf')) {
        logger.info(`[extractPolicyContent] Detected PDF content for ${url}`);

        try {
            if (!buffer) {
                throw new Error('PDF content fetched but no buffer available');
            }

            const pdfText = await parsePdf(buffer);

            if (pdfText.length < 100) {
                throw new Error(`Extracted PDF text is too short (${pdfText.length} chars)`);
            }

            return {
                title: 'Privacy Policy (PDF)',
                markdown: pdfText,
                rawLength: pdfText.length,
                url: url,
                contentType: 'application/pdf'
            };
        } catch (pdfError: any) {
            logger.error(`[extractPolicyContent] Failed to parse PDF`, { error: pdfError?.message });
            throw new Error(`Failed to parse PDF content: ${pdfError?.message}`);
        }
    }

    // Handle HTML content (default)
    let cleanedHtml: string;
    try {
        cleanedHtml = cleanHtml(rawHtml);
        logger.debug(`[extractPolicyContent] Cleaned HTML`, { length: cleanedHtml.length });
    } catch (cleanError: any) {
        logger.error(`[extractPolicyContent] Failed to clean HTML`, { error: cleanError?.message });
        throw new Error(`Failed to process page content: ${cleanError?.message}`);
    }

    let parsed;
    try {
        parsed = parseContent(cleanedHtml, url);
        logger.debug(`[extractPolicyContent] Parsed content`, {
            title: parsed.title,
            length: parsed.length
        });
    } catch (parseError: any) {
        logger.error(`[extractPolicyContent] Failed to parse content`, { error: parseError?.message });
        throw new Error(`Failed to parse page content: ${parseError?.message}`);
    }

    let markdown: string;
    try {
        markdown = convertToMarkdown(parsed.content);
        logger.debug(`[extractPolicyContent] Converted to markdown`, { length: markdown.length });
    } catch (mdError: any) {
        logger.error(`[extractPolicyContent] Failed to convert to markdown`, { error: mdError?.message });
        throw new Error(`Failed to convert content: ${mdError?.message}`);
    }

    // Check if URL strongly indicates a privacy policy (lower threshold for these)
    const lowerUrl = url.toLowerCase();
    const isPrivacyUrl =
        lowerUrl.includes('/privacy') ||
        lowerUrl.includes('/datenschutz') ||
        lowerUrl.includes('/confidentialite') ||
        lowerUrl.includes('privacy-policy') ||
        lowerUrl.includes('data-protection');

    // Use lower threshold for known privacy URLs (may be JS-rendered with minimal SSR content)
    const minMarkdownLength = isPrivacyUrl ? 100 : 300;

    if (markdown.length < minMarkdownLength) {
        logger.error(`[extractPolicyContent] Content too short`, {
            markdownLength: markdown.length,
            url,
            title: parsed.title,
            rawHtmlLength: rawHtml.length,
            minRequired: minMarkdownLength
        });
        throw new Error(`Extracted content is too short (${markdown.length} chars). The page may be a redirect, require authentication, or use JavaScript rendering not supported by server-side extraction.`);
    }

    logger.info(`[extractPolicyContent] Successfully extracted content from ${url}`, {
        title: parsed.title,
        markdownLength: markdown.length
    });

    return {
        title: parsed.title,
        markdown: markdown,
        rawLength: parsed.length,
        url: url,
        contentType: 'text/html'
    };
}
