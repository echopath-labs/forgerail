# ForgeRail 0.1.6

本次文档修订让用户可以把安装与验证目标直接交给 Coding Agent。实际发布状态以 npm 和版本化 GitHub Release 为准。

- 提供固定版本的接入提示词，按宿主实际支持状态选择安装、项目接入或包内 Skill 显式加载路径。
- 分别验证包与项目文件、宿主发现、真实工程任务中的行为；无法验证时明确标记，不把安装等同于激活。
- 使用精确版本 CLI 和隔离包路径，避免覆盖其他项目依赖的全局版本。
- 保持公开仓根目录与嵌套 Plugin 文档一致。0.1.5 的运行行为、Codex 项目接入闭环和支持边界均不变。

CLI 需要 Node.js 22+，目标项目不必创建 package.json。安装 CLI 不会自动升级现有项目快照。0.1.5 的 Codex 接入能力及此前的发现验证仍适用；本次文档修订不证明模型行为遵从或原生 Plugin 激活。

```sh
npm install --global @echopath-labs/forgerail@0.1.6
forgerail validate
forgerail init --workspace .
```

最后一条命令仅预览。应用、旧版来源迁移和恢复见 [项目接入](project-adoption.zh-CN.md)。保留已有快照的来源锁，按文档更新；不要覆盖未知文件。

写入完成而回执尚未保存时中断，仍需核对所有权。恢复不是对任意编辑器的事务隔离；受管内容漂移时整体拒绝移除。

本版不包含 AI 工具更新提醒或 RelayPact 可选委派引导，不调度 Agent。市场提交、独立二进制、其他宿主认证和持久任务治理仍暂缓。外部 Pack 保持 alpha.4 身份，npm latest 与 next 分开。

维护者按 [英文发布流程](release-0.1.6.md#maintainer-release-procedure) 验证最终候选、PR bot review、完整 CI、合并树与精确归档，再在当前授权范围内发布；不能覆盖旧版本或移动不可变 tag。

安装不创建 Host Binding Receipt。每个外部 Capability Pack 分别安装与发现，`.forgerail/` 安装元数据不启用持久任务治理。

## 维护者发布流程

本文件记录候选流程，实际发布结果以版本化 GitHub Release 和 registry 为准。最终源码及安装归档须在 Node.js 22 和 24 运行 `npm run test:maintainer`，覆盖文档、fixture、完整性、发布契约和实际安装消费者套件。发布后匿名回下载公共归档，比对批准产物摘要和安装文件，并在两个运行时验证 CLI 与包内自检。

公共候选是已观测远端 `main` 的普通子 commit。基于该基线通过源码投影准备 `release/0.1.6` 分支；必要修正使用普通的 source-first successor commit，不改写已批准历史。Draft PR base 与 publication comparison baseline 继续绑定已观测远端 `main`，如有并发变动则重新核验。

合并前必须取得真实 Agent bot review，优先 Codex，其次团队配置的 bot。CI 和自查不能替代评审；采纳的问题修正后，确保评审覆盖最终 head。没有可用 bot 时由 owner 决定后续。合并后的公共 `main` tree 必须等于最终批准的 projection tree，之后创建 annotated tag `v0.1.6`、向 npm `latest` 发布精确包并创建正式 GitHub Release。

执行前记录 owner 对具体 PR/合并的 `remote_integration_approval`，以及具体 tag、npm 包/通道和 GitHub Release 的 `release_approval`。同一明确请求可覆盖前两个门禁，无需逐阶段重复确认。`lifecycle_change_approval` 单独处理：本版不授权旧 AGW 退役或活跃项目迁移。不撤回既有发布或移动不可变 tag，必要时单独批准修正版。
