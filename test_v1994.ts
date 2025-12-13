
// Simulation of v1.9.94 Safety Sweep Logic

const content_raw = `Preceding text.

\\begin{algorithm}[H]
\\caption{Algorithm 1}
\\begin{algorithmic}
\\State Code
\\end{algorithmic}
% MISSING END TAG (Simulated)

\\subsection*{Reliability Function}
Content of reliability function.`;

const content_escaped = `Preceding text.

\\begin{algorithm}[H]
\\caption{Algorithm 1}
\\begin{algorithmic}
\\State Code
\\end{algorithmic}
% MISSING END TAG (Simulated)

&lt;h3&gt;Reliability Function&lt;/h3&gt;
Content of reliability function.`;

// v1.9.94 Regex from processor.ts
// Note: In string format for logging, but we use literal for execution
const regex = /(\\begin\{[^}]+\}(?:(?!\\section|\\subsection|\\subsubsection|<h[1-6]|&lt;h[1-6])[\s\S])*?)(?=\\section|\\subsection|\\subsubsection|<h[1-6]|&lt;h[1-6]|\\end\{[^}]+\}|$)/g;

function safetySweep(text, label) {
    console.log(`\n--- TEST: ${label} ---`);
    const result = text.replace(regex, (m) => {
        console.log(`[MATCH FOUND] Length: ${m.length}`);
        console.log(`Start: ${m.substring(0, 40).replace(/\n/g, '\\n')}`);
        console.log(`End:   ${m.substring(m.length - 40).replace(/\n/g, '\\n')}`);
        return `[ERROR_BLOCK]`;
    });

    // Check if header is swallowed
    if (result.includes("Reliability Function") && !result.includes("[ERROR_BLOCK]")) {
        console.log("RESULT: Regex failed to match (Header preserved, but block not wrapped).");
    } else if (!result.includes("Reliability Function")) {
        console.log("RESULT: FAIL - Header SWALLOWED!");
    } else {
        console.log("RESULT: PASS - Block wrapped, Header preserved.");
        console.log("Preview around error:");
        const idx = result.indexOf("[ERROR_BLOCK]");
        console.log(result.substring(idx, idx + 100).replace(/\n/g, '\\n'));
    }
}

safetySweep(content_raw, "Raw Subsection");
safetySweep(content_escaped, "Escaped HTML Header");

// Special Case: Space in End Tag?
const content_space = `\\begin{algorithm} ... \\end {algorithm} \\subsection{Next}`;
safetySweep(content_space, "Space in End Tag");

// Special Case: Nested Begin?
const content_nested = `\\begin{algorithm} \\begin{nested} ... \\subsection{Next}`;
safetySweep(content_nested, "Nested Begin");
