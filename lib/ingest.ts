import { and, desc, eq, ne } from "drizzle-orm";
import { getDb } from "@/db";
import {
  accountDailyMetrics, accounts, collectionJobs, diagnoses, metricSnapshots, recommendations,
  videoVersions, videos,
} from "@/db/schema";
import { buildBaseline, deriveMetrics, diagnose, DIAGNOSIS_RULE_VERSION } from "./diagnostics";
import type { CollectorPayload, VideoMetrics } from "./types";
import { getCollectorAccount } from "./context";

const NODES = [2, 6, 24, 72] as const;
const NODE_TOLERANCE_HOURS: Record<(typeof NODES)[number], number> = {
  2: 0.25,
  6: 0.5,
  24: 1,
  72: 2,
};
const METRIC_KEYS: Array<keyof VideoMetrics> = [
  "exposures", "views", "coverClickRate", "avgWatchSeconds", "completionRate",
  "likes", "comments", "collects", "shares", "followersGained",
];

function nullableNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function addHours(iso: string, hours: number) {
  return new Date(new Date(iso).getTime() + hours * 3_600_000).toISOString();
}

function ageHours(publishedAt: string, collectedAt: string) {
  return Math.max(0, (new Date(collectedAt).getTime() - new Date(publishedAt).getTime()) / 3_600_000);
}

export function validateCollectorPayload(value: unknown): CollectorPayload {
  if (!value || typeof value !== "object") throw new Response("采集数据格式错误", { status: 400 });
  const payload = value as Partial<CollectorPayload>;
  if (!payload.idempotencyKey || !payload.collectedAt || !payload.collectorVersion) throw new Response("缺少采集批次信息", { status: 400 });
  if (!payload.account?.platformAccountId || !payload.account.nickname) throw new Response("缺少账号信息", { status: 400 });
  if (!Array.isArray(payload.videos)) throw new Response("videos 必须为数组", { status: 400 });
  for (const video of payload.videos) {
    if (!video.platformVideoId || !video.title || !video.publishedAt || !video.metrics) {
      throw new Response("视频数据缺少必要字段", { status: 400 });
    }
  }
  return payload as CollectorPayload;
}

export async function ingest(payload: CollectorPayload) {
  const db = getDb();
  const now = new Date().toISOString();
  const collectedAt = new Date(payload.collectedAt).toISOString();
  const account = await getCollectorAccount(payload.account.platformAccountId);
  if (!account) throw new Response("未找到可接收数据的内部账号，请先在应用中完成初始化", { status: 409 });

  await db.update(accounts).set({
    platformAccountId: payload.account.platformAccountId,
    nickname: payload.account.nickname,
    avatarUrl: payload.account.avatarUrl ?? null,
    connectionStatus: "connected",
    lastVerifiedAt: collectedAt,
    lastSuccessfulCollectionAt: collectedAt,
    collectorVersion: payload.collectorVersion,
    updatedAt: now,
  }).where(eq(accounts.id, account.id));

  if (payload.accountMetrics) {
    await db.insert(metricSnapshots).values({
      id: crypto.randomUUID(),
      accountId: account.id,
      videoId: null,
      sourceKey: `${payload.idempotencyKey}:account`,
      collectedAt,
      completeness: "complete",
      rawJson: JSON.stringify(payload.accountMetrics),
      followers: nullableNumber(payload.accountMetrics.followers),
      views7d: nullableNumber(payload.accountMetrics.views7d),
      views30d: nullableNumber(payload.accountMetrics.views30d),
      interactions7d: nullableNumber(payload.accountMetrics.interactions7d),
      interactions30d: nullableNumber(payload.accountMetrics.interactions30d),
      followersGained7d: nullableNumber(payload.accountMetrics.followersGained7d),
      followersGained30d: nullableNumber(payload.accountMetrics.followersGained30d),
      createdAt: now,
    }).onConflictDoNothing();

    for (const row of payload.accountMetrics.dailyTrend ?? []) {
      const values = {
        views: nullableNumber(row.views),
        avgWatchMs: nullableNumber(row.avgWatchMs),
        homeViews: nullableNumber(row.homeViews),
        likes: nullableNumber(row.likes),
        collects: nullableNumber(row.collects),
        comments: nullableNumber(row.comments),
        danmaku: nullableNumber(row.danmaku),
        shares: nullableNumber(row.shares),
        interactions: nullableNumber(row.interactions),
        followersGained: nullableNumber(row.followersGained),
        collectedAt,
        rawJson: JSON.stringify(row),
        updatedAt: now,
      };
      await db.insert(accountDailyMetrics).values({
        id: crypto.randomUUID(),
        accountId: account.id,
        metricDate: row.date,
        ...values,
        createdAt: now,
      }).onConflictDoUpdate({
        target: [accountDailyMetrics.accountId, accountDailyMetrics.metricDate],
        set: values,
      });
    }
  }

  const results: Array<{ videoId: string; platformVideoId: string; snapshotCreated: boolean; diagnosisId?: string }> = [];
  for (const item of payload.videos) {
    let [video] = await db.select().from(videos)
      .where(and(eq(videos.accountId, account.id), eq(videos.platformVideoId, item.platformVideoId)))
      .limit(1);
    const isNew = !video;

    if (!video) {
      const videoId = crypto.randomUUID();
      const pendingNodes = NODES.filter((node) => {
        const scheduledAt = new Date(addHours(item.publishedAt, node)).getTime();
        const latestUsefulAt = scheduledAt + NODE_TOLERANCE_HOURS[node] * 3_600_000;
        return new Date(collectedAt).getTime() <= latestUsefulAt;
      });
      await db.insert(videos).values({
        id: videoId,
        accountId: account.id,
        platformVideoId: item.platformVideoId,
        url: item.url ?? null,
        title: item.title,
        coverUrl: item.coverUrl ?? null,
        videoUrl: item.videoUrl ?? null,
        publishedAt: new Date(item.publishedAt).toISOString(),
        syncedAt: collectedAt,
        durationSeconds: nullableNumber(item.durationSeconds),
        category: item.category ?? null,
        tagsJson: JSON.stringify(item.tags ?? []),
        status: pendingNodes.length ? "monitoring" : "historical",
        createdAt: now,
        updatedAt: now,
      });
      [video] = await db.select().from(videos).where(eq(videos.id, videoId)).limit(1);

      const versionId = crypto.randomUUID();
      await db.insert(videoVersions).values({
        id: versionId,
        videoId,
        versionNumber: 1,
        effectiveAt: video.publishedAt,
        title: item.title,
        coverUrl: item.coverUrl ?? null,
        videoUrl: item.videoUrl ?? null,
        durationSeconds: nullableNumber(item.durationSeconds),
        tagsJson: JSON.stringify(item.tags ?? []),
        createdBy: "collector",
        note: "首次同步的发布版本",
        createdAt: now,
      });
      await db.update(videos).set({ currentVersionId: versionId }).where(eq(videos.id, videoId));

      for (const node of pendingNodes) {
        await db.insert(collectionJobs).values({
          id: crypto.randomUUID(), accountId: account.id, videoId, jobType: "lifecycle",
          targetNodeHours: node, scheduledFor: addHours(video.publishedAt, node), status: "pending",
          createdAt: now, updatedAt: now,
        }).onConflictDoNothing();
      }
    } else {
      await db.update(videos).set({
        title: item.title,
        coverUrl: item.coverUrl ?? video.coverUrl,
        videoUrl: item.videoUrl ?? video.videoUrl,
        syncedAt: collectedAt,
        durationSeconds: nullableNumber(item.durationSeconds) ?? video.durationSeconds,
        category: item.category ?? video.category,
        tagsJson: item.tags ? JSON.stringify(item.tags) : video.tagsJson,
        updatedAt: now,
      }).where(eq(videos.id, video.id));
    }

    const metrics = Object.fromEntries(METRIC_KEYS.map((key) => [key, nullableNumber(item.metrics[key])])) as VideoMetrics;
    const missingFields = METRIC_KEYS.filter((key) => metrics[key] == null);
    const sourceKey = `${payload.idempotencyKey}:video:${item.platformVideoId}:${item.targetNodeHours ?? "current"}`;
    const snapshotId = crypto.randomUUID();
    const insertResult = await db.insert(metricSnapshots).values({
      id: snapshotId,
      accountId: account.id,
      videoId: video.id,
      sourceKey,
      collectedAt,
      ageHours: ageHours(video.publishedAt, collectedAt),
      targetNodeHours: item.targetNodeHours ?? null,
      isBackfill: item.targetNodeHours != null && ageHours(video.publishedAt, collectedAt) > item.targetNodeHours + (item.targetNodeHours >= 72 ? 2 : item.targetNodeHours >= 24 ? 1 : 0.5),
      completeness: missingFields.length === 0 ? "complete" : missingFields.length < METRIC_KEYS.length ? "partial" : "unavailable",
      missingFieldsJson: JSON.stringify(missingFields),
      rawJson: JSON.stringify(item.raw ?? item.metrics),
      ...metrics,
      createdAt: now,
    }).onConflictDoNothing().returning({ id: metricSnapshots.id });

    if (item.targetNodeHours != null) {
      await db.update(collectionJobs).set({
        status: "completed", executedAt: collectedAt, errorCode: null, errorMessage: null, updatedAt: now,
      }).where(and(
        eq(collectionJobs.videoId, video.id),
        eq(collectionJobs.jobType, "lifecycle"),
        eq(collectionJobs.targetNodeHours, item.targetNodeHours),
      ));
      if (item.targetNodeHours === 72) {
        await db.update(videos).set({ status: missingFields.length ? "incomplete" : "completed", updatedAt: now }).where(eq(videos.id, video.id));
      }
    }

    let diagnosisId: string | undefined;
    if (insertResult.length && item.targetNodeHours != null) {
      diagnosisId = await diagnoseSnapshot(video.id, snapshotId, item.targetNodeHours, metrics, video.durationSeconds);
    }

    results.push({ videoId: video.id, platformVideoId: item.platformVideoId, snapshotCreated: insertResult.length > 0, diagnosisId });
    if (isNew) results[results.length - 1].snapshotCreated = true;
  }

  return { accountId: account.id, collectedAt, videos: results };
}

async function diagnoseSnapshot(videoId: string, snapshotId: string, nodeHours: number, metrics: VideoMetrics, durationSeconds: number | null) {
  const db = getDb();
  const [currentVideo] = await db.select().from(videos).where(eq(videos.id, videoId)).limit(1);
  const candidates = await db.select({ snapshot: metricSnapshots, durationSeconds: videos.durationSeconds, category: videos.category })
    .from(metricSnapshots)
    .innerJoin(videos, eq(metricSnapshots.videoId, videos.id))
    .where(and(
      eq(metricSnapshots.accountId, currentVideo.accountId),
      eq(metricSnapshots.targetNodeHours, nodeHours),
      ne(metricSnapshots.videoId, videoId),
    ))
    .orderBy(desc(metricSnapshots.collectedAt))
    .limit(100);

  const categoryCandidates = currentVideo.category
    ? candidates.filter((candidate) => candidate.category === currentVideo.category)
    : [];
  const selectedCandidates = (categoryCandidates.length >= 5 ? categoryCandidates : candidates).slice(0, 20);
  const baselineRows = selectedCandidates.map(({ snapshot, durationSeconds: duration }) => deriveMetrics(snapshot, duration));
  const result = diagnose(deriveMetrics(metrics, durationSeconds), buildBaseline(baselineRows), baselineRows.length, nodeHours);
  if (currentVideo.category && categoryCandidates.length < 5) {
    result.limitations.push(`“${currentVideo.category}”分类样本不足 5 篇，已回退到账号整体基线`);
  }
  const now = new Date().toISOString();
  const diagnosisId = crypto.randomUUID();
  await db.insert(diagnoses).values({
    id: diagnosisId,
    videoId,
    snapshotId,
    nodeHours,
    primaryStage: result.primaryStage,
    secondaryStage: result.secondaryStage,
    confidence: result.confidence,
    evidenceJson: JSON.stringify(result.evidence),
    normalStagesJson: JSON.stringify(result.normalStages),
    limitationsJson: JSON.stringify(result.limitations),
    possibleReasonsJson: JSON.stringify(result.possibleReasons),
    ruleVersion: DIAGNOSIS_RULE_VERSION,
    createdAt: now,
  }).onConflictDoNothing();
  await db.insert(recommendations).values({
    id: crypto.randomUUID(),
    diagnosisId,
    ...result.recommendation,
    status: "open",
    createdAt: now,
    updatedAt: now,
  });
  return diagnosisId;
}
