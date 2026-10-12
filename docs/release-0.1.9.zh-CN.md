# ForgeRail 0.1.9

本版仅修复可靠性，保留 0.1.8 引入的能力和宿主支持边界。实际发布以 npm 与版本化 GitHub Release 为准，源码版本不代表已发布。

- 生命周期 journal 和临时恢复副本保持 POSIX `0600`；恢复原模式及支持的特殊位，替换前拒绝模式或原始存在状态漂移。
- journal 1.2 记录原始 POSIX 权限；旧 1.1 日志中已替换和已删除文件均需人工核对原权限，新建文件仍可安全撤销。不恢复 ACL、owner/group 或扩展属性；Windows ACL 需独立验收。
- 项目治理块独立分隔，移除时还原原始用户字节；未闭合 fence 或 HTML 上下文中拒绝插入。
- 有界识别 Markdown 结构，将代码、注释、raw HTML 和明确指令示例排除出规则证据；不声称实现完整 Markdown renderer。
- provider 预检前后重新确认声明来源；每次请求共享最多 128 次调用与 15 秒 provider 预算，重复 selector 零调用拒绝，晚到成功仍为 unresolved。预算不含来源和文件系统检查；强制超时针对直接子进程，不保证任意后代进程清理。
- 错误类型或超复杂契约返回有界字段/输入错误（深度 64、10,000 个 JSON 值），避免重复扫描和高密度分隔符分配。

确认精确版本已发布后安装：

```sh
npm install --global @echopath-labs/forgerail@0.1.9
forgerail validate
forgerail init --workspace .
```

最后一条命令仅预览计划。见 [项目接入](project-adoption.zh-CN.md)和 [Privacy](../PRIVACY.md)。已有项目 Skill 和安装元数据需显式更新；npm 安装不迁移项目，也不证明原生 Plugin 激活。共用 Core 未修改，沿用既有 Codex/Cursor IDE 行为证据；各项目仍需新会话验证。外部 Pack 保留独立 alpha.4 版本。本版不新增能力、Agent 运行时、持久任务治理或 Directory 提交。

安装不产生 Host Binding Receipt；`.forgerail/` 仅含安装元数据，不是持久任务治理。每个外部 Capability Pack 分别安装与发现。

## 维护者发布流程

本文件记录 0.1.9 发布流程，实际发布结果以版本化 GitHub Release 和 registry 为准。最终源码及安装归档须在 Node.js 22 和 24 运行 `npm run test:maintainer`，覆盖文档、fixture、完整性、发布契约和实际安装消费者套件。发布后匿名回下载公共归档，比对批准产物摘要和安装文件，并在两个运行时验证 CLI 与包内自检。

公共候选是已观测远端 `main` 的普通子 commit。基于该基线通过源码投影准备 `release/0.1.9` 分支；必要修正使用普通的 source-first successor commit，不改写已批准历史。Draft PR base 与 publication comparison baseline 继续绑定已观测远端 `main`，如有并发变动则重新核验。

合并前必须取得真实 Agent bot review，优先 Codex，其次团队配置的 bot。CI 和自查不能替代评审；采纳的问题修正后，确保评审覆盖最终 head。没有可用 bot 时由 owner 决定后续。合并后的公共 `main` tree 必须等于最终批准的 projection tree，之后创建 annotated tag `v0.1.9`、向 npm `latest` 发布精确包并创建正式 GitHub Release。

执行前记录 owner 对具体 PR/合并的 `remote_integration_approval`，以及具体 tag、npm 包/通道和 GitHub Release 的 `release_approval`。同一明确请求可覆盖前两个门禁，无需逐阶段重复确认。`lifecycle_change_approval` 单独处理：本版不授权旧 AGW 退役或活跃项目迁移。不撤回既有发布或移动不可变 tag，必要时单独批准修正版。
