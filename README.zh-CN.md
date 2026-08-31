# ForgeRail

ForgeRail 是面向 Coding Agent 的工程引航与治理框架。

当前 canonical source 正在准备本地 `0.1.0-alpha.3` / `v0.1.0-alpha.3` forward-fix 候选。该候选尚未完成远端集成、发布或 Universal Plugins Directory 上线；当前可安装的公开版本仍是 alpha.2。

它观察工作区，在证据表明存在缺口时提出建议，组装适用规约，以明确的范围和审批边界发起宿主 Agent 工作，并核验可观察结果。它不替代 Agent，也不强迫项目采用新的规格系统。

## 首个 Alpha 形态

- `$forgerail`：任务级引航与围栏；
- `$forgerail-workspace-diagnosis`：优先沿用现有习惯的有界只读诊断；
- `$workspace-health-review`：可独立触发的工作区治理健康能力包。
- `$architecture-convergence-audit`：可独立触发、中风险、Analyze First 的只读能力 owner 与最小边界审计。

Architecture Convergence 是 alpha.1 之后的私有 source candidate。安装只令其
`available`，不会自动启用；它不要求先运行 ForgeRail Core，也不会创建 Profile、
task ledger、Receipt、`.forgerail/` 状态或外部 issue。

GitHub Rulesets、Release Safety 与 Thread Closure 由于具有独立身份、权限、风险与生命周期边界，作为单独分发、按需安装和显式触发的 Capability Packs。主插件被安装不代表这些能力包已安装、启用、认证或获批执行。

Cross-Workspace Orchestration 同样单独分发并显式使用。它只适用于主控任务协调多个真实独立 owner/repository/release 边界，且依赖关系允许安全并行的场景；它不是单仓通用的多 Agent 开关。

ForgeRail 默认动态计算有效 Workspace Profile，不会因为被调用就创建 `.forgerail/profile.yaml`、修改 `AGENTS.md` 或安装 OpenSpec。

Control System 迁移现已加入版本化 Workspace/Profile、Task Control、Review Authority、Validation Topology、Execution Context、Adapter Observation 与 Cross-Workspace Pack composition 合同，同时保留 alpha v1 合同。详情见 [Control Profile 合同](docs/control-profile-contracts.zh-CN.md)、[Control Task 合同](docs/control-task-contracts.zh-CN.md)、[Control Authority 与 Validation 合同](docs/control-authority-validation-contracts.zh-CN.md)、[Cross-Workspace Pack Composition 合同](docs/cross-workspace-pack-composition-contract.zh-CN.md)与 pre-evaluator [Control System Fixture Matrix](docs/control-system-fixture-matrix.zh-CN.md)。

工作区采用遵循渐进式三级模型：默认 Plugin Only；只有用户确认后才使用轻量绑定；未来只有机器配置或反复冲突等证据充分时，才考虑持久化 `.forgerail/` 治理。宿主 instruction 文件只是 Adapter，不是 ForgeRail Core。alpha.1 支持 Codex；Claude Code 与 Cursor profile 会明确发布，但仍标记为未验证。

可选官方 npm 包为 `@echopath-labs/forgerail`，安装后仍提供简短的 `forgerail` 命令入口，用于离线校验、只读诊断和合同闭环；Agent Plugin 本身不依赖该 CLI 才能使用。未作用域 `forgerail` 只保留名称占位，不是正式安装入口。

```bash
npm install --global @echopath-labs/forgerail@0.1.0-alpha.2
forgerail validate
```

## 安装预发布版

未来面向人的默认入口是 Universal Plugins Directory 界面，但 ForgeRail 当前尚未在该目录上线。在独立提交、审查与发布完成前，请安装已经发布的精确 ForgeRail Marketplace 快照：

```bash
codex plugin marketplace add echopath-labs/forgerail --ref v0.1.0-alpha.2
codex plugin add forgerail@echopath-labs
```

安装后请启动一个新的 Codex 任务。GitHub Rulesets、Release Safety 与 Thread Closure 必须按项目实际需要单独安装；精确命令、三级采用模型、Host Adapter 状态、升级、回滚和卸载边界见[安装与采用](docs/installation.zh-CN.md)及[渐进式采用](docs/adoption.zh-CN.md)。

Agent Plugin 不要求目标项目安装 Node.js 或存在 `package.json`；npm/npx 始终只是可选维护与验证工具。

不可变 public alpha.2 仍是当前安装来源。Alpha.3 是本地 source-first forward fix：主 Plugin 收敛为三条 starter prompts，同时四个 Skills 继续独立发现与调用。拟议版本/tag 不授权应用公开投影、远端集成、发布或 Directory submit/publish。
