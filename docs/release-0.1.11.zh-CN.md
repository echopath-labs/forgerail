# ForgeRail 0.1.11 发布说明

发布状态以 npm 和版本化 GitHub Release 为准。源码版本、本地归档和静态检查通过，均不能证明 npm 发布或宿主行为验收。


- 复用现有 Core 和一份按需 reference，新增可选 RelayPact 委派指导。项目规约或用户须明确启用偏好；Host 判断任务适配、当前可验证能力，以及拆分、交接、执行、复核和返工总成本。
- 复用有效任务授权，不重复索取相同确认。偏好不扩大范围、不越过宿主强制限制；Host 收取结果、核对实际产物和证据，负责验收与最终回报。
- 微小、高耦合或交接不合算的工作由 Host 直接处理。不可用路由、部分结果和未知成本如实报告，无证据不声称成功或节省；派发、模型、进程、等待、取消、重试和恢复继续归 RelayPact/宿主。

见[可选委派指导](../skills/forgerail/references/optional-delegation.md)。此候选不新增 Skill owner、CLI 命令、配置/schema、持久任务状态或执行运行时；保留既有工程投入、分支检查和可靠性行为。外部 Capability Pack 保持独立 `0.1.0-alpha.4` 版本。

## 宿主验收与安装

Core `7ad344f3eb2b77f3d4b25d98bbbd0142150540108d2f8153c8f500f36aa6bb7d` 在用户运行两个全新隔离会话后，于 2026-10-26 获 Cursor IDE 有界受理。Agent 自撰报告描述读取 Core/可选 reference/Profile，并结合小任务与外部 worker 禁令合理直接处理；无关只读报告描述仅阅读 README。独立准备摘要锚点、不可变 Core/输入、当前 Git/文件/测试和留存的分支 before/after 通过观察支持该限定结论。未提供完整原始 transcript，完整读取顺序及没有未记录动作未独立审计。Cursor 版本、模型和档位未知，Grok 4.7 仅为报告系统自称；显式条件探针是推理证据，不是运行时或恢复实测。Rule 回退仍为 profile-only，CLI、Cloud Agent 和其他宿主支持不提升；每个接入项目仍须新会话验证。见[宿主支持](adoption.zh-CN.md#宿主支持)。

仅在 npm 与版本化 GitHub Release 确认精确版本已发布后安装：

```sh
npm install --global @echopath-labs/forgerail@0.1.11
forgerail validate
forgerail init --workspace .
```

最后一条命令仅预览计划。已有项目须显式评审更新并通过新会话验证；npm 安装本身不证明 Skill 发现或原生 Plugin 激活，也不产生 Host Binding Receipt。`.forgerail/` 仅含安装元数据，不是持久任务治理。每个外部 Capability Pack 分别安装与发现。

## 维护者发布流程

准备工作不授权公开集成、tag、发布或生命周期变化。最终源码与实际安装归档须在 Node.js 22 和 24 运行 `npm run test:maintainer`；接受的 Core 摘要必须继续匹配最终源码；未匹配时发布门禁保持失败。[当前 runbook](release.zh-CN.md)约束后续获授权执行，包括 staged npm publishing 和 owner 本人批准。

公共候选是已观测远端 `main` 的普通子 commit。基于该基线通过源码投影准备 `release/0.1.11` 分支；必要修正使用普通的 source-first successor commit，不改写已批准历史。Draft PR base 与 publication comparison baseline 继续绑定已观测远端 `main`，如有并发变动则重新核验。

合并前取得真实 Agent bot review，优先 Codex，其次团队配置的 bot。CI 和自查不能替代评审；采纳的问题修正后，确保评审覆盖最终 head。没有可用 bot 时由 owner 决定后续。合并后的公共 `main` tree 必须等于最终批准的 projection tree，之后才可执行已获授权的发布。

`remote_integration_approval` 覆盖具体公开 PR 与合并；`release_approval` 覆盖精确 tag `v0.1.11`、以 public access 和 npm `latest` 暂存的 `@echopath-labs/forgerail@0.1.11`，以及对应正式 GitHub Release。上传 stage 不等于发布：先核对 staged 元数据及回下载归档与批准字节一致，再由 owner 本人完成网页批准与 2FA；Agent 不代替 owner 批准。registry 回读与匿名下载须匹配批准归档，之后才能声称发布。同一明确请求可覆盖其中多个精确动作，每个门禁均须取得精确目标与动作的授权。

`lifecycle_change_approval` 单独处理：本版不授权 AGW 退役或活跃消费者迁移。不得撤回既有发布或移动不可变 tag；必要时单独批准修正版。Directory 提交继续暂缓且未获批准。
