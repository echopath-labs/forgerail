# Control Authority 与 Validation 合同

ForgeRail 新增八个版本化 Control System 合同，不改变 alpha 合同、task-control 合同或任何 Host Adapter profile。

| 合同 | Schema 版本 | 文件 |
| --- | --- | --- |
| Review Authority Requirement | 1.0 | `contracts/review-authority-requirement-v1.schema.json` |
| Authority Evidence | 1.0 | `contracts/authority-evidence-v1.schema.json` |
| Validation Topology | 1.0 | `contracts/validation-topology-v1.schema.json` |
| Validation Result | 1.0 | `contracts/validation-result-v1.schema.json` |
| Execution Context Identity | 1.0 | `contracts/execution-context-identity-v1.schema.json` |
| Host Adapter Observation | 1.0 | `contracts/host-adapter-observation-v1.schema.json` |
| Provider Adapter Observation | 1.0 | `contracts/provider-adapter-observation-v1.schema.json` |
| Limited Reason | 1.0 | `contracts/limited-reason-v1.schema.json` |

这些合同建立以下首批边界：

- Review Authority 与 Operation Authority、Operation Grant 相互独立。Requirement 绑定 authority class、exact subject/scope、accepted evidence、quorum、actor exclusion、owner coverage、freshness、默认不可替代和有界 waiver policy。
- Authority Evidence 引用 Evidence Identity，并区分 `current`、`stale`、`revoked`、`dismissed`、`expired`、`superseded`；已经失效的 evidence 不能继续声明 current。
- Validation Topology 连接 changed surface、owner、consumer、selected requirement、governance dependency edge、accepted trust class、expected result、entrypoint 与 evidence locator。
- Validation Result 保留七种状态：`passed`、`failed`、`blocked`、`unavailable`、`not_applicable`、`not_selected`、`waived`。passed 必须有 evidence；waiver 必须绑定 current authority、exact requirement、subject、scope 与 expiry。
- Execution Context Identity 记录权威 entrypoint、invocation root、executor/runner、trust class、tool、provider 与 sanitized external dependency。入口消费外部依赖不代表该依赖成为治理来源。
- Host/Provider Adapter observation 按 capability 报告状态。安装、认证、激活或 mutation capability 均不能 mint authority；observation 的 `authorizationClaim` 固定为 `false`。
- Limited Reason 使用有界 code、长度受限且 sanitized 的摘要、evidence pointer 与 sanitized locator。新合同使用该结构，但不修改已经版本化的 Profile 或 Task 合同。

本任务只定义 schema 与 deterministic validation contract。Authority、Topology、Execution Context、Adapter evaluator 仍属于后续任务。版本兼容的 Pack composition schema 已定义在 [Cross-Workspace Pack Composition 合同](cross-workspace-pack-composition-contract.zh-CN.md)；pre-evaluator invalid boundary 已记录在 [Control System Fixture Matrix](control-system-fixture-matrix.zh-CN.md)。canonical serialization、digest 与 version negotiation 仍属于 task 2.10。

运行聚焦校验：

```bash
node scripts/forgerail.mjs validate
node scripts/forgerail.mjs validate-fixtures
node scripts/forgerail.mjs validate-contract --type review-authority-requirement --file scripts/fixtures/contracts/review-authority-requirement.valid.json
node scripts/forgerail.mjs validate-contract --type validation-result --file scripts/fixtures/contracts/validation-result.valid.json
node scripts/forgerail.mjs validate-contract --type provider-adapter-observation --file scripts/fixtures/contracts/provider-adapter-observation.valid.json
```
