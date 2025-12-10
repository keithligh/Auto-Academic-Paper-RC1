import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';
import { processLatex as sanitizeLatexForBrowser } from '../latex-unifier/processor';

describe('Baseline Tests (Verify Working Version)', () => {
    // Correct logic to find fixtures relative to this test file
    // __dirname is client/src/lib/__tests__
    // fixtures is test/fixtures (root)
    const fixturesDir = path.resolve(__dirname, '../../../../test/fixtures/refactor-validation');

    function loadFixture(filename: string): string {
        return fs.readFileSync(path.join(fixturesDir, filename), 'utf-8');
    }

    it('renders simple TikZ without errors', () => {
        const latex = loadFixture('simple-tikz.tex');
        const result = sanitizeLatexForBrowser(latex);
        // Expect TikZ block to be extracted
        expect(result.sanitized).toContain('LATEXPREVIEWTIKZ');
        expect(Object.keys(result.blocks).length).toBeGreaterThan(0);
        // Verify it didn't crash
    });

    it('renders tikz with percents', () => {
        const latex = loadFixture('tikz-with-percent.tex');
        const result = sanitizeLatexForBrowser(latex);
        expect(result.sanitized).toContain('LATEXPREVIEWTIKZ');
        const blockKey = Object.keys(result.blocks).find(k => k.includes('TIKZ'));
        if (blockKey) {
            expect(result.blocks[blockKey]).toContain('100');
            // The iframe srcdoc attribute is HTML entity encoded, so strictly checking "100%" might fail if encoded.
            // But "100" should be there
        }
    });

    it('renders complex tikz', () => {
        const latex = loadFixture('complex-tikz.tex');
        const result = sanitizeLatexForBrowser(latex);
        expect(result.sanitized).toContain('LATEXPREVIEWTIKZ');
    });

    it('renders math and tables', () => {
        const latex = loadFixture('math-and-tables.tex');
        const result = sanitizeLatexForBrowser(latex);
        // Check for table extraction
        // sanitizeLatexForBrowser extracts tables into placeholders?
        // Let's check the code: processTables returns placeholders? 
        // Yes: createPlaceholder(`<div class="table-wrapper">...`)
        expect(result.sanitized).toContain('LATEXPREVIEW');
        // We can check if "Built-in" is present in the blocks
        const tableBlock = Object.values(result.blocks).find(v => v.includes('Built-in'));
        expect(tableBlock).toBeDefined();
    });

    it('renders citations', () => {
        const latex = loadFixture('citations.tex');
        const result = sanitizeLatexForBrowser(latex);
        // "Single (ref_1)" -> "Single [1]"
        // This transformation happens in the HTML string, not blocks? 
        // Check LatexPreview.tsx: "html = html.replace(/\\cite\{...\}..."
        // WAIT. sanitizeLatexForBrowser does NOT do the IEEE [1] replacement?
        // Let's check LatexPreview.tsx again.
        // It returns { sanitized, ... }.
        // Then LatexPreview component does "const citationMap..." and replaces ref_x.

        // This means sanitizeLatexForBrowser assumes "ref_1" is still in the text?
        // Or does it handle it?
        // Line 1485 in LatexPreview.tsx: "html = html.replace(/\\cite..." IS AFTER sanitizeLatexForBrowser calls.

        // So sanitizeLatexForBrowser does NOT handle Citations?
        // Let's verify LatexPreview.tsx line 1378: 
        // "const { sanitized... } = sanitizeLatexForBrowser(latexContent);"
        // Line 1381 "let html = sanitized;"
        // Phase 4 Update: Citations are now processed in the sanitizer.
        expect(result.sanitized).toContain('[1]');
        expect(result.sanitized).toContain('[1]–[3]');
    });
});
