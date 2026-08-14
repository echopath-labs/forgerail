# 安装与采用

ForgeRail 的主要形态是 Agent Plugin；npm 包是可选的确定性 CLI 与兼容载荷。

在 `v0.1.0-alpha.1` 发布后，注册不可变的 Marketplace 快照并安装主插件：

```bash
codex plugin marketplace add echopath-labs/forgerail --ref v0.1.0-alpha.1
codex plugin add forgerail@echopath-labs
```

安装后启动一个新的 Codex 任务，使插件发现基于已安装快照。新任务必须发现 `$forgerail`、`$forgerail-workspace-diagnosis` 和 `$workspace-health-review`。需要可复现安装时，不要用可变分支替代精确 tag。

GitHub Rulesets、Release Safety 与 Thread Closure 是单独插件，只按项目需要安装：

```bash
codex plugin add forgerail-github-rulesets@echopath-labs
codex plugin add forgerail-release-safety@echopath-labs
codex plugin add forgerail-thread-closure@echopath-labs
codex plugin add forgerail-cross-workspace-orchestration@echopath-labs
```

安装只让能力可用，不等于认证、启用、要求或批准外部副作用。Ruleset、仓库保护、发布、部署和生命周期变更仍需各自的精确审批。

只有当主控任务需要协调多个真正独立的 owner workspace、repository 或 release identity，且依赖证据表明存在安全并行阶段时，才安装 Cross-Workspace Orchestration。普通单仓任务或 monorepo 目录拆分不适用。安装后状态仍是 `available`；必须显式调用，或在审查后沿用项目已有 instructions 采用。它不会自动创建任务或 durable record，远端集成、发布和 lifecycle 审批仍相互独立。

不同宿主不共享同一套 task/thread API。Codex、Claude Code、Cursor 等必须由 Host Adapter 明确声明并验证 create/inspect/wait/message/resume 能力；缺失时降级为用户创建的独立会话、稳定 handoff 或串行执行。RelayPact 只是可选委派 transport，EchoPath 只是可选恢复/上下文来源，均非运行时硬依赖。

安装只代表能力可用，不会修改项目 `AGENTS.md`、创建 `.forgerail/`、安装 OpenSpec 或要求项目启用 Workspace Health。项目采用、能力启用和长期规约变更都需要单独确认。

ForgeRail 采用渐进式三级模型：

1. **Plugin Only** 是默认状态，工作区零修改；
2. **Lightweight Adoption** 必须先生成精确只读计划并经用户确认；单宿主使用带版本 managed block，多宿主可使用 `FORGERAIL.md` 加薄绑定；
3. **Persisted Governance** 只在真实证据支持时考虑，alpha.1 延期且 CLI 不会生成 `.forgerail/` 状态。

可选 CLI 只生成候选，不会应用：

```bash
forgerail adoption-plan --workspace . --host codex
forgerail adoption-plan --workspace . --host codex --host claude-code --host cursor
```

alpha.1 只有 Codex Host Adapter 是 `supported`；Claude Code 与 Cursor 以 `profile-only` 发布，明确目标入口与限制，但不声称已验证激活。宿主 Agent 必须展示精确候选、取得确认、保护无关内容、只写获批路径，再在新任务或等价支持检查中验证发现并返回 Host Binding Receipt。

完整模型、支持矩阵、验证与移除语义见[渐进式采用](adoption.zh-CN.md)。

Agent Plugin 不依赖 npm CLI。官方包名为 `@echopath-labs/forgerail`；未作用域 `forgerail` 只保留名称占位，不是安装或回滚来源。registry 发布后，可用精确 scoped 版本执行离线校验和只读诊断：

```bash
npx --yes @echopath-labs/forgerail@0.1.0-alpha.1 validate
npx --yes @echopath-labs/forgerail@0.1.0-alpha.1 diagnose --workspace .
npm install --global @echopath-labs/forgerail@0.1.0-alpha.1
```

升级时注册新的精确 Marketplace tag，重新安装已选择的插件，再启动新的 Codex 任务验证 Skill 发现与只读诊断；npm CLI 只能在精确 `@echopath-labs/forgerail` 版本之间升级。回滚时重新注册最近已验证 tag，或退回冻结的 AGW 版本；卸载可选 CLI 使用 `npm uninstall --global @echopath-labs/forgerail`，不得删除项目记录、Agent instructions 或 Git 历史。

npm 发布、移动 `latest`、推送公共候选、tag、GitHub Release 和 AGW 生命周期变更都属于独立审批门。

项目专属门序与回滚边界见 [ForgeRail 0.1.0-alpha.1 发布 Runbook](release.zh-CN.md)。
