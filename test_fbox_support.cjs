
const latexjs = require('latex.js');

const latex = `
\\documentclass{article}
\\begin{document}
Test \\fbox{Boxed Content}
\\end{document}
`;

try {
    const generator = new latexjs.HtmlGenerator({ hyphenate: false });
    const doc = latexjs.parse(latex, { generator: generator });
    console.log("Success: \\fbox is supported");
} catch (e) {
    console.error("Crash: \\fbox failed", e.message);
}
