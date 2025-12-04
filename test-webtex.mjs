// Test WebTeX with correct API
async function testWebTeX() {
    const { parse, HtmlGenerator } = await import('webtex');

    const testLatex = `\\documentclass{article}
\\begin{document}

\\section{Introduction}
This is a test document to verify WebTeX capabilities.

\\subsection{Math Support}
Here is an equation:
\\begin{equation}
E = mc^2
\\end{equation}

Inline math: $a^2 + b^2 = c^2$

\\subsection{Table Support}
\\begin{table}[h]
\\centering
\\begin{tabular}{|c|c|}
\\hline
A & B \\\\
\\hline
1 & 2 \\\\
3 & 4 \\\\
\\hline
\\end{tabular}
\\caption{Test Table}
\\end{table}

\\subsection{Verbatim Support}
\\begin{verbatim}
const x = 10;
console.log(x);
\\end{verbatim}

\\end{document}`;

    console.log('Testing WebTeX with correct API...\n');
    console.log('Input LaTeX length:', testLatex.length);

    try {
        // Use parse with HtmlGenerator (same as latex.js API)
        const generator = new HtmlGenerator({ hyphenate: false });
        const doc = parse(testLatex, { generator });

        console.log('\n✅ SUCCESS! WebTeX compilation completed');
        console.log('Doc type:', typeof doc);

        // Get the HTML
        const fragment = generator.domFragment();
        const html = fragment.outerHTML || fragment.textContent || String(fragment);

        console.log('HTML output length:', html.length);
        console.log('\nFirst 1000 chars of HTML output:');
        console.log(html.substring(0, 1000));
        console.log('\n\n...checking for support...');
        console.log('Contains "equation":', html.toLowerCase().includes('equation'));
        console.log('Contains "table":', html.toLowerCase().includes('table'));
        console.log('Contains "verbatim" or "code": ', html.toLowerCase().includes('verbatim') || html.toLowerCase().includes('code'));

        return true;
    } catch (error) {
        console.error('\n❌ ERROR: WebTeX compilation failed');
        console.error('Error message:', error.message);
        console.error('Error type:', error.constructor.name);
        if (error.message.includes('unknown environment')) {
            console.error('\n⚠️  Same issue as latex.js - environment not supported!');
            console.error('Error details:', error.toString());
        }
        return false;
    }
}

testWebTeX().then(success => {
    console.log('\n' + '='.repeat(60));
    if (success) {
        console.log('✅ WebTeX WORKS! It can replace latex.js');
    } else {
        console.log('❌ WebTeX has the same limitations as latex.js');
    }
    console.log('='.repeat(60));
    process.exit(success ? 0 : 1);
}).catch(err => {
    console.error('Unexpected error:', err);
    process.exit(1);
});
