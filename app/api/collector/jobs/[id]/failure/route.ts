import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { accounts, collectionJobs } from "@/db/schema";
import { requireCollectorToken } from "@/lib/collector-auth";
import { apiError, json } from "@/lib/http";

const RETRY_MINUTES = [5, 15, 30];

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireCollectorToken(request);
    const { id } = await params;
    const input = await request.json() as { code?: string; message?: string };
    const db = getDb();
    const [job] = await db.select().from(collectionJobs).where(eq(collectionJobs.id, id)).limit(1);
    if (!job) return json({ ok: false, error: "任务不存在" }, { status: 404 });
    const attempts = job.attempts + 1;
    const terminal = attempts >= 3;
    const now = new Date();
    const nextRetryAt = terminal ? null : new Date(now.getTime() + RETRY_MINUTES[Math.min(attempts - 1, RETRY_MINUTES.length - 1)] * 60_000).toISOString();
    await db.update(collectionJobs).set({
      attempts,
      status: terminal ? "failed" : "retrying",
      nextRetryAt,
      scheduledFor: nextRetryAt ?? job.scheduledFor,
      errorCode: input.code ?? "COLLECTOR_ERROR",
      errorMessage: input.message?.slice(0, 1000) ?? "采集失败",
      executedAt: now.toISOString(),
      updatedAt: now.toISOString(),
    }).where(eq(collectionJobs.id, id));
    if (terminal) {
      await db.update(accounts).set({ lastFailedCollectionAt: now.toISOString(), updatedAt: now.toISOString() }).where(eq(accounts.id, job.accountId));
    }
    return json({ ok: true, data: { attempts, status: terminal ? "failed" : "retrying", nextRetryAt } });
  } catch (error) {
    return apiError(error);
  }
}
