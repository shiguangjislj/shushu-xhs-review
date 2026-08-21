# 薯数账号与资产归属表

更新时间：2026-08-21

> 本表不保存密码、Token、Cookie、验证码或浏览器登录状态。

| 资产 | 当前资源 | 当前归属 | 数据/用途 | 交接处理 |
| --- | --- | --- | --- | --- |
| GitHub 私有仓库 | `shiguangjislj/shushu-xhs-review` | 用户个人 GitHub 账号 | 源码、迁移脚本、文档、部署配置 | 个人继续维护时保留；交给公司时迁移到公司或接手人私有仓库，不交个人账号密码 |
| Cloudflare Worker | `shushu-xhs-review` | 用户当前 Cloudflare 账号 | 正式前后端服务 | 换电脑时重新登录同一账号；正式交接时迁移到接手方独立账号并验收部署 |
| Cloudflare D1 | `shushu-review-db` | 同上 | 线上账号、视频指标、修改与复盘数据 | 保留独立 SQL 备份；迁移后核对视频数量和最新采集时间 |
| Cloudflare Images/静态资源 | `IMAGES` 与 Worker Assets | 同上 | 页面静态资源及可能的上传素材 | 随 Worker 配置核验；不以 GitHub 代替云端素材备份 |
| 正式域名 | `shushureview.cn` | 用户个人购买的腾讯云域名 | 正式访问入口 | 个人继续使用时不交出；公司继续使用须办理正式域名迁移或更换公司域名 |
| DNS | 腾讯云 DNSPod | 随域名账号 | 将域名指向 Cloudflare | 换电脑不受影响；交接前导出或截图有效解析记录 |
| 小红书创作者账号 | `路人甲TM` | 业务账号，最终责任人待公司确认 | OpenCLI 只读采集的数据来源 | 不交 Chrome Cookie；接手人用获授权的账号重新登录并运行连接体检 |
| OpenCLI Browser Bridge | 当前采集电脑 Chrome | 本机配置 | 连接已登录的小红书创作者中心 | 新电脑重新安装，不复制整个浏览器 Profile |
| 本机采集配置 | `.env.collector.local` | 私密配置 | API 地址、采集 Token、数量和间隔 | 仅通过加密包或密码管理器迁移，禁止提交 GitHub |
| 稳定账号标识 | `.wrangler/collector-account.json` / `XHS_PLATFORM_ACCOUNT_ID` | 私密配置 | 保持新旧电脑采集到同一个内部账号 | 随加密包迁移，禁止公开 |
| 访问密钥 | Cloudflare Secrets | 加密云端配置 | 访问密码、会话签名、采集接口鉴权 | 只记录变量名；交接验收后轮换实际值 |

## Cloudflare 加密变量名称

- `ACCESS_PASSWORD`
- `ACCESS_SESSION_SECRET`
- `COLLECTOR_TOKEN`

## 验收责任

- 当前维护人：用户本人。
- 公司接手人：待确认。
- 换电脑完成标准：新电脑通过 `npm run collector:doctor`，执行一次 `npm run collector:cloud:once`，线上最近 5 篇数据更新时间发生变化。
- 正式交接完成标准：接手方独立账号可以克隆、部署、采集和查看数据；随后轮换密钥并撤销原维护人的访问权限。
