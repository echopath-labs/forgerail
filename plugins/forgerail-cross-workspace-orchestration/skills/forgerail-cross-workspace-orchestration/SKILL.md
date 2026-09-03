---
name: forgerail-cross-workspace-orchestration
description: Govern master-task coordination across two or more workspaces with genuine independent owner, repository, or release boundaries when dependency evidence permits safe parallel work. Use for multi-product or multi-repository waves that need single-writer identities, non-transitive approvals, stable handoff review, partial-failure recovery, and host-capability fallback. Do not use for ordinary single-repository tasks, monorepo folder splits, or parallel writes to one branch, PR, release, canonical source, or aggregate.
---

# ForgeRail Cross-Workspace Orchestration

Default to read, plan, and recommend. Treat installation as availability, not enablement, task creation, durable write, remote integration, release, or lifecycle authorization.

## Gate Activation

Recommend or activate only when all are true:

1. At least two work items have independently owned workspace, repository, or release identities.
2. The dependency graph exposes stages that can safely progress in parallel.
3. Every write target has one unambiguous writer identity.
4. The benefit exceeds the coordination and review cost.

Otherwise use ForgeRail Core for one task or keep the work serial. Multiple folders, packages, reads, or agents alone do not satisfy the gate.

## Govern The Master

1. Resolve owners and dependency edges before dispatch.
2. Assign waves only after checking repository + branch, PR, release, canonical, and aggregate writer identities.
3. Give every owner task exact scope, allowed and prohibited operations, approval gates, validation, rollback, and return fields.
4. Keep shared canonical and aggregate sources under one master writer. Never ask product tasks to double-write them.
5. Review a stable handoff against owner-source evidence before accepting it or unlocking dependents.
6. Return missing, drifting, or conflicting evidence to the owner workspace for source-first correction.

## Preserve Invariants

- Allow one writer for each shared canonical or aggregate source.
- Allow one concurrent writer for the same repository + branch, PR, or release identity.
- Serialize product-internal dependency edges; parallelize only independent cross-product stages.
- Keep `remote-integration-approval`, `release-approval`, `production-change-approval`, and `lifecycle-change-approval` independent and non-transitive. A production deployment requires both its release gate and its independent production-change gate.
- Do not expand an active task when priorities change; stop new dispatch and recompute pending waves.
- Preserve accepted independent receipts during partial failure. Pause the failure and its dependency descendants.
- Treat transport delivery as evidence of delivery, never as master acceptance.
- Follow the project's existing OpenSpec, Spec Kit, ADR, Markdown, issue, or other record habits; do not create orchestration state without separate durable-write authorization.

Require product handoffs to identify exact branch, commit, parent, tree, status, changed scope, validation, rollback or recovery, external side effects, confirmed non-mutations, deviations, and receipt identity.

Read `references/orchestration-contract.md` when preparing master/owner handoffs or reviewing receipts. Read `references/host-adapters-and-recovery.md` when host task APIs, RelayPact, EchoPath, pause, restart, drift, partial failure, or priority changes are in scope.
