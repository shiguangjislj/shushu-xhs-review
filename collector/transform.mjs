export function field(rows, name) {
  return rows.find((row) => row.field === name)?.value ?? null;
}

export function stat(rows, englishName) {
  return rows.find((row) => String(row.metric).includes(`(${englishName})`))?.total ?? null;
}

export function trend(rows, englishName) {
  const value = rows.find((row) => String(row.metric).includes(`(${englishName})`))?.trend;
  if (value == null || String(value).trim() === "-") return [];
  return String(value).split(/\s*→\s*/).map(numeric);
}

export function detail(rows, metric) {
  return rows.find((row) => row.metric === metric)?.value ?? null;
}

export function numeric(value) {
  if (value == null || value === "") return null;
  const number = Number.parseFloat(String(value).replace(/[,，%秒]/g, ""));
  return Number.isFinite(number) ? number : null;
}

export function rate(value) {
  const number = numeric(value);
  return number == null ? null : Math.round((number / 100) * 1_000_000) / 1_000_000;
}

export function beijingDate(value) {
  const text = String(value ?? "").trim();
  const match = text.match(/(\d{4})[年-](\d{1,2})[月-](\d{1,2})[日T\s]+(\d{1,2}):(\d{2})/);
  if (!match) {
    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) throw new Error(`无法识别发布时间：${text || "空值"}`);
    return parsed.toISOString();
  }
  const [, y, m, d, h, minute] = match;
  return new Date(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T${h.padStart(2, "0")}:${minute}:00+08:00`).toISOString();
}

function beijingDateKey(value) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(value);
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function mapAccountMetrics(profile, seven, thirty, collectedAt = new Date().toISOString()) {
  const interactionNames = ["likes", "collects", "comments", "shares"];
  const sumInteractions = (rows) => {
    const values = interactionNames.map((name) => numeric(stat(rows, name)));
    return values.every((value) => value == null) ? null : values.reduce((sum, value) => sum + (value ?? 0), 0);
  };
  const dailySeries = {
    views: trend(seven, "views"),
    avgWatchMs: trend(seven, "avg view time ms"),
    homeViews: trend(seven, "home views"),
    likes: trend(seven, "likes"),
    collects: trend(seven, "collects"),
    comments: trend(seven, "comments"),
    danmaku: trend(seven, "danmaku"),
    shares: trend(seven, "shares"),
    followersGained: trend(seven, "new followers"),
  };
  const days = Math.max(...Object.values(dailySeries).map((values) => values.length));
  const dailyTrend = Array.from({ length: days }, (_, index) => {
    const metric = Object.fromEntries(Object.entries(dailySeries).map(([key, values]) => [key, values[index] ?? null]));
    const interactions = interactionNames.map((name) => metric[name]).every((value) => value == null)
      ? null
      : interactionNames.reduce((sum, name) => sum + (metric[name] ?? 0), 0) + (metric.danmaku ?? 0);
    return {
      date: beijingDateKey(new Date(new Date(collectedAt).getTime() - (days - index) * 86_400_000)),
      ...metric,
      interactions,
    };
  });
  return {
    followers: numeric(field(profile, "Followers")),
    views7d: numeric(stat(seven, "views")),
    views30d: numeric(stat(thirty, "views")),
    interactions7d: sumInteractions(seven),
    interactions30d: sumInteractions(thirty),
    followersGained7d: numeric(stat(seven, "new followers")),
    followersGained30d: numeric(stat(thirty, "new followers")),
    dailyTrend,
  };
}

export function mapNoteListItem(note) {
  return {
    platformVideoId: String(note.id),
    title: String(note.title || "未命名内容"),
    url: note.url || null,
    publishedAt: beijingDate(note.date),
    metrics: {
      views: numeric(note.views),
      likes: numeric(note.likes),
      comments: numeric(note.comments),
      collects: numeric(note.collects),
    },
    raw: note,
  };
}

export function mapNoteDetail(rows, video, targetNodeHours) {
  return {
    platformVideoId: video.platformVideoId,
    title: detail(rows, "title") || video.title,
    url: video.url,
    publishedAt: video.publishedAt,
    durationSeconds: video.durationSeconds,
    targetNodeHours,
    metrics: {
      exposures: numeric(detail(rows, "曝光数")),
      views: numeric(detail(rows, "观看数")),
      coverClickRate: rate(detail(rows, "封面点击率")),
      avgWatchSeconds: numeric(detail(rows, "平均观看时长")),
      likes: numeric(detail(rows, "点赞数")),
      comments: numeric(detail(rows, "评论数")),
      collects: numeric(detail(rows, "收藏数")),
      shares: numeric(detail(rows, "分享数")),
      followersGained: numeric(detail(rows, "涨粉数")),
    },
    raw: rows,
  };
}
