export type FunnelStage = "exposure" | "click" | "retention" | "engagement";
export type Confidence = "low" | "medium" | "high";

export type VideoMetrics = {
  exposures: number | null;
  views: number | null;
  coverClickRate: number | null;
  avgWatchSeconds: number | null;
  completionRate: number | null;
  likes: number | null;
  comments: number | null;
  collects: number | null;
  shares: number | null;
  followersGained: number | null;
};

export type DerivedMetrics = {
  exposure: number | null;
  click: number | null;
  retention: number | null;
  engagement: number | null;
};

export type EvidenceItem = {
  stage: FunnelStage;
  label: string;
  actual: number | null;
  baseline: number | null;
  deviation: number | null;
  status: "low" | "normal" | "high" | "unavailable";
};

export type DiagnosisResult = {
  primaryStage: FunnelStage | "unlocated";
  secondaryStage: FunnelStage | null;
  confidence: Confidence;
  evidence: EvidenceItem[];
  normalStages: FunnelStage[];
  limitations: string[];
  possibleReasons: string[];
  recommendation: {
    action: string;
    object: string;
    targetMetric: string;
    verificationMethod: string;
  };
};

export type CollectorVideo = {
  platformVideoId: string;
  url?: string | null;
  title: string;
  coverUrl?: string | null;
  videoUrl?: string | null;
  publishedAt: string;
  durationSeconds?: number | null;
  category?: string | null;
  tags?: string[];
  targetNodeHours?: 2 | 6 | 24 | 72 | null;
  metrics: Partial<VideoMetrics>;
  raw?: unknown;
};

export type CollectorPayload = {
  idempotencyKey: string;
  collectedAt: string;
  collectorVersion: string;
  account: {
    platformAccountId: string;
    nickname: string;
    avatarUrl?: string | null;
  };
  accountMetrics?: {
    followers?: number | null;
    views7d?: number | null;
    views30d?: number | null;
    interactions7d?: number | null;
    interactions30d?: number | null;
    followersGained7d?: number | null;
    followersGained30d?: number | null;
    dailyTrend?: Array<{
      date: string;
      views: number | null;
      avgWatchMs: number | null;
      homeViews: number | null;
      likes: number | null;
      collects: number | null;
      comments: number | null;
      danmaku: number | null;
      shares: number | null;
      interactions: number | null;
      followersGained: number | null;
    }>;
  };
  videos: CollectorVideo[];
};
