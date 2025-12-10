/**
 * Table Engine for LaTeX Preview
 * 
 * EXTRACTED FROM: LatexPreview.tsx
 * SCOPE: Manual Table Walker, row splitting, cell splitting.
 * STRATEGY: Dependency Injection for formatting to avoid circular deps.
 */

export interface TableResult {
    sanitized: string;
    blocks: Record<string, string>;
}

export function processTables(text: string, formatText: (s: string) => string): TableResult {
    const blocks: Record<string, string> = {};
    let blockCount = 0;

    const createPlaceholder = (html: string): string => {
        // Unique ID for Tables to avoid collision with main counter
        const id = `LATEXPREVIEWTABLE${blockCount++}`;
        blocks[id] = html;
        return `\n\n${id}\n\n`; // Add whitespace for safety
    };

    const beginTags = ['\\begin{tabular}', '\\begin{tabularx}', '\\begin{longtable}'];
    let searchPos = 0;
    let result = '';

    while (searchPos < text.length) {
        let firstMatchIndex = -1;
        let matchedTag = '';

        for (const tag of beginTags) {
            const idx = text.indexOf(tag, searchPos);
            if (idx !== -1 && (firstMatchIndex === -1 || idx < firstMatchIndex)) {
                firstMatchIndex = idx;
                matchedTag = tag;
            }
        }

        if (firstMatchIndex === -1) {
            result += text.substring(searchPos);
            break;
        }

        result += text.substring(searchPos, firstMatchIndex);

        const envName = matchedTag.replace('\\begin{', '').replace('}', '');
        const endTag = `\\end{${envName}}`;

        let depth = 1;
        let currentPos = firstMatchIndex + matchedTag.length;
        let tableContentEnd = -1;

        while (currentPos < text.length) {
            if (text.startsWith(`\\begin{${envName}}`, currentPos)) {
                depth++;
                currentPos += matchedTag.length;
            } else if (text.startsWith(endTag, currentPos)) {
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
            result += text.substring(firstMatchIndex);
            break;
        }

        let contentStart = firstMatchIndex + matchedTag.length;

        // Skip arguments like {lcr} or {|p{3cm}|}
        let argDepth = 0;
        let inArgs = false;
        let bodyStartIndex = contentStart;

        let i = contentStart;
        while (i < tableContentEnd) {
            if (text[i] === '{') {
                argDepth++;
                inArgs = true;
            } else if (text[i] === '}') {
                argDepth--;
            } else if (!inArgs && text[i] !== ' ' && text[i] !== '[') {
                // Heuristic: If we hit non-brace/non-space, we might be in body.
            }

            if (inArgs && argDepth === 0) {
                let nextCharIdx = i + 1;
                while (nextCharIdx < tableContentEnd && text[nextCharIdx] === ' ') nextCharIdx++;
                if (text[nextCharIdx] === '{') {
                    i = nextCharIdx - 1;
                    inArgs = false;
                } else {
                    bodyStartIndex = i + 1;
                    break;
                }
            }
            i++;
        }

        const tableBody = text.substring(bodyStartIndex, tableContentEnd);

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

        // CELL SPLITTING
        const htmlRows = rows.map(row => {
            if (row.trim().match(/^\\(hline|midrule|toprule|bottomrule)$/)) return '';

            let cleanRow = row.replace(/\\(hline|midrule|toprule|bottomrule)/g, '');

            const cells: string[] = [];
            let currentCell = '';
            braceDepth = 0;

            for (let k = 0; k < cleanRow.length; k++) {
                const char = cleanRow[k];
                if (char === '\\' && cleanRow[k + 1] === '&') {
                    currentCell += '&';
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
                    const content = formatText(multicolMatch[2]);
                    return `<td colspan="${span}">${content}</td>`;
                }
                return `<td>${formatText(cell)}</td>`;
            }).join('');

            return `<tr>${htmlCells}</tr>`;
        }).join('');

        result += createPlaceholder(`<div class="table-wrapper"><table><tbody>${htmlRows}</tbody></table></div>`);

        searchPos = tableContentEnd + endTag.length;
    }

    return { sanitized: result, blocks };
}
