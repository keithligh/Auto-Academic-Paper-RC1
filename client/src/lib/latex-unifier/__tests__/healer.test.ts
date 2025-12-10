import { describe, it, expect } from 'vitest';
import { healLatex } from '../healer';

describe('healLatex', () => {
    it('strips markdown fences', () => {
        // Test with exact behavior expectation
        const input = '```latex\n$x = y$\n```';
        // The regex /^```latex\s*/i matches "```latex\n".
        // The regex /```$/ matches the trailing "```".
        // Code inside: "$x = y$\n"
        // Expected: "$x = y$\n"
        const result = healLatex(input);
        expect(result).toBe('$x = y$\n');
    });

    it('does not touch plain latex', () => {
        const input = '$x = y$';
        expect(healLatex(input)).toBe(input);
    });
});
