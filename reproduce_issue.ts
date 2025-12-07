
import katex from 'katex';

const latexInput = `
\\subsection*{Non-delegable Core of Human Cognitive Work in the AI Era}
A formalization of the argument that problem discovery, decision-making, and creation must remain under human control.

\\begin{align*}
&\\text{Let } D = \\text{problem discovery},\\\\
&\\quad M = \\text{decision-making},\\\\
&\\quad C = \\text{creation (of new ideas, artifacts, models)},\\\\
&\\quad A_{x} = \\text{AI performing task } x,\\\\
&\\quad H_{x} = \\text{human performing task } x.\\[4pt]
&\\text{Normative constraints:}\\\\
&\\neg A_{D} \\land H_{D} \\quad \\text{(problem discovery must not be fully delegated to AI)},\\\\
&\\neg A_{M} \\land H_{M} \\quad \\text{(final decisions must not be fully delegated to AI)},\\\\
&\\neg (C = C_{AI\\text{-only}}) \\quad \\text{(creative activity must not be exclusively AI-driven)}.\\[4pt]
&\\text{Permissible assistance:}\\\\
&A_{D}^{\\text{assist}} \\rightarrow H_{D}' > H_{D} \\quad \\text{(AI may support but not replace human problem discovery)},\\\\
&A_{M}^{\\text{recommend}} \\rightarrow H_{M}^{\\text{informed}} \\quad \\text{(AI may recommend, but humans decide)},\\\\
&A_{C}^{\\text{scaffold}} \\rightarrow C_{\\text{human+AI}} \\quad \\text{(AI may scaffold human creativity)}.
\\end{align*}

where, for example:
\\begin{align*}
S_1 &: \\text{Problem discovery and question formulation},\\\\
S_2 &: \\text{Information gathering},\\\\
S_3 &: \\text{Structuring, analysis, and modeling},\\\\
S_4 &: \\text{Articulation and communication},\\\\
S_5 &: \\text{Reflection, evaluation, and revision}.
\\end{align*}
`;

function testRegex() {
    console.log("--- STARTING REGEX FORENSICS ---");

    let content = latexInput;
    const blocks: Record<string, string> = {};
    let blockCount = 0;

    const createMathBlock = (match: string, isDisplay: boolean) => {
        const id = `LATEXPREVIEWMATH${blockCount++}`;
        console.log(`[captured] ${id}: ${match.substring(0, 50).replace(/\n/g, ' ')}...`);

        try {
            // NOTE: KaTeX renderToString expects the LaTeX string.
            // If strict is false, it should tolerate more.
            // throwOnError is true to catch the issue.
            const html = katex.renderToString(match, {
                displayMode: isDisplay,
                throwOnError: true,
                strict: false,
                macros: { "\\eqref": "\\href{#1}{#1}", "\\label": "" }
            });
            console.log(`[KaTeX] ${id} SUCCESS.`);
        } catch (e: any) {
            console.error(`[KaTeX ERROR] ${id}:`, e.message);
        }

        return id;
    };

    // The Robust Regex
    const regex = /\\begin\s*\{(equation|align|gather|multline)(\*?)\}(?:\[.*?\])?([\s\S]*?)\\end\s*\{\1\2\}/g;

    content = content.replace(regex, (m, env, star, math) => {
        return createMathBlock(m, true);
    });

    console.log("\n--- RESULT CONTENT ---");
    // console.log(content);
}

testRegex();
