import { logger } from '../logger';

// -----------------------------------------------------------------------------
// POLYFILLS
// -----------------------------------------------------------------------------
// pdf.js (used by pdf-parse) requires DOMMatrix/Canvas logic even in Node
if (typeof global !== 'undefined') {
    if (typeof (global as any).DOMMatrix === 'undefined') {
        (global as any).DOMMatrix = class DOMMatrix {
            constructor() { }
            multiply() { return this; }
            translate() { return this; }
            scale() { return this; }
            toString() { return 'matrix(1, 0, 0, 1, 0, 0)'; }
        };
    }
}

/**
 * Robust extraction of text from PDF Buffer.
 * 
 * ARCHITECTURAL NOTE:
 * We use a specific runtime-require hack to bypass Next.js/Webpack static analysis.
 * The error "Cannot find module as expression is too dynamic" occurs because
 * Webpack tries to bundle the internal worker loading logic of pdf.js.
 * By using `eval('require')`, we force this to be treated as a purely runtime
 * Node.js operation, skipping the bundler entirely for this dependency.
 */
export async function parsePdf(buffer: Buffer): Promise<string> {
    try {
        // 1. Bypass Webpack bundling for this specific module
        const runtimeRequire = eval('require');
        const pdfModule = runtimeRequire('pdf-parse');

        // 2. Dynamically resolve the correct parser function/class
        let parserFunc: any;

        // Strategy A: Check for PDFParse class property (v2.4.5 specific)
        if (pdfModule.PDFParse) {
            parserFunc = (buf: Buffer) => {
                const parser = new pdfModule.PDFParse(new Uint8Array(buf));
                return parser.getText();
            };
        }
        // Strategy B: Check if module itself is a function (older versions / default export)
        else if (typeof pdfModule === 'function') {
            parserFunc = pdfModule;
        }
        // Strategy C: Check for default export that is a function
        else if (pdfModule.default && typeof pdfModule.default === 'function') {
            parserFunc = pdfModule.default;
        }
        // Strategy D: Check for default.PDFParse
        else if (pdfModule.default && pdfModule.default.PDFParse) {
            parserFunc = (buf: Buffer) => {
                const parser = new pdfModule.default.PDFParse(new Uint8Array(buf));
                return parser.getText();
            };
        }
        else {
            throw new Error(`Could not find valid PDF parser in module. Keys: ${Object.keys(pdfModule).join(', ')}`);
        }

        // 3. Parse the buffer using the resolved strategy
        const data = await parserFunc(buffer);

        // 4. Extract and clean text
        const text = data.text || '';

        const cleanedText = text
            .replace(/\r\n/g, '\n')      // Normalize line endings
            .replace(/\n\s*\n/g, '\n\n') // Normalize paragraphs
            .replace(/[ \t]+/g, ' ')     // Normalize horizontal whitespace
            .trim();

        logger.info(`[parsePdf] Extracted ${cleanedText.length} chars from PDF using runtime parser (Pages: ${data.numpages})`);

        return cleanedText;

    } catch (error: any) {
        // 4. Detailed error logging
        logger.error('[parsePdf] CRITICAL: PDF parsing failed', {
            error: error.message,
            stack: error.stack,
            bufferSize: buffer ? buffer.length : 0
        });

        // Fallback for empty/failed parsing to prevent app crash
        throw new Error(`PDF Parsing Failed: ${error.message}`);
    }
}
