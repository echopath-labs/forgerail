# 安装 ForgeRail

ForgeRail 首先是一个 Codex Agent Plugin。默认安装不会在目标项目中加入 Node.js、`package.json`、`node_modules` 或 `.forgerail/`。

当前公开预发布版本是 `0.1.0-alpha.4`。请固定不可变 Git tag，让其他用户能够复现同一个 Plugin 快照。

## 准备条件

- Codex 已提供 `codex plugin` 命令；
- 安装时能够通过 Git/网络访问 GitHub；
- 安装后新建一个 Codex 任务，让宿主从新的上下文发现 Plugin。

目标项目**不需要** Node.js。只有选择运行可选 npm CLI 时，才需要 Node.js 22 或更高版本。

## 安装 Codex Plugin

```bash
codex plugin marketplace add echopath-labs/forgerail --ref v0.1.0-alpha.4
codex plugin add forgerail@echopath-labs
```

然后在需要评估的项目中启动一个新的 Codex 任务。

## 验证安装

运行：

```bash
codex plugin list
```

确认 `forgerail@echopath-labs` 已启用。新任务应能发现四个带命名空间的 Skills：

- `$forgerail`；
- `$forgerail-workspace-diagnosis`；
- `$workspace-health-review`；
- `$architecture-convergence-audit`。

如果其他 Plugin 定义了同名短 Skill，请使用 Codex 显示的完整命名空间名称。

## 第一次使用：保持只读

把下面这段话发给 Codex：

```text
使用 $forgerail 对当前项目进行只读评估。优先沿用已有的 AGENTS.md、规格、
ADR、CI 和文档习惯。不要修改文件，也不要执行远端操作。建议使用 Plugin Only
还是 Lightweight Adoption，展示依据和不确定项，并在任何写入前等待我确认。
```

一个有用的首次结果应说明：工作区与任务边界、适用的项目规则、尚未解决的冲突、最小采用层级、验证依据、明确没有执行的动作，以及下一项需要人类判断的事情。仅安装 ForgeRail 绝不等于批准写入或远端操作。

## 可选 Capability Pack Plugins

Capability Pack 是独立 Plugin，拥有独立的认证、风险和生命周期边界。只安装项目真正需要的 Pack：

```bash
codex plugin add forgerail-github-rulesets@echopath-labs
codex plugin add forgerail-release-safety@echopath-labs
codex plugin add forgerail-thread-closure@echopath-labs
codex plugin add forgerail-cross-workspace-orchestration@echopath-labs
```

安装只会让 Pack 可用，不会自动认证、启用、调用或批准它，也不会授予仓库管理、发布、部署或生命周期权限。

## 可选 npm CLI

CLI 可用于确定性验证或只读诊断，但不是使用 Plugin 的前提：

```bash
npx --yes @echopath-labs/forgerail@0.1.0-alpha.4 validate
npx --yes @echopath-labs/forgerail@0.1.0-alpha.4 diagnose --workspace .
```

如果需要全局 CLI：

```bash
npm install --global @echopath-labs/forgerail@0.1.0-alpha.4
forgerail validate
```

官方包是 scoped package。未加 scope 的 `forgerail` 只是名称保留包，不是安装来源。

## 升级或重装

Marketplace 注册对应精确 tag 快照。升级时，应使用当前 `codex plugin` 命令先移除已安装 Plugin 和旧 Marketplace 注册，再注册新的精确 tag、重新安装 Plugin，并启动新任务。确认四个 Skills 可发现，并重新完成只读冒烟测试。

需要可复现性时，不要用可变分支替代精确 tag。升级不能修改项目文件或持久治理状态，除非用户另外批准了精确的采用计划。

## 卸载

使用 `codex plugin remove forgerail@echopath-labs`；如果不再使用该 Marketplace 中的其他 Plugin，再移除 `echopath-labs` Marketplace 注册。可选全局 CLI 可这样移除：

```bash
npm uninstall --global @echopath-labs/forgerail
```

卸载 ForgeRail 不应删除项目 instructions、规格、receipt、Git 历史或其他项目记录。已经批准的 Lightweight Adoption 内容只能通过另一次受审查的变更移除。

## 常见问题

### 看不到 Skills

1. 使用 `codex plugin list` 确认 Marketplace 和 Plugin 已列出并启用。
2. 确认 Marketplace 固定在 `v0.1.0-alpha.4`。
3. 新建 Codex 任务；已运行的任务可能不会刷新 Plugin discovery。
4. 如果有同名 Skill，使用带命名空间的完整名称。

### 项目提示需要 Node.js

Plugin Only 不应要求项目安装 Node.js。确认你调用的是已安装 Plugin，而不是在运行 `npx`、`npm install` 或仓库源码。如果正常 Plugin 使用创建了 `package.json`、`node_modules` 或 `.forgerail/`，请报告 bug。

### ForgeRail 建议了过多流程

要求它保持只读，并解释为什么 Plugin Only 不够。ForgeRail 应优先沿用项目已有治理方式，只建议最小有用层级。

### 某个命令要求凭据或远端权限

停止操作并核对准确的 Pack、身份、范围和审批边界。安装 ForgeRail 永远不代表批准登录、发布、仓库管理、部署或生命周期变更。

更多帮助见 [SUPPORT.md](../SUPPORT.md)。安全问题请按 [SECURITY.md](../SECURITY.md) 私下报告。

## 安装不等于采用

安装只是让 ForgeRail 可用；它不会编辑 `AGENTS.md`、安装 OpenSpec、创建 `.forgerail/`，也不会强制使用 Workspace Health。批准任何持久项目接入前，请先阅读[渐进式采用](adoption.zh-CN.md)。
