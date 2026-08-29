# Control Task 合同

ForgeRail 在同一个 package 内增加版本化 Control System 任务合同，同时保持 alpha Task Envelope 与 Return Receipt 不变。

| 合同 | Schema 版本 | 文件 |
| --- | --- | --- |
| Task Envelope | 2.0 | `contracts/task-envelope-v2.schema.json` |
| Operation Authority Requirement | 1.0 | `contracts/operation-authority-requirement-v1.schema.json` |
| Operation Grant | 1.0 | `contracts/operation-grant-v1.schema.json` |
| Task Control Revision | 1.0 | `contracts/task-control-revision-v1.schema.json` |
| Entry Mode | 1.0 | `contracts/entry-mode-v1.schema.json` |
| Phase/Slice Correlation | 1.0 | `contracts/phase-slice-correlation-v1.schema.json` |
| Gate Result | 1.0 | `contracts/gate-result-v1.schema.json` |
| Evidence Identity | 1.0 | `contracts/evidence-identity-v1.schema.json` |
| Return Receipt | 2.0 | `contracts/return-receipt-v2.schema.json` |
| Rollback Envelope Lineage | 1.0 | `contracts/rollback-envelope-lineage-v1.schema.json` |

这些合同只固定任务控制的身份与边界，不实现 evaluator：

- 每个 Envelope、revision、gate、evidence 与 Receipt 都绑定一个精确 Workspace Identity 和 subject；
- `new`、`resumed`、`imported` entry mode 保持显式，resumed/imported 必须携带来源证据；
- Core closure 只覆盖一个精确 owner phase/slice，不能声明 aggregate closure；
- Operation Grant 精确绑定 executor、operation、target/ref/environment、subject、scope、authority requirement、issuer evidence 与有效期；
- review 或 validation evidence 不能 mint Operation Grant；
- task-control revision 与 Receipt 是带 identity 的不可变 claim；subject 或 evidence 变化时必须产生 successor；
- Host receipt 在 receipt verification 满足且没有未解决 deviation 前不能 complete；
- rollback 必须使用新 Envelope revision、rollback-specific grant、validation 与 Receipt，禁止复用 forward grant。

冻结的 alpha `task-envelope-v1`、`return-receipt-v1` schema 与 runtime path 均不改变。Review Authority lifecycle、Validation Topology/result、Execution Context、Adapter observation 与 bounded limited reason 已定义在 [Control Authority 与 Validation 合同](control-authority-validation-contracts.zh-CN.md)中。Workspace Receipt Bundle 已由 [Cross-Workspace Pack Composition 合同](cross-workspace-pack-composition-contract.zh-CN.md)定义，其 pre-evaluator invalid boundary 已纳入 [Control System Fixture Matrix](control-system-fixture-matrix.zh-CN.md)。canonical serialization、digest 计算与 version negotiation 仍属于后续任务。

运行聚焦校验：

```bash
node scripts/forgerail.mjs validate
node scripts/forgerail.mjs validate-fixtures
node scripts/forgerail.mjs validate-contract --type task-envelope-v2 --file scripts/fixtures/contracts/task-envelope-v2.valid.json
node scripts/forgerail.mjs validate-contract --type operation-grant --file scripts/fixtures/contracts/operation-grant.valid.json
node scripts/forgerail.mjs validate-contract --type return-receipt-v2 --file scripts/fixtures/contracts/return-receipt-v2.valid.json
```
