
const tableBodyShort = String.raw`
\textbf{Header} & \textbf{Val} \\ \hline
Row 1 & Val 1 \\ \hline
Row 2 & Val 2 \\
\hline
`;

const tableBodyBackslash = String.raw`
Header 1 & Header 2\ \hline
Row 1 & Row 2 \\
`;

function processTable(body: string, name: string) {
    console.log(`\n--- Processing ${name} ---`);
    let tableBody = body;

    // 1. Backslash Fix (Simulated from my code)
    tableBody = tableBody.replace(/\\\s+\\(hline|midrule|toprule|bottomrule|cline)/g, '\\\\ \\$1');

    // 2. Implicit Split
    tableBody = tableBody.replace(/([^\\])\\(hline|midrule|toprule|bottomrule|cline)/g, '$1\\\\ \\$2');

    // Parse Rows
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

    // Border & Content Logic
    rows.forEach((row, index) => {
        // Pure Rule Check
        if (row.trim().match(/^\\(hline|midrule|toprule|bottomrule|cline\{[^}]*\})$/)) {
            console.log(`Row ${index}: [PURE RULE] (Skipped)`);
            return;
        }

        // Logic
        let cleanRow = row.replace(/\\(hline|midrule|toprule|bottomrule)/g, '');
        const hasBold = cleanRow.includes('\\textbf');

        // Original Border Logic (Strict Whitelist)
        // const hasTrailingRule = match(midrule|bottomrule)

        // Smart Logic Proposal:
        // Allow hline IF (hasBold OR isLastRow OR isFirstRow?)
        // Let's verify what 'row' looks like for the backslash case

        console.log(`Row ${index}: "${cleanRow.trim()}"`);
        console.log(`   Original Row: "${row.trim()}"`);
    });
}

processTable(tableBodyShort, "Smart Border Candidates");
processTable(tableBodyBackslash, "Backslash Bug Candidate");
