/**
 * Policy Keyword Analyzer
 * 
 * Analyzes privacy policy documents to extract policy-specific keywords.
 * Uses word frequency analysis combined with Ollama AI validation.
 * 
 * This tool helps improve PolicyParser's text-based policy detection.
 * 
 * Usage: npx ts-node analyze.ts
 * 
 * Requires: Ollama with deepseek-r1:671b model
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import * as cheerio from 'cheerio';

const execAsync = promisify(exec);

// Configuration
const CONFIG = {
    inputDir: path.join(__dirname, 'input'),
    outputDir: path.join(__dirname, 'output'),
    excludeFile: path.join(__dirname, 'exclude-words.json'),
    minWordLength: 3,
    minFrequency: 5,
    topNForAI: 500,
    ollamaModel: 'deepseek-r1:671b',
    supportedExtensions: ['.txt', '.md', '.html', '.htm']
};

// Types
interface WordFrequency {
    word: string;
    count: number;
    documents: number; // Number of docs containing this word
}

interface AnalyzedKeyword {
    term: string;
    frequency: number;
    documentFrequency: number;
    score: number;
    category: 'high_confidence' | 'medium_confidence' | 'low_confidence';
    isPolicyRelated: boolean;
    reasoning?: string;
}

interface ExcludeList {
    articles: string[];
    pronouns: string[];
    prepositions: string[];
    conjunctions: string[];
    common_verbs: string[];
    common_adjectives: string[];
    common_adverbs: string[];
    numbers_and_basic: string[];
    web_and_tech_common: string[];
    document_structure: string[];
    time_related: string[];
    quantity_and_measure: string[];
    business_common: string[];
    action_nouns: string[];
    misc_common: string[];
    filler_words: string[];
    single_chars_and_symbols: string[];
}

// Utility functions
function ensureDirectories(): void {
    if (!fs.existsSync(CONFIG.inputDir)) {
        fs.mkdirSync(CONFIG.inputDir, { recursive: true });
        console.log(`📁 Created input directory: ${CONFIG.inputDir}`);
        console.log('   Place your privacy policy files (.txt, .md, .html) in this folder');
    }
    if (!fs.existsSync(CONFIG.outputDir)) {
        fs.mkdirSync(CONFIG.outputDir, { recursive: true });
        console.log(`📁 Created output directory: ${CONFIG.outputDir}`);
    }
}

function loadExcludeList(): Set<string> {
    const excludeData: ExcludeList = JSON.parse(fs.readFileSync(CONFIG.excludeFile, 'utf-8'));
    const excludeSet = new Set<string>();
    
    // Flatten all categories into one set
    for (const category of Object.values(excludeData)) {
        for (const word of category) {
            excludeSet.add(word.toLowerCase());
        }
    }
    
    console.log(`📋 Loaded ${excludeSet.size} words to exclude`);
    return excludeSet;
}

/**
 * Extract actual rendered text content from HTML using Cheerio.
 * Removes scripts, styles, navigation, footers, and other non-content elements.
 */
function extractTextFromHtml(html: string): string {
    const $ = cheerio.load(html);
    
    // Remove unwanted elements that don't contain policy content
    $('script, style, noscript, iframe, svg, canvas').remove();
    $('nav, header, footer, aside, menu').remove();
    $('[role="navigation"], [role="banner"], [role="contentinfo"]').remove();
    $('button, input, select, textarea, form').remove();
    $('.cookie-banner, .cookie-consent, .privacy-banner').remove();
    $('.nav, .navbar, .navigation, .menu, .sidebar').remove();
    $('.footer, .header, .breadcrumb, .social-share').remove();
    $('[class*="cookie"], [class*="banner"], [class*="popup"]').remove();
    $('[id*="cookie"], [id*="banner"], [id*="popup"]').remove();
    
    // Get text content from the remaining elements
    // Focus on main content areas first
    let text = '';
    
    // Try to find main content containers
    const mainSelectors = [
        'main',
        'article', 
        '[role="main"]',
        '.content',
        '.main-content',
        '.policy-content',
        '.privacy-content',
        '#content',
        '#main',
        '.page-content',
        '.entry-content'
    ];
    
    let mainContent = '';
    for (const selector of mainSelectors) {
        const element = $(selector);
        if (element.length > 0) {
            mainContent = element.text();
            if (mainContent.length > 500) {
                break;
            }
        }
    }
    
    // If no main content found, fall back to body
    if (mainContent.length > 500) {
        text = mainContent;
    } else {
        text = $('body').text() || $.root().text();
    }
    
    return text;
}

function cleanText(text: string, isHtml: boolean = false): string {
    // If the text looks like HTML, extract content properly
    if (isHtml || text.includes('<!DOCTYPE') || text.includes('<html') || (text.includes('<head') && text.includes('<body'))) {
        text = extractTextFromHtml(text);
    } else {
        // For non-HTML content, just remove any stray HTML tags
        text = text.replace(/<[^>]*>/g, ' ');
    }
    
    // Remove URLs
    text = text.replace(/https?:\/\/[^\s]+/g, ' ');
    // Remove email addresses
    text = text.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, ' ');
    // Remove special characters but keep apostrophes in contractions
    text = text.replace(/[^a-zA-Z0-9\s'-]/g, ' ');
    // Normalize whitespace
    text = text.replace(/\s+/g, ' ').trim();
    return text.toLowerCase();
}

function extractWords(text: string): string[] {
    const cleaned = cleanText(text);
    const words = cleaned.split(/\s+/);
    return words.filter(word => 
        word.length >= CONFIG.minWordLength && 
        !/^\d+$/.test(word) // Exclude pure numbers
    );
}

function extractBigrams(words: string[]): string[] {
    const bigrams: string[] = [];
    for (let i = 0; i < words.length - 1; i++) {
        const bigram = `${words[i]} ${words[i + 1]}`;
        bigrams.push(bigram);
    }
    return bigrams;
}

function readPolicyFiles(): { filename: string; content: string }[] {
    const files: { filename: string; content: string }[] = [];
    
    if (!fs.existsSync(CONFIG.inputDir)) {
        return files;
    }
    
    const entries = fs.readdirSync(CONFIG.inputDir);
    
    for (const entry of entries) {
        const filePath = path.join(CONFIG.inputDir, entry);
        const stat = fs.statSync(filePath);
        
        if (stat.isFile()) {
            const ext = path.extname(entry).toLowerCase();
            if (CONFIG.supportedExtensions.includes(ext)) {
                try {
                    const content = fs.readFileSync(filePath, 'utf-8');
                    files.push({ filename: entry, content });
                    console.log(`  📄 Loaded: ${entry} (${content.length} chars)`);
                } catch (error) {
                    console.error(`  ❌ Failed to read: ${entry}`);
                }
            }
        }
    }
    
    return files;
}

function analyzeWordFrequencies(
    files: { filename: string; content: string }[],
    excludeSet: Set<string>
): { words: WordFrequency[]; bigrams: WordFrequency[] } {
    const wordCounts = new Map<string, { count: number; docs: Set<string> }>();
    const bigramCounts = new Map<string, { count: number; docs: Set<string> }>();
    
    for (const file of files) {
        const words = extractWords(file.content);
        const bigrams = extractBigrams(words);
        
        // Count single words
        const seenWords = new Set<string>();
        for (const word of words) {
            if (excludeSet.has(word)) continue;
            
            if (!wordCounts.has(word)) {
                wordCounts.set(word, { count: 0, docs: new Set() });
            }
            const entry = wordCounts.get(word)!;
            entry.count++;
            if (!seenWords.has(word)) {
                entry.docs.add(file.filename);
                seenWords.add(word);
            }
        }
        
        // Count bigrams
        const seenBigrams = new Set<string>();
        for (const bigram of bigrams) {
            const bigramWords = bigram.split(' ');
            // Skip if either word is in exclude list
            if (bigramWords.some(w => excludeSet.has(w))) continue;
            
            if (!bigramCounts.has(bigram)) {
                bigramCounts.set(bigram, { count: 0, docs: new Set() });
            }
            const entry = bigramCounts.get(bigram)!;
            entry.count++;
            if (!seenBigrams.has(bigram)) {
                entry.docs.add(file.filename);
                seenBigrams.add(bigram);
            }
        }
    }
    
    // Convert to sorted arrays
    const words = Array.from(wordCounts.entries())
        .map(([word, data]) => ({
            word,
            count: data.count,
            documents: data.docs.size
        }))
        .filter(w => w.count >= CONFIG.minFrequency)
        .sort((a, b) => b.count - a.count);
    
    const bigrams = Array.from(bigramCounts.entries())
        .map(([word, data]) => ({
            word,
            count: data.count,
            documents: data.docs.size
        }))
        .filter(b => b.count >= Math.max(3, CONFIG.minFrequency / 2))
        .sort((a, b) => b.count - a.count);
    
    return { words, bigrams };
}

async function runOllamaPrompt(prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
        console.log('\n🤖 Sending to Ollama (this may take a while for large contexts)...\n');
        
        const ollama = spawn('ollama', ['run', CONFIG.ollamaModel], {
            stdio: ['pipe', 'pipe', 'pipe']
        });
        
        let output = '';
        let errorOutput = '';
        
        ollama.stdout.on('data', (data) => {
            const chunk = data.toString();
            output += chunk;
            process.stdout.write(chunk); // Stream output to console
        });
        
        ollama.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });
        
        ollama.on('close', (code) => {
            if (code === 0) {
                resolve(output.trim());
            } else {
                reject(new Error(`Ollama exited with code ${code}: ${errorOutput}`));
            }
        });
        
        ollama.on('error', (error) => {
            reject(new Error(`Failed to start Ollama: ${error.message}`));
        });
        
        // Send the prompt
        ollama.stdin.write(prompt);
        ollama.stdin.end();
    });
}

async function validateWithAI(
    words: WordFrequency[],
    bigrams: WordFrequency[],
    totalDocs: number
): Promise<AnalyzedKeyword[]> {
    // Prepare top candidates for AI analysis
    const topWords = words.slice(0, CONFIG.topNForAI);
    const topBigrams = bigrams.slice(0, Math.floor(CONFIG.topNForAI / 2));
    
    const candidateList = [
        ...topWords.map(w => `"${w.word}" (freq: ${w.count}, docs: ${w.documents}/${totalDocs})`),
        ...topBigrams.map(b => `"${b.word}" (freq: ${b.count}, docs: ${b.documents}/${totalDocs})`)
    ].join('\n');
    
    const prompt = `You are a privacy policy expert. I have extracted frequent words and phrases from ${totalDocs} privacy policy documents.

Your task: Analyze these terms and identify which ones are SPECIFICALLY related to privacy policies, data protection, or legal documents.

## CRITERIA FOR POLICY-SPECIFIC TERMS:
- Legal terminology (consent, liability, indemnify, binding, etc.)
- Data protection terms (personal data, processing, controller, retention, etc.)
- Privacy concepts (confidentiality, anonymization, pseudonymization, etc.)
- Regulatory terms (GDPR, CCPA, compliance, jurisdiction, etc.)
- Rights-related terms (access, deletion, portability, objection, etc.)
- Security terms (encryption, breach, unauthorized, safeguards, etc.)

## DO NOT INCLUDE:
- Generic business terms (company, service, customer)
- Common web terms already filtered out
- Vague terms that appear in any document

## CANDIDATE TERMS TO ANALYZE:
${candidateList}

## YOUR OUTPUT FORMAT:
Return a JSON array where each object has:
{
  "term": "the term",
  "isPolicyRelated": true/false,
  "confidence": "high" | "medium" | "low",
  "reasoning": "brief explanation why this is/isn't policy-specific"
}

Only output the JSON array, no other text. Focus on the top 100 most policy-specific terms.`;

    try {
        const response = await runOllamaPrompt(prompt);
        
        // Try to extract JSON from the response
        const jsonMatch = response.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            const analyzed = JSON.parse(jsonMatch[0]) as Array<{
                term: string;
                isPolicyRelated: boolean;
                confidence: 'high' | 'medium' | 'low';
                reasoning: string;
            }>;
            
            // Map back to our format with frequency data
            const results: AnalyzedKeyword[] = [];
            
            for (const item of analyzed) {
                if (!item.isPolicyRelated) continue;
                
                // Find frequency data
                const wordData = words.find(w => w.word === item.term.toLowerCase());
                const bigramData = bigrams.find(b => b.word === item.term.toLowerCase());
                const data = wordData || bigramData;
                
                if (data) {
                    const docFreqScore = data.documents / totalDocs;
                    const frequencyScore = Math.min(1, data.count / 100);
                    const confidenceMultiplier = 
                        item.confidence === 'high' ? 1.0 :
                        item.confidence === 'medium' ? 0.7 : 0.4;
                    
                    results.push({
                        term: item.term,
                        frequency: data.count,
                        documentFrequency: data.documents,
                        score: (docFreqScore * 0.4 + frequencyScore * 0.3 + confidenceMultiplier * 0.3),
                        category: item.confidence === 'high' ? 'high_confidence' :
                                  item.confidence === 'medium' ? 'medium_confidence' : 'low_confidence',
                        isPolicyRelated: true,
                        reasoning: item.reasoning
                    });
                }
            }
            
            return results.sort((a, b) => b.score - a.score);
        }
        
        throw new Error('Could not parse AI response as JSON');
    } catch (error) {
        console.error('⚠️ AI analysis failed, using frequency-based fallback');
        console.error(error);
        
        // Fallback: use simple heuristics
        const policyIndicators = [
            'data', 'privacy', 'personal', 'information', 'consent', 'collect',
            'process', 'share', 'third', 'party', 'cookie', 'tracking', 'gdpr',
            'ccpa', 'right', 'access', 'delete', 'retention', 'security',
            'protect', 'breach', 'encrypt', 'legal', 'law', 'regulation',
            'compliance', 'controller', 'processor', 'transfer', 'jurisdiction'
        ];
        
        const results: AnalyzedKeyword[] = [];
        
        for (const word of words.slice(0, 200)) {
            const hasIndicator = policyIndicators.some(ind => 
                word.word.includes(ind) || ind.includes(word.word)
            );
            
            if (hasIndicator) {
                results.push({
                    term: word.word,
                    frequency: word.count,
                    documentFrequency: word.documents,
                    score: (word.documents / totalDocs) * 0.5 + Math.min(1, word.count / 100) * 0.5,
                    category: word.documents > totalDocs * 0.5 ? 'high_confidence' : 'medium_confidence',
                    isPolicyRelated: true
                });
            }
        }
        
        return results.sort((a, b) => b.score - a.score);
    }
}

function generateReport(
    keywords: AnalyzedKeyword[],
    rawWords: WordFrequency[],
    rawBigrams: WordFrequency[],
    totalDocs: number
): string {
    const high = keywords.filter(k => k.category === 'high_confidence');
    const medium = keywords.filter(k => k.category === 'medium_confidence');
    const low = keywords.filter(k => k.category === 'low_confidence');
    
    return `# Policy Keyword Analysis Report

Generated: ${new Date().toISOString()}

## Summary

- **Documents Analyzed**: ${totalDocs}
- **Unique Words Found**: ${rawWords.length}
- **Unique Bigrams Found**: ${rawBigrams.length}
- **Policy Keywords Identified**: ${keywords.length}
  - High Confidence: ${high.length}
  - Medium Confidence: ${medium.length}
  - Low Confidence: ${low.length}

## High Confidence Policy Keywords

These terms are strongly associated with privacy policies:

| Term | Frequency | Documents | Score |
|------|-----------|-----------|-------|
${high.slice(0, 50).map(k => 
    `| ${k.term} | ${k.frequency} | ${k.documentFrequency}/${totalDocs} | ${k.score.toFixed(3)} |`
).join('\n')}

## Medium Confidence Policy Keywords

| Term | Frequency | Documents | Score |
|------|-----------|-----------|-------|
${medium.slice(0, 30).map(k => 
    `| ${k.term} | ${k.frequency} | ${k.documentFrequency}/${totalDocs} | ${k.score.toFixed(3)} |`
).join('\n')}

## Top Raw Word Frequencies (Before AI Filtering)

| Word | Count | Documents |
|------|-------|-----------|
${rawWords.slice(0, 50).map(w => 
    `| ${w.word} | ${w.count} | ${w.documents} |`
).join('\n')}

## Top Bigram Frequencies

| Phrase | Count | Documents |
|--------|-------|-----------|
${rawBigrams.slice(0, 30).map(b => 
    `| ${b.word} | ${b.count} | ${b.documents} |`
).join('\n')}

## Usage in PolicyParser

To use these keywords for policy detection, add them to the discovery engine:

\`\`\`typescript
const POLICY_DETECTION_KEYWORDS = [
${high.slice(0, 30).map(k => `    '${k.term}',`).join('\n')}
];
\`\`\`
`;
}

async function main(): Promise<void> {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('              POLICY KEYWORD ANALYZER v1.0');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
    
    // Setup
    ensureDirectories();
    const excludeSet = loadExcludeList();
    
    // Load files
    console.log('\n📂 Loading policy files...');
    const files = readPolicyFiles();
    
    if (files.length === 0) {
        console.log('\n⚠️  No policy files found!');
        console.log(`   Please add .txt, .md, or .html files to: ${CONFIG.inputDir}`);
        console.log('\n   Example: Download privacy policies from companies like:');
        console.log('   - Google, Facebook, Apple, Microsoft');
        console.log('   - Amazon, Netflix, Spotify, Twitter');
        console.log('   - Various startups and smaller companies');
        console.log('\n   The more diverse the sources, the better the keyword extraction!');
        return;
    }
    
    console.log(`\n✅ Loaded ${files.length} policy documents`);
    
    // Analyze frequencies
    console.log('\n📊 Analyzing word frequencies...');
    const { words, bigrams } = analyzeWordFrequencies(files, excludeSet);
    console.log(`   Found ${words.length} unique words (min freq: ${CONFIG.minFrequency})`);
    console.log(`   Found ${bigrams.length} unique bigrams`);
    
    // Save raw frequencies
    const rawOutput = {
        totalDocuments: files.length,
        analyzedAt: new Date().toISOString(),
        words: words.slice(0, 1000),
        bigrams: bigrams.slice(0, 500)
    };
    fs.writeFileSync(
        path.join(CONFIG.outputDir, 'word-frequencies.json'),
        JSON.stringify(rawOutput, null, 2)
    );
    console.log('   Saved raw frequencies to word-frequencies.json');
    
    // AI validation
    console.log('\n🧠 Running AI analysis with Ollama...');
    console.log(`   Model: ${CONFIG.ollamaModel}`);
    console.log('   This will identify policy-specific terms from the frequency data.');
    
    const keywords = await validateWithAI(words, bigrams, files.length);
    
    // Save keywords
    const keywordOutput = {
        totalDocuments: files.length,
        analyzedAt: new Date().toISOString(),
        model: CONFIG.ollamaModel,
        high_confidence: keywords.filter(k => k.category === 'high_confidence'),
        medium_confidence: keywords.filter(k => k.category === 'medium_confidence'),
        low_confidence: keywords.filter(k => k.category === 'low_confidence')
    };
    fs.writeFileSync(
        path.join(CONFIG.outputDir, 'policy-keywords.json'),
        JSON.stringify(keywordOutput, null, 2)
    );
    console.log('\n✅ Saved policy keywords to policy-keywords.json');
    
    // Generate report
    const report = generateReport(keywords, words, bigrams, files.length);
    fs.writeFileSync(
        path.join(CONFIG.outputDir, 'analysis-report.md'),
        report
    );
    console.log('✅ Saved analysis report to analysis-report.md');
    
    // Summary
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('                       ANALYSIS COMPLETE');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`\n📈 Results Summary:`);
    console.log(`   - High confidence keywords: ${keywordOutput.high_confidence.length}`);
    console.log(`   - Medium confidence keywords: ${keywordOutput.medium_confidence.length}`);
    console.log(`   - Low confidence keywords: ${keywordOutput.low_confidence.length}`);
    
    if (keywordOutput.high_confidence.length > 0) {
        console.log(`\n🔝 Top 10 Policy Keywords:`);
        keywordOutput.high_confidence.slice(0, 10).forEach((k, i) => {
            console.log(`   ${i + 1}. "${k.term}" (score: ${k.score.toFixed(3)})`);
        });
    }
    
    console.log(`\n📁 Output files saved to: ${CONFIG.outputDir}`);
}

// Run the analyzer
main().catch(console.error);
