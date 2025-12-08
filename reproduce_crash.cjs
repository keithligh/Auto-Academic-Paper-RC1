
const latexjs = require('latex.js');

// Case 1: \boxed in text mode
const brokenLatex1 = `
\\documentclass{article}
\\begin{document}
Text mode \\boxed{content}
\\end{document}
`;

// Case 2: Naked ^ in text mode
const brokenLatex2 = `
\\documentclass{article}
\\begin{document}
Text mode 10^{-4}
\\end{document}
`;

// Case 3: Working Math
const workingLatex = `
\\documentclass{article}
\\begin{document}
Math mode $\\boxed{content}$
\\end{document}
`;

function test(name, input) {
    console.log(`--- Testing ${name} ---`);
    try {
        const generator = new latexjs.HtmlGenerator({ hyphenate: false });
        // latexjs.parse returns a document, which we can ignore or let generator populate
        const doc = latexjs.parse(input, { generator: generator });
        console.log("Success");
    } catch (e) {
        console.error("Crash:", e.message);
        if (e.message.includes("end of document")) {
            console.error(">>> CONFIRMED ROOT CAUSE <<<");
        }
    }
}

test("Boxed in Text", brokenLatex1);
test("Naked Caret", brokenLatex2);
test("Working Math", workingLatex);
