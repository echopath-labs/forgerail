# 渐进式采用

ForgeRail 明确区分**安装**、**能力可用**、**项目采用**和**执行授权**。安装 Plugin 只是让 Agent 能发现引导能力；不会编辑工作区 instructions、创建持久状态、启用 Capability Pack 或批准任何外部影响。

本文对应当前公开预发布版本 `0.1.0-alpha.4` / `v0.1.0-alpha.4`。

默认从 Plugin Only 开始。只有重复证据表明“小范围持久绑定”比每次显式调用更有价值时，才升级采用层级。

## Level 0 — Plugin Only

这是默认且推荐的首次体验。工作区保持不变，同时可以使用四个 Skills：

- `$forgerail`：为有边界的工程任务提供引航；
- `$forgerail-workspace-diagnosis`：生成只读项目概览；
- `$workspace-health-review`：进行独立的工作区健康复盘；
- `$architecture-convergence-audit`：复核能力重复和 owner 漂移。

偶发诊断、陌生仓库、早期试用，以及已有 instructions 足够清晰的项目，都适合保持 Plugin Only。

## Level 1 — Lightweight Adoption

只有重复使用 ForgeRail 确实需要一个小型、可审查的项目绑定时，才采用这一层。

- 单宿主项目可以在宿主原生 instruction 文件中加入一个带版本的 managed block。
- 多宿主项目可以使用 `FORGERAIL.md` 作为可移植 Adoption Contract，再用薄绑定连接各宿主。
- 项目已有 instructions、规格、ADR、CI 和文档继续在各自领域保持权威。

可选 planner 只读运行：

```bash
npx --yes @echopath-labs/forgerail@0.1.0-alpha.4 adoption-plan --workspace . --host codex
npx --yes @echopath-labs/forgerail@0.1.0-alpha.4 adoption-plan --workspace . --host codex --host claude-code --host cursor
```

每个 proposal 必须展示当前与目标层级、准确路径和内容、基线摘要、所需确认、验证步骤、支持状态与明确不执行的动作。ForgeRail 有意不提供 `apply-adoption` 命令。Agent 应先展示 proposal，等待人类判断，只写入获批路径，在新任务中验证发现结果，并返回 Host Binding Receipt。

## Level 2 — Persisted Governance

当前 alpha 暂不启用机器消费的 ForgeRail 持久状态。只有重要证据无法通过项目现有来源表达，例如反复出现跨宿主冲突或确有机器强制策略需求时，才应考虑这一层。

ForgeRail 目前不会创建 `.forgerail/`。未来设计必须先定义 ownership、precedence、migration、recovery 和 deletion 语义。

## 宿主支持

| 宿主 | 原生目标 | Alpha.3 状态 | 验证边界 |
| --- | --- | --- | --- |
| Codex | `AGENTS.md` | `supported` | 新 Codex 任务发现全部四个主 Skills，且已批准绑定处于作用域内 |
| Claude Code | `CLAUDE.md` | `profile-only` | 已建模目标与薄绑定，不声称端到端激活已验证 |
| Cursor | `.cursor/rules/forgerail.mdc` | `profile-only` | 已建模目标，不声称 Skill discovery 和端到端激活已验证 |

未知宿主必须先有受审查的 Host Adapter，ForgeRail 才能生成绑定。Host Adapter 只是宿主投影边界，不是 ForgeRail Core，也不是第二套策略真相。

## Capability Pack 始终独立

不要因为 Pack 已安装就把它写入项目 instructions。只有项目证据确实需要该能力时才建议使用。每个 Pack 保持独立的认证、审批、验证、回滚和生命周期边界。

Cross-Workspace Orchestration 只适合真实的多 owner、多仓库或多发布边界，并且依赖关系允许安全并行的情况；不应该把普通单仓库人为拆成复杂任务。RelayPact 可以传输有边界的委派，EchoPath 可以支持恢复与上下文；两者都不是 ForgeRail 的运行时依赖。

## 完成与移除

Lightweight Adoption 只有满足以下条件才算完成：

1. 实际文件摘要与获批 plan 一致；
2. 在新任务或等价 fresh check 中完成 supported host discovery；
3. 没有偏差，或偏差已经明确接受；
4. receipt 准确记录改了什么、没有改什么。

卸载 Plugin 不会自动移除已采用的 instructions。应通过另一个精确、受审查的 plan 修改或移除 managed block，避免破坏无关内容。

正常使用请从[安装指南](installation.zh-CN.md)开始，在出现真实项目需要前保持 Plugin Only。
