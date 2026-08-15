import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
};

export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  ...timestamps,
});

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  ...timestamps,
}, (table) => [uniqueIndex("users_email_unique").on(table.email)]);

export const workspaceMembers = sqliteTable("workspace_members", {
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id),
  userId: text("user_id").notNull().references(() => users.id),
  role: text("role").notNull().default("owner"),
  createdAt: text("created_at").notNull(),
}, (table) => [uniqueIndex("workspace_members_unique").on(table.workspaceId, table.userId)]);

export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id),
  platform: text("platform").notNull().default("xiaohongshu"),
  platformAccountId: text("platform_account_id"),
  nickname: text("nickname").notNull(),
  avatarUrl: text("avatar_url"),
  connectionStatus: text("connection_status").notNull().default("pending"),
  lastVerifiedAt: text("last_verified_at"),
  lastSuccessfulCollectionAt: text("last_successful_collection_at"),
  lastFailedCollectionAt: text("last_failed_collection_at"),
  collectorVersion: text("collector_version"),
  ...timestamps,
}, (table) => [
  index("accounts_workspace_idx").on(table.workspaceId),
  uniqueIndex("accounts_platform_account_unique").on(table.platform, table.platformAccountId),
]);

export const videos = sqliteTable("videos", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull().references(() => accounts.id),
  platformVideoId: text("platform_video_id").notNull(),
  url: text("url"),
  title: text("title").notNull(),
  coverUrl: text("cover_url"),
  videoUrl: text("video_url"),
  publishedAt: text("published_at").notNull(),
  syncedAt: text("synced_at").notNull(),
  durationSeconds: real("duration_seconds"),
  contentType: text("content_type").notNull().default("video"),
  category: text("category"),
  tagsJson: text("tags_json"),
  status: text("status").notNull().default("monitoring"),
  currentVersionId: text("current_version_id"),
  ...timestamps,
}, (table) => [
  uniqueIndex("videos_account_platform_unique").on(table.accountId, table.platformVideoId),
  index("videos_account_published_idx").on(table.accountId, table.publishedAt),
]);

export const videoVersions = sqliteTable("video_versions", {
  id: text("id").primaryKey(),
  videoId: text("video_id").notNull().references(() => videos.id),
  versionNumber: integer("version_number").notNull(),
  effectiveAt: text("effective_at").notNull(),
  title: text("title").notNull(),
  coverUrl: text("cover_url"),
  coverObjectKey: text("cover_object_key"),
  videoUrl: text("video_url"),
  videoObjectKey: text("video_object_key"),
  videoFileName: text("video_file_name"),
  videoHash: text("video_hash"),
  durationSeconds: real("duration_seconds"),
  body: text("body"),
  topicsJson: text("topics_json"),
  publishingStrategy: text("publishing_strategy"),
  tagsJson: text("tags_json"),
  createdBy: text("created_by").notNull(),
  note: text("note"),
  createdAt: text("created_at").notNull(),
}, (table) => [
  uniqueIndex("video_versions_number_unique").on(table.videoId, table.versionNumber),
  index("video_versions_effective_idx").on(table.videoId, table.effectiveAt),
]);

export const changeEvents = sqliteTable("change_events", {
  id: text("id").primaryKey(),
  videoId: text("video_id").notNull().references(() => videos.id),
  fromVersionId: text("from_version_id").references(() => videoVersions.id),
  toVersionId: text("to_version_id").notNull().references(() => videoVersions.id),
  changeTypesJson: text("change_types_json").notNull(),
  summary: text("summary").notNull(),
  hypothesis: text("hypothesis"),
  targetMetric: text("target_metric"),
  effectiveAt: text("effective_at").notNull(),
  operatorId: text("operator_id").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [index("change_events_video_time_idx").on(table.videoId, table.effectiveAt)]);

export const metricSnapshots = sqliteTable("metric_snapshots", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull().references(() => accounts.id),
  videoId: text("video_id").references(() => videos.id),
  sourceKey: text("source_key").notNull(),
  collectedAt: text("collected_at").notNull(),
  ageHours: real("age_hours"),
  targetNodeHours: integer("target_node_hours"),
  isBackfill: integer("is_backfill", { mode: "boolean" }).notNull().default(false),
  completeness: text("completeness").notNull().default("complete"),
  missingFieldsJson: text("missing_fields_json"),
  rawJson: text("raw_json").notNull(),
  followers: integer("followers"),
  views7d: integer("views_7d"),
  views30d: integer("views_30d"),
  interactions7d: integer("interactions_7d"),
  interactions30d: integer("interactions_30d"),
  followersGained7d: integer("followers_gained_7d"),
  followersGained30d: integer("followers_gained_30d"),
  exposures: integer("exposures"),
  views: integer("views"),
  coverClickRate: real("cover_click_rate"),
  avgWatchSeconds: real("avg_watch_seconds"),
  completionRate: real("completion_rate"),
  likes: integer("likes"),
  comments: integer("comments"),
  collects: integer("collects"),
  shares: integer("shares"),
  followersGained: integer("followers_gained"),
  trafficSourcesJson: text("traffic_sources_json"),
  createdAt: text("created_at").notNull(),
}, (table) => [
  uniqueIndex("metric_snapshots_source_unique").on(table.accountId, table.sourceKey),
  index("metric_snapshots_video_time_idx").on(table.videoId, table.collectedAt),
  index("metric_snapshots_baseline_idx").on(table.accountId, table.targetNodeHours, table.collectedAt),
]);

export const accountDailyMetrics = sqliteTable("account_daily_metrics", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull().references(() => accounts.id),
  metricDate: text("metric_date").notNull(),
  views: integer("views"),
  avgWatchMs: integer("avg_watch_ms"),
  homeViews: integer("home_views"),
  likes: integer("likes"),
  collects: integer("collects"),
  comments: integer("comments"),
  danmaku: integer("danmaku"),
  shares: integer("shares"),
  interactions: integer("interactions"),
  followersGained: integer("followers_gained"),
  collectedAt: text("collected_at").notNull(),
  rawJson: text("raw_json").notNull(),
  ...timestamps,
}, (table) => [
  uniqueIndex("account_daily_metrics_account_date_unique").on(table.accountId, table.metricDate),
]);

export const collectionJobs = sqliteTable("collection_jobs", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull().references(() => accounts.id),
  videoId: text("video_id").references(() => videos.id),
  jobType: text("job_type").notNull(),
  targetNodeHours: integer("target_node_hours"),
  scheduledFor: text("scheduled_for").notNull(),
  executedAt: text("executed_at"),
  status: text("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  nextRetryAt: text("next_retry_at"),
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  isBackfill: integer("is_backfill", { mode: "boolean" }).notNull().default(false),
  ...timestamps,
}, (table) => [
  uniqueIndex("collection_jobs_video_node_unique").on(table.videoId, table.jobType, table.targetNodeHours),
  index("collection_jobs_due_idx").on(table.accountId, table.status, table.scheduledFor),
]);

export const diagnoses = sqliteTable("diagnoses", {
  id: text("id").primaryKey(),
  videoId: text("video_id").notNull().references(() => videos.id),
  snapshotId: text("snapshot_id").notNull().references(() => metricSnapshots.id),
  nodeHours: integer("node_hours").notNull(),
  primaryStage: text("primary_stage").notNull(),
  secondaryStage: text("secondary_stage"),
  confidence: text("confidence").notNull(),
  evidenceJson: text("evidence_json").notNull(),
  normalStagesJson: text("normal_stages_json").notNull(),
  limitationsJson: text("limitations_json").notNull(),
  possibleReasonsJson: text("possible_reasons_json").notNull(),
  ruleVersion: text("rule_version").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [uniqueIndex("diagnoses_video_snapshot_unique").on(table.videoId, table.snapshotId)]);

export const recommendations = sqliteTable("recommendations", {
  id: text("id").primaryKey(),
  diagnosisId: text("diagnosis_id").notNull().references(() => diagnoses.id),
  action: text("action").notNull(),
  object: text("object").notNull(),
  targetMetric: text("target_metric").notNull(),
  verificationMethod: text("verification_method").notNull(),
  status: text("status").notNull().default("open"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [index("recommendations_diagnosis_idx").on(table.diagnosisId)]);

export const reviews = sqliteTable("reviews", {
  id: text("id").primaryKey(),
  videoId: text("video_id").notNull().references(() => videos.id),
  systemSummary: text("system_summary").notNull(),
  humanSummary: text("human_summary"),
  status: text("status").notNull().default("draft"),
  confirmedBy: text("confirmed_by"),
  confirmedAt: text("confirmed_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [uniqueIndex("reviews_video_unique").on(table.videoId)]);

export const experienceCards = sqliteTable("experience_cards", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id),
  accountId: text("account_id").notNull().references(() => accounts.id),
  sourceReviewId: text("source_review_id").references(() => reviews.id),
  title: text("title").notNull(),
  scope: text("scope").notNull(),
  observation: text("observation").notNull(),
  evidenceJson: text("evidence_json").notNull(),
  relatedChangesJson: text("related_changes_json"),
  action: text("action").notNull(),
  confidence: text("confidence").notNull().default("low"),
  status: text("status").notNull().default("draft"),
  version: integer("version").notNull().default(1),
  ...timestamps,
}, (table) => [index("experience_cards_workspace_idx").on(table.workspaceId, table.status)]);

export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id),
  actorId: text("actor_id").notNull(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  detailJson: text("detail_json"),
  createdAt: text("created_at").notNull(),
}, (table) => [index("audit_logs_entity_idx").on(table.entityType, table.entityId, table.createdAt)]);
