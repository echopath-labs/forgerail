# ForgeRail 可组合自治架构记录

状态：Active product-local architecture record

日期：2026-08-20

Owner workspace：ForgeRail canonical private source workspace

Canonical product source：`plugins/forgerail/`

Canonical architecture change：`openspec/changes/evolve-forgerail-engineering-governance-control-system/`

跨产品基线：`docs/architecture/echopath-labs-composable-product-system.md`（根聚合架构；由根索引维护）

## 1. 目的与适用范围

本文只记录 ForgeRail 在 EchoPath Labs 可组合自治体系中的产品边界、独立最小闭环、可选输入输出、降级行为和互操作约束。它不复制根聚合架构，也不替代 ForgeRail Control System 的 OpenSpec requirements、versioned schemas 或验证证据。

本文不授权 task 2.10、evaluator/runtime 实现、公开投影、remote、merge、release、publication、migration 或 lifecycle 变更。

## 2. 产品结论

ForgeRail 是 local-first、宿主无关的 Engineering Governance Model and Control System。它回答：

> 对一个 exact workspace、subject、operation 与 revision，当前工程治理条件是否足以接受这次状态转换？

ForgeRail 的独立最小闭环是：

```text
discover bounded workspace governance sources
  -> inspect provenance and dependencies
  -> resolve and explain Effective Profile
  -> evaluate Task Envelope, grants, authority and validation gates
  -> verify observable evidence and Return Receipt
```

该闭环只依赖项目已有的可读治理来源和本地控制合同。Markdown、Git、项目命令或其他受支持来源即可构成 standalone 输入；EchoPath、OpenDomain、OpenSpec、RelayPact、KeptNear、特定 Git provider、daemon 或 cloud 都不是 Core 前提。

## 3. Control Plane 的职责与非职责

ForgeRail 拥有：

- exact Workspace Identity、bounded source discovery 与 source/dependency provenance；
- Effective Profile、规则优先级、冲突与 degraded/unresolved explanation；
- Task Envelope、operation-authority requirement 与 Operation Grant validation；
- Review Authority requirement/evidence evaluation，包含 quorum、actor constraint、owner coverage、freshness、revocation 与有界非传递 equivalence；
- Validation Topology、Execution Context Identity、Gate Result 与 Evidence Identity；
- immutable Task Control Revision 与 Return Receipt verification；
- 单 owner、单 phase/slice closure，以及可选 Capability Pack/Host Adapter/Provider Adapter 合同。

ForgeRail 不拥有：

- Agent 的实现计划、工具选择、hidden reasoning 或 execution runtime；
- RelayPact 的 Host-to-Executor delegation authority、execution lifecycle、review packet 或 terminal decision；
- OpenDomain 的 durable semantics、Candidate Promotion 或 semantic Authority；
- EchoPath 的长期 causal history、Memory Candidate、Project Memory 或 Cognitive Closure；
- KeptNear 的 credential secret、capability lifecycle 或组织身份 source；
- Git/CI/CODEOWNERS/OpenSpec/ADR/runbook 等项目来源的正文与权威所有权；
- 自动 approve、writeback、merge、push、publish、deploy、rollback 或 release。

ForgeRail 控制“是否满足治理接受条件”，不接管“如何实现、如何委派、如何保存历史”。

## 4. Source ownership

| 对象或事实 | 权威 owner | ForgeRail 的处理 |
| --- | --- | --- |
| 项目 rules、CODEOWNERS、CI、scripts、OpenSpec/ADR/runbook | 原项目 source | 有界发现、保留 provenance、解析 applicable claims；不复制为第二 source of truth |
| Workspace Identity、Effective Profile、Gate Result、Control Revision | ForgeRail | 直接拥有并按 exact workspace/subject/revision 绑定 |
| Operation Grant requirement 与 engineering Review Authority requirement | ForgeRail/project governance contract | 验证 requirement 与 current evidence；不从调用者文字或安装状态 mint authority |
| Delegation Envelope、Executor Result、Host terminal decision | RelayPact | 仅通过 versioned reference/adapter 映射消费；不复制其状态机 |
| accepted semantics、domain invariant、semantic Candidate/Promotion | OpenDomain | 仅作为带 source locator 的可选 semantic claim/evidence 输入 |
| cognition、Recovery Entry、causal interpretation、Project Memory | EchoPath | 仅交换最小 evidence/receipt reference；ForgeRail receipt 不自动成为记忆 |
| credential capability、expiry/revocation 与 secret | KeptNear | 只接受 sanitized capability attestation/reference；不保存 secret，也不把 capability 当 operation approval |

任何外部对象进入 ForgeRail 后仍由源产品拥有。ForgeRail 可以形成自己的 evaluation、Evidence Identity 或 Receipt，但不得用重新签发的 ForgeRail 对象冒充外部对象本身。

## 5. Operation Grant 与 Review Authority

Operation Grant 与 Review Authority 是两条相互独立的控制边界：

- Operation Grant 回答：哪个 executor 可以在什么有效期内，对哪个 exact target/ref/environment、subject、scope 执行哪一种 side effect。
- Review Authority 回答：哪一类 review/approval requirement 需要哪些 eligible actors、quorum、owner coverage、freshness 与 evidence lifecycle。

以下事实都不能互相替代：

- review evidence、CODEOWNER approval、CI pass、Pack enablement 或 Plugin installation 不能 mint Operation Grant；
- Operation Grant 不能满足独立的 peer、ownership、security、release 或 environment review requirement；
- RelayPact Host acceptance、OpenDomain semantic approval、EchoPath human confirmation、KeptNear capability available 不能自动满足 ForgeRail engineering authority；
- authority 不跨 operation、target、subject、workspace、revision 或 authority class 传递。

Grant 或 authority evidence 过期、撤销、dismiss、stale 或 superseded 时，ForgeRail 产生 successor Control Revision；历史 revision/receipt 保留原 observation-time identity，不原地改写。

## 6. 可选输入与输出

### 6.1 输入

| Provider | 可选输入 | 边界 |
| --- | --- | --- |
| 项目本地来源 | AGENTS、rules、CODEOWNERS、Git、CI、scripts、docs、OpenSpec/其他 spec system、ADR、existing profile | Existing Habits First；只有 applicable、provenance-bound claim 参与解析 |
| OpenDomain | versioned domain concepts、invariants、relationships、owner semantics | 不把 semantic authority 解释为 engineering approval |
| OpenSpec | current change intent、requirements、tasks、acceptance evidence | 非必需；未经独立授权不修改 OpenSpec |
| EchoPath | approved owner、goal、recovery、Profile Governance Record、context selection | 非必需；不可访问时不是空历史；不复制规则正文 |
| RelayPact | delegation/result/decision 的 source-owned reference，或 Host 提供的 adapter mapping | 仅供关联 exact execution evidence；当前是 reference-only interop，不建立 ForgeRail Core 依赖 |
| KeptNear | sanitized credential capability reference/attestation | 仅说明能力可用性；当前是 reference-only interop，不包含 secret locator/value，不授权 operation |

### 6.2 输出

ForgeRail 可向 Host 或 adapter 输出：

- Effective Profile explanation；
- Gate Result、Validation Result 与 bounded limited reason；
- immutable Task Control Revision reference；
- verified或未完成的 Return Receipt 与 Evidence Identity references；
- optional Control Decision projection，由 consumer 引用 source identity/digest/locator，不复制 Kernel state。

ForgeRail 不输出 Executor implementation instructions、RelayPact Host acceptance、OpenDomain accepted truth、EchoPath durable memory 或 KeptNear secret。

## 7. Standalone 与降级语义

ForgeRail standalone 是正式产品模式，不是缺少生态产品后的残缺 fallback。每个可选 integration 必须使用适用的显式状态：

| 状态 | 含义 | ForgeRail 行为 |
| --- | --- | --- |
| `provided` | 兼容、可验证、当前可用 | 在声明 scope 内使用，并保留 provenance |
| `not_required` | 当前 transition 不需要该 integration | 不加载、不制造缺失风险 |
| `unavailable` | 已知 provider/source 存在但当前不可访问 | 保留 unavailable 与 limited reason；绝不映射为空来源或 pass |
| `unsupported` | provider/schema/version 不受支持 | fail closed 于依赖该语义的 gate；不猜测映射 |
| `degraded` | 部分可用或 provenance/能力不完整 | 只允许不依赖缺失能力的 transition；required edge 保持 blocked/unresolved |

典型降级：

- OpenDomain/EchoPath/RelayPact/KeptNear 不存在且任务未声明需要它们：`not_required`，standalone 闭环继续。
- 可选 provider 不可访问：标记 `unavailable`，而不是“无规则、无历史、无 evidence”。
- semantic claim、delegation proof 或 credential capability 被声明为 required 但不可验证：相关 gate 为 blocked/unavailable；其他无关 gate 不受影响。
- Host Adapter 只能执行只读观察：报告 capability degraded；不能把 UI、安装或 caller flag 当当前授权。

## 8. Reference-only interop

ForgeRail 当前 canonical ecosystem contract 已定义 OpenDomain、OpenSpec 与 EchoPath 的 optional、versioned、additive interop。RelayPact 与 KeptNear 的关系来自跨产品架构 baseline，在 ForgeRail task 2.10 前只作为 reference-only adapter boundary：

- 不把 RelayPact 或 KeptNear schema 引入 ForgeRail Core；
- 不创建共享 runtime package 或共享数据库；
- 不让 ForgeRail、RelayPact、EchoPath 或 KeptNear 共同拥有一个状态机、grant 或 receipt；
- consumer 使用 source product、schema/version、object identity、digest 与 locator 引用源对象；
- unsupported version 或缺失 required proof 必须 fail closed，optional missing 必须显式降级。

## 9. Task 2.10 前置 delta 结论

task 2.10 固定 ForgeRail 自有对象的 canonical serialization、stable ordering、digest、sanitized exposure、idempotency、unknown-field 与 version negotiation。开始前必须遵守以下已完成的边界评审：

### 9.1 Task Envelope 与 Delegation Envelope

- ForgeRail Task Envelope 拥有 engineering intent、exact workspace/profile/subject、planned operations、prohibited operations、required gates、entry mode 与 phase/slice correlation。
- RelayPact Delegation Envelope 拥有 Host 授予 exact Executor 的 read/write/forbidden scope、execution context/capsule、execution lifecycle 与 return/acceptance contract。
- ForgeRail Envelope 或 Gate Result 可被 RelayPact 引用，但不能 mint delegation authority；RelayPact Envelope 也不能替代 ForgeRail Operation Grant 或 Review Authority。
- 两者保持独立 identity、revision、digest 与 lifecycle；adapter 只能映射或引用，不能把字段同名解释为同一语义。

### 9.2 Evidence Identity、Return Receipt 与执行/决策 evidence

- ForgeRail Evidence Identity 绑定 control evaluation 所观察 evidence 的 workspace、scope、task/subject、Envelope/Control revision、source locator、digest、availability 与 observation time。
- ForgeRail Return Receipt 绑定单 owner phase/slice 的治理 claim、实际使用的 grants、changed scope、validation evidence、side effects、non-mutations、risks、deviations 与 verification gate。
- RelayPact Executor Result、validation/review packet 与 Host terminal decision 仍是 RelayPact source-owned execution evidence/receipt。ForgeRail 只能把它们作为 `external-receipt` 或 provider evidence reference，不重新签发 Host acceptance。
- EchoPath 只能保存这些 source-owned objects 的 digest-bound projection/reference，并将语义解释保持为 candidate；历史 proof 不成为 current grant。

### 9.3 Control Revision 与 EchoPath projection

- Task Control Revision 是 ForgeRail source-owned、immutable、single-owner control read model；subject、Profile、grant 或 evidence 变化产生 successor revision。
- EchoPath projection 至少保留 source product、schema/version、object kind、identity、digest、locator、subject/scope、observation time、availability/limited reason 和 predecessor/successor reference（适用时）。
- EchoPath 不复制或重新计算 ForgeRail state machine，不把 projection 当 current control truth；declared reason 与 inferred causal candidate 必须分开。
- RelayPact 可以引用一个 ForgeRail decision/revision/receipt，但其 execution lifecycle 与 terminal decision 不由该 revision 驱动或替代。

详细 delta 表与 task 2.10 entry gate 位于：

`openspec/changes/evolve-forgerail-engineering-governance-control-system/inventory/composable-autonomy-delta-review-20260820.md`

## 10. 当前状态与下一入口

- task 2.5–2.9：schemas、composition contract 与 pre-evaluator fixtures 已完成并有 focused evidence。
- task 2.10：`not_started`；本文和 delta review 完成架构前置，但不构成启动授权。
- task 2.11：`not_started`；必须另行证明 contracts 保持 local-first、event-driven 且无外部产品/host hard dependency。
- evaluator/runtime、public projection、release 与 lifecycle：未启动、未授权。

下一次 ForgeRail 恢复首先读取本文，再读取 delta review，随后读取 active change 的 `tasks.md` 2.10–2.11。不要通过公开投影恢复 canonical architecture。
