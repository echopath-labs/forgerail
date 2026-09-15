# ForgeRail 0.1.0

首个正式版支持 npm 安装和包内 Skill 显式加载。本版包含自包含 AGW/WHR 指导、现有架构审计中的可选语言无关工程范式指导、可在安装包内运行的自检，以及仓库内 Skill 快照接入说明。

安装精确版本：

```sh
npm install --global @echopath-labs/forgerail@0.1.0
forgerail validate
```

随后按[安装说明](installation.zh-CN.md)和[项目接入](adoption.zh-CN.md)让宿主 Agent 加载相应 Skill。项目内接入保留既有规则并记录精确归档身份。模板及 Go 服务项目工程工作流采用任务已验证新会话交接和配套回退。

主包发布到 npm `latest`，`next` 保留现有预发布版本；可选外部 Pack 维持 alpha.4 身份，每个外部 Capability Pack 分别安装与发现，按需采用。原生 Plugin 激活、市场/Directory 注册、独立二进制及持久化 `.forgerail/` 治理不属于本版支持范围。Host Binding Receipt 表达经批准的项目绑定，npm 安装本身不创建它。

## 维护者发布流程

本文件记录候选流程，实际发布结果以版本化 GitHub Release 和 registry 为准。最终源码及安装归档须在 Node.js 22 和 24 运行 `npm run test:maintainer`，覆盖文档、fixture、完整性、发布契约和实际安装消费者套件。发布后匿名回下载公共归档，比对批准产物摘要和安装文件，并在两个运行时验证 CLI 与包内自检。

公共候选是已观测远端 `main` 的普通子 commit。基于该基线通过源码投影准备 `codex/forgerail-0.1.0` 分支；必要修正使用普通的 source-first successor commit，不改写已批准历史。Draft PR base 与 publication comparison baseline 继续绑定已观测远端 `main`，如有并发变动则重新核验。

合并前必须取得真实 Agent bot review，优先 Codex，其次团队配置的 bot。CI 和自查不能替代评审；采纳的问题修正后，确保评审覆盖最终 head。没有可用 bot 时由 owner 决定后续。合并后的公共 `main` tree 必须等于最终批准的 projection tree，之后创建 annotated tag `v0.1.0`、向 npm `latest` 发布精确包并创建正式 GitHub Release。

执行前记录 owner 对具体 PR/合并的 `remote_integration_approval`，以及具体 tag、npm 包/通道和 GitHub Release 的 `release_approval`。`lifecycle_change_approval` 单独处理：本版不授权旧 AGW 退役或活跃项目迁移。不撤回既有发布或移动不可变 tag，必要时单独批准修正版。

## 验证范围

MVP 证据覆盖显式加载、模板初始化、工程工作流采用任务、已有项目检查、配套回退和仅项目根的新会话交接；不代表所有语言/宿主、原生发现及无关业务需求均已验收。alpha.5 历史证据保留在[原发布说明](release-alpha5.zh-CN.md)。
