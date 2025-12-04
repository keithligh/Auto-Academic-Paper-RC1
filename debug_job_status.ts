
import { db } from "./server/db";
import { conversionJobs } from "./shared/schema";
import { desc } from "drizzle-orm";

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
        console.log(`Created At: ${job.createdAt}`);
        console.log(`Completed At: ${job.completedAt}`);
        console.log(`Error: ${job.error}`);

        console.log("\n=== LOGS ===");
        if (job.logs && Array.isArray(job.logs)) {
            job.logs.forEach(log => console.log(log));
        } else {
            console.log("No logs available.");
        }

        process.exit(0);
    } catch (error) {
        console.error("Error querying DB:", error);
        process.exit(1);
    }
}

checkLatestJob();
