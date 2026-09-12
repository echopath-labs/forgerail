# 通过 npm 安装 ForgeRail

当前使用已于 2026-09-12 发布的 `@echopath-labs/forgerail@0.1.0-alpha.5`，源码 tag 为 `v0.1.0-alpha.5`。npm `next` 指向 alpha.5，`latest` 保持 alpha.4，请使用下方精确版本命令。本轮暂不进行 Codex 市场注册，原生 Plugin 激活不作为这条交付路线的门槛。

## 环境要求

运行CLI的机器需要 Node.js 22 或以上，已验证 Node.js 22 和24。目标项目不需要新增 `package.json`、`node_modules` 或 `.forgerail/`；工具可全局安装或装在独立工具目录。

目前没有内置Node运行时的独立二进制。npm提供的 `forgerail` 是需要Node的命令入口，不能宣称为免Node二进制。独立二进制作为后续可选分发方式，不阻塞本次npm发布。

## 安装并验证 alpha.5

从 npm registry 安装已发布的精确版本：

```bash
npm install --global @echopath-labs/forgerail@0.1.0-alpha.5
forgerail validate
forgerail diagnose --workspace .
```

`validate` 检查安装包自身；`diagnose` 只读检查所选项目，不等于采用治理，也不会修改项目文件。无scope的 `forgerail` 包仅作名称保留，不是安装来源。

临时调用CLI可以使用：

```bash
npx --yes @echopath-labs/forgerail@0.1.0-alpha.5 diagnose --workspace .
```

## 在 Agent 中加载包内指导

npm包包含四个Skill及其引用。npm安装不会自动向Codex或其他Agent注册Skill。先查询全局包目录：

```bash
npm root --global
```

在输出目录后追加 `@echopath-labs/forgerail`，得到实际安装目录。四个独立入口为：

| Skill名称 | 安装包内路径 |
| --- | --- |
| `$forgerail` | `skills/forgerail/SKILL.md` |
| `$forgerail-workspace-diagnosis` | `skills/forgerail-workspace-diagnosis/SKILL.md` |
| `$workspace-health-review` | `skills/workspace-health-review/SKILL.md` |
| `$architecture-convergence-audit` | `skills/architecture-convergence-audit/SKILL.md` |

在已有Agent中新开任务，提供对应Skill的实际绝对路径。Core的示例提示词：

```text
读取 <实际安装目录>/skills/forgerail/SKILL.md，只按需读取引用，对当前项目
做一次只读评估。遵循项目已有AGENTS.md与记录方式，说明owner、范围、验证
建议和下一步。不要改文件、安装工具或执行远端动作。加载方式注明为从npm
安装包 explicit_source 加载，不声称原生Plugin自动发现。
```

替换占位路径后再发送。单独输入 `$forgerail` 不代表已经注册；CLI诊断也不等于Agent已经执行工程指导。CLI使用无需Codex新任务或登录。可以选择新的Codex任务（new Codex task）加载源码，也可以使用其他已有Agent。

项目绑定和自动恢复需要另行满足采用要求；如果某个绑定要求原生Plugin，应先满足依赖，不能把npm安装当成该Plugin已激活。见[采用说明](adoption.zh-CN.md)。

## 已发布包验证

发布后匿名下载公共 npm 包，SHA-256 与批准产物一致；258 个安装文件逐一匹配。已安装 CLI 在 Node.js 22 和 24 下均通过校验与只读诊断。独立工具目录完成了一次安装和卸载，未按每个 Node.js 版本分别重复。见 [alpha.5 发布证据](release-alpha5.zh-CN.md)。

## 升级、回退和卸载

升级固定精确scoped版本；回退时重新安装此前验证过的精确版本，保留项目记录和用户改动。卸载工具：

```bash
npm uninstall --global @echopath-labs/forgerail
```

卸载npm包不删除用户项目的绑定或记录，已有采用写入需单独处理。历史Plugin安装说明保留在旧版本runbook；市场注册不属于本次npm安装流程。
