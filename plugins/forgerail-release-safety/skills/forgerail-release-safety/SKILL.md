---
name: forgerail-release-safety
description: Use when assessing or preparing package publication, deployment, promotion, shared-environment mutation, release verification, or rollback. Requires the project's own runbook and separate exact approval; it never invents or executes a generic production procedure.
---

# ForgeRail Release Safety

Default to Analyze First. This pack is a navigator and guardrail, not a release executor.

## Applicability

Use only for a task that may publish, deploy, promote, mutate a shared environment, or roll back a released artifact. Installation alone does not enable the pack, provide credentials, or authorize any release.

## Workflow

1. Resolve the smallest owner workspace, exact product, source commit, candidate artifact, target registry/environment, authenticated identity, and current remote state.
2. Discover the project-owned release runbook and authoritative versioning, validation, promotion, and rollback records. If no adequate runbook exists, report the gap and stop before mutation. Do not synthesize generic production steps.
3. Separate prerelease validation, registry publication, tag/release creation, deployment, production promotion, rollback, and lifecycle operations into independent gates when the project treats them separately.
4. Prepare an exact approval package with repo, branch, commit, artifact digests, target, allowed operations, prohibited operations, prerequisites, CI, rollback, and receipt fields.
5. Stop until the user explicitly approves the exact release scope. Approval for one product, environment, registry, or artifact does not authorize another.
6. The host Agent performs only the approved operations using the project runbook. This pack does not contain publish, deploy, promotion, or rollback commands.
7. Verify the Return Receipt against observable registry, Git, CI, release, deployment, and artifact evidence. Keep closeout incomplete on drift or missing evidence.

## Independent Gates

Release approval does not authorize repository Rulesets, default-branch policy, unrelated products, destructive rollback, lifecycle changes, or durable Profile changes. A rollback that deletes, overwrites, rewrites history, or affects production requires its own explicit approval.

Read `references/approval-package.md` before proposing a release operation.
