
const cases = [
    "Text \\cite{ref_1} \\cite{ref_2} text.",          // Simple adjacency
    "Text \\cite{ref_1}\\cite{ref_2} text.",           // No space
    "Text \\cite{ref_1,ref_2} \\cite{ref_3} text.",    // Group + Single
    "Text \\cite{ref_1} and \\cite{ref_2} text.",      // Separated by text (Should NOT merge)
    "Text \\cite{ref_1}   \\cite{ref_2} text.",        // Multiple spaces
    "Text \\cite{ref_1}\n\\cite{ref_2} text.",         // Newline
];

function mergeCitations(text) {
    // Regex to find \cite{A} [whitespace] \cite{B}
    const pattern = /\\cite\{([^}]+)\}(\s*)\\cite\{([^}]+)\}/g;

    let result = text;
    let prev;

    // Loop until no more matches (to handle 3+ adjacent citations)
    do {
        prev = result;
        result = result.replace(pattern, (match, keys1, space, keys2) => {
            // If the space contains newlines or punctuation, maybe we shouldn't merge?
            // But usually [1][2] should become [1,2].
            // Only merge if separation is just whitespace.
            if (space.trim().length > 0) return match; // Should not happen with \s* regex unless special chars?

            return `\\cite{${keys1},${keys2}}`;
        });
    } while (result !== prev);

    return result;
}

console.log("=== CITATION MERGE TEST ===");
cases.forEach(c => {
    console.log(`Input:    "${c}"`);
    console.log(`Output:   "${mergeCitations(c)}"`);
    console.log("---");
});
