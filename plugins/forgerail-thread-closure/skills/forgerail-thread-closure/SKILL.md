---
name: forgerail-thread-closure
description: Use when implementation and validation are ready for task closeout, handoff, recovery preparation, durable-record review, or lifecycle assessment. It verifies evidence and proposes follow-up candidates without implementing them or writing durable records without separate approval.
---

# ForgeRail Thread Closure

Default to Analyze First. Closure is evidence verification, not a shortcut for additional implementation or lifecycle mutation.

## Applicability

Use after the requested implementation or investigation has reached a claimed outcome and the task needs a closeout, handoff, or recovery entry. Installation alone does not activate closure or authorize durable writes.

## Workflow

1. Re-resolve the owner workspace and compare the original Task Envelope with the claimed Return Receipt.
2. Verify allowed and prohibited operations, files changed, Git state, validation results, external receipts, deviations, residual risks, rollback, and the next recovery entry using observable evidence.
3. Keep closeout incomplete when required evidence is missing, self-report conflicts with observable state, validation is failing, or ownership remains ambiguous.
4. Discover the workspace's existing durable-record habit. Classify decisions, risks, context debt, and policy improvements as record or Profile change candidates; do not silently persist them.
5. Present any proposed durable write with provenance, exact destination, and impact. Stop until the user explicitly approves that exact durable-record write.
6. Report the closure state as complete, incomplete, or blocked, plus the recovery entry and bounded follow-up candidates. Do not implement follow-up work during closure.

## Independent Gates

Durable-record approval does not authorize task/archive lifecycle changes. Lifecycle change approval does not authorize release, repository policy, external issue creation, merge, deletion, or unrelated work.

Read `references/closure-checklist.md` before declaring closure complete.
