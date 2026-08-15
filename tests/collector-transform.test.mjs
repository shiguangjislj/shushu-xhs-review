import assert from "node:assert/strict";
import test from "node:test";
import { beijingDate, mapAccountMetrics, mapNoteDetail, mapNoteListItem, numeric, rate } from "../collector/transform.mjs";

test("normalizes formatted OpenCLI values without turning missing fields into zero", () => {
  assert.equal(numeric("1,733"), 1733);
  assert.equal(numeric("51.5秒"), 51.5);
  assert.equal(rate("18.6%"), 0.186);
  assert.equal(numeric(""), null);
  assert.equal(rate(null), null);
});

test("parses Xiaohongshu Beijing publish time as an absolute timestamp", () => {
  assert.equal(beijingDate("2026年03月18日 20:01"), "2026-03-18T12:01:00.000Z");
  assert.throws(() => beijingDate("无法识别"), /无法识别发布时间/);
});

test("maps creator profile and period summaries", () => {
  const profile = [{ field: "Name", value: "示例账号" }, { field: "Followers", value: "12,345" }];
  const seven = [
    { metric: "观看数 (views)", total: 1000 }, { metric: "点赞数 (likes)", total: 20 },
    { metric: "收藏数 (collects)", total: 10 }, { metric: "评论数 (comments)", total: 5 },
    { metric: "分享数 (shares)", total: 3 }, { metric: "涨粉数 (new followers)", total: 8 },
  ];
  const thirty = seven.map((row) => ({ ...row, total: Number(row.total) * 4 }));
  assert.deepEqual(mapAccountMetrics(profile, seven, thirty), {
    followers: 12345, views7d: 1000, views30d: 4000,
    interactions7d: 38, interactions30d: 152,
    followersGained7d: 8, followersGained30d: 32,
    dailyTrend: [],
  });
});

test("maps OpenCLI seven-day arrows into dated daily metrics", () => {
  const seven = [
    { metric: "观看数 (views)", total: 6, trend: "1 → 2 → 3" },
    { metric: "点赞数 (likes)", total: 9, trend: "2 → 3 → 4" },
    { metric: "收藏数 (collects)", total: 3, trend: "0 → 1 → 2" },
    { metric: "评论数 (comments)", total: 3, trend: "1 → 1 → 1" },
    { metric: "分享数 (shares)", total: 3, trend: "1 → 1 → 1" },
    { metric: "弹幕数 (danmaku)", total: 0, trend: "-" },
    { metric: "涨粉数 (new followers)", total: 6, trend: "1 → 2 → 3" },
  ];
  const mapped = mapAccountMetrics([], seven, [], "2026-08-15T04:00:00.000Z");
  assert.deepEqual(mapped.dailyTrend.map(({ date, views, interactions, followersGained }) => ({ date, views, interactions, followersGained })), [
    { date: "2026-08-12", views: 1, interactions: 4, followersGained: 1 },
    { date: "2026-08-13", views: 2, interactions: 6, followersGained: 2 },
    { date: "2026-08-14", views: 3, interactions: 8, followersGained: 3 },
  ]);
});

test("maps list and detail records to collector API fields", () => {
  const list = mapNoteListItem({ id: "abc", title: "示例视频", date: "2026年03月18日 20:01", views: 544, likes: 19, comments: 7, collects: 10, url: "https://example.test" });
  assert.equal(list.publishedAt, "2026-03-18T12:01:00.000Z");
  const rows = [
    { metric: "title", value: "示例视频" }, { metric: "曝光数", value: "1,733" },
    { metric: "观看数", value: "544" }, { metric: "封面点击率", value: "18.6%" },
    { metric: "平均观看时长", value: "51.5秒" }, { metric: "点赞数", value: "19" },
    { metric: "评论数", value: "7" }, { metric: "收藏数", value: "10" },
    { metric: "分享数", value: "6" }, { metric: "涨粉数", value: "3" },
  ];
  const mapped = mapNoteDetail(rows, { platformVideoId: "abc", title: "旧标题", url: "u", publishedAt: list.publishedAt, durationSeconds: 60 }, 6);
  assert.deepEqual(mapped.metrics, { exposures: 1733, views: 544, coverClickRate: 0.186, avgWatchSeconds: 51.5, likes: 19, comments: 7, collects: 10, shares: 6, followersGained: 3 });
  assert.equal(mapped.targetNodeHours, 6);
});
