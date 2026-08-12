---
name: forgerail-workspace-diagnosis
description: Use on the first important ForgeRail task, on explicit request, or when workspace rules conflict, drift, or appear insufficient. Performs a bounded read-only diagnosis of existing instructions, records, Git and delivery habits, Skills, and recovery signals before recommending governance changes.
---

# ForgeRail Workspace Diagnosis

Default to Analyze First and read-only operation.

## Boundaries

- Inspect the smallest owner workspace first.
- Do not bulk-read archives, dependencies, secrets, unrelated child repositories, or broad history.
- Do not edit files, install systems, create issues, change repository settings, or persist a Profile without separate authorization.
- An unavailable integration is not evidence of empty history.

## Diagnosis

1. Identify workspace and nested owner boundaries.
2. Observe the nearest Agent instructions, Git/default branch evidence, existing record systems, validation/build entries, installed Skills/Plugins, and declared delivery rules.
3. Classify every finding as `observed_fact`, `inference`, `gap`, `recommendation`, or `requires_confirmation`.
4. Follow existing habits when they are coherent and sufficient.
5. Recommend a record-system change only for a concrete gap. OpenSpec may be a preferred example, but Spec Kit, Markdown/ADR, issue-based, or custom documented systems remain valid.
6. Recommend packs as candidates; installation never implies activation.

## Output

Return:

- boundary and evidence inventory;
- existing habits and source locators;
- conflicts and gaps;
- effective defaults that can safely be inherited;
- at most a few prioritized recommendations;
- changes requiring explicit approval;
- whether a full `$workspace-health-review` is warranted.

Read `references/record-strategies.md` when evaluating how the workspace records durable engineering context.
