/**
 * Policy Document Detector
 * 
 * Detects whether a given text document is likely a privacy policy,
 * terms of service, or other legal document.
 * 
 * Uses a combination of:
 * 1. Keyword frequency analysis
 * 2. Structure analysis (sections, headings)
 * 3. Optional AI validation via Ollama
 * 
 * Usage: 
 *   npx ts-node detect.ts <file-path>
 *   npx ts-node detect.ts --batch <folder-path>
 *   npx ts-node detect.ts --text "Your text here"
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import * as cheerio from 'cheerio';

// Configuration
const CONFIG = {
    ollamaModel: 'deepseek-r1:671b',
    minTextLength: 500,
    policyConfidenceThreshold: 0.6,
    highConfidenceThreshold: 0.8
};

// Policy-specific keywords organized by category
const POLICY_KEYWORDS = {
    // Core privacy terms (high weight)
    core: [
        'privacy policy', 'privacy notice', 'data protection', 'personal data',
        'personal information', 'data subject', 'data controller', 'data processor',
        'terms of service', 'terms of use', 'terms and conditions', 'user agreement',
        'cookie policy', 'cookie notice'
    ],
    
    // Legal/regulatory terms (high weight)
    legal: [
        'gdpr', 'ccpa', 'cpra', 'lgpd', 'pipeda', 'dpa', 'vcdpa',
        'general data protection regulation', 'california consumer privacy act',
        'virginia consumer data protection act', 'colorado privacy act',
        'data protection act', 'privacy act', 'electronic communications',
        'e-privacy', 'coppa', 'children\'s online privacy protection'
    ],
    
    // Data handling terms (medium weight)
    dataHandling: [
        'collect', 'collection', 'process', 'processing', 'store', 'storage',
        'retain', 'retention', 'delete', 'deletion', 'anonymize', 'anonymization',
        'pseudonymize', 'pseudonymization', 'aggregate', 'aggregation',
        'transfer', 'disclose', 'disclosure', 'share', 'sharing'
    ],
    
    // Rights and consent terms (medium weight)
    rights: [
        'consent', 'withdraw consent', 'opt-out', 'opt out', 'opt-in', 'opt in',
        'right to access', 'right to rectification', 'right to erasure',
        'right to delete', 'right to portability', 'right to object',
        'data subject rights', 'your rights', 'user rights', 'exercise your rights',
        'request deletion', 'request access', 'do not sell', 'do not share'
    ],
    
    // Third party terms (medium weight)
    thirdParty: [
        'third party', 'third parties', 'service provider', 'service providers',
        'business partner', 'affiliate', 'affiliates', 'vendor', 'vendors',
        'advertising partner', 'analytics provider', 'subprocessor'
    ],
    
    // Security terms (medium weight)
    security: [
        'encryption', 'encrypted', 'ssl', 'tls', 'secure', 'security measures',
        'data breach', 'breach notification', 'unauthorized access',
        'security safeguards', 'protect your data', 'protect your information'
    ],
    
    // Cookie-related terms (medium weight)
    cookies: [
        'cookie', 'cookies', 'tracking technology', 'tracking technologies',
        'pixel', 'pixels', 'web beacon', 'web beacons', 'local storage',
        'session storage', 'fingerprint', 'fingerprinting', 'device identifier'
    ],
    
    // Structural phrases (low weight - but indicate legal document)
    structure: [
        'effective date', 'last updated', 'last modified', 'revision date',
        'table of contents', 'definitions', 'scope', 'applicability',
        'contact us', 'how to contact', 'questions about this',
        'changes to this', 'updates to this', 'modifications to this',
        'governing law', 'jurisdiction', 'dispute resolution', 'arbitration',
        'limitation of liability', 'indemnification', 'warranty', 'disclaimer'
    ]
};

// Document type indicators
const DOCUMENT_TYPES = {
    privacy_policy: [
        'privacy policy', 'privacy notice', 'privacy statement', 'data protection',
        'personal data', 'personal information', 'information we collect',
        'how we use your', 'how we collect'
    ],
    terms_of_service: [
        'terms of service', 'terms of use', 'terms and conditions', 'user agreement',
        'service agreement', 'acceptable use', 'prohibited conduct',
        'your responsibilities', 'account termination'
    ],
    cookie_policy: [
        'cookie policy', 'cookie notice', 'use of cookies', 'cookie statement',
        'cookies we use', 'types of cookies', 'cookie preferences'
    ],
    data_processing_agreement: [
        'data processing agreement', 'data processing addendum', 'dpa',
        'subprocessor', 'data processor', 'standard contractual clauses'
    ]
};

interface DetectionResult {
    isPolicy: boolean;
    confidence: number;
    documentType: string | null;
    documentTypeConfidence: number;
    keywordMatches: {
        category: string;
        matches: string[];
        score: number;
    }[];
    structureIndicators: string[];
    totalScore: number;
    reasoning: string;
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

/**
 * Preprocess text - extract from HTML if needed
 */
function preprocessText(text: string): string {
    // If the text looks like HTML, extract content properly
    if (text.includes('<!DOCTYPE') || text.includes('<html') || (text.includes('<head') && text.includes('<body'))) {
        return extractTextFromHtml(text);
    }
    return text;
}

/**
 * Normalize text for keyword matching
 */
function normalizeText(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^\w\s'-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Count keyword matches in text
 */
function countKeywordMatches(text: string, keywords: string[]): { matches: string[]; score: number } {
    const normalizedText = normalizeText(text);
    const matches: string[] = [];
    let score = 0;
    
    for (const keyword of keywords) {
        const normalizedKeyword = keyword.toLowerCase();
        // Count occurrences
        const regex = new RegExp(`\\b${normalizedKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
        const occurrences = (normalizedText.match(regex) || []).length;
        
        if (occurrences > 0) {
            matches.push(keyword);
            // Diminishing returns for multiple occurrences
            score += 1 + Math.min(occurrences - 1, 4) * 0.2;
        }
    }
    
    return { matches, score };
}

/**
 * Detect structural elements of legal documents
 */
function detectStructuralElements(text: string): string[] {
    const indicators: string[] = [];
    const normalizedText = text.toLowerCase();
    
    // Check for numbered sections
    if (/\b(?:section|article|clause)\s*\d+/i.test(text)) {
        indicators.push('numbered_sections');
    }
    
    // Check for definition sections
    if (/\b(?:"[^"]+"\s+(?:means|refers to|shall mean)|definitions?:)/i.test(text)) {
        indicators.push('definitions_section');
    }
    
    // Check for date mentions
    if (/(?:effective|last\s+(?:updated|modified|revised))[:\s]+\d/i.test(text)) {
        indicators.push('date_reference');
    }
    
    // Check for legal boilerplate
    if (/(?:to the (?:fullest|maximum) extent (?:permitted|allowed) by law)/i.test(text)) {
        indicators.push('legal_boilerplate');
    }
    
    // Check for contact information section
    if (/(?:contact\s+us|how\s+to\s+contact|questions?\s+(?:about|regarding)|reach\s+us)/i.test(text)) {
        indicators.push('contact_section');
    }
    
    // Check for table of contents
    if (/(?:table\s+of\s+contents|contents:|index:)/i.test(text)) {
        indicators.push('table_of_contents');
    }
    
    // Check for change notification clause
    if (/(?:we\s+(?:may|will|reserve\s+the\s+right\s+to)\s+(?:update|modify|change|revise)\s+this)/i.test(text)) {
        indicators.push('change_notification');
    }
    
    return indicators;
}

/**
 * Determine the most likely document type
 */
function detectDocumentType(text: string): { type: string | null; confidence: number } {
    const normalizedText = normalizeText(text);
    const scores: { [key: string]: number } = {};
    
    for (const [docType, indicators] of Object.entries(DOCUMENT_TYPES)) {
        let score = 0;
        for (const indicator of indicators) {
            const regex = new RegExp(`\\b${indicator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
            const matches = (normalizedText.match(regex) || []).length;
            if (matches > 0) {
                score += 1 + Math.min(matches - 1, 3) * 0.3;
            }
        }
        scores[docType] = score / indicators.length;
    }
    
    const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const [bestType, bestScore] = entries[0];
    
    if (bestScore > 0.15) {
        return { type: bestType, confidence: Math.min(1, bestScore) };
    }
    
    return { type: null, confidence: 0 };
}

/**
 * Main detection function
 */
export function detectPolicy(rawText: string): DetectionResult {
    // Preprocess HTML if needed
    const text = preprocessText(rawText);
    
    if (text.length < CONFIG.minTextLength) {
        return {
            isPolicy: false,
            confidence: 0,
            documentType: null,
            documentTypeConfidence: 0,
            keywordMatches: [],
            structureIndicators: [],
            totalScore: 0,
            reasoning: `Text too short (${text.length} chars, minimum ${CONFIG.minTextLength})`
        };
    }
    
    // Analyze keyword matches by category
    const categoryResults: DetectionResult['keywordMatches'] = [];
    let totalWeightedScore = 0;
    let totalWeight = 0;
    
    const weights: { [key: string]: number } = {
        core: 3.0,
        legal: 2.5,
        dataHandling: 1.5,
        rights: 1.5,
        thirdParty: 1.2,
        security: 1.2,
        cookies: 1.2,
        structure: 0.8
    };
    
    for (const [category, keywords] of Object.entries(POLICY_KEYWORDS)) {
        const { matches, score } = countKeywordMatches(text, keywords);
        const weight = weights[category] || 1;
        const normalizedScore = score / keywords.length; // Normalize by category size
        
        categoryResults.push({
            category,
            matches,
            score: normalizedScore
        });
        
        totalWeightedScore += normalizedScore * weight;
        totalWeight += weight;
    }
    
    // Detect structural elements
    const structureIndicators = detectStructuralElements(text);
    const structureBonus = structureIndicators.length * 0.05;
    
    // Detect document type
    const { type: documentType, confidence: documentTypeConfidence } = detectDocumentType(text);
    
    // Calculate final score
    const baseScore = totalWeightedScore / totalWeight;
    const finalScore = Math.min(1, baseScore + structureBonus + (documentTypeConfidence * 0.1));
    
    // Determine if it's a policy
    const isPolicy = finalScore >= CONFIG.policyConfidenceThreshold;
    
    // Generate reasoning
    let reasoning: string;
    if (finalScore >= CONFIG.highConfidenceThreshold) {
        reasoning = `High confidence policy document. Strong matches in: ${categoryResults
            .filter(c => c.matches.length > 0)
            .map(c => c.category)
            .join(', ')}`;
    } else if (isPolicy) {
        reasoning = `Likely a policy document based on keyword analysis. Document appears to be ${documentType || 'a legal document'}.`;
    } else if (finalScore >= 0.3) {
        reasoning = `Some policy-related content detected, but not enough to classify as a policy document.`;
    } else {
        reasoning = `Does not appear to be a policy document. Few policy-specific keywords found.`;
    }
    
    return {
        isPolicy,
        confidence: finalScore,
        documentType,
        documentTypeConfidence,
        keywordMatches: categoryResults.filter(c => c.matches.length > 0),
        structureIndicators,
        totalScore: finalScore,
        reasoning
    };
}

/**
 * Enhanced detection with Ollama AI validation
 */
async function detectWithAI(text: string): Promise<DetectionResult & { aiValidation?: string }> {
    // First run the regular detection
    const basicResult = detectPolicy(text);
    
    // If we're uncertain (between 0.4 and 0.8), use AI
    if (basicResult.confidence >= 0.4 && basicResult.confidence < 0.8) {
        try {
            const prompt = `Analyze this text excerpt and determine if it's from a privacy policy, terms of service, or other legal document.

TEXT EXCERPT (first 3000 chars):
${text.slice(0, 3000)}

Answer with a JSON object:
{
  "isLegalDocument": true/false,
  "documentType": "privacy_policy" | "terms_of_service" | "cookie_policy" | "other_legal" | "not_legal",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}

Only output the JSON, nothing else.`;

            const aiResponse = await runOllamaPrompt(prompt);
            const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
            
            if (jsonMatch) {
                const aiResult = JSON.parse(jsonMatch[0]);
                
                // Combine AI result with keyword analysis
                const combinedConfidence = (basicResult.confidence * 0.6) + (aiResult.confidence * 0.4);
                
                return {
                    ...basicResult,
                    isPolicy: aiResult.isLegalDocument || basicResult.isPolicy,
                    confidence: combinedConfidence,
                    documentType: aiResult.documentType !== 'not_legal' ? aiResult.documentType : basicResult.documentType,
                    aiValidation: aiResult.reasoning
                };
            }
        } catch (error) {
            console.error('AI validation failed, using keyword analysis only');
        }
    }
    
    return basicResult;
}

async function runOllamaPrompt(prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const ollama = spawn('ollama', ['run', CONFIG.ollamaModel], {
            stdio: ['pipe', 'pipe', 'pipe']
        });
        
        let output = '';
        
        ollama.stdout.on('data', (data) => {
            output += data.toString();
        });
        
        ollama.on('close', (code) => {
            if (code === 0) {
                resolve(output.trim());
            } else {
                reject(new Error(`Ollama exited with code ${code}`));
            }
        });
        
        ollama.on('error', reject);
        
        ollama.stdin.write(prompt);
        ollama.stdin.end();
    });
}

/**
 * Process a single file
 */
async function processFile(filePath: string, useAI: boolean = false): Promise<void> {
    console.log(`\n📄 Analyzing: ${path.basename(filePath)}`);
    
    const text = fs.readFileSync(filePath, 'utf-8');
    const result = useAI ? await detectWithAI(text) : detectPolicy(text);
    
    console.log(`\n   Status: ${result.isPolicy ? '✅ IS A POLICY' : '❌ NOT A POLICY'}`);
    console.log(`   Confidence: ${(result.confidence * 100).toFixed(1)}%`);
    
    if (result.documentType) {
        console.log(`   Type: ${result.documentType} (${(result.documentTypeConfidence * 100).toFixed(1)}%)`);
    }
    
    if (result.keywordMatches.length > 0) {
        console.log(`   Keyword Categories Matched:`);
        for (const cat of result.keywordMatches.slice(0, 5)) {
            console.log(`     - ${cat.category}: ${cat.matches.slice(0, 3).join(', ')}${cat.matches.length > 3 ? '...' : ''}`);
        }
    }
    
    if (result.structureIndicators.length > 0) {
        console.log(`   Structure: ${result.structureIndicators.join(', ')}`);
    }
    
    console.log(`   Reasoning: ${result.reasoning}`);
    
    if ('aiValidation' in result && result.aiValidation) {
        console.log(`   AI Notes: ${result.aiValidation}`);
    }
}

/**
 * Process a batch of files
 */
async function processBatch(folderPath: string, useAI: boolean = false): Promise<void> {
    const files = fs.readdirSync(folderPath)
        .filter(f => ['.txt', '.md', '.html', '.htm'].includes(path.extname(f).toLowerCase()));
    
    console.log(`\n📁 Processing ${files.length} files from: ${folderPath}\n`);
    
    const results: { file: string; isPolicy: boolean; confidence: number; type: string | null }[] = [];
    
    for (const file of files) {
        const filePath = path.join(folderPath, file);
        const text = fs.readFileSync(filePath, 'utf-8');
        const result = useAI ? await detectWithAI(text) : detectPolicy(text);
        
        results.push({
            file,
            isPolicy: result.isPolicy,
            confidence: result.confidence,
            type: result.documentType
        });
        
        const status = result.isPolicy ? '✅' : '❌';
        const confStr = `${(result.confidence * 100).toFixed(0)}%`.padStart(4);
        console.log(`${status} ${confStr} | ${file} | ${result.documentType || 'unknown'}`);
    }
    
    // Summary
    const policies = results.filter(r => r.isPolicy);
    console.log(`\n═══════════════════════════════════════════════════`);
    console.log(`Summary: ${policies.length}/${files.length} files detected as policies`);
    console.log(`═══════════════════════════════════════════════════`);
}

// CLI
async function main(): Promise<void> {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log(`
Policy Document Detector

Usage:
  npx ts-node detect.ts <file-path>           Analyze a single file
  npx ts-node detect.ts --batch <folder>      Analyze all files in folder
  npx ts-node detect.ts --text "..."          Analyze text directly
  npx ts-node detect.ts --ai <file-path>      Use AI for enhanced detection

Options:
  --ai      Use Ollama AI for enhanced detection (slower but more accurate)
  --batch   Process multiple files in a folder
  --text    Provide text directly as argument
`);
        return;
    }
    
    const useAI = args.includes('--ai');
    const filteredArgs = args.filter(a => a !== '--ai');
    
    if (filteredArgs[0] === '--batch' && filteredArgs[1]) {
        await processBatch(filteredArgs[1], useAI);
    } else if (filteredArgs[0] === '--text' && filteredArgs[1]) {
        const result = useAI ? await detectWithAI(filteredArgs[1]) : detectPolicy(filteredArgs[1]);
        console.log(JSON.stringify(result, null, 2));
    } else if (filteredArgs[0] && fs.existsSync(filteredArgs[0])) {
        await processFile(filteredArgs[0], useAI);
    } else {
        console.error('Invalid arguments. Use --help for usage information.');
    }
}

// Export for use as a module
export { detectWithAI, POLICY_KEYWORDS, DOCUMENT_TYPES };

// Run CLI if executed directly
if (require.main === module) {
    main().catch(console.error);
}
