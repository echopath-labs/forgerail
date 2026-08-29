# Control Profile 合同

ForgeRail 在同一个 package 内增加首批版本化 Control System 合同，同时保持现有 alpha 合同不变。

| 合同 | Schema 版本 | 文件 |
| --- | --- | --- |
| Workspace Identity | 1.0 | `contracts/workspace-identity-v1.schema.json` |
| Workspace Relationship | 1.0 | `contracts/workspace-relationship-v1.schema.json` |
| Governance Source | 1.0 | `contracts/governance-source-v1.schema.json` |
| Source Dependency Edge | 1.0 | `contracts/source-dependency-edge-v1.schema.json` |
| Rule Claim | 1.0 | `contracts/rule-claim-v1.schema.json` |
| Effective Profile | 2.0 | `contracts/effective-profile-v2.schema.json` |
| Profile Explanation | 1.0 | `contracts/profile-explanation-v1.schema.json` |

`effective-profile-v2` 与冻结的 alpha `effective-profile-v1` 明确分开。新合同把 claims 和 dependency edges 绑定到一个精确 Workspace Identity，并显式区分 `complete`、`degraded` 与 `unresolved`，但不改变 alpha resolver 或用户入口。

首批合同固定以下不变量：

- 目录物理嵌套不转移 authority；
- 只有 confirmed 或 provider-declared relationship 才能让 scoped governance 生效；
- inferred claim 不能直接 enforce；
- unavailable、ambiguous 或 unverified source/dependency 必须携带 limited reason；
- required dependency 不可用、claim unresolved 或存在 conflict 时，Profile 不能声明 complete；
- Profile Explanation 只携带 identity、disposition、reason code、confirmation need 和 limited reason，不复制私有规则正文。

Task Envelope、Operation Grant、Control Revision、Evidence Identity、Return Receipt 与 rollback lineage 已定义在 [Control Task 合同](control-task-contracts.zh-CN.md)中。Review Authority lifecycle、Validation Topology、Execution Context 与 Adapter observation 已定义在 [Control Authority 与 Validation 合同](control-authority-validation-contracts.zh-CN.md)中。Pack bundle 仍属于后续工作。

运行聚焦校验：

```bash
node scripts/forgerail.mjs validate
node scripts/forgerail.mjs validate-fixtures
node scripts/forgerail.mjs validate-contract --type workspace-identity --file scripts/fixtures/contracts/workspace-identity.valid.json
node scripts/forgerail.mjs validate-contract --type effective-profile-v2 --file scripts/fixtures/contracts/effective-profile-v2.valid.json
```
