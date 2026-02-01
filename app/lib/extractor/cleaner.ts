import * as cheerio from 'cheerio';

export function cleanHtml(html: string): string {
    const $ = cheerio.load(html);

    // Remove unwanted elements
    $('script, style, nav, footer, iframe, object, embed, .cookie-banner, .popup, .ad, .advertisement').remove();

    // Remove empty elements
    $('div, span, p').each((i, el) => {
        if ($(el).text().trim().length === 0) {
            $(el).remove();
        }
    });

    return $.html();
}
