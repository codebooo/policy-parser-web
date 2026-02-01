import * as cheerio from 'cheerio';

export interface ParsedContent {
    title: string;
    content: string; // HTML content
    textContent: string;
    byline: string;
    length: number;
}

/**
 * Extract text directly from HTML by removing scripts/styles and getting body text.
 * Uses cheerio instead of jsdom for Vercel compatibility.
 */
function extractTextDirectly(html: string, url: string): ParsedContent {
    const $ = cheerio.load(html);

    // Get title
    const title = $('title').text() ||
        $('meta[property="og:title"]').attr('content') ||
        'Privacy Policy';

    // Remove script, style, noscript, and meta elements
    $('script, style, noscript, meta, link, svg, iframe').remove();

    // Get the cleaned text content
    let textContent = $('body').text() || '';

    // Clean up whitespace
    textContent = textContent
        .replace(/\s+/g, ' ')
        .replace(/\n\s*\n/g, '\n')
        .trim();

    // If text is mostly JSON/code, try to extract just the readable parts
    if (textContent.startsWith('{"require"') || textContent.includes('{"require":')) {
        // Facebook-style page - extract text after the JSON blobs
        const privacyStart = textContent.toLowerCase().indexOf('what is the privacy policy');
        if (privacyStart > -1) {
            textContent = textContent.slice(privacyStart);
        } else {
            // Try to find privacy-related content
            const patterns = [
                'we collect',
                'privacy policy',
                'your information',
                'personal data',
            ];
            for (const pattern of patterns) {
                const idx = textContent.toLowerCase().indexOf(pattern);
                if (idx > 0 && idx < 1000) {
                    textContent = textContent.slice(Math.max(0, idx - 100));
                    break;
                }
            }
        }
    }

    return {
        title,
        content: `<div>${textContent}</div>`, // Wrap in div for consistency
        textContent,
        byline: '',
        length: textContent.length
    };
}

/**
 * Enhanced content extraction using cheerio.
 * Attempts to extract the main readable content from the page.
 */
function extractReadableContent(html: string, url: string): ParsedContent | null {
    const $ = cheerio.load(html);

    // Get title
    const title = $('title').text() ||
        $('meta[property="og:title"]').attr('content') ||
        $('h1').first().text() ||
        'Privacy Policy';

    // Remove non-content elements
    $('script, style, noscript, meta, link, svg, iframe, nav, header, footer, aside, .nav, .header, .footer, .sidebar, .menu, .advertisement, .ad, .social-share').remove();

    // Try to find the main content area
    const contentSelectors = [
        'main',
        'article',
        '[role="main"]',
        '.content',
        '.main-content',
        '#content',
        '#main',
        '.post-content',
        '.entry-content',
        '.article-content',
        '.policy-content',
        '.privacy-policy',
    ];

    let contentHtml = '';
    let textContent = '';

    for (const selector of contentSelectors) {
        const el = $(selector).first();
        if (el.length && el.text().trim().length > 200) {
            contentHtml = el.html() || '';
            textContent = el.text().trim();
            break;
        }
    }

    // Fallback to body if no content area found
    if (!textContent || textContent.length < 200) {
        contentHtml = $('body').html() || '';
        textContent = $('body').text().trim();
    }

    // Clean up whitespace
    textContent = textContent
        .replace(/\s+/g, ' ')
        .replace(/\n\s*\n/g, '\n')
        .trim();

    if (textContent.length > 200) {
        return {
            title,
            content: contentHtml,
            textContent,
            byline: $('meta[name="author"]').attr('content') || '',
            length: textContent.length
        };
    }

    return null;
}

export function parseContent(html: string, url: string): ParsedContent {
    // First try enhanced readable content extraction
    try {
        const readable = extractReadableContent(html, url);

        if (readable && readable.textContent && readable.textContent.length > 200) {
            return readable;
        }
    } catch (e) {
        // Readable extraction failed, will use fallback
    }

    // Fallback: extract text directly (works for React apps like Facebook)
    const directExtract = extractTextDirectly(html, url);

    // Check if URL itself strongly indicates a privacy policy
    const lowerUrl = url.toLowerCase();
    const isPrivacyUrl =
        lowerUrl.includes('/privacy') ||
        lowerUrl.includes('/datenschutz') ||
        lowerUrl.includes('/confidentialite') ||
        lowerUrl.includes('/privacidad') ||
        lowerUrl.includes('privacy-policy') ||
        lowerUrl.includes('data-protection');

    // Lower threshold for pages with privacy-indicating URLs (JS-rendered sites)
    const minTextLength = isPrivacyUrl ? 100 : 200;

    // Verify we got meaningful content
    if (directExtract.textContent.length < minTextLength) {
        throw new Error('Failed to parse content: insufficient text extracted');
    }

    // Verify it looks like a privacy policy (multilingual support)
    const lower = directExtract.textContent.toLowerCase();
    const hasPrivacyContent =
        // English
        lower.includes('privacy') ||
        lower.includes('personal data') ||
        lower.includes('information we collect') ||
        lower.includes('data protection') ||
        lower.includes('gdpr') ||
        // German
        lower.includes('datenschutz') ||
        lower.includes('personenbezogene daten') ||
        lower.includes('daten') ||
        lower.includes('dsgvo') ||
        lower.includes('personendaten') ||
        // French
        lower.includes('confidentialité') ||
        lower.includes('confidentialite') ||
        lower.includes('données personnelles') ||
        lower.includes('donnees personnelles') ||
        lower.includes('rgpd') ||
        // Spanish
        lower.includes('privacidad') ||
        lower.includes('datos personales') ||
        lower.includes('protección de datos') ||
        lower.includes('proteccion de datos') ||
        // Dutch
        lower.includes('privacyverklaring') ||
        lower.includes('persoonsgegevens') ||
        lower.includes('gegevensbescherming') ||
        // Italian
        lower.includes('informativa sulla privacy') ||
        lower.includes('dati personali') ||
        // Portuguese
        lower.includes('privacidade') ||
        lower.includes('dados pessoais') ||
        // URL-based detection for pages that clearly are privacy policies
        url.toLowerCase().includes('privacy') ||
        url.toLowerCase().includes('datenschutz') ||
        url.toLowerCase().includes('confidentialite') ||
        url.toLowerCase().includes('privacidad');

    if (!hasPrivacyContent) {
        throw new Error('Failed to parse content: no privacy-related text found');
    }

    return directExtract;
}
