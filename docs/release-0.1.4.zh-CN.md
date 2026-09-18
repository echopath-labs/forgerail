# ForgeRail 0.1.4

本补丁明确 Core 的连续推进与授权复用策略。实际发布以版本化 GitHub Release 和 npm registry 为准。

- 持续完成已授权的工程工作、审查修复与复验，不以“下一步建议”代替执行。
- 一次明确请求可覆盖多个阶段；各操作和目标已获授权时，独立门禁不意味着反复询问。
- 实质性取舍、范围变化或缺失授权才需要人决定。CI 通过、bot 认可及低风险本身不授权合并或发布。
- 保留无关 dirty 文件，已有分支适合当前任务时不重复确认；达到目标、用户暂停或确实受阻时停止，不无限追加评审。

这是指令层策略，不是自动批准运行时，也不绕过宿主权限。没有新增 Skill、executor、schema 或 CLI 操作。既有发布与项目快照不会自动升级。公开自动门禁覆盖结构、包内容和既有回归，不证明新增策略的模型行为。发布准备另做了有限的本地场景演练，它不是公开自动行为套件，也不保证模型服从。

安装精确版本：

```sh
npm install --global @echopath-labs/forgerail@0.1.4
forgerail validate
```

按[安装](installation.zh-CN.md)与[采用](adoption.zh-CN.md)说明加载 Skill；安装不自动激活 Skill 或创建 Host Binding Receipt。原生 Plugin 激活、市场/Directory 提交、独立二进制及 `.forgerail/` 持久治理继续暂缓。每个外部 Capability Pack 分别安装与发现，身份保留 alpha.4；主包目标为 `latest`，`next` 独立保留。不会自动迁移 AGW。

## 维护者发布流程

本文件记录候选流程，实际发布结果以版本化 GitHub Release 和 registry 为准。最终源码及安装归档须在 Node.js 22 和 24 运行 `npm run test:maintainer`，覆盖文档、fixture、完整性、发布契约和实际安装消费者套件。发布后匿名回下载公共归档，比对批准产物摘要和安装文件，并在两个运行时验证 CLI 与包内自检。

公共候选是已观测远端 `main` 的普通子 commit。基于该基线通过源码投影准备 `codex/forgerail-0.1.4` 分支；必要修正使用普通的 source-first successor commit，不改写已批准历史。Draft PR base 与 publication comparison baseline 继续绑定已观测远端 `main`，如有并发变动则重新核验。

合并前必须取得真实 Agent bot review，优先 Codex，其次团队配置的 bot。CI 和自查不能替代评审；采纳的问题修正后，确保评审覆盖最终 head。没有可用 bot 时由 owner 决定后续。合并后的公共 `main` tree 必须等于最终批准的 projection tree，之后创建 annotated tag `v0.1.4`、向 npm `latest` 发布精确包并创建正式 GitHub Release。

执行前记录 owner 对具体 PR/合并的 `remote_integration_approval`，以及具体 tag、npm 包/通道和 GitHub Release 的 `release_approval`。同一明确请求可覆盖前两个门禁，无需逐阶段重复确认。`lifecycle_change_approval` 单独处理：本版不授权旧 AGW 退役或活跃项目迁移。不撤回既有发布或移动不可变 tag，必要时单独批准修正版。
