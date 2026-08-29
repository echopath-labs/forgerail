# Control System Fixture Matrix

ForgeRail 的 pre-evaluator fixture gate 为每个已注册 contract schema 至少提供一个 schema-valid 与一个 schema-invalid focused fixture。确定性的 `validate-fixture-matrix` 命令检查全部 35 个已注册 contract type，用既有 dependency-free contract validator 验证每个引用 fixture，并要求 task 2.9 的十类 invalid boundary 各出现且只出现一次。

必须覆盖的 invalid boundary 包括：

- 缺失 Workspace Identity；
- Profile Change Candidate 的 base digest 已 stale；
- Operation Grant digest forged；
- Operation Grant issuer 不具备资格；
- distinct-actor quorum 重复使用同一 actor；
- approval evidence 已 revoked；
- validation evidence 的 trust class 错误；
- governance dependency dangling；
- Return Receipt 绑定了已经变化的 subject；
- 跨 workspace 折叠 authority、Operation Grant 或 Receipt。

## Validation layer

`schema` case 至少包含一个结构无效的 contract，并由当前 hand-validator 拒绝。`cross-contract` case 刻意保持所有 component schema-valid，只声明未来 evaluator 必须比较的 observation。fixture checker 只验证覆盖率、引用、component schema validity、预期拒绝标签与显式 `evaluatorImplemented: false` 边界；它不做 transition、quorum、issuer、trust、freshness、subject 或 dependency 决策。

alpha Profile Change Candidate 尚无 base-digest 字段，canonical Grant digest 计算也尚未定义。因此 task 2.9 fixture 只在 metadata 中保留不一致的 comparison input，不修改既有合同，也不实现 task 2.10 serialization/digest 规则。未来的 Profile Change Candidate successor 与 evaluator 必须在各自独立 gate 获批后消费这些 fixture。

运行 focused 与 full check：

```bash
node scripts/forgerail.mjs validate-fixture-matrix
node scripts/forgerail.mjs validate-fixtures
npm test
```
