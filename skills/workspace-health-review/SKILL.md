---
name: workspace-health-review
description: Use for periodic or requested workspace health reviews focused on durable records, agent instructions, skills, rules, ownership, stale context, context drift, context debt, and recovery risks. Use before large refactors, releases, onboarding, or cleanup. Do not use for implementation or release execution.
---

# Workspace Health Review

Review whether the workspace remains maintainable, recoverable, and safe for Agents.

This is the first built-in ForgeRail Capability Pack and preserves the established `workspace-health-review` identity. It remains independently invokable and defaults to Analyze First.

## Boundaries

- Analyze First means read-only inspection and a report. Do not modify files,
  delete rules, implement features, execute releases, archive records, rewrite
  Skills, or change Agent instructions without approval for that action and scope.
  Reuse valid existing approval; a review request alone does not authorize repairs.
- Follow the smallest owner workspace and distinguish project extensions from portable findings.
- Do not require ForgeRail Core to be invoked first.
- Do not start a full review merely because Core is active. Keep health separate
  from implementation, release execution and task-level completion.
- Default to standalone repository evidence. Load
  [optional platform guidance](references/context-governance-platform.md) only
  when the user has enabled that source. Unavailable history stays unavailable.
- Never initialize a record system during a review. Respect project extensions,
  label their findings separately, and surface material conflicts.
- Read the smallest relevant evidence set. Do not bulk-read archives, generated
  files, dependencies, private data or unrelated child repositories. If an
  excluded source becomes necessary, identify the specific scope and reason first.

## Review

1. Map workspace and child ownership boundaries.
2. Inventory existing Agent entries, record systems, Skills, docs, rules, and recovery surfaces.
3. Review durable-record health, instruction duplication, default context load, ownership, recovery, drift, and debt.
4. Use categorical status: `Healthy`, `Watch`, `Risky`, or `Critical`. Use a number only with an explained method and evidence.
5. Return path-based P0/P1/P2 findings and separate observations from proposed modifications.
6. Recommend ForgeRail Profile or pack changes only as candidates requiring confirmation.

Read [health signals](references/health-review.md) for detailed review areas and
[the report template](references/report-template.md) when producing the review.
The report must cover inventory, durable records, instructions, Skill load,
ownership, recovery and root indexes, lifecycle, drift, debt, prioritized
path-based evidence, proposed actions and next review. A numeric score is
optional and needs its method and evidence.

Read [the result contract](references/result-contract.md) only for an explicitly
requested machine-readable report or approved structured exchange. Keep the
human-readable report as the default. Identify the actual ForgeRail provider;
do not imply the legacy AGW Plugin executed. Use the host-discovered namespaced
Skill identity if another Plugin or project has the same short name.
