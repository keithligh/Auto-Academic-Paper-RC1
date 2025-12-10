import { describe, it, expect } from 'vitest';
import { processTables } from '../table-engine';

describe('processTables', () => {
    // Mock formatter that just returns identity or simple bold replacement
    const mockFormatter = (text: string) => text.replace(/\\textbf\{([^}]+)\}/g, '<b>$1</b>');

    it('extracts simple tabular environment', () => {
        const input = `
            \\begin{tabular}{cc}
                A & B \\\\
                C & D \\\\
            \\end{tabular}
        `;
        const result = processTables(input, mockFormatter);

        expect(result.sanitized).toContain('LATEXPREVIEWTABLE0');
        expect(result.blocks['LATEXPREVIEWTABLE0']).toContain('<table');
        expect(result.blocks['LATEXPREVIEWTABLE0']).toContain('<td>A</td>');
        expect(result.blocks['LATEXPREVIEWTABLE0']).toContain('<td>B</td>');
    });

    it('handles nested braces and escaped ones', () => {
        const input = `
            \\begin{tabular}{c}
                Text with \\{ braces \\} & More Text \\\\
            \\end{tabular}
        `;
        const result = processTables(input, mockFormatter);

        expect(result.blocks['LATEXPREVIEWTABLE0']).toContain('Text with \\{ braces \\}');
    });

    it('handles formatting via callback', () => {
        const input = `
            \\begin{tabular}{c}
                \\textbf{Bold} \\\\
            \\end{tabular}
        `;
        const result = processTables(input, mockFormatter);

        expect(result.blocks['LATEXPREVIEWTABLE0']).toContain('<b>Bold</b>');
    });

    it('handles multicolumn', () => {
        const input = `
            \\begin{tabular}{cc}
                \\multicolumn{2}{c}{Centered} \\\\
            \\end{tabular}
        `;
        const result = processTables(input, mockFormatter);

        expect(result.blocks['LATEXPREVIEWTABLE0']).toContain('colspan="2"');
        expect(result.blocks['LATEXPREVIEWTABLE0']).toContain('Centered');
    });
});
