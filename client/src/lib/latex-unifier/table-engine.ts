
/**
 * latex-unifier/table-engine.ts
 * "The Grid"
 * 
 * Responsibility: Handling Tables and Arrays. 
 * PRESERVES:
 * - Scorched Earth Walker: Manual character-by-character parsing.
 * - Double-Escape Fix: Handling \\& vs \&.
 * - Thousand Separator Fix: Handling {,}.
 * - Math Safety: Math placeholders are generated before this step.
 */

import katex from 'katex';

let blockCount = 0;

// === SHARED FORMATTING (Localized to ensure self-sufficiency for now) ===
// Ideally this should be in a separate formatter.ts, but to ensure strict copying of logic:
export const parseLatexFormatting = (text: string, blocks?: Record<string, string>): string => {
    // 1. Protection Protocol: Extract inline math
    const mathPlaceholders: string[] = [];
    let protectedText = text.replace(/(?<!\\)\$([^$]+)(?<!\\)\$/g, (m, math) => {
        mathPlaceholders.push(katex.renderToString(math, { throwOnError: false }));
        return `__MATH_PROTECT_${mathPlaceholders.length - 1}__`;
    });

    // 2. Unescape
    protectedText = protectedText
        .replace(/\\%/g, '%')
        .replace(/\\\&/g, '&')
        .replace(/\\#/g, '#')
        .replace(/\\_/g, '_')
        .replace(/\\\{/g, '{')
        .replace(/\\\}/g, '}');

    // 3. HTML Escape
    protectedText = protectedText
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // 4. Typography
    protectedText = protectedText
        .replace(/---/g, '&mdash;')
        .replace(/--/g, '&ndash;')
        .replace(/``/g, '&ldquo;')
        .replace(/''/g, '&rdquo;')
        .replace(/\\textcircled\{([^{}])\}/g, '($1)');

    // 5. Macro Replacement
    const nested = '([^{}]*(?:\\{[^{}]*\\}[^{}]*)*)';
    protectedText = protectedText
        .replace(/\\eqref\{([^{}]*)\}/g, '(\\ref{$1})')
        .replace(/\\ref\s*\{([^{}]*)\}/g, '[$1]')
        .replace(/\\label\{([^{}]*)\}/g, '')
        .replace(/\\url\{([^{}]*)\}/g, '<code>$1</code>')
        .replace(/\\footnote\{([^{}]*)\}/g, ' ($1)')
        .replace(new RegExp(`\\\\textbf\\{${nested}\\}`, 'g'), '<strong>$1</strong>')
        .replace(new RegExp(`\\\\textit\\{${nested}\\}`, 'g'), '<em>$1</em>')
        .replace(new RegExp(`\\\\emph\\{${nested}\\}`, 'g'), '<em>$1</em>')
        .replace(new RegExp(`\\\\underline\\{${nested}\\}`, 'g'), '<u>$1</u>')
        .replace(new RegExp(`\\\\texttt\\{${nested}\\}`, 'g'), '<code>$1</code>')
        .replace(new RegExp(`\\\\textsc\\{${nested}\\}`, 'g'), '<span style="font-variant: small-caps;">$1</span>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>') // Markdown
        .replace(/\\bullet/g, '&#8226;')
        .replace(/~/g, '&nbsp;')
        .replace(/\\times/g, '&times;')
        .replace(/\\checkmark/g, '&#10003;')
        .replace(/\\approx/g, '&#8776;')
        .replace(/\\,/g, '&thinsp;')
        .replace(/\\rightarrow/g, '&rarr;')
        .replace(/\\Rightarrow/g, '&rArr;')
        .replace(/\\leftarrow/g, '&larr;')
        .replace(/\\Leftarrow/g, '&lArr;')
        .replace(/\\leftrightarrow/g, '&harr;')
        .replace(/\\Leftrightarrow/g, '&hArr;')
        .replace(/\\longrightarrow/g, '&rarr;')
        .replace(/\\Longrightarrow/g, '&rArr;')
        .replace(/\{:\}/g, ':')
        .replace(/\{,\}/g, ',')
        .replace(/\\:/g, ':')
        .replace(/\\\//g, '/')
        .replace(/\\\\/g, '<br/>')
        .replace(/\\newline/g, '<br/>');

    // 6. Restore Math
    protectedText = protectedText.replace(/__MATH_PROTECT_(\d+)__/g, (m, idx) => mathPlaceholders[parseInt(idx)]);

    // 7. Restore Global Placeholders if blocks provided
    if (blocks) {
        // This is redundant if we re-inject at end, but keeping safety
    }

    return protectedText;
};

// === HELPER: Create Placeholder ===
const createPlaceholder = (html: string, blocks: Record<string, string>, prefix: string = 'LATEXPREVIEWTABLE'): string => {
    const id = `${prefix}${blockCount++}`;
    blocks[id] = html;
    return `\n\n${id}\n\n`;
};

// === MAIN PROCESSOR ===
export function processTables(text: string, blocks: Record<string, string>): { cleanedContent: string; } {
    let result = text;

    // --- PHASE 1: TABULAR EXTRACTION (Scorched Earth Walker) ---
    // We strictly extract tabulars FIRST. They become LATEXPREVIEWTABLE...

    const beginTags = ['\\begin{tabular}', '\\begin{tabularx}', '\\begin{longtable}'];
    let searchPos = 0;

    // We walk the string to extract tabulars
    // NOTE: We must rebuild 'result' during this walk to replace the extracted parts.
    let tabularPassResult = '';
    let currentContent = result;

    while (searchPos < currentContent.length) {
        let firstMatchIndex = -1;
        let matchedTag = '';

        for (const tag of beginTags) {
            const idx = currentContent.indexOf(tag, searchPos);
            if (idx !== -1 && (firstMatchIndex === -1 || idx < firstMatchIndex)) {
                firstMatchIndex = idx;
                matchedTag = tag;
            }
        }

        if (firstMatchIndex === -1) {
            tabularPassResult += currentContent.substring(searchPos);
            break;
        }

        tabularPassResult += currentContent.substring(searchPos, firstMatchIndex);

        const envName = matchedTag.replace('\\begin{', '').replace('}', '');
        const endTag = `\\end{${envName}}`;

        let depth = 1;
        let currentPos = firstMatchIndex + matchedTag.length;
        let tableContentEnd = -1;

        // Depth Finder
        while (currentPos < currentContent.length) {
            if (currentContent.startsWith(`\\begin{${envName}}`, currentPos)) {
                depth++;
                currentPos += matchedTag.length;
            } else if (currentContent.startsWith(endTag, currentPos)) {
                depth--;
                if (depth === 0) {
                    tableContentEnd = currentPos;
                    break;
                }
                currentPos += endTag.length;
            } else {
                currentPos++;
            }
        }

        if (tableContentEnd === -1) {
            tabularPassResult += currentContent.substring(firstMatchIndex);
            break;
        }

        let contentStart = firstMatchIndex + matchedTag.length;

        // Skip arguments ({lcr}, {|p{3cm}|})
        let i = contentStart;
        let argDepth = 0;
        let inArgs = false;
        let bodyStartIndex = contentStart;

        while (i < tableContentEnd) {
            if (currentContent[i] === '{') {
                argDepth++;
                inArgs = true;
            } else if (currentContent[i] === '}') {
                argDepth--;
            } else if (!inArgs && currentContent[i] !== ' ' && currentContent[i] !== '[') {
                // End of args
            }

            if (inArgs && argDepth === 0) {
                // Check if next char is another brace group
                let nextCharIdx = i + 1;
                while (nextCharIdx < tableContentEnd && currentContent[nextCharIdx] === ' ') nextCharIdx++;
                if (currentContent[nextCharIdx] === '{') {
                    i = nextCharIdx - 1;
                    inArgs = false;
                } else {
                    bodyStartIndex = i + 1;
                    break; // Body starts
                }
            }
            i++;
        }

        const tableBody = currentContent.substring(bodyStartIndex, tableContentEnd);

        // ROW SPLITTING
        const rows: string[] = [];
        let currentRow = '';
        let braceDepth = 0;

        for (let j = 0; j < tableBody.length; j++) {
            const char = tableBody[j];
            if (char === '{') braceDepth++;
            else if (char === '}') braceDepth--;

            if (braceDepth === 0 && char === '\\' && tableBody[j + 1] === '\\') {
                rows.push(currentRow);
                currentRow = '';
                j++;
            } else {
                currentRow += char;
            }
        }
        if (currentRow.trim()) rows.push(currentRow);

        // CELL SPLITTING & HTML GEN
        const htmlRows = rows.map(row => {
            if (row.trim().match(/^\\(hline|midrule|toprule|bottomrule)$/)) return '';
            let cleanRow = row.replace(/\\(hline|midrule|toprule|bottomrule)/g, '');

            const cells: string[] = [];
            let currentCell = '';
            braceDepth = 0;

            for (let k = 0; k < cleanRow.length; k++) {
                const char = cleanRow[k];
                if (char === '\\' && cleanRow[k + 1] === '&') {
                    currentCell += '&'; // Escaped ampersand becomes literal &
                    k++;
                    continue;
                }

                if (char === '{') braceDepth++;
                else if (char === '}') braceDepth--;

                if (braceDepth === 0 && char === '&') {
                    cells.push(currentCell.trim());
                    currentCell = '';
                } else {
                    currentCell += char;
                }
            }
            cells.push(currentCell.trim());

            const htmlCells = cells.map(cell => {
                const multicolMatch = cell.match(/^\\multicolumn\{(\d+)\}\{[^}]+\}\{([\s\S]*)\}$/);
                if (multicolMatch) {
                    const span = multicolMatch[1];
                    const content = parseLatexFormatting(multicolMatch[2]);
                    return `<td colspan="${span}">${content}</td>`;
                }
                return `<td>${parseLatexFormatting(cell)}</td>`;
            }).join('');

            return `<tr>${htmlCells}</tr>`;
        }).join('');

        // Store inner table in blocks
        tabularPassResult += createPlaceholder(`<div class="table-wrapper"><table><tbody>${htmlRows}</tbody></table></div>`, blocks);
        searchPos = tableContentEnd + endTag.length;
    }

    result = tabularPassResult;

    // --- PHASE 2: WRAPPER EXTRACTION (\begin{table}) ---
    // Now we extract the \begin{table} wrappers that CONTAIN the just-created placeholders.
    // We store the result in LATEXPREVIEWTABLEENV... to protect the wrapper HTML.

    let tableEnvStart = result.indexOf('\\begin{table}');
    while (tableEnvStart !== -1) {
        // Find end
        let depth = 1;
        let pos = tableEnvStart + 13;
        let endPos = -1;
        while (pos < result.length) {
            if (result.startsWith('\\begin{table}', pos)) depth++;
            if (result.startsWith('\\end{table}', pos)) {
                depth--;
                if (depth === 0) {
                    endPos = pos;
                    break;
                }
            }
            pos++;
        }

        if (endPos !== -1) {
            const innerContent = result.substring(tableEnvStart + 13, endPos);

            // Extract caption
            let caption = '';
            let captionCleanedContent = innerContent.replace(/\\caption\{([^{}]+)\}/, (m, c) => {
                caption = c;
                return '';
            });

            // Remove positioning [h!]
            if (captionCleanedContent.trim().startsWith('[')) {
                const closeBracket = captionCleanedContent.indexOf(']');
                if (closeBracket !== -1) captionCleanedContent = captionCleanedContent.substring(closeBracket + 1);
            }

            // Remove \centering
            captionCleanedContent = captionCleanedContent.replace(/\\centering/g, '');

            // HTML Generation (Wrapper + Caption + Inner Content)
            // Inner Content likely contains LATEXPREVIEWTABLE... which will be substituted later.
            // We put this whole thing into a block so it doesn't get escaped.
            const wrapperHtml = `<div class="table-figure"><figcaption style="text-align:center; margin-bottom: 0.5em;"><strong>Table:</strong> ${caption}</figcaption>${captionCleanedContent}</div>`;

            const replacement = createPlaceholder(wrapperHtml, blocks, 'LATEXPREVIEWTABLEENV');

            result = result.substring(0, tableEnvStart) + replacement + result.substring(endPos + 11);

            // Search again from start (safer as string length changed)
            // Optimization: start searching from where we left off (replacement length)
            // But replacement causes index shift. Just simplistic approach:
            tableEnvStart = result.indexOf('\\begin{table}');
        } else {
            break; // malformed
        }
    }


    return { cleanedContent: result };
}
