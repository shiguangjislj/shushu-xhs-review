# 薯数

小红书自有账号的数据监测与内容复盘工具。第一阶段只在本机连接一个已经登录的创作者账号，默认同步最近 5 篇内容，验证：

1. 核心指标能否连续稳定采集一周；
2. 能否形成每篇内容发布后 2 / 6 / 24 / 72 小时曲线；
3. 数据能否定位曝光、点击、留存或互动问题。

## 数据存放在哪里

当前业务数据和素材都只保存在本机：

- 数据库：`.wrangler/state/v3/d1/`
- 封面、视频等素材：`.wrangler/state/v3/r2/`
- 小红书登录状态：由本机 Chrome 与 OpenCLI Browser Bridge 管理

这些目录已被 Git 忽略，不会提交到 GitHub。代码仓库只保存表结构和迁移脚本。

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

`.env.collector.local` 不会提交到 GitHub；云端密钥也只作为 Sites 的加密环境变量保存。

采集器只调用 OpenCLI 的创作者后台只读命令，不执行发布、评论或删除操作。登录失效或字段缺失不会被记录成真实的零值。

## 开发检查

```bash
npm run typecheck
npm test
```

## 本地备份

停止应用和采集器后，完整复制 `.wrangler/state/` 即可备份当前数据库和素材。恢复时把该目录复制回同一项目位置。
