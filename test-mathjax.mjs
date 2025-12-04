// Test MathJax 3 capabilities
import { mathjax } from 'mathjax-full/js/mathjax.js';
import { TeX } from 'mathjax-full/js/input/tex.js';
import { SVG } from 'mathjax-full/js/output/svg.js';
import { liteAdaptor } from 'mathjax-full/js/adaptors/liteAdaptor.js';
import { RegisterHTMLHandler } from 'mathjax-full/js/handlers/html.js';
import { AllPackages } from 'mathjax-full/js/input/tex/AllPackages.js';

async function testMathJax() {
    console.log('Testing MathJax 3...\n');

    // Setup MathJax
    const adaptor = liteAdaptor();
    RegisterHTMLHandler(adaptor);

    const tex = new TeX({ packages: AllPackages });
    const svg = new SVG({ fontCache: 'none' });
    const html = mathjax.document('', { InputJax: tex, OutputJax: svg });

    // Test 1: Equation environment
    console.log('Test 1: Equation environment');
    const equation = `\\begin{equation}
E = mc^2
\\end{equation}`;

    try {
        const node = html.convert(equation, {});
        const output = adaptor.outerHTML(node);
        console.log('✅ SUCCESS - Equation rendered');
        console.log('Output length:', output.length);
        console.log('Contains math:', output.includes('svg'));
    } catch (error) {
        console.log('❌ FAILED - Equation:', error.message);
    }

    // Test 2: Inline math
    console.log('\nTest 2: Inline math');
    const inline = `$a^2 + b^2 = c^2$`;

    try {
        const node = html.convert(inline, {});
        const output = adaptor.outerHTML(node);
        console.log('✅ SUCCESS - Inline math rendered');
    } catch (error) {
        console.log('❌ FAILED - Inline math:', error.message);
    }

    // Test 3: Tabular environment (will fail)
    console.log('\nTest 3: Tabular environment');
    const tabular = `\\begin{tabular}{|c|c|}
\\hline
A & B \\\\
\\hline
1 & 2 \\\\
\\hline
\\end{tabular}`;

    try {
        const node = html.convert(tabular, {});
        const output = adaptor.outerHTML(node);
        console.log('✅ SUCCESS - Tabular rendered');
    } catch (error) {
        console.log('❌ FAILED - Tabular:', error.message);
    }

    // Test 4: Array environment (math table - should work)
    console.log('\nTest 4: Array environment (math mode table)');
    const array = `\\begin{array}{|c|c|}
\\hline
A & B \\\\
\\hline
1 & 2 \\\\
\\hline
\\end{array}`;

    try {
        const node = html.convert(array, {});
        const output = adaptor.outerHTML(node);
        console.log('✅ SUCCESS - Array rendered');
        console.log('Output length:', output.length);
    } catch (error) {
        console.log('❌ FAILED - Array:', error.message);
    }

    // Test 5: Full document structure (will fail)
    console.log('\nTest 5: Full document with \\\\documentclass');
    const fullDoc = `\\documentclass{article}
\\begin{document}
\\section{Test}
Content here.
\\end{document}`;

    try {
        const node = html.convert(fullDoc, {});
        const output = adaptor.outerHTML(node);
        console.log('✅ SUCCESS - Full document rendered');
    } catch (error) {
        console.log('❌ FAILED - Full document:', error.message);
    }
}

testMathJax().then(() => {
    console.log('\n' + '='.repeat(60));
    console.log('MathJax is MATH-ONLY, not for full documents');
    console.log('✅ Great for: equations, inline math, math arrays');
    console.log('❌ Cannot do: tables, document structure, full LaTeX');
    console.log('='.repeat(60));
}).catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
