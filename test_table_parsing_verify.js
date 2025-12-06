
// Mocking the FIXED logic from LatexPreview.tsx
const parseTabular = (inner) => {
    const startTag = '\\begin{tabular}';
    const startIdx = inner.indexOf(startTag);
    if (startIdx === -1) {
        console.log("Start tag not found");
        return null;
    }

    let cursor = startIdx + startTag.length;

    // HELPER: Skip Whitespace (THE FIX)
    while (cursor < inner.length && /\s/.test(inner[cursor])) {
        cursor++;
    }

    // Optional arg [pos]
    if (inner[cursor] === '[') {
        while (cursor < inner.length && inner[cursor] !== ']') cursor++;
        cursor++; // skip ]
        // Skip whitespace again after optional arg (THE FIX)
        while (cursor < inner.length && /\s/.test(inner[cursor])) {
            cursor++;
        }
    }

    // Mandatory arg {cols} - Handle nested braces!
    if (inner[cursor] !== '{') {
        console.log(`Expected '{', found '${inner[cursor]}' at index ${cursor}`);
        return null; // Should be {
    }

    let braceDepth = 1;
    cursor++;
    while (cursor < inner.length && braceDepth > 0) {
        if (inner[cursor] === '{') braceDepth++;
        else if (inner[cursor] === '}') braceDepth--;
        cursor++;
    }

    // Found end of cols. The rest until \end{tabular} is the body.
    const endTag = '\\end{tabular}';
    const endIdx = inner.indexOf(endTag, cursor);
    if (endIdx === -1) {
        console.log("End tag not found");
        return null;
    }

    const body = inner.substring(cursor, endIdx);
    return `SUCCESS: Found body length ${body.length}`;
};

// Test Cases
console.log("--- TEST START ---");

const case1 = `\\begin{tabular}{|l|l|}
data & data \\\\
\\end{tabular}`;
console.log("Case 1 (Standard):", parseTabular(case1));

const case2 = `\\begin{tabular} {|l|l|}
data & data \\\\
\\end{tabular}`;
console.log("Case 2 (Space before brace):", parseTabular(case2));

const case3 = `\\begin{tabular}
{|l|l|}
data & data \\\\
\\end{tabular}`;
console.log("Case 3 (Newline before brace):", parseTabular(case3));

const case4 = `\\begin{tabular}[t] {|l|l|}
data & data \\\\
\\end{tabular}`;
console.log("Case 4 (Optional arg + Space):", parseTabular(case4));

console.log("--- TEST END ---");
