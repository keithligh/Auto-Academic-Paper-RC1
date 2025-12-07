
const cases = [
    "(ref_1, ref_2)",       // Standard
    "(ref_1 , ref_2)",      // Space before comma
    "(ref_1; ref_2)",       // Semicolon
    "(ref_1 ref_2)",        // No separator
    "(ref_1\nref_2)",       // Newline only
    "(ref_1, \n ref_2)",    // Newline after comma
    "(ref_1 and ref_2)",    // Text separator
    "(ref_1)",              // Single
    "(ref_1, ref_2, ref_3)",// Triple
    "Text (ref_1) text",    // Embedded
];

const antiFragileRegex = /\((ref_\d+(?:[^)]*))\)/g;

console.log("Testing Anti-Fragile Regex:", antiFragileRegex);

cases.forEach(text => {
    let matched = false;
    const output = text.replace(antiFragileRegex, (match, content) => {
        matched = true;
        const keys = content.match(/ref_\d+/g);
        return `[CITE:${keys.join(',')}]`;
    });
    console.log(`"${text}" -> ${matched ? "MATCH" : "FAIL"} -> ${output}`);
});
