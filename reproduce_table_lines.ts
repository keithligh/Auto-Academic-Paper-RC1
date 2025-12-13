
const tableBodyV1 = String.raw`
Header 1 & Header 2 \\ \midrule
Row 1 Col 1 & Row 1 Col 2 \\
Row 2 Col 1 & Row 2 Col 2 \\ \bottomrule
`;

const tableBodyV2 = String.raw`
Header 1 & Header 2 \\ \hline
Row 1 & Row 2 \\ \hline
Row 3 & Row 4 \\
`;

const tableBodyV3 = String.raw`
Header 1 & Header 2 \\
Row 1 & Row 2 \\
Row 3 & Row 4 \\
`;

function processTable(body: string, name: string) {
    console.log(`\n--- Processing ${name} ---`);
    let tableBody = body;
    // Replica of table-engine.ts logic
    tableBody = tableBody.replace(/([^\\])\\(hline|midrule|toprule|bottomrule|cline)/g, '$1\\\\ \\$2');

    // Row splitting
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

    // Border Logic
    rows.forEach((row, index) => {
        // 0. Check if this row is PURELY a rule (should return empty in real code)
        if (row.trim().match(/^\\(hline|midrule|toprule|bottomrule|cline\{[^}]*\})$/)) {
            console.log(`Row ${index}: [PURE RULE] -> (Skipped)`);
            return;
        }

        // 1. Strip Leading Rule
        const rawRowWithoutLeadingRule = row.replace(/^\s*\\(hline|midrule|toprule|bottomrule|cline\{[^}]*\})/, '');

        // 2. Trailing Rule
        const hasTrailingRule = rawRowWithoutLeadingRule.match(/\\(hline|midrule|bottomrule)/);

        // 3. Next Row Starts Rule
        const nextRow = rows[index + 1];
        const nextRowStartsRule = nextRow && nextRow.trim().match(/^\\(hline|midrule|bottomrule)/);

        const shouldHaveBorder = hasTrailingRule || nextRowStartsRule;

        console.log(`Row ${index}: "${row.trim()}"`);
        console.log(`   LeadingStripped: "${rawRowWithoutLeadingRule.trim()}"`);
        console.log(`   HasTrailing: ${!!hasTrailingRule}`);
        console.log(`   NextRowRule: ${!!nextRowStartsRule} (${nextRow ? nextRow.trim() : 'EOF'})`);
        console.log(`   BORDER: ${shouldHaveBorder ? 'YES' : 'NO'}`);
    });
}

processTable(tableBodyV1, "Standard Academic (Only midrule/bottomrule)");
processTable(tableBodyV2, "Heavily Lined (hline everywhere)");
processTable(tableBodyV3, "Clean (No lines)");
