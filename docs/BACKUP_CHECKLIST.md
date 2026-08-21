# 薯数离职前备份待办

更新时间：2026-08-21

- [x] 代码保存到私有 GitHub 仓库：`https://github.com/shiguangjislj/shushu-xhs-review`
- [x] GitHub 默认分支设为 `main`，并核验仓库为 Private。
- [x] 导出 Cloudflare D1 云端数据库：`outputs/backups/shushu-review-2026-08-21.sql`
- [x] 确认数据库、`.env.collector.local` 和 `.wrangler/` 被 Git 忽略。
- [x] 在 `.env.collector.local` 中保存稳定的 `XHS_PLATFORM_ACCOUNT_ID`，方便换电脑恢复。
- [x] 建立不含明文密码的账号与资产归属表：`docs/ASSET_REGISTER.md`。
- [x] 生成并验证包含数据库和两个本机私密文件的加密交接包：`outputs/backups/shushu-handoff-secure-2026-08-21.tar.gz.enc`。
- [ ] 把加密交接包复制到公司批准的加密移动硬盘或其他安全存储。
- [ ] 把加密包恢复密码保存到独立的密码管理器，不能与加密包放在一起。
- [ ] 在新电脑完成 GitHub 克隆、Cloudflare 登录、OpenCLI 连接和一次真实采集。
- [ ] 新电脑验收成功后，再退出旧电脑上的个人 GitHub、Cloudflare、邮箱和浏览器账号。
- [ ] 若交给同事，迁移到接手方独立账号，轮换密钥并撤销原维护人权限。
