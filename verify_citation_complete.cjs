
// VERIFICATION SUITE: Citation System Refactor (Pass 2)
// Goal: Prove that "Universal Tokenizer" + "Merging Logic" produces Best Practice output.

const { expect } = require('assert');

// The Logic (Copied from latexGenerator.ts)
function compileCitations(text, references) {
    const validKeys = new Set(references.map(r => r.key));

    // Step 2: Universal Tokenizer
    let compiled = text.replace(/\(\s*(ref_\d+(?:[^)]*))\)/g, (match, content) => {
        const keys = content.match(/ref_\d+/g);
        if (!keys) return match;
        const valid = keys.filter(k => validKeys.has(k));
        if (valid.length > 0) return `\\cite{${valid.join(',')}}`;
        return `[?]`;
    });

    // Step 3: Citation Merging
    let prev;
    do {
        prev = compiled;
        compiled = compiled.replace(/\\cite\{([^}]+)\}\s*\\cite\{([^}]+)\}/g, (match, keys1, keys2) => {
            return `\\cite{${keys1},${keys2}}`;
        });
    } while (compiled !== prev);

    return compiled;
}

// Test Data
const refs = [{ key: 'ref_1' }, { key: 'ref_2' }, { key: 'ref_3' }, { key: 'ref_7' }];

const cases = [
    { input: "Use (ref_1).", expected: "Use \\cite{ref_1}." },
    { input: "Use (ref_2, ref_7).", expected: "Use \\cite{ref_2,ref_7}." },
    { input: "Use (ref_2) (ref_7).", expected: "Use \\cite{ref_2,ref_7}." }, // MERGE TEST
    { input: "Use (ref_1) \n (ref_2).", expected: "Use \\cite{ref_1,ref_2}." }, // MERGE WITH NEWLINE
];

console.log("=== CITATION SYSTEM VERIFICATION (MERGE) ===");
let passed = 0;
cases.forEach(({ input, expected }, i) => {
    const result = compileCitations(input, refs);
    if (result === expected) {
        console.log(`[PASS] Case ${i + 1}: "${input.replace(/\n/g, '\\n')}" -> "${result}"`);
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
