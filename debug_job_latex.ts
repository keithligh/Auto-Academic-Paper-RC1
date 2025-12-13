
import { db } from "./server/db";
import { conversionJobs } from "./shared/schema";
import { desc } from "drizzle-orm";
import fs from "fs";

import { eq } from "drizzle-orm"; // Import eq

async function checkLatestJob() {
    try {
        const targetId = 'b5afe864-851c-42e7-a1d0-92a605e88c8b';
        console.log(`Querying for Job ID: ${targetId}`);
        const jobs = await db.select().from(conversionJobs).where(eq(conversionJobs.id, targetId));

        if (jobs.length === 0) {
            console.log("Job not found.");
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
