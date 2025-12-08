// Test file for debugging table cell splitting

const row = 'Fear \\& Greed & test';
console.log('Input row:', JSON.stringify(row));
console.log('Row length:', row.length);
console.log();

// Check each character
console.log('Character breakdown:');
for (let i = 0; i < row.length; i++) {
    console.log(`  [${i}] char=${JSON.stringify(row[i])} code=${row.charCodeAt(i)}`);
}
console.log();

// The actual splitCells function from LatexPreview.tsx
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

console.log('Split result:', splitCells(row));
