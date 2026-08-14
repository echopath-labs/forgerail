# 渐进式采用

ForgeRail 将“能力可用”与“项目采用”明确分开。安装 Agent Plugin 或可选 CLI，只让能力可用；不会修改工作区 instructions、创建持久化状态、启用 Capability Pack，也不会授权任何外部副作用。

## 三级模型

### Level 0 — Plugin Only

这是默认级别。宿主 Agent 可以发现 Skills，但工作区保持不变。偶尔显式调用或依靠 Agent 按描述判断触发已经足够时，应停留在此级别。

### Level 1 — Lightweight Adoption

只有在 Agent 展示精确 Adoption Plan、用户确认其中写入后才采用：

- 单宿主且原则简短时，只向宿主原生 instruction 入口提出一个带版本 managed block；
- 多宿主时，提出 `FORGERAIL.md` 作为可移植 Adoption Contract，各宿主只保留指向它的薄绑定。

planner 永远只读：

```bash
forgerail adoption-plan --workspace . --host codex
forgerail adoption-plan --workspace . --host codex --host claude-code --host cursor
```

计划会给出当前/目标级别、精确路径与内容、基线 SHA-256、必需确认、验证步骤、宿主支持状态和明确非变更项。ForgeRail 刻意不提供 `apply-adoption` 命令；宿主 Agent 必须先展示候选或 diff，等待确认，只执行获批写入，再返回 Host Binding Receipt。

### Level 2 — Persisted Governance

只有现有工作区来源无法清楚承载的证据才可能需要此级别，例如机器读取配置、CI 强制或反复出现的跨宿主冲突。ForgeRail alpha.1 不创建也不提出 `.forgerail/` 状态；未来必须先定义 owner、优先级、迁移与删除语义。

## 宿主支持

| 宿主 | 原生入口 | alpha.1 状态 | 验证 |
| --- | --- | --- | --- |
| Codex | `AGENTS.md` | `supported` | 在采用范围内启动新的 Codex 任务，确认绑定生效并发现三个主插件 Skills。 |
| Claude Code | `CLAUDE.md` | `profile-only` | 已建模目标和薄绑定，但在宿主专项验证完成前不声称端到端激活。 |
| Cursor | `.cursor/rules/forgerail.mdc` | `profile-only` | 已建模 Rules 入口，但不声称 Skill 发现和端到端激活已验证。 |

未知宿主必须先有经过审查的 Host Adapter 才能生成绑定。Host Adapter 是投影边界，不是 ForgeRail Core，也不是第二套规则源。

## 可选跨工作区编排

不要因为安装了 orchestration Pack 就把它写进工作区 binding。只有观察到多个独立 owner/repository/release 边界和一个安全并行依赖波次后才建议采用；普通单仓工作继续使用 ForgeRail Core。

如果项目反复使用该模式，在取得精确 durable-write 确认后，沿用现有 OpenSpec、Spec Kit、ADR、Markdown、issue 或 instruction 习惯记录，不创建新的编排状态目录。创建任务以及每类 durable、远端、发布或 lifecycle 操作仍保留各自授权。

## 核验与移除

只有 applied digest 与获批 plan 一致、支持宿主在新任务或等价支持检查中完成发现、deviations 为空且非变更项已记录，采用才能 close 为 complete。`profile-only` 宿主在完成自身专项检查前仍保持未验证。

卸载 ForgeRail 不会静默删除项目已经采用的 instructions。插件卸载与项目绑定移除是两件事；修改或移除 managed block 也要经过新的审查计划，以保护无关项目内容。
