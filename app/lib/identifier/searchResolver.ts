import got from 'got';
import * as cheerio from 'cheerio';
import { CONFIG } from '../config';
import { logger } from '../logger';
import { deepLogger } from '../deepLogger';
import { isBlockedDomain } from '../discovery/domainValidator';

/**
 * Search result from a single engine
 */
interface SearchResult {
    engine: 'google' | 'bing' | 'duckduckgo';
    domain: string | null;
    url: string | null;
    confidence: number;
    responseTime: number;
    error?: string;
}

/**
 * Verified domain result from multi-engine search
 */
interface VerifiedDomain {
    domain: string;
    confidence: number;
    sources: string[];
    consensusScore: number;
}

/**
 * Common company name to domain mappings for popular services.
 * This provides a fallback when search engines block requests.
 * 
 * EXPANDED to include international banks and companies
 */
const KNOWN_COMPANIES: Record<string, string> = {
    // ============================================
    // BANKS & FINANCIAL INSTITUTIONS (International)
    // ============================================
    // German Banks
    'berenberg': 'berenberg.de',
    'berenberg bank': 'berenberg.de',
    'deutsche bank': 'deutsche-bank.de',
    'deutschebank': 'deutsche-bank.de',
    'commerzbank': 'commerzbank.de',
    'sparkasse': 'sparkasse.de',
    'dkb': 'dkb.de',
    'ing diba': 'ing.de',
    'ingdiba': 'ing.de',
    'n26': 'n26.com',
    'comdirect': 'comdirect.de',
    'targobank': 'targobank.de',
    'postbank': 'postbank.de',
    'hypovereinsbank': 'hypovereinsbank.de',
    'hvb': 'hypovereinsbank.de',
    'landesbank': 'lbbw.de',
    'lbbw': 'lbbw.de',
    'helaba': 'helaba.de',
    'kfw': 'kfw.de',
    
    // Swiss Banks
    'ubs': 'ubs.com',
    'credit suisse': 'credit-suisse.com',
    'creditsuisse': 'credit-suisse.com',
    'julius baer': 'juliusbaer.com',
    'juliusbaer': 'juliusbaer.com',
    'pictet': 'pictet.com',
    'lombard odier': 'lombardodier.com',
    
    // UK Banks
    'barclays': 'barclays.co.uk',
    'hsbc': 'hsbc.com',
    'lloyds': 'lloydsbank.com',
    'natwest': 'natwest.com',
    'rbs': 'rbs.co.uk',
    'santander': 'santander.co.uk',
    'halifax': 'halifax.co.uk',
    'nationwide': 'nationwide.co.uk',
    'monzo': 'monzo.com',
    'revolut': 'revolut.com',
    'starling': 'starlingbank.com',
    
    // French Banks
    'bnp paribas': 'bnpparibas.com',
    'bnpparibas': 'bnpparibas.com',
    'societe generale': 'societegenerale.com',
    'societegenerale': 'societegenerale.com',
    'credit agricole': 'credit-agricole.com',
    'creditagricole': 'credit-agricole.com',
    'la banque postale': 'labanquepostale.fr',
    
    // Spanish Banks
    'santander spain': 'santander.com',
    'banco santander': 'santander.com',
    'bbva': 'bbva.com',
    'caixabank': 'caixabank.com',
    'sabadell': 'bancsabadell.com',
    
    // Italian Banks
    'unicredit': 'unicredit.it',
    'intesa sanpaolo': 'intesasanpaolo.com',
    'intesasanpaolo': 'intesasanpaolo.com',
    'banca mediolanum': 'bancamediolanum.it',
    
    // Dutch Banks
    'ing': 'ing.com',
    'rabobank': 'rabobank.com',
    'abn amro': 'abnamro.com',
    'abnamro': 'abnamro.com',
    
    // Nordic Banks
    'nordea': 'nordea.com',
    'danske bank': 'danskebank.com',
    'danskebank': 'danskebank.com',
    'handelsbanken': 'handelsbanken.com',
    'seb': 'seb.se',
    'swedbank': 'swedbank.com',
    'dnb': 'dnb.no',
    
    // Japanese Banks
    'mufg': 'mufg.jp',
    'mitsubishi ufj': 'mufg.jp',
    'mizuho': 'mizuhogroup.com',
    'sumitomo mitsui': 'smfg.co.jp',
    'smbc': 'smbc.co.jp',
    
    // Chinese Banks
    'icbc': 'icbc.com.cn',
    'bank of china': 'boc.cn',
    'china construction bank': 'ccb.com',
    'agricultural bank of china': 'abchina.com',
    
    // Australian Banks
    'commonwealth bank': 'commbank.com.au',
    'commbank': 'commbank.com.au',
    'westpac': 'westpac.com.au',
    'anz': 'anz.com.au',
    'nab': 'nab.com.au',
    
    // Canadian Banks
    'rbc': 'rbc.com',
    'td bank': 'td.com',
    'scotiabank': 'scotiabank.com',
    'bmo': 'bmo.com',
    'cibc': 'cibc.com',
    'google': 'google.com',
    'youtube': 'youtube.com',
    'facebook': 'facebook.com',
    'meta': 'meta.com',
    'instagram': 'instagram.com',
    'twitter': 'twitter.com',
    'x': 'x.com',
    'reddit': 'reddit.com',
    'linkedin': 'linkedin.com',
    'discord': 'discord.com',
    'twitch': 'twitch.tv',
    'snapchat': 'snapchat.com',
    'pinterest': 'pinterest.com',
    'whatsapp': 'whatsapp.com',
    'telegram': 'telegram.org',
    'tiktok': 'tiktok.com',
    'tumblr': 'tumblr.com',
    'quora': 'quora.com',
    'mastodon': 'mastodon.social',
    'bluesky': 'bsky.app',
    
    // Tech Giants
    'amazon': 'amazon.com',
    'apple': 'apple.com',
    'microsoft': 'microsoft.com',
    'ibm': 'ibm.com',
    'oracle': 'oracle.com',
    'salesforce': 'salesforce.com',
    'sap': 'sap.com',
    'vmware': 'vmware.com',
    'cisco': 'cisco.com',
    
    // Productivity & Dev Tools
    'slack': 'slack.com',
    'zoom': 'zoom.us',
    'dropbox': 'dropbox.com',
    'github': 'github.com',
    'gitlab': 'gitlab.com',
    'bitbucket': 'bitbucket.org',
    'notion': 'notion.so',
    'figma': 'figma.com',
    'canva': 'canva.com',
    'adobe': 'adobe.com',
    'atlassian': 'atlassian.com',
    'jira': 'atlassian.com',
    'trello': 'trello.com',
    'asana': 'asana.com',
    'monday': 'monday.com',
    'airtable': 'airtable.com',
    'miro': 'miro.com',
    'webex': 'webex.com',
    'teams': 'microsoft.com',
    
    // E-Commerce & Marketplaces
    'ebay': 'ebay.com',
    'etsy': 'etsy.com',
    'shopify': 'shopify.com',
    'alibaba': 'alibaba.com',
    'aliexpress': 'aliexpress.com',
    'wish': 'wish.com',
    'mercari': 'mercari.com',
    'poshmark': 'poshmark.com',
    'depop': 'depop.com',
    'stockx': 'stockx.com',
    'goat': 'goat.com',
    'wayfair': 'wayfair.com',
    'overstock': 'overstock.com',
    'newegg': 'newegg.com',
    'zappos': 'zappos.com',
    'chewy': 'chewy.com',
    
    // Retail
    'walmart': 'walmart.com',
    'target': 'target.com',
    'costco': 'costco.com',
    'bestbuy': 'bestbuy.com',
    'homedepot': 'homedepot.com',
    'lowes': 'lowes.com',
    'ikea': 'ikea.com',
    'macys': 'macys.com',
    'nordstrom': 'nordstrom.com',
    'kohls': 'kohls.com',
    'jcpenney': 'jcpenney.com',
    'sears': 'sears.com',
    'cvs': 'cvs.com',
    'walgreens': 'walgreens.com',
    'riteaid': 'riteaid.com',
    
    // Fashion & Apparel
    'nike': 'nike.com',
    'adidas': 'adidas.com',
    'puma': 'puma.com',
    'underarmour': 'underarmour.com',
    'lululemon': 'lululemon.com',
    'gap': 'gap.com',
    'oldnavy': 'oldnavy.com',
    'hm': 'hm.com',
    'zara': 'zara.com',
    'uniqlo': 'uniqlo.com',
    'forever21': 'forever21.com',
    'shein': 'shein.com',
    
    // Streaming & Entertainment
    'netflix': 'netflix.com',
    'spotify': 'spotify.com',
    'hulu': 'hulu.com',
    'disney': 'disney.com',
    'disney+': 'disneyplus.com',
    'disneyplus': 'disneyplus.com',
    'hbo': 'hbo.com',
    'hbomax': 'max.com',
    'max': 'max.com',
    'paramount': 'paramount.com',
    'paramount+': 'paramountplus.com',
    'paramountplus': 'paramountplus.com',
    'peacock': 'peacocktv.com',
    'crunchyroll': 'crunchyroll.com',
    'funimation': 'funimation.com',
    'primevideo': 'primevideo.com',
    'appletv': 'tv.apple.com',
    'appletv+': 'tv.apple.com',
    'pandora': 'pandora.com',
    'soundcloud': 'soundcloud.com',
    'deezer': 'deezer.com',
    'tidal': 'tidal.com',
    'audible': 'audible.com',
    
    // Gaming
    'steam': 'steampowered.com',
    'epic': 'epicgames.com',
    'epicgames': 'epicgames.com',
    'playstation': 'playstation.com',
    'xbox': 'xbox.com',
    'nintendo': 'nintendo.com',
    'roblox': 'roblox.com',
    'minecraft': 'minecraft.net',
    'mojang': 'mojang.com',
    'valve': 'valvesoftware.com',
    'ea': 'ea.com',
    'electronicarts': 'ea.com',
    'activision': 'activision.com',
    'blizzard': 'blizzard.com',
    'ubisoft': 'ubisoft.com',
    'riot': 'riotgames.com',
    'riotgames': 'riotgames.com',
    'bethesda': 'bethesda.net',
    'rockstar': 'rockstargames.com',
    'take2': 'take2games.com',
    'squareenix': 'square-enix.com',
    'bandainamco': 'bandainamcoent.com',
    'capcom': 'capcom.com',
    'sega': 'sega.com',
    'konami': 'konami.com',
    
    // Hardware & Electronics
    'samsung': 'samsung.com',
    'sony': 'sony.com',
    'lg': 'lg.com',
    'dell': 'dell.com',
    'hp': 'hp.com',
    'lenovo': 'lenovo.com',
    'asus': 'asus.com',
    'acer': 'acer.com',
    'msi': 'msi.com',
    'razer': 'razer.com',
    'logitech': 'logitech.com',
    'corsair': 'corsair.com',
    'intel': 'intel.com',
    'amd': 'amd.com',
    'nvidia': 'nvidia.com',
    'qualcomm': 'qualcomm.com',
    'broadcom': 'broadcom.com',
    'western digital': 'westerndigital.com',
    'seagate': 'seagate.com',
    'kingston': 'kingston.com',
    'crucial': 'crucial.com',
    'bose': 'bose.com',
    'sonos': 'sonos.com',
    'jbl': 'jbl.com',
    'beats': 'beatsbydre.com',
    'gopro': 'gopro.com',
    'dji': 'dji.com',
    'garmin': 'garmin.com',
    'fitbit': 'fitbit.com',
    'ring': 'ring.com',
    'nest': 'nest.com',
    'philips': 'philips.com',
    'panasonic': 'panasonic.com',
    'canon': 'canon.com',
    'nikon': 'nikon.com',
    'fujifilm': 'fujifilm.com',
    
    // Transportation & Travel
    'uber': 'uber.com',
    'lyft': 'lyft.com',
    'doordash': 'doordash.com',
    'grubhub': 'grubhub.com',
    'ubereats': 'ubereats.com',
    'instacart': 'instacart.com',
    'postmates': 'postmates.com',
    'airbnb': 'airbnb.com',
    'booking': 'booking.com',
    'expedia': 'expedia.com',
    'tripadvisor': 'tripadvisor.com',
    'kayak': 'kayak.com',
    'priceline': 'priceline.com',
    'hotels': 'hotels.com',
    'vrbo': 'vrbo.com',
    'southwest': 'southwest.com',
    'delta': 'delta.com',
    'united': 'united.com',
    'american': 'aa.com',
    'jetblue': 'jetblue.com',
    'spirit': 'spirit.com',
    'frontier': 'flyfrontier.com',
    
    // Automotive
    'tesla': 'tesla.com',
    'ford': 'ford.com',
    'toyota': 'toyota.com',
    'bmw': 'bmw.com',
    'mercedes': 'mercedes-benz.com',
    'mercedesbenz': 'mercedes-benz.com',
    'volkswagen': 'volkswagen.com',
    'vw': 'volkswagen.com',
    'audi': 'audi.com',
    'porsche': 'porsche.com',
    'honda': 'honda.com',
    'nissan': 'nissanusa.com',
    'hyundai': 'hyundai.com',
    'kia': 'kia.com',
    'mazda': 'mazda.com',
    'subaru': 'subaru.com',
    'chevrolet': 'chevrolet.com',
    'chevy': 'chevrolet.com',
    'gm': 'gm.com',
    'jeep': 'jeep.com',
    'dodge': 'dodge.com',
    'ram': 'ramtrucks.com',
    'lexus': 'lexus.com',
    'acura': 'acura.com',
    'infiniti': 'infinitiusa.com',
    'volvo': 'volvocars.com',
    'rivian': 'rivian.com',
    'lucid': 'lucidmotors.com',
    
    // Finance & Banking
    'paypal': 'paypal.com',
    'stripe': 'stripe.com',
    'square': 'squareup.com',
    'visa': 'visa.com',
    'mastercard': 'mastercard.com',
    'amex': 'americanexpress.com',
    'americanexpress': 'americanexpress.com',
    'discover': 'discover.com',
    'chase': 'chase.com',
    'bankofamerica': 'bankofamerica.com',
    'bofa': 'bankofamerica.com',
    'wellsfargo': 'wellsfargo.com',
    'citi': 'citi.com',
    'citibank': 'citi.com',
    'capitalone': 'capitalone.com',
    'usbank': 'usbank.com',
    'pnc': 'pnc.com',
    'tdbank': 'td.com',
    'schwab': 'schwab.com',
    'fidelity': 'fidelity.com',
    'vanguard': 'vanguard.com',
    'etrade': 'etrade.com',
    'ameritrade': 'tdameritrade.com',
    'robinhood': 'robinhood.com',
    'webull': 'webull.com',
    'sofi': 'sofi.com',
    'chime': 'chime.com',
    'ally': 'ally.com',
    'marcus': 'marcus.com',
    'venmo': 'venmo.com',
    'cashapp': 'cash.app',
    'zelle': 'zellepay.com',
    'affirm': 'affirm.com',
    'klarna': 'klarna.com',
    'afterpay': 'afterpay.com',
    
    // Crypto
    'coinbase': 'coinbase.com',
    'binance': 'binance.com',
    'kraken': 'kraken.com',
    'gemini': 'gemini.com',
    'crypto': 'crypto.com',
    'cryptocom': 'crypto.com',
    'ftx': 'ftx.com',
    'blockchain': 'blockchain.com',
    'metamask': 'metamask.io',
    'opensea': 'opensea.io',
    
    // AI Companies
    'openai': 'openai.com',
    'chatgpt': 'openai.com',
    'anthropic': 'anthropic.com',
    'claude': 'anthropic.com',
    'midjourney': 'midjourney.com',
    'stability': 'stability.ai',
    'stablediffusion': 'stability.ai',
    'huggingface': 'huggingface.co',
    'cohere': 'cohere.com',
    'replicate': 'replicate.com',
    'runway': 'runwayml.com',
    'jasper': 'jasper.ai',
    'grammarly': 'grammarly.com',
    'copilot': 'github.com',
    'perplexity': 'perplexity.ai',
    
    // Cloud Providers
    'aws': 'aws.amazon.com',
    'azure': 'azure.microsoft.com',
    'gcp': 'cloud.google.com',
    'googlecloud': 'cloud.google.com',
    'digitalocean': 'digitalocean.com',
    'linode': 'linode.com',
    'vultr': 'vultr.com',
    'heroku': 'heroku.com',
    'vercel': 'vercel.com',
    'netlify': 'netlify.com',
    'cloudflare': 'cloudflare.com',
    'fastly': 'fastly.com',
    'akamai': 'akamai.com',
    
    // Food & Grocery
    'mcdonalds': 'mcdonalds.com',
    'starbucks': 'starbucks.com',
    'chipotle': 'chipotle.com',
    'subway': 'subway.com',
    'burgerking': 'bk.com',
    'wendys': 'wendys.com',
    'tacobell': 'tacobell.com',
    'kfc': 'kfc.com',
    'pizzahut': 'pizzahut.com',
    'dominos': 'dominos.com',
    'papajohns': 'papajohns.com',
    'dunkin': 'dunkindonuts.com',
    'chilis': 'chilis.com',
    'applebees': 'applebees.com',
    'olivegarden': 'olivegarden.com',
    'wholefoods': 'wholefoodsmarket.com',
    'traderjoes': 'traderjoes.com',
    'kroger': 'kroger.com',
    'safeway': 'safeway.com',
    'publix': 'publix.com',
    'aldi': 'aldi.us',
    'lidl': 'lidl.com',
    
    // Health & Fitness
    'peloton': 'onepeloton.com',
    'myfitnesspal': 'myfitnesspal.com',
    'strava': 'strava.com',
    'nike training': 'nike.com',
    'headspace': 'headspace.com',
    'calm': 'calm.com',
    'noom': 'noom.com',
    'orangetheory': 'orangetheory.com',
    'planetfitness': 'planetfitness.com',
    'equinox': 'equinox.com',
    '23andme': '23andme.com',
    'ancestry': 'ancestry.com',
    
    // News & Media
    'nytimes': 'nytimes.com',
    'newyorktimes': 'nytimes.com',
    'washingtonpost': 'washingtonpost.com',
    'wsj': 'wsj.com',
    'wallstreetjournal': 'wsj.com',
    'cnn': 'cnn.com',
    'foxnews': 'foxnews.com',
    'bbc': 'bbc.com',
    'reuters': 'reuters.com',
    'ap': 'apnews.com',
    'bloomberg': 'bloomberg.com',
    'forbes': 'forbes.com',
    'businessinsider': 'businessinsider.com',
    'techcrunch': 'techcrunch.com',
    'theverge': 'theverge.com',
    'wired': 'wired.com',
    'engadget': 'engadget.com',
    'arstechnica': 'arstechnica.com',
    'medium': 'medium.com',
    'substack': 'substack.com',
    
    // Education
    'coursera': 'coursera.org',
    'udemy': 'udemy.com',
    'linkedin learning': 'linkedin.com/learning',
    'skillshare': 'skillshare.com',
    'masterclass': 'masterclass.com',
    'khan academy': 'khanacademy.org',
    'khanacademy': 'khanacademy.org',
    'duolingo': 'duolingo.com',
    'chegg': 'chegg.com',
    'quizlet': 'quizlet.com',
    'canvas': 'instructure.com',
    'blackboard': 'blackboard.com',
    
    // Communication
    'gmail': 'google.com',
    'outlook': 'outlook.com',
    'yahoo': 'yahoo.com',
    'protonmail': 'proton.me',
    'proton': 'proton.me',
    'mailchimp': 'mailchimp.com',
    'sendgrid': 'sendgrid.com',
    'twilio': 'twilio.com',
    'intercom': 'intercom.com',
    'zendesk': 'zendesk.com',
    'freshdesk': 'freshdesk.com',
    'hubspot': 'hubspot.com',
    
    // Dating
    'tinder': 'tinder.com',
    'bumble': 'bumble.com',
    'hinge': 'hinge.co',
    'match': 'match.com',
    'okcupid': 'okcupid.com',
    'plentyoffish': 'pof.com',
    'pof': 'pof.com',
    'grindr': 'grindr.com',
    'eharmony': 'eharmony.com',
    
    // Other Popular
    'imgur': 'imgur.com',
    '9gag': '9gag.com',
    'buzzfeed': 'buzzfeed.com',
    'yelp': 'yelp.com',
    'glassdoor': 'glassdoor.com',
    'indeed': 'indeed.com',
    'monster': 'monster.com',
    'ziprecruiter': 'ziprecruiter.com',
    'upwork': 'upwork.com',
    'fiverr': 'fiverr.com',
    'taskrabbit': 'taskrabbit.com',
    'eventbrite': 'eventbrite.com',
    'meetup': 'meetup.com',
    'patreon': 'patreon.com',
    'kickstarter': 'kickstarter.com',
    'gofundme': 'gofundme.com',
    'wikipedia': 'wikipedia.org',
    'archive': 'archive.org',
    'craigslist': 'craigslist.org',
    'nextdoor': 'nextdoor.com',
};

export async function resolveCompanyToDomain(companyName: string): Promise<string | null> {
    const normalizedName = companyName.toLowerCase().trim().replace(/\s+/g, '');
    
    deepLogger.log('search', 'resolve_start', 'info', `Resolving company name to domain: ${companyName}`, {
        originalInput: companyName,
        normalizedName
    });
    
    // First, check known companies map (instant, no network)
    if (KNOWN_COMPANIES[normalizedName]) {
        const domain = KNOWN_COMPANIES[normalizedName];
        logger.info(`Found '${companyName}' in known companies map: ${domain}`);
        deepLogger.log('search', 'known_company_hit', 'info', `Found in known companies map`, {
            input: companyName,
            domain,
            matchType: 'exact'
        });
        return domain;
    }
    
    // Also check with spaces removed and common variations
    const variations = [
        normalizedName,
        normalizedName.replace(/[^a-z0-9]/g, ''), // Remove all non-alphanumeric
        normalizedName.replace(/-/g, ''),         // Remove hyphens
        normalizedName.replace(/_/g, ''),         // Remove underscores
    ];
    
    for (const variant of variations) {
        if (KNOWN_COMPANIES[variant]) {
            const domain = KNOWN_COMPANIES[variant];
            logger.info(`Found '${companyName}' via variant '${variant}': ${domain}`);
            deepLogger.log('search', 'known_company_hit', 'info', `Found via variant`, {
                input: companyName,
                variant,
                domain,
                matchType: 'variant'
            });
            return domain;
        }
    }

    deepLogger.log('search', 'known_company_miss', 'debug', `Not found in known companies, starting multi-engine search`, {
        input: companyName,
        variationsChecked: variations
    });

    // Use multi-engine verification for unknown companies
    const verifiedResult = await multiEngineVerification(companyName);
    
    if (verifiedResult) {
        deepLogger.log('search', 'multi_engine_success', 'info', `Multi-engine verification successful`, {
            input: companyName,
            domain: verifiedResult.domain,
            confidence: verifiedResult.confidence,
            consensusScore: verifiedResult.consensusScore,
            sources: verifiedResult.sources
        });
        return verifiedResult.domain;
    }

    // Final fallback: intelligent domain guessing
    deepLogger.log('search', 'fallback_guess', 'warn', `Multi-engine search failed, falling back to domain guessing`, {
        input: companyName
    });
    return guessDomain(companyName);
}

/**
 * MULTI-ENGINE VERIFICATION SYSTEM
 * Queries Google, Bing, and DuckDuckGo in parallel and compares results
 * to ensure we get the correct domain for a company name.
 */
async function multiEngineVerification(companyName: string): Promise<VerifiedDomain | null> {
    const searchTimer = deepLogger.time('multi_engine_search');
    
    deepLogger.log('search', 'multi_engine_start', 'info', `Starting multi-engine verification for: ${companyName}`, {
        companyName,
        engines: ['google', 'bing', 'duckduckgo']
    });

    // Run all searches in parallel
    const [googleResult, bingResult, duckduckgoResult] = await Promise.all([
        searchGoogle(companyName),
        searchBing(companyName),
        searchDuckDuckGo(companyName)
    ]);

    const results: SearchResult[] = [googleResult, bingResult, duckduckgoResult];
    
    // Log all results
    deepLogger.log('search', 'multi_engine_results', 'debug', `Search results collected`, {
        google: { domain: googleResult.domain, confidence: googleResult.confidence, error: googleResult.error },
        bing: { domain: bingResult.domain, confidence: bingResult.confidence, error: bingResult.error },
        duckduckgo: { domain: duckduckgoResult.domain, confidence: duckduckgoResult.confidence, error: duckduckgoResult.error }
    });

    // Filter successful results
    const successfulResults = results.filter(r => r.domain !== null);
    
    if (successfulResults.length === 0) {
        deepLogger.log('search', 'multi_engine_fail', 'warn', `All search engines failed`, {
            companyName,
            errors: results.map(r => ({ engine: r.engine, error: r.error }))
        });
        searchTimer();
        return null;
    }

    // Count domain occurrences
    const domainCounts: Record<string, { count: number; sources: string[]; totalConfidence: number }> = {};
    
    for (const result of successfulResults) {
        const domain = result.domain!.toLowerCase();
        if (!domainCounts[domain]) {
            domainCounts[domain] = { count: 0, sources: [], totalConfidence: 0 };
        }
        domainCounts[domain].count++;
        domainCounts[domain].sources.push(result.engine);
        domainCounts[domain].totalConfidence += result.confidence;
    }

    // Find the domain with highest consensus
    let bestDomain: string | null = null;
    let bestScore = 0;
    
    for (const [domain, data] of Object.entries(domainCounts)) {
        // Consensus score = (number of engines agreeing * 30) + average confidence
        const consensusScore = (data.count * 30) + (data.totalConfidence / data.count);
        
        deepLogger.log('search', 'consensus_calc', 'trace', `Calculating consensus for ${domain}`, {
            domain,
            engineCount: data.count,
            sources: data.sources,
            avgConfidence: data.totalConfidence / data.count,
            consensusScore
        });
        
        if (consensusScore > bestScore) {
            bestScore = consensusScore;
            bestDomain = domain;
        }
    }

    if (!bestDomain) {
        searchTimer();
        return null;
    }

    const duration = searchTimer();
    const bestData = domainCounts[bestDomain];
    
    // Calculate final confidence based on consensus
    // 3 engines agree = 100%, 2 agree = 85%, 1 = 60%
    const confidenceMultiplier = bestData.count === 3 ? 1.0 : bestData.count === 2 ? 0.85 : 0.6;
    const finalConfidence = Math.min(100, Math.round((bestData.totalConfidence / bestData.count) * confidenceMultiplier));

    deepLogger.log('search', 'multi_engine_complete', 'info', `Multi-engine verification complete`, {
        companyName,
        selectedDomain: bestDomain,
        enginesAgreed: bestData.count,
        sources: bestData.sources,
        consensusScore: bestScore,
        finalConfidence,
        duration
    });

    return {
        domain: bestDomain,
        confidence: finalConfidence,
        sources: bestData.sources,
        consensusScore: bestScore
    };
}

/**
 * Search Google for company domain
 */
async function searchGoogle(companyName: string): Promise<SearchResult> {
    const startTime = performance.now();
    const query = `${companyName} official website`;
    
    deepLogger.log('search', 'google_start', 'debug', `Google search: ${query}`, { query });
    
    try {
        // Use Google's I'm Feeling Lucky redirect (more reliable than scraping)
        const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&btnI=1`;
        
        const requestId = deepLogger.logHttpRequest('GET', url, {
            headers: { 'User-Agent': CONFIG.USER_AGENT }
        });
        
        const response = await got(url, {
            headers: {
                'User-Agent': CONFIG.USER_AGENT,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
            },
            timeout: { request: 8000 },
            followRedirect: true,
            throwHttpErrors: false,
            retry: { limit: 1 } as any
        });

        const responseTime = Math.round(performance.now() - startTime);
        
        deepLogger.logHttpResponse(requestId, url, response.statusCode, responseTime, {
            finalUrl: response.url,
            contentType: response.headers['content-type'] as string,
            contentLength: response.body?.length
        });

        // If we got redirected to a real site (not google)
        if (response.url && !response.url.includes('google.com')) {
            try {
                const parsedUrl = new URL(response.url);
                const domain = parsedUrl.hostname.replace(/^www\./, '');
                
                // CRITICAL: Skip blocked domains like LinkedIn, social media, etc.
                if (isBlockedDomain(response.url)) {
                    deepLogger.log('search', 'google_blocked', 'warn', `Google result blocked (social media/third-party): ${domain}`, { domain, url: response.url });
                } else {
                    deepLogger.logSearchQuery('google', query, {
                        success: true,
                        domain,
                        url: response.url,
                        responseTime
                    });
                    
                    return {
                        engine: 'google',
                        domain,
                        url: response.url,
                        confidence: 85,
                        responseTime
                    };
                }
            } catch {
                // URL parsing failed
            }
        }

        // Fallback: parse search results page
        if (response.statusCode === 200) {
            const $ = cheerio.load(response.body);
            
            // Try to find first non-blocked result link
            const allLinks = $('a[href^="http"]:not([href*="google"])');
            for (let i = 0; i < allLinks.length; i++) {
                const linkHref = $(allLinks[i]).attr('href');
                if (!linkHref) continue;
                
                // Skip blocked domains
                if (isBlockedDomain(linkHref)) {
                    deepLogger.log('search', 'google_skip_blocked', 'debug', `Skipping blocked result: ${linkHref}`);
                    continue;
                }
                
                try {
                    const parsedUrl = new URL(linkHref);
                    const domain = parsedUrl.hostname.replace(/^www\./, '');
                    
                    deepLogger.logSearchQuery('google', query, {
                        success: true,
                        domain,
                        url: linkHref,
                        responseTime
                    });
                    
                    return {
                        engine: 'google',
                        domain,
                        url: linkHref,
                        confidence: 70,
                        responseTime
                    };
                } catch {
                    // Continue to next link
                }
            }
        }

        deepLogger.logSearchQuery('google', query, {
            success: false,
            error: 'No results found',
            responseTime
        });

        return {
            engine: 'google',
            domain: null,
            url: null,
            confidence: 0,
            responseTime,
            error: 'No results found'
        };
    } catch (error: any) {
        const responseTime = Math.round(performance.now() - startTime);
        
        deepLogger.logSearchQuery('google', query, {
            success: false,
            error: error.message,
            responseTime
        });
        
        return {
            engine: 'google',
            domain: null,
            url: null,
            confidence: 0,
            responseTime,
            error: error.message
        };
    }
}

/**
 * Search Bing for company domain
 */
async function searchBing(companyName: string): Promise<SearchResult> {
    const startTime = performance.now();
    const query = `${companyName} official site`;
    
    deepLogger.log('search', 'bing_start', 'debug', `Bing search: ${query}`, { query });
    
    try {
        const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
        
        const requestId = deepLogger.logHttpRequest('GET', url, {
            headers: { 'User-Agent': CONFIG.USER_AGENT }
        });
        
        const response = await got(url, {
            headers: {
                'User-Agent': CONFIG.USER_AGENT,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
            },
            timeout: { request: 8000 },
            retry: { limit: 1 } as any,
            throwHttpErrors: false
        });

        const responseTime = Math.round(performance.now() - startTime);
        
        deepLogger.logHttpResponse(requestId, url, response.statusCode, responseTime, {
            contentType: response.headers['content-type'] as string,
            contentLength: response.body?.length
        });

        if (response.statusCode === 200) {
            const $ = cheerio.load(response.body);
            
            // Bing result links (multiple selectors for robustness)
            const selectors = [
                'li.b_algo h2 a',
                '.b_algo a',
                'h2 a[href^="http"]',
                'cite'
            ];
            
            // Iterate through all selectors and results to find first non-blocked domain
            for (const selector of selectors) {
                const elements = $(selector);
                
                for (let i = 0; i < elements.length; i++) {
                    const element = $(elements[i]);
                    let linkHref = element.attr('href') || element.text();
                    
                    if (linkHref && linkHref.startsWith('http')) {
                        try {
                            const parsedUrl = new URL(linkHref);
                            const domain = parsedUrl.hostname.replace(/^www\./, '');
                            
                            // Skip bing/microsoft domains
                            if (domain.includes('bing.') || domain.includes('microsoft.')) continue;
                            
                            // CRITICAL: Skip blocked domains like LinkedIn, social media, etc.
                            if (isBlockedDomain(linkHref)) {
                                deepLogger.log('search', 'bing_skip_blocked', 'debug', `Skipping blocked result: ${domain}`, { domain, url: linkHref });
                                continue;
                            }
                            
                            deepLogger.logSearchQuery('bing', query, {
                                success: true,
                                domain,
                                url: linkHref,
                                responseTime
                            });
                            
                            return {
                                engine: 'bing',
                                domain,
                                url: linkHref,
                                confidence: 80,
                                responseTime
                            };
                        } catch {
                            continue;
                        }
                    }
                }
            }
        }

        deepLogger.logSearchQuery('bing', query, {
            success: false,
            error: 'No results found',
            responseTime
        });

        return {
            engine: 'bing',
            domain: null,
            url: null,
            confidence: 0,
            responseTime,
            error: 'No results found'
        };
    } catch (error: any) {
        const responseTime = Math.round(performance.now() - startTime);
        
        deepLogger.logSearchQuery('bing', query, {
            success: false,
            error: error.message,
            responseTime
        });
        
        return {
            engine: 'bing',
            domain: null,
            url: null,
            confidence: 0,
            responseTime,
            error: error.message
        };
    }
}

/**
 * Search DuckDuckGo for company domain
 */
async function searchDuckDuckGo(companyName: string): Promise<SearchResult> {
    const startTime = performance.now();
    const query = `${companyName} official website`;
    
    deepLogger.log('search', 'duckduckgo_start', 'debug', `DuckDuckGo search: ${query}`, { query });
    
    try {
        const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
        
        const requestId = deepLogger.logHttpRequest('GET', url, {
            headers: { 'User-Agent': CONFIG.USER_AGENT }
        });
        
        const response = await got(url, {
            headers: {
                'User-Agent': CONFIG.USER_AGENT,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
            },
            timeout: { request: 8000 },
            retry: { limit: 1 } as any,
            throwHttpErrors: false
        });

        const responseTime = Math.round(performance.now() - startTime);
        
        deepLogger.logHttpResponse(requestId, url, response.statusCode, responseTime, {
            contentType: response.headers['content-type'] as string,
            contentLength: response.body?.length
        });

        if (response.statusCode === 200) {
            const $ = cheerio.load(response.body);
            
            // DuckDuckGo HTML version result links - iterate through all results
            const allResults = $('.result__a');
            
            for (let i = 0; i < allResults.length; i++) {
                const linkHref = $(allResults[i]).attr('href');
                
                if (linkHref) {
                    try {
                        // DuckDuckGo may use relative URLs
                        const fullUrl = linkHref.startsWith('//') ? `https:${linkHref}` : linkHref;
                        const parsedUrl = new URL(fullUrl);
                        const domain = parsedUrl.hostname.replace(/^www\./, '');
                        
                        // Skip duckduckgo domains
                        if (domain.includes('duckduckgo.')) {
                            continue;
                        }
                        
                        // CRITICAL: Skip blocked domains like LinkedIn, social media, etc.
                        if (isBlockedDomain(fullUrl)) {
                            deepLogger.log('search', 'duckduckgo_skip_blocked', 'debug', `Skipping blocked result: ${domain}`, { domain, url: fullUrl });
                            continue;
                        }
                        
                        deepLogger.logSearchQuery('duckduckgo', query, {
                            success: true,
                            domain,
                            url: fullUrl,
                            responseTime
                        });
                        
                        return {
                            engine: 'duckduckgo',
                            domain,
                            url: fullUrl,
                            confidence: 80,
                            responseTime
                        };
                    } catch {
                        // Continue to next result
                    }
                }
            }
        }

        deepLogger.logSearchQuery('duckduckgo', query, {
            success: false,
            error: 'No results found',
            responseTime
        });

        return {
            engine: 'duckduckgo',
            domain: null,
            url: null,
            confidence: 0,
            responseTime,
            error: 'No results found'
        };
    } catch (error: any) {
        const responseTime = Math.round(performance.now() - startTime);
        
        deepLogger.logSearchQuery('duckduckgo', query, {
            success: false,
            error: error.message,
            responseTime
        });
        
        return {
            engine: 'duckduckgo',
            domain: null,
            url: null,
            confidence: 0,
            responseTime,
            error: error.message
        };
    }
}

/**
 * Attempts to guess the domain from a company name.
 * Tries common TLDs and validates with DNS as a last resort.
 */
async function guessDomain(companyName: string): Promise<string | null> {
    const normalized = companyName
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]/g, ''); // Remove special characters
    
    deepLogger.log('search', 'guess_start', 'debug', `Starting domain guessing for: ${companyName}`, {
        normalized
    });
    
    // Common TLDs to try in order of likelihood
    const tlds = ['.com', '.net', '.org', '.io', '.co', '.app'];
    
    // Try each TLD
    for (const tld of tlds) {
        const domain = `${normalized}${tld}`;
        
        deepLogger.log('search', 'guess_try', 'trace', `Trying domain: ${domain}`, { domain, tld });
        
        // Quick DNS check using got to verify domain exists
        try {
            const requestId = deepLogger.logHttpRequest('HEAD', `https://${domain}`);
            const startTime = performance.now();
            
            await got.head(`https://${domain}`, {
                timeout: { request: 3000 },
                retry: { limit: 0 } as any,
                throwHttpErrors: false,
            });
            
            const responseTime = Math.round(performance.now() - startTime);
            deepLogger.logHttpResponse(requestId, `https://${domain}`, 200, responseTime);
            
            logger.info(`Domain guess verified: ${domain}`);
            deepLogger.log('search', 'guess_success', 'info', `Domain verified: ${domain}`, {
                domain,
                method: 'direct'
            });
            return domain;
        } catch {
            // Try www subdomain
            try {
                const requestId = deepLogger.logHttpRequest('HEAD', `https://www.${domain}`);
                const startTime = performance.now();
                
                await got.head(`https://www.${domain}`, {
                    timeout: { request: 3000 },
                    retry: { limit: 0 } as any,
                    throwHttpErrors: false,
                });
                
                const responseTime = Math.round(performance.now() - startTime);
                deepLogger.logHttpResponse(requestId, `https://www.${domain}`, 200, responseTime);
                
                logger.info(`Domain guess verified with www: ${domain}`);
                deepLogger.log('search', 'guess_success', 'info', `Domain verified with www: ${domain}`, {
                    domain,
                    method: 'www'
                });
                return domain;
            } catch {
                deepLogger.log('search', 'guess_fail', 'trace', `Domain not found: ${domain}`, { domain });
                // Domain doesn't exist, try next TLD
            }
        }
    }
    
    // If all else fails, just return the most likely .com
    const fallbackDomain = `${normalized}.com`;
    logger.info(`Guessing domain for '${companyName}': ${fallbackDomain} (unverified)`);
    deepLogger.log('search', 'guess_fallback', 'warn', `Using unverified fallback: ${fallbackDomain}`, {
        domain: fallbackDomain,
        reason: 'All TLD checks failed'
    });
    return fallbackDomain;
}
