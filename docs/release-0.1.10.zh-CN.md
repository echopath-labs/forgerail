# ForgeRail 0.1.10 准备说明

准备日期为 2026-10-22；尚未发布。源码版本、本地归档和静态检查通过，均不能证明 npm 发布或宿主行为验收。

- 新增 fast/balanced/strict 工程投入指导、局部风险加强、证据复用与停止条件；既有强制 review、CI 和操作授权继续有效。
- 通过既有 Project Profile 来源与范围解释 `engineering.mode`、`git.branch.naming`。无效、过期或冲突声明保持 unresolved，不自动刷新摘要，不新增策略存储。
- 新增本地只读 `branch-check`，观察宿主分支操作前后状态。获授权的 Git 操作与有界纠正归宿主；命令不修改分支、不访问远端、不授予权限。要求已有 HEAD commit；尚无首次提交的新仓库与 orphan branch 返回未验证。
- 补充内聚 PR、意图明确的 Commit 与编码前批次规划；体量提醒继续由项目决定，保留既有安全边界和门禁。

使用与限制见[工程投入与分支检查](engineering-mode.zh-CN.md)。保留 0.1.9 可靠性修复，外部 Capability Pack 保持各自 `0.1.0-alpha.4` 版本。不新增 Agent 运行时、自动项目迁移或持久任务治理系统。

## 宿主验收与安装

当前未发布 0.1.10 候选：用户于 2026-10-22 对 Core `3c75fcfd8f11317e0b2ff40878ef86d87d12b4be61b2df4654328f96de7a5a9a` 运行两个全新隔离 Cursor IDE 会话，2026-10-23 完成有界证据复核。原记录包含工程 Skill/Profile/声明策略读取、分支 before/create/after 调用、限定实现、测试调用与影响判断；无关只读原记录只有一次 README Read。留存的 before 结果通过；独立当前不可变输入/Git/文件/测试与 after 比较均通过，这些重核不补造缺失的原工具返回正文。Cursor 版本、原模型未知。工程会话还多读了参考文件，并先查错 policy 路径再读取声明源，因此不认证最小投入或每项指导均被遵守。验收仅覆盖该精确共用 Core 路径；Rule 回退、Cloud Agent 与广义 CLI 边界不变。2026-10-20 Core `bc188e56d4753a295b90e1e6ad422366a1b41aa83fef3999bac0340ec2c539b5` 的 Cursor IDE 3.25.6 / Claude Opus 5.5 High 验收保留为历史，不代表新会话身份。

仅在 npm 与版本化 GitHub Release 确认精确版本已发布后安装：

```sh
npm install --global @echopath-labs/forgerail@0.1.10
forgerail validate
forgerail init --workspace .
```

最后一条命令仅预览计划。已有项目须显式评审更新并通过新会话验证；npm 安装本身不证明 Skill 发现或原生 Plugin 激活，也不产生 Host Binding Receipt。`.forgerail/` 仅含安装元数据，不是持久任务治理。每个外部 Capability Pack 分别安装与发现。

## 维护者发布流程

准备工作不授权公开集成、tag、发布或生命周期变化。最终源码与实际安装归档须在 Node.js 22 和 24 运行 `npm run test:maintainer`；精确 Core 的宿主验收未解决时，发布门禁保持失败。[当前 runbook](release.zh-CN.md)约束后续获授权执行，包括 staged npm publishing 和 owner 本人批准。

公共候选是已观测远端 `main` 的普通子 commit。基于该基线通过源码投影准备 `release/0.1.10` 分支；必要修正使用普通的 source-first successor commit，不改写已批准历史。Draft PR base 与 publication comparison baseline 继续绑定已观测远端 `main`，如有并发变动则重新核验。

合并前取得真实 Agent bot review，优先 Codex，其次团队配置的 bot。CI 和自查不能替代评审；采纳的问题修正后，确保评审覆盖最终 head。没有可用 bot 时由 owner 决定后续。合并后的公共 `main` tree 必须等于最终批准的 projection tree，之后才可执行已获授权的发布。

`remote_integration_approval` 覆盖具体公开 PR 与合并；`release_approval` 覆盖精确 tag `v0.1.10`、以 public access 和 npm `latest` 暂存的 `@echopath-labs/forgerail@0.1.10`，以及对应正式 GitHub Release。上传 stage 不等于发布：先核对 staged 元数据及回下载归档与批准字节一致，再由 owner 本人完成网页批准与 2FA；Agent 不代替 owner 批准。registry 回读与匿名下载须匹配批准归档，之后才能声称发布。同一明确请求可覆盖其中多个精确动作，但本轮请求仅授权准备。

`lifecycle_change_approval` 单独处理：本版不授权 AGW 退役或活跃消费者迁移。不得撤回既有发布或移动不可变 tag；必要时单独批准修正版。Directory 提交继续暂缓且未获批准。
