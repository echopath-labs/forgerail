# ForgeRail 0.1.7

本版增加一条有明确证据边界的 Cursor 路径，并强化 Core 的迭代纪律。可通过 npm 与版本化 GitHub Release 核对发布状态。

- 当适用的 `AGENTS.md` 指向与包源码一致的项目内 ForgeRail Core 时，把该精确 Cursor IDE Agent 共用 Core 路径标记为 `supported`。Cursor Rule 回退路径仍为 `profile-only`；广义 Cursor CLI 行为与 Cloud Agent 仍未验证。
- 引导 Agent 保持简洁的假设台账；同类失败重复出现后修正共享层；非关键不确定性不阻塞主线；遇到明确的人类门禁时停止并留下可恢复交接。
- 增加 adoption-closeout 回归及三个全新隔离 Codex CLI 行为会话，分别覆盖重复失败、关键人类决策和非关键不确定性。这些会话不构成跨宿主或统计可靠性证明。
- 保留版本与归属边界：已发布 0.1.6 不改写，既有项目快照不会自动升级，真实消费者接入仍是独立决策。

CLI 需要 Node.js 22+，目标项目不必创建 package.json。安装不证明原生 Plugin 激活或模型行为遵从；每个接入项目仍须针对其精确 Core tree 做新会话验收。

```sh
npm install --global @echopath-labs/forgerail@0.1.7
forgerail validate
forgerail init --workspace .
```

最后一条命令仅预览。应用、旧版来源迁移和恢复见 [项目接入](project-adoption.zh-CN.md)。保留已有快照的来源锁，按文档更新；不要覆盖未知文件。

写入完成而回执尚未保存时中断，仍需核对所有权。恢复不是对任意编辑器的事务隔离；受管内容漂移时整体拒绝移除。

本版不包含 AI 工具更新提醒或 RelayPact 可选委派引导，不调度 Agent。市场提交、独立二进制、Cursor Rule 认证、广义 Cursor CLI/Cloud Agent 认证和持久任务治理仍暂缓。外部 Pack 保持 alpha.4 身份，npm latest 与 next 分开。

维护者按 [英文发布流程](release-0.1.7.md#maintainer-release-procedure) 验证最终候选、PR bot review、完整 CI、合并树与精确归档，再在当前授权范围内发布；不能覆盖旧版本或移动不可变 tag。

安装不创建 Host Binding Receipt。每个外部 Capability Pack 分别安装与发现，`.forgerail/` 安装元数据不启用持久任务治理。

## 维护者发布流程

本文件记录 0.1.7 发布流程，实际发布结果以版本化 GitHub Release 和 registry 为准。最终源码及安装归档须在 Node.js 22 和 24 运行 `npm run test:maintainer`，覆盖文档、fixture、完整性、发布契约和实际安装消费者套件。发布后匿名回下载公共归档，比对批准产物摘要和安装文件，并在两个运行时验证 CLI 与包内自检。

公共候选是已观测远端 `main` 的普通子 commit。基于该基线通过源码投影准备 `release/0.1.7` 分支；必要修正使用普通的 source-first successor commit，不改写已批准历史。Draft PR base 与 publication comparison baseline 继续绑定已观测远端 `main`，如有并发变动则重新核验。

合并前必须取得真实 Agent bot review，优先 Codex，其次团队配置的 bot。CI 和自查不能替代评审；采纳的问题修正后，确保评审覆盖最终 head。没有可用 bot 时由 owner 决定后续。合并后的公共 `main` tree 必须等于最终批准的 projection tree，之后创建 annotated tag `v0.1.7`、向 npm `latest` 发布精确包并创建正式 GitHub Release。

执行前记录 owner 对具体 PR/合并的 `remote_integration_approval`，以及具体 tag、npm 包/通道和 GitHub Release 的 `release_approval`。同一明确请求可覆盖前两个门禁，无需逐阶段重复确认。`lifecycle_change_approval` 单独处理：本版不授权旧 AGW 退役或活跃项目迁移。不撤回既有发布或移动不可变 tag，必要时单独批准修正版。
