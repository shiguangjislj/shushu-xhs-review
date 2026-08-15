#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { field, mapAccountMetrics, mapNoteDetail, mapNoteListItem } from "./transform.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OPENCLI = resolve(ROOT, "node_modules/.bin/opencli");
const API_URL = (process.env.SHUSHU_API_URL ?? "http://localhost:3000").replace(/\/$/, "");
const TOKEN = process.env.SHUSHU_COLLECTOR_TOKEN ?? "dev-collector-token";
const LIMIT = Number.parseInt(process.env.SHUSHU_NOTE_LIMIT ?? "20", 10);
const INTERVAL_MS = Number.parseInt(process.env.SHUSHU_INTERVAL_MINUTES ?? "10", 10) * 60_000;

function runOpenCli(args) {
  const result = spawnSync(OPENCLI, [...args, "-f", "json", "--window", "background"], {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env,
    timeout: 240_000,
  });
  if (result.status !== 0) throw new Error((result.stderr || result.stdout || `OpenCLI 退出码 ${result.status}`).trim());
  return JSON.parse(result.stdout);
}

async function accountId() {
  if (process.env.XHS_PLATFORM_ACCOUNT_ID) return process.env.XHS_PLATFORM_ACCOUNT_ID;
  const stateDir = resolve(ROOT, ".wrangler");
  const stateFile = resolve(stateDir, "collector-account.json");
  try {
    const saved = JSON.parse(await readFile(stateFile, "utf8"));
    if (typeof saved.platformAccountId === "string" && saved.platformAccountId) return saved.platformAccountId;
  } catch { /* First run creates a stable local id. */ }
  const platformAccountId = `self-${randomUUID()}`;
  await mkdir(stateDir, { recursive: true });
  await writeFile(stateFile, JSON.stringify({ platformAccountId, createdAt: new Date().toISOString() }, null, 2) + "\n", { mode: 0o600 });
  return platformAccountId;
}

async function api(path, init = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json", ...init.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${response.status} ${body.error ?? response.statusText}`);
  return body;
}

async function discover() {
  const [profile, seven, thirty, notes] = [
    runOpenCli(["xiaohongshu", "creator-profile"]),
    runOpenCli(["xiaohongshu", "creator-stats", "--period", "seven"]),
    runOpenCli(["xiaohongshu", "creator-stats", "--period", "thirty"]),
    runOpenCli(["xiaohongshu", "creator-notes", "--limit", String(LIMIT)]),
  ];
  const name = String(field(profile, "Name") ?? "小红书账号");
  const platformAccountId = await accountId();
  const collectedAt = new Date().toISOString();
  await api("/api/collector/ingest", {
    method: "POST",
    body: JSON.stringify({
      idempotencyKey: `discover:${platformAccountId}:${collectedAt.slice(0, 16)}`,
      collectedAt,
      collectorVersion: "opencli-1.8.6/shushu-1.0.0",
      account: { platformAccountId, nickname: name },
      accountMetrics: mapAccountMetrics(profile, seven, thirty, collectedAt),
      videos: notes.map(mapNoteListItem),
    }),
  });
  return { platformAccountId, nickname: name, noteCount: notes.length };
}

async function collectDue(platformAccountId, nickname) {
  const { data: due } = await api(`/api/collector/jobs?platformAccountId=${encodeURIComponent(platformAccountId)}`);
  for (const { job, video } of due) {
    try {
      const rows = runOpenCli(["xiaohongshu", "creator-note-detail", video.platformVideoId]);
      const collectedAt = new Date().toISOString();
      await api("/api/collector/ingest", {
        method: "POST",
        body: JSON.stringify({
          idempotencyKey: `job:${job.id}`,
          collectedAt,
          collectorVersion: "opencli-1.8.6/shushu-1.0.0",
          account: { platformAccountId, nickname },
          videos: [mapNoteDetail(rows, video, job.targetNodeHours)],
        }),
      });
      process.stdout.write(`[${new Date().toISOString()}] 完成 ${video.title} @ ${job.targetNodeHours}h\n`);
    } catch (error) {
      await api(`/api/collector/jobs/${job.id}/failure`, { method: "POST", body: JSON.stringify({ message: error.message }) }).catch(() => {});
      process.stderr.write(`[${new Date().toISOString()}] 失败 ${video.title}: ${error.message}\n`);
    }
  }
  return due.length;
}

async function once() {
  const discovered = await discover();
  const dueCount = await collectDue(discovered.platformAccountId, discovered.nickname);
  process.stdout.write(JSON.stringify({ ok: true, ...discovered, dueCount, at: new Date().toISOString() }) + "\n");
}

async function main() {
  const mode = process.argv[2] ?? "once";
  if (mode === "doctor") {
    const result = spawnSync(OPENCLI, ["doctor"], { cwd: ROOT, encoding: "utf8", env: process.env });
    process.stdout.write(result.stdout); process.stderr.write(result.stderr); process.exitCode = result.status ?? 1; return;
  }
  await once();
  if (mode === "daemon") {
    const schedule = () => setTimeout(async () => {
      try { await once(); }
      catch (error) { process.stderr.write(`[${new Date().toISOString()}] ${error.stack || error.message}\n`); }
      finally { schedule(); }
    }, INTERVAL_MS);
    schedule();
  }
}

main().catch((error) => { process.stderr.write(`${error.stack || error.message}\n`); process.exitCode = 1; });
