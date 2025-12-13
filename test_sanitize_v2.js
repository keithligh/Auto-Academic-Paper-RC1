
// function imported manually for testing below

const text = `
Here is the table:
*Thinking...*
Note: I processed the table.
\\begin{tabular}...
`;

function sanitizeLatexOutput(text) {
    let clean = text;
    clean = clean.replace(/^>.*(\r?\n|$)/gm, "");
    clean = clean.replace(/^Thinking Process:[\s\S]*?(\n\n|$)/gim, "");

    // NEW REGEX TO TEST
    clean = clean.replace(/^\*Thinking\.*\*\s*(\r?\n|$)/gim, "");
    clean = clean.replace(/^\*Thinking\s+Process\.*\*\s*(\r?\n|$)/gim, "");

    return clean;
}

console.log("--- ORIGINAL ---");
console.log(text);
console.log("--- CLEANED ---");
console.log(sanitizeLatexOutput(text));
