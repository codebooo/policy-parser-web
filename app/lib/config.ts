export const CONFIG = {
    MAX_RETRIES: 2,
    TIMEOUT_MS: 30000,
    USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',

    // Discovery - Standard paths for privacy policy (default)
    // IMPORTANT: These patterns cover 95%+ of websites
    // Most policies are linked in the footer of the main page
    STANDARD_PATHS: [
        '/privacy',
        '/privacy-policy',
        '/legal/privacy',
        '/legal/privacy-policy',
        '/about/privacy',
        '/policies/privacy',
        '/policy',
        '/privacy/policy',
        '/terms', // Sometimes combined
        '/data-protection',
        '/security',
        // Additional common patterns
        '/privacypolicy',
        '/privacy_policy',
        '/datenschutz', // German
        '/politique-de-confidentialite', // French
        '/privacidad', // Spanish
    ],

    // Common URL patterns where privacy policies are typically found
    // Used for discovery hints and footer link parsing
    PRIVACY_URL_PATTERNS: [
        // Direct path patterns
        /\/privacy/i,
        /\/privacypolicy/i,
        /\/privacy[_-]?policy/i,
        /\/data[_-]?protection/i,
        /\/legal\/privacy/i,
        /\/policies\/privacy/i,
        /\/about\/privacy/i,
        /\/help\/privacy/i,
        // Regional patterns
        /\/datenschutz/i, // German
        /\/privacidad/i, // Spanish
        /\/confidentialite/i, // French
        /\/privacy[_-]?notice/i,
        /\/privacy[_-]?statement/i,
        // Query parameter patterns
        /[?&]page=privacy/i,
        /[?&]p=privacy/i,
        /\/legal[?&#]/i,
    ] as RegExp[],

    // Footer link text patterns to look for
    // These are common link texts that lead to privacy policies
    FOOTER_LINK_PATTERNS: [
        'privacy policy',
        'privacy',
        'data protection',
        'datenschutz',
        'privacidad',
        'confidentialité',
        'privacy notice',
        'privacy statement',
        'your privacy',
        'our privacy',
        'privacy & cookies',
        'privacy and cookies',
        'legal',
        'terms & privacy',
        'terms and privacy',
    ] as string[],

    // Pro feature: Multiple policy types
    POLICY_TYPES: {
        privacy: {
            name: 'Privacy Policy',
            paths: [
                '/privacy',
                '/privacy-policy',
                '/legal/privacy',
                '/legal/privacy-policy',
                '/data-protection',
                '/privacypolicy',
                '/about/privacy',
                '/policies/privacy',
                '/privacy/policy',
                '/help/privacy',
                '/policy/privacy',
                '/privacy_policy',
                '/info/privacy',
                '/customer/privacy',
                '/corporate/privacy',
                '/site/privacy',
            ],
            keywords: ['privacy', 'personal data', 'data protection', 'data policy', 'information we collect', 'data we collect']
        },
        terms: {
            name: 'Terms of Service',
            paths: [
                '/terms',
                '/tos',
                '/terms-of-service',
                '/legal/terms',
                '/terms-and-conditions',
                '/termsofservice',
                '/user-agreement',
                '/policies/terms',
                '/about/terms',
                '/legal/tos',
                '/terms_of_service',
                '/terms-of-use',
                '/terms_and_conditions',
                '/eula',
            ],
            keywords: ['terms', 'service', 'agreement', 'conditions', 'user agreement', 'binding agreement']
        },
        cookies: {
            name: 'Cookie Policy',
            paths: [
                '/cookies',
                '/cookie-policy',
                '/legal/cookies',
                '/cookiepolicy',
                '/cookie-notice',
                '/policies/cookies',
                '/help/cookies',
                '/cookie_policy',
                '/cookies-policy',
            ],
            keywords: ['cookie', 'tracking', 'browser storage', 'local storage', 'tracking technologies']
        },
        security: {
            name: 'Security Policy',
            paths: [
                '/security',
                '/security-policy',
                '/legal/security',
                '/trust',
                '/trust-center',
                '/about/security',
                '/security-center',
                '/data-security',
            ],
            keywords: ['security', 'encryption', 'protection', 'secure', 'vulnerability', 'safeguards']
        },
        gdpr: {
            name: 'GDPR Notice',
            paths: [
                '/gdpr',
                '/legal/gdpr',
                '/eu-privacy',
                '/european-privacy',
                '/privacy/gdpr',
                '/privacy-eu',
                '/europe-privacy',
            ],
            keywords: ['gdpr', 'european', 'eu privacy', 'data subject', 'right to erasure', 'data portability']
        },
        ccpa: {
            name: 'CCPA Notice',
            paths: [
                '/ccpa',
                '/california-privacy',
                '/legal/ccpa',
                '/ca-privacy',
                '/your-privacy-choices',
                '/privacy/ccpa',
                '/do-not-sell',
                '/privacy-rights',
            ],
            keywords: ['ccpa', 'california', 'do not sell', 'consumer privacy', 'privacy rights', 'shine the light']
        },
        ai: {
            name: 'AI/ML Terms',
            paths: [
                '/ai-terms',
                '/ai-policy',
                '/machine-learning-policy',
                '/legal/ai',
                '/ai-guidelines',
                '/generative-ai-terms',
                '/ai-usage',
                '/ml-policy',
            ],
            keywords: ['artificial intelligence', 'machine learning', 'ai', 'model training', 'generative', 'large language model']
        },
        acceptable_use: {
            name: 'Acceptable Use Policy',
            paths: [
                '/acceptable-use',
                '/aup',
                '/legal/acceptable-use',
                '/usage-policy',
                '/community-guidelines',
                '/policies/community',
                '/community-standards',
                '/code-of-conduct',
            ],
            keywords: ['acceptable use', 'prohibited', 'content policy', 'guidelines', 'code of conduct']
        }
    } as const,

    // Scoring
    MIN_CONTENT_LENGTH: 500,
    REQUIRED_KEYWORDS: ['privacy', 'personal data', 'collection', 'information'],

    // Special domain handling - sites that require specific policy paths
    // because they redirect standard paths to login
    // NOTE: Meta domains require Googlebot User-Agent (handled in DirectFetchStrategy and fetcher)
    SPECIAL_DOMAINS: {
        'facebook.com': {
            privacy: 'https://www.facebook.com/privacy/policy/',
            terms: 'https://www.facebook.com/legal/terms',
        },
        'www.facebook.com': {
            privacy: 'https://www.facebook.com/privacy/policy/',
            terms: 'https://www.facebook.com/legal/terms',
        },
        'meta.com': {
            privacy: 'https://www.facebook.com/privacy/policy/',
        },
        'instagram.com': {
            privacy: 'https://privacycenter.instagram.com/policy',
            terms: 'https://help.instagram.com/581066165581870',
        },
        'threads.net': {
            privacy: 'https://help.instagram.com/515230437301944',
        },
        'whatsapp.com': {
            privacy: 'https://www.whatsapp.com/legal/privacy-policy',
            terms: 'https://www.whatsapp.com/legal/terms-of-service',
        },
        'twitter.com': {
            privacy: 'https://twitter.com/en/privacy',
            terms: 'https://twitter.com/en/tos',
        },
        'x.com': {
            privacy: 'https://x.com/en/privacy',
            terms: 'https://x.com/en/tos',
        },
        'tiktok.com': {
            privacy: 'https://www.tiktok.com/legal/page/row/privacy-policy/en',
            terms: 'https://www.tiktok.com/legal/page/row/terms-of-service/en',
        },
        'google.com': {
            privacy: 'https://policies.google.com/privacy',
            terms: 'https://policies.google.com/terms',
        },
        'youtube.com': {
            privacy: 'https://policies.google.com/privacy',
            terms: 'https://www.youtube.com/static?template=terms',
        },
        'linkedin.com': {
            privacy: 'https://www.linkedin.com/legal/privacy-policy',
            terms: 'https://www.linkedin.com/legal/user-agreement',
        },
        'amazon.com': {
            privacy: 'https://www.amazon.com/gp/help/customer/display.html?nodeId=468496',
            terms: 'https://www.amazon.com/gp/help/customer/display.html?nodeId=508088',
        },
        'microsoft.com': {
            privacy: 'https://privacy.microsoft.com/en-us/privacystatement',
            terms: 'https://www.microsoft.com/en-us/servicesagreement',
        },
        'apple.com': {
            privacy: 'https://www.apple.com/legal/privacy/',
            terms: 'https://www.apple.com/legal/internet-services/terms/site.html',
        },
        'ebay.com': {
            privacy: 'https://www.ebay.com/help/policies/member-behaviour-policies/user-privacy-notice-privacy-policy?id=4260',
            terms: 'https://www.ebay.com/help/policies/member-behaviour-policies/user-agreement?id=4259',
        },
        'www.ebay.com': {
            privacy: 'https://www.ebay.com/help/policies/member-behaviour-policies/user-privacy-notice-privacy-policy?id=4260',
            terms: 'https://www.ebay.com/help/policies/member-behaviour-policies/user-agreement?id=4259',
        },
        'paypal.com': {
            privacy: 'https://www.paypal.com/us/legalhub/privacy-full',
            terms: 'https://www.paypal.com/us/legalhub/useragreement-full',
        },
        'www.paypal.com': {
            privacy: 'https://www.paypal.com/us/legalhub/privacy-full',
            terms: 'https://www.paypal.com/us/legalhub/useragreement-full',
        },
        'netflix.com': {
            privacy: 'https://help.netflix.com/legal/privacy',
            terms: 'https://help.netflix.com/legal/termsofuse',
        },
        'www.netflix.com': {
            privacy: 'https://help.netflix.com/legal/privacy',
            terms: 'https://help.netflix.com/legal/termsofuse',
        },
        'spotify.com': {
            // Use US English locale paths to avoid geo-redirects to local language
            privacy: 'https://www.spotify.com/us/legal/privacy-policy/',
            terms: 'https://www.spotify.com/us/legal/end-user-agreement/',
            cookies: 'https://www.spotify.com/us/legal/cookies-policy/',
            acceptable_use: 'https://www.spotify.com/us/legal/user-guidelines/',
            // GDPR, CCPA, Security, and AI are covered in the main privacy policy
        },
        'www.spotify.com': {
            // Use US English locale paths to avoid geo-redirects to local language
            privacy: 'https://www.spotify.com/us/legal/privacy-policy/',
            terms: 'https://www.spotify.com/us/legal/end-user-agreement/',
            cookies: 'https://www.spotify.com/us/legal/cookies-policy/',
            acceptable_use: 'https://www.spotify.com/us/legal/user-guidelines/',
        },
        'discord.com': {
            privacy: 'https://discord.com/privacy',
            terms: 'https://discord.com/terms',
        },
        'reddit.com': {
            privacy: 'https://www.reddit.com/policies/privacy-policy',
            terms: 'https://www.redditinc.com/policies/user-agreement',
        },
        'www.reddit.com': {
            privacy: 'https://www.reddit.com/policies/privacy-policy',
            terms: 'https://www.redditinc.com/policies/user-agreement',
        },
        'twitch.tv': {
            privacy: 'https://www.twitch.tv/p/legal/privacy-notice/',
            terms: 'https://www.twitch.tv/p/legal/terms-of-service/',
        },
        'www.twitch.tv': {
            privacy: 'https://www.twitch.tv/p/legal/privacy-notice/',
            terms: 'https://www.twitch.tv/p/legal/terms-of-service/',
        },
        'openai.com': {
            privacy: 'https://openai.com/policies/privacy-policy',
            terms: 'https://openai.com/policies/terms-of-use',
        },
        'www.openai.com': {
            privacy: 'https://openai.com/policies/privacy-policy',
            terms: 'https://openai.com/policies/terms-of-use',
        },
        'zoom.us': {
            privacy: 'https://explore.zoom.us/en/privacy/',
            terms: 'https://explore.zoom.us/en/terms/',
        },
        'dropbox.com': {
            privacy: 'https://www.dropbox.com/privacy',
            terms: 'https://www.dropbox.com/terms',
        },
        'uber.com': {
            privacy: 'https://www.uber.com/legal/en/document/?name=privacy-notice',
            terms: 'https://www.uber.com/legal/en/document/?name=general-terms-of-use',
        },
        'airbnb.com': {
            privacy: 'https://www.airbnb.com/help/article/2855',
            terms: 'https://www.airbnb.com/help/article/2908',
        },
        'www.airbnb.com': {
            privacy: 'https://www.airbnb.com/help/article/2855',
            terms: 'https://www.airbnb.com/help/article/2908',
        },
        // Steam/Valve URLs - these are NOT at steampowered.com/privacy, they're at store.steampowered.com/privacy_agreement
        'steampowered.com': {
            privacy: 'https://store.steampowered.com/privacy_agreement/',
            terms: 'https://store.steampowered.com/subscriber_agreement/',
            cookies: 'https://store.steampowered.com/legal/',
        },
        'store.steampowered.com': {
            privacy: 'https://store.steampowered.com/privacy_agreement/',
            terms: 'https://store.steampowered.com/subscriber_agreement/',
            cookies: 'https://store.steampowered.com/legal/',
        },
        'www.steampowered.com': {
            privacy: 'https://store.steampowered.com/privacy_agreement/',
            terms: 'https://store.steampowered.com/subscriber_agreement/',
            cookies: 'https://store.steampowered.com/legal/',
        },
        'steamcommunity.com': {
            privacy: 'https://store.steampowered.com/privacy_agreement/',
            terms: 'https://store.steampowered.com/subscriber_agreement/',
        },
        // German Banks - specific privacy policy paths
        'berenberg.de': {
            privacy: 'https://www.berenberg.de/datenschutz/datenschutzerklaerung/',
        },
        'www.berenberg.de': {
            privacy: 'https://www.berenberg.de/datenschutz/datenschutzerklaerung/',
        },
        'deutsche-bank.de': {
            privacy: 'https://www.deutsche-bank.de/pk/footer/datenschutzhinweise.html',
        },
        'commerzbank.de': {
            privacy: 'https://www.commerzbank.de/de/footer/datenschutz.html',
        },
        'iphh.net': {
            privacy: 'https://www.iphh.net/de/datenschutz.html',
        },
        'www.iphh.net': {
            privacy: 'https://www.iphh.net/de/datenschutz.html',
        },
        // B&H Photo - privacy policy is embedded in Policies.jsp with anchor
        'bhphotovideo.com': {
            privacy: 'https://www.bhphotovideo.com/find/HelpCenter/Policies.jsp#privacySecurity',
            terms: 'https://www.bhphotovideo.com/find/HelpCenter/Policies.jsp',
            cookies: 'https://www.bhphotovideo.com/find/HelpCenter/Policies.jsp#cookiesNotice',
        },
        'www.bhphotovideo.com': {
            privacy: 'https://www.bhphotovideo.com/find/HelpCenter/Policies.jsp#privacySecurity',
            terms: 'https://www.bhphotovideo.com/find/HelpCenter/Policies.jsp',
            cookies: 'https://www.bhphotovideo.com/find/HelpCenter/Policies.jsp#cookiesNotice',
        },
        // Xiaomi - uses JS-heavy site, global URL has static content
        'mi.com': {
            privacy: 'https://privacy.mi.com/all/en_US/',
        },
        'www.mi.com': {
            privacy: 'https://privacy.mi.com/all/en_US/',
        },
    } as Record<string, Partial<Record<string, string>>>,
};

export type PolicyType = keyof typeof CONFIG.POLICY_TYPES;
