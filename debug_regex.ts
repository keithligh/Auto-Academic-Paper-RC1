
const inputs = [
    "Text \\\\ \\hline",       // Text \\ \hline (Already correct)
    "Text \\hline",            // Text \hline (Missing \\)
    "Text \\\\ \n \\hline",    // Text \\ \n \hline (Correct with newline)
];

function testRegex(name: string, regexFn: (s: string) => string) {
    console.log(`\n--- ${name} ---`);
    inputs.forEach(input => {
        const output = regexFn(input);
        console.log(`In: "${JSON.stringify(input)}"\nOut: "${JSON.stringify(output)}"`);
        // Check if double slash
        if (output.includes("\\\\ \\\\")) console.log("!! DOUBLE SPLIT DETECTED !!");
    });
}

// Strategy 1: Lookbehind (Node/Modern JS)
testRegex("Lookbehind", (s) => {
    // Escape check: Need to match start of rule \\(hline...)
    // Preceded by optional whitespace \s*
    // Preceded by NOT \\ ( (?<!\\\\) )
    try {
        return s.replace(/(?<!\\\\)\s*\\(hline|midrule|bottomrule)/g, '\\\\ \\$1');
    } catch (e) { return "Regex Error: " + e; }
});

// Strategy 2: Capture Group Logic
testRegex("Capture Check", (s) => {
    return s.replace(/(\\)?\s*\\(hline|midrule|bottomrule)/g, (match, p1, p2) => {
        if (p1) return match; // Already has \\
        return `\\\\ \\${p2}`; // Add \\
    });
});
