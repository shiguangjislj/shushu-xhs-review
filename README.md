# 薯数

小红书自有账号的数据监测与内容复盘工具。第一阶段只在本机连接一个已经登录的创作者账号，默认同步最近 5 篇内容，验证：

1. 核心指标能否连续稳定采集一周；
2. 能否形成每篇内容发布后 2 / 6 / 24 / 72 小时曲线；
3. 数据能否定位曝光、点击、留存或互动问题。

## 数据存放在哪里

正式站点与本地开发使用两套存储：

- 正式站点：Cloudflare Worker + D1 数据库，域名为 `https://shushureview.cn`
- 本地开发数据库：`.wrangler/state/v3/d1/`
- 本地开发素材：`.wrangler/state/v3/r2/`
- 小红书登录状态：由本机 Chrome 与 OpenCLI Browser Bridge 管理

`.wrangler/`、`.env*` 和数据库导出文件都已被 Git 忽略，不会提交到 GitHub。代码仓库只保存源码、表结构、迁移脚本、部署配置和不含真实密钥的示例配置。

## 本地启动

需要 Node.js 22.13 或更高版本。

```bash
npm install
npm run local:start
```

`local:start` 会先应用尚未执行的本地数据库迁移，再启动应用。默认地址是 `http://localhost:3000`。

单独检查或执行迁移：

```bash
npm run db:local:status
npm run db:local:migrate
```

## 连接小红书采集器

先在 Chrome 登录 `creator.xiaohongshu.com`，并安装 OpenCLI Browser Bridge。然后复制 `.env.example` 为 `.env.local`，按需填写配置。

```bash
npm run collector:doctor
npm run collector:once
```

确认首次只读采集正确后，再启动每 10 分钟轮询的本地采集器：

```bash
npm run collector:start
```

线上站点使用独立的本机私密配置 `.env.collector.local`。配置一次后，手动同步一轮：

```bash
npm run collector:cloud:once
```

需要连续采集时再运行：

```bash
npm run collector:cloud:start
```

`.env.collector.local` 不会提交到 GitHub；云端密钥只作为 Cloudflare Worker 的加密变量保存。

采集器只调用 OpenCLI 的创作者后台只读命令，不执行发布、评论或删除操作。登录失效或字段缺失不会被记录成真实的零值。

## 开发检查

```bash
npm run typecheck
npm test
```

## 本地备份

本地测试数据可以在停止应用和采集器后，通过复制 `.wrangler/state/` 备份。正式数据位于 Cloudflare D1，建议离职、换机或重大升级前额外导出：

```bash
mkdir -p outputs/backups
npx wrangler d1 export shushu-review-db --remote --output outputs/backups/shushu-review.sql
```

数据库导出包含真实业务数据，不能提交到 GitHub。换电脑和项目交接步骤见 [`docs/HANDOFF.md`](docs/HANDOFF.md)。
