import { type ConversionJob, type InsertConversionJob, conversionJobs } from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  getConversionJob(id: string): Promise<ConversionJob | undefined>;
  createConversionJob(job: InsertConversionJob): Promise<ConversionJob>;
  updateConversionJob(id: string, updates: Partial<ConversionJob>): Promise<ConversionJob | undefined>;
  deleteConversionJob(id: string): Promise<boolean>;
  listConversionJobs(): Promise<ConversionJob[]>;
}

export class SQLiteStorage implements IStorage {
  async getConversionJob(id: string): Promise<ConversionJob | undefined> {
    const jobs = await db.select().from(conversionJobs).where(eq(conversionJobs.id, id));
    return jobs[0];
  }

  async createConversionJob(insertJob: InsertConversionJob): Promise<ConversionJob> {
    const id = randomUUID();
    const now = new Date();
    const job: ConversionJob = {
      ...insertJob,
      status: insertJob.status || "pending",
      paperType: insertJob.paperType || "research_paper",
      enhancementLevel: insertJob.enhancementLevel || "standard",
      authorName: insertJob.authorName || null,
      authorAffiliation: insertJob.authorAffiliation || null,
      originalContent: insertJob.originalContent || null,
      analysis: insertJob.analysis || null,
      latexContent: insertJob.latexContent || null,
      enhancements: insertJob.enhancements || null,
      logs: null,
      error: insertJob.error || null,
      id,
      createdAt: now,
      completedAt: null,
    };

    console.log('[Storage] About to insert job into database:', id);
    await db.insert(conversionJobs).values(job);
    console.log('[Storage] Job inserted successfully:', id);
    return job;
  }

  async updateConversionJob(id: string, updates: Partial<ConversionJob>): Promise<ConversionJob | undefined> {
    await db.update(conversionJobs)
      .set(updates)
      .where(eq(conversionJobs.id, id));

    return this.getConversionJob(id);
  }

  async deleteConversionJob(id: string): Promise<boolean> {
    const result = await db.delete(conversionJobs).where(eq(conversionJobs.id, id));
    // Check if any rows were deleted
    // Drizzle with better-sqlite3 returns RunResult which has changes property
    return result.changes > 0;
  }

  async listConversionJobs(): Promise<ConversionJob[]> {
    return await db.select().from(conversionJobs).orderBy(conversionJobs.createdAt);
  }
}

export const storage = new SQLiteStorage();
