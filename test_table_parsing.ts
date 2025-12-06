
// Mocking the logic from LatexPreview.tsx
const parseTabular = (inner: string): string | null => {
    const startTag = '\\begin{tabular}';
    const startIdx = inner.indexOf(startTag);
    if (startIdx === -1) {
        console.log("Start tag not found");
        return null;
    }

    let cursor = startIdx + startTag.length;

    console.log(`Char at cursor: '${inner[cursor]}'`);

    // ISSUE: Does not skip whitespace here!

    // Optional arg [pos]
    if (inner[cursor] === '[') {
        while (cursor < inner.length && inner[cursor] !== ']') cursor++;
        cursor++; // skip ]
    }

    // ISSUE: Does not skip whitespace here either!

    // Mandatory arg {cols} - Handle nested braces!
    if (inner[cursor] !== '{') {
        console.log(`Expected '{', found '${inner[cursor]}'`);
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
    console.log("Body extracted:", body.substring(0, 20) + "...");
    return "SUCCESS";
};

// Test Cases
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
