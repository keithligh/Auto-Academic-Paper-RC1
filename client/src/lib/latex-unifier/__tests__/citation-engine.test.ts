import { describe, it, expect } from 'vitest';
import { processCitations } from '../citation-engine';

describe('processCitations', () => {
    it('formats simple citations [1]', () => {
        const input = 'As seen in \\cite{ref_1}.';
        const result = processCitations(input);
        expect(result.sanitized).toContain('As seen in [1].');
        expect(result.bibliographyHtml).toContain('[1]');
    });

    it('groups sequential citations [1]-[3]', () => {
        const input = '\\cite{ref_1, ref_2, ref_3}';
        const result = processCitations(input);
        expect(result.sanitized).toBe('[1]–[3]');
    });

    it('handles explicit ref numbers ref_5 -> [5]', () => {
        const input = '\\cite{ref_5}';
        const result = processCitations(input);
        expect(result.sanitized).toBe('[5]');
        expect(result.bibliographyHtml).toContain('[5]');
    });

    it('handles consecutive parentheses (ref_1)(ref_2)', () => {
        const input = '(ref_1)(ref_2)';
        const result = processCitations(input);
        expect(result.sanitized).toContain('[1]–[2]'); // Should group
    });

    it('generates bibliography', () => {
        const input = '\\cite{foo} and \\cite{bar}';
        const result = processCitations(input);
        expect(result.bibliographyHtml).toContain('References');
        expect(result.bibliographyHtml).toContain('foo');
        expect(result.bibliographyHtml).toContain('bar');
    });

    it('does not generate bibliography if manual one exists', () => {
        const input = '\\cite{foo} \\begin{thebibliography} ... \\end{thebibliography}';
        const result = processCitations(input);
        expect(result.bibliographyHtml).toBeNull();
    });
});
