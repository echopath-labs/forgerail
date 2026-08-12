# 安装与采用

ForgeRail 的主要形态是 Agent Plugin；npm 包是可选的确定性 CLI 与兼容载荷。

公开 Marketplace 命令将在签名后的公共候选形成后再固化。一个可发布候选必须支持精确版本安装，并让新的 Codex 任务发现 `$forgerail`、`$forgerail-workspace-diagnosis` 和 `$workspace-health-review`。

安装只代表能力可用，不会修改项目 `AGENTS.md`、创建 `.forgerail/`、安装 OpenSpec 或要求项目启用 Workspace Health。项目采用、能力启用和长期规约变更都需要单独确认。

升级必须绑定精确版本，并重新验证发现与只读诊断。回滚到最近已验证的 ForgeRail 或冻结的 AGW 版本；卸载不得删除项目记录、Agent instructions 或 Git 历史。

npm 发布、移动 `latest`、推送公共候选、tag、GitHub Release 和 AGW 生命周期变更都属于独立审批门。
