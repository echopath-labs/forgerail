# 通过 npm 安装 ForgeRail

> 本文面向 0.1.5，实际发布状态以 npm 和版本化 GitHub Release 为准。

本文面向 `@echopath-labs/forgerail@0.1.5`，源码 tag 为 `v0.1.5`，正式发布通道为 npm `latest`。预发布 `next` 通道独立保留，请使用下方精确版本命令。本轮暂不进行 Codex 市场注册，原生 Plugin 激活不作为这条交付路线的门槛。

## 环境要求

运行CLI的机器需要 Node.js 22 或以上，已验证 Node.js 22 和24。目标项目不需要新增 `package.json`、`node_modules` 或 `.forgerail/`；工具可全局安装或装在独立工具目录。

目前没有内置Node运行时的独立二进制。npm提供的 `forgerail` 是需要Node的命令入口，不能宣称为免Node二进制。独立二进制作为后续可选分发方式，不阻塞本次npm发布。

## 安装并验证 0.1.5

先核对现有全局安装，例如 `npm list --global @echopath-labs/forgerail --depth=0`。若其他项目依赖不同版本，保留它，使用下方精确版本 `npm exec` 或独立工具目录。适合全局安装时，从 npm registry 安装精确版本：

```bash
npm install --global @echopath-labs/forgerail@0.1.5
forgerail validate
forgerail diagnose --workspace .
```

`validate` 检查安装包自身；`diagnose` 只读检查所选项目，不等于采用治理，也不会修改项目文件。无scope的 `forgerail` 包仅作名称保留，不是安装来源。

临时调用CLI可以使用：

```bash
npx --yes @echopath-labs/forgerail@0.1.5 diagnose --workspace .
```

## 把接入任务交给 Agent

在**目标项目**中打开你使用的 Coding Agent，把 [README 中的完整提示词](../README.zh-CN.md#五分钟快速开始)发给它。人给出目标和取舍，Agent 查阅文档、核对现状、完成获授权的操作并回传证据；用户不必先学会每个 CLI 参数。该提示词已授权当前项目的安全接入步骤，无须逐步重新询问。已有接入、同名 Skill 或受管内容漂移必须先核对来源与所有权。

Agent 应按实际宿主选择路径：Codex 有 0.1.5 的**项目接入闭环**，可执行下方计划与应用命令；其他 Agent 可使用 npm 包中 Skill 的**显式加载**，并遵守各自宿主规则。Claude Code 和 Cursor 的 Adapter 当前为 `profile-only`；不要把模板或包文件存在说成它们已经自动发现、自动触发。若目标宿主无法完成项目绑定，就回报已完成的安装和显式加载，以及尚缺的发现验证。

交付时请让 Agent 用简短结果回答：使用的确切版本与来源、选择的宿主路径、变更的文件、静态检查结果、宿主发现证据、具体任务行为证据，以及未验证项或真实阻碍。检查失败时报告当前状态和可恢复入口，不把部分完成写成成功。

### Codex 项目接入的具体命令

Codex 在项目接入时应依次执行（`<项目目录>`替换为目标项目的绝对路径）：

```bash
node --version
npm exec --yes --package=@echopath-labs/forgerail@0.1.5 -- forgerail init --workspace "<项目目录>"
# 阅读计划中的 operations、warnings、changes 数量和 planSha256；确认仅涉及预期的受管内容
npm exec --yes --package=@echopath-labs/forgerail@0.1.5 -- forgerail init --workspace "<项目目录>" --apply <planSha256>
npm exec --yes --package=@echopath-labs/forgerail@0.1.5 -- forgerail validate
npm exec --yes --package=@echopath-labs/forgerail@0.1.5 -- forgerail doctor --workspace "<项目目录>"
```

若已接入旧版本，按[项目接入与恢复](project-adoption.zh-CN.md)先核对既有安装身份，选择适用的 `update` 或旧快照迁移路径，不把 `init` 失败当成允许覆盖的理由。`init` 默认只产生计划；`--apply` 使用刚取得的计划摘要，摘要约束内容但不代替授权。成功接入后，项目内会有固定版本的 `.agents/skills/` 受管 Skill、`AGENTS.md` 受管块和 `.forgerail/` 安装记录；这不等于启用了持久化治理。CLI 可安装在工具环境，目标项目不必成为 Node 项目。

**触发测试分三层，不能互相代替：**

| 层级 | 可核验的结果 | 不能据此声称 |
| --- | --- | --- |
| 静态就绪 | `validate`、`doctor` 的输出，以及计划中的受管路径与实际文件 | Codex 已发现或遵循 Skill |
| 宿主发现 | 在新任务中确认该宿主实际看到的 Skill 路径、来源和可用状态 | 某次任务已经按 Skill 行事 |
| 实际行为 | 在一个具体、可回退的小工程任务中观察 Codex 读取项目规则、界定范围、执行适用检查并回传结果 | 所有后续任务都会自动遵循 |

若使用了 Codex 项目接入，新开**同一项目**的任务，直接发送下方不点名 ForgeRail 的提示词。事后核对宿主提供的 Skill 发现来源，以及任务中实际读取的项目指导路径；如果宿主没有提供可核查的发现信息，就把宿主发现标为“未验证”。其他宿主也可用真实工程任务核对行为，但显式加载只能证明该次任务使用了指导。选用项目已有的小型、可回退任务，例如修正文档中的一处确定错误；不要为了测试制造业务改动。

```text
请修正当前项目文档中一处你能核实的小错误。只修改这一处；不要提交、push、合并或发布。完成后告诉我改了什么、如何验证。若没有适合安全修正的错误，就说明原因并停止，不要凑改动。
```

这段测试提示词不点名 ForgeRail，以便观察项目绑定是否自然进入工程任务。请以实际读取的文件、操作和结果为证据；Agent 自称“已触发”不构成独立证明。若当前环境无法新开任务，交付提示词并把后两层写成“未验证”，不要把本会话显式阅读包内 Skill 的结果算作自动发现。

Core 在功能、缺陷、重构、依赖/配置、API、Git 交付、重要调查或交接等非简单工程任务中适用。闲聊、纯只读问答和简单命令结果不启动完整工程清单；明确请求工作区诊断或健康复盘时可调用相应独立 Skill。触发受宿主发现、项目绑定和更高优先级指令影响；ForgeRail 不会绕过宿主强制规则。

## 在 Agent 中加载包内指导

npm包包含四个Skill及其引用。npm安装不会自动向Codex或其他Agent注册Skill。**只有确认全局包确为 0.1.5 时**，才查询全局包目录：

```bash
npm root --global
```

在输出目录后追加 `@echopath-labs/forgerail`，得到实际安装目录。若全局版本不同，在目标项目外选择独立工具目录并安装精确版本：

```bash
npm install --prefix "<工具目录>" --no-save @echopath-labs/forgerail@0.1.5
```

此时使用 `<工具目录>/node_modules/@echopath-labs/forgerail` 作为包目录。`npm exec` 可运行精确版本 CLI，但不会把该版本变成全局 Skill 路径。无论采用哪条路线，读取前核对包内 `package.json` 的版本为 `0.1.5`。四个独立入口为：

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

## 发布验证

0.1.5 发布门禁在 Node.js 22 和 24 下验证实际安装包、CLI 校验、只读诊断及包内自检。发布收尾从公共渠道回下载并比对批准产物，最终结果见[本版发布说明](release-0.1.5.zh-CN.md)及 GitHub Release。alpha.5 历史回执保留在[原发布说明](release-alpha5.zh-CN.md)。

## 升级、回退和卸载

升级固定精确scoped版本；回退时重新安装此前验证过的精确版本，保留项目记录和用户改动。卸载工具：

```bash
npm uninstall --global @echopath-labs/forgerail
```

卸载npm包不删除用户项目的绑定或记录，已有采用写入需单独处理。历史Plugin安装说明保留在旧版本runbook；市场注册不属于本次npm安装流程。
