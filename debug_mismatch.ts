
// Simulated input with MISMATCHED tags
let content = `
\\begin{align*}
  S &= (p, a, c, F, Q), \\\\
\\end{align}
`;

// Robust Extractor Logic (Simulated)
const mathEnvs = ['equation', 'align', 'gather', 'multline'];
let ptr = 0;
while (ptr < content.length) {
    const beginIdx = content.indexOf('\\begin', ptr);
    if (beginIdx === -1) break;

    // ... (Brace scanning)
    let braceIdx = beginIdx + 6;
    while (braceIdx < content.length && /\s/.test(content[braceIdx])) braceIdx++;
    if (content[braceIdx] !== '{') { ptr = beginIdx + 6; continue; }

    const endingBrace = content.indexOf('}', braceIdx);
    if (endingBrace === -1) break;

    const fullEnvName = content.substring(braceIdx + 1, endingBrace).trim();
    const baseEnvName = fullEnvName.replace('*', '');

    if (mathEnvs.includes(baseEnvName)) {
        const escapedName = fullEnvName.replace(/\*/g, '\\*');
        const endRegex = new RegExp(`\\\\end\\s*\\{\\s*${escapedName}\\s*\\}`, 'g');
        endRegex.lastIndex = endingBrace + 1;

        const endMatch = endRegex.exec(content);
        if (endMatch) {
            console.log("Found match!");
            // ... replace
            break;
        } else {
            console.log(`Failed to find endTag for ${fullEnvName}`);
            // Does it fallback to loose matching?
        }
    }
    ptr = beginIdx + 6;
}
