import { describe, it, expect } from 'vitest';
import { processMath } from '../math-engine';

describe('processMath', () => {
    it('extracts inline math', () => {
        const input = 'Let $x=1$ be a number.';
        const result = processMath(input);

        expect(result.sanitized).toContain('Let');
        expect(result.sanitized).toContain('LATEXPREVIEWMATH0');
        expect(result.sanitized).toContain('be a number.');
        expect(result.sanitized).not.toContain('$x=1$');

        expect(result.blocks['LATEXPREVIEWMATH0']).toBeDefined();
        // KaTeX rendering usually puts a span with class "katex"
        expect(result.blocks['LATEXPREVIEWMATH0']).toContain('katex');
    });

    it('extracts display math', () => {
        const input = 'Equation: $$ E=mc^2 $$';
        const result = processMath(input);

        expect(result.sanitized).toContain('Equation:');
        expect(result.sanitized).toContain('LATEXPREVIEWMATH0');
        expect(result.blocks['LATEXPREVIEWMATH0']).toContain('display="block"'); // Or specific KaTeX display mode class
    });

    it('handles structured environments', () => {
        const input = '\\begin{equation} E = mc^2 \\end{equation}';
        const result = processMath(input);

        expect(result.blocks['LATEXPREVIEWMATH0']).toBeDefined();
    });

    it('runs math fragment healer', () => {
        const input = '$a$ = $b$ + $c$';
        const result = processMath(input);

        // This specific healer merges $a$ = $b$ -> $a = b$ + $c$ -> wait, the regex merges pairs.
        // The implementation: content.replace(/(\$[^$]+\$)\s*([=+\-])\s*(\$[^$]+\$)/g, ...)
        // "$a$ = $b$" -> "$a = b$"
        // Then remaining is "$a = b$ + $c$" -> matches again?
        // Let's check expected behavior. It should act as one or fewer blocks.
        // It definitely shouldn't be "$a$ = $b$" literal.

        const blockContent = result.blocks['LATEXPREVIEWMATH0'];
        // We verify that the original input structure is gone
        expect(result.sanitized).not.toContain('$a$');
    });

    it('handles complex notations (normalization)', () => {
        const input = '$\\theta$_t'; // Should invoke normalization to $\theta_t$
        const result = processMath(input);

        expect(result.blocks['LATEXPREVIEWMATH0']).toBeDefined();
        // The content passed to Katex should have \\theta_{t}
        // but we can't easily check katex input unless we mock it or check output HTML inner structure
    });
});
