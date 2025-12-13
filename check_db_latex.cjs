const Database = require('better-sqlite3');
const db = new Database('./local.db', { readonly: true });

// Get the job - correct column name is latex_content
const job = db.prepare('SELECT latex_content FROM conversion_jobs WHERE id = ?').get('b5afe864-851c-42e7-a1d0-92a605e88c8b');

if (job && job.latex_content) {
    const algoIndex = job.latex_content.indexOf('\\begin{algorithm}');
    if (algoIndex !== -1) {
        const snippet = job.latex_content.substring(Math.max(0, algoIndex - 100), algoIndex + 1000);
        console.log('\n=== ALGORITHM SNIPPET FROM DATABASE ===');
        console.log(snippet);
        console.log('=== END SNIPPET ===');

        // Check for literal \end{enumerate}
        if (snippet.includes('\\end{enumerate}')) {
            console.log('\n⚠️  Found literal \\end{enumerate} in source LaTeX');
            const endEnumIndex = snippet.indexOf('\\end{enumerate}');
            console.log('Context around first \\end{enumerate}:');
            console.log(snippet.substring(endEnumIndex - 50, endEnumIndex + 50));
        }
    } else {
        console.log('\nNo \\begin{algorithm} found');
    }
} else {
    console.log('\nJob not found or no LaTeX content');
}

db.close();
