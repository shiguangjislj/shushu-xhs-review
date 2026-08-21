import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("ships the Shushu product shell instead of starter UI", async () => {
  const [layout, page, loginPage, sharePage, app, accessAuth, schema, packageJson] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/login/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/share/[token]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/shushu-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/access-auth.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /title:\s*"薯数 · 小红书内容数据复盘"/);
  assert.match(page, /<ShushuApp\s*\/>/);
  assert.match(app, /数据总览/);
  assert.match(app, /异常与复盘/);
  assert.match(app, /经验库/);
  assert.match(app, /2 \/ 6 \/ 24 \/ 72 小时/);
  assert.match(app, /查看原帖/);
  assert.match(app, /xiaohongshu\.com\/explore/);
  assert.match(app, /生成只读链接/);
  assert.match(app, /只读分享/);
  assert.match(page, /\/login\?return_to=/);
  assert.match(loginPage, /路人甲TM 数据后台/);
  assert.match(accessAuth, /HttpOnly; SameSite=Lax/);
  assert.match(accessAuth, /crypto\.subtle\.sign/);
  assert.match(sharePage, /hasValidAccessSession/);
  assert.match(sharePage, /shareToken/);
  assert.match(schema, /share_links/);
  assert.doesNotMatch(`${layout}\n${page}\n${app}`, /Starter Project|Building your site|SkeletonPreview/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});
