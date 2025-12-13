
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'local.db');
const db = new Database(dbPath, { readonly: true });

const jobId = 'e44baa37-4305-467b-9175-42a6bab510bb';
const stmt = db.prepare('SELECT * FROM conversion_jobs WHERE id = ?');
const job = stmt.get(jobId);

if (job) {
    console.log("=== JOB FOUND ===");
    console.log("ID:", job.id);
    console.log("Status:", job.status);

    // Schema: latex_content (snake_case)
    let content = job.latex_content || "";

    // Parse if necessary
    try {
        if (content && typeof content === 'string' && content.trim().startsWith('{')) {
            const resultObj = JSON.parse(content);
            if (resultObj.latex) content = resultObj.latex;
        }
    } catch (e) {
        // Not JSON
    }

    if (!content) {
        console.log("NO LATEX CONTENT FOUND IN DB COLUMN 'latex_content'.");
        console.log("Result Text present?", !!job.result_text);
    } else {

        console.log("\n--- CONTENT PREVIEW (Last 1000 chars of Algorithm Area) ---");
        // Find algorithm
        const algoIndex = content.indexOf("\\begin{algorithm}");
        if (algoIndex > -1) {
            console.log(content.substring(algoIndex, algoIndex + 2000));
        } else {
            console.log("No algorithm found.");
            console.log(content.slice(-1000));
        }
        console.log("\n--- END PREVIEW ---");

        // Check specifically for the Algorithm and Section 5
        const sec5Index = content.indexOf("Reliability Function");

        console.log("\n--- DIAGNOSTICS ---");
        console.log("Algorithm Start Index:", algoIndex);
        console.log("\\end{algorithm} Index:", content.indexOf("\\end{algorithm}", algoIndex));
        console.log("Section 5 (Reliability) Index:", sec5Index);

        if (algoIndex > -1) {
            if (content.indexOf("\\end{algorithm}", algoIndex) === -1) {
                console.log("INVALID: \\end{algorithm} is MISSING!");
            } else {
                console.log("VALID: Algorithm block is closed.");
            }
        }
    }

} else {
    console.log("Job not found.");
}
