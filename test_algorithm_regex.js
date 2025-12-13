// Quick test to see what the content actually looks like
import { processLatex } from './client/src/lib/latex-unifier/processor';

const testLatex = `\\documentclass{article}
\\usepackage{algorithm}
\\begin{document}

\\begin{algorithm}
\\caption{SGCV workflow (conceptual)}
\\label{alg:sgcv}
\\begin{enumerate}
\\item \\textbf{Input:} user request $x$
\\end{enumerate}
\\end{algorithm}

\\end{document}`;

console.log('Testing with sample LaTeX...');
console.log('Input contains \\begin{algorithm}:', testLatex.includes('\\begin{algorithm}'));

// Test regex patterns
const pattern1 = /\\begin\{algorithm\}/g;
const pattern2 = /\\\\begin\{algorithm\}/g;

console.log('Pattern 1 (single backslash) matches:', testLatex.match(pattern1));
console.log('Pattern 2 (double backslash) matches:', testLatex.match(pattern2));

// Show actual string
const idx = testLatex.indexOf('\\begin{algorithm}');
if (idx !== -1) {
    const snippet = testLatex.substring(idx, idx + 30);
    console.log('Snippet:', JSON.stringify(snippet));
}

const result = processLatex(testLatex);
console.log('Result:', result);
