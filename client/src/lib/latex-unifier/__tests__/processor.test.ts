import { describe, it, expect } from 'vitest';
import { processLatex } from '../processor';

describe('processLatex (Orchestrator)', () => {
    it('processed lists correctly', () => {
        const input = `
            \\begin{itemize}
                \\item Item A
                \\item Item B
            \\end{itemize}
        `;
        const result = processLatex(input);

        // Find the block ID
        const match = result.sanitized.match(/LATEXPREVIEWBLOCK\d+/);
        expect(match).toBeTruthy();
        const blockId = match![0];

        expect(result.blocks[blockId]).toContain('<ul class="latex-itemize">');
        expect(result.blocks[blockId]).toContain('Item A');
    });

    it('processes algorithms correctly', () => {
        const input = `
            \\begin{algorithmic}
                \\STATE $x = 1$
                \\IF{x > 0}
                    \\STATE print x
                \\ENDIF
            \\end{algorithmic}
        `;
        const result = processLatex(input);

        const match = result.sanitized.match(/LATEXPREVIEWBLOCK\d+/);
        expect(match).toBeTruthy();
        const blockId = match![0];

        expect(result.blocks[blockId]).toContain('<div class="latex-algorithm">');
        expect(result.blocks[blockId]).toContain('<span class="latex-alg-keyword">if</span>');
    });

    it('processes verbatim blocks', () => {
        const input = `
            \\begin{verbatim}
                const x = 1;
                <unsafe>
            \\end{verbatim}
        `;
        const result = processLatex(input);

        const match = result.sanitized.match(/LATEXPREVIEWBLOCK\d+/);
        expect(match).toBeTruthy();
        const blockId = match![0];

        expect(result.blocks[blockId]).toContain('const x = 1;');
        expect(result.blocks[blockId]).toContain('&lt;unsafe&gt;');
    });
});
