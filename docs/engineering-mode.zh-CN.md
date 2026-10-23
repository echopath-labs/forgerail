# Engineering Mode 与分支检查

本源码能力提供有界投入指导和本地分支观察，不会自动升级已安装的 ForgeRail 或修改消费者项目。命令需使用包含本能力的构建；发布与项目接入分别处理。[English](engineering-mode.md)。

## 选择投入

| 模式 | 默认投入 |
| --- | --- |
| `fast` | 相关 build/run、关键 smoke、直接回归检查和宿主简短影响判断 |
| `balanced`（默认） | fast 基础上，相关回归与影响检查、一次有范围 Review，可由宿主完成 |
| `strict` | 受影响高风险系统及关键依赖的检查，满足适用安全、发布和恢复要求 |

所有模式保留已有强制 bot review、CI、数据保护与操作授权。同一目标已有必需审查覆盖时不重复增加独立审查。按具体风险路径局部强化，不能仅因出现权限、删除或发布关键词就把整个任务升为 strict。需求、相关检查和门禁满足且无已知阻断后，停止追加检查并继续已授权交付。必需证据失败或缺失仍阻断对应动作。非必需未验证项、实现完成、部署就绪、已部署和业务验收分别如实报告。

用户可以明确选择本次任务投入，包括用 fast 覆盖 strict 默认；宿主记录指令及范围，不改项目配置。任务选择不能覆盖更高优先级限制、强制门禁或具体风险要求。CLI 不提供“任务覆盖授权”标记；输出字段不能证明用户意图。

## 复用既有 Profile

`engineering.mode` 是可选已知规则键，normalizedValue 严格为 `fast`、`balanced` 或 `strict`。另一个可选键 `git.branch.naming` 的值示例：

```json
{
  "prefixes": {
    "feature": ["feat/"],
    "fix": ["hotfix/", "fix/"],
    "maintenance": ["chore/"],
    "documentation": ["docs/"]
  }
}
```

值来自项目已选择的权威来源，由既有 claim 绑定摘要、定位与适用 operation。这只是值示例，不是完整声明；前缀是字面量，不执行正则或 shell。这两个键的机器确认要求结构化来源的 JSON Pointer；仅绑定 Markdown 标题时保持 unresolved，因为定位标题不能确认声明值。[Project Profile 合同](project-profile-contract.zh-CN.md)说明身份、完整声明、preview/apply 与 inspect。不新增 mode 文件、本地覆盖配置或任务账本，也不要求项目先采用 Profile。

无适用 mode claim 时默认 balanced，不写文件；无命名 claim 时保留可移植分支默认，并标明它不是强制项目规则。显式非法值报错；声明来源缺失、摘要失配或冲突仍保留 unresolved。用已有独立身份材料读取实际声明：

```sh
forgerail project-profile-inspect --workspace /path/to/project \
  --workspace-identity /path/to/observed-owner-workspace-identity.json \
  --operation git.branch.create --target repository:owner/name
```

请使用 claim 实际覆盖的 operation ID；示例为 `git.branch.create`。不提供 operation 时，不能把有范围的 claim 解释为已接受 mode。Profile inspect 中已有适用 provider binding 仍可能执行正常的只读身份观察。

inspect 的 `engineeringMode` 解释将配置状态与任务投入策略分开。任务指令和可追溯历史 strict 由宿主判断。若仅 mode 未确认、其他相关必需规则有效且无已知更强要求，可明示“mode 未确认，本任务暂按 balanced 投入”继续已授权实现；这不代表配置已解析，也不允许刷新摘要。来源漂移后仍保留适用的最后已确认 strict 强化；未经确认的新文本不自动获得权威。授权、分支、数据规则失效时，仅暂停依赖它们的动作，继续独立工作；既不能只看整体 Profile 状态，也不能忽略 claim 依赖。来源修复依既有生命周期对照已评审基线完成。

## 分支检查

`branch-check` 只读本地状态：宿主执行 Git 前检查候选，执行后读取实际结果。它不创建、切换、改名、删除分支，不访问远端，也不提供操作授权。

```sh
forgerail branch-check --workspace /path/to/project --phase before \
  --task-type feature --branch feat/example --intent create --checkout true \
  > /tmp/example-branch-before.json
# 宿主执行已授权的 Git 操作，再核对实际结果。
forgerail branch-check --workspace /path/to/project --phase after \
  --task-type feature --branch feat/example --intent create --checkout true \
  --before /tmp/example-branch-before.json
```

前态使用仓外、本任务专用的临时文件，保留原始输出。after 必须提供原前态及相同意图参数。task-type 为 `feature`、`fix`、`maintenance`、`documentation`；intent 为 `create` 或 `reuse`。只创建不切换用 `--checkout false`，核对 ref 而不要求 HEAD 改变。合适的历史分支可以复用；本次新建错误分支不能冒称历史复用。

采用了 Profile 时，必须提供 inspect 使用的独立 owner 身份及适用的 `--operation`/`--target`，以便检查对应动作依赖。此命令不调用 provider；适用的必需 provider 依赖保持未验证，宿主须先解决该依赖才能执行受影响动作。前态包含 refs/HEAD 和策略 revision，不证明归属或未推送。策略变化、owner/worktree 错位、观察失败或截断、前态缺失、并发疑点都不能证明成功。在首次相关操作及 owner、策略或意图变化时调用，不每轮重复。直接 Git 可绕过检查；检查只证明观察时点。

若实际建成 `codex/x` 而期望 `feat/x`，宿主只有在本任务纠正已获确认且[Git 生命周期](../skills/forgerail/references/git-lifecycle.md#check-actual-branch-results)全部条件满足时才可纠正：本任务新建、确认未推送、归属明确、无他人新增提交或其他任务依赖、无其他 worktree、目标明确且不存在，改名保持提交、工作区与暂存区。没有 upstream 不能证明未推送；未知就停止纠正，CLI 字段不能把未知变为安全。保留状态，仅暂停受影响动作并给出具体方案。允许纠正后重新核对并报告；失败不循环改名。

## 按影响检查并复用证据

确定性 CI/测试/契约检查与语义 Review 分别选择，依据实际行为影响。普通记录或排版不追加无关全量测试或代码 bot；API、迁移、发布说明需核对真实行为。AGENTS.md、SKILL.md、规则模板和可执行 Markdown 按行为变化检查。二进制文档 diff 不可读不证明低风险。既有强制检查与 bot 门禁始终保留。

被测代码或产物、相关依赖、配置、输入与环境仍适用时复用成功结果；相同 SHA 不一定足够，无关文档导致 SHA 改变也不自动废弃相关结果。修复后只复核受影响检查；不要求每条命令新增 JSON 回执或日志解析器。修改摘要绑定的 Profile 来源时运行 inspect，对照已评审基线，按已有授权走 preview/apply；不得机械刷新 hash。[影响审查](../skills/forgerail/references/impact-review.md)与[Core 模式指导](../skills/forgerail/references/engineering-mode.md)说明宿主判断和报告边界。

分支检查当前要求 HEAD 已有提交。新初始化仓库、尚未首次提交的 orphan 分支返回未验证；此类流程由宿主明确处理。这是核验能力限制，不是禁止 Git 操作。
