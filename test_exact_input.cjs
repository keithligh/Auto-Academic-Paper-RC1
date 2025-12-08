// Test the EXACT input the user provided

const input = `Sentiment (Fear \\\\& Greed) & \\\\textit{Not central in forecast} & 22--28 (extreme fear)`;

console.log("=== TESTING EXACT USER INPUT ===");
console.log("Input string:", JSON.stringify(input));
console.log("Input length:", input.length);
console.log();

// Character-by-character breakdown
console.log("Character breakdown:");
for (let i = 0; i < Math.min(input.length, 35); i++) {
    console.log(`  [${i}] '${input[i]}' (code: ${input.charCodeAt(i)})`);
}
console.log("  ...");
console.log();

// The splitCells function from LatexPreview.tsx
const splitCells = (row) => {
    const cells = [];
    let currentCell = '';
    let depth = 0;
    let i = 0;

    while (i < row.length) {
        const char = row[i];

        if (char === '\\') {
            // Escape detected: treat next char as literal (even if it is & or { or })
            currentCell += char;
            if (i + 1 < row.length) {
                currentCell += row[i + 1];
                i++; // skip next char
            }
        } else if (char === '{') {
            depth++;
            currentCell += char;
        } else if (char === '}') {
            if (depth > 0) depth--;
            currentCell += char;
        } else if (char === '&' && depth === 0) {
            // Split Point
            cells.push(currentCell);
            currentCell = '';
        } else {
            currentCell += char;
        }
        i++;
    }
    cells.push(currentCell); // Push last cell
    return cells;
};

const cells = splitCells(input);
console.log("Split result:", cells.length, "cells");
cells.forEach((cell, i) => {
    console.log(`  Cell ${i}: "${cell.trim()}"`);
});

// The problem: Does \\& get treated as two escapes?
console.log("\n=== CRITICAL ANALYSIS ===");
console.log("In the input, we have:");
console.log("  Position 15: '\\' (backslash)");
console.log("  Position 16: '\\' (another backslash)");
console.log("  Position 17: '&' (ampersand)");
console.log();
console.log("The splitCells logic:");
console.log("  At i=15: char='\\', so we add '\\' + row[16]='\\', then skip to i=17");
console.log("  At i=17: char='&', depth=0, so... WE SPLIT!");
console.log();
console.log("THE BUG: \\\\& looks like:");
console.log("  - First \\: starts escape");
console.log("  - Second \\: is the escaped character");
console.log("  - &: is NOT part of the escape, so it becomes a column separator!");
