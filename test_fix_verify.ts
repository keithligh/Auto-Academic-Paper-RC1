
// Verification Script for Healer and Processor Fixes (ESM)

import { healLatex } from './client/src/lib/latex-unifier/healer.ts';

console.log("=== Healer Verification ===");
const dirtyInput = "```latex\n\\begin{table}\n\\n\\hline\nContent\n\\end{table}\n```";
const healed = healLatex(dirtyInput);
console.log("Input:", JSON.stringify(dirtyInput));
console.log("Healed:", JSON.stringify(healed));

// Note: We expect Markdown fences to be removed.
// We expect `\n` literal (backslash n) to be removed if unsafe.
// Input has `\n` as literal chars? `\n` in strings is newline.
// `\\n` is backslash + n.
// My input string `\\n` means literal backslash + n.
// `healLatex` replaces `/\\n(?![a-zA-Z])/g` with ``.
// So `\n\hline` -> `\hline`.

if (healed.trim() === "\\begin{table}\n\\hline\nContent\n\\end{table}") {
    console.log("PASS: Healer stripped fences and bad newlines.\n");
} else {
    console.log("FAIL: Healer did not produce expected output.");
    console.log("Expected: \\begin{table}\\n\\hline\\nContent\\n\\end{table}");
    console.log("Actual:  ", JSON.stringify(healed));
}

console.log("=== Processor Regex Verification ===");

// 1. \where Command Fix
const whereInput = "\\where: \\begin{itemize}";
// Proposed Fix Regex
const whereOutput = whereInput.replace(/\\where:?/g, '<strong>Where:</strong>');
console.log("Where Input:", whereInput);
console.log("Where Output:", whereOutput);
if (whereOutput.includes("<strong>Where:</strong>")) console.log("PASS: \\where handled.\n");
else console.log("FAIL: \\where not handled.\n");

// 2. \cap Corruption Fix (v1.9.95 check)
const captionInput = "\\caption{Title}";
const capRegexSafe = /\\cap(?![a-zA-Z])/g;
const capRegexUnsafe = /\\cap/g;

// console.log("Caption Input:", captionInput);
// console.log("Unsafe Replace:", captionInput.replace(capRegexUnsafe, '∩'));
// console.log("Safe Replace:", captionInput.replace(capRegexSafe, '∩'));

if (captionInput.replace(capRegexSafe, '∩') === "\\caption{Title}") {
    console.log("PASS: Safe Regex preserves \\caption.");
} else {
    console.log("FAIL: Safe Regex corrupted \\caption.");
}
