import { validateLatexSyntax } from "./latexValidator";

const testCases = [
    {
        name: "Basic Valid LaTeX",
        latex: "\\section{Hello} This is a test.",
        expected: true
    },
    {
        name: "Unmatched Brace",
        latex: "\\section{Hello This is broken",
        expected: false
    },
    {
        name: "Extra Closing Brace",
        latex: "\\section{Hello}}",
        expected: false
    },
    {
        name: "Valid Environment",
        latex: "\\begin{itemize} \\item Item 1 \\end{itemize}",
        expected: true
    },
    {
        name: "Unclosed Environment",
        latex: "\\begin{itemize} \\item Item 1",
        expected: false
    },
    {
        name: "Mismatched Environment",
        latex: "\\begin{itemize} \\item Item 1 \\end{enumerate}",
        expected: false
    },
    {
        name: "Escaped Braces (Should be Valid)",
        latex: "This is a set \\{1, 2, 3\\}.",
        expected: true
    },
    {
        name: "Commented Brace (Should be Valid)",
        latex: "Start % { This is a comment with an open brace\n End",
        expected: true
    },
    {
        name: "Complex Nested",
        latex: "\\begin{document} \\begin{itemize} \\item \\{ \\} \\end{itemize} \\end{document}",
        expected: true
    },
    {
        name: "Escaped Backslash (Should be Valid)",
        latex: "Line 1 \\\\ Line 2",
        expected: true
    }
];

console.log("Running LaTeX Validator Tests...\n");

let passed = 0;
let failed = 0;

testCases.forEach(test => {
    const result = validateLatexSyntax(test.latex);
    const success = result.valid === test.expected;

    if (success) {
        console.log(`[PASS] ${test.name}`);
        passed++;
    } else {
        console.log(`[FAIL] ${test.name}`);
        console.log(`       Expected: ${test.expected}, Got: ${result.valid}`);
        console.log(`       Errors: ${result.errors.join(", ")}`);
        failed++;
    }
});

console.log(`\nSummary: ${passed} Passed, ${failed} Failed.`);

if (failed > 0) {
    process.exit(1);
}
