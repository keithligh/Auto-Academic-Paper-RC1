
// Minimal reproduction of processor.ts pipeline (BROKEN INPUT)

let content = `Preceding.
\\begin{algorithm}[H]
Code
% MISSING END TAG
\\State More Code

\\subsection*{Reliability Function}
Content.`;

console.log("--- INPUT (BROKEN) ---");
console.log(content);

// 1. Process Headers
function processHeaders(text) {
    return text.replace(/\\subsection\*?\{([^}]+)\}/g, '<h3>$1</h3>');
}

// 2. Parse Latex Formatting (Simulated Escaping)
function parseLatexFormatting(text) {
    // Simulating common behavior: escaping HTML special chars
    return text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// 3. Safety Sweep (v1.9.92 Logic - Fails on Escaped HTML?)
function safetySweep(text) {
    // Current Regex: Stops at \section OR <h... OR &lt;h...
    const regex = /(\\begin\{[^}]+\}(?:(?!\\section|\\subsection|<h[1-6]|&lt;h[1-6])[\s\S])*?(\\end\{[^}]+\}|$))/g;

    return text.replace(regex, (m) => {
        console.log("SAFETY SWEEP MATCHED (Length: " + m.length + ")");
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
