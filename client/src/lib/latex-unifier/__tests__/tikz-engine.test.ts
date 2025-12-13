import { describe, it, expect } from 'vitest';
import { processTikz } from '../tikz-engine';

describe('processTikz', () => {
    it('extracts a simple tikz diagram', () => {
        const input = 'Start \\begin{tikzpicture} \\node {A}; \\end{tikzpicture} End';
        const result = processTikz(input);

        expect(result.sanitized).toContain('Start');
        expect(result.sanitized).toContain('LATEXPREVIEWTIKZ0');
        expect(result.sanitized).toContain('End');
        expect(result.sanitized).not.toContain('\\begin{tikzpicture}');

        expect(result.blocks['LATEXPREVIEWTIKZ0']).toBeDefined();
        expect(result.blocks['LATEXPREVIEWTIKZ0']).toContain('<iframe');
    });

    it('extracts options correctly', () => {
        const input = '\\begin{tikzpicture}[scale=2] \\node {A}; \\end{tikzpicture}';
        const result = processTikz(input);
        const block = result.blocks['LATEXPREVIEWTIKZ0'];

        // Options are injected into the iframe HTML
        expect(block).toContain('scale=2');
    });

    it('handles multiple diagrams', () => {
        const input = 'A \\begin{tikzpicture} \\node {1}; \\end{tikzpicture} B \\begin{tikzpicture} \\node {2}; \\end{tikzpicture}';
        const result = processTikz(input);

        expect(result.sanitized).toContain('LATEXPREVIEWTIKZ0');
        expect(result.sanitized).toContain('LATEXPREVIEWTIKZ1');

        expect(result.blocks['LATEXPREVIEWTIKZ0']).toBeDefined();
        expect(result.blocks['LATEXPREVIEWTIKZ1']).toBeDefined();
    });

    it('preserves structure inside iframe', () => {
        const code = '\\node {A};\n\\node {B};';
        const input = `\\begin{tikzpicture} ${code} \\end{tikzpicture}`;
        const result = processTikz(input);
        const block = result.blocks['LATEXPREVIEWTIKZ0'];

        // Using srcdoc, so we need to check the srcdoc content.
        // It might be HTML encoded.
        // But "node {A}" should be there.
        expect(block).toContain('node {A}');
        expect(block).toContain('node {B}');
    });

    it('detects complex diagrams (pgfplots)', () => {
        const input = '\\begin{tikzpicture} \\begin{axis} ... \\end{axis} \\end{tikzpicture}';
        const result = processTikz(input);
        const block = result.blocks['LATEXPREVIEWTIKZ0'];

        expect(block).toContain('Complex diagram (pgfplots) - not supported');
    });
});
