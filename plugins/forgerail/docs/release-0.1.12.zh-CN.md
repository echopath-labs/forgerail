# ForgeRail 0.1.12 发布说明

发布状态以 npm 和版本化 GitHub Release 为准。源码版本、本地归档或静态检查通过不代表已发布，也不表示消费者项目已安装升级。

- 在适用时围绕用户或消费者的连贯结果推进；技术子任务、CLI、CI、库和研究可以按各自约定结果收口。宿主依据实际范围与风险选择实践，不强制每次跑UI或额外写报告。
- 用户改向时承接未完成验收，区分继续、替代或暂缓，避免固守旧目标或静默丢弃未完成项。
- 选择最短有效反馈路径，尽早核对关键不确定性；复用适用证据，以实际状态和下一处缺口精简恢复上下文。
- 完成答复先给结果、证据与剩余缺口；实现、程序化检查、真实浏览器操作和人工验收分别陈述。

本版复用Core及既有引用，对所有工程模式适用；授权、数据保护和强制门禁保持不变。不新增Skill owner、CLI命令、schema/配置或执行运行时；保留可选RelayPact指导以及模式/分支检查能力。外部Capability Pack保持各自独立版本。

## 宿主验收与安装

精确Core `003e26034a9cb7d0650f7ace6a5ff48f65ddaa6f0546b419f003c04bdb29faa8` 于2026-10-30经三个全新隔离Cursor IDE会话通过有界证据复核，覆盖程序化页面入口修复、库函数修复与只读续接。Agent自撰报告、保留命令输出与独立候选/Core、保护文件、Git及功能检查交叉核对。未提供完整原始工具轨迹，无法独立审计完整读取顺序、无遗漏行为或报告提及的宿主浏览器规则确切优先级。Cursor版本/档位未知，Grok 4.7仅为报告自述。程序化DOM不是真实浏览器或人工验收；只读调查可按activation边界跳过Core，该场景不证明Core的因果作用。仅受理共享`AGENTS.md`加精确项目Core路径，不提升Rule回退、广义CLI、Cloud或其他宿主支持。每个接入项目仍须新会话验证，见[宿主支持](adoption.zh-CN.md#宿主支持)。

确认精确版本发布后再安装：

```sh
npm install --global @echopath-labs/forgerail@0.1.12
forgerail validate
forgerail init --workspace .
```

最后一条命令只预览计划。既有项目须明确评审升级；npm安装本身不证明发现或原生Plugin激活。`.forgerail/`保存有限安装元数据而非持久任务治理；每个外部 Capability Pack 分别安装与发现。

## 维护者发布流程

准备工作不授权公开集成、tag、发布或生命周期变化。最终源码与实际安装归档须在 Node.js 22 和 24 运行 `npm run test:maintainer`；接受的 Core 摘要必须继续匹配最终源码；未匹配时发布门禁保持失败。[当前 runbook](release.zh-CN.md)约束后续获授权执行，包括 staged npm publishing 和 owner 本人批准。

公共候选是已观测远端 `main` 的普通子 commit。基于该基线通过源码投影准备 `release/0.1.12` 分支；必要修正使用普通的 source-first successor commit，不改写已批准历史。Draft PR base 与 publication comparison baseline 继续绑定已观测远端 `main`，如有并发变动则重新核验。

合并前取得真实 Agent bot review，优先 Codex，其次团队配置的 bot。CI 和自查不能替代评审；采纳的问题修正后，确保评审覆盖最终 head。没有可用 bot 时由 owner 决定后续。合并后的公共 `main` tree 必须等于最终批准的 projection tree，之后才可执行已获授权的发布。

`remote_integration_approval` 覆盖具体公开 PR 与合并；`release_approval` 覆盖精确 tag `v0.1.12`、以 public access 和 npm `latest` 暂存的 `@echopath-labs/forgerail@0.1.12`，以及对应正式 GitHub Release。上传 stage 不等于发布：先核对 staged 元数据及回下载归档与批准字节一致，再由 owner 本人完成网页批准与 2FA；Agent 不代替 owner 批准。registry 回读与匿名下载须匹配批准归档，之后才能声称发布。同一明确请求可覆盖其中多个精确动作，每个门禁均须取得精确目标与动作的授权。

`lifecycle_change_approval` 单独处理：本版不授权 AGW 退役或活跃消费者迁移。不得撤回既有发布或移动不可变 tag；必要时单独批准修正版。Directory 提交继续暂缓且未获批准。
