import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  accountDailyMetrics, accounts, changeEvents, collectionJobs, diagnoses, experienceCards, metricSnapshots,
  recommendations, reviews, videoVersions, videos,
} from "@/db/schema";
import type { AppContext } from "./context";
import { parseJson } from "./http";

export async function getDashboard(context: AppContext) {
  const db = getDb();
  const [account] = await db.select().from(accounts).where(eq(accounts.id, context.accountId)).limit(1);
  const videoRows = await db.select().from(videos).where(eq(videos.accountId, context.accountId)).orderBy(desc(videos.publishedAt));
  const snapshots = await db.select().from(metricSnapshots).where(eq(metricSnapshots.accountId, context.accountId)).orderBy(desc(metricSnapshots.collectedAt));
  const jobs = await db.select().from(collectionJobs).where(eq(collectionJobs.accountId, context.accountId)).orderBy(desc(collectionJobs.scheduledFor));
  const accountTrendRows = await db.select().from(accountDailyMetrics)
    .where(eq(accountDailyMetrics.accountId, context.accountId))
    .orderBy(desc(accountDailyMetrics.metricDate))
    .limit(7);
  const videoIds = new Set(videoRows.map((video) => video.id));
  const diagnosisRows = (await db.select().from(diagnoses).orderBy(desc(diagnoses.createdAt))).filter((row) => videoIds.has(row.videoId));
  const latestAccountSnapshot = snapshots.find((snapshot) => !snapshot.videoId) ?? null;
  const latestByVideo = new Map<string, typeof metricSnapshots.$inferSelect>();
  for (const snapshot of snapshots) {
    if (snapshot.videoId && !latestByVideo.has(snapshot.videoId)) latestByVideo.set(snapshot.videoId, snapshot);
  }
  const diagnosisByVideo = new Map<string, typeof diagnoses.$inferSelect>();
  for (const diagnosis of diagnosisRows) if (!diagnosisByVideo.has(diagnosis.videoId)) diagnosisByVideo.set(diagnosis.videoId, diagnosis);

  const now = Date.now();
  const recentJobs = jobs.filter((job) => new Date(job.scheduledFor).getTime() > now - 24 * 3_600_000);
  const completed = recentJobs.filter((job) => job.status === "completed").length;
  const successRate = recentJobs.length ? completed / recentJobs.length : null;
  const latestSuccessMs = account.lastSuccessfulCollectionAt ? new Date(account.lastSuccessfulCollectionAt).getTime() : 0;
  const hasGap = account.connectionStatus === "connected" && (!latestSuccessMs || now - latestSuccessMs > 6 * 3_600_000);

  return {
    account,
    user: { email: context.email, displayName: context.displayName },
    health: {
      successRate,
      hasGap,
      pending: jobs.filter((job) => job.status === "pending").length,
      retrying: jobs.filter((job) => job.status === "retrying").length,
      failed: jobs.filter((job) => job.status === "failed").length,
      completed: jobs.filter((job) => job.status === "completed").length,
    },
    accountMetrics: latestAccountSnapshot,
    accountTrend: accountTrendRows.reverse(),
    videos: videoRows.map((video) => ({
      ...video,
      tags: parseJson<string[]>(video.tagsJson, []),
      latestSnapshot: latestByVideo.get(video.id) ?? null,
      diagnosis: diagnosisByVideo.get(video.id) ?? null,
      nodeCount: snapshots.filter((snapshot) => snapshot.videoId === video.id && snapshot.targetNodeHours != null).length,
    })),
    jobs: jobs.slice(0, 20),
    alerts: diagnosisRows.filter((diagnosis) => diagnosis.primaryStage !== "unlocated").slice(0, 10).map((diagnosis) => ({
      ...diagnosis,
      video: videoRows.find((video) => video.id === diagnosis.videoId) ?? null,
      evidence: parseJson(diagnosis.evidenceJson, []),
      limitations: parseJson(diagnosis.limitationsJson, []),
    })),
  };
}

export async function getVideoDetail(context: AppContext, videoId: string) {
  const db = getDb();
  const [video] = await db.select().from(videos)
    .where(and(eq(videos.id, videoId), eq(videos.accountId, context.accountId)))
    .limit(1);
  if (!video) throw new Response("视频不存在", { status: 404 });
  const snapshots = await db.select().from(metricSnapshots).where(eq(metricSnapshots.videoId, videoId)).orderBy(metricSnapshots.collectedAt);
  const versions = await db.select().from(videoVersions).where(eq(videoVersions.videoId, videoId)).orderBy(desc(videoVersions.versionNumber));
  const changes = await db.select().from(changeEvents).where(eq(changeEvents.videoId, videoId)).orderBy(desc(changeEvents.effectiveAt));
  const diagnosisRows = await db.select().from(diagnoses).where(eq(diagnoses.videoId, videoId)).orderBy(desc(diagnoses.nodeHours));
  const recommendationRows = await db.select().from(recommendations);
  const [review] = await db.select().from(reviews).where(eq(reviews.videoId, videoId)).limit(1);
  return {
    video: { ...video, tags: parseJson<string[]>(video.tagsJson, []) },
    snapshots,
    versions,
    changes: changes.map((change) => ({ ...change, changeTypes: parseJson<string[]>(change.changeTypesJson, []) })),
    diagnoses: diagnosisRows.map((diagnosis) => ({
      ...diagnosis,
      evidence: parseJson(diagnosis.evidenceJson, []),
      normalStages: parseJson(diagnosis.normalStagesJson, []),
      limitations: parseJson(diagnosis.limitationsJson, []),
      possibleReasons: parseJson(diagnosis.possibleReasonsJson, []),
      recommendation: recommendationRows.find((item) => item.diagnosisId === diagnosis.id) ?? null,
    })),
    review: review ?? null,
  };
}

export async function listExperiences(context: AppContext) {
  const db = getDb();
  const rows = await db.select().from(experienceCards)
    .where(eq(experienceCards.workspaceId, context.workspaceId))
    .orderBy(desc(experienceCards.updatedAt));
  return rows.map((row) => ({
    ...row,
    evidence: parseJson(row.evidenceJson, []),
    relatedChanges: parseJson(row.relatedChangesJson, []),
  }));
}
