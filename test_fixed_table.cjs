// Test the FIXED smartSplitRows function (v2 - handles ALL double-escaped commands)

const smartSplitRows = (text) => {
    const res = [];
    let buf = '';
    let depth = 0;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (c === '{') depth++;
        else if (c === '}') depth--;

        // Detect \\ at depth 0
        if (depth === 0 && c === '\\' && text[i + 1] === '\\') {
            const nextAfterSlashes = text[i + 2];

            // Determine if this is a ROW BREAK or a DOUBLE-ESCAPED COMMAND
            const isRowBreak =
                nextAfterSlashes === undefined ||  // End of string
                nextAfterSlashes === '\n' ||        // Newline
                nextAfterSlashes === '\r' ||        // Carriage return
                nextAfterSlashes === ' ' ||         // Space
                nextAfterSlashes === '\t' ||        // Tab
                nextAfterSlashes === '[' ||         // Optional arg for row height
                nextAfterSlashes === '\\';          // Another \\ 

            if (isRowBreak) {
                // Actual row break
                res.push(buf);
                buf = '';
                i++; // Skip second slash
                continue;
            } else {
                // Double-escaped command - normalize to single backslash
                buf += '\\';
                i++; // Skip to second slash
                continue;
            }
        }
        buf += c;
    }
    if (buf) res.push(buf);
    return res;
};

const splitCells = (row) => {
    const cells = [];
    let currentCell = '';
    let depth = 0;
    let i = 0;

    while (i < row.length) {
        const char = row[i];

        if (char === '\\') {
            currentCell += char;
            if (i + 1 < row.length) {
                currentCell += row[i + 1];
                i++;
            }
        } else if (char === '{') {
            depth++;
            currentCell += char;
        } else if (char === '}') {
            if (depth > 0) depth--;
            currentCell += char;
        } else if (char === '&' && depth === 0) {
            cells.push(currentCell);
            currentCell = '';
        } else {
            currentCell += char;
        }
        i++;
    }
    cells.push(currentCell);
    return cells;
};

// Simulate the ACTUAL input
const tableBody = `\\hline
    Metric & AI Forecast & Realized (Approx.) \\\\
    \\hline
    Spot price (USD) & 105{,}000--109{,}000 & 106{,}827 \\\\
    Sentiment (Fear \\\\& Greed) & \\\\textit{Not central in forecast} & 22--28 (extreme fear) \\\\
    \\hline`;

console.log("=== TESTING FIXED TABLE PARSING (v2) ===");
console.log("\nInput table body:");
console.log(tableBody);

console.log("\n=== Step 1: smartSplitRows ===");
const rows = smartSplitRows(tableBody).filter(r => r.trim());
rows.forEach((row, i) => {
    // Clean up for display
    const display = row.length > 80 ? row.substring(0, 80) + '...' : row;
    console.log(`Row ${i}: ${JSON.stringify(display)}`);
});

console.log("\n=== Step 2: Process 'Sentiment' row ===");
const sentimentRow = rows.find(r => r.includes('Sentiment'));
if (sentimentRow) {
    console.log("Full row:", JSON.stringify(sentimentRow));
    const cleanedRow = sentimentRow.trim()
        .replace(/\\hline/g, '')
        .replace(/\\toprule/g, '')
        .replace(/\\midrule/g, '')
        .replace(/\\bottomrule/g, '');
    console.log("Cleaned:", JSON.stringify(cleanedRow));

    const cells = splitCells(cleanedRow.trim());
    console.log("\nCells found:", cells.length);
    cells.forEach((cell, i) => {
        console.log(`  Cell ${i}: "${cell.trim()}"`);
    });

    // Check success criteria
    const firstCell = cells[0]?.trim() || '';
    const secondCell = cells[1]?.trim() || '';
    const thirdCell = cells[2]?.trim() || '';

    if (cells.length === 3 &&
        firstCell.includes("Fear") && firstCell.includes("Greed") &&
        secondCell.includes("textit")) {
        console.log("\n✅ SUCCESS: Table cells are correct!");
        console.log("  - Cell 0: Contains 'Fear & Greed' together");
        console.log("  - Cell 1: Contains '\\textit' command");
        console.log("  - Cell 2: Contains '22--28'");
    } else {
        console.log("\n❌ FAIL: Table cells are incorrect!");
    }
} else {
    console.log("Could not find Sentiment row!");
}
