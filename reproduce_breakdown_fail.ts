
// Minimal reproduction of processor.ts logic for Algorithm detection - FAILURE CASE

const latexSnippetValid = `\\subsection*{Valid Protocol}
\\begin{algorithm}[H]
\\caption{Valid}
\\begin{algorithmic}
\\State Valid
\\end{algorithmic}
\\end{algorithm}`;

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

function processAlgorithms(content) {
    // 2. Process Outer Algorithm Environment
    const env = "algorithm";
    const algoRegex = /\\begin\{algorithm\}(?:\[[^\]]*\])?([\s\S]*?)\\end\{algorithm\}/g;

    let matched = false;
    content = content.replace(algoRegex, (match, body) => {
        matched = true;
        console.log("MATCHED ALGORITHM WRAPPER");
        let title = '';
        const captionMatch = body.match(/\\caption\{([^}]*)\}/);
        if (captionMatch) title = captionMatch[1];
        return `[ALGORITHM WRAPPER FOUND: Title=${title}]`;
    });

    if (!matched) console.log("NO MATCH FOUND FOR ALGORITHM");
    return content;
}

function processHeaders(content) {
    content = content.replace(/\\subsection\*?\s*\{([\s\S]*?)\}/g, '<h3>$1</h3>');
    return content;
}

console.log("\n--- TEST: BROKEN ALGORITHM ---");
let processed = processAlgorithms(latexSnippetBroken);
console.log("Processed Content:\n", processed);

console.log("\n--- TEST: HEADERS ---");
// If processAlgorithms failed, the raw text remains. 
// However, processHeaders SHOULD still replace the header?
processed = processHeaders(processed);
console.log("Processed Headers:\n", processed);
