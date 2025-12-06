
// Simulated input with various spacing
let content = `
\\begin {align*}
  S &= (p, a, c, F, Q), \\\\
  A &= B
\\end  {  align*  }

\\begin{equation}
   E = mc^2
\\end{equation}
`;

const mathEnvs = ['equation', 'align', 'gather', 'multline'];
let ptr = 0;
while (ptr < content.length) {
    const beginIdx = content.indexOf('\\begin', ptr);
    if (beginIdx === -1) break;

    // Start Tag extraction
    let braceIdx = beginIdx + 6;
    while (braceIdx < content.length && /\s/.test(content[braceIdx])) braceIdx++;
    if (content[braceIdx] !== '{') { ptr = beginIdx + 6; continue; }

    const endingBrace = content.indexOf('}', braceIdx);
    if (endingBrace === -1) { ptr = beginIdx + 6; continue; }

    const fullEnvName = content.substring(braceIdx + 1, endingBrace).trim();
    const baseEnvName = fullEnvName.replace('*', '');

    if (mathEnvs.includes(baseEnvName)) {
        console.log(`Found Start: ${fullEnvName} at ${beginIdx}`);

        // MANUAL END TAG HUNTING
        let endPtr = endingBrace + 1;
        let foundEnd = false;

        while (endPtr < content.length) {
            const endBackslash = content.indexOf('\\end', endPtr);
            if (endBackslash === -1) break;

            let endBraceIdx = endBackslash + 4; // after "\end"
            while (endBraceIdx < content.length && /\s/.test(content[endBraceIdx])) endBraceIdx++;

            if (content[endBraceIdx] !== '{') {
                endPtr = endBackslash + 4;
                continue;
            }

            const endClosingBrace = content.indexOf('}', endBraceIdx);
            if (endClosingBrace === -1) break;

            const endName = content.substring(endBraceIdx + 1, endClosingBrace).trim();

            // STRICT COMPARISON
            if (endName === fullEnvName) {
                console.log(`Found End: ${endName} at ${endBackslash}`);
                // Match!
                const body = content.substring(endingBrace + 1, endBackslash);
                console.log(`Body: ${body.trim()}`);

                // Replace logic simulation
                const placeholder = `[[MATH_BLOCK_${baseEnvName}]]`;
                const endLen = (endClosingBrace + 1) - endBackslash;

                content = content.substring(0, beginIdx) + placeholder + content.substring(endBackslash + endLen);
                ptr = beginIdx + placeholder.length;
                foundEnd = true;
                break;
            } else {
                // Nested or mismatched end tag
                endPtr = endBackslash + 4;
            }
        }

        if (foundEnd) continue;
    }
    ptr = beginIdx + 6;
}

console.log("--- RESULT ---");
console.log(content);
