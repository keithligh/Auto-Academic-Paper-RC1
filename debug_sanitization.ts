
import fs from 'fs';

// --- MOCK SANITIZATION (Copy of LatexPreview.tsx logic) ---
// We must keep this IDENTICAL to the frontend to reproduce the bug.
function sanitizeLatexForBrowser(latex: string) {
    const blocks: Record<string, string> = {};
    let blockCount = 0;

    const replaceWithMathBlock = (match: string, math: string) => {
        const id = `LATEXPREVIEWMATHBLOCK${blockCount++}`;
        blocks[id] = math;
        return `\n\n${id}\n\n`;
    };

    const createPlaceholder = (content: string) => {
        const id = `LATEXPREVIEWBLOCK${blockCount++}`;
        blocks[id] = content;
        return `\n\n${id}\n\n`;
    };

    const createUnsupportedBlock = (name: string, code: string) => {
        return createPlaceholder(`UNSUPPORTED: ${name}`);
    };

    const replaceWithTikzBlock = (match: string, code: string) => {
        const id = `LATEXPREVIEWTIKZBLOCK${blockCount++}`;
        blocks[id] = code;
        return `\n\n${id}\n\n`;
    };

    const parseLatexFormatting = (text: string): string => {
        const mathBlocks: string[] = [];
        let processed = text.replace(/(?<!\\)\$([^$]+)(?<!\\)\$/g, (match, math) => {
            mathBlocks.push(math);
            return `__MATH_BLOCK_${mathBlocks.length - 1}__`;
        });

        processed = processed
            .replace(/\\([%#_{}$])/g, (match, char) => char)
            .replace(/\\&/g, '&')
            .replace(/\\textbackslash/g, '\\');

        processed = processed
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        processed = processed.replace(/__MATH_BLOCK_(\d+)__/g, (match, index) => {
            return `$${mathBlocks[parseInt(index)]}$`;
        });

        return processed;
    };

    let content = latex;
    content = content.replace(/^```latex\s*/i, '');
    content = content.replace(/^```\s*/i, '');
    content = content.replace(/```\s*$/, '');
    content = content.trim();

    // === PREAMBLE STRIPPING (The suspected cause) ===
    content = content
        .replace(/\\usepackage(\[[^\]]*\])?\{[^}]*\}/g, '')
        .replace(/\\usetikzlibrary\{[^}]*\}/g, '')
        .replace(/\\newtheorem\{[^}]*\}\{[^}]*\}/g, '');

    content = content
        .replace(/\\maxwidth/g, '10cm')
        .replace(/\\textwidth/g, '10cm')
        .replace(/\\columnwidth/g, '10cm')
        .replace(/\{[\d\.]+\*[\d\.]+\}cm/g, '5cm')
        .replace(/\{\\maxwidth\*[\d\.]+\}cm/g, '8cm');

    content = content
        .replace(/\\begin\{CJK\}\{[^}]*\}\{[^}]*\}/g, '')
        .replace(/\\end\{CJK\}/g, '')
        .replace(/\\begin\{theorem\}/g, '\n\n\\textbf{Theorem:} ')
        .replace(/\\end\{theorem\}/g, '\n')
        .replace(/\\begin\{lemma\}/g, '\n\n\\textbf{Lemma:} ')
        .replace(/\\end\{lemma\}/g, '\n')
        .replace(/\\begin\{proposition\}/g, '\n\n\\textbf{Proposition:} ')
        .replace(/\\end\{proposition\}/g, '\n')
        .replace(/\\begin\{corollary\}/g, '\n\n\\textbf{Corollary:} ')
        .replace(/\\end\{corollary\}/g, '\n')
        .replace(/\\begin\{definition\}/g, '\n\n\\textbf{Definition:} ')
        .replace(/\\end\{definition\}/g, '\n')
        .replace(/\\begin\{hypothesis\}/g, '\n\n\\textbf{Hypothesis:} ')
        .replace(/\\end\{hypothesis\}/g, '\n')
        .replace(/\\begin\{remark\}/g, '\n\n\\textbf{Remark:} ')
        .replace(/\\end\{remark\}/g, '\n')
        .replace(/\\begin\{proof\}/g, '\n\n\\textit{Proof:} ')
        .replace(/\\end\{proof\}/g, ' \u220E\n')
        .replace(/\\qed/g, ' \u220E')
        .replace(/\\begin\{constraint\}/g, '\n\n\\textbf{Constraint:} ')
        .replace(/\\end\{constraint\}/g, '\n')
        .replace(/\\begin\{algorithm\}(?:\[.*?\])?/g, '')
        .replace(/\\end\{algorithm\}/g, '')
        .replace(/\\begin\{algorithmic\}(?:\[.*?\])?([\s\S]*?)\\end\{algorithmic\}/g, (match, code) => {
            return createPlaceholder("ALGORITHM_BLOCK");
        });

    const citationMap: Record<string, string> = {};
    content = content.replace(/\\begin\s*\{\s*thebibliography\s*\}[\s\S]*?\\end\s*\{\s*thebibliography\s*\}/gi, (match) => {
        return '';
    });

    content = content.replace(/(?:\\(?:section|subsection|subsubsection|paragraph|textbf)\*?\s*\{\s*(?:References|Bibliography|Works Cited)\s*\})/gi, '');

    const replaceCitation = (match: string, keys: string) => {
        return `[CITATION]`;
    };

    content = content
        .replace(/\\cite\{([^}]*)\}/g, replaceCitation)
        .replace(/\\citep\{([^}]*)\}/g, replaceCitation)
        .replace(/\\citet\{([^}]*)\}/g, replaceCitation)
        .replace(/\\bibitem\s*(?:\[[^\]]*\])?\s*\{[^}]*\}/g, '')
        .replace(/\\label\{[^}]*\}/g, '')
        .replace(/\\ensuremath\{([^}]*)\}/g, '$$$1$$')
        .replace(/\\ensuremath\s*(\\[a-zA-Z]+)/g, '$$$1$$')
        .replace(/\\ensuremath\s*([a-zA-Z0-9])/g, '$$$1$$')
        .replace(/\\ensuremath/g, '')
        .replace(/\\checkmark/g, '✓')
        .replace(/\\smalltriangleup/g, '\\triangle');

    content = content
        .replace(/\\begin\{equation\*?\}([\s\S]*?)\\end\{equation\*?\}/g, replaceWithMathBlock)
        .replace(/\\begin\{align\*?\}([\s\S]*?)\\end\{align\*?\}/g, (match, body) => replaceWithMathBlock(match, `\\begin{aligned}${body}\\end{aligned}`))
        .replace(/\\begin\{gather\*?\}([\s\S]*?)\\end\{gather\*?\}/g, (match, body) => replaceWithMathBlock(match, `\\begin{gathered}${body}\\end{gathered}`))
        .replace(/\\begin\{eqnarray\*?\}([\s\S]*?)\\end\{eqnarray\*?\}/g, (match, body) => replaceWithMathBlock(match, `\\begin{aligned}${body}\\end{aligned}`))
        .replace(/\\begin\{multline\*?\}([\s\S]*?)\\end\{multline\*?\}/g, (match, body) => replaceWithMathBlock(match, `\\begin{multline}${body}\\end{multline}`))
        .replace(/\\\[([\s\S]*?)\\\]/g, replaceWithMathBlock)
        .replace(/\$\$([\s\S]*?)\$\$/g, replaceWithMathBlock);

    const processTikzEnvironments = (text: string): string => {
        let result = text;
        while (true) {
            const beginMarker = '\\begin{tikzpicture}';
            const endMarker = '\\end{tikzpicture}';
            const startIndex = result.indexOf(beginMarker);
            if (startIndex === -1) break;

            let depth = 0;
            let endIndex = -1;
            let searchIndex = startIndex;

            while (searchIndex < result.length) {
                const nextBegin = result.indexOf(beginMarker, searchIndex + 1);
                const nextEnd = result.indexOf(endMarker, searchIndex + 1);

                if (nextEnd === -1) break;

                if (nextBegin !== -1 && nextBegin < nextEnd) {
                    depth++;
                    searchIndex = nextBegin;
                } else {
                    if (depth === 0) {
                        endIndex = nextEnd;
                        break;
                    }
                    depth--;
                    searchIndex = nextEnd;
                }
            }

            if (endIndex !== -1) {
                const fullMatch = result.substring(startIndex, endIndex + endMarker.length);
                const replacement = replaceWithTikzBlock(fullMatch, fullMatch);
                result = result.substring(0, startIndex) + replacement + result.substring(endIndex + endMarker.length);
            } else {
                break;
            }
        }
        return result;
    };

    content = processTikzEnvironments(content);

    content = content
        .replace(/(\\begin\s*\{\s*forest\s*\}[\s\S]*?\\end\s*\{\s*forest\s*\})/g, (match) => createUnsupportedBlock('forest', match))
        .replace(/(\\includegraphics(\[[^\]]*\])?\{[^}]*\})/g, (match) => createUnsupportedBlock('image', match));

    content = content.replace(/\\begin\{verbatim\}([\s\S]*?)\\end\{verbatim\}/g, (match: string, code: string) => {
        return createPlaceholder("VERBATIM");
    });

    content = content.replace(/\\begin\{lstlisting\}(?:\[.*?\])?([\s\S]*?)\\end\{lstlisting\}/g, (match: string, code: string) => {
        return createPlaceholder("LSTLISTING");
    });

    content = content.replace(/\\begin\{tabularx\}(?:\[[^\]]*\])?\s*\{[^}]*\}\s*\{([^}]*)\}/g, '\\begin{tabular}{$1}')
        .replace(/\\end\{tabularx\}/g, '\\end{tabular}');

    content = content.replace(/\\begin\{tabular\}(?:\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})?([\s\S]*?)\\end\{tabular\}/g, (match: string, body: string) => {
        return createPlaceholder("TABLE");
    });

    content = content
        .replace(/\\begin\{table\}[\s\S]*?\\end\{table\}/g, (match: string) => {
            return match.replace(/\\begin\{table\}(\[.*?\])?/g, '').replace(/\\end\{table\}/g, '');
        })
        .replace(/(\\begin\{tabularx\}[\s\S]*?\\end\{tabularx\})/g, (match) => createUnsupportedBlock('tabularx', match))
        .replace(/(\\begin\{longtable\}[\s\S]*?\\end\{longtable\})/g, (match) => createUnsupportedBlock('longtable', match));

    content = content
        .replace(/\\begin\{figure\}(\[[^\]]*\])?\s*/g, '\n')
        .replace(/\\end\{figure\}/g, '\n')
        .replace(/\\caption\{[^}]*\}/g, '')
        .replace(/\\label\{[^}]*\}/g, '')
        .replace(/\\ref\{([^}]*)\}/g, '[REF]');

    content = content
        .replace(/\\input\{[^}]*\}/g, '')
        .replace(/\\include\{[^}]*\}/g, '')
        .replace(/\\tableofcontents/g, '')
        .replace(/\\listoffigures/g, '')
        .replace(/\\listoftables/g, '')
        .replace(/\\text\{/g, '\\textrm{')
        .replace(/(?<!\$)\\theta/g, '$\\theta$');

    return content;
}

// --- DEEP ANALYSIS ---
function analyzeStructure(text: string) {
    const lines = text.split('\n');
    const stack: { type: string, line: number, name?: string, col: number }[] = [];
    const report: string[] = [];

    report.push("=== STRUCTURAL ANALYSIS REPORT ===");
    report.push(`Total Lines: ${lines.length}`);

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // 1. Check Braces {}
        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '{') {
                if (j > 0 && line[j - 1] === '\\') continue;
                stack.push({ type: '{', line: i + 1, col: j + 1 });
            } else if (char === '}') {
                if (j > 0 && line[j - 1] === '\\') continue;

                if (stack.length > 0 && stack[stack.length - 1].type === '{') {
                    stack.pop();
                } else {
                    report.push(`[ERROR] Unmatched '}' at Line ${i + 1}, Col ${j + 1}`);
                    report.push(`Context: ${line.trim()}`);
                }
            }
        }

        // 2. Check Environments \begin{} \end{}
        // We use a simple regex that assumes one environment per line for simplicity, 
        // or we iterate. Iterating is safer.
        const beginRegex = /\\begin\{([^}]+)\}/g;
        let match;
        while ((match = beginRegex.exec(line)) !== null) {
            stack.push({ type: 'env', name: match[1], line: i + 1, col: match.index + 1 });
        }

        const endRegex = /\\end\{([^}]+)\}/g;
        while ((match = endRegex.exec(line)) !== null) {
            const envName = match[1];
            let found = false;
            // Search stack from top
            for (let k = stack.length - 1; k >= 0; k--) {
                if (stack[k].type === 'env' && stack[k].name === envName) {
                    stack.splice(k, 1); // Remove it
                    found = true;
                    break;
                }
            }
            if (!found) {
                report.push(`[ERROR] Unmatched \\end{${envName}} at Line ${i + 1}`);
                report.push(`Context: ${line.trim()}`);
            }
        }
    }

    if (stack.length > 0) {
        report.push("\n=== UNBALANCED ITEMS REMAINING ===");
        stack.forEach(item => {
            report.push(`[REMAINING] ${item.type} ${item.name || ''} (Started at Line ${item.line}, Col ${item.col})`);
            // Show the line content for context
            const contextLine = lines[item.line - 1] || "";
            report.push(`   Context: ${contextLine.substring(0, 100)}...`);
        });
    } else {
        report.push("\n=== SUCCESS: STRUCTURE IS BALANCED ===");
    }

    // Write report to file
    fs.writeFileSync('analysis_report.txt', report.join('\n'));
    console.log("Analysis complete. Report written to analysis_report.txt");
}

try {
    const rawLatex = fs.readFileSync('debug_latex.tex', 'utf-8');
    console.log("Sanitizing...");
    const sanitized = sanitizeLatexForBrowser(rawLatex);

    console.log("Analyzing...");
    analyzeStructure(sanitized);

    // Also save sanitized for manual inspection
    fs.writeFileSync('debug_sanitized_full.tex', sanitized);

} catch (e) {
    console.error("Error:", e);
}
