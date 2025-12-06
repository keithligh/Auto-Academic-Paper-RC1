
const content = `\\subsection*{Formalization of Strategy and Constraint Mapping}
A small set of equations formally defining the strategy tuple S and its mapping to constraint sets and translated text.

\\begin{align*}
  S &= (p, a, c, F, Q), \\\\
  \\mathcal{C}(S) &= \\{\\text{obligations},\\ \\text{prohibitions},\\ \\text{priority rules}\\}, \\\\
  T' &= \\operatorname{LLM}(T, L_s, L_t, \\mathcal{C}(S), G(S)).
\\end{align*}

The design of TranslationAI can be formalized`;

const environments = ['equation', 'align', 'gather', 'multline'];

function manualExtract(text) {
    let result = text;
    let loopLimit = 1000;
    let ptr = 0;

    // We can't use a simple valid 'while' loop because we have multiple environment types.
    // We should scan for '\begin{' and check if it matches one of our targets.

    while (ptr < result.length && loopLimit-- > 0) {
        const beginIdx = result.indexOf('\\begin{', ptr);
        if (beginIdx === -1) break;

        // Extract env name
        const endingBrace = result.indexOf('}', beginIdx);
        if (endingBrace === -1) break;

        const fullEnvName = result.substring(beginIdx + 7, endingBrace); // e.g. "align*"
        const baseEnvName = fullEnvName.replace('*', '');

        if (environments.includes(baseEnvName)) {
            // Found a target!
            const endTag = `\\end{${fullEnvName}}`;
            const endIdx = result.indexOf(endTag, endingBrace);

            if (endIdx !== -1) {
                console.log(`Found ${fullEnvName} at ${beginIdx}`);
                const body = result.substring(endingBrace + 1, endIdx);
                const fullMatch = result.substring(beginIdx, endIdx + endTag.length);

                // Simulate replacement
                const placeholder = `[[MATH_BLOCK_${baseEnvName}]]`;
                result = result.substring(0, beginIdx) + placeholder + result.substring(endIdx + endTag.length);

                // pointer moves past replacement
                ptr = beginIdx + placeholder.length;
                continue;
            }
        }

        // If not a target, move ptr past this \begin
        ptr = beginIdx + 7;
    }
    return result;
}

console.log(manualExtract(content));
