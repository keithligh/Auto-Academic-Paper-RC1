
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'local.db');
const db = new Database(dbPath);

try {
    const row = db.prepare(`
        SELECT id, status, latex_content, analysis, created_at 
        FROM conversion_jobs 
        WHERE status != 'processing'
        ORDER BY created_at DESC 
        LIMIT 1
    `).get();

    if (!row) {
        console.log("No non-processing jobs found.");
    } else {
        console.log("--- LAST COMPLETED/FAILED JOB ---");
        console.log("ID:", row.id);
        console.log("Status:", row.status);

        if (row.latex_content) {
            console.log("Latex Content Found (Length):", row.latex_content.length);
            const fs = require('fs');
            fs.writeFileSync('last_completed_latex.tex', row.latex_content);
            console.log("Saved to last_completed_latex.tex");
        } else {
            console.log("No LaTeX content found.");
        }

        if (row.analysis) {
            console.log("Analysis Found (Length):", row.analysis.length);
            const fs = require('fs');
            fs.writeFileSync('last_completed_analysis.json', typeof row.analysis === 'string' ? row.analysis : JSON.stringify(row.analysis, null, 2));
            console.log("Saved to last_completed_analysis.json");
        }
    }
} catch (e) {
    console.error("Error querying DB:", e);
}
