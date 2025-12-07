
const references = [
    { key: 'ref_1' }, { key: 'ref_2' }, { key: 'ref_3' }, { key: 'ref_4' },
    { key: 'ref_5' }, { key: 'ref_6' }, { key: 'ref_7' }
];

function compileCitations(text, references) {
    const validKeys = new Set(references.map(r => r.key));
    console.log(`[Compiler] Processing citations. Valid keys: ${validKeys.size}`);

    // New Robust Strategy
    let compiled = text.replace(/\(\s*(ref_.*?)\)/gs, (match, content) => {
        console.log(`Matched block: "${match}" Content: "${content}"`);
        // CONTENT PARSER: Split by comma, semicolon, or whitespace
        const tokens = content.split(/[,\s;]+/);
        console.log("Tokens:", tokens);

        // Find valid keys in tokens
        const valid = tokens.filter((t) => {
            const cleanT = t.trim().replace(/[^a-zA-Z0-9_]/g, ''); // Strip punctuation
            return validKeys.has(cleanT);
        });

        if (valid.length > 0) {
            console.log(`[Compiler] Tokenized: "${match}" -> \\cite{${valid.join(',')}}`);
            return `\\cite{${valid.join(',')}}`;
        } else {
            console.warn(`[Compiler] Invalid citation group: ${match}`);
            return match;
        }
    });

    let prev;
    let loopCount = 0;
    do {
        prev = compiled;
        compiled = compiled.replace(/\\cite\{([^}]+)\}\s*\\cite\{([^}]+)\}/g, (match, keys1, keys2) => {
            console.log(`[Compiler] Merging: ${match}`);
            return `\\cite{${keys1},${keys2}}`;
        });
        loopCount++;
    } while (compiled !== prev && loopCount < 10);

    return compiled;
}

const input1 = "algorithms alone (ref_2, ref_7). This paper"; // Auditor case
const input2 = "semicolons (ref_3; ref_6). Empirical"; // Edge case
const input3 = "spaces only (ref_4 ref_5). Test"; // Edge case
const input4 = "mixed \cite{ref_1} \cite{ref_2}"; // Merge test

console.log("Test 1:", compileCitations(input1, references));
console.log("Test 2:", compileCitations(input2, references));
console.log("Test 3:", compileCitations(input3, references));
console.log("Test 4:", compileCitations(input4, references));
