
import { db } from "./server/db";
import { conversionJobs } from "./shared/schema";
import { desc, eq } from "drizzle-orm";
import fs from "fs";

async function dumpLatestJobAnalysis() {
    console.log("Querying latest job...");
    const jobs = await db.select().from(conversionJobs).orderBy(desc(conversionJobs.createdAt)).limit(1);

    if (jobs.length === 0) {
        console.log("No jobs found.");
        return;
    }

    const job = jobs[0];
    console.log(`Job ID: ${job.id}`);
    console.log(`Created At: ${job.createdAt}`);
    console.log(`Status: ${job.status}`);

    // Dump Logs
    console.log("\n=== LOGS ===");
    console.log(job.logs);

    // Dump Analysis (Peer Review Report is likely nested here)
    const analysis = job.analysis as any;
    if (analysis) {
        console.log("\n=== ANALYSIS JSON ===");
        // check for reviewReport in different possible locations depending on how it was saved
        const report = analysis.reviewReport || analysis.peer_review || "NOT FOUND IN ANALYSIS BLOB";

        console.log("Review Report Found:", !!analysis.reviewReport);

        fs.writeFileSync("debug_forensic_analysis.json", JSON.stringify(analysis, null, 2));
        console.log("Full analysis saved to debug_forensic_analysis.json");

        if (analysis.reviewReport) {
            fs.writeFileSync("debug_forensic_peer_review.json", JSON.stringify(analysis.reviewReport, null, 2));
            console.log("Peer review report saved to debug_forensic_peer_review.json");
        }
    } else {
        console.log("No analysis JSON found.");
    }

    process.exit(0);
}

dumpLatestJobAnalysis().catch(console.error);
