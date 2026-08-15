import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { auditLogs, changeEvents, videoVersions, videos } from "@/db/schema";
import { requireApiContext } from "@/lib/context";
import { apiError, json } from "@/lib/http";

type ChangeInput = {
  changeTypes: string[];
  title: string;
  coverUrl?: string | null;
  coverObjectKey?: string | null;
  videoUrl?: string | null;
  videoObjectKey?: string | null;
  durationSeconds?: number | null;
  body?: string | null;
  topics?: string[];
  effectiveAt: string;
  summary: string;
  hypothesis?: string | null;
  targetMetric?: string | null;
  note?: string | null;
};

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireApiContext();
    const { id } = await params;
    const input = await request.json() as Partial<ChangeInput>;
    if (!input.title || !input.summary || !input.effectiveAt || !input.changeTypes?.length) {
      return json({ ok: false, error: "请填写标题、修改类型、生效时间和修改说明" }, { status: 400 });
    }
    const db = getDb();
    const [video] = await db.select().from(videos).where(and(eq(videos.id, id), eq(videos.accountId, context.accountId))).limit(1);
    if (!video) return json({ ok: false, error: "视频不存在" }, { status: 404 });
    const [previous] = await db.select().from(videoVersions).where(eq(videoVersions.videoId, id)).orderBy(desc(videoVersions.versionNumber)).limit(1);
    const now = new Date().toISOString();
    const versionId = crypto.randomUUID();
    await db.insert(videoVersions).values({
      id: versionId,
      videoId: id,
      versionNumber: (previous?.versionNumber ?? 0) + 1,
      effectiveAt: new Date(input.effectiveAt).toISOString(),
      title: input.title,
      coverUrl: input.coverUrl ?? previous?.coverUrl ?? video.coverUrl,
      coverObjectKey: input.coverObjectKey ?? previous?.coverObjectKey ?? null,
      videoUrl: input.videoUrl ?? previous?.videoUrl ?? video.videoUrl,
      videoObjectKey: input.videoObjectKey ?? previous?.videoObjectKey ?? null,
      durationSeconds: typeof input.durationSeconds === "number" ? input.durationSeconds : previous?.durationSeconds ?? video.durationSeconds,
      body: input.body ?? previous?.body ?? null,
      topicsJson: JSON.stringify(input.topics ?? []),
      createdBy: context.userId,
      note: input.note ?? null,
      createdAt: now,
    });
    const changeId = crypto.randomUUID();
    await db.insert(changeEvents).values({
      id: changeId,
      videoId: id,
      fromVersionId: previous?.id ?? null,
      toVersionId: versionId,
      changeTypesJson: JSON.stringify(input.changeTypes),
      summary: input.summary,
      hypothesis: input.hypothesis ?? null,
      targetMetric: input.targetMetric ?? null,
      effectiveAt: new Date(input.effectiveAt).toISOString(),
      operatorId: context.userId,
      createdAt: now,
    });
    await db.update(videos).set({
      title: input.title,
      coverUrl: input.coverUrl ?? video.coverUrl,
      videoUrl: input.videoUrl ?? video.videoUrl,
      durationSeconds: typeof input.durationSeconds === "number" ? input.durationSeconds : video.durationSeconds,
      currentVersionId: versionId,
      updatedAt: now,
    }).where(eq(videos.id, id));
    await db.insert(auditLogs).values({
      id: crypto.randomUUID(), workspaceId: context.workspaceId, actorId: context.userId,
      action: "video.change.created", entityType: "change_event", entityId: changeId,
      detailJson: JSON.stringify({ changeTypes: input.changeTypes }), createdAt: now,
    });
    return json({ ok: true, data: { changeId, versionId }, warning: input.changeTypes.length > 1 ? "本次同时修改多个变量，后续效果判断将标记为低置信度" : null }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
