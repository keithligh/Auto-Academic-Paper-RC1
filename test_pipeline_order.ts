
// Minimal reproduction of processor.ts pipeline

let content = `
\\begin{algorithm}[H]
Code
\\end{algorithm}
% MISSING END TAG (Simulated by not matching the end in real failure)

\\subsection*{Reliability Function}
Content.`;

console.log("--- INPUT ---");
console.log(content);

// 1. Process Headers
function processHeaders(text) {
    return text.replace(/\\subsection\*?\{([^}]+)\}/g, '<h3>$1</h3>');
}

// 2. Parse Latex Formatting (Simulated Escaping)
function parseLatexFormatting(text) {
    // Simulating common behavior: escaping HTML special chars to prevent XSS
    // logic often found in text formatters
    return text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// 3. Safety Sweep (v1.9.92 Logic)
function safetySweep(text) {
    // Current Regex: Stops at \section OR <h...
    const regex = /(\\begin\{[^}]+\}(?:(?!\\section|<h[1-6])[\s\S])*?(\\end\{[^}]+\}|$))/g;

    return text.replace(regex, (m) => {
        console.log("SAFETY SWEEP MATCHED:");
        console.log(m);
        // Check if we swallowed the header
        if (m.includes("Reliability Function")) {
            console.error("FAIL: Swallowed header!");
        } else {
            console.log("PASS: Stopped correctly.");
        }
        return `[ERROR BLOCK]`;
    });
}

console.log("\n--- STEP 1: HEADERS ---");
content = processHeaders(content);
console.log(content);

console.log("\n--- STEP 2: FORMATTING (Escaping?) ---");
content = parseLatexFormatting(content);
console.log(content);

console.log("\n--- STEP 3: SAFETY SWEEP ---");
content = safetySweep(content);
console.log("\nFinal Content:\n", content);
