
const text = "Single: (ref_1). Grouped: (ref_1, ref_2). Mixed: (ref_3; ref_4). Invalid: (ref_X).";
const validKeys = new Set(["ref_1", "ref_2", "ref_3", "ref_4"]);

// Current Implementation
let compiled = text.replace(/\(ref_(\d+)\)/g, (match, num) => {
    return `[CITE:${num}]`; // Mock replacement
});

console.log("Original:", text);
console.log("Compiled:", compiled);

// Proposed Regex
// Matches (ref_1, ref_2) or (ref_1)
const robustRegex = /\((ref_\d+(?:,\s*ref_\d+)*)\)/g;
let robustCompiled = text.replace(robustRegex, (match, content) => {
    // extract all ref_X
    const keys = content.match(/ref_\d+/g);
    return `\\cite{${keys.join(',')}}`;
});
console.log("Robust:", robustCompiled);
