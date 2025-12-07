
const cases = [
    "(ref_1, ref_2)",       // Standard
    "(ref_1,ref_2)",        // No space
    "(ref_1 , ref_2)",      // Space before comma (FAILURE CASE?)
    "(ref_1 ,ref_2)",       // Space before comma
    "(ref_1,  ref_2)",      // Double space
    "(ref_1\n, ref_2)",     // Newline
    "(ref_1)",              // Single
    "(ref_1, ref_2, ref_3)" // Triple
];

const regex = /\((ref_\d+(?:,\s*ref_\d+)*)\)/g;

console.log("Testing Current Regex:", regex);

cases.forEach(text => {
    const match = text.match(regex);
    console.log(`"${text}" -> ${match ? "MATCH" : "FAIL"}`);
});

const robustRegex = /\((\s*ref_\d+(?:\s*,\s*ref_\d+)*\s*)\)/g;
console.log("\nTesting Robust Regex:", robustRegex);

cases.forEach(text => {
    const match = text.match(robustRegex);
    console.log(`"${text}" -> ${match ? "MATCH" : "FAIL"}`);
});
