# Cross-Workspace Pack Composition 合同

ForgeRail 为可选的 Cross-Workspace Orchestration Pack 定义一个版本化 `cross-workspace-pack-composition-v1` 合同。Pack 只组合多个独立的 Core-governed workspace；它不引入第二套状态模型、authority system、grant mechanism 或 receipt-verification path。

合同绑定以下 composition surface：

- `coreCompatibility` 声明支持的 Workspace Identity、Task Envelope、Return Receipt 与 Phase/Slice Correlation schema 版本，以及支撑兼容性声明的 Evidence Identity；
- `workspaceSet` 标识至少两个独立 owner workspace、可选 coordinator workspace、aggregate writer 与治理 relationship；
- 每个 node 保留一个 owner Workspace Identity、一个 writer identity、一个 `task-envelope-v2` 引用、一个 `phase-slice-correlation-v1` 引用，并且最多引用一个 `return-receipt-v2`；
- dependency edge 保持有向，只能由 Core 已验证且 coordinator 独立接受的 Receipt 解锁；
- phase aggregation 把每个 required node 精确归入 accepted、pending、failed、blocked 或 stale；只有全部 required node 都 accepted 时才能声明 aggregate closure；
- 不可变 Workspace Receipt Bundle 绑定 composition、Workspace Set、phase、已接受的 Core Receipt、dependency status、未解决 node、deviation 与 next eligible node。

## Kernel 边界

Pack 不能重定义 Core，也不能弱化 Kernel invariant。合同中的 invariant flag 全部固定为 `false`：禁止重定义状态模型、mint Operation Grant、authority substitution、扩大 waiver/freshness、绕过 receipt verification，或把 transport 当作 acceptance。

Receipt delivery、Core verification 与 coordinator acceptance 是相互独立的 claim。delivered Receipt 不必然 verified 或 accepted。在 Core Receipt 完成验证且 coordinator acceptance 携带 Evidence Identity 引用之前，node 不能成为 accepted、不能解锁 required successor，也不能进入 accepted bundle。

writer identity 必须显式记录。并发 node 不能共享 writer，除非 dependency edge 已经为它们建立顺序。dependency edge 永远不能在 workspace 之间转移 authority、Operation Grant 或 Receipt。

本合同只定义 schema、deterministic hand-validation、schema-native assertion 与 focused fixture。pre-evaluator authority-collapse 及其他 invalid boundary 已记录在 [Control System Fixture Matrix](control-system-fixture-matrix.zh-CN.md)；canonical serialization、digest 计算与 version negotiation 属于 task 2.10。本任务不实现 Pack runtime、evaluator、adapter expansion 或 alpha contract migration。

运行聚焦校验：

```bash
node scripts/forgerail.mjs validate
node scripts/forgerail.mjs validate-fixtures
node scripts/forgerail.mjs validate-contract --type cross-workspace-pack-composition --file scripts/fixtures/contracts/cross-workspace-pack-composition.valid.json
node scripts/forgerail.mjs validate-contract --type cross-workspace-pack-composition --file scripts/fixtures/contracts/cross-workspace-pack-composition.false-closure.invalid.json
```
