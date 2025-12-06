
// Simulated input content WITH SPACE
let content = `
\\subsection*{Formalization of Strategy and Constraint Mapping}

\\begin {align*}
  S &= (p, a, c, F, Q), \\\\
\\end {align*}
`;

// Current Loop (Strict indexOf)
// ... (omitted)

// Proposed Fix: Regex-Based Start Search
console.log("--- Testing Regex Start Search ---");

const mathEnvs = ['equation', 'align', 'gather', 'multline'];
const startRegex = /\\begin\s*\{([^}]+)\}/g;
let match;
let lastIndex = 0;

// Reset regex
startRegex.lastIndex = 0;

// Since we are modifying 'content', we can't rely on global regex state easily if string changes.
// Better strategy: Loop with indexOf('\\begin'), then parse the environment name robustly allowing spaces.

function robustExtract(text) {
    let result = text;
    let ptr = 0;
    while (ptr < result.length) {
        // Find \\begin
        const beginIdx = result.indexOf('\\begin', ptr);
        if (beginIdx === -1) break;

        // Check for opening brace (allowing spaces)
        let braceIdx = beginIdx + 6; // after "begin"
        while (braceIdx < result.length && /\s/.test(result[braceIdx])) {
            braceIdx++;
        }

        if (result[braceIdx] !== '{') {
            ptr = beginIdx + 6;
            continue;
        }

        // Found \begin\s*{
        const endingBrace = result.indexOf('}', braceIdx);
        if (endingBrace === -1) break;

        const fullEnvName = result.substring(braceIdx + 1, endingBrace).trim();
        const baseEnvName = fullEnvName.replace('*', '');

        console.log(`Potential Env: '${fullEnvName}' at ${beginIdx}`);

        if (mathEnvs.includes(baseEnvName)) {
            // Found Math Env! Now find End Tag
            // End tag also allows spaces: \end\s*{name}
            // But usually we can just search for the specific end string if we assume standard format.
            // However, to be robust, we should probably regex search for the end tag?
            // Or just search for \end{name} loosely?
            // The Architecture "Trojan Horse" means we steal it.
            // If the user wrote \end {align*}, we must find that too.
            // So we need a regex for the end tag too.

            // Construct regex for this specific env
            // Note: Escape special chars in envName (like *)
            const escapedName = fullEnvName.replace(/\*/g, '\\*');
            const endRegex = new RegExp(`\\\\end\\s*\\{\\s*${escapedName}\\s*\\}`, 'g');
            endRegex.lastIndex = endingBrace + 1;

            const endMatch = endRegex.exec(result);
            if (endMatch) {
                const endIdx = endMatch.index;
                const endLen = endMatch[0].length;
                console.log(`Found End Tag at ${endIdx}`);

                const body = result.substring(endingBrace + 1, endIdx);
                const placeholder = `[[MATH_BLOCK_${baseEnvName}]]`;

                result = result.substring(0, beginIdx) + placeholder + result.substring(endIdx + endLen);
                ptr = beginIdx + placeholder.length;
                continue;
            } else {
                console.log(`End tag for ${fullEnvName} not found`);
            }
        }
        ptr = beginIdx + 6;
    }
    return result;
}

console.log(robustExtract(content));
