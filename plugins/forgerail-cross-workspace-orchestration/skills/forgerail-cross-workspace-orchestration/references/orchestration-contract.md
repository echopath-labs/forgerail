# Orchestration Contract

## Master coordination view

Keep the smallest recoverable view, in the active task or an already-authorized project record:

- work item and owner workspace;
- repository, branch, PR, release, canonical, and aggregate writer identities;
- dependency predecessors and current wave;
- exact allowed/prohibited operations and independent approval gates;
- status: `pending`, `active`, `review-required`, `accepted`, `failed`, `paused`, or `blocked`;
- latest accepted receipt and next eligible task.

Do not create a second task database or `.forgerail/` orchestration directory by default.

## Master task responsibilities

- Resolve ownership and writer identities before dispatch.
- Freeze shared canonical/aggregate writes to the designated writer.
- Dispatch independent roots together and dependent work only after predecessor acceptance.
- Review exact handoffs against observable owner Git, files, tests, logs, and external receipts.
- Accept, reject for owner-source correction, pause, or replan. Do not patch an owner's product source from the master.
- Write aggregate evidence only after product receipts are accepted and only when the master owns that source.

## Product task envelope

Include owner workspace, intent, non-goals, allowed scope, prohibited operations, writer identity, dependency inputs, approval gates, validation, rollback, and return contract. Product tasks must not write shared aggregate sources.

## Stable product handoff

Require:

- branch plus exact 40-character commit, parent, and tree when Git-backed;
- task status and receipt identity;
- changed files/scope and clean/dirty worktree state;
- validation commands and results;
- external side effects and confirmed non-mutations;
- deviations and residual risks;
- rollback or safe recovery entry.

A delivered handoff remains `review-required` until the master validates it. Missing or mismatched Git identities, validation, owner, scope, approvals, or non-mutations keep dependents blocked.

## Approval matrix

Evaluate each requested action against its exact current gate. In particular:

- push, Draft PR, or remote CI may require `remote-integration-approval`;
- Ready transition, merge, tag, publish, deploy, or release may require `release-approval` and project runbooks;
- deprecate, archive, delete, redirect, transfer, default-branch, Ruleset, or other lifecycle mutation may require `lifecycle-change-approval` or a more specific project gate.

Never infer one row from another. Pack availability, enablement, task dispatch, durable-record approval, and transport delivery grant none of them.
