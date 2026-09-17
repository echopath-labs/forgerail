<p align="center">
  <img src="assets/forgerail-logo.svg" alt="ForgeRail" width="520">
</p>

<h1 align="center">ForgeRail</h1>

<p align="center"><strong>面向 Coding Agent 的工程引航与治理框架：不替代 Agent，也不替代项目已有工作方式。</strong></p>

<p align="center">
  <a href="README.md">English</a> ·
  <a href="docs/installation.zh-CN.md">安装</a> ·
  <a href="docs/adoption.zh-CN.md">采用</a> ·
  <a href="https://github.com/echopath-labs/forgerail/issues">Issues</a> ·
  <a href="CHANGELOG.md">变更记录</a>
</p>

> **版本：** `0.1.3` 可靠性补丁候选，面向 npm 安装与包内 Skill 显式加载；实际发布状态以版本化 GitHub Release 和 npm registry 为准。使用下方精确版本安装；原生 Plugin 激活和实验性集成不属于正式支持范围。

> **0.1.3 范围：** 通用 AGW/WHR 指引已自包含，主要行为已通过显式源码加载验证。本版采用 npm 安装和 Agent 显式加载，暂不进行原生 Plugin 激活认证或 Codex 市场注册。见[发布说明](docs/release-0.1.3.zh-CN.md)和[项目替代要求](docs/agw-replacement.zh-CN.md)。

## 为什么需要 ForgeRail？

Coding Agent 很擅长执行任务，真正困难的是让执行始终忠于真实项目：

- 这个变更究竟属于哪个仓库、哪个任务？
- 项目已有的 instructions、规格、决策和 CI 规则有哪些？
- Agent 可以读取或修改什么，哪些事情仍需人类决定？
- 哪些证据足以证明结果，下一个 Agent 应该从哪里恢复？

ForgeRail 帮助 Agent 在扩大范围前回答这些问题。它观察工作区，优先沿用项目已有习惯，只在有证据时建议最小治理层级，并核验可观察结果。**Agent 负责做事，ForgeRail 负责引航，人类负责判断。**

ForgeRail 不是自动执行器，不替代 OpenSpec 或 `AGENTS.md`，不提供安全保证，也不会要求简单项目为了治理而增加不必要流程。

## 五分钟快速开始

### 1. 通过 npm 安装 0.1.3

运行环境需要 Node.js 22 或以上，安装时固定精确版本：

```bash
npm install --global @echopath-labs/forgerail@0.1.3
forgerail validate
forgerail diagnose --workspace .
```

目标项目不需要新增 `package.json`、`node_modules` 或 `.forgerail/`。本轮暂不注册Codex市场；目前没有免Node运行时的独立二进制。

### 2. 按需加载工程指导

安装包带有四个Skill。用 `npm root --global` 查询位置，向已有Agent提供 `@echopath-labs/forgerail/skills/forgerail/SKILL.md` 的实际绝对路径，要求按项目已有规则做只读评估。注明从npm安装包 `explicit_source` 加载；npm不会自动注册原生Plugin。详见[安装与Agent加载说明](docs/installation.zh-CN.md)。

### 3. 判断结果

ForgeRail 应该返回：

- 它能够验证的工作区与任务边界；
- 当前适用的治理来源和仍未解决的冲突；
- 最小的建议采用层级；
- 验证依据以及明确没有执行的动作；
- 最多一个当前需要人类确认的下一项决定。

如果它直接写入文件、创建 `.forgerail/`、执行远端动作，或把“已经安装”误当成“已经批准”，请提交 bug。

## 包含哪些能力？

| Skill | 适用场景 | 默认效果 |
| --- | --- | --- |
| `$forgerail` | 启动或治理一个非简单工程任务 | 给出任务、范围、审批和验证边界 |
| `$forgerail-workspace-diagnosis` | 需要快速理解当前工作区 | 优先沿用已有习惯的有界只读诊断 |
| `$workspace-health-review` | 复核恢复、所有权和治理债务 | 独立的只读工作区健康复核 |
| `$architecture-convergence-audit` | 评估职责重复、工程范式或限定范围的架构漂移 | 独立的只读 owner 与最小边界审计 |

**自 0.1.0 起已包含：**现有架构审计新增可选[工程范式指导](skills/architecture-convergence-audit/references/engineering-paradigm.md)，用于规划、重构评估和限定范围的架构漂移复盘。以项目已确认的选择为依据，不强制语言或目录结构，保持只读。

如果其他已安装 Plugin 定义了同名短 Skill，请使用 Codex 显示的完整 namespaced Skill 名称。

### 可选 Capability Pack Plugins

以下能力具有不同的认证、风险和生命周期边界，因此独立分发：

- `forgerail-github-rulesets`
- `forgerail-release-safety`
- `forgerail-thread-closure`
- `forgerail-cross-workspace-orchestration`

安装 ForgeRail 主 Plugin 不会自动安装、启用、认证、调用或批准它们。详情见[外部 Capability Packs](docs/external-capability-packs.md)。

## 渐进式采用

ForgeRail 将“能力可用”和“项目采用”分开：

| 层级 | 会修改项目什么？ | 适用场景 |
| --- | --- | --- |
| Plugin Only | 什么都不修改 | 默认方式；偶尔使用引导或诊断 |
| Lightweight Adoption | 一个经过评审的 managed instruction block，或 `FORGERAIL.md` 绑定 | 反复使用且长期指导确有价值 |
| Persisted Governance | 0.1.3 不包含 | 只有机器配置具有明确 owner、迁移和删除规则后才考虑 |

ForgeRail 不会自行应用 Lightweight Adoption。Agent 必须展示精确路径与内容、取得确认、保护无关内容、在新任务中验证结果并返回 Receipt。详情见[渐进式采用](docs/adoption.zh-CN.md)。

## 工作方式

ForgeRail 组合四层能力，但不会要求每个项目都持久化这些层：

1. **Core governance**：可移植的范围、权限、证据、验证和收口规则；
2. **Capability Packs**：只有相关时才选择的独立领域能力；
3. **Effective Workspace Profile**：默认从项目已有来源动态计算；
4. **Temporary Task Envelope**：当前任务的边界、允许范围、审批、检查和回传契约。

宿主 instructions 文件只是 Adapter，不是 ForgeRail Core。OpenSpec、ADR、项目文档、CI 和代码继续拥有各自事实。深入说明见 [Control Profile 合同](docs/control-profile-contracts.zh-CN.md)、[Task 合同](docs/control-task-contracts.zh-CN.md)和[权限与验证合同](docs/control-authority-validation-contracts.zh-CN.md)。

## 可选 CLI

npm 包为维护者和 CI 提供确定性校验与诊断，**不是** Agent Plugin 或目标项目的必需条件。

```bash
npx --yes @echopath-labs/forgerail@0.1.3 validate
npx --yes @echopath-labs/forgerail@0.1.3 diagnose --workspace .
```

正式包是带组织 scope 的 `@echopath-labs/forgerail`。不带 scope 的 `forgerail` 只是名称占位，不是安装来源。

## 文档

- [安装、验证、升级与排错](docs/installation.zh-CN.md)
- [渐进式项目采用](docs/adoption.zh-CN.md)
- [Capability Pack 边界](docs/external-capability-packs.md)
- [Pack 开发](docs/pack-authoring.md)
- [从 Agent Workflow Governance 迁移](docs/migration-from-agw.md)
- [架构验收](docs/architecture-acceptance.md)
- [0.1.3 发布说明](docs/release-0.1.3.zh-CN.md)

详见[产品边界与当前能力状态](docs/product-boundary.zh-CN.md)。[Cursor 执行器实验](docs/cursor-local-executor-canary.zh-CN.md)已从下一份源码候选退出；Cursor 指令绑定保持 `profile-only`。

## 项目状态

ForgeRail 0.1.3 通过 npm 分发包内 Skill，由 Agent 显式加载。从 Plugin Only 开始，持久项目绑定另行评审：

- Codex 可显式加载包内指导；原生 Plugin 激活尚未验证。Claude Code 和 Cursor adapter 仍为 `profile-only`；
- 持久化 `.forgerail/` 治理仍延期；
- 外部 Capability Packs 继续独立安装、显式调用；
- 当前采用 npm 安装，Codex 市场注册与 Universal Plugins Directory 上架暂缓；
- 缺陷通过新版本 forward fix，不改写已发布 tag 或 package。

参见 [0.1.3 正式版](https://github.com/echopath-labs/forgerail/releases/tag/v0.1.3)和[变更记录](CHANGELOG.md)。

## 贡献与支持

提交 PR 前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。可复现 bug、产品建议和文档问题使用仓库 Issue 表单；使用问题和排错从 [SUPPORT.md](SUPPORT.md) 开始。

安全漏洞请按 [SECURITY.md](SECURITY.md) 私下报告。不要在 Issue 中提交凭据、私有项目记忆、生产配置、客户数据或未脱敏 Receipt。

社区参与遵守 [Code of Conduct](CODE_OF_CONDUCT.md)。

## 许可证

ForgeRail 使用 [Apache License 2.0](LICENSE)，署名信息见 [NOTICE](NOTICE)。
