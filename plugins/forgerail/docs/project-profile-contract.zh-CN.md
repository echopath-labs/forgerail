# Project Profile 声明合同

Project Profile 声明是 ForgeRail 0.1.8 的可选能力，用于让项目拥有一份可被运行时发现的权威来源、结构化 claim 与安全资源定位描述。0.1.8 已经包含有界生命周期、inspect 路径与只读 provider 观测；已发布的 ForgeRail 0.1.7 package 不包含这些命令。

## 固定入口与归属

采用后的声明只有一个活动位置：

```text
.forgerail/project-profile.json
```

该文件属于工作区状态，不是 package installation artifact，也不属于 `.forgerail/installation.json`。package 初始化、更新与移除都不会创建、替换、登记或删除它。Profile set/remove 复用 ForgeRail 现有的有界 operation lock、journal、writer 与 recovery engine。

候选内容通过项目原有评审流程流转。运行时只发现固定入口；被替换的版本保留在 Git、PR 或规格历史中，ForgeRail 不扫描 archive 目录。

## 声明结构

`project-profile-declaration-v1.schema.json` 要求：

- `schemaVersion`、`profileId` 与 owner `workspaceIdentityId`；
- 明确引用的 `workspaceRelationshipIds`；
- 有界的 `sources`，包含稳定 identity、类型、项目相对 locator、requiredness 与可选 SHA-256；
- 显式 `claims`，指向具体 source 位置并声明适用 operation ID；
- 可选 `resourceBindings`，把 adapter 支持的 operation 和预期 identity claim 连接到一个经过评审的 provider adapter 与 locator。

每个 claim 和 binding 最多包含 64 个 operation ID。每个预期 identity claim 必须适用于 binding 声明的所有 operation；仅仅存在但不适用的 claim 不能作为该 binding 的证据。

声明不能设置 precedence、enforcement、completeness、authorization 或计算后的 Profile 结果。这些仍由 Governance Source、Rule Claim、Effective Profile v2、Profile Explanation 和现有任务授权合同负责。

`sourceKind` 只分类 source，不授予权威。项目自有声明不能仅通过把项目相对文件标成 `platform-policy`，就让它成为强制平台策略。

## 有界加载与组装

loader 接收精确的 owner 工作区和独立提供的 Workspace Identity。公开 inspect CLI 通过 `--workspace-identity` 接收该证据；其 canonical root locator 必须是绝对路径并解析到精确 owner，identity 也必须与声明一致。声明不能为自身制造这份证据。loader 只以 regular-file、no-follow、UTF-8 和四兆字节上限读取固定入口，绝不搜索父、子或兄弟工作区。入口不存在时返回 `not-adopted`，现有 alpha resolver 与任务行为保持不变。

每个声明 source 都通过同一项目相对边界读取。Markdown claim 必须匹配唯一一行精确 heading；结构化 claim 使用 RFC 6901 JSON Pointer，并且值必须与声明的 normalized value 相等。整文件 SHA-256 不匹配、缺少 digest、heading 缺失或重复、JSON Pointer 无效、路径穿越、符号链接、特殊文件或超限 source 都不能得到确认。required source 失败会使 v2 Profile 进入 unresolved；optional source、pointer 或值校验失败时只降级，并且不会激活其 claim。

loader 将确认后的输入投影到既有 Workspace Identity、Governance Source、Rule Claim、Effective Profile v2 与 Profile Explanation 合同。同一规则和 operation 上的同级 claim 如果值不一致，会形成显式 unresolved conflict。`profileRevisionId` 根据规范化声明内容、Workspace Identity 语义、已确认 source digest 与 resolver 版本确定性计算；时间戳、声明排列顺序、provider 观测和凭据值不参与计算。

## Locator 类型

| 类型 | 含义 | 边界 |
| --- | --- | --- |
| `workspace-file` | owner 工作区内的规范相对文件 | 不允许绝对路径、穿越、跟随符号链接、设备文件或无界读取 |
| `related-workspace-file` | 一个明确关联工作区内的规范相对文件 | 指定 Workspace Relationship、关联 Workspace Identity 与根环境变量；不搜索父目录或兄弟目录 |
| `environment-variable` | 经过评审的环境变量名称 | 声明只保存名称，不保存变量值 |
| `provider-native` | 由经过评审的 adapter 选择的 provider 账号存储或 session | coordinates 只能是 host、host alias、registry 等非敏感元数据 |

关联工作区移动时，只更新由环境变量提供的根绑定。根绑定缺失、过期或 identity 不匹配时结果为 unresolved；ForgeRail 不推断新的绝对路径。

## 凭据边界

声明、revision、合同、命令参数、日志、错误和 evidence digest 都不得包含 token、cookie、password、私钥或其他凭据值。命令与远程凭据下载说明不能充当 locator。

声明 loader 与 Profile resolver 不读取凭据字节。只有被当前只读预检明确选中的、经过评审的 provider adapter 可以短暂使用凭据。如果 provider client 必须使用临时文件，adapter 必须以 `0600` 模式创建该文件，不把值放入参数或输出，并在成功、错误和中断路径上完成清理。

认证证据与任务授权保持分离。GitHub、SSH 或 npm actor 匹配不会授予 push、merge、publish、release 或其他外部操作权限。

## 生命周期与检查

候选文件保存在固定入口之外的普通项目相对路径。预览与执行绑定相同候选字节、精确工作区身份、当前固定入口基线和计划摘要：

```bash
forgerail project-profile-set --workspace /path/to/project --candidate docs/governance/project-profile.json
forgerail project-profile-set --workspace /path/to/project --candidate docs/governance/project-profile.json --apply <planSha256>
forgerail project-profile-remove --workspace /path/to/project
forgerail project-profile-remove --workspace /path/to/project --apply <planSha256>
```

移除不会碰候选、Git、PR 或规格历史，也不会自动激活其他文件。中断写入复用 package adoption 的 `recover` 流程。

预览会返回 `profilePreflightBindingIds`。候选新增或修改任何 resource binding 时，apply 必须提供独立的 owner Workspace Identity 证据，以及一组或多组成对的 `--operation`/`--target`。ForgeRail 在既有 operation lock 内、创建 journal 或修改活动声明之前，只调用受影响的 adapter；每个变更 binding 都必须验证到预期 actor，否则 apply 失败并保留原活动声明。relationship 与关联 identity 继续使用和 inspect 相同的可重复选项。

```bash
forgerail project-profile-set --workspace /path/to/project \
  --candidate docs/governance/project-profile.json --apply <planSha256> \
  --workspace-identity /path/to/observed-owner-workspace-identity.json \
  --operation pull-request.create --target repository:owner/name#123
```

inspect 始终只读；不提供 `--operation` 时不会调用 provider。`--operation` 与 `--target` 必须成对提供。提供 operation 后只处理适用 binding，其他 binding 标记为 `not-applicable`，不会阻止本地 Profile 组装。顶层 operation 结果为 `ready`、`degraded`、`blocked` 或 `unresolved`，`profileStatus` 单独保留本地 Profile 组装结果；这些状态都不授予 operation 权限。

```bash
forgerail project-profile-inspect --workspace /path/to/project --workspace-identity /path/to/observed-owner-workspace-identity.json
forgerail project-profile-inspect --workspace /path/to/project --workspace-identity /path/to/observed-owner-workspace-identity.json --operation git.push --target repository:owner/name
forgerail project-profile-inspect --workspace /path/to/project \
  --workspace-identity /path/to/observed-owner-workspace-identity.json \
  --operation package.publish --target package:@scope/name \
  --workspace-relationship /path/to/workspace-relationship.json \
  --related-workspace-identity /path/to/related-workspace-identity.json
```

关联工作区证据选项可以重复。读取凭据文件前会验证每份 relationship 与 identity 文档；relationship 必须为 confirmed，必须指向声明的 owner/target identity，并由 Profile source 声明。证据缺失或无效时 binding 保持 unresolved，且不会调用 provider。

评审后的 registry 支持 GitHub CLI API identity、显式 host alias 的 Git SSH identity 与 npm identity。binding 的 operation 必须存在于所选 adapter 的 allow-list。API 和 SSH 观测彼此独立。npm 在 locator 需要凭据时使用进程级 `0600` 临时配置，将显式凭据与环境中的 npm 认证隔离；除配置、成功、错误和抛出异常的中断清理外，还注册进程信号清理。除非只读证据能够证明，否则精确目标权限保持 `unverified`；required binding 的权限未验证时结果为 `unresolved`，不能标记为 `ready`。provider 观测经过脱敏，绑定精确工作区与 Execution Context Identity，并始终设置 `authorizationClaim: false`。

## 合同验证

可以在不发现工作区、不访问 provider 的情况下验证声明：

```bash
node scripts/forgerail.mjs validate-contract \
  --type project-profile-declaration \
  --file path/to/project-profile.json
```

该验证检查 schema identity、有界字段、集合 identity、source 与 claim 引用、稳定 operation ID、locator 与 adapter 兼容性、疑似凭据内容和可执行内容。loader 与 assembler 位于 `scripts/lib/project-profile.mjs`；provider 观测位于 `scripts/lib/provider-adapters.mjs`。

激活预检也覆盖绑定引用的预期身份声明、声明来源及工作区归属变化。同次请求提供的每项适用观测均须匹配；一次成功不能掩盖同一绑定的失败。无关声明变化不触发重新核验。
