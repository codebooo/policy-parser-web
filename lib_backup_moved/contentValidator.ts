export function validatePolicyContent(text: string): { isValid: boolean; reason?: string } {
    if (!text || text.length < 500) {
        return { isValid: false, reason: "Content too short (< 500 chars)" };
    }

    const lower = text.toLowerCase();
    const keywords = ['privacy', 'data', 'personal information', 'collect', 'share', 'cookies', 'rights', 'contact us', 'policy', 'terms'];
    let keywordCount = 0;
    keywords.forEach(k => {
        if (lower.includes(k)) keywordCount++;
    });

    if (keywordCount < 3) {
        return { isValid: false, reason: "Low keyword density (not a policy)" };
    }

    // Link density check (heuristic: if > 50% of lines are short links, it's a nav menu)
    // This is a rough approximation since we don't have the HTML structure here, 
    // but we can check for "Menu-like" patterns if needed. 
    // For now, let's rely on the text length and keywords.

    return { isValid: true };
}

export function isGarbageContent(text: string): boolean {
    const lower = text.toLowerCase();
    const garbagePhrases = [
        "enable javascript",
        "browser not supported",
        "please update your browser",
        "access denied",
        "403 forbidden",
        "404 not found",
        "captcha",
        "verify you are human",
        "click here to continue"
    ];

    return garbagePhrases.some(phrase => lower.includes(phrase) && text.length < 1000);
}
