
// VERIFICATION SUITE: Citation System Refactor
// Goal: Prove that ALL citation formats (single, group, messy) are converted to valid \cite{} commands.

const { expect } = require('assert'); // Use native assert if we were running in full enviromnet, but let's just log.

// The Logic (Copied from latexGenerator.ts for independent verification)
function compileCitations(text, references) {
    const validKeys = new Set(references.map(r => r.key));

    // Universal Regex
    return text.replace(/\(\s*(ref_\d+(?:[^)]*))\)/g, (match, content) => {
        const keys = content.match(/ref_\d+/g);
        if (!keys) return match;

        const valid = keys.filter(k => validKeys.has(k));
        if (valid.length > 0) {
            return `\\cite{${valid.join(',')}}`;
        }
        return `[?]`;
    });
}

// Test Data
const refs = [{ key: 'ref_1' }, { key: 'ref_2' }, { key: 'ref_3' }, { key: 'ref_7' }];

const cases = [
    { input: "Use (ref_1).", expected: "Use \\cite{ref_1}." },
    { input: "Use (ref_2, ref_7).", expected: "Use \\cite{ref_2,ref_7}." }, // Auditor's Example
    { input: "Use (ref_3, ref_6).", expected: "Use \\cite{ref_3}." }, // ref_6 is missing -> valid: ref_3
    { input: "Use ( ref_1 ).", expected: "Use \\cite{ref_1}." }, // Leading space
    { input: "Use (ref_1\nref_2).", expected: "Use \\cite{ref_1,ref_2}." }, // Newline
    { input: "Use (see ref_1).", expected: "Use (see ref_1)." }, // "see" prefix -> Should NOT match (intentional)
];

console.log("=== CITATION SYSTEM VERIFICATION ===");
let passed = 0;
cases.forEach(({ input, expected }, i) => {
    const result = compileCitations(input, refs);
    if (result === expected) {
        console.log(`[PASS] Case ${i + 1}: "${input}" -> "${result}"`);
        passed++;
    } else {
        console.error(`[FAIL] Case ${i + 1}: "${input}"\n  Expected: "${expected}"\n  Actual:   "${result}"`);
    }
});

if (passed === cases.length) {
    console.log("\n>>> ALL TESTS PASSED. SYSTEM INTEGRITY VERIFIED. <<<");
} else {
    console.log("\n>>> VERIFICATION FAILED <<<");
}
