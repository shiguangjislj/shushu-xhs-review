import type { DerivedMetrics, DiagnosisResult, FunnelStage, VideoMetrics } from "./types";

export const DIAGNOSIS_RULE_VERSION = "mvp-1.0.0";
const STAGES: FunnelStage[] = ["exposure", "click", "retention", "engagement"];

const LABELS: Record<FunnelStage, string> = {
  exposure: "曝光量",
  click: "观看转化率",
  retention: "平均观看占比",
  engagement: "总互动率",
};

const REASONS: Record<FunnelStage, string[]> = {
  exposure: ["初始分发可能不足", "选题与账号受众匹配度可能偏低", "发布时间可能需要复核"],
  click: ["标题利益点可能不够清晰", "封面信息层级可能不够聚焦", "选题表达与用户预期可能存在偏差"],
  retention: ["开头承接可能偏慢", "内容节奏或时长可能需要调整", "正文与标题承诺可能不完全一致"],
  engagement: ["收藏理由可能不够明确", "讨论点或行动引导可能偏弱", "内容价值感可能没有充分转化为互动"],
};

const RECOMMENDATIONS: Record<FunnelStage | "unlocated", DiagnosisResult["recommendation"]> = {
  exposure: {
    action: "下一篇同类内容保持主体结构不变，只调整发布时间与选题表述",
    object: "发布时间或选题表达",
    targetMetric: "6 小时曝光量",
    verificationMethod: "与同类内容 6 小时曝光基线比较，并保证其他变量不变",
  },
  click: {
    action: "下一篇同类内容将封面核心利益点压缩为一句话，标题与正文保持不变",
    object: "封面",
    targetMetric: "6 小时观看转化率",
    verificationMethod: "观察 6 小时观看转化率是否高于同类内容基线",
  },
  retention: {
    action: "下一篇同类内容将核心结果前置到开头 3 秒，其他变量保持不变",
    object: "视频开头",
    targetMetric: "平均观看占比",
    verificationMethod: "比较 24 小时平均观看占比与同类内容基线",
  },
  engagement: {
    action: "下一篇同类内容补充一个明确的收藏理由或讨论问题，其他变量保持不变",
    object: "结尾互动引导",
    targetMetric: "总互动率",
    verificationMethod: "比较 24 小时总互动率与同类内容基线",
  },
  unlocated: {
    action: "先补齐缺失字段并继续观察到下一个生命周期节点",
    object: "数据完整性",
    targetMetric: "关键指标完整率",
    verificationMethod: "下个节点重新执行四环节诊断",
  },
};

export function safeRate(numerator: number | null | undefined, denominator: number | null | undefined) {
  if (numerator == null || denominator == null || denominator <= 0) return null;
  return numerator / denominator;
}

export function deriveMetrics(metrics: Partial<VideoMetrics>, durationSeconds?: number | null): DerivedMetrics {
  const interactions = [metrics.likes, metrics.comments, metrics.collects, metrics.shares];
  const engagement = interactions.some((value) => value == null)
    ? null
    : safeRate(interactions.reduce<number>((sum, value) => sum + Number(value), 0), metrics.views);

  return {
    exposure: metrics.exposures ?? null,
    click: metrics.coverClickRate ?? safeRate(metrics.views, metrics.exposures),
    retention: safeRate(metrics.avgWatchSeconds, durationSeconds),
    engagement,
  };
}

export function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function diagnose(
  current: DerivedMetrics,
  baseline: DerivedMetrics,
  sampleSize: number,
  nodeHours: number,
): DiagnosisResult {
  const evidence = STAGES.map((stage) => {
    const actual = current[stage];
    const reference = baseline[stage];
    const deviation = actual == null || reference == null || reference === 0 ? null : (actual - reference) / reference;
    const status = deviation == null ? "unavailable" : deviation <= -0.3 ? "low" : deviation >= 0.3 ? "high" : "normal";
    return { stage, label: LABELS[stage], actual, baseline: reference, deviation, status } as const;
  });

  const lowStages = evidence.filter((item) => item.status === "low").map((item) => item.stage);
  const primaryStage: FunnelStage | "unlocated" = lowStages.length ? lowStages[0] : "unlocated";
  const secondaryStage = lowStages[1] ?? null;
  const missing = evidence.filter((item) => item.status === "unavailable").map((item) => item.label);
  const limitations: string[] = [];
  if (sampleSize < 5) limitations.push(`同节点历史样本仅 ${sampleSize} 篇，基线置信度较低`);
  if (nodeHours === 2) limitations.push("2 小时节点仅作早期提示，不作为稳定结论");
  if (missing.length) limitations.push(`缺少或无法计算：${missing.join("、")}`);
  if (primaryStage === "unlocated" && !missing.length) limitations.push("各环节均接近自身基线，暂无法定位明显问题");

  const confidence = nodeHours === 2 || sampleSize < 5 || missing.length >= 2 ? "low" : sampleSize >= 12 && nodeHours >= 24 ? "high" : "medium";

  return {
    primaryStage,
    secondaryStage,
    confidence,
    evidence,
    normalStages: evidence.filter((item) => item.status === "normal" || item.status === "high").map((item) => item.stage),
    limitations,
    possibleReasons: primaryStage === "unlocated" ? [] : REASONS[primaryStage],
    recommendation: RECOMMENDATIONS[primaryStage],
  };
}

export function buildBaseline(rows: Array<DerivedMetrics>): DerivedMetrics {
  return {
    exposure: median(rows.flatMap((row) => row.exposure == null ? [] : [row.exposure])),
    click: median(rows.flatMap((row) => row.click == null ? [] : [row.click])),
    retention: median(rows.flatMap((row) => row.retention == null ? [] : [row.retention])),
    engagement: median(rows.flatMap((row) => row.engagement == null ? [] : [row.engagement])),
  };
}
