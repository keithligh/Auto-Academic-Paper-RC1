
/**
 * latex-unifier/healer.ts
 * "The Doctor"
 * 
 * Responsibility: Pre-processing text before parsing. 
 * PRESERVES THE FOLLOWING PATCHES:
 * - Math Fragment Healer: Merging $A$ = $B$ lines.
 * - Redundant Delimiter Sanitizer: Stripping $ inside \[...\].
 * - Ghost Header Exorcism: Removing \section{References} hallucinations.
 * - Markdown Stripper: Removing ```latex blocks.
 * - Ambiguous Newline Fix: Handling \n vs \\ confusion.
 * - Math Notation Normalizer: Fixes orphaned subscripts (e.g. $\theta$_t)
 */

export function healLatex(content: string): string {
    let healed = content;

    // 1. Markdown Stripper
    // Users often paste AI output that includes markdown code fences.
    // We silently strip them before processing assumes any leading backticks are garbage.
    healed = healed.replace(/^```latex\s*/i, '').replace(/```$/, '');

    // 2. Ambiguous Newline Fix
    // Normalize AI usage of literal "\n" to real newlines, but protect valid uses if any?
    // LatexPreview.tsx line 1562: html = html.replace(/\\n/g, '\n');
    // But we should be careful not to break \newline. 
    // The original logic was simplistic. Let's stick to it but refine slightly:
    // Only replace \n that is NOT followed by a letter (command) ?
    // No, AI outputs literal string "\n" sometimes.
    healed = healed.replace(/\\n(?!(ewline|ewpage|oindent|ewtheorem|ewcommand|ewenvironment))/g, '\n');

    // 3. Ghost Header Exorcism (Line 1250 in LatexPreview.tsx)
    // AI models often hallucinate a "References" section header before the bibliography, 
    // even if one is already generated.
    healed = healed.replace(/\\section\*?\s*\{\s*(?:References|Bibliography|Works\s+Cited)\s*\}/gi, '');
    healed = healed.replace(/\\subsection\*?\s*\{\s*(?:References|Bibliography|Works\s+Cited)\s*\}/gi, '');

    // 4. Math Fragment Healer (Line 787 in LatexPreview.tsx)
    // AI sometimes writes fragmented equations: "$\theta_{t+1}$ = $\theta_{t}$ + f(x)"
    // We detect specific patterns to merge them.
    // Refined Merge: $A$ = $B$ + ...
    healed = healed.replace(/(\$[^$]+\$)\s*([=])\s*(\$[^$]+\$)\s*([+])\s*(.*)$/gm, (match, p1, eq, p2, plus, rest) => {
        // Check if 'rest' looks like math (has \text or subscripts)
        if (rest.includes('\\') || rest.includes('_') || rest.includes('^')) {
            const cleanP1 = p1.slice(1, -1);
            const cleanP2 = p2.slice(1, -1);
            return `$$ ${cleanP1} = ${cleanP2} + ${rest} $$`;
        }
        return match;
    });

    // Targeted Healer: $...$ = $...$ -> $... = ...$
    healed = healed.replace(/(\$[^$]+\$)\s*([=+\-])\s*(\$[^$]+\$)/g, (m, p1, op, p2) => {
        return p1.slice(0, -1) + ' ' + op + ' ' + p2.slice(1);
    });

    // 5. Redundant Delimiter Sanitizer (Line 771 in LatexPreview.tsx)
    // AI sometimes double-wraps math: \[ $\theta$ \]
    healed = healed.replace(/\\\[([\s\S]*?)\\\]/g, (m, inner) => {
        return '\\[' + inner.replace(/(?<!\\)\$/g, '') + '\\]';
    });
    healed = healed.replace(/\\\(([\s\S]*?)\\\)/g, (m, inner) => {
        return '\\(' + inner.replace(/(?<!\\)\$/g, '') + '\\)';
    });

    // 6. Math Notation Normalization (Line 819 in LatexPreview.tsx)
    // Fix orphaned subscripts: $\theta$_t -> $\theta_t$
    healed = healed.replace(/\$([^\$]+)\$_([a-zA-Z0-9]+)/g, '$$$1_{$2}$$');
    healed = healed.replace(/\$([^\$]+)\$_\s*\{([^}]+)\}/g, '$$$1_{$2}$$');

    // 7. Table AI Typos (Line 1065 in LatexPreview.tsx)
    // "Built-in & Comprehensive" -> unescaped & causes split errors.
    healed = healed.replace(/Built-in\s+&\s+Comprehensive/g, 'Built-in \\& Comprehensive');

    // 8. Command Stripping (Line 1237)
    // Remove commands that cause clutter or server errors
    healed = healed
        .replace(/\\tableofcontents/g, '')
        .replace(/\\listoffigures/g, '')
        .replace(/\\listoftables/g, '')
        .replace(/\\input\{[^}]*\}/g, '')
        .replace(/\\include\{[^}]*\}/g, '')
        .replace(/\\newpage/g, '')
        .replace(/\\clearpage/g, '')
        .replace(/\\pagebreak/g, '')
        .replace(/\\noindent/g, '')
        .replace(/\\vspace\{[^}]*\}/g, '')
        .replace(/\\hspace\{[^}]*\}/g, '');

    return healed;
}
