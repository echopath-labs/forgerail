# 渐进式采用

ForgeRail 明确区分**安装**、**能力可用**、**项目采用**和**执行授权**。安装 Plugin 只是让 Agent 能发现引导能力；不会编辑工作区 instructions、创建持久状态、启用 Capability Pack 或批准任何外部影响。

本文对应候选版本 `0.1.0-alpha.4` / `v0.1.0-alpha.4`。是否已可安装以公开 Release 为准，源码文档本身不代表发布完成。

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

- 单宿主项目在 adapter 支持时，可以在宿主原生 instruction 文件中加入一个带版本的 managed block。
- 多宿主项目，或 adapter 只支持薄引用的单宿主项目，使用 `FORGERAIL.md` 作为可移植 Adoption Contract，再用薄绑定连接宿主。
- 项目已有 instructions、规格、ADR、CI 和文档继续在各自领域保持权威。

可选 planner 只读运行：

```bash
# 默认：只解析当前工作区中检测到的已注册宿主。
npx --yes @echopath-labs/forgerail@0.1.0-alpha.4 adoption-plan --workspace . --selection all-detected

# 从已验证的 Host Adapter Registry 中明确选择一部分。
npx --yes @echopath-labs/forgerail@0.1.0-alpha.4 adoption-plan --workspace . --host codex

# 选择当前已验证 registry 中的全部 adapter。
npx --yes @echopath-labs/forgerail@0.1.0-alpha.4 adoption-plan --workspace . --selection all-available
```

只读诊断不会跟随所选工作区内部的链接。它只读取有界的常规 `package.json` 和已注册 Host 绑定文件，每个文件最多 4 MiB；内容被消费前还会按 canonical workspace 复核已打开路径。不安全、发生变化、非常规或超限条目会作为“不可用证据”交给人类复核。只有安全受限的约定目录中至少存在一个有界常规 `.md` 文件时，才会报告 Markdown 记录实践；枚举上限为 4,096 项，空目录、超限目录、链接或非常规条目都不算 ADR 实践。

当前 Agent 可以把“只处理 Codex”“处理项目正在使用的全部 Agent”或“处理当前 registry 中的全部 adapter”等自然语言意图翻译成上述确定性模式。ForgeRail Core 不猜 instruction 路径、模板名称，也不猜如何处理已有但未受管的绑定；检测目标、绑定目标、绑定模板和已有内容策略都由版本化 Host Adapter 持有。若同时省略 `--host` 和 `--selection`，默认使用 `all-detected`；若未检测到任何已注册宿主，planner 会要求显式选择宿主或使用 `all-available`，而不是猜测。供人类复核的 plan 会保留模式，以及一份以解析后 adapter ID 为键的 `hostSelection.hosts` 映射；不会再用请求/解析数组重复 Host 身份。

每个 proposal 必须展示当前与目标层级、准确路径和内容、基线摘要、所需确认、验证步骤、支持状态与明确不执行的动作。ForgeRail 有意不提供 `apply-adoption` 命令。Agent 应先展示 proposal，等待人类判断。Node 集成必须把已批准的 `approvalSha256` 与可变 proposal 分开保存，并在应用时重新核验 canonical workspace 路径与已打开目录身份；即使摘要格式有效，apply 也只接受 `create`、`append-managed-block`、`replace-managed-block` 三种操作。同一路径下替换成另一个目录会使批准失效。若替换既有 binding 后的 post-install 校验失败，ForgeRail 会把保留的原 inode 直接原子重命名覆盖已核验的新候选；无法安全恢复时保留 recovery evidence，并回抛原始失败。随后只写入获批路径，在新任务中验证发现结果，并返回 Host Binding Receipt。

如果并发内容占用了已批准目标，导致无法安全自动回滚，ForgeRail 会把原 binding 保留为同目录的 `.forgerail-<随机值>.bak`，并在错误中给出项目相对路径。请先比较该文件与当前目标，再通过新的受审查操作恢复所需内容；只有确认恢复完成后才删除 recovery 文件。ForgeRail 不会把这类保留文件误报为成功写入。

### 只处理部分宿主，以及接收外部计划

只有选中的宿主进入严格写入规划。其他已注册绑定使用与诊断相同的有界、不跟随链接的读取方式：已读到的受管绑定计入当前层级，并明确提示会保留；无法读取的条目记为未知，不阻塞所选宿主。`currentLevel` 表达可读的工作区现状，`proposedLevel` 和写入范围只针对本次选择；`no-change` 不会移除未选中的绑定。只选部分宿主并不等于自动合并其他宿主的规则，批准新共享契约前应核对并存提示。

外部传入的计划必须先通过 `validateContract("adoption-plan", plan)` **整份校验**，然后才能批准或应用其中任何写入；单条写入摘要不能代替整份校验。运行时会拒绝大小写折叠后的重复目标、祖先/后代目标和与保留 `FORGERAIL.md` 冲突的宿主目标；仅用 JSON Schema 无法比较任意条目之间的路径。thin-reference 模板必须在自己的受管块中引用准确的共享 `FORGERAIL.md`；这是结构检查，不是 Agent 已遵循指令的证明。

## Level 2 — Persisted Governance

当前 alpha 暂不启用机器消费的 ForgeRail 持久状态。只有重要证据无法通过项目现有来源表达，例如反复出现跨宿主冲突或确有机器强制策略需求时，才应考虑这一层。

ForgeRail 目前不会创建 `.forgerail/`。未来设计必须先定义 ownership、precedence、migration、recovery 和 deletion 语义。

## 宿主支持

| 宿主 | 原生目标 | Alpha.4 状态 | 验证边界 |
| --- | --- | --- | --- |
| Codex | `AGENTS.md` | `supported` | 新 Codex 任务发现全部四个主 Skills，且已批准绑定处于作用域内 |
| Claude Code | `CLAUDE.md` | `profile-only` | 已建模目标与薄绑定，不声称端到端激活已验证 |
| Cursor | `.cursor/rules/forgerail.mdc` | `profile-only` | 已建模目标，不声称 Skill discovery 和端到端激活已验证 |

未知宿主必须先有受审查的 Host Adapter，ForgeRail 才能生成绑定。每个 adapter 都必须提供 thin-reference 投影，使 `all-detected` 与 `all-available` 始终能通过共享契约组合；adapter 还可以为单个显式 Host 额外提供 managed-block 投影。Registry 将目标、检测路径和模板路径限制在 ASCII 安全的跨平台路径字符集中，并拒绝尾随句点别名和 Windows 设备名称，再对剩余身份进行大小写折叠。所有绑定目标必须互不相同、互不构成祖先/后代关系，且不得与保留的 `FORGERAIL.md` 冲突。每个模板还必须只包含一对有序、归属于该 adapter 的 marker 边界。Host Adapter 只是宿主投影边界，不是 ForgeRail Core，也不是第二套策略真相。

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
