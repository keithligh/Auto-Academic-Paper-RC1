
const tableBodyTex = String.raw`
Provenance & Founded in 1950 \\ \hline
Regional & Positioned in Asia \\ \hline
Platform & Emphasis on capabilities \\
`;

function processBody(body: string) {
    console.log("--- Processing Body ---");
    let tableBody = body;

    // 1. Implicit Split (v1.9.110 logic)
    tableBody = tableBody.replace(/([^\\])\\(hline|midrule|toprule|bottomrule|cline)/g, '$1\\\\ \\$2');

    // 2. Row Split
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

    console.log("Rows found:", rows.map(r => `"${r.trim()}"`));

    // 3. Border Logic (v1.9.121)
    rows.forEach((row, index) => {
        let cleanRow = row.replace(/\\(hline|midrule|toprule|bottomrule)/g, '');
        const rawRowWithoutLeadingRule = row.replace(/^\s*\\(hline|midrule|toprule|bottomrule|cline\{[^}]*\})/, '');

        const hasFullRule = rawRowWithoutLeadingRule.match(/\\(hline|midrule|bottomrule)/);

        const nextRow = rows[index + 1];
        const nextRowStartsFullRule = nextRow && nextRow.trim().match(/^\\(hline|midrule|bottomrule)/);

        const shouldHaveBorder = hasFullRule || nextRowStartsFullRule;

        const isPureRule = row.trim().match(/^\\(hline|midrule|toprule|bottomrule|cline\{[^}]*\})$/);

        console.log(`Row ${index}: Border=${!!shouldHaveBorder} (Self=${!!hasFullRule}, Next=${!!nextRowStartsFullRule}) | IsPure=${!!isPureRule}`);
        if (isPureRule) console.log("  -> Returns Empty String");
        else console.log(`  -> Render Content with class="${shouldHaveBorder ? 'with-border-bottom' : ''}"`);
    });
}

processBody(tableBodyTex);
