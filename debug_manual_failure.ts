
// Simulated input content
let content = `
\\subsection*{Formalization of Strategy and Constraint Mapping}
A small set of equations formally defining the strategy tuple S and its mapping to constraint sets and translated text.

\\begin{align*}
  S &= (p, a, c, F, Q), \\\\
  \\mathcal{C}(S) &= \\{\\text{obligations},\\ \\text{prohibitions},\\ \\text{priority rules}\\}, \\\\
  T' &= \\operatorname{LLM}(T, L_s, L_t, \\mathcal{C}(S), G(S)).
\\end{align*}

The design of TranslationAI can be formalized
`;

// Simulate previous steps
// 1. Markdown stripping
content = content.replace(/^```latex\s*/i, '').replace(/```$/, '');

// 2. Metadata extraction (skipped)

// 3. Header stripping (Line 463)
content = content.replace(/(?:\\(?:section|subsection|subsubsection)\*?\s*\{\s*(?:References|Bibliography|Works Cited)\s*\})/gi, '');

// 4. Document Body Extraction (skipped)

// 5. TikZ Extraction (lines 488-547) - Mocked (shouldn't run if no tikzpicture)

// 6. Math Extraction (Line 552) - The Manual Loop
console.log("--- Starting Math Extraction ---");
console.log("Input:", content);

const mathEnvs = ['equation', 'align', 'gather', 'multline'];
let ptr = 0;
let safety = 0;
while (ptr < content.length && safety++ < 2000) {
    const beginIdx = content.indexOf('\\begin{', ptr);
    if (beginIdx === -1) {
        console.log("Break: No \\begin{ found after ptr", ptr);
        break;
    }

    const endingBrace = content.indexOf('}', beginIdx);
    if (endingBrace === -1) { ptr = beginIdx + 7; continue; }

    const fullEnvName = content.substring(beginIdx + 7, endingBrace);
    const baseEnvName = fullEnvName.replace('*', '');

    console.log(`Found \\begin{ at ${beginIdx}, Name: '${fullEnvName}'`);

    if (mathEnvs.includes(baseEnvName)) {
        const endTag = `\\end{${fullEnvName}}`;
        const endIdx = content.indexOf(endTag, endingBrace);

        if (endIdx !== -1) {
            console.log(`Found matching endTag ${endTag} at ${endIdx}`);
            const body = content.substring(endingBrace + 1, endIdx);

            // Replacement simulation
            const placeholder = `[[MATH_BLOCK_${baseEnvName}]]`;
            const before = content.substring(0, beginIdx);
            const after = content.substring(endIdx + endTag.length);
            content = before + placeholder + after;

            ptr = beginIdx + placeholder.length;
            continue;
        } else {
            console.log(`Failed to find endTag ${endTag}`);
        }
    } else {
        console.log(`'${baseEnvName}' is not in mathEnvs`);
    }
    ptr = beginIdx + 7;
}

console.log("--- Result ---");
console.log(content);
