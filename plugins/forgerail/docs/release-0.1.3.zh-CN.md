# ForgeRail 0.1.3

本候选收敛 ForgeRail 的工程治理职责，并修复两个输入/观察边界问题。实际发布以版本化 GitHub Release 和 npm registry 为准。

- 普通非 Git 项目的 `objects`、`refs`、`HEAD`、`config` 目录不再仅因出现两个名称而被拒绝观察。真实损坏元数据、裸仓库和不支持的观察仍返回 unavailable。
- Host Adapter 的错误 `bindingModes` 在库与 CLI 中返回字段诊断，不再抛 TypeError 或 INTERNAL_ERROR；合法结构继续接受语义检查。
- 移除实验 Cursor executor CLI、运行库、专用 schema 和测试。直接使用过这些实验路径的用户需另选受支持的宿主或委派能力。Cursor rules/Skill 绑定保留 `profile-only`；不新增 RelayPact 依赖或自动迁移。
- 显式脚本发布清单与真实 npm 产物检查阻止实验内容意外进入产品；澄清当前能力与暂缓的 Control System 设计。

详见[产品边界](product-boundary.zh-CN.md)及[可靠性说明](reliability.md)。既有发布保持不变。观察仍依赖可信 Git 与稳定元数据/配置；检查不是安全沙箱或执行授权。

发布后安装：

```sh
npm install --global @echopath-labs/forgerail@0.1.3
forgerail validate
```

发布前使用既有 0.1.2。按[安装](installation.zh-CN.md)与[采用](adoption.zh-CN.md)说明加载 Skill；安装不自动激活 Skill 或创建 Host Binding Receipt。原生 Plugin 激活、市场/Directory 提交、独立二进制及 `.forgerail/` 持久治理继续暂缓。每个外部 Capability Pack 分别安装与发现，身份保留 alpha.4；主包目标为 `latest`，`next` 独立保留。不会自动迁移 AGW。

## 维护者发布流程

本文件记录候选流程，实际发布结果以版本化 GitHub Release 和 registry 为准。最终源码及安装归档须在 Node.js 22 和 24 运行 `npm run test:maintainer`，覆盖文档、fixture、完整性、发布契约和实际安装消费者套件。发布后匿名回下载公共归档，比对批准产物摘要和安装文件，并在两个运行时验证 CLI 与包内自检。

公共候选是已观测远端 `main` 的普通子 commit。基于该基线通过源码投影准备 `codex/forgerail-0.1.3` 分支；必要修正使用普通的 source-first successor commit，不改写已批准历史。Draft PR base 与 publication comparison baseline 继续绑定已观测远端 `main`，如有并发变动则重新核验。

合并前必须取得真实 Agent bot review，优先 Codex，其次团队配置的 bot。CI 和自查不能替代评审；采纳的问题修正后，确保评审覆盖最终 head。没有可用 bot 时由 owner 决定后续。合并后的公共 `main` tree 必须等于最终批准的 projection tree，之后创建 annotated tag `v0.1.3`、向 npm `latest` 发布精确包并创建正式 GitHub Release。

执行前记录 owner 对具体 PR/合并的 `remote_integration_approval`，以及具体 tag、npm 包/通道和 GitHub Release 的 `release_approval`。`lifecycle_change_approval` 单独处理：本版不授权旧 AGW 退役或活跃项目迁移。不撤回既有发布或移动不可变 tag，必要时单独批准修正版。
