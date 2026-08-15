import assert from "node:assert/strict";
import test from "node:test";
import { buildBaseline, deriveMetrics, diagnose, median, safeRate } from "../lib/diagnostics.ts";

test("rate helpers preserve missing values and real zero", () => {
  assert.equal(safeRate(null, 100), null);
  assert.equal(safeRate(0, 100), 0);
  assert.equal(safeRate(10, 0), null);
  assert.equal(median([9, 1, 5]), 5);
  assert.equal(median([1, 3, 7, 9]), 5);
});

test("diagnosis chooses the earliest weak funnel stage", () => {
  const result = diagnose(
    { exposure: 1000, click: 0.1, retention: 0.25, engagement: 0.02 },
    { exposure: 1100, click: 0.2, retention: 0.5, engagement: 0.04 },
    10,
    24,
  );
  assert.equal(result.primaryStage, "click");
  assert.equal(result.secondaryStage, "retention");
  assert.equal(result.confidence, "medium");
  assert.match(result.recommendation.action, /封面/);
});

test("two-hour and insufficient-sample conclusions remain low confidence", () => {
  const result = diagnose(
    { exposure: 100, click: null, retention: null, engagement: 0.03 },
    { exposure: 200, click: 0.2, retention: 0.5, engagement: 0.04 },
    3,
    2,
  );
  assert.equal(result.primaryStage, "exposure");
  assert.equal(result.confidence, "low");
  assert.ok(result.limitations.some((item) => item.includes("样本")));
  assert.ok(result.limitations.some((item) => item.includes("早期提示")));
});

test("derived metrics and baseline use comparable lifecycle values", () => {
  const current = deriveMetrics({ exposures: 1000, views: 200, coverClickRate: null, avgWatchSeconds: 15, likes: 10, comments: 2, collects: 5, shares: 3 }, 30);
  assert.deepEqual(current, { exposure: 1000, click: 0.2, retention: 0.5, engagement: 0.1 });
  assert.deepEqual(buildBaseline([current, { ...current, exposure: 2000 }]), { ...current, exposure: 1500 });
});
