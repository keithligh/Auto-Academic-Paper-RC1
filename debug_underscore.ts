
import fs from 'fs';

function sanitizeLatexForBrowser(latex: string) {
    // ... (Previous logic omitted for brevity, focusing on the fix) ...
    let content = latex;

    // SIMULATE MATH EXTRACTION (Crucial context)
    const blocks: Record<string, string> = {};
    let blockCount = 0;
    const replaceWithMathBlock = (match: string, math: string) => {
        const id = `LATEXPREVIEWMATHBLOCK${blockCount++}`;
        blocks[id] = math;
        return `\n\n${id}\n\n`;
    };

    content = content.replace(/\$\$([\s\S]*?)\$\$/g, replaceWithMathBlock);
    content = content.replace(/(?<!\\)\$([^$]+)(?<!\\)\$/g, (match, math) => {
        return replaceWithMathBlock(match, math);
    });

    // --- THE FIX TO TEST ---
    // Replace ref_X with ref\_X
    content = content.replace(/ref_(\d+)/g, 'ref\\_$1');

    // Also generally escape underscores that are NOT in commands?
    // That's hard to do perfectly with regex.
    // But ref_X is the known culprit from the logs.

    return content;
}

const testInput = `
This is a test text with a citation (ref_1, ref_2).
Here is some math: $x_1 + y_2 = z$.
Here is a command: \\includegraphics{file_name}.
`;

console.log("Input:", testInput);
const output = sanitizeLatexForBrowser(testInput);
console.log("Output:", output);

if (output.includes("ref\\_1") && output.includes("ref\\_2")) {
    console.log("SUCCESS: ref_X escaped.");
} else {
    console.log("FAILURE: ref_X not escaped.");
}

if (!output.includes("x\\_1")) {
    console.log("SUCCESS: Math subscripts NOT escaped (preserved in block).");
} else {
    console.log("FAILURE: Math subscripts incorrectly escaped.");
}
