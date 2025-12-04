
import { db } from "./server/db";
import { conversionJobs } from "./shared/schema";
import { desc } from "drizzle-orm";
import fs from "fs";

async function checkLatestJob() {
    try {
        const jobs = await db.select().from(conversionJobs).orderBy(desc(conversionJobs.createdAt)).limit(1);

        if (jobs.length === 0) {
            console.log("No jobs found.");
            return;
        }

        const job = jobs[0];
        console.log("=== LATEST JOB STATUS ===");
        console.log(`ID: ${job.id}`);
        console.log(`Status: ${job.status}`);

        console.log("\n=== LOGS ===");
        if (job.logs && Array.isArray(job.logs)) {
            job.logs.forEach(log => console.log(log));
        }

        if (job.latexContent) {
            console.log("\n=== LATEX CONTENT (Last 1000 chars) ===");
            console.log(job.latexContent.slice(-1000));

            // Save full content to file for analysis
            fs.writeFileSync("debug_latex.tex", job.latexContent);
            console.log("\nFull LaTeX saved to debug_latex.tex");
        } else {
            console.log("\nNo LaTeX content found.");
        }

        process.exit(0);
    } catch (error) {
        console.error("Error querying DB:", error);
        process.exit(1);
    }
}

checkLatestJob();
