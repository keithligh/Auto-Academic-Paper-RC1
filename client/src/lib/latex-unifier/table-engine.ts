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

        let tableBody = text.substring(bodyStartIndex, tableContentEnd);

        // Fix: Double Escape Sanitization (v1.9.36)
        // If the AI outputs "Fear \\& Greed", the engine sees "row break" + "&".
        // We revert \\& -> \& before splitting.
        tableBody = tableBody.replace(/\\\\&/g, '\\&');

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

        // CELL SPLITTING with ROWSPAN TRACKING
        // Track which column positions have active rowspans
        const activeRowspans: Map<number, number> = new Map(); // column -> remaining rows

        const htmlRows = rows.map(row => {
            if (row.trim().match(/^\\(hline|midrule|toprule|bottomrule|cline\{[^}]*\})$/)) return '';

            let cleanRow = row.replace(/\\(hline|midrule|toprule|bottomrule)/g, '');
            // Strip \cline{X-Y} commands (partial horizontal lines)
            cleanRow = cleanRow.replace(/\\cline\{[^}]*\}/g, '');

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

            // Process cells with column position awareness
            let actualColPos = 0;
            const htmlCellsArr: string[] = [];

            for (let cellIdx = 0; cellIdx < cells.length; cellIdx++) {
                // Skip columns that have active rowspans
                while (activeRowspans.has(actualColPos) && activeRowspans.get(actualColPos)! > 0) {
                    actualColPos++;
                }

                const cell = cells[cellIdx];

                // If cell is empty and this is likely a multirow continuation, skip it
                // This handles the LaTeX pattern where rows under multirow start with &
                if (cell === '' && cellIdx === 0) {
                    // Check if there's an active rowspan at column 0
                    // If so, this empty cell is the "shadow" of the rowspan - skip it
                    // If not, it's a genuinely empty first cell - render it
                    if (activeRowspans.has(0) && activeRowspans.get(0)! > 0) {
                        continue; // Skip this phantom cell
                    }
                }

                // Handle \multicolumn{N}{align}{content}
                const multicolMatch = cell.match(/^\\multicolumn\{(\d+)\}\{[^}]+\}\{([\s\S]*)\}$/);
                if (multicolMatch) {
                    const span = parseInt(multicolMatch[1]);
                    const content = formatText(multicolMatch[2]);
                    htmlCellsArr.push(`<td colspan="${span}">${content}</td>`);
                    actualColPos += span;
                    continue;
                }

                // Handle \multirow{N}{width}{content}
                if (cell.startsWith('\\multirow{')) {
                    const multirowBasic = cell.match(/^\\multirow\{(\d+)\}/);
                    if (multirowBasic) {
                        const rowspan = parseInt(multirowBasic[1]);
                        const startPos = multirowBasic[0].length;

                        let braceCount = 0;
                        let argNum = 0;
                        let contentStart = -1;
                        let contentEnd = -1;

                        for (let i = startPos; i < cell.length; i++) {
                            if (cell[i] === '{') {
                                braceCount++;
                                if (braceCount === 1) {
                                    argNum++;
                                    if (argNum === 2) contentStart = i + 1;
                                }
                            } else if (cell[i] === '}') {
                                braceCount--;
                                if (braceCount === 0 && argNum === 2) {
                                    contentEnd = i;
                                    break;
                                }
                            }
                        }

                        if (contentStart !== -1 && contentEnd !== -1) {
                            const content = cell.substring(contentStart, contentEnd);
                            htmlCellsArr.push(`<td rowspan="${rowspan}">${formatText(content)}</td>`);
                            // Track this rowspan for subsequent rows
                            activeRowspans.set(actualColPos, rowspan);
                        } else {
                            htmlCellsArr.push(`<td>${formatText(cell)}</td>`);
                        }
                        actualColPos++;
                        continue;
                    }
                }

                // Default cell
                htmlCellsArr.push(`<td>${formatText(cell)}</td>`);
                actualColPos++;
            }

            // Decrement all active rowspans for next row
            Array.from(activeRowspans.keys()).forEach(col => {
                const count = activeRowspans.get(col)!;
                if (count > 1) {
                    activeRowspans.set(col, count - 1);
                } else {
                    activeRowspans.delete(col);
                }
            });

            return `<tr>${htmlCellsArr.join('')}</tr>`;
        }).join('');

        result += createPlaceholder(`<div class="table-wrapper"><table><tbody>${htmlRows}</tbody></table></div>`);

        searchPos = tableContentEnd + endTag.length;
    }

    return { sanitized: result, blocks };
}
