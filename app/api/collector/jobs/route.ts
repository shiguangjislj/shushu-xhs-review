import { and, asc, eq, inArray, lte } from "drizzle-orm";
import { getDb } from "@/db";
import { accounts, collectionJobs, videos } from "@/db/schema";
import { requireCollectorToken } from "@/lib/collector-auth";
import { apiError, json } from "@/lib/http";

export async function GET(request: Request) {
  try {
    requireCollectorToken(request);
    const url = new URL(request.url);
    const platformAccountId = url.searchParams.get("platformAccountId");
    if (!platformAccountId) return json({ ok: false, error: "缺少 platformAccountId" }, { status: 400 });
    const db = getDb();
    const [account] = await db.select().from(accounts).where(eq(accounts.platformAccountId, platformAccountId)).limit(1);
    if (!account) return json({ ok: true, data: [] });
    const rows = await db.select({ job: collectionJobs, video: videos })
      .from(collectionJobs)
      .innerJoin(videos, eq(collectionJobs.videoId, videos.id))
      .where(and(
        eq(collectionJobs.accountId, account.id),
        inArray(collectionJobs.status, ["pending", "retrying"]),
        lte(collectionJobs.scheduledFor, new Date().toISOString()),
      ))
      .orderBy(asc(collectionJobs.scheduledFor))
      .limit(20);
    return json({ ok: true, data: rows });
  } catch (error) {
    return apiError(error);
  }
}
