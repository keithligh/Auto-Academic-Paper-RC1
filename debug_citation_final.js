
const cases = [
    "(ref_1, ref_2)",       // Standard
    "( ref_1, ref_2)",      // Leading Space (Current FAIL)
    "(ref_1 , ref_2)",      // Space before comma
    "(ref_1; ref_2)",       // Semicolon
    "(ref_1\nref_2)",       // Newline
    "(  ref_1  )",          // Spaces everywhere
];

const currentRegex = /\((ref_\d+(?:[^)]*))\)/g; // What I put in Step 823
const finalRegex = /\(\s*(ref_\d+(?:[^)]*))\)/g; // Proposed fix

console.log("Testing Current Regex:", currentRegex);
cases.forEach(text => {
    console.log(`"${text}" -> ${currentRegex.test(text) ? "MATCH" : "FAIL"}`);
    currentRegex.lastIndex = 0; // Reset
});

console.log("\nTesting Final Regex:", finalRegex);
cases.forEach(text => {
    console.log(`"${text}" -> ${finalRegex.test(text) ? "MATCH" : "FAIL"}`);
    finalRegex.lastIndex = 0; // Reset
});
