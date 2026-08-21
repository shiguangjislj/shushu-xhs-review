# 薯数换电脑与项目交接

这份说明不包含任何真实密码、Token 或小红书登录信息。

## GitHub 保存什么

私有 GitHub 仓库保存源码、数据库迁移脚本、README、部署配置、依赖清单和示例环境变量。以下内容禁止上传：

- `.env.collector.local` 和其他真实 `.env` 文件
- `.wrangler/` 中的本地数据库、账号标识和登录缓存
- `outputs/backups/` 中的数据库导出
- Chrome 登录状态、访问密码和任何 Token

## 换电脑前

1. 确认全部源码已提交并推送到私有 GitHub 仓库。
2. 导出 Cloudflare D1 数据库，并把 SQL 放入公司批准的加密存储。
3. 通过密码管理器或加密磁盘保存 `.env.collector.local`。
4. 保存 `.wrangler/collector-account.json`，或把其中的 `platformAccountId` 写入新电脑的 `XHS_PLATFORM_ACCOUNT_ID`。
5. 记录 GitHub、Cloudflare、腾讯云域名和小红书账号的资产负责人，不记录明文密码。
6. 在新电脑完成一次真实采集并核对线上页面后，再清理旧电脑。

## 新电脑恢复

```bash
git clone <private-repository-url>
cd shushu
npm install
npx wrangler login
```

然后恢复 `.env.collector.local`，在 Chrome 登录小红书创作者中心并安装 OpenCLI Browser Bridge，再运行：

```bash
npm run collector:doctor
npm run collector:cloud:once
```

确认 `https://shushureview.cn` 的最近 5 篇数据已更新。需要持续采集时运行：

```bash
npm run collector:cloud:start
```

## 日常更新与部署

```bash
npm run typecheck
npm test
npm run build
npx wrangler deploy
```

部署前必须确认 `git status` 中没有意外的密钥或数据库文件。

## 交给另一位同事

不要直接交出个人 GitHub、Cloudflare、腾讯云或邮箱密码。应把仓库、Worker、D1 数据库和域名迁移到公司或接手人的独立账号，验收新账号可部署和采集后，轮换 `ACCESS_PASSWORD`、`ACCESS_SESSION_SECRET`、`COLLECTOR_TOKEN`，再撤销原账号权限。
