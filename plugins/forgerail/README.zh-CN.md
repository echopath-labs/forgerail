# ForgeRail

ForgeRail 是面向 Coding Agent 的工程引航与治理框架。

它观察工作区，在证据表明存在缺口时提出建议，组装适用规约，以明确的范围和审批边界发起宿主 Agent 工作，并核验可观察结果。它不替代 Agent，也不强迫项目采用新的规格系统。

## 首个 Alpha 形态

- `$forgerail`：任务级引航与围栏；
- `$forgerail-workspace-diagnosis`：优先沿用现有习惯的有界只读诊断；
- `$workspace-health-review`：可独立触发的工作区治理健康能力包。

GitHub Rulesets、Release Safety 与 Thread Closure 由于具有独立身份、权限、风险与生命周期边界，作为单独分发、按需安装和显式触发的 Capability Packs。主插件被安装不代表这些能力包已安装、启用、认证或获批执行。

ForgeRail 默认动态计算有效 Workspace Profile，不会因为被调用就创建 `.forgerail/profile.yaml`、修改 `AGENTS.md` 或安装 OpenSpec。

可选 npm 安装会提供 `forgerail` 命令入口，用于离线校验、只读诊断和合同闭环；Agent Plugin 本身不依赖该 CLI 才能使用。
