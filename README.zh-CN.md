# ForgeRail

ForgeRail 是面向 Coding Agent 的工程引航与治理框架。

它观察工作区，在证据表明存在缺口时提出建议，组装适用规约，以明确的范围和审批边界发起宿主 Agent 工作，并核验可观察结果。它不替代 Agent，也不强迫项目采用新的规格系统。

## 首个 Alpha 形态

- `$forgerail`：任务级引航与围栏；
- `$forgerail-workspace-diagnosis`：优先沿用现有习惯的有界只读诊断；
- `$workspace-health-review`：可独立触发的工作区治理健康能力包。

GitHub Rulesets、Release Safety 与 Thread Closure 由于具有独立身份、权限、风险与生命周期边界，作为单独分发、按需安装和显式触发的 Capability Packs。主插件被安装不代表这些能力包已安装、启用、认证或获批执行。

ForgeRail 默认动态计算有效 Workspace Profile，不会因为被调用就创建 `.forgerail/profile.yaml`、修改 `AGENTS.md` 或安装 OpenSpec。

工作区采用遵循渐进式三级模型：默认 Plugin Only；只有用户确认后才使用轻量绑定；未来只有机器配置或反复冲突等证据充分时，才考虑持久化 `.forgerail/` 治理。宿主 instruction 文件只是 Adapter，不是 ForgeRail Core。alpha.1 支持 Codex；Claude Code 与 Cursor profile 会明确发布，但仍标记为未验证。

可选 npm 安装会提供 `forgerail` 命令入口，用于离线校验、只读诊断和合同闭环；Agent Plugin 本身不依赖该 CLI 才能使用。

## 安装预发布版

在 `v0.1.0-alpha.1` 正式发布后，先注册精确版本的 ForgeRail Marketplace 快照，再安装主插件：

```bash
codex plugin marketplace add echopath-labs/forgerail --ref v0.1.0-alpha.1
codex plugin add forgerail@echopath-labs
```

安装后请启动一个新的 Codex 任务。GitHub Rulesets、Release Safety 与 Thread Closure 必须按项目实际需要单独安装；精确命令、三级采用模型、Host Adapter 状态、升级、回滚和卸载边界见[安装与采用](docs/installation.zh-CN.md)及[渐进式采用](docs/adoption.zh-CN.md)。

公开仓库 bootstrap 与 Node.js 22/24 合同 CI 已完成。`0.1.0-alpha.1` 在普通分支/PR CI 与独立发布审批完成前仍是签名候选；只有对应 tag 存在后，上述命令才成为受支持的安装路径。
