import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { auditLogs, experienceCards, reviews, videos } from "@/db/schema";
import { requireApiContext } from "@/lib/context";
import { apiError, json } from "@/lib/http";

type ReviewInput = {
  systemSummary: string;
  humanSummary?: string;
  status?: "draft" | "confirmed";
  experience?: { title: string; scope: string; observation: string; action: string; evidence?: unknown[] };
};

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireApiContext();
    const { id } = await params;
    const input = await request.json() as ReviewInput;
    if (!input.systemSummary) return json({ ok: false, error: "缺少系统复盘结论" }, { status: 400 });
    const db = getDb();
    const [video] = await db.select().from(videos).where(and(eq(videos.id, id), eq(videos.accountId, context.accountId))).limit(1);
    if (!video) return json({ ok: false, error: "视频不存在" }, { status: 404 });
    const now = new Date().toISOString();
    const [existingReview] = await db.select().from(reviews).where(eq(reviews.videoId, id)).limit(1);
    const reviewId = existingReview?.id ?? crypto.randomUUID();
    await db.insert(reviews).values({
      id: reviewId, videoId: id, systemSummary: input.systemSummary,
      humanSummary: input.humanSummary ?? null, status: input.status ?? "draft",
      confirmedBy: input.status === "confirmed" ? context.userId : null,
      confirmedAt: input.status === "confirmed" ? now : null,
      createdAt: now, updatedAt: now,
    }).onConflictDoUpdate({
      target: reviews.videoId,
      set: { systemSummary: input.systemSummary, humanSummary: input.humanSummary ?? null, status: input.status ?? "draft", confirmedBy: input.status === "confirmed" ? context.userId : null, confirmedAt: input.status === "confirmed" ? now : null, updatedAt: now },
    });
    let experienceId: string | null = null;
    if (input.status === "confirmed" && input.experience) {
      experienceId = crypto.randomUUID();
      await db.insert(experienceCards).values({
        id: experienceId, workspaceId: context.workspaceId, accountId: context.accountId, sourceReviewId: reviewId,
        title: input.experience.title, scope: input.experience.scope, observation: input.experience.observation,
        evidenceJson: JSON.stringify(input.experience.evidence ?? [{ videoId: id }]), action: input.experience.action,
        confidence: "low", status: "draft", version: 1, createdAt: now, updatedAt: now,
      });
    }
    await db.insert(auditLogs).values({
      id: crypto.randomUUID(), workspaceId: context.workspaceId, actorId: context.userId,
      action: "review.saved", entityType: "video", entityId: id,
      detailJson: JSON.stringify({ status: input.status, experienceId }), createdAt: now,
    });
    return json({ ok: true, data: { reviewId, experienceId } });
  } catch (error) {
    return apiError(error);
  }
}
