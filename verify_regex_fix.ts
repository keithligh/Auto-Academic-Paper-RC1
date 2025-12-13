
const inputs = [
    "Header 3\\ \\hline",       // "Header 3\ \hline"
    "Header 3 \\ \\midrule",    // "Header 3 \ \midrule"
    "Standard \\\\ \\hline",    // "Standard \\ \hline" (Should be untouched or safe)
];

inputs.forEach(input => {
    console.log(`Input: ${JSON.stringify(input)}`);
    // The Fix Regex
    let output = input.replace(/\\\s+\\(hline|midrule|toprule|bottomrule|cline)/g, '\\\\ \\$1');
    console.log(`Output: ${JSON.stringify(output)}`);

    // implicit splitter (secondary check)
    output = output.replace(/([^\\])\\(hline|midrule|toprule|bottomrule|cline)/g, '$1\\\\ \\$2');
    console.log(`Final:  ${JSON.stringify(output)}\n`);
});
