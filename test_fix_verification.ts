
// Verification of processor.ts fixes

const latexSnippetBroken = `\\subsection*{Broken Protocol}
\\begin{algorithm}[H]
\\caption{Broken}
\\begin{algorithmic}
\\State Broken
\\end{algorithmic}
% MISSING END TAG!
`;

console.log("--- INPUT SNIPPET (BROKEN) ---");
console.log(latexSnippetBroken);
console.log("---------------------");

function createPlaceholder(html) {
    return `[PLACEHOLDER: ${html.substring(0, 30)}...]`;
}

function processFix(content) {
    // 1. Process Outer Algorithm Environment (Original - still might fail if end tag missing)
    const algoRegex = /\\begin\{algorithm\}(?:\[[^\]]*\])?([\s\S]*?)\\end\{algorithm\}/g;
    content = content.replace(algoRegex, (match, body) => {
        return `[ALGORITHM WRAPPER FOUND]`;
    });

    // 2. Process Headers (NEW ROBUST)
    const nestedBraces = '([^{}]*(?:\\{[^{}]*(?:\\{[^{}]*\\}[^{}]*)*\\}[^{}]*)*)';
    content = content.replace(new RegExp(`\\\\subsection\\*?\\s*\\{${nestedBraces}\\}`, 'g'), '<h3>$1</h3>');

    // 3. Safety Sweep (NEW)
    content = content.replace(/(\\begin\{[^}]+\}[\s\S]*?(\\end\{[^}]+\}|$))/g, (m) => {
        return createPlaceholder(`<pre class="latex-error-block">${m}</pre>`);
    });

    return content;
}

console.log("\n--- TEST: FIX ---");
let processed = processFix(latexSnippetBroken);
console.log("Processed Content:\n", processed);
